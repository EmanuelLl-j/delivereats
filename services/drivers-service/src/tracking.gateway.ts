import { JwtService } from '@nestjs/jwt';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { OnGatewayConnection } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { DriverLocation, JwtPayload } from '@delivereats/shared-types';

@WebSocketGateway({
  namespace: '/tracking',
  path: '/socket.io/tracking',
  cors: { origin: true, credentials: true },
})
export class TrackingGateway implements OnGatewayConnection {
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
      client.data.user = user;
      await client.join(`role:${user.role}`);
      client.on('tracking.subscribe', (orderId: unknown) => {
        if (typeof orderId === 'string') void client.join(`order:${orderId}`);
      });
    } catch {
      client.disconnect(true);
    }
  }

  emitLocation(orderId: string | undefined, location: DriverLocation): void {
    if (orderId) this.server?.to(`order:${orderId}`).emit('driver.location.updated', location);
    this.server?.to('role:ADMIN').emit('driver.location.updated', location);
  }
}
