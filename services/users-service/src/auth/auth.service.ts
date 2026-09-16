import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserRole as PrismaUserRole, UserStatus } from '../generated/prisma';
import { compare, hash } from 'bcrypt';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { EventPublisher } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { PrismaService } from '../prisma.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
} from './dto';

type RequestMeta = { ip?: string; userAgent?: string; correlationId?: string };

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  avatarUrl: true,
  createdAt: true,
  updatedAt: true,
  emailVerifiedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly events: EventPublisher,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) throw new BadRequestException('La contraseña no debe superar 72 bytes UTF-8');
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
      select: { id: true },
    });
    if (existing)
      throw new ConflictException({
        code: 'USER_ALREADY_EXISTS',
        message: 'El correo o teléfono ya está registrado',
      });

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        passwordHash: await hash(dto.password, 12),
        role: dto.role ?? PrismaUserRole.CUSTOMER,
        ...(!dto.role || dto.role === 'CUSTOMER' ? { customerProfile: { create: {} } } : {}),
      },
      select: publicUserSelect,
    });
    await this.events.publish(
      'user.created',
      { userId: user.id, role: user.role, email: user.email },
      meta.correlationId,
    );
    await this.sendVerification(user.id, user.email);
    return this.createSession(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos',
      });
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_TEMPORARILY_LOCKED',
        message: 'Cuenta bloqueada temporalmente por intentos fallidos',
      });
    }
    if (!(await compare(dto.password, user.passwordHash))) {
      const failed = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedAttempts: { increment: 1 },
        },
      });
      if (failed.failedAttempts >= 5) await this.prisma.user.update({ where: { id: user.id }, data: { lockedUntil: new Date(Date.now() + 15 * 60_000) } });
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Correo o contraseña incorrectos',
      });
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
    return this.createSession(user, meta);
  }

  async refresh(refreshToken: string, meta: RequestMeta) {
    let payload: JwtPayload & { sid: string };
    try {
      payload = await this.jwt.verifyAsync<JwtPayload & { sid: string }>(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH',
        message: 'Refresh token inválido o vencido',
      });
    }
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid },
      include: { user: true },
    });
    if (
      !session ||
      session.user.status !== UserStatus.ACTIVE ||
      session.user.authVersion !== payload.authVersion ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !(await compare(createHash('sha256').update(refreshToken).digest('hex'), session.tokenHash))
    ) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_REFRESH',
        message: 'Refresh token inválido o revocado',
      });
    }
    const claimed = await this.prisma.refreshSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!claimed.count) throw new UnauthorizedException('La sesión ya fue renovada');
    return this.createSession(session.user, meta);
  }

  async logout(userId: string, refreshToken?: string): Promise<{ success: true }> {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<JwtPayload & { sid: string }>(refreshToken, {
          secret: process.env.JWT_REFRESH_SECRET,
          ignoreExpiration: true,
        });
        await this.prisma.refreshSession.updateMany({
          where: { id: payload.sid, userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } catch {
        // Logout is intentionally idempotent.
      }
    } else {
      await this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { authVersion: { increment: 1 } } });
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto, meta: RequestMeta) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, email: true },
    });
    if (!user)
      return { message: 'Si el correo existe, recibirás instrucciones para recuperar tu cuenta' };
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction(async tx => {
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await tx.passwordReset.create({
      data: {
        userId: user.id,
        tokenHash: createHash('sha256').update(token).digest('hex'),
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    await this.events.enqueue(tx,
      'notification.requested',
      {
        userId: user.id,
        channel: 'EMAIL',
        type: 'SECURITY',
        title: 'Recupera tu cuenta DeliverEats',
        message: `Abre ${process.env.WEB_URL ?? 'http://localhost:3000'}/auth/reset#token=${token} para recuperar tu cuenta. Si tu aplicación solicita un código, ingresa: ${token}. Vence en 30 minutos. Si no lo solicitaste, ignora este correo.`,
        email: user.email,
      },
      meta.correlationId,
    );
    });
    return {
      message: 'Si el correo existe, recibirás instrucciones para recuperar tu cuenta',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ success: true }> {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('La contraseña no debe superar 72 bytes UTF-8');
    const reset = await this.prisma.passwordReset.findUnique({
      where: { tokenHash: createHash('sha256').update(dto.token).digest('hex') },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_RESET',
        message: 'Token de recuperación inválido o vencido',
      });
    }
    const passwordHash = await hash(dto.newPassword, 12);
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordReset.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) throw new UnauthorizedException('El token ya fue utilizado o venció');
      await tx.user.update({
        where: { id: reset.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 },
          failedAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.passwordReset.updateMany({ where: { userId: reset.userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.refreshSession.updateMany({
        where: { userId: reset.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { success: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ success: true }> {
    if (Buffer.byteLength(dto.newPassword, 'utf8') > 72) throw new BadRequestException('La contraseña no debe superar 72 bytes UTF-8');
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_PASSWORD',
        message: 'La contraseña actual no es correcta',
      });
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: await hash(dto.newPassword, 12), authVersion: { increment: 1 } },
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { success: true };
  }

  async profile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...publicUserSelect,
        customerProfile: {
          include: { addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] } },
        },
      },
    });
    if (!user)
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado' });
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.avatarUrl) {
      const match = /^\/api\/users\/files\/public\/([a-f0-9-]{36})$/i.exec(dto.avatarUrl);
      if (!match?.[1] || !await this.prisma.fileAsset.findFirst({ where: { id: match[1], ownerUserId: userId, purpose: 'AVATAR' } })) throw new BadRequestException('Carga tu foto mediante el almacenamiento de DeliverEats');
    }
    return this.prisma.user.update({ where: { id: userId }, data: dto, select: publicUserSelect });
  }

  private async createSession(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      phone: string | null;
      role: PrismaUserRole;
      status: UserStatus;
      avatarUrl: string | null;
      createdAt: Date;
      updatedAt: Date;
      authVersion?: number;
    },
    meta: RequestMeta,
  ) {
    const state = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { authVersion: true, status: true } });
    if (state.status !== UserStatus.ACTIVE) throw new ForbiddenException('Cuenta no disponible');
    const payload: JwtPayload = { sub: user.id, role: user.role as UserRole, authVersion: state.authVersion };
    const accessToken = await this.jwt.signAsync(payload, {
      secret: process.env.JWT_SECRET,
      expiresIn: '15m',
    });
    const sid = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { ...payload, sid },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );
    await this.prisma.refreshSession.create({
      data: {
        id: sid,
        userId: user.id,
        tokenHash: await hash(createHash('sha256').update(refreshToken).digest('hex'), 12),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60_000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    const { id, email, firstName, lastName, phone, role, status, avatarUrl, createdAt, updatedAt } =
      user;
    return {
      accessToken,
      refreshToken,
      user: {
        id,
        email,
        firstName,
        lastName,
        phone,
        role,
        status,
        avatarUrl,
        createdAt,
        updatedAt,
      },
    };
  }

  async sendVerification(userId: string, email?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
    if (user.emailVerifiedAt) return { sent: true };
    const token = randomBytes(32).toString('hex');
    await this.prisma.$transaction(async tx => {
      await tx.emailVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
      await tx.emailVerification.create({ data: { userId, tokenHash: createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 30 * 60_000) } });
      await this.events.enqueue(tx, 'notification.requested', { userId, channel: 'EMAIL', type: 'SECURITY', title: 'Verifica tu correo', message: `Abre ${process.env.WEB_URL ?? 'http://localhost:3000'}/auth/verify#token=${token} o introduce este código en la app: ${token}. Código de un solo uso válido durante 30 minutos.`, email: email ?? user.email });
    });
    return { sent: true };
  }

  async verifyEmail(token: string) {
    const record = await this.prisma.emailVerification.findUnique({ where: { tokenHash: createHash('sha256').update(token).digest('hex') } });
    if (!record) throw new UnauthorizedException('Código inválido o vencido');
    await this.prisma.$transaction(async tx => {
      const claimed = await tx.emailVerification.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
      if (!claimed.count) throw new UnauthorizedException('Código inválido o vencido');
      await tx.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } });
    });
    return { verified: true };
  }
}
