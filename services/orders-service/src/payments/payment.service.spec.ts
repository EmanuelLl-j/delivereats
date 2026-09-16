import { describe, expect, it, vi } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { PaymentService, verifyWebhookSignature } from './payment.service';

describe('payment security', () => {
  const secret = randomBytes(32).toString('hex');
  const now = Date.now();
  const ts = String(Math.floor(now / 1000));
  const signature = createHmac('sha256', secret).update(`id:123;request-id:req-1;ts:${ts};`).digest('hex');
  it('validates the provider manifest in constant-time', () => expect(verifyWebhookSignature('123', 'req-1', `ts=${ts},v1=${signature}`, secret, now)).toBe(true));
  it('rejects forged signatures', () => expect(verifyWebhookSignature('123', 'req-1', `ts=${ts},v1=${'0'.repeat(64)}`, secret, now)).toBe(false));
  it('rejects expired signed requests', () => expect(verifyWebhookSignature('123', 'req-1', `ts=${ts},v1=${signature}`, secret, now + 360_000)).toBe(false));
  it('binds the resource and request ID', () => {
    expect(verifyWebhookSignature('124', 'req-1', `ts=${ts},v1=${signature}`, secret, now)).toBe(false);
    expect(verifyWebhookSignature('123', 'req-2', `ts=${ts},v1=${signature}`, secret, now)).toBe(false);
  });
  it('rejects missing secrets and malformed input', () => {
    expect(verifyWebhookSignature('123', 'req-1', 'broken', secret, now)).toBe(false);
    expect(verifyWebhookSignature('123', 'req-1', `ts=${ts},v1=${signature}`, '', now)).toBe(false);
  });
  it('never falls back to a mock or legacy method', async () => {
    const service = new PaymentService({ paymentConfiguration: { findUnique: vi.fn(async () => null) } } as never, {} as never);
    for (const method of ['MOCK', 'YAPE', 'PLIN', 'CARD']) await expect(service.assertConfigured(method)).rejects.toThrow('vigente');
    await expect(service.assertConfigured('MERCADO_PAGO')).rejects.toThrow('deshabilitado');
  });
});
