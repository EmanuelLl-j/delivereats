import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from 'class-validator';
export class PaymentConfigurationDto {
  @IsBoolean() enabled!: boolean;
  @IsOptional() @IsString() @Length(2, 150) accountLabel?: string;
  @IsOptional() @IsString() @Length(10, 2000) instructions?: string;
  @IsOptional() @IsUUID() qrFileId?: string;
}
export class RefundRequestDto { @IsString() @Length(10, 1000) reason!: string; }
export class RefundReviewDto {
  @IsIn(['APPROVED', 'REJECTED', 'COMPLETED']) status!: 'APPROVED' | 'REJECTED' | 'COMPLETED';
  @IsString() @Length(10, 1000) reason!: string;
  @IsOptional() @IsString() @Length(4, 150) providerReference?: string;
  @IsOptional() @IsUUID() evidenceFileId?: string;
}
