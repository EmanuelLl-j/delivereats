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
import {
  AdminDriversController,
  DriversController,
  InternalAssignmentsController,
  TrackingController,
} from './drivers.controller';
import { DriversService } from './drivers.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';
import { TrackingGateway } from './tracking.gateway';
import { TrackingStore } from './tracking.service';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 180 }]),
  ],
  controllers: [
    DriversController,
    TrackingController,
    AdminDriversController,
    InternalAssignmentsController,
    HealthController,
  ],
  providers: [
    PrismaService,
    DriversService,
    TrackingStore,
    TrackingGateway,
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
