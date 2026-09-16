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
  MiddlewareConsumer,
  NestMiddleware,
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
import { randomUUID } from 'node:crypto';
import { type JwtPayload, UserRole } from '@delivereats/shared-types';
import { internalRequest } from './internal';
import { productionEnvironmentIssues } from './environment';
export { productionEnvironmentIssues } from './environment';
export * from './internal';

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
        algorithms: ['HS256'],
      });
    } catch {
      throw new HttpException('Token inválido o vencido', HttpStatus.UNAUTHORIZED);
    }
    const state = await internalRequest<{ status: string; role: string; authVersion: number }>(
      'users', `/internal/users/${encodeURIComponent(request.user.sub)}/auth-state`,
    );
    if (state.status !== 'ACTIVE' || state.role !== request.user.role || state.authVersion !== request.user.authVersion) {
      throw new HttpException('La sesión fue revocada. Inicia sesión nuevamente.', HttpStatus.UNAUTHORIZED);
    }
    return true;
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
  environmentService: 'users-service' | 'orders-service' | 'drivers-service' | 'notifications-service';
  port: number;
  description: string;
};

export async function bootstrapService(options: BootstrapOptions): Promise<INestApplication> {
  const issues = productionEnvironmentIssues(process.env, options.environmentService);
  if (issues.length) throw new Error('Configuración de producción inválida:\n' + issues.join('\n'));
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
  if (process.env.NODE_ENV !== 'production') SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(options.port, '0.0.0.0');
  return app;
}

export { EventPublisher } from './events';

export function domainError(
  code: string,
  message: string,
  status = HttpStatus.BAD_REQUEST,
): BadRequestException {
  return new BadRequestException({ code, message, statusCode: status });
}
