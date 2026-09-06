import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '@delivereats/backend-kit';
import { UserRole } from '@delivereats/shared-types';
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
}
