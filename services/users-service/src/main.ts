import 'reflect-metadata';
import { bootstrapService } from '@delivereats/backend-kit';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  serviceName: 'Usuarios',
  environmentService: 'users-service',
  port: Number(process.env.PORT ?? 3001),
  description: 'Autenticación, perfiles, roles, clientes y administración de usuarios.',
});
