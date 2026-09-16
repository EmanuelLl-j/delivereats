import { ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key() {
  const value = Buffer.from(process.env.SHIPMENT_CODES_KEY ?? '', 'base64');
  if (value.length !== 32) throw new ServiceUnavailableException('Configura SHIPMENT_CODES_KEY con una clave base64 de 32 bytes');
  return value;
}
export function encryptCode(code: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.');
}
export function decryptCode(encrypted: string) {
  const [iv, tag, ciphertext] = encrypted.split('.').map(value => Buffer.from(value, 'base64url'));
  if (!iv || iv.length !== 12 || !tag || tag.length !== 16 || !ciphertext) throw new ServiceUnavailableException('Código de verificación no disponible');
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]).toString('utf8');
}
