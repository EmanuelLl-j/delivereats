import { BadRequestException, Body, Controller, Get, Headers, Ip, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser, Public, Roles, authorizeInternal } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { ConfirmShipmentDto, InternalVerifyShipmentDto, ItemPolicyDto, LogisticsDto, ShipmentInputDto, ShipmentReviewDto } from './shipments.dto';
import { ShipmentsService } from './shipments.service';
import { PrismaService } from './prisma.service';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService, private readonly prisma: PrismaService) {}
  @Public() @Get('policies') policies() { return this.prisma.itemPolicy.findMany({ where: { isActive: true }, orderBy: { category: 'asc' } }); }
  @Public() @Get('vehicles') vehicles() { return this.prisma.logisticsConfig.findMany({ where: { isActive: true } }); }
  @Roles(UserRole.CUSTOMER) @Post('quote') quote(@CurrentUser() user: JwtPayload, @Body() dto: ShipmentInputDto) { return this.shipments.quote(user.sub, dto); }
  @Roles(UserRole.CUSTOMER) @Post() confirm(@CurrentUser() user: JwtPayload, @Body() dto: ConfirmShipmentDto, @Ip() ip: string, @Headers('user-agent') agent?: string) { return this.shipments.confirm(user.sub, dto, ip, agent); }
  @Roles(UserRole.CUSTOMER) @Get(':id/codes') codes(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.shipments.codes(id, user.sub); }
}

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminShipmentsController {
  constructor(private readonly shipments: ShipmentsService, private readonly prisma: PrismaService) {}
  @Get('shipments') list() { return this.prisma.order.findMany({ where: { type: 'PERSONAL_SHIPMENT' }, include: { shipment: { omit: { pickupVerificationCode: true, deliveryVerificationCode: true } } }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('shipments/:id/review') review(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ShipmentReviewDto) { return this.shipments.review(user.sub, id, dto); }
  @Get('item-policies') policies() { return this.prisma.itemPolicy.findMany({ include: { revisions: { orderBy: { version: 'desc' } } }, orderBy: { category: 'asc' } }); }
  @Post('item-policies') createPolicy(@CurrentUser() user: JwtPayload, @Body() dto: ItemPolicyDto) {
    return this.prisma.$transaction(async tx => {
      const policy = await tx.itemPolicy.create({ data: dto });
      await tx.itemPolicyRevision.create({ data: { policyId: policy.id, version: 1, description: dto.description, status: dto.status, isActive: dto.isActive, actorUserId: user.sub } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'ITEM_POLICY_CREATED', entity: 'ItemPolicy', entityId: policy.id } });
      return policy;
    });
  }
  @Patch('item-policies/:id') updatePolicy(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ItemPolicyDto) {
    return this.prisma.$transaction(async tx => {
      const policy = await tx.itemPolicy.update({ where: { id }, data: { ...dto, version: { increment: 1 } } });
      await tx.itemPolicyRevision.create({ data: { policyId: id, version: policy.version, description: dto.description, status: dto.status, isActive: dto.isActive, actorUserId: user.sub } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'ITEM_POLICY_UPDATED', entity: 'ItemPolicy', entityId: id, metadata: { version: policy.version, status: dto.status } } });
      return policy;
    });
  }
  @Get('logistics') logistics() { return this.prisma.logisticsConfig.findMany(); }
  @Patch('logistics/:vehicle') updateLogistics(@CurrentUser() user: JwtPayload, @Param('vehicle') vehicleType: string, @Body() dto: LogisticsDto) {
    if (!['BICYCLE', 'MOTORCYCLE', 'CAR'].includes(vehicleType)) throw new BadRequestException('Vehículo inválido');
    return this.prisma.$transaction(async tx => {
      const config = await tx.logisticsConfig.upsert({ where: { vehicleType }, create: { vehicleType, ...dto }, update: { ...dto, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'LOGISTICS_UPDATED', entity: 'LogisticsConfig', entityId: vehicleType, metadata: { ...dto, version: config.version } } });
      return config;
    });
  }
  @Get('audit') audit() { return this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 300 }); }
}

@Public() @Controller('internal/shipments')
export class InternalShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}
  @Post(':id/verify') verify(@Headers('x-internal-service-secret') secret: string, @Param('id') id: string, @Body() dto: InternalVerifyShipmentDto) { authorizeInternal(secret); return this.shipments.verify(id, dto); }
}
