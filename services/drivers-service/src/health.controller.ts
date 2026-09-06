import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '@delivereats/backend-kit';
import { PrismaService } from './prisma.service';
import { TrackingStore } from './tracking.service';

@ApiTags('Sistema')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tracking: TrackingStore,
  ) {}

  @Public()
  @Get()
  async health() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        service: 'drivers-service',
        dependencies: { database: 'ok', redis: await this.tracking.ping() },
      };
    } catch {
      throw new ServiceUnavailableException({
        code: 'HEALTH_DATABASE_DOWN',
        message: 'Base de datos no disponible',
      });
    }
  }
}
