import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '.env');
const template = readFileSync(resolve(root, '.env.example'), 'utf8');
const existing = existsSync(target) ? readFileSync(target, 'utf8') : '';
const parse = text => Object.fromEntries(text.split(/\r?\n/).filter(line => /^[A-Z][A-Z0-9_]*=/.test(line)).map(line => { const index = line.indexOf('='); return [line.slice(0, index), line.slice(index + 1)]; }));
const values = { ...parse(template), ...parse(existing) };
if (values.NODE_ENV === 'production') throw new Error('Este comando no modifica entornos de producción');
const secure = name => { if (!values[name] || /change-me|development-only|example|^<|^changeme/i.test(values[name])) values[name] = randomBytes(32).toString('hex'); };
for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_SERVICE_SECRET', 'EVENTS_ENCRYPTION_KEY', 'LOCAL_STORAGE_SIGNING_KEY', 'REDIS_PASSWORD']) secure(name);
// Existing database and broker credentials may already protect persistent volumes: do not rotate them here.
if (!values.POSTGRES_PASSWORD) secure('POSTGRES_PASSWORD');
if (!values.RABBITMQ_PASSWORD) secure('RABBITMQ_PASSWORD');
if (!values.SHIPMENT_CODES_KEY) values.SHIPMENT_CODES_KEY = randomBytes(32).toString('base64');
for (const service of ['users', 'orders', 'drivers', 'notifications']) {
  const key = service.toUpperCase() + '_DATABASE_URL';
  if (!values[key]) values[key] = 'postgresql://' + encodeURIComponent(values.POSTGRES_USER) + ':' + encodeURIComponent(values.POSTGRES_PASSWORD) + '@postgres-' + service + ':5432/' + service + '_db?schema=public';
}
if (!values.RABBITMQ_URL) values.RABBITMQ_URL = 'amqp://' + encodeURIComponent(values.RABBITMQ_USER) + ':' + encodeURIComponent(values.RABBITMQ_PASSWORD) + '@rabbitmq:5672';
values.REDIS_URL = 'redis://:' + encodeURIComponent(values.REDIS_PASSWORD) + '@redis:6379';
values.STORAGE_PROVIDER = values.STORAGE_PROVIDER || 'local';
if (!values.LIVEKIT_API_KEY) values.LIVEKIT_API_KEY = 'local_' + randomBytes(12).toString('hex');
if (!values.LIVEKIT_API_SECRET) values.LIVEKIT_API_SECRET = randomBytes(32).toString('hex');
if (values.EMAIL_FROM?.includes('@delivereats.local')) values.EMAIL_FROM = parse(template).EMAIL_FROM;
const known = parse(template);
const output = template.split(/\r?\n/).map(line => /^[A-Z][A-Z0-9_]*=/.test(line) ? line.slice(0, line.indexOf('=')) + '=' + values[line.slice(0, line.indexOf('='))] : line).join('\n');
const extra = Object.keys(values).filter(name => !(name in known) && !['PAYMENTS_MODE', 'MAPS_PROVIDER', 'PUSH_PROVIDER', 'SMS_PROVIDER', 'MERCADOPAGO_SANDBOX'].includes(name)).map(name => name + '=' + values[name]).join('\n');
writeFileSync(target, output + (extra ? '\n# Variables existentes conservadas\n' + extra + '\n' : ''), { mode: 0o600 });
process.stdout.write('Entorno local preparado. Secretos generados sin mostrarlos. No se crearon cuentas ni se modificaron bases de datos.\n');
