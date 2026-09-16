import { Body, Controller, Delete, ForbiddenException, Get, Headers, Ip, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { authorizeInternal, CurrentUser, Public, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { LegalDocumentType } from './generated/prisma';
import { PrismaService } from './prisma.service';
import { GovernanceService } from './governance.service';
import { AcceptanceDto, AddressUpdateDto, ConsentDto, FileCheckDto, LegalCheckDto, LegalDocumentDto, PrivacyDto, PublishLegalDto, ResolutionDto, RoleChangeDto, TicketDto, UpdateLegalDocumentDto } from './governance.dto';

@ApiTags('Legal y privacidad')
@ApiBearerAuth()
@Controller()
export class GovernanceController {
  constructor(private readonly governance: GovernanceService, private readonly prisma: PrismaService) {}

  @Public() @Get('legal/documents') documents() { return this.governance.currentDocuments(); }
  @Get('legal/acceptances') acceptances(@CurrentUser() user: JwtPayload) { return this.prisma.legalAcceptance.findMany({ where: { userId: user.sub }, select: { legalDocumentId: true, version: true, acceptedAt: true } }); }
  @Post('legal/acceptances') accept(@CurrentUser() user: JwtPayload, @Body() dto: AcceptanceDto, @Ip() ip: string, @Headers('user-agent') deviceInfo?: string) { return this.governance.accept(user.sub, dto, { ip, deviceInfo }); }
  @Get('privacy/export') export(@CurrentUser() user: JwtPayload) { return this.governance.exportOwn(user.sub); }
  @Get('privacy/requests') requests(@CurrentUser() user: JwtPayload) { return this.prisma.privacyRequest.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'desc' } }); }
  @Post('privacy/requests') request(@CurrentUser() user: JwtPayload, @Body() dto: PrivacyDto) { return this.prisma.privacyRequest.create({ data: { userId: user.sub, ...dto } }); }
  @Get('privacy/consent') async consent(@CurrentUser() user: JwtPayload) { return (await this.prisma.consentPreference.findUnique({ where: { userId: user.sub } })) ?? { marketing: false }; }
  @Patch('privacy/consent') async setConsent(@CurrentUser() user: JwtPayload, @Body() dto: ConsentDto) {
    return this.prisma.$transaction(async tx => {
      const result = await tx.consentPreference.upsert({ where: { userId: user.sub }, create: { userId: user.sub, ...dto }, update: dto });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'CONSENT_CHANGED', entity: 'ConsentPreference', entityId: user.sub, metadata: { marketing: dto.marketing } } });
      return result;
    });
  }
  @Get('support/tickets') tickets(@CurrentUser() user: JwtPayload) { return this.prisma.supportTicket.findMany({ where: { userId: user.sub }, orderBy: { createdAt: 'desc' } }); }
  @Post('support/tickets') ticket(@CurrentUser() user: JwtPayload, @Body() dto: TicketDto) { return this.governance.ticket(user.sub, dto); }
  @Patch('users/me/addresses/:id') async address(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: AddressUpdateDto) {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.sub}))`;
      const record = await tx.address.findFirst({ where: { id, customer: { userId: user.sub } } });
      if (!record) throw new NotFoundException('Dirección no encontrada');
      if (dto.isDefault) await tx.address.updateMany({ where: { customerId: record.customerId }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
  }
  @Delete('users/me/addresses/:id') async deleteAddress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const result = await this.prisma.address.deleteMany({ where: { id, customer: { userId: user.sub } } });
    if (!result.count) throw new NotFoundException('Dirección no encontrada');
    return { deleted: true };
  }
}

@ApiTags('Gobernanza administrativa')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminGovernanceController {
  constructor(private readonly governance: GovernanceService, private readonly prisma: PrismaService) {}
  @Get('legal') list() { return this.prisma.legalDocument.findMany({ orderBy: { createdAt: 'desc' } }); }
  @Get('user-metrics') async userMetrics() { const [total, active, roles] = await Promise.all([this.prisma.user.count(), this.prisma.user.count({ where: { status: 'ACTIVE' } }), this.prisma.user.groupBy({ by: ['role'], _count: true })]); return { total, active, roles }; }
  @Post('legal') create(@CurrentUser() user: JwtPayload, @Body() dto: LegalDocumentDto) { return this.governance.create(user.sub, dto); }
  @Patch('legal/:id') update(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateLegalDocumentDto) { return this.governance.update(user.sub, id, dto); }
  @Post('legal/:id/publish') publish(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: PublishLegalDto) { return this.governance.publish(user.sub, id, dto); }
  @Get('privacy') privacy() { return this.prisma.privacyRequest.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('privacy/:id') resolvePrivacy(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ResolutionDto) {
    return this.governance.resolvePrivacy(user.sub, id, dto);
  }
  @Get('support') support(@Query('type') type?: string) { return this.prisma.supportTicket.findMany({ where: type ? { type } : {}, orderBy: { createdAt: 'desc' }, take: 200 }); }
  @Patch('support/:id') resolveTicket(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ResolutionDto) {
    return this.prisma.$transaction(async tx => {
      const result = await tx.supportTicket.update({ where: { id }, data: { status: dto.status, response: dto.response, resolvedBy: user.sub } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'SUPPORT_REVIEWED', entity: 'SupportTicket', entityId: id, metadata: { status: dto.status } } });
      return result;
    });
  }
  @Get('roles') roles() { return [
    { role: 'CUSTOMER', permissions: ['own_profile', 'own_orders', 'own_shipments', 'own_communications'] },
    { role: 'DRIVER', permissions: ['own_application', 'assigned_deliveries', 'assigned_communications'] },
    { role: 'MERCHANT', permissions: ['own_application', 'own_catalog', 'own_suborders', 'own_metrics'] },
    { role: 'ADMIN', permissions: ['approvals', 'policies', 'payments', 'support', 'audit', 'system'] },
  ]; }
  @Patch('users/:id/role') changeRole(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: RoleChangeDto) {
    if (id === user.sub) throw new ForbiddenException('No puedes cambiar tu propio rol');
    return this.prisma.$transaction(async tx => {
      const current = await tx.user.findUniqueOrThrow({ where: { id } });
      const updated = await tx.user.update({ where: { id }, data: { role: dto.role, authVersion: { increment: 1 }, ...(dto.role === 'CUSTOMER' ? { customerProfile: { upsert: { create: {}, update: {} } } } : {}) }, select: { id: true, role: true } });
      await tx.refreshSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'ROLE_CHANGED', entity: 'User', entityId: id, metadata: { from: current.role, to: dto.role, reason: dto.reason } } });
      return updated;
    });
  }
}

@ApiTags('Identidad interna')
@SkipThrottle()
@Public()
@Controller('internal/users')
export class InternalUsersController {
  constructor(private readonly governance: GovernanceService, private readonly prisma: PrismaService) {}
  @Get(':id/auth-state') async state(@Headers('x-internal-service-secret') secret: string, @Param('id') id: string) {
    authorizeInternal(secret);
    const user = await this.prisma.user.findUnique({ where: { id }, select: { status: true, role: true, authVersion: true, emailVerifiedAt: true } });
    if (!user) throw new ForbiddenException('Cuenta no disponible');
    return user;
  }
  @Get(':id/public') async publicPerson(@Headers('x-internal-service-secret') secret: string, @Param('id') id: string) {
    authorizeInternal(secret);
    const user = await this.prisma.user.findUnique({ where: { id }, select: { firstName: true, avatarUrl: true } });
    if (!user) throw new NotFoundException('Participante no encontrado');
    return { displayName: user.firstName, avatar: user.avatarUrl };
  }
  @Get(':id/addresses/:addressId') async address(@Headers('x-internal-service-secret') secret: string, @Param('id') id: string, @Param('addressId') addressId: string) {
    authorizeInternal(secret);
    const address = await this.prisma.address.findFirst({ where: { id: addressId, customer: { userId: id } }, select: { id: true, address: true, reference: true, latitude: true, longitude: true } });
    if (!address) throw new ForbiddenException('La dirección no pertenece al cliente');
    return address;
  }
  @Post('legal-check') legal(@Headers('x-internal-service-secret') secret: string, @Body() dto: LegalCheckDto) {
    authorizeInternal(secret);
    return this.governance.required(dto.userId, dto.types as LegalDocumentType[]);
  }
  @Post('file-check') async file(@Headers('x-internal-service-secret') secret: string, @Body() dto: FileCheckDto) {
    authorizeInternal(secret);
    const asset = await this.prisma.fileAsset.findFirst({ where: { id: dto.fileId, ownerUserId: dto.userId, purpose: { in: dto.purposes } }, select: { id: true, objectKey: true, mimeType: true } });
    if (!asset) throw new ForbiddenException('Archivo inválido para esta operación');
    return asset;
  }
}
