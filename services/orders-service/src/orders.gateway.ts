import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from '@delivereats/shared-types';

@WebSocketGateway({
  namespace: '/orders',
  path: '/socket.io/orders',
  cors: { origin: true, credentials: true },
})
export class OrdersGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwt: JwtService) {}

  async handleConnection(client: Socket): Promise<void> {
    const cookieToken = client.handshake.headers.cookie
      ?.split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('access_token='))
      ?.slice('access_token='.length);
    const token =
      typeof client.handshake.auth.token === 'string' ? client.handshake.auth.token : cookieToken;
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const user = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      await client.join(`user:${user.sub}`);
      await client.join(`role:${user.role}`);
    } catch {
      client.disconnect(true);
    }
  }

  emitOrder(
    order: { id: string; customerId: string; status: string },
    merchantOwnerIds: string[] = [],
  ): void {
    this.server?.to(`user:${order.customerId}`).emit('order.updated', order);
    this.server?.to('role:ADMIN').emit('order.updated', order);
    for (const ownerId of merchantOwnerIds) {
      this.server?.to(`user:${ownerId}`).emit('merchant.order.updated', order);
    }
  }
}
