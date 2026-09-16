import 'reflect-metadata';
import { bootstrapService } from '@delivereats/backend-kit';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  serviceName: 'Notificaciones',
  environmentService: 'notifications-service',
  port: Number(process.env.PORT ?? 3004),
  description:
    'Notificaciones in-app, email SMTP, push configurable y consumo resiliente de eventos.',
});
