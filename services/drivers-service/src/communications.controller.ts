import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { CommunicationsService } from './communications.service';
import { CallActionDto, MessageDto } from './communications.dto';

@Roles(UserRole.CUSTOMER, UserRole.DRIVER)
@Controller('communications')
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}
  @Get('unread') unread(@CurrentUser() user: JwtPayload) { return this.communications.unread(user.sub); }
  @Get('orders/:id') conversation(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.communications.conversation(user, id); }
  @Post('orders/:id/messages') send(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: MessageDto) { return this.communications.send(user, id, dto); }
  @Post('orders/:id/read') read(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.communications.read(user, id); }
  @Post('orders/:id/calls') call(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.communications.startCall(user, id); }
  @Post('calls/:id/action') action(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: CallActionDto) { return this.communications.callAction(user, id, dto.action); }
  @Post('calls/:id/token') token(@CurrentUser() user: JwtPayload, @Param('id') id: string) { return this.communications.token(user, id); }
}
