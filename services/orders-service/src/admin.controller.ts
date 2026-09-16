import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { ApplicationReviewDto } from './dto';
import { CommerceService } from './commerce.service';

@ApiBearerAuth()
@ApiTags('Administración')
@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('metrics')
  metrics() {
    return this.commerce.adminMetrics();
  }

  @Get('merchants')
  merchants() {
    return this.commerce.adminMerchants();
  }

  @Patch('merchants/:id/review') review(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: ApplicationReviewDto) { return this.commerce.review(user.sub, id, dto); }
}
