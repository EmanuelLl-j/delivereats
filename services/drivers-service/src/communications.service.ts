import { ConflictException, ForbiddenException, Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';
import { EventPublisher, internalRequest } from '@delivereats/backend-kit';
import { type JwtPayload } from '@delivereats/shared-types';
import { PrismaService } from './prisma.service';
import { ParticipantsService } from './participants.service';
import { MessageDto } from './communications.dto';

export interface AudioCallProvider {
  configured(): boolean;
  ready(): Promise<boolean>;
  token(room: string, userId: string): Promise<{ token: string; serverUrl: string; expiresIn: number }>;
  close(room: string): Promise<void>;
}

@Injectable()
export class LiveKitAudioProvider implements AudioCallProvider {
  private probe?: { at: number; ok: boolean };
  configured() { return Boolean(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET); }
  private requireConfig() { if (!this.configured()) throw new ServiceUnavailableException('Las llamadas no están configuradas. El chat sigue disponible.'); }
  private client() {
    this.requireConfig();
    return new RoomServiceClient((process.env.LIVEKIT_INTERNAL_URL || process.env.LIVEKIT_URL!).replace(/^ws/, 'http'), process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { requestTimeout: 2, failover: false });
  }
  async ready() {
    if (!this.configured()) return false;
    if (this.probe && Date.now() - this.probe.at < 15_000) return this.probe.ok;
    let ok = false;
    try { await this.client().listRooms(['delivereats-readiness-probe']); ok = true; } catch { /* Reachability is separate from configuration. No credentials in diagnostics. */ }
    this.probe = { at: Date.now(), ok };
    return ok;
  }
  async token(room: string, userId: string) {
    this.requireConfig();
    const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, { identity: userId, ttl: '60s' });
    token.addGrant({ room, roomJoin: true, canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false });
    return { token: await token.toJwt(), serverUrl: process.env.LIVEKIT_URL!, expiresIn: 60 };
  }
  async close(room: string) {
    this.requireConfig();
    try { await this.client().deleteRoom(room); }
    catch (error) { if ((error as { code?: string }).code !== 'not_found') throw error; }
  }
}

@Injectable()
export class CommunicationEvents extends EventEmitter {}

