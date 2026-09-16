import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsEmail,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Max,
  MaxLength,
  Min,
  Matches,
  ValidateNested,
} from 'class-validator';
import { MerchantCategory, OrderStatus, PaymentMethod, PromotionType } from './generated/prisma';

export class CreateMerchantDto {
  @IsUUID()
  ownerUserId!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Length(10, 1000)
  description!: string;

  @IsEnum(MerchantCategory)
  category!: MerchantCategory;

  @IsString()
  @Length(11, 11)
  ruc!: string;

  @IsString()
  @Length(7, 20)
  phone!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Length(5, 240)
  address!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(180)
  deliveryEstimateMin!: number;

  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(240)
  deliveryEstimateMax!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverUrl?: string;
}

export class BusinessHourDto {
  @IsInt() @Min(0) @Max(6) day!: number;
  @IsBoolean() closed!: boolean;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) open!: string;
  @IsString() @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) close!: string;
}
export class UpdateMerchantDto {
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @Length(7, 20) phone?: string;
  @IsOptional() @IsArray() @ArrayMinSize(7) @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => BusinessHourDto) businessHours?: BusinessHourDto[];
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @Length(10, 1000) description?: string;
  @IsOptional() @IsEnum(MerchantCategory) category?: MerchantCategory;
  @IsOptional() @IsString() @Length(5, 240) address?: string;
  @IsOptional() @IsLatitude() latitude?: number;
  @IsOptional() @IsLongitude() longitude?: number;
  @IsOptional() @IsInt() @Min(5) @Max(180) deliveryEstimateMin?: number;
  @IsOptional() @IsInt() @Min(5) @Max(240) deliveryEstimateMax?: number;
  @IsOptional() @IsBoolean() isOpen?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) coverUrl?: string;
}

export class CreateCategoryDto {
  @IsString()
  @Length(2, 80)
  name!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateCategoryDto {
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateProductDto {
  @IsUUID()
  categoryId!: string;

  @IsString()
  @Length(2, 140)
  name!: string;

  @IsString()
  @Length(5, 1000)
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(10000)
  price!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;
}

export class UpdateProductDto {
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsString() @Length(2, 140) name?: string;
  @IsOptional() @IsString() @Length(5, 1000) description?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive() price?: number;
  @IsOptional() @IsString() @MaxLength(500) imageUrl?: string;
  @IsOptional() @IsBoolean() isAvailable?: boolean;
}

export class AddCartItemDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;
}

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  notes?: string;
}

export class CheckoutDto {
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) expectedTotal?: number;
  @IsUUID()
  deliveryAddressId!: string;

  @IsString()
  @Length(5, 240)
  deliveryAddress!: string;

  @IsLatitude()
  deliveryLatitude!: number;

  @IsLongitude()
  deliveryLongitude!: number;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 30)
  promoCode?: string;
}

export class TransitionOrderDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export class CreatePromotionDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @Length(3, 30)
  code!: string;

  @IsEnum(PromotionType)
  type!: PromotionType;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  value!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minimumAmount!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  maximumDiscount?: number;

  @IsString()
  startsAt!: string;

  @IsString()
  expiresAt!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  usageLimit?: number;
}

export class UpdatePromotionDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() expiresAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @IsPositive() usageLimit?: number;
}

export class RatingDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class PaymentReviewDto {
  @IsBoolean()
  approved!: boolean;
  @IsString() @Length(10, 1000) reason!: string;
}

export class PaymentEvidenceDto {
  @IsString() @Length(4, 80) operationCode!: string;
  @IsUUID() evidenceFileId!: string;
}
export class MerchantApplicationDto extends OmitType(CreateMerchantDto, ['ownerUserId'] as const) {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsUUID('4', { each: true }) documentIds!: string[];
}
export class ApplicationReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'SUSPENDED']) status!: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  @IsString() @Length(10, 1000) reason!: string;
}
export class SubOrderTransitionDto {
  @IsIn(['PREPARING', 'READY_FOR_PICKUP', 'CANCELLED']) status!: 'PREPARING' | 'READY_FOR_PICKUP' | 'CANCELLED';
  @IsOptional() @IsString() @Length(10, 1000) reason?: string;
}
