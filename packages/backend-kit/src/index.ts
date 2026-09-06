import {
  ArgumentsHost,
  BadRequestException,
  CanActivate,
  Catch,
  createParamDecorator,
  ExecutionContext,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  MiddlewareConsumer,
  NestMiddleware,
  OnModuleDestroy,
  OnModuleInit,
  SetMetadata,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NestFactory } from '@nestjs/core';
import { Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { INestApplication, Type } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { EventEnvelope, type JwtPayload, UserRole } from '@delivereats/shared-types';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  return context.switchToHttp().getRequest<Request & { user: JwtPayload }>().user;
});

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!token) throw new HttpException('Token de acceso requerido', HttpStatus.UNAUTHORIZED);
    try {
      request.user = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      return true;
    } catch {
      throw new HttpException('Token inválido o vencido', HttpStatus.UNAUTHORIZED);
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;
    const request = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    if (!request.user || !roles.includes(request.user.role)) {
      throw new HttpException('No tienes permisos para esta operación', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const raw = request.headers['x-correlation-id'];
    const correlationId = typeof raw === 'string' && raw.length <= 128 ? raw : randomUUID();
    request.headers['x-correlation-id'] = correlationId;
    response.setHeader('x-correlation-id', correlationId);
    next();
  }
}

export function applyCorrelationMiddleware(consumer: MiddlewareConsumer): void {
  consumer.apply(CorrelationIdMiddleware).forRoutes('*');
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const correlationId = String(request.headers['x-correlation-id'] ?? randomUUID());
    const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;
    const raw = exception instanceof HttpException ? exception.getResponse() : undefined;
    const object = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
    const rawMessage = object.message ?? raw;
    const message = Array.isArray(rawMessage)
      ? rawMessage.join(', ')
      : typeof rawMessage === 'string'
        ? rawMessage
        : statusCode === 500
          ? 'Error interno del servicio'
          : 'Solicitud inválida';
    const code = typeof object.code === 'string' ? object.code : `HTTP_${statusCode}`;
    response.status(statusCode).json({ statusCode, code, message, correlationId });
  }
}

export type BootstrapOptions = {
  module: Type<unknown>;
  serviceName: string;
  port: number;
  description: string;
};

export async function bootstrapService(options: BootstrapOptions): Promise<INestApplication> {
  const app = await NestFactory.create(options.module, { bufferLogs: true });
  app.use(helmet());
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:8081').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  const swaggerConfig = new DocumentBuilder()
    .setTitle(`DeliverEats · ${options.serviceName}`)
    .setDescription(options.description)
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(options.port, '0.0.0.0');
  return app;
}

@Injectable()
export class EventPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private connection?: ChannelModel;
  private channel?: ConfirmChannel;
  private readonly exchange = 'delivereats.events';

  async onModuleInit(): Promise<void> {
    if (process.env.RABBITMQ_ENABLED === 'false') return;
    try {
      this.connection = await amqp.connect(
        process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672',
      );
      this.channel = await this.connection.createConfirmChannel();
      await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    } catch (error) {
      this.logger.warn(
        `RabbitMQ no disponible al iniciar; las operaciones REST continúan: ${String(error)}`,
      );
    }
  }

  async publish<T extends Record<string, unknown>>(
    name: string,
    payload: T,
    correlationId: string = randomUUID(),
  ): Promise<boolean> {
    if (!this.channel) return false;
    const envelope: EventEnvelope<T> = {
      id: randomUUID(),
      name,
      version: 1,
      occurredAt: new Date().toISOString(),
      correlationId,
      payload,
    };
    this.channel.publish(this.exchange, name, Buffer.from(JSON.stringify(envelope)), {
      persistent: true,
      contentType: 'application/json',
      messageId: envelope.id,
      correlationId,
      timestamp: Date.now(),
    });
    await this.channel.waitForConfirms();
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }
}

export function domainError(
  code: string,
  message: string,
  status = HttpStatus.BAD_REQUEST,
): BadRequestException {
  return new BadRequestException({ code, message, statusCode: status });
}
