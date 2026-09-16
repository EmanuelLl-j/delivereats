import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalStorageProvider, detectFileType } from './storage';
describe('private storage boundaries', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('recognizes supported signatures and rejects arbitrary bytes', () => {
    expect(detectFileType(Buffer.from('not an image document'))).toBe(null);
    expect(detectFileType(Buffer.from('%PDF-1.7\ncontent'))).toBe('application/pdf');
    expect(detectFileType(Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]))).toBe('image/png');
  });
  it('never activates local storage in production', async () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('STORAGE_PROVIDER', 'local');
    expect(await new LocalStorageProvider().ready()).toBe(false);
  });
  it('rejects expired and malformed signed requests without reading files', async () => {
    await expect(new LocalStorageProvider().read('anything', 'image/png', '0', 'invalid')).rejects.toThrow('vencido');
  });
});
