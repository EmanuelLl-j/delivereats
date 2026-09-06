import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { NotificationChannel, NotificationType } from './generated/prisma';

export class RegisterDeviceDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  @IsEnum(['ios', 'android', 'web'])
  platform!: string;
}

export class CreateNotificationDto {
  @IsUUID()
  userId!: string;

  @IsEnum(NotificationType)
  type!: NotificationType;

  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(1000)
  message!: string;

  @IsOptional()
  data?: Record<string, unknown>;
}