@Injectable()
export class CommunicationsService implements OnModuleInit, OnModuleDestroy {
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly participants: ParticipantsService, private readonly audio: LiveKitAudioProvider, private readonly events: CommunicationEvents, private readonly outbox: EventPublisher) {}
  onModuleInit() { this.timer = setInterval(() => void this.expireCalls().catch(() => undefined), 10_000); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async conversation(user: JwtPayload, orderId: string) {
    const { counterpartId, driver } = await this.participants.require(user, orderId);
    const counterpart = await internalRequest<{ displayName: string; avatar: string | null }>('users', `/internal/users/${counterpartId}/public`);
    const conversation = await this.prisma.conversation.upsert({ where: { orderId }, create: { orderId }, update: {} });
    const messages = await this.prisma.message.findMany({ where: { conversationId: conversation.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    const call = await this.prisma.callSession.findFirst({ where: { orderId, status: { in: ['RINGING', 'ACTIVE'] } }, orderBy: { startedAt: 'desc' } });
    return { id: conversation.id, orderId, counterpart: { ...counterpart, ...(user.role === 'CUSTOMER' ? { rating: Number(driver.rating), vehicleType: driver.vehicleType, vehiclePlate: driver.vehiclePlate } : {}) }, messages: messages.reverse(), call: call ? this.callView(call) : null, audioAvailable: await this.audio.ready() };
  }

  async send(user: JwtPayload, orderId: string, dto: MessageDto) {
    const { counterpartId } = await this.participants.require(user, orderId);
    const body = dto.body.trim();
    if (!body) throw new ConflictException('Escribe un mensaje');
    const message = await this.prisma.$transaction(async tx => {
      const conversation = await tx.conversation.upsert({ where: { orderId }, create: { orderId }, update: {} });
      const existing = await tx.message.findUnique({ where: { senderUserId_clientMessageId: { senderUserId: user.sub, clientMessageId: dto.clientMessageId } } });
      if (existing) {
        if (existing.conversationId !== conversation.id || existing.body !== body) throw new ConflictException('Identificador de mensaje ya utilizado');
        return existing;
      }
      const created = await tx.message.create({ data: { conversationId: conversation.id, senderUserId: user.sub, recipientUserId: counterpartId, clientMessageId: dto.clientMessageId, body } });
      await this.outbox.enqueue(tx, 'chat.message', { userId: counterpartId, orderId });
      return created;
    });
    this.events.emit('change', { orderId, event: 'chat.message', payload: message });
    return message;
  }

  async read(user: JwtPayload, orderId: string) {
    await this.participants.require(user, orderId);
    const result = await this.prisma.message.updateMany({ where: { conversation: { orderId }, recipientUserId: user.sub, readAt: null }, data: { readAt: new Date() } });
    this.events.emit('change', { orderId, event: 'chat.read', payload: { orderId, readBy: user.sub } });
    return { count: result.count };
  }
  async unread(userId: string) { return { count: await this.prisma.message.count({ where: { recipientUserId: userId, readAt: null } }) }; }

  async startCall(user: JwtPayload, orderId: string) {
    const { counterpartId } = await this.participants.require(user, orderId);
    if (!await this.audio.ready()) throw new ServiceUnavailableException('El servicio de audio no está disponible. Puedes continuar por chat.');
    const call = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${orderId}))`;
      const active = await tx.callSession.findFirst({ where: { orderId, status: { in: ['RINGING', 'ACTIVE'] } } });
      if (active) throw new ConflictException('Ya existe una llamada activa');
      const record = await tx.callSession.create({ data: { orderId, callerUserId: user.sub, calleeUserId: counterpartId, roomName: `delivery-audio-${randomUUID()}` } });
      await tx.auditLog.create({ data: { actorUserId: user.sub, action: 'AUDIO_CALL_STARTED', entity: 'CallSession', entityId: record.id } });
      await this.outbox.enqueue(tx, 'call.ringing', { userId: counterpartId, orderId });
      return record;
    });
    this.events.emit('change', { orderId, event: 'call.updated', payload: this.callView(call) });
    return this.callView(call);
  }

  async callAction(user: JwtPayload, callId: string, action: 'ACCEPT' | 'REJECT' | 'END') {
    const call = await this.prisma.callSession.findUniqueOrThrow({ where: { id: callId } });
    await this.participants.require(user, call.orderId);
    if (![call.callerUserId, call.calleeUserId].includes(user.sub) || (action !== 'END' && call.calleeUserId !== user.sub)) throw new ForbiddenException('No puedes responder esta llamada');
    const status = action === 'ACCEPT' ? 'ACTIVE' : action === 'REJECT' ? 'REJECTED' : 'ENDED';
    const updated = await this.prisma.callSession.updateMany({ where: { id: callId, status: { in: action === 'END' ? ['RINGING', 'ACTIVE'] : ['RINGING'] }, ...(action === 'ACCEPT' ? { startedAt: { gt: new Date(Date.now() - 60_000) } } : {}) }, data: { status, ...(action === 'ACCEPT' ? {} : { endedAt: new Date() }) } });
    if (!updated.count) throw new ConflictException('La llamada ya cambió o venció');
    if (action !== 'ACCEPT') await this.closeProvider(call).catch(() => undefined);
    const result = this.callView({ ...call, status, endedAt: action === 'ACCEPT' ? null : new Date() });
    this.events.emit('change', { orderId: call.orderId, event: 'call.updated', payload: result });
    return result;
  }

  async token(user: JwtPayload, callId: string) {
    const call = await this.prisma.callSession.findUniqueOrThrow({ where: { id: callId } });
    await this.participants.require(user, call.orderId);
    if (call.status !== 'ACTIVE' || ![call.callerUserId, call.calleeUserId].includes(user.sub)) throw new ForbiddenException('La llamada no está activa para este participante');
    return this.audio.token(call.roomName, user.sub);
  }

  private callView(call: { id: string; orderId: string; callerUserId: string; calleeUserId: string; status: string; startedAt: Date; endedAt?: Date | null }) {
    return { id: call.id, orderId: call.orderId, callerUserId: call.callerUserId, calleeUserId: call.calleeUserId, status: call.status, startedAt: call.startedAt, endedAt: call.endedAt ?? null };
  }

  async expireCalls() {
    const active = await this.prisma.callSession.findMany({ where: { status: { in: ['RINGING', 'ACTIVE'] } }, take: 100 });
    for (const call of active) {
      let expired = Date.now() - call.startedAt.getTime() > (call.status === 'RINGING' ? 60_000 : 30 * 60_000);
      if (!expired) {
        try { await this.participants.require({ sub: call.callerUserId, role: call.callerUserId === (await this.participants.context(call.orderId)).customerId ? 'CUSTOMER' : 'DRIVER' } as JwtPayload, call.orderId); }
        catch { expired = true; }
      }
      if (expired) {
        const updated = await this.prisma.callSession.updateMany({ where: { id: call.id, status: call.status }, data: { status: call.status === 'RINGING' ? 'MISSED' : 'ENDED', endedAt: new Date() } });
        if (updated.count) {
          await this.closeProvider(call).catch(() => undefined);
          this.events.emit('change', { orderId: call.orderId, event: 'call.updated', payload: this.callView({ ...call, status: call.status === 'RINGING' ? 'MISSED' : 'ENDED', endedAt: new Date() }) });
        }
      }
    }
    // Ended calls survive process restarts; provider errors remain pending for the next sweep.
    const pending = await this.prisma.callSession.findMany({ where: { endedAt: { not: null }, providerClosedAt: null }, take: 30, orderBy: { endedAt: 'asc' } });
    await Promise.all(pending.map(call => this.closeProvider(call).catch(() => undefined)));
  }
  private async closeProvider(call: { id: string; roomName: string }) {
    await this.audio.close(call.roomName);
    await this.prisma.callSession.updateMany({ where: { id: call.id, endedAt: { not: null }, providerClosedAt: null }, data: { providerClosedAt: new Date() } });
  }
}
