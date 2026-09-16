import 'reflect-metadata';
import { bootstrapService } from '@delivereats/backend-kit';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  serviceName: 'Repartidores',
  environmentService: 'drivers-service',
  port: Number(process.env.PORT ?? 3003),
  description: 'Disponibilidad, oferta atómica, asignaciones, tracking GPS y entregas.',
});
