import { Body, Controller, Get, Ip, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles } from '@delivereats/backend-kit';
import { UserRole, type JwtPayload } from '@delivereats/shared-types';
import { UserRole as PrismaUserRole, UserStatus } from '../generated/prisma';
import { AdminCreateUserDto, CreateAddressDto, UserStatusDto } from '../auth/dto';
import { UsersService } from './users.service';

@ApiBearerAuth()
@ApiTags('Usuarios')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles(UserRole.CUSTOMER)
  @Get('me/addresses')
  addresses(@CurrentUser() user: JwtPayload) {
    return this.users.listAddresses(user.sub);
  }

  @Roles(UserRole.CUSTOMER)
  @Post('me/addresses')
  addAddress(@CurrentUser() user: JwtPayload, @Body() dto: CreateAddressDto) {
    return this.users.addAddress(user.sub, dto);
  }

  @Roles(UserRole.ADMIN)
  @Get()
  list(
    @Query('search') search?: string,
    @Query('role') role?: PrismaUserRole,
    @Query('status') status?: UserStatus,
  ) {
    return this.users.list({ search, role, status });
  }

  @Roles(UserRole.ADMIN)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: AdminCreateUserDto, @Ip() ip: string) {
    return this.users.createByAdmin(user.sub, dto, ip);
  }

  @Roles(UserRole.ADMIN)
  @Patch(':id/status')
  setStatus(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UserStatusDto,
    @Ip() ip: string,
  ) {
    return this.users.setStatus(user.sub, id, dto, ip);
  }

  @Roles(UserRole.ADMIN)
  @Get('audit')
  audit() {
    return this.users.auditLogs();
  }
}
