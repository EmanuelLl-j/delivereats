import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole as PrismaUserRole, UserStatus } from '../generated/prisma';
import { hash } from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { AdminCreateUserDto, CreateAddressDto, UserStatusDto } from '../auth/dto';

const safeSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async addAddress(userId: string, dto: CreateAddressDto) {
    const profile = await this.prisma.customerProfile.findUnique({ where: { userId } });
    if (!profile)
      throw new NotFoundException({
        code: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Perfil de cliente no encontrado',
      });
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { customerId: profile.id },
          data: { isDefault: false },
        });
      }
      const count = await tx.address.count({ where: { customerId: profile.id } });
      return tx.address.create({
        data: {
          customerId: profile.id,
          label: dto.label,
          address: dto.address,
          reference: dto.reference,
          district: dto.district ?? 'Ayacucho',
          province: 'Huamanga',
          department: 'Ayacucho',
          latitude: dto.latitude,
          longitude: dto.longitude,
          isDefault: dto.isDefault ?? count === 0,
        },
      });
    });
  }

  listAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { customer: { userId } },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  list(query: { search?: string; role?: PrismaUserRole; status?: UserStatus }) {
    return this.prisma.user.findMany({
      where: {
        role: query.role,
        status: query.status,
        ...(query.search
          ? {
              OR: [
                { email: { contains: query.search, mode: 'insensitive' as const } },
                { firstName: { contains: query.search, mode: 'insensitive' as const } },
                { lastName: { contains: query.search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      select: safeSelect,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async createByAdmin(actorUserId: string, dto: AdminCreateUserDto, ip?: string) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } })) {
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'El correo ya está registrado',
      });
    }
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          email: dto.email,
          phone: dto.phone,
          passwordHash: await hash(dto.password, 12),
          role: dto.role as PrismaUserRole,
          ...(dto.role === 'CUSTOMER' ? { customerProfile: { create: {} } } : {}),
        },
        select: safeSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: 'USER_CREATED',
          entity: 'User',
          entityId: user.id,
          metadata: { role: dto.role },
          ip,
        },
      });
      return user;
    });
  }

  async setStatus(actorUserId: string, userId: string, dto: UserStatusDto, ip?: string) {
    if (actorUserId === userId && dto.status === 'SUSPENDED') {
      throw new ConflictException({
        code: 'ADMIN_SELF_SUSPEND',
        message: 'No puedes suspender tu propia cuenta',
      });
    }
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!current)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' });
    if (current.status === 'DELETED') throw new ConflictException('La cuenta fue dada de baja y no puede reactivarse desde este control');
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: userId },
        data: { status: dto.status, authVersion: { increment: 1 } },
        select: safeSelect,
      });
      await tx.auditLog.create({
        data: {
          actorUserId,
          action: dto.status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
          entity: 'User',
          entityId: userId,
          metadata: { from: current.status, to: dto.status },
          ip,
        },
      });
      if (dto.status === 'SUSPENDED') {
        await tx.refreshSession.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
  }

  auditLogs() {
    return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }
}