import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@delivereats/shared-types';
import { assertCurrentIdentity } from '@delivereats/backend-kit';

@WebSocketGateway({ namespace: '/orders', path: '/socket.io/orders', cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost').split(','), credentials: true } })
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private clients = new Map<string, Socket>();
  constructor(private readonly jwt: JwtService) {}
  async handleConnection(client: Socket) {
    const cookieToken = client.handshake.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith('access_token='))?.slice('access_token='.length);
    const token = typeof client.handshake.auth.token === 'string' ? client.handshake.auth.token : cookieToken;
    try {
      if (!token) throw new Error('Sesión requerida');
      const user = await this.jwt.verifyAsync<JwtPayload>(token, { secret: process.env.JWT_SECRET, algorithms: ['HS256'] });
      await assertCurrentIdentity(user);
      client.data.user = user;
      this.clients.set(client.id, client);
    } catch { client.disconnect(true); }
  }
  handleDisconnect(client: Socket) { this.clients.delete(client.id); }
  async emitOrder(order: { id: string; customerId: string; status: string }, merchantOwnerIds: string[] = []) {
    const notification = { id: order.id, status: order.status };
    await Promise.allSettled([...this.clients.values()].map(async client => {
      const user = client.data.user as JwtPayload;
      if (user.sub !== order.customerId && user.role !== 'ADMIN' && !merchantOwnerIds.includes(user.sub)) return;
      try {
        await assertCurrentIdentity(user);
        client.emit(merchantOwnerIds.includes(user.sub) ? 'merchant.order.updated' : 'order.updated', notification);
      } catch { client.disconnect(true); }
    }));
  }
}
