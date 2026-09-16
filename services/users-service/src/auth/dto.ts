import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsBoolean,
  IsEnum,
  IsIn,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPhoneNumber,
  IsString,
  IsStrongPassword,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@delivereats/shared-types';

export class RegisterDto {
  @ApiProperty({ example: 'Renzo' })
  @IsString()
  @Length(2, 80)
  firstName!: string;

  @ApiProperty({ example: 'Quispe' })
  @IsString()
  @Length(2, 80)
  lastName!: string;

  @ApiProperty({ example: 'persona@example.com' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ example: '+51987654321' })
  @IsOptional()
  @IsPhoneNumber('PE')
  phone?: string;

  @ApiProperty({ minLength: 12, maxLength: 72 })
  @MaxLength(72)
  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  password!: string;

  @ApiPropertyOptional({ enum: ['CUSTOMER', 'DRIVER', 'MERCHANT'] })
  @IsOptional()
  @IsIn(['CUSTOMER', 'DRIVER', 'MERCHANT'])
  role?: UserRole;
}

export class LoginDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @Length(8, 128)
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}

export class ForgotPasswordDto {
  @ApiProperty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase().trim() : value,
  )
  @IsEmail()
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @MaxLength(72)
  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  newPassword!: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty()
  @MaxLength(72)
  @IsStrongPassword({
    minLength: 12,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1,
  })
  newPassword!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(2, 80)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsPhoneNumber('PE')
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}

export class CreateAddressDto {
  @ApiProperty({ example: 'Casa' })
  @IsString()
  @Length(2, 40)
  label!: string;

  @ApiProperty({ example: 'Jr. 28 de Julio 325' })
  @IsString()
  @Length(5, 200)
  address!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reference?: string;

  @ApiPropertyOptional({ default: 'Ayacucho' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty()
  @IsLatitude()
  latitude!: number;

  @ApiProperty()
  @IsLongitude()
  longitude!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UserStatusDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED'] })
  @IsIn(['ACTIVE', 'SUSPENDED'])
  status!: 'ACTIVE' | 'SUSPENDED';
}

export class AdminCreateUserDto extends OmitType(RegisterDto, ['role'] as const) {
  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role!: UserRole;
}

export class VerificationDto {
  @ApiProperty()
  @IsString()
  @Length(64, 64)
  token!: string;
}

export class UserIdDto {
  @IsUUID()
  id!: string;
}
