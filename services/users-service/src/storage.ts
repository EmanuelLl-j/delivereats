import { BadRequestException, Controller, ForbiddenException, Get, Injectable, Param, Post, Query, Res, ServiceUnavailableException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser, Public } from '@delivereats/backend-kit';
import { type JwtPayload, UserRole } from '@delivereats/shared-types';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { access, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { PrismaService } from './prisma.service';

const publicPurposes = ['PRODUCT', 'MERCHANT_LOGO', 'MERCHANT_COVER', 'PAYMENT_QR', 'AVATAR'];
const purposes = [...publicPurposes, 'DRIVER_DOCUMENT', 'MERCHANT_DOCUMENT', 'PAYMENT_EVIDENCE', 'PACKAGE', 'PICKUP_EVIDENCE', 'DELIVERY_EVIDENCE'];
type Upload = { buffer: Buffer; size: number; mimetype: string };
type Response = { setHeader(name: string, value: string): void; redirect(url: string): void; end(content: Buffer): void };

export interface StorageProvider {
  put(key: string, content: Buffer, type: string): Promise<void>;
  signedRead(key: string, type: string): Promise<string>;
  ready(): Promise<boolean>;
}

// Real private files for isolated/local development; never a production storage fallback.
export class LocalStorageProvider implements StorageProvider {
  private root() {
    if (process.env.NODE_ENV === 'production' || process.env.STORAGE_PROVIDER !== 'local') throw new ServiceUnavailableException('El almacenamiento local solo está permitido en desarrollo y pruebas');
    if (!process.env.LOCAL_STORAGE_SIGNING_KEY || process.env.LOCAL_STORAGE_SIGNING_KEY.length < 32 || !process.env.PUBLIC_USERS_URL) throw new ServiceUnavailableException('Falta configurar la firma y URL de archivos locales');
    return resolve(process.env.LOCAL_STORAGE_PATH ?? '.local/private-files');
  }
  private path(key: string) {
    const root = this.root();
    if (!/^[a-z_]+\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key)) throw new ForbiddenException('Clave de archivo no válida');
    const path = resolve(root, key);
    if (!path.startsWith(root + sep)) throw new ForbiddenException('Archivo no disponible');
    return path;
  }
  async put(key: string, content: Buffer) { const path = this.path(key); await mkdir(dirname(path), { recursive: true }); await writeFile(path, content, { flag: 'wx', mode: 0o600 }); }
  async remove(key: string) { await unlink(this.path(key)); }
  private signature(key: string, type: string, expires: string) { this.root(); return createHmac('sha256', process.env.LOCAL_STORAGE_SIGNING_KEY!).update(key + '\n' + type + '\n' + expires).digest(); }
  async signedRead(key: string, type: string) {
    await access(this.path(key));
    const expires = String(Date.now() + 180000);
    return process.env.PUBLIC_USERS_URL!.replace(/\/$/, '') + '/files/local/' + key.split('/').at(-1) + '?expires=' + expires + '&signature=' + this.signature(key, type, expires).toString('hex');
  }
  async read(key: string, type: string, expires: string, signature: string) {
    if (!/^\d{13}$/.test(expires) || Number(expires) < Date.now() || Number(expires) > Date.now() + 180000 || !/^[a-f0-9]{64}$/.test(signature)) throw new ForbiddenException('Enlace vencido o no válido');
    if (!timingSafeEqual(this.signature(key, type, expires), Buffer.from(signature, 'hex'))) throw new ForbiddenException('Firma no válida');
    return readFile(this.path(key));
  }
  async ready() { try { const root = this.root(); await mkdir(root, { recursive: true }); await access(root); return true; } catch { return false; } }
}

