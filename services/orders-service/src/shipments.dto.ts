import { IsBoolean, IsIn, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString, IsUUID, Length, Max, Min, Equals } from 'class-validator';
import { Type } from 'class-transformer';

export class ShipmentInputDto {
  @IsString() @Length(5, 240) pickupAddress!: string;
  @IsOptional() @IsString() @Length(0, 240) pickupReference?: string;
  @Type(() => Number) @IsLatitude() pickupLatitude!: number;
  @Type(() => Number) @IsLongitude() pickupLongitude!: number;
  @IsString() @Length(5, 240) dropoffAddress!: string;
  @IsOptional() @IsString() @Length(0, 240) dropoffReference?: string;
  @Type(() => Number) @IsLatitude() dropoffLatitude!: number;
  @Type(() => Number) @IsLongitude() dropoffLongitude!: number;
  @IsString() @Length(2, 100) recipientName!: string;
  @IsString() @Length(2, 80) packageCategory!: string;
  @IsString() @Length(15, 1500) contentDescription!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000) weightKg!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) lengthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) widthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) heightCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000) declaredValue!: number;
  @IsBoolean() fragile!: boolean;
  @IsOptional() @IsUUID() packageFileId?: string;
  @IsIn(['BICYCLE', 'MOTORCYCLE', 'CAR']) vehicleType!: string;
}

export class ConfirmShipmentDto {
  @IsUUID() quoteId!: string;
  @IsIn(['CASH', 'MERCADO_PAGO', 'YAPE_MANUAL', 'PLIN_MANUAL']) paymentMethod!: 'CASH' | 'MERCADO_PAGO' | 'YAPE_MANUAL' | 'PLIN_MANUAL';
  @Equals(true) truthfulDescription!: boolean;
  @Equals(true) noProhibitedItems!: boolean;
  @Equals(true) acceptsShippingPolicy!: boolean;
  @Equals(true) acceptsItemsPolicy!: boolean;
}

export class ShipmentReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'INVESTIGATION']) status!: 'APPROVED' | 'REJECTED' | 'INVESTIGATION';
  @IsString() @Length(10, 1000) reason!: string;
}

export class VerifyShipmentDto {
  @IsIn(['PICKUP', 'DELIVERY']) phase!: 'PICKUP' | 'DELIVERY';
  @IsString() @Length(6, 6) code!: string;
  @IsOptional() @IsUUID() evidenceFileId?: string;
}
export class InternalVerifyShipmentDto extends VerifyShipmentDto {
  @IsUUID() driverId!: string;
  @IsUUID() driverUserId!: string;
}

export class ItemPolicyDto {
  @IsString() @Length(2, 80) category!: string;
  @IsString() @Length(10, 2000) description!: string;
  @IsIn(['ALLOWED', 'RESTRICTED', 'PROHIBITED']) status!: 'ALLOWED' | 'RESTRICTED' | 'PROHIBITED';
  @IsBoolean() isActive!: boolean;
}

export class LogisticsDto {
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000) maxWeightKg!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) maxLengthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) maxWidthCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) @Max(500) maxHeightCm!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000) baseFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) perKmFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) perKgFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(100) perLiterFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000) serviceFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1000) fragileFee!: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.1) @Max(200) maxDistanceKm!: number;
  @IsBoolean() cashAllowed!: boolean;
  @IsBoolean() isActive!: boolean;
}
