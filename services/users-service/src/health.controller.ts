import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { Public, EventPublisher } from '@delivereats/backend-kit';
import { PrismaService } from './prisma.service';
import { S3StorageProvider } from './storage';

@ApiTags('Sistema') @Public() @SkipThrottle() @Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly events: EventPublisher, private readonly storage: S3StorageProvider) {}
  @Get('health') health() { return { status: 'ok', service: 'users-service', kind: 'liveness' }; }
  @Get('ready') async ready(@Res({ passthrough: true }) response: { status(code: number): void }) {
    const dependencies: Record<string, string> = { database: 'unavailable', rabbitmq: this.events.healthy() ? 'ok' : 'unavailable' };
    try { await this.prisma.$queryRaw`SELECT 1`; dependencies.database = 'ok'; } catch { /* No credentials or connection strings in diagnostics. */ }
    dependencies.storage = await this.storage.ready() ? 'ok' : 'unavailable';
    const optional = {};
    const ready = Object.values(dependencies).every(value => value === 'ok');
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'not_ready', service: 'users-service', dependencies, optional };
  }
}