@Injectable()
export class S3StorageProvider implements StorageProvider {
  private readonly local = new LocalStorageProvider();
  private client(endpoint = process.env.S3_ENDPOINT) {
    if (!endpoint || !process.env.S3_ACCESS_KEY || !process.env.S3_SECRET_KEY || !process.env.S3_BUCKET) throw new ServiceUnavailableException('El almacenamiento de archivos no está configurado');
    return new S3Client({ endpoint, region: process.env.S3_REGION ?? 'us-east-1', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }, maxAttempts: 2 });
  }
  async put(key: string, content: Buffer, type: string) {
    if (process.env.STORAGE_PROVIDER === 'local') return this.local.put(key, content);
    await this.client().send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: content, ContentType: type, CacheControl: 'private, no-store' }));
  }
  async remove(key: string) { if (process.env.STORAGE_PROVIDER === 'local') return this.local.remove(key); await this.client().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key })); }
  signedRead(key: string, type: string) {
    if (process.env.STORAGE_PROVIDER === 'local') return this.local.signedRead(key, type);
    return getSignedUrl(this.client(process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT), new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ResponseContentType: type, ResponseContentDisposition: type === 'application/pdf' ? 'attachment' : 'inline' }), { expiresIn: 180 });
  }
  localRead(key: string, type: string, expires: string, signature: string) { return this.local.read(key, type, expires, signature); }
  async ready() { if (process.env.STORAGE_PROVIDER === 'local') return this.local.ready(); try { await this.client().send(new HeadBucketCommand({ Bucket: process.env.S3_BUCKET })); return true; } catch { return false; } }
}

export function detectFileType(buffer: Buffer) {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('ascii', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

@Controller('files')
export class FilesController {
  constructor(private readonly prisma: PrismaService, private readonly storage: S3StorageProvider) {}

  @Public() @Get('local/:id') async localRead(@Param('id') id: string, @Query('expires') expires: string, @Query('signature') signature: string, @Res() response: Response) {
    const file = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!file) throw new ForbiddenException('Archivo no disponible');
    const content = await this.storage.localRead(file.objectKey, file.mimeType, expires ?? '', signature ?? '');
    response.setHeader('Cache-Control', 'private, no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', file.mimeType === 'application/pdf' ? 'attachment' : 'inline');
    response.end(content);
  }

  @Post() @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0 } }))
  async upload(@CurrentUser() user: JwtPayload, @Query('purpose') purpose: string, @UploadedFile() file?: Upload) {
    if (!purposes.includes(purpose) || !file?.buffer) throw new BadRequestException('Adjunta un archivo y una finalidad válida');
    if (purpose.startsWith('MERCHANT_') || purpose === 'PRODUCT') {
      if (![UserRole.MERCHANT, UserRole.ADMIN].includes(user.role)) throw new ForbiddenException('Solo comercios y administración pueden cargar estos archivos');
    }
    if (purpose === 'PAYMENT_QR' && user.role !== UserRole.ADMIN) throw new ForbiddenException();
    if (purpose === 'DRIVER_DOCUMENT' && ![UserRole.DRIVER, UserRole.ADMIN].includes(user.role)) throw new ForbiddenException();
    const type = detectFileType(file.buffer);
    if (!type || type !== file.mimetype || (type === 'application/pdf' && !purpose.endsWith('_DOCUMENT'))) throw new BadRequestException('Solo PNG, JPEG o WebP; PDF únicamente para documentos privados');
    const id = randomUUID();
    const key = `${purpose.toLowerCase()}/${user.sub}/${id}`;
    await this.storage.put(key, file.buffer, type);
    try {
      await this.prisma.fileAsset.create({ data: { id, ownerUserId: user.sub, objectKey: key, purpose, mimeType: type, size: file.size } });
    } catch (error) { await this.storage.remove(key).catch(() => undefined); throw error; }
    return { id, purpose, mimeType: type, size: file.size, ...(publicPurposes.includes(purpose) ? { url: `/api/users/files/public/${id}` } : {}) };
  }

  @Get(':id/url') async read(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    const file = await this.prisma.fileAsset.findFirst({ where: { id, ...(user.role === UserRole.ADMIN ? {} : { ownerUserId: user.sub }) } });
    if (!file) throw new ForbiddenException('Archivo no disponible');
    return { url: await this.storage.signedRead(file.objectKey, file.mimeType), expiresIn: 180 };
  }

  @Public() @Get('public/:id') async publicRead(@Param('id') id: string, @Res() response: Response) {
    const file = await this.prisma.fileAsset.findFirst({ where: { id, purpose: { in: publicPurposes } } });
    if (!file) throw new ForbiddenException('Archivo no público');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.redirect(await this.storage.signedRead(file.objectKey, file.mimeType));
  }
}
