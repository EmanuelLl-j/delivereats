import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { DriverLocation, JwtPayload } from '@delivereats/shared-types';
import { assertCurrentIdentity } from '@delivereats/backend-kit';
import { ParticipantsService } from './participants.service';

@WebSocketGateway({ namespace: '/tracking', path: '/socket.io/tracking', cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost').split(','), credentials: true } })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private clients = new Map<string, Socket>();
  constructor(private readonly jwt: JwtService, private readonly participants: ParticipantsService) {}
  async handleConnection(client: Socket) {
    const cookieToken = client.handshake.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('access_token='))?.slice('access_token='.length);
    const token = typeof client.handshake.auth.token === 'string' ? client.handshake.auth.token : cookieToken;
    try {
      if (!token) throw new Error('Sesión requerida');
      const user = await this.jwt.verifyAsync<JwtPayload>(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'] });
      await assertCurrentIdentity(user);
      client.data.user = user;
      this.clients.set(client.id, client);
      client.on('tracking.subscribe', (orderId: unknown, ack?: (result: object) => void) => {
        void (async () => {
          if (typeof orderId !== 'string' || !/^[a-f0-9-]{36}$/i.test(orderId)) throw new Error('Pedido inválido');
          await assertCurrentIdentity(user);
          await this.participants.require(user, orderId, true);
          client.data.orderId = orderId;
          ack?.({ subscribed: true });
        })().catch(() => { client.data.orderId = null; ack?.({ subscribed: false, error: 'Seguimiento no autorizado' }); });
      });
    } catch { client.disconnect(true); }
  }
  handleDisconnect(client: Socket) { this.clients.delete(client.id); }
  async emitLocation(orderId: string | undefined, location: DriverLocation) {
    await Promise.allSettled([...this.clients.values()].map(async client => {
      const user = client.data.user as JwtPayload;
      if (user.role !== 'ADMIN' && (!orderId || client.data.orderId !== orderId)) return;
      try {
        await assertCurrentIdentity(user);
        if (user.role !== 'ADMIN') {
          const context = await this.participants.require(user, orderId!, false);
          if (['DELIVERED', 'CANCELLED'].includes(context.order.status)) return;
        }
        client.emit('driver.location.updated', location);
      } catch { client.disconnect(true); }
    }));
  }
}
