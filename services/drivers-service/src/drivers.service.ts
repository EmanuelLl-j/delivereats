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
import { EventPublisher, internalRequest, requireLegal, requireOwnedFile } from '@delivereats/backend-kit';
import { OrderStatus, type DriverLocation, type JwtPayload } from '@delivereats/shared-types';
import { ParticipantsService } from './participants.service';
import { haversineKm } from '@delivereats/shared-utils';
import {
  AdminDriverStatusDto,
  CreateDriverProfileDto,
  LocationDto,
  OfferAssignmentDto,
  SetAvailabilityDto,
  DriverApplicationDto,
  DriverReviewDto,
  ShipmentCodeDto,
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
    private readonly participants: ParticipantsService,
  ) {}

  onModuleInit(): void {
    this.expirationTimer = setInterval(() => void this.expireOffers().then(() => this.reconcile()).catch(() => undefined), 3_000);
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

  audit() { return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }); }

  async earnings(userId: string, period = 'day') {
    if (!['day', 'week', 'month', 'year'].includes(period)) throw new BadRequestException('Periodo inválido');
    const profile = await this.profile(userId);
    const localDate = new Date(Date.now() - 5 * 3600_000).toISOString().slice(0, 10);
    const start = new Date(localDate + 'T00:00:00-05:00');
    start.setDate(start.getDate() - ({ day: 0, week: 6, month: 29, year: 364 }[period] ?? 0));
    const totals = await this.prisma.driverAssignment.aggregate({ where: { driverId: profile.id, status: 'COMPLETED', completedAt: { gte: start } }, _sum: { estimatedEarnings: true }, _count: true });
    const amount = Number(totals._sum.estimatedEarnings ?? 0);
    return { period, from: start.toISOString(), completed: totals._count, amount, average: totals._count ? amount / totals._count : 0, currency: 'PEN', settlementStatus: 'ACCRUED_NOT_BANK_SETTLEMENT' };
  }

  async history(userId: string, cursor?: string) {
    const profile = await this.profile(userId);
    if (cursor && !/^[a-f0-9-]{36}$/i.test(cursor)) throw new BadRequestException('Cursor inválido');
    const rows = await this.prisma.driverAssignment.findMany({ where: { driverId: profile.id }, orderBy: [{ assignedAt: 'desc' }, { id: 'desc' }], take: 51, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return { items: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49]!.id : null };
  }

  async availability(userId: string, dto: SetAvailabilityDto) {
    await requireLegal(userId, ['GENERAL_TERMS', 'PRIVACY_POLICY', 'DRIVER_TERMS']);
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
    if (!profile.approvedAt || profile.applicationStatus !== 'APPROVED' || profile.status === DriverStatus.SUSPENDED) {
      throw new ForbiddenException({
        code: 'DRIVER_NOT_APPROVED',
        message: 'El perfil no está aprobado para repartir',
      });
    }
    const claimed = await this.prisma.driverProfile.updateMany({
      where: { id: profile.id, version: profile.version, status: { in: ['AVAILABLE', 'OFFLINE'] }, applicationStatus: 'APPROVED' },
      data: { status: dto.status, version: { increment: 1 } },
    });
    if (!claimed.count) throw new ConflictException('Tu disponibilidad cambió; vuelve a cargarla');
    return this.profile(userId);
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

  async offer(dto: OfferAssignmentDto, _correlationId?: string) {
    await this.prisma.assignmentRequest.upsert({
      where: { orderId: dto.orderId },
      create: {
        orderId: dto.orderId,
        pickupPoints: dto.pickupPoints as unknown as Prisma.InputJsonValue,
        destination: dto.destination as unknown as Prisma.InputJsonValue,
        estimatedEarnings: dto.estimatedEarnings,
        pickupCount: dto.pickupPoints.length,
        vehicleTypes: dto.vehicleTypes,
      },
      update: {
        pickupPoints: dto.pickupPoints as unknown as Prisma.InputJsonValue,
        destination: dto.destination as unknown as Prisma.InputJsonValue,
        estimatedEarnings: dto.estimatedEarnings,
        pickupCount: dto.pickupPoints.length,
        vehicleTypes: dto.vehicleTypes,
      },
    });
    const result = await this.offerStored(dto.orderId);
    return result
      ? { driverId: result.driverId, assignment: result }
      : { driverId: null, assignment: null };
  }

  async accept(userId: string, assignmentId: string, correlationId?: string) {
    await requireLegal(userId, ['GENERAL_TERMS', 'PRIVACY_POLICY', 'DRIVER_TERMS']);
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
            where: { id: profile.id, status: DriverStatus.RESERVED, version: profile.version, applicationStatus: 'APPROVED' },
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
        message: 'La asignación está conciliándose. Consulta tu entrega activa; no aceptes otra oferta.',
      });
    await this.events.publish(
      'driver.accepted',
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
    void this.offerStored(assignment.orderId).catch(() => undefined);
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
    if (status === OrderStatus.DELIVERED) await this.finishAssignment(assignment.id, true);
    return response.json();
  }

  async location(userId: string, dto: LocationDto) {
    const profile = await this.profile(userId);
    if (profile.applicationStatus !== 'APPROVED') throw new ForbiddenException('Perfil no aprobado');
    const timestamp = new Date(dto.timestamp ?? Date.now()).getTime();
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 15_000 || timestamp < Date.now() - 10 * 60_000) throw new BadRequestException('La marca temporal GPS no es válida');
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
    const stored = await this.tracking.set(location);
    if (!stored) return { accepted: false, reason: 'STALE_OR_DUPLICATE' };
    await this.gateway.emitLocation(dto.orderId, location);
    const last = this.lastPersisted.get(profile.id) ?? 0;
    if (Date.now() - last >= 60_000) {
      this.lastPersisted.set(profile.id, Date.now());
      await this.prisma.$transaction([
        this.prisma.driverProfile.update({
          where: { id: profile.id },
          data: {
            currentLatitude: dto.latitude,
            currentLongitude: dto.longitude,
            lastLocationAt: new Date(location.timestamp),
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

  async locationBatch(userId: string, locations: LocationDto[]) {
    const sorted = [...locations].sort((a, b) => new Date(a.timestamp ?? 0).getTime() - new Date(b.timestamp ?? 0).getTime());
    const results = [];
    for (const location of sorted) results.push(await this.location(userId, location));
    return { processed: results.length, results };
  }

  async orderLocation(user: JwtPayload, orderId: string) {
    const context = await this.participants.require(user, orderId, true);
    if (['DELIVERED', 'CANCELLED'].includes(context.order.status)) return null;
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

  async apply(userId: string, dto: DriverApplicationDto) {
    await requireLegal(userId, ['GENERAL_TERMS', 'PRIVACY_POLICY', 'DRIVER_TERMS']);
    for (const id of dto.documentIds) await requireOwnedFile(userId, id, ['DRIVER_DOCUMENT']);
    if (dto.vehicleType !== 'BICYCLE' && (!dto.vehiclePlate || !dto.licenseNumber)) throw new BadRequestException('Se requiere placa y licencia para este vehículo');
    if (!/^\d{8,12}$/.test(dto.documentNumber)) throw new BadRequestException('Documento inválido');
    const { documentIds, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const existing = await tx.driverProfile.findUnique({ where: { userId } });
      if (existing && existing.applicationStatus !== 'REJECTED') throw new ConflictException('Ya existe una solicitud o perfil');
      const result = existing ? await tx.driverProfile.update({ where: { userId }, data: { ...data, documents: documentIds, applicationStatus: 'PENDING_REVIEW', status: 'OFFLINE', approvedAt: null, reviewReason: null, version: { increment: 1 } } }) : await tx.driverProfile.create({ data: { ...data, userId, documents: documentIds, applicationStatus: 'PENDING_REVIEW', status: 'OFFLINE' } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'DRIVER_APPLICATION_SUBMITTED', entity: 'DriverProfile', entityId: result.id } });
      return result;
    });
  }

  async review(adminId: string, id: string, dto: DriverReviewDto) {
    return this.prisma.$transaction(async tx => {
      const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id } });
      if (driver.userId === adminId) throw new ForbiddenException('No puedes aprobarte a ti mismo');
      if (['BUSY', 'RESERVED'].includes(driver.status)) throw new ConflictException('Resuelve la entrega u oferta activa antes de modificar la solicitud');
      if (dto.status === 'APPROVED' && !driver.documents) throw new BadRequestException('La solicitud no tiene documentos');
      const claimed = await tx.driverProfile.updateMany({ where: { id, version: driver.version }, data: { applicationStatus: dto.status, status: dto.status === 'APPROVED' ? 'OFFLINE' : 'SUSPENDED', approvedAt: dto.status === 'APPROVED' ? new Date() : null, reviewedBy: adminId, reviewReason: dto.reason, version: { increment: 1 } } });
      if (!claimed.count) throw new ConflictException('El perfil cambió; vuelve a cargarlo');
      await tx.auditLog.create({ data: { actorUserId: adminId, action: 'DRIVER_REVIEWED', entity: 'DriverProfile', entityId: id, metadata: { status: dto.status, reason: dto.reason } } });
      return tx.driverProfile.findUniqueOrThrow({ where: { id } });
    });
  }

  async setAdminStatus(adminId: string, id: string, dto: AdminDriverStatusDto) {
    if (!['OFFLINE', 'SUSPENDED'].includes(dto.status)) throw new BadRequestException('Administración solo puede desconectar o suspender; la disponibilidad la establece el repartidor aprobado');
    const driver = await this.prisma.driverProfile.findUniqueOrThrow({ where: { id } });
    if (['BUSY', 'RESERVED'].includes(driver.status)) throw new ConflictException('Resuelve primero la entrega activa');
    return this.prisma.$transaction(async tx => {
      const claimed = await tx.driverProfile.updateMany({ where: { id, version: driver.version }, data: { status: dto.status, version: { increment: 1 }, ...(dto.status === 'SUSPENDED' ? { applicationStatus: 'SUSPENDED' } : {}) } });
      if (!claimed.count) throw new ConflictException('El perfil cambió');
      await tx.auditLog.create({ data: { actorUserId: adminId, action: 'DRIVER_STATUS_CHANGED', entity: 'DriverProfile', entityId: id, metadata: { status: dto.status, reason: dto.reason } } });
      return this.prisma.driverProfile.findUniqueOrThrow({ where: { id } });
    });
  }

  async verifyShipment(userId: string, assignmentId: string, dto: ShipmentCodeDto) {
    const { profile, assignment } = await this.activeAssignment(userId, assignmentId);
    const result = await internalRequest<{ orderId: string; status: string }>('orders', `/internal/shipments/${assignment.orderId}/verify`, { ...dto, driverId: profile.id, driverUserId: userId });
    if (result.status === 'DELIVERED') await this.finishAssignment(assignment.id, true);
    return result;
  }

  async finishAssignment(assignmentId: string, delivered: boolean) {
    return this.prisma.$transaction(async tx => {
      const assignment = await tx.driverAssignment.findUniqueOrThrow({ where: { id: assignmentId } });
      const claimed = await tx.driverAssignment.updateMany({ where: { id: assignmentId, status: { in: ['ACCEPTED', 'OFFERED'] } }, data: { status: delivered ? 'COMPLETED' : 'REJECTED', ...(delivered ? { completedAt: new Date() } : { rejectedAt: new Date() }) } });
      if (!claimed.count) return;
      await tx.driverProfile.updateMany({ where: { id: assignment.driverId, status: { in: ['BUSY', 'RESERVED'] } }, data: { status: 'AVAILABLE', completedOrders: { increment: delivered ? 1 : 0 }, version: { increment: 1 } } });
      await tx.assignmentRequest.update({ where: { orderId: assignment.orderId }, data: { status: delivered ? 'COMPLETED' : 'CANCELLED' } });
    });
  }

  private reconciling = false;
  async reconcile() {
    if (this.reconciling) return;
    this.reconciling = true;
    try {
      const pending = await this.prisma.driverAssignment.findMany({ where: { status: { in: ['ACCEPTED', 'OFFERED'] } }, orderBy: { assignedAt: 'asc' }, take: 100 });
      for (const assignment of pending) {
        try {
          const order = await this.participants.context(assignment.orderId);
          if (order.status === 'CANCELLED' || (order.assignedDriverId && order.assignedDriverId !== assignment.driverId)) await this.finishAssignment(assignment.id, false);
          else if (order.status === 'DELIVERED') await this.finishAssignment(assignment.id, true);
          else if (order.status === 'SEARCHING_DRIVER' && assignment.status === 'ACCEPTED') await this.callOrders(assignment.orderId, 'assign', { driverId: assignment.driverId });
        } catch { /* Unknown remote outcome keeps the driver reserved until reconciliation succeeds. */ }
      }
      const searching = await this.prisma.assignmentRequest.findMany({ where: { status: 'SEARCHING' }, take: 30, orderBy: { updatedAt: 'asc' } });
      for (const request of searching) {
        try {
          const order = await this.participants.context(request.orderId);
          if (order.status === 'SEARCHING_DRIVER') await this.offerStored(request.orderId);
          else if (['CANCELLED', 'DELIVERED'].includes(order.status)) await this.prisma.assignmentRequest.update({ where: { orderId: request.orderId }, data: { status: order.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED' } });
        } catch { /* Durable requests are retried on the next pass. */ }
      }
    } finally { this.reconciling = false; }
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
      void this.offerStored(assignment.orderId).catch(() => undefined);
    }
  }

  async participation(orderId: string, userId: string) {
    return { allowed: Boolean(await this.prisma.driverAssignment.findFirst({ where: { orderId, driver: { userId }, acceptedAt: { not: null } }, select: { id: true } })) };
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
              applicationStatus: 'APPROVED',
              lastLocationAt: { gt: new Date(Date.now() - 2 * 60_000) },
              ...(Array.isArray(request.vehicleTypes) ? { vehicleType: { in: request.vehicleTypes as Array<'BICYCLE' | 'MOTORCYCLE' | 'CAR'> } } : {}),
              assignments: { none: { orderId, status: { in: ['REJECTED', 'EXPIRED'] }, assignedAt: { gt: new Date(Date.now() - 5 * 60_000) } } },
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
            const assignment = await tx.driverAssignment.create({
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
            await this.events.enqueue(tx, 'driver.assigned', { userId: candidate.userId, orderId, driverId: candidate.id, assignmentId: assignment.id, phase: 'OFFERED' });
            return assignment;
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

  private async withSerializableRetry<T>(operation: () => Promise<T>, maxAttempts = 24): Promise<T> {
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
        signal: AbortSignal.timeout(8_000),
      },
    ).catch(() => ({ ok: false, json: async () => ({}) }) as Response);
  }
}
