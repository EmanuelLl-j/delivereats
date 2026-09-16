import { ApiProperty, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsIn,
  IsISO8601,
  Length,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { DriverStatus, VehicleType } from './generated/prisma';
import { OrderStatus } from '@delivereats/shared-types';

export class SetAvailabilityDto {
  @ApiProperty({ enum: [DriverStatus.AVAILABLE, DriverStatus.OFFLINE] })
  @IsEnum(DriverStatus)
  status!: 'AVAILABLE' | 'OFFLINE';
}

export class CoordinatesDto {
  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;
}

export class PickupPointDto extends CoordinatesDto {
  @IsUUID()
  merchantId!: string;

  @IsString()
  name!: string;
}

export class DestinationDto extends CoordinatesDto {
  @IsString()
  address!: string;
}

export class OfferAssignmentDto {
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(3) @IsEnum(VehicleType, { each: true }) vehicleTypes?: VehicleType[];
  @IsUUID()
  orderId!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PickupPointDto)
  pickupPoints!: PickupPointDto[];

  @ValidateNested()
  @Type(() => DestinationDto)
  destination!: DestinationDto;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  estimatedEarnings!: number;
}

export class LocationDto extends CoordinatesDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(240)
  speed?: number;

  @IsOptional()
  @IsUUID()
  orderId?: string;

  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}

export class AdminDriverStatusDto {
  @IsEnum(DriverStatus)
  status!: DriverStatus;
  @IsString() @Length(10, 1000) reason!: string;
}

export class CreateDriverProfileDto {
  @IsUUID()
  userId!: string;

  @IsString()
  documentNumber!: string;

  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @IsOptional()
  @IsString()
  vehiclePlate?: string;

  @IsOptional()
  @IsString()
  licenseNumber?: string;
}

export class DriverOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus.ON_THE_WAY | OrderStatus.DELIVERED;
}

export class DriverApplicationDto extends OmitType(CreateDriverProfileDto, ['userId'] as const) {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(6) @IsUUID('4', { each: true }) documentIds!: string[];
}
export class DriverReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'SUSPENDED']) status!: 'APPROVED' | 'REJECTED' | 'SUSPENDED';
  @IsString() @Length(10, 1000) reason!: string;
}
export class ShipmentCodeDto {
  @IsIn(['PICKUP', 'DELIVERY']) phase!: 'PICKUP' | 'DELIVERY';
  @IsString() @Length(6, 6) code!: string;
  @IsOptional() @IsUUID() evidenceFileId?: string;
}
export class LocationBatchDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(120) @ValidateNested({ each: true }) @Type(() => LocationDto) locations!: LocationDto[];
}
