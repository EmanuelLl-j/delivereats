import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreatePromotionDto, UpdatePromotionDto } from './dto';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: CreatePromotionDto) {
    return this.prisma.promotion.create({
      data: {
        code: dto.code,
        type: dto.type,
        value: dto.value,
        minimumAmount: dto.minimumAmount,
        maximumDiscount: dto.maximumDiscount,
        startsAt: new Date(dto.startsAt),
        expiresAt: new Date(dto.expiresAt),
        usageLimit: dto.usageLimit,
      },
    });
  }

  update(id: string, dto: UpdatePromotionDto) {
    return this.prisma.promotion.update({
      where: { id },
      data: { ...dto, ...(dto.expiresAt ? { expiresAt: new Date(dto.expiresAt) } : {}) },
    });
  }
}
