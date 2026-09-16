import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';
import { LegalDocumentType } from './generated/prisma';

export class LegalDocumentDto {
  @ApiProperty({ enum: LegalDocumentType }) @IsEnum(LegalDocumentType) type!: LegalDocumentType;
  @ApiProperty() @IsString() @Length(4, 150) title!: string;
  @ApiProperty() @IsString() @Length(1, 40) version!: string;
  @ApiProperty() @IsString() @Length(50, 100000) content!: string;
  @ApiProperty() @IsBoolean() mandatory!: boolean;
}
export class UpdateLegalDocumentDto extends PartialType(LegalDocumentDto) {}
export class PublishLegalDto {
  @ApiProperty() @IsDateString() effectiveAt!: string;
}
export class AcceptanceDto {
  @ApiProperty({ type: [String] }) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @IsUUID('4', { each: true }) documentIds!: string[];
}
export class LegalCheckDto {
  @IsUUID() userId!: string;
  @IsArray() @ArrayMinSize(1) @IsEnum(LegalDocumentType, { each: true }) types!: LegalDocumentType[];
}
export class FileCheckDto {
  @IsUUID() userId!: string;
  @IsUUID() fileId!: string;
  @IsArray() @IsString({ each: true }) purposes!: string[];
}
export class PrivacyDto {
  @ApiProperty({ enum: ['ACCESS', 'CORRECTION', 'DELETION', 'OBJECTION'] }) @IsIn(['ACCESS', 'CORRECTION', 'DELETION', 'OBJECTION']) type!: string;
  @ApiProperty() @IsString() @Length(10, 2000) description!: string;
}
export class ConsentDto {
  @ApiProperty() @IsBoolean() marketing!: boolean;
}
export class TicketDto {
  @ApiPropertyOptional() @IsOptional() @IsUUID() orderId?: string;
  @ApiProperty({ enum: ['SUPPORT', 'INCIDENT'] }) @IsIn(['SUPPORT', 'INCIDENT']) type!: string;
  @ApiProperty() @IsString() @Length(5, 150) subject!: string;
  @ApiProperty() @IsString() @Length(10, 3000) description!: string;
}
export class ResolutionDto {
  @ApiProperty({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'] }) @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']) status!: string;
  @ApiProperty() @IsString() @Length(5, 3000) response!: string;
}
export class RoleChangeDto {
  @ApiProperty({ enum: ['CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN'] }) @IsIn(['CUSTOMER', 'DRIVER', 'MERCHANT', 'ADMIN']) role!: 'CUSTOMER' | 'DRIVER' | 'MERCHANT' | 'ADMIN';
  @ApiProperty() @IsString() @Length(10, 500) reason!: string;
}
export class AddressUpdateDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(2, 40) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}
