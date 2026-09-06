import { Injectable, Logger } from '@nestjs/common';
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

  async send(to: string, subject: string, text: string): Promise<void> {
    this.transporter ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'localhost',
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? '' }
        : undefined,
    });
    await this.transporter.sendMail({
      from: process.env.EMAIL_FROM ?? 'DeliverEats <no-reply@delivereats.local>',
      to,
      subject,
      text,
    });
  }
}

@Injectable()
export class ConfigurablePushProvider implements PushProvider {
  private readonly logger = new Logger(ConfigurablePushProvider.name);

  async send(
    tokens: string[],
    title: string,
    message: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!tokens.length) return;
    const rawCredentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!rawCredentials || process.env.PUSH_PROVIDER === 'mock') {
      this.logger.log(`Push mock procesado para ${tokens.length} dispositivo(s)`);
      return;
    }
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
    await getMessaging().sendEachForMulticast({
      tokens,
      notification: { title, body: message },
      data,
    });
  }
}
