import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@delivereats/backend-kit';
import { PrismaService } from './prisma.service';
import { EventsConsumer } from './events.consumer';
import { SmtpEmailProvider } from './providers';

@ApiTags('Sistema') @Public() @SkipThrottle() @Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventsConsumer, private readonly email: SmtpEmailProvider) {}
  @Get('health') health() { return { status: 'ok', service: 'notifications-service', kind: 'liveness' }; }
  @Get('ready') async ready(@Res({ passthrough: true }) response: { status(code: number): void }) {
    const dependencies: Record<string, string> = { database: 'unavailable', rabbitmq: this.events.healthy() ? 'ok' : 'unavailable' };
    try { await this.prisma.$queryRaw`SELECT 1`; dependencies.database = 'ok'; } catch { /* No credentials or connection strings in diagnostics. */ }
    dependencies.smtp = await this.email.ready() ? 'ok' : 'unavailable';
    const optional = { push: process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? 'configured_unverified' : 'not_configured' };
    const ready = Object.values(dependencies).every(value => value === 'ok');
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready', service: 'notifications-service', dependencies, optional };
  }
}
