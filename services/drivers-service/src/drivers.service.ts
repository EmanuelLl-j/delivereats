import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  AssignmentRequestStatus,
  AssignmentStatus,
  DriverStatus,
  Prisma,
} from './generated/prisma';
import { EventPublisher } from '@delivereats/backend-kit';
import { OrderStatus, type DriverLocation } from '@delivereats/shared-types';
import { haversineKm } from '@delivereats/shared-utils';
import {
  AdminDriverStatusDto,
  CreateDriverProfileDto,
  LocationDto,
  OfferAssignmentDto,
  SetAvailabilityDto,
} from './dto';
import { PrismaService } from './prisma.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingStore } from './tracking.service';

type StoredPickup = { merchantId: string; name: string; latitude: number; longitude: number };
type StoredDestination = { address: string; latitude: number; longitude: number };

@Injectable()
export class DriversService implements OnModuleInit, OnModuleDestroy {
  private expirationTimer?: NodeJS.Timeout;
  private readonly lastPersisted = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingStore,
    private readonly gateway: TrackingGateway,
    private readonly events: EventPublisher,
  ) {}

  onModuleInit(): void {
    this.expirationTimer = setInterval(() => void this.expireOffers(), 3_000);
    this.expirationTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.expirationTimer) clearInterval(this.expirationTimer);
  }

  async profile(userId: string) {
    const profile = await this.prisma.driverProfile.findUnique({
      where: { userId },
      include: { assignments: { orderBy: { assignedAt: 'desc' }, take: 20 } },
    });
    if (!profile)
      throw new NotFoundException({
        code: 'DRIVER_PROFILE_NOT_FOUND',
        message: 'Perfil de repartidor no encontrado',
      });
    return profile;
  }

  async availability(userId: string, dto: SetAvailabilityDto) {
    if (![DriverStatus.AVAILABLE, DriverStatus.OFFLINE].includes(dto.status)) {
      throw new BadRequestException({
        code: 'DRIVER_STATUS_INVALID',
        message: 'Solo puedes conectarte o desconectarte',
      });
    }
    const profile = await this.profile(userId);
    if (profile.status === DriverStatus.RESERVED || profile.status === DriverStatus.BUSY) {
      throw new ConflictException({
        code: 'DRIVER_HAS_ACTIVE_ORDER',
        message: 'No puedes cambiar disponibilidad mientras tienes un pedido activo',
      });
    }
    if (!profile.approvedAt || profile.status === DriverStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'DRIVER_NOT_APPROVED',
        message: 'El perfil no está aprobado para repartir',
      });
    }
    return this.prisma.driverProfile.update({
      where: { id: profile.id },
      data: { status: dto.status, version: { increment: 1 } },
    });
  }

  async activeOffer(userId: string) {
    const profile = await this.profile(userId);
    return this.prisma.driverAssignment.findFirst({
      where: {
        driverId: profile.id,
        status: AssignmentStatus.OFFERED,
        expiresAt: { gt: new Date() },
      },
      orderBy: { assignedAt: 'desc' },
    });
  }

  async offer(dto: OfferAssignmentDto, correlationId?: string) {
    await this.prisma.assignmentRequest.upsert({
      where: { orderId: dto.orderId },
      create: {
        orderId: dto.orderId,
        pickupPoints: dto.pickupPoints as unknown as Prisma.InputJsonValue,
        destination: dto.destination as unknown as Prisma.InputJsonValue,
        estimatedEarnings: dto.estimatedEarnings,
        pickupCount: dto.pickupPoints.length,
      },
      update: {
        pickupPoints: dto.pickupPoints as unknown as Prisma.InputJsonValue,
        destination: dto.destination as unknown as Prisma.InputJsonValue,
        estimatedEarnings: dto.estimatedEarnings,
        pickupCount: dto.pickupPoints.length,
        status: AssignmentRequestStatus.SEARCHING,
      },
    });
    const result = await this.offerStored(dto.orderId);
    if (result) {
      await this.events.publish(
        'driver.assigned',
        {
          orderId: dto.orderId,
          driverId: result.driverId,
          assignmentId: result.id,
          phase: 'OFFERED',
        },
        correlationId,
      );
    }
    return result
      ? { driverId: result.driverId, assignment: result }
      : { driverId: null, assignment: null };
  }

  async accept(userId: string, assignmentId: string, correlationId?: string) {
    const profile = await this.profile(userId);
    const assignment = await this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          const claimed = await tx.driverAssignment.updateMany({
            where: {
              id: assignmentId,
              driverId: profile.id,
              status: AssignmentStatus.OFFERED,
              expiresAt: { gt: new Date() },
            },
            data: { status: AssignmentStatus.ACCEPTED, acceptedAt: new Date() },
          });
          if (!claimed.count)
            throw new ConflictException({
              code: 'ASSIGNMENT_NOT_AVAILABLE',
              message: 'La oferta venció o ya fue respondida',
            });
          const driverClaim = await tx.driverProfile.updateMany({
            where: { id: profile.id, status: DriverStatus.RESERVED },
            data: { status: DriverStatus.BUSY, version: { increment: 1 } },
          });
          if (!driverClaim.count)
            throw new ConflictException({
              code: 'DRIVER_NOT_RESERVED',
              message: 'El repartidor ya no está reservado',
            });
          const current = await tx.driverAssignment.findUniqueOrThrow({
            where: { id: assignmentId },
          });
          await tx.assignmentRequest.update({
            where: { orderId: current.orderId },
            data: { status: AssignmentRequestStatus.ASSIGNED },
          });
          return current;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
    const response = await this.callOrders(
      assignment.orderId,
      'assign',
      { driverId: profile.id },
      correlationId,
    );
    if (!response.ok)
      throw new ConflictException({
        code: 'ORDER_ASSIGNMENT_FAILED',
        message: 'El pedido no aceptó la asignación; vuelve a intentar',
      });
    await this.events.publish(
      'driver.assigned',
      {
        orderId: assignment.orderId,
        driverId: profile.id,
        userId,
        assignmentId,
        phase: 'ACCEPTED',
      },
      correlationId,
    );
    return assignment;
  }

  async reject(userId: string, assignmentId: string, correlationId?: string) {
    const profile = await this.profile(userId);
    const assignment = await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.driverAssignment.updateMany({
        where: { id: assignmentId, driverId: profile.id, status: AssignmentStatus.OFFERED },
        data: { status: AssignmentStatus.REJECTED, rejectedAt: new Date() },
      });
      if (!claimed.count)
        throw new ConflictException({
          code: 'ASSIGNMENT_NOT_AVAILABLE',
          message: 'La oferta ya fue respondida',
        });
      await tx.driverProfile.updateMany({
        where: { id: profile.id, status: DriverStatus.RESERVED },
        data: { status: DriverStatus.AVAILABLE, version: { increment: 1 } },
      });
      return tx.driverAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
    });
    await this.events.publish(
      'driver.assignment.rejected',
      { orderId: assignment.orderId, driverId: profile.id },
      correlationId,
    );
    void this.offerStored(assignment.orderId);
    return assignment;
  }

  async pickup(userId: string, assignmentId: string, subOrderId: string, correlationId?: string) {
    const { profile, assignment } = await this.activeAssignment(userId, assignmentId);
    const response = await this.callOrders(
      assignment.orderId,
      `pickups/${subOrderId}`,
      { driverId: profile.id },
      correlationId,
    );
    if (!response.ok)
      throw new ConflictException({
        code: 'ORDER_PICKUP_FAILED',
        message: 'No se pudo confirmar la recogida',
      });
    return response.json();
  }

  async assignmentOrder(userId: string, assignmentId: string) {
    const { assignment } = await this.activeAssignment(userId, assignmentId);
    const response = await fetch(
      `${process.env.ORDERS_SERVICE_URL ?? 'http://localhost:3002'}/internal/orders/${assignment.orderId}/details`,
      { headers: { 'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET ?? '' } },
    );
    if (!response.ok)
      throw new NotFoundException({
        code: 'ORDER_NOT_FOUND',
        message: 'No se pudo consultar el pedido asignado',
      });
    return response.json();
  }

  async updateOrderStatus(
    userId: string,
    assignmentId: string,
    status: OrderStatus,
    correlationId?: string,
  ) {
    const { profile, assignment } = await this.activeAssignment(userId, assignmentId);
    if (![OrderStatus.ON_THE_WAY, OrderStatus.DELIVERED].includes(status)) {
      throw new BadRequestException({
        code: 'DRIVER_ORDER_STATUS_INVALID',
        message: 'Estado de reparto inválido',
      });
    }
    const response = await this.callOrders(
      assignment.orderId,
      'driver-status',
      { driverId: profile.id, status },
      correlationId,
    );
    if (!response.ok)
      throw new ConflictException({
        code: 'ORDER_STATUS_FAILED',
        message: 'El pedido no aceptó el cambio de estado',
      });
    if (status === OrderStatus.DELIVERED) {
      await this.prisma.$transaction([
        this.prisma.driverAssignment.update({
          where: { id: assignment.id },
          data: { status: AssignmentStatus.COMPLETED, completedAt: new Date() },
        }),
        this.prisma.driverProfile.update({
          where: { id: profile.id },
          data: {
            status: DriverStatus.AVAILABLE,
            completedOrders: { increment: 1 },
            version: { increment: 1 },
          },
        }),
        this.prisma.assignmentRequest.update({
          where: { orderId: assignment.orderId },
          data: { status: AssignmentRequestStatus.COMPLETED },
        }),
      ]);
      await this.events.publish(
        'order.delivered',
        { orderId: assignment.orderId, driverId: profile.id },
        correlationId,
      );
    }
    return response.json();
  }

  async location(userId: string, dto: LocationDto) {
    const profile = await this.profile(userId);
    if (profile.status !== DriverStatus.BUSY && dto.orderId) {
      throw new ForbiddenException({
        code: 'DRIVER_NOT_ON_DELIVERY',
        message: 'Solo puedes enviar tracking durante una entrega',
      });
    }
    if (dto.orderId) {
      const active = await this.prisma.driverAssignment.findFirst({
        where: { driverId: profile.id, orderId: dto.orderId, status: AssignmentStatus.ACCEPTED },
      });
      if (!active) throw new ForbiddenException('No tienes una asignación activa para este pedido');
    }
    const location: DriverLocation = {
      driverId: profile.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      speed: dto.speed,
      timestamp: dto.timestamp ?? new Date().toISOString(),
    };
    await this.tracking.set(location);
    this.gateway.emitLocation(dto.orderId, location);
    const last = this.lastPersisted.get(profile.id) ?? 0;
    if (Date.now() - last >= 60_000) {
      this.lastPersisted.set(profile.id, Date.now());
      await this.prisma.$transaction([
        this.prisma.driverProfile.update({
          where: { id: profile.id },
          data: {
            currentLatitude: dto.latitude,
            currentLongitude: dto.longitude,
            lastLocationAt: new Date(),
          },
        }),
        this.prisma.locationSample.create({
          data: {
            driverId: profile.id,
            orderId: dto.orderId,
            latitude: dto.latitude,
            longitude: dto.longitude,
            speed: dto.speed,
          },
        }),
      ]);
    }
    return location;
  }

  async orderLocation(orderId: string) {
    const assignment = await this.prisma.driverAssignment.findFirst({
      where: { orderId, status: { in: [AssignmentStatus.ACCEPTED, AssignmentStatus.COMPLETED] } },
      orderBy: { assignedAt: 'desc' },
    });
    if (!assignment) return null;
    return this.tracking.get(assignment.driverId);
  }

  list() {
    return this.prisma.driverProfile.findMany({
      include: {
        assignments: {
          where: { status: { in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED] } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(dto: CreateDriverProfileDto) {
    return this.prisma.driverProfile.create({ data: dto });
  }

  async setAdminStatus(id: string, dto: AdminDriverStatusDto) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id } });
    if (!driver)
      throw new NotFoundException({
        code: 'DRIVER_NOT_FOUND',
        message: 'Repartidor no encontrado',
      });
    if (driver.status === DriverStatus.BUSY && dto.status === DriverStatus.AVAILABLE) {
      const active = await this.prisma.driverAssignment.count({
        where: { driverId: id, status: AssignmentStatus.ACCEPTED },
      });
      if (active)
        throw new ConflictException({
          code: 'DRIVER_HAS_ACTIVE_ORDER',
          message: 'No se puede liberar un repartidor con pedido activo',
        });
    }
    return this.prisma.driverProfile.update({
      where: { id },
      data: {
        status: dto.status,
        ...(dto.status === DriverStatus.AVAILABLE && !driver.approvedAt
          ? { approvedAt: new Date() }
          : {}),
        version: { increment: 1 },
      },
    });
  }

  async expireOffers(): Promise<void> {
    const expired = await this.prisma.driverAssignment.findMany({
      where: { status: AssignmentStatus.OFFERED, expiresAt: { lte: new Date() } },
      take: 50,
    });
    for (const assignment of expired) {
      await this.prisma.$transaction(async (tx) => {
        const claimed = await tx.driverAssignment.updateMany({
          where: { id: assignment.id, status: AssignmentStatus.OFFERED },
          data: { status: AssignmentStatus.EXPIRED },
        });
        if (claimed.count) {
          await tx.driverProfile.updateMany({
            where: { id: assignment.driverId, status: DriverStatus.RESERVED },
            data: { status: DriverStatus.AVAILABLE, version: { increment: 1 } },
          });
        }
      });
      void this.offerStored(assignment.orderId);
    }
  }

  private async offerStored(orderId: string) {
    return this.withSerializableRetry(() =>
      this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
          const request = await tx.assignmentRequest.findUnique({ where: { orderId } });
          if (!request || request.status !== AssignmentRequestStatus.SEARCHING) return null;
          const active = await tx.driverAssignment.findFirst({
            where: {
              orderId,
              status: { in: [AssignmentStatus.OFFERED, AssignmentStatus.ACCEPTED] },
            },
          });
          if (active) return active;
          const pickup = (request.pickupPoints as StoredPickup[])[0];
          if (!pickup) return null;
          const candidates = await tx.driverProfile.findMany({
            where: {
              status: DriverStatus.AVAILABLE,
              approvedAt: { not: null },
              currentLatitude: { not: null },
              currentLongitude: { not: null },
            },
            take: 50,
          });
          candidates.sort(
            (a, b) =>
              haversineKm(
                { latitude: Number(a.currentLatitude), longitude: Number(a.currentLongitude) },
                pickup,
              ) -
              haversineKm(
                { latitude: Number(b.currentLatitude), longitude: Number(b.currentLongitude) },
                pickup,
              ),
          );
          for (const candidate of candidates) {
            const reserved = await tx.driverProfile.updateMany({
              where: {
                id: candidate.id,
                status: DriverStatus.AVAILABLE,
                version: candidate.version,
              },
              data: { status: DriverStatus.RESERVED, version: { increment: 1 } },
            });
            if (!reserved.count) continue;
            const destination = request.destination as StoredDestination;
            return tx.driverAssignment.create({
              data: {
                orderId,
                driverId: candidate.id,
                status: AssignmentStatus.OFFERED,
                estimatedEarnings: request.estimatedEarnings,
                pickupCount: request.pickupCount,
                destination: destination.address,
                expiresAt: new Date(Date.now() + 15_000),
              },
            });
          }
          return null;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  }

  private async activeAssignment(userId: string, assignmentId: string) {
    const profile = await this.profile(userId);
    const assignment = await this.prisma.driverAssignment.findFirst({
      where: { id: assignmentId, driverId: profile.id, status: AssignmentStatus.ACCEPTED },
    });
    if (!assignment)
      throw new NotFoundException({
        code: 'ASSIGNMENT_NOT_FOUND',
        message: 'Asignación activa no encontrada',
      });
    return { profile, assignment };
  }

  private async withSerializableRetry<T>(operation: () => Promise<T>, maxAttempts = 8): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? (error as { code?: unknown }).code
            : undefined;
        if (code !== 'P2034' || attempt >= maxAttempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 12 + Math.random() * 12));
      }
    }
  }

  private callOrders(
    orderId: string,
    action: string,
    body: Record<string, unknown>,
    correlationId?: string,
  ) {
    return fetch(
      `${process.env.ORDERS_SERVICE_URL ?? 'http://localhost:3002'}/internal/orders/${orderId}/${action}`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-service-secret': process.env.INTERNAL_SERVICE_SECRET ?? '',
          'x-correlation-id': correlationId ?? '',
        },
        body: JSON.stringify(body),
      },
    ).catch(() => ({ ok: false, json: async () => ({}) }) as Response);
  }
}
