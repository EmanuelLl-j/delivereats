import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@delivereats/backend-kit';
import { EventsConsumer } from './events.consumer';
import { PrismaService } from './prisma.service';

@ApiTags('Sistema')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsConsumer,
  ) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: this.events.healthy() ? 'ok' : 'degraded',
        service: 'notifications-service',
        dependencies: { database: 'ok', rabbitmq: this.events.healthy() ? 'ok' : 'degraded' },
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'HEALTH_DATABASE_DOWN',
        message: 'Base de datos no disponible',
      });
    }
  }
}
