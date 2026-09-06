import 'reflect-metadata';
import { bootstrapService } from '@delivereats/backend-kit';
import { AppModule } from './app.module';

void bootstrapService({
  module: AppModule,
  serviceName: 'Pedidos',
  port: Number(process.env.PORT ?? 3002),
  description: 'Comercios, catálogo, carrito multi-negocio, pedidos, promociones y pagos.',
});
