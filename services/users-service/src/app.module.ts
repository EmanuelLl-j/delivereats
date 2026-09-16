import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  applyCorrelationMiddleware,
  CorrelationIdMiddleware,
  EventPublisher,
  JwtAuthGuard,
  RolesGuard,
} from '@delivereats/backend-kit';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { UsersController } from './users/users.controller';
import { UsersService } from './users/users.service';
import { GovernanceService } from './governance.service';
import { FilesController, S3StorageProvider } from './storage';
import { GovernanceController, AdminGovernanceController, InternalUsersController } from './governance.controller';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 80 }]),
  ],
  controllers: [AuthController, UsersController, HealthController, GovernanceController, AdminGovernanceController, InternalUsersController, FilesController],
  providers: [
    PrismaService,
    { provide: 'EVENT_OUTBOX', useExisting: PrismaService },
    AuthService,
    UsersService,
    GovernanceService,
    S3StorageProvider,
    EventPublisher,
    CorrelationIdMiddleware,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    applyCorrelationMiddleware(consumer);
  }
}
