import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
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
  @IsString()
  timestamp?: string;
}

export class AdminDriverStatusDto {
  @IsEnum(DriverStatus)
  status!: DriverStatus;
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
