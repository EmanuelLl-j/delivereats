import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Public, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import {
  AdminDriverStatusDto,
  CreateDriverProfileDto,
  DriverOrderStatusDto,
  LocationDto,
  OfferAssignmentDto,
  SetAvailabilityDto,
} from './dto';
import { DriversService } from './drivers.service';

@ApiBearerAuth()
@ApiTags('Repartidor')
@Roles(UserRole.DRIVER)
@Controller('drivers')
export class DriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get('me')
  profile(@CurrentUser() user: JwtPayload) {
    return this.drivers.profile(user.sub);
  }

  @Patch('me/availability')
  availability(@CurrentUser() user: JwtPayload, @Body() dto: SetAvailabilityDto) {
    return this.drivers.availability(user.sub, dto);
  }

  @Get('me/offers/active')
  activeOffer(@CurrentUser() user: JwtPayload) {
    return this.drivers.activeOffer(user.sub);
  }

  @Post('me/offers/:id/accept')
  accept(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.drivers.accept(user.sub, id, correlationId);
  }

  @Post('me/offers/:id/reject')
  reject(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.drivers.reject(user.sub, id, correlationId);
  }

  @Post('me/assignments/:id/pickups/:subOrderId')
  pickup(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('subOrderId') subOrderId: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.drivers.pickup(user.sub, id, subOrderId, correlationId);
  }

  @Get('me/assignments/:id/order')
  assignmentOrder(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.drivers.assignmentOrder(user.sub, id);
  }

  @Post('me/assignments/:id/status')
  orderStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: DriverOrderStatusDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.drivers.updateOrderStatus(user.sub, id, dto.status, correlationId);
  }

  @Post('me/location')
  location(@CurrentUser() user: JwtPayload, @Body() dto: LocationDto) {
    return this.drivers.location(user.sub, dto);
  }
}

@ApiBearerAuth()
@ApiTags('Tracking')
@Roles(UserRole.CUSTOMER, UserRole.MERCHANT, UserRole.ADMIN)
@Controller('tracking')
export class TrackingController {
  constructor(private readonly drivers: DriversService) {}

  @Get('orders/:orderId/location')
  orderLocation(@Param('orderId') orderId: string) {
    return this.drivers.orderLocation(orderId);
  }
}

@ApiBearerAuth()
@ApiTags('Administración de repartidores')
@Roles(UserRole.ADMIN)
@Controller('admin/drivers')
export class AdminDriversController {
  constructor(private readonly drivers: DriversService) {}

  @Get()
  list() {
    return this.drivers.list();
  }

  @Post()
  create(@Body() dto: CreateDriverProfileDto) {
    return this.drivers.create(dto);
  }

  @Patch(':id/status')
  status(@Param('id') id: string, @Body() dto: AdminDriverStatusDto) {
    return this.drivers.setAdminStatus(id, dto);
  }
}

@ApiTags('Comunicación interna')
@Controller('internal/assignments')
export class InternalAssignmentsController {
  constructor(private readonly drivers: DriversService) {}

  @Public()
  @Post('offer')
  offer(
    @Headers('x-internal-service-secret') secret: string | undefined,
    @Headers('x-correlation-id') correlationId: string | undefined,
    @Body() dto: OfferAssignmentDto,
  ) {
    if (!process.env.INTERNAL_SERVICE_SECRET || secret !== process.env.INTERNAL_SERVICE_SECRET) {
      throw new UnauthorizedException('Credencial interna inválida');
    }
    return this.drivers.offer(dto, correlationId);
  }
}
