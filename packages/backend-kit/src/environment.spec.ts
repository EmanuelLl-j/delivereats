import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { productionEnvironmentIssues } from './environment';
describe('production configuration gates', () => {
  it('does not block local development for absent external accounts', () => expect(productionEnvironmentIssues({ NODE_ENV: 'development' })).toEqual([]));
  it('rejects an empty production environment without disclosing values', () => {
    const result = productionEnvironmentIssues({ NODE_ENV: 'production' });
    expect(result.some(issue => issue.startsWith('JWT_SECRET'))).toBe(true);
    expect(result.some(issue => issue.startsWith('STORAGE_PROVIDER'))).toBe(true);
  });
  it('requires the correct service-specific settings', () => {
    const result = productionEnvironmentIssues({ NODE_ENV: 'production' }, 'notifications-service');
    expect(result.some(issue => issue.startsWith('SMTP_HOST'))).toBe(true);
    expect(result.some(issue => issue.startsWith('S3_BUCKET'))).toBe(false);
  });
  it('rejects reused keys and production payment test credentials', () => {
    const key = randomBytes(32).toString('hex');
    const result = productionEnvironmentIssues({ NODE_ENV: 'production', JWT_SECRET: key, INTERNAL_SERVICE_SECRET: key, MERCADOPAGO_ACCESS_TOKEN: 'TEST-only', SHIPMENT_CODES_KEY: randomBytes(32).toString('base64') }, 'orders-service');
    expect(result.some(issue => issue.includes('independientes'))).toBe(true);
    expect(result.some(issue => issue.includes('credenciales de prueba'))).toBe(true);
    expect(result.some(issue => issue.startsWith('SHIPMENT_CODES_KEY'))).toBe(false);
  });
});
