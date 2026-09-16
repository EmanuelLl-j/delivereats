import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { requireLegal, requireOwnedFile } from '@delivereats/backend-kit';
import { merchantPublicSelect } from './public-views';
import { OrderStatus } from './generated/prisma';
import { PrismaService } from './prisma.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateMerchantDto,
  CreateProductDto,
  UpdateMerchantDto,
  UpdateProductDto,
  MerchantApplicationDto,
  ApplicationReviewDto,
} from './dto';

@Injectable()
export class CommerceService {
  constructor(private readonly prisma: PrismaService) {}

  listMerchants(category?: string, search?: string) {
    return this.prisma.merchant.findMany({
      where: {
        isActive: true,
        applicationStatus: 'APPROVED',
        ...(category ? { category: category as never } : {}),
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: 'insensitive' as const } },
                { description: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ isOpen: 'desc' }, { rating: 'desc' }],
      select: merchantPublicSelect,
    });
  }

  async merchant(id: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { id, isActive: true, applicationStatus: 'APPROVED' },
      select: {
        ...merchantPublicSelect,
        categories: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          include: { products: { where: { isAvailable: true }, orderBy: { name: 'asc' } } },
        },
      },
    });
    if (!merchant)
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Comercio no encontrado',
      });
    return merchant;
  }

  createMerchant(dto: CreateMerchantDto) {
    return this.prisma.merchant.create({ data: { ...dto, isActive: false } });
  }

  async apply(userId: string, dto: MerchantApplicationDto) {
    await requireLegal(userId, ['GENERAL_TERMS', 'PRIVACY_POLICY', 'MERCHANT_TERMS']);
    for (const id of dto.documentIds) await requireOwnedFile(userId, id, ['MERCHANT_DOCUMENT']);
    await this.images(userId, dto);
    const { documentIds, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const existing = await tx.merchant.findFirst({ where: { ownerUserId: userId } });
      if (existing && existing.applicationStatus !== 'REJECTED') throw new ConflictException('Ya existe una solicitud o comercio asociado');
      const merchant = existing ? await tx.merchant.update({ where: { id: existing.id }, data: { ...data, applicationDocuments: documentIds, applicationStatus: 'PENDING', isActive: false, reviewReason: null } }) : await tx.merchant.create({ data: { ...data, ownerUserId: userId, applicationDocuments: documentIds, applicationStatus: 'PENDING', isActive: false } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'MERCHANT_APPLICATION_SUBMITTED', entity: 'Merchant', entityId: merchant.id } });
      return merchant;
    });
  }

  async review(adminId: string, merchantId: string, dto: ApplicationReviewDto) {
    return this.prisma.$transaction(async tx => {
      const merchant = await tx.merchant.findUniqueOrThrow({ where: { id: merchantId } });
      if (merchant.ownerUserId === adminId) throw new ForbiddenException('No puedes aprobar tu propio comercio');
      if (dto.status === 'APPROVED' && !merchant.applicationDocuments) throw new BadRequestException('Faltan los documentos de la solicitud');
      const result = await tx.merchant.update({ where: { id: merchantId }, data: { applicationStatus: dto.status, isActive: dto.status === 'APPROVED', reviewReason: dto.reason, reviewedBy: adminId, reviewedAt: new Date() } });
      await tx.auditLog.create({ data: { actorUserId: adminId, action: 'MERCHANT_REVIEWED', entity: 'Merchant', entityId: merchantId, metadata: { status: dto.status, reason: dto.reason } } });
      return result;
    });
  }

  async updateMerchant(
    userId: string,
    isAdmin: boolean,
    merchantId: string,
    dto: UpdateMerchantDto,
  ) {
    await this.requireOwner(userId, isAdmin, merchantId);
    if (dto.isActive !== undefined) throw new ForbiddenException('La activación requiere una revisión administrativa');
    await this.images(userId, dto);
    if (dto.deliveryEstimateMin != null || dto.deliveryEstimateMax != null) {
      const current = await this.prisma.merchant.findUniqueOrThrow({ where: { id: merchantId } });
      if ((dto.deliveryEstimateMin ?? current.deliveryEstimateMin) > (dto.deliveryEstimateMax ?? current.deliveryEstimateMax)) throw new BadRequestException('El plazo mínimo no puede superar al máximo');
    }
    if (dto.businessHours && (new Set(dto.businessHours.map(day => day.day)).size !== 7 || dto.businessHours.some(day => !day.closed && day.open >= day.close))) throw new BadRequestException('Configura los siete días sin duplicados y cierre posterior a apertura');
    if ((dto.address !== undefined || dto.latitude !== undefined || dto.longitude !== undefined) && await this.prisma.subOrder.count({ where: { merchantId, status: { notIn: ['DELIVERED', 'CANCELLED'] } } })) throw new ConflictException('Finaliza los pedidos activos antes de cambiar el punto de recogida');
    const { businessHours, ...data } = dto;
    return this.prisma.merchant.update({ where: { id: merchantId }, data: { ...data, ...(businessHours ? { businessHours: JSON.parse(JSON.stringify(businessHours)) } : {}) } });
  }

  async addCategory(userId: string, isAdmin: boolean, merchantId: string, dto: CreateCategoryDto) {
    await this.requireOwner(userId, isAdmin, merchantId);
    return this.prisma.category.create({
      data: { merchantId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async updateCategory(userId: string, isAdmin: boolean, id: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findUniqueOrThrow({ where: { id } });
    await this.requireOwner(userId, isAdmin, category.merchantId);
    return this.prisma.$transaction(async tx => {
      const result = await tx.category.update({ where: { id }, data: dto });
      if (dto.isActive === false) await tx.product.updateMany({ where: { categoryId: id }, data: { isAvailable: false } });
      await tx.auditLog.create({ data: { actorUserId: userId, action: 'CATEGORY_UPDATED', entity: 'Category', entityId: id } });
      return result;
    });
  }

  async addProduct(userId: string, isAdmin: boolean, merchantId: string, dto: CreateProductDto) {
    await this.requireOwner(userId, isAdmin, merchantId);
    await this.images(userId, dto);
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, merchantId, isActive: true },
    });
    if (!category)
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Categoría no encontrada para este comercio',
      });
    return this.prisma.product.create({ data: { merchantId, ...dto } });
  }

  async updateProduct(userId: string, isAdmin: boolean, productId: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product)
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Producto no encontrado' });
    await this.requireOwner(userId, isAdmin, product.merchantId);
    await this.images(userId, dto);
    if (dto.categoryId || dto.isAvailable === true) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId ?? product.categoryId, merchantId: product.merchantId, isActive: true },
      });
      if (!category)
        throw new NotFoundException({
          code: 'CATEGORY_NOT_FOUND',
          message: 'Categoría no encontrada para este comercio',
        });
    }
    return this.prisma.product.update({ where: { id: productId }, data: dto });
  }

  async myMerchant(userId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: { ownerUserId: userId },
      include: { categories: { include: { products: true }, orderBy: { sortOrder: 'asc' } } },
    });
    if (!merchant)
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'No existe un comercio asociado a tu cuenta',
      });
    return merchant;
  }

  async dashboard(userId: string) {
    const merchants = await this.prisma.merchant.findMany({ where: { ownerUserId: userId } });
    const merchant = merchants[0];
    if (!merchant)
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'No existe un comercio asociado a tu cuenta',
      });
    const start = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) + 'T00:00:00-05:00');
    const subOrders = await this.prisma.subOrder.findMany({
      where: { merchantId: { in: merchants.map((item) => item.id) }, createdAt: { gte: start } },
      include: { order: true, items: true, merchant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    const completed = subOrders.filter((item) => item.status === OrderStatus.DELIVERED);
    const revenue = completed.reduce((sum, item) => sum + Number(item.subtotal), 0);
    const preparation = subOrders.filter(item => item.preparingAt && item.readyAt).map(item => (item.readyAt!.getTime() - item.preparingAt!.getTime()) / 60_000);
    return {
      merchant,
      merchants,
      kpis: {
        ordersToday: subOrders.length,
        activeOrders: subOrders.filter(
          (item) => item.status !== OrderStatus.DELIVERED && item.status !== OrderStatus.CANCELLED,
        ).length,
        revenue,
        averageTicket: completed.length ? revenue / completed.length : 0,
        averagePreparationMinutes: preparation.length ? Math.round(preparation.reduce((a, b) => a + b, 0) / preparation.length) : null,
        completedOrders: completed.length,
      },
      orders: subOrders.map(sub => ({ ...sub, order: { id: sub.order.id, orderNumber: sub.order.orderNumber, status: sub.order.status, paymentMethod: sub.order.paymentMethod, paymentStatus: sub.order.paymentStatus, createdAt: sub.order.createdAt } })),
    };
  }

  adminMetrics() {
    return this.prisma.$transaction(async (tx) => {
      const start = new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' }) + 'T00:00:00-05:00');
      const [merchants, ordersToday, activeOrders, approvedPayments, rejectedPayments, revenue] =
        await Promise.all([
          tx.merchant.count({ where: { isActive: true, applicationStatus: 'APPROVED' } }),
          tx.order.count({ where: { createdAt: { gte: start } } }),
          tx.order.count({
            where: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
          }),
          tx.paymentIntent.count({ where: { status: { in: ['APPROVED', 'PAID'] } } }),
          tx.paymentIntent.count({ where: { status: 'REJECTED' } }),
          tx.order.aggregate({
            where: { paymentStatus: { in: ['APPROVED', 'PAID'] } },
            _sum: { total: true },
          }),
        ]);
      return {
        merchants,
        ordersToday,
        activeOrders,
        approvedPayments,
        rejectedPayments,
        revenue: Number(revenue._sum.total ?? 0),
      };
    });
  }

  adminMerchants() {
    return this.prisma.merchant.findMany({
      include: { _count: { select: { products: true, subOrders: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async requireOwner(userId: string, isAdmin: boolean, merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { ownerUserId: true, applicationStatus: true },
    });
    if (!merchant)
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Comercio no encontrado',
      });
    if (!isAdmin && merchant.ownerUserId !== userId)
      throw new ForbiddenException('No administras este comercio');
    if (!isAdmin && merchant.applicationStatus === 'SUSPENDED') throw new ForbiddenException('Comercio suspendido');
    return merchant;
  }

  private async images(userId: string, dto: { imageUrl?: string; logoUrl?: string; coverUrl?: string }) {
    for (const [field, purpose] of [['imageUrl', 'PRODUCT'], ['logoUrl', 'MERCHANT_LOGO'], ['coverUrl', 'MERCHANT_COVER']] as const) {
      const url = dto[field];
      if (!url) continue;
      const match = /^\/api\/users\/files\/public\/([a-f0-9-]{36})$/i.exec(url);
      if (!match?.[1]) throw new BadRequestException('Carga la imagen mediante el almacenamiento de DeliverEats');
      await requireOwnedFile(userId, match[1], [purpose]);
    }
  }
}
