import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  applyCorrelationMiddleware,
  CorrelationIdMiddleware,
  JwtAuthGuard,
  RolesGuard,
} from '@delivereats/backend-kit';
import { EventsConsumer } from './events.consumer';
import { HealthController } from './health.controller';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConfigurablePushProvider, SmtpEmailProvider } from './providers';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [NotificationsController, HealthController],
  providers: [
    PrismaService,
    NotificationsService,
    SmtpEmailProvider,
    ConfigurablePushProvider,
    EventsConsumer,
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
