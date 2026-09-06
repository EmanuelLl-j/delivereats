import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus } from './generated/prisma';
import { PrismaService } from './prisma.service';
import {
  CreateCategoryDto,
  CreateMerchantDto,
  CreateProductDto,
  UpdateMerchantDto,
  UpdateProductDto,
} from './dto';

@Injectable()
export class CommerceService {
  constructor(private readonly prisma: PrismaService) {}

  listMerchants(category?: string, search?: string) {
    return this.prisma.merchant.findMany({
      where: {
        isActive: true,
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
    });
  }

  async merchant(id: string) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id },
      include: {
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

  async updateMerchant(
    userId: string,
    isAdmin: boolean,
    merchantId: string,
    dto: UpdateMerchantDto,
  ) {
    await this.requireOwner(userId, isAdmin, merchantId);
    return this.prisma.merchant.update({ where: { id: merchantId }, data: dto });
  }

  async addCategory(userId: string, isAdmin: boolean, merchantId: string, dto: CreateCategoryDto) {
    await this.requireOwner(userId, isAdmin, merchantId);
    return this.prisma.category.create({
      data: { merchantId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async addProduct(userId: string, isAdmin: boolean, merchantId: string, dto: CreateProductDto) {
    await this.requireOwner(userId, isAdmin, merchantId);
    const category = await this.prisma.category.findFirst({
      where: { id: dto.categoryId, merchantId },
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
    if (dto.categoryId) {
      const category = await this.prisma.category.findFirst({
        where: { id: dto.categoryId, merchantId: product.merchantId },
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
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const subOrders = await this.prisma.subOrder.findMany({
      where: { merchantId: { in: merchants.map((item) => item.id) }, createdAt: { gte: start } },
      include: { order: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
    const completed = subOrders.filter((item) => item.status === OrderStatus.DELIVERED);
    const revenue = completed.reduce((sum, item) => sum + Number(item.subtotal), 0);
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
        averagePreparationMinutes: 24,
        completedOrders: completed.length,
      },
      orders: subOrders,
    };
  }

  adminMetrics() {
    return this.prisma.$transaction(async (tx) => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const [merchants, ordersToday, activeOrders, approvedPayments, rejectedPayments, revenue] =
        await Promise.all([
          tx.merchant.count({ where: { isActive: true } }),
          tx.order.count({ where: { createdAt: { gte: start } } }),
          tx.order.count({
            where: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
          }),
          tx.paymentIntent.count({ where: { status: 'APPROVED' } }),
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
      select: { ownerUserId: true },
    });
    if (!merchant)
      throw new NotFoundException({
        code: 'MERCHANT_NOT_FOUND',
        message: 'Comercio no encontrado',
      });
    if (!isAdmin && merchant.ownerUserId !== userId)
      throw new ForbiddenException('No administras este comercio');
    return merchant;
  }
}
