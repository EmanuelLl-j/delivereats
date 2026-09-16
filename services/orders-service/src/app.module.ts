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
import { AdminController } from './admin.controller';
import { CartService } from './cart.service';
import { CommerceService } from './commerce.service';
import {
  CartController,
  CommerceController,
  InternalOrdersController,
  MerchantPortalController,
  OrdersController,
  PaymentsController,
  PromotionsController,
} from './controllers';
import { HealthController } from './health.controller';
import { MapsService } from './maps/maps.service';
import { OrdersGateway } from './orders.gateway';
import { OrdersService } from './orders.service';
import { PaymentService } from './payments/payment.service';
import { PrismaService } from './prisma.service';
import { InternalPrivacyController } from './privacy.controller';
import { PromotionsService } from './promotions.service';
import { ShipmentsService } from './shipments.service';
import { OperationsController } from './operations.controller';
import { ShipmentsController, AdminShipmentsController, InternalShipmentsController } from './shipments.controller';

@Module({
  imports: [
    JwtModule.register({ global: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [
    InternalPrivacyController,
    CommerceController,
    MerchantPortalController,
    CartController,
    OrdersController,
    PaymentsController,
    PromotionsController,
    InternalOrdersController,
    AdminController,
    HealthController,
    ShipmentsController,
    OperationsController,
    AdminShipmentsController,
    InternalShipmentsController,
  ],
  providers: [
    PrismaService,
    { provide: 'EVENT_OUTBOX', useExisting: PrismaService },
    CommerceService,
    CartService,
    OrdersService,
    PaymentService,
    PromotionsService,
    ShipmentsService,
    MapsService,
    OrdersGateway,
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
