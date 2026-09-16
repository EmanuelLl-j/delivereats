import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LegalDocumentType, Prisma } from './generated/prisma';
import { PrismaService } from './prisma.service';
import { AcceptanceDto, LegalDocumentDto, PublishLegalDto, ResolutionDto, TicketDto, UpdateLegalDocumentDto } from './governance.dto';
import { internalRequest } from '@delivereats/backend-kit';

@Injectable()
export class GovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async currentDocuments() {
    const documents = await this.prisma.legalDocument.findMany({ where: { status: 'PUBLISHED', effectiveAt: { lte: new Date() } }, orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }] });
    return documents.filter((doc, i, list) => list.findIndex(item => item.type === doc.type) === i);
  }

  async required(userId: string, types: LegalDocumentType[]) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { status: true, emailVerifiedAt: true } });
    if (!user || user.status !== 'ACTIVE') throw new ForbiddenException('Cuenta no disponible');
    if (!user.emailVerifiedAt) throw new ForbiddenException({ code: 'EMAIL_NOT_VERIFIED', message: 'Verifica tu correo antes de continuar' });
    const current = await this.currentDocuments();
    for (const type of types) {
      if (!current.some(doc => doc.type === type)) throw new ConflictException({ code: 'LEGAL_NOT_PUBLISHED', message: 'La plataforma todavía debe publicar los términos de esta operación' });
    }
    const documents = current.filter(doc => types.includes(doc.type) && doc.mandatory);
    const accepted = await this.prisma.legalAcceptance.findMany({ where: { userId, legalDocumentId: { in: documents.map(doc => doc.id) } } });
    if (documents.some(doc => !accepted.some(item => item.legalDocumentId === doc.id))) {
      throw new ForbiddenException({ code: 'LEGAL_ACCEPTANCE_REQUIRED', message: 'Debes aceptar la versión vigente de los términos antes de continuar' });
    }
    return { accepted: true as const, documentIds: documents.map(doc => doc.id) };
  }

  async accept(userId: string, dto: AcceptanceDto, meta: { ip?: string; deviceInfo?: string }) {
    return this.prisma.$transaction(async tx => {
      const docs = await tx.legalDocument.findMany({ where: { id: { in: [...new Set(dto.documentIds)] }, status: 'PUBLISHED', effectiveAt: { lte: new Date() } } });
      if (docs.length !== new Set(dto.documentIds).size) throw new BadRequestException('Solo puedes aceptar documentos publicados y vigentes');
      for (const document of docs) {
        await tx.legalAcceptance.upsert({ where: { userId_legalDocumentId: { userId, legalDocumentId: document.id } }, update: {}, create: { userId, legalDocumentId: document.id, version: document.version, ipAddress: meta.ip?.slice(0, 64), deviceInfo: meta.deviceInfo?.slice(0, 500) } });
      }
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'LEGAL_ACCEPTED', entity: 'LegalDocument', metadata: { documentIds: docs.map(doc => doc.id) } } });
      return { accepted: true };
    });
  }

  create(actor: string, dto: LegalDocumentDto) {
    return this.prisma.$transaction(async tx => {
      const document = await tx.legalDocument.create({ data: dto });
      await tx.auditLog.create({ data: { actorUserId: actor, action: 'LEGAL_DRAFT_CREATED', entity: 'LegalDocument', entityId: document.id } });
      return document;
    });
  }

  update(actor: string, id: string, dto: UpdateLegalDocumentDto) {
    return this.prisma.$transaction(async tx => {
      const result = await tx.legalDocument.updateMany({ where: { id, status: 'DRAFT' }, data: dto });
      if (!result.count) throw new ConflictException('La versión publicada es inmutable. Crea una nueva versión.');
      await tx.auditLog.create({ data: { actorUserId: actor, action: 'LEGAL_DRAFT_UPDATED', entity: 'LegalDocument', entityId: id } });
      return tx.legalDocument.findUniqueOrThrow({ where: { id } });
    });
  }

  publish(actor: string, id: string, dto: PublishLegalDto) {
    return this.prisma.$transaction(async tx => {
      const document = await tx.legalDocument.findUnique({ where: { id } });
      if (!document) throw new NotFoundException('Documento no encontrado');
      if (document.content.includes('[REVISIÓN JURÍDICA PENDIENTE]')) throw new BadRequestException('Reemplaza el borrador con el texto revisado antes de publicarlo');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${document.type}))`;
      const result = await tx.legalDocument.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'PUBLISHED', publishedAt: new Date(), effectiveAt: new Date(dto.effectiveAt) } });
      if (!result.count) throw new ConflictException('Solo se puede publicar un borrador');
      await tx.auditLog.create({ data: { actorUserId: actor, action: 'LEGAL_PUBLISHED', entity: 'LegalDocument', entityId: id, metadata: { version: document.version, effectiveAt: dto.effectiveAt } } });
      return tx.legalDocument.findUniqueOrThrow({ where: { id } });
    });
  }

  async exportOwn(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, firstName: true, lastName: true, email: true, phone: true, role: true, avatarUrl: true, createdAt: true, emailVerifiedAt: true, customerProfile: { include: { addresses: true } } } });
    const [acceptances, consent, requests, tickets, orders, deliveries, notifications, files] = await Promise.all([
      this.prisma.legalAcceptance.findMany({ where: { userId }, select: { legalDocumentId: true, version: true, acceptedAt: true } }),
      this.prisma.consentPreference.findUnique({ where: { userId } }),
      this.prisma.privacyRequest.findMany({ where: { userId } }),
      this.prisma.supportTicket.findMany({ where: { userId } }),
      internalRequest('orders', `/internal/privacy/${userId}`),
      internalRequest('drivers', `/internal/privacy/${userId}`),
      internalRequest('notifications', `/internal/privacy/${userId}`),
      this.prisma.fileAsset.findMany({ where: { ownerUserId: userId }, select: { id: true, purpose: true, mimeType: true, size: true, createdAt: true } }),
    ]);
    await this.prisma.auditLog.create({ data: { actorUserId: userId, action: 'PRIVACY_EXPORTED', entity: 'User', entityId: userId } });
    return { exportedAt: new Date().toISOString(), user, acceptances, consent, requests, tickets, orders, deliveries, notifications, files };
  }

  async ticket(userId: string, dto: TicketDto) {
    if (dto.orderId) {
      const order = await internalRequest<{ allowed: boolean }>('orders', `/internal/orders/${dto.orderId}/participation/${userId}`);
      const delivery = order.allowed ? null : await internalRequest<{ allowed: boolean }>('drivers', `/internal/assignments/participation/${dto.orderId}/${userId}`);
      if (!order.allowed && !delivery?.allowed) throw new ForbiddenException('No puedes vincular una incidencia con un pedido ajeno');
    }
    return this.prisma.supportTicket.create({ data: { userId, ...dto } });
  }

  async resolvePrivacy(actor: string, id: string, dto: ResolutionDto) {
    const request = await this.prisma.privacyRequest.findUniqueOrThrow({ where: { id } });
    if (['RESOLVED', 'REJECTED'].includes(request.status)) throw new ConflictException('La solicitud ya fue resuelta');
    const closing = request.type === 'DELETION' && dto.status === 'RESOLVED';
    if (closing) {
      const target = await this.prisma.user.findUniqueOrThrow({ where: { id: request.userId } });
      if (target.role === 'ADMIN' || target.id === actor) throw new ForbiddenException('Transfiere primero las responsabilidades administrativas; no se permite la baja propia desde esta revisión');
      // Idempotent, sequential steps. If a dependency fails the request remains
      // unresolved; an operator can retry without claiming the account was erased.
      await internalRequest('orders', `/internal/privacy/${target.id}/deactivate`, {});
      await internalRequest('drivers', `/internal/privacy/${target.id}/deactivate`, {});
      await internalRequest('notifications', `/internal/privacy/${target.id}/deactivate`, {});
    }
    return this.prisma.$transaction(async tx => {
      const claimed = await tx.privacyRequest.updateMany({ where: { id, status: request.status }, data: { status: dto.status, resolution: dto.response, resolvedBy: actor } });
      if (!claimed.count) throw new ConflictException('Otro operador actualizó esta solicitud');
      if (closing) {
        await tx.user.update({ where: { id: request.userId }, data: { status: 'DELETED', authVersion: { increment: 1 } } });
        await tx.refreshSession.updateMany({ where: { userId: request.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        await tx.consentPreference.upsert({ where: { userId: request.userId }, create: { userId: request.userId, marketing: false }, update: { marketing: false } });
      }
      await tx.auditLog.create({ data: { actorUserId: actor, action: closing ? 'ACCOUNT_DEACTIVATED' : 'PRIVACY_REQUEST_REVIEWED', entity: 'PrivacyRequest', entityId: id, metadata: { status: dto.status, retainedHistory: closing } } });
      return tx.privacyRequest.findUniqueOrThrow({ where: { id } });
    });
  }

  audit(actor: string, action: string, entity: string, entityId: string, metadata?: Prisma.InputJsonValue) {
    return this.prisma.auditLog.create({ data: { actorUserId: actor, action, entity, entityId, metadata } });
  }
}
