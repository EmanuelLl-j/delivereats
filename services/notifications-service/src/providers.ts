import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

export interface EmailProvider {
  send(to: string, subject: string, text: string): Promise<void>;
}

export interface PushProvider {
  send(
    tokens: string[],
    title: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<void>;
}

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private transporter?: Transporter;

  async ready() {
    if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) return false;
    try {
      const probe = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT ?? 1025), secure: process.env.SMTP_SECURE === 'true', requireTLS: process.env.SMTP_REQUIRE_TLS === 'true' || process.env.NODE_ENV === 'production', connectionTimeout: 2_000, greetingTimeout: 2_000, socketTimeout: 3_000, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined });
      const ready = await probe.verify();
      probe.close();
      return ready;
    } catch { return false; }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) throw new ServiceUnavailableException('SMTP y remitente no configurados');
    this.transporter ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      requireTLS: process.env.SMTP_REQUIRE_TLS === 'true' || process.env.NODE_ENV === 'production',
      connectionTimeout: 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to,
      subject,
      text,
    });
  }
}

@Injectable()
export class ConfigurablePushProvider implements PushProvider {

  async send(
    tokens: string[],
    title: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!tokens.length) throw new ServiceUnavailableException('No hay dispositivos FCM registrados en una sesión vigente');
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredentials) throw new ServiceUnavailableException('Push no configurado');
    if (!getApps().length) {
      const credentials = JSON.parse(rawCredentials) as {
        project_id: string;
        client_email: string;
        private_key: string;
      };
      initializeApp({
        credential: cert({
          projectId: credentials.project_id,
          clientEmail: credentials.client_email,
          privateKey: credentials.private_key,
        }),
      });
    }
    for (let offset = 0; offset < tokens.length; offset += 500) {
      const result = await getMessaging().sendEachForMulticast({
        tokens: tokens.slice(offset, offset + 500),
        notification: { title, body: message }, data,
        android: { priority: 'high', notification: { channelId: 'deliveries' }, ttl: 5 * 60_000 },
      });
      if (result.failureCount) throw new ServiceUnavailableException('Firebase rechazó uno o más mensajes; no se confirma entrega al dispositivo');
    }
  }
}
