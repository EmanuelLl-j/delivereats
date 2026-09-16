import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer, type OnGatewayConnection, type OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { assertCurrentIdentity } from '@delivereats/backend-kit';
import type { JwtPayload } from '@delivereats/shared-types';
import { ParticipantsService } from './participants.service';
import { CommunicationEvents } from './communications.service';

type Change = { orderId: string; event: string; payload: unknown };
@WebSocketGateway({ namespace: '/communications', path: '/socket.io/communications', cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost').split(','), credentials: true } })
export class CommunicationsGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server!: Server;
  private clients = new Map<string, Socket>();
  constructor(private readonly jwt: JwtService, private readonly participants: ParticipantsService, private readonly events: CommunicationEvents) {}
  private readonly forward = (change: Change) => { void this.broadcast(change); };
  onModuleInit() { this.events.on('change', this.forward); }
  onModuleDestroy() { this.events.off('change', this.forward); }
  async handleConnection(client: Socket) {
    try {
      const cookie = client.handshake.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('access_token='))?.slice('access_token='.length);
      const token = typeof client.handshake.auth.token === 'string' ? client.handshake.auth.token : cookie;
      if (!token) throw new Error('Sesión requerida');
      const user = await this.jwt.verifyAsync<JwtPayload>(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'] });
      await assertCurrentIdentity(user);
      client.data.user = user;
      this.clients.set(client.id, client);
      client.on('chat.subscribe', (orderId: unknown, ack?: (result: object) => void) => {
        void (async () => {
          if (typeof orderId !== 'string' || !/^[a-f0-9-]{36}$/i.test(orderId)) throw new Error('Pedido inválido');
          if (Date.now() - Number(client.data.lastSubscribe ?? 0) < 500) throw new Error('Espera antes de volver a suscribirte');
          client.data.lastSubscribe = Date.now();
          await assertCurrentIdentity(user);
          await this.participants.require(user, orderId);
          client.data.orderId = orderId;
          ack?.({ subscribed: true });
        })().catch(() => { client.data.orderId = null; ack?.({ subscribed: false, error: 'Conversación no autorizada' }); });
      });
    } catch { client.disconnect(true); }
  }
  handleDisconnect(client: Socket) { this.clients.delete(client.id); }
  private async broadcast(change: Change) {
    await Promise.allSettled([...this.clients.values()].map(async client => {
      if (client.data.orderId !== change.orderId) return;
      try {
        const user = client.data.user as JwtPayload;
        await assertCurrentIdentity(user);
        await this.participants.require(user, change.orderId);
        client.emit(change.event, change.payload);
      } catch { client.disconnect(true); }
    }));
  }
}
