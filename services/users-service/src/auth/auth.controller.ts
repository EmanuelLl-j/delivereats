import { Body, Controller, Get, Headers, HttpCode, Ip, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public } from '@delivereats/backend-kit';
import type { JwtPayload } from '@delivereats/shared-types';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RefreshDto,
  RegisterDto,
  ResetPasswordDto,
  UpdateProfileDto,
  VerificationDto,
} from './dto';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('verify-email')
  verifyEmail(@Body() dto: VerificationDto) { return this.auth.verifyEmail(dto.token); }

  @ApiBearerAuth()
  @Post('resend-verification')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  resendVerification(@CurrentUser() user: JwtPayload) { return this.auth.sendVerification(user.sub); }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrar un cliente' })
  register(
    @Body() dto: RegisterDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.auth.register(dto, { ip, userAgent, correlationId });
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.auth.login(dto, { ip, userAgent, correlationId });
  }

  @Public()
  @HttpCode(200)
  @Post('refresh')
  refresh(
    @Body() dto: RefreshDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.auth.refresh(dto.refreshToken, { ip, userAgent, correlationId });
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('logout')
  logout(@CurrentUser() user: JwtPayload, @Body() dto: Partial<RefreshDto>) {
    return this.auth.logout(user.sub, dto.refreshToken);
  }

  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Headers('x-correlation-id') correlationId?: string,
  ) {
    return this.auth.forgotPassword(dto, { correlationId });
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.auth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @HttpCode(200)
  @Post('change-password')
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.auth.changePassword(user.sub, dto);
  }

  @ApiBearerAuth()
  @Get('profile')
  profile(@CurrentUser() user: JwtPayload) {
    return this.auth.profile(user.sub);
  }

  @ApiBearerAuth()
  @Patch('profile')
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.auth.updateProfile(user.sub, dto);
  }
}
