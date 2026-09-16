import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventPublisher, requireLegal, requireOwnedFile } from '@delivereats/backend-kit';
import { generateOrderNumber, haversineKm } from '@delivereats/shared-utils';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { type ItemPolicy, type LogisticsConfig, Prisma } from './generated/prisma';
import { PrismaService } from './prisma.service';
import { PaymentService } from './payments/payment.service';
import { ConfirmShipmentDto, InternalVerifyShipmentDto, ShipmentInputDto, ShipmentReviewDto } from './shipments.dto';
import { decryptCode, encryptCode } from './shipment-security';

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const fingerprint = (policy: ItemPolicy, config: LogisticsConfig) => createHash('sha256').update(`${policy.id}:${policy.version}:${config.vehicleType}:${config.version}`).digest('hex');

export function calculateShipment(input: ShipmentInputDto, config: LogisticsConfig) {
  const dims = [input.lengthCm, input.widthCm, input.heightCm].sort((a, b) => a - b);
  const limits = [Number(config.maxLengthCm), Number(config.maxWidthCm), Number(config.maxHeightCm)].sort((a, b) => a - b);
  if (input.weightKg > Number(config.maxWeightKg) || dims.some((value, index) => value > (limits[index] ?? 0))) throw new BadRequestException('El paquete supera la capacidad del vehículo');
  const distanceKm = haversineKm({ latitude: input.pickupLatitude, longitude: input.pickupLongitude }, { latitude: input.dropoffLatitude, longitude: input.dropoffLongitude });
  if (distanceKm > Number(config.maxDistanceKm)) throw new BadRequestException('El trayecto supera la cobertura configurada');
  const volumeLiters = input.lengthCm * input.widthCm * input.heightCm / 1000;
  const base = Number(config.baseFee);
  const distance = money(distanceKm * Number(config.perKmFee));
  const weight = money(input.weightKg * Number(config.perKgFee));
  const volume = money(volumeLiters * Number(config.perLiterFee));
  const fragile = input.fragile ? Number(config.fragileFee) : 0;
  const deliveryFee = money(base + distance + weight + volume + fragile);
  const serviceFee = Number(config.serviceFee);
  return { distanceKm: money(distanceKm), distanceMetric: 'STRAIGHT_LINE', volumeLiters: money(volumeLiters), base, distance, weight, volume, fragile, deliveryFee, serviceFee, total: money(deliveryFee + serviceFee), currency: 'PEN' };
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentService, private readonly events: EventPublisher) {}

  async quote(customerId: string, input: ShipmentInputDto) {
    const policy = await this.prisma.itemPolicy.findUnique({ where: { category: input.packageCategory } });
    const config = await this.prisma.logisticsConfig.findUnique({ where: { vehicleType: input.vehicleType } });
    if (!policy?.isActive || !config?.isActive) throw new BadRequestException('Categoría o vehículo no disponible');
    if (policy.status === 'PROHIBITED') {
      await this.prisma.auditLog.create({ data: { actorUserId: customerId, action: 'PROHIBITED_SHIPMENT_BLOCKED', entity: 'ItemPolicy', entityId: policy.id, metadata: { policyVersion: policy.version } } });
      throw new ForbiddenException({ code: 'ITEM_PROHIBITED', message: 'Esta categoría no puede transportarse' });
    }
    if (input.packageFileId) await requireOwnedFile(customerId, input.packageFileId, ['PACKAGE']);
    const breakdown = calculateShipment(input, config);
    if (breakdown.total <= 0) throw new BadRequestException('Las tarifas deben producir un total mayor que cero');
    const quote = await this.prisma.shipmentQuote.create({ data: { customerId, input: JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue, breakdown, fingerprint: fingerprint(policy, config), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    return { id: quote.id, expiresAt: quote.expiresAt, breakdown, restrictionStatus: policy.status, policy: { id: policy.id, version: policy.version, description: policy.description }, vehicleType: config.vehicleType, cashAllowed: config.cashAllowed };
  }

  async confirm(customerId: string, dto: ConfirmShipmentDto, ip?: string, deviceInfo?: string) {
    if (![dto.truthfulDescription, dto.noProhibitedItems, dto.acceptsShippingPolicy, dto.acceptsItemsPolicy].every(value => value === true)) throw new BadRequestException('Debes aceptar las cuatro declaraciones');
    const legal = await requireLegal(customerId, ['GENERAL_TERMS', 'PRIVACY_POLICY', 'SHIPPING_TERMS', 'PROHIBITED_ITEMS_POLICY']);
    await this.payments.assertConfigured(dto.paymentMethod);
    const pickupVerificationCode = encryptCode(String(randomInt(100000, 1000000)));
    const deliveryVerificationCode = encryptCode(String(randomInt(100000, 1000000)));
    const created = await this.prisma.$transaction(async tx => {
      const quote = await tx.shipmentQuote.findFirst({ where: { id: dto.quoteId, customerId, consumedAt: null, expiresAt: { gt: new Date() } } });
      if (!quote) throw new ConflictException('La cotización venció o ya fue utilizada');
      const input = quote.input as unknown as ShipmentInputDto;
      const policy = await tx.itemPolicy.findUnique({ where: { category: input.packageCategory } });
      const config = await tx.logisticsConfig.findUnique({ where: { vehicleType: input.vehicleType } });
      if (!policy?.isActive || policy.status === 'PROHIBITED' || !config?.isActive || fingerprint(policy, config) !== quote.fingerprint) throw new ConflictException('La política o tarifa cambió; solicita una nueva cotización');
      if (dto.paymentMethod === 'CASH' && !config.cashAllowed) throw new BadRequestException('Este vehículo no admite pago en efectivo');
      const totals = calculateShipment(input, config);
      const claimed = await tx.shipmentQuote.updateMany({ where: { id: quote.id, consumedAt: null }, data: { consumedAt: new Date() } });
      if (!claimed.count) throw new ConflictException('La cotización ya se utilizó');
      const sequence = await tx.orderSequence.upsert({ where: { year: new Date().getUTCFullYear() }, create: { year: new Date().getUTCFullYear(), value: 1 }, update: { value: { increment: 1 } } });
      const status = policy.status === 'RESTRICTED' ? 'REQUIRES_REVIEW' : dto.paymentMethod === 'CASH' ? 'CONFIRMED' : 'PENDING';
      const { packageFileId, ...details } = input;
      const order = await tx.order.create({ data: {
        orderNumber: generateOrderNumber(sequence.value), customerId, type: 'PERSONAL_SHIPMENT', deliveryAddress: input.dropoffAddress, deliveryLatitude: input.dropoffLatitude, deliveryLongitude: input.dropoffLongitude,
        status, subtotal: 0, deliveryFee: totals.deliveryFee, serviceFee: totals.serviceFee, discount: 0, total: totals.total, paymentMethod: dto.paymentMethod,
        shipment: { create: { ...details, quoteId: quote.id, packageImageUrl: packageFileId, pickupVerificationCode, deliveryVerificationCode, restrictionStatus: policy.status, reviewStatus: policy.status === 'RESTRICTED' ? 'REQUIRES_REVIEW' : 'NOT_REQUIRED', declarationEvidence: { truthfulDescription: true, noProhibitedItems: true, acceptsShippingPolicy: true, acceptsItemsPolicy: true, legalDocumentIds: legal.documentIds, acceptedAt: new Date().toISOString(), ip: ip?.slice(0, 64) ?? null, deviceInfo: deviceInfo?.slice(0, 500) ?? null, policyId: policy.id, policyVersion: policy.version, logisticsVersion: config.version, quoteBreakdown: totals } } },
        statusHistory: { create: { toStatus: status, actorUserId: customerId } },
      } });
      await tx.auditLog.create({ data: { actorUserId: customerId, action: 'SHIPMENT_CREATED', entity: 'Order', entityId: order.id, metadata: { status } } });
      await this.events.enqueue(tx, 'order.created', { orderId: order.id, customerId, type: order.type, status: order.status });
      return order;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { order: created, paymentRequired: created.status === 'PENDING', reviewRequired: created.status === 'REQUIRES_REVIEW' };
  }

  async codes(orderId: string, customerId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, customerId, type: 'PERSONAL_SHIPMENT' }, include: { shipment: true } });
    if (!order?.shipment) throw new NotFoundException('Envío no encontrado');
    if (order.status === 'ASSIGNED' && !order.shipment.pickedUpAt) return { phase: 'PICKUP', code: decryptCode(order.shipment.pickupVerificationCode) };
    if (order.status === 'ON_THE_WAY' && order.shipment.pickedUpAt && !order.shipment.deliveredAt) return { phase: 'DELIVERY', code: decryptCode(order.shipment.deliveryVerificationCode) };
    return { phase: null, code: null };
  }

  async review(adminId: string, orderId: string, dto: ShipmentReviewDto) {
    return this.prisma.$transaction(async tx => {
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipment: true } });
      if (order.status !== 'REQUIRES_REVIEW' || !order.shipment) throw new ConflictException('El envío ya no espera revisión');
      if (order.customerId === adminId) throw new ForbiddenException('No puedes revisar tu propio envío');
      const policy = await tx.itemPolicy.findUnique({ where: { category: order.shipment.packageCategory } });
      if (dto.status === 'APPROVED' && (!policy?.isActive || policy.status === 'PROHIBITED')) throw new ForbiddenException('La política vigente impide aprobar este envío');
      const status = dto.status === 'REJECTED' ? 'CANCELLED' : dto.status === 'INVESTIGATION' ? 'REQUIRES_REVIEW' : order.paymentMethod === 'CASH' ? 'CONFIRMED' : 'PENDING';
      const claimed = await tx.order.updateMany({ where: { id: orderId, version: order.version, status: 'REQUIRES_REVIEW' }, data: { status, version: { increment: 1 }, ...(status === 'CANCELLED' ? { cancelledAt: new Date() } : {}) } });
      if (!claimed.count) throw new ConflictException('El envío cambió durante la revisión');
      await tx.personalShipmentDetails.update({ where: { orderId }, data: { reviewStatus: dto.status, reviewReason: dto.reason, reviewedBy: adminId, reviewedAt: new Date() } });
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: 'REQUIRES_REVIEW', toStatus: status, actorUserId: adminId } });
      await tx.auditLog.create({ data: { actorUserId: adminId, action: 'SHIPMENT_REVIEWED', entity: 'Order', entityId: orderId, metadata: { status: dto.status, reason: dto.reason } } });
      await this.events.enqueue(tx, `order.${status.toLowerCase()}`, { orderId, customerId: order.customerId, status });
      return { orderId, status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async verify(orderId: string, dto: InternalVerifyShipmentDto) {
    if (dto.evidenceFileId) await requireOwnedFile(dto.driverUserId, dto.evidenceFileId, [dto.phase === 'PICKUP' ? 'PICKUP_EVIDENCE' : 'DELIVERY_EVIDENCE']);
    const result = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { shipment: true } });
      const shipment = order.shipment;
      if (!shipment || order.assignedDriverId !== dto.driverId) throw new ForbiddenException('No tienes asignado este envío');
      const pickup = dto.phase === 'PICKUP';
      if (order.status !== (pickup ? 'ASSIGNED' : 'ON_THE_WAY') || (pickup ? shipment.pickedUpAt : !shipment.pickedUpAt || shipment.deliveredAt)) throw new ConflictException('Esta verificación no corresponde al estado actual');
      if (shipment.verificationLockedUntil && shipment.verificationLockedUntil > new Date()) return { error: 'Demasiados intentos. Espera 15 minutos antes de volver a verificar.' };
      const actual = decryptCode(pickup ? shipment.pickupVerificationCode : shipment.deliveryVerificationCode);
      const valid = /^\d{6}$/.test(dto.code) && timingSafeEqual(Buffer.from(actual), Buffer.from(dto.code));
      if (!valid) {
        const attempts = shipment.verificationAttempts + 1;
        await tx.personalShipmentDetails.update({ where: { orderId }, data: { verificationAttempts: attempts >= 5 ? 0 : attempts, verificationLockedUntil: attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
        await tx.auditLog.create({ data: { actorUserId: dto.driverUserId, action: 'SHIPMENT_CODE_REJECTED', entity: 'Order', entityId: orderId } });
        return { error: 'Código incorrecto' };
      }
      const status = pickup ? 'ON_THE_WAY' : 'DELIVERED';
      await tx.personalShipmentDetails.update({ where: { orderId }, data: { verificationAttempts: 0, verificationLockedUntil: null, ...(pickup ? { pickedUpAt: new Date(), pickupEvidenceFileId: dto.evidenceFileId } : { deliveredAt: new Date(), deliveryEvidenceFileId: dto.evidenceFileId }) } });
      await tx.order.update({ where: { id: orderId }, data: { status, version: { increment: 1 }, ...(!pickup ? { completedAt: new Date(), ...(order.paymentMethod === 'CASH' ? { paymentStatus: 'PAID' } : {}) } : {}) } });
      if (!pickup && order.paymentMethod === 'CASH') {
        const cash = await tx.paymentIntent.findFirst({ where: { orderId, provider: 'CASH' } });
        if (cash) await tx.paymentIntent.update({ where: { id: cash.id }, data: { status: 'PAID', verifiedAt: new Date() } });
        else await tx.paymentIntent.create({ data: { orderId, amount: order.total, provider: 'CASH', method: 'CASH', status: 'PAID', verifiedAt: new Date() } });
      }
      await tx.orderStatusHistory.create({ data: { orderId, fromStatus: order.status, toStatus: status, actorUserId: dto.driverUserId } });
      await tx.auditLog.create({ data: { actorUserId: dto.driverUserId, action: `SHIPMENT_${dto.phase}_VERIFIED`, entity: 'Order', entityId: orderId } });
      await this.events.enqueue(tx, `order.${status.toLowerCase()}`, { orderId, customerId: order.customerId, status });
      return { orderId, customerId: order.customerId, status };
    });
    // Incorrect attempts commit before the error; throwing inside the transaction would erase the counter.
    if ('error' in result) throw new BadRequestException(result.error);
    return result;
  }
}
