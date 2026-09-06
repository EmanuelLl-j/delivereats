import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { CreateNotificationDto, RegisterDeviceDto } from './dto';
import { NotificationsService } from './notifications.service';

@ApiBearerAuth()
@ApiTags('Notificaciones')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.notifications.list(user.sub);
  }

  @Get('unread-count')
  unread(@CurrentUser() user: JwtPayload) {
    return this.notifications.unreadCount(user.sub);
  }

  @Patch(':id/read')
  read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.notifications.markRead(user.sub, id);
  }

  @Patch('read-all')
  readAll(@CurrentUser() user: JwtPayload) {
    return this.notifications.markAllRead(user.sub);
  }

  @Post('devices')
  device(@CurrentUser() user: JwtPayload, @Body() dto: RegisterDeviceDto) {
    return this.notifications.registerDevice(user.sub, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get('admin/all')
  all() {
    return this.notifications.listAll();
  }

  @Roles(UserRole.ADMIN)
  @Post('admin/send')
  create(@Body() dto: CreateNotificationDto) {
    return this.notifications.create(dto);
  }
}
