import { createServer } from 'node:net';
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
const root = resolve(import.meta.dirname, '../..');
const require = createRequire(import.meta.url);
const command = (program, args, options = {}) => execFileSync(program, args, { encoding: 'utf8', timeout: 60_000, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], cwd: root, ...options });
export async function poll(read, accepts = Boolean, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { const value = await read(); if (accepts(value)) return value; await new Promise(done => setTimeout(done, 300)); }
  throw new Error('No se cumplió la condición dentro del tiempo de prueba');
}
async function freePort() { const server = createServer(); await new Promise(done => server.listen(0, '127.0.0.1', done)); const port = server.address().port; await new Promise(done => server.close(done)); return port; }
export async function isolatedEnvironment() {
  if (process.env.E2E_BASE_URL) throw new Error('E2E_BASE_URL no está permitido: esta suite solo opera servicios temporales');
  const original = parseEnv(readFileSync(resolve(root, '.env'), 'utf8'));
  const id = randomUUID().replaceAll('-', '').slice(0, 12), prefix = 'delivereats_test_e2e_' + id;
  if (!/^delivereats_test_e2e_[a-f0-9]{12}$/.test(prefix)) throw new Error('Identificador de prueba inválido');
  const directory = resolve(root, '.test-artifacts', 'e2e-' + id); mkdirSync(directory, { recursive: true });
  const names = ['users', 'orders', 'drivers', 'notifications'];
  const ports = Object.fromEntries(await Promise.all(names.map(async name => [name, await freePort()])));
  const bases = Object.fromEntries(names.map(name => [name, `http://127.0.0.1:${ports[name]}`]));
  const processes = [], databases = [], db = {}, logs = {}, mails = [], sockets = new Set();
  let rabbit, redisContainer, vhostCreated = false;
  // Test-only SMTP receiver. Production code still uses the actual SMTP and RabbitMQ providers.
  const smtp = createServer(socket => {
    sockets.add(socket); socket.on('close', () => sockets.delete(socket));
    let buffer = '', data = false, raw = '', recipient = '';
    socket.write('220 isolated-test ESMTP\r\n');
    socket.on('data', bytes => {
      buffer += bytes.toString(); let end;
      while ((end = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (data) {
          if (line === '.') { mails.push({ recipient, raw }); data = false; raw = ''; socket.write('250 accepted\r\n'); }
          else raw += line + '\r\n';
        } else if (/^EHLO|^HELO/i.test(line)) socket.write('250 isolated-test\r\n');
        else if (/^RCPT TO:/i.test(line)) { recipient = line; socket.write('250 ok\r\n'); }
        else if (/^DATA$/i.test(line)) { data = true; socket.write('354 end with dot\r\n'); }
        else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 ok\r\n');
      }
    });
  });
  const env = { ...process.env, NODE_ENV: 'test',
    ...Object.fromEntries(['JWT_SECRET', 'JWT_REFRESH_SECRET', 'INTERNAL_SERVICE_SECRET', 'EVENTS_ENCRYPTION_KEY', 'LOCAL_STORAGE_SIGNING_KEY'].map(name => [name, randomBytes(32).toString('hex')])),
    SHIPMENT_CODES_KEY: randomBytes(32).toString('base64'),
    STORAGE_PROVIDER: 'local', LOCAL_STORAGE_PATH: resolve(directory, 'private-files'), PUBLIC_USERS_URL: bases.users,
    WEB_URL: 'http://127.0.0.1:13000', PUBLIC_API_URL: bases.orders, CORS_ORIGINS: 'http://127.0.0.1:13000',
    FIREBASE_SERVICE_ACCOUNT_JSON: '', MERCADOPAGO_ACCESS_TOKEN: '', MERCADOPAGO_WEBHOOK_SECRET: '', LIVEKIT_URL: '', LIVEKIT_INTERNAL_URL: '', LIVEKIT_API_KEY: '', LIVEKIT_API_SECRET: '',
    SMTP_HOST: '127.0.0.1', SMTP_SECURE: 'false', SMTP_REQUIRE_TLS: 'false', SMTP_USER: '', SMTP_PASSWORD: '', EMAIL_FROM: 'test-receiver@example.test',
    ...Object.fromEntries(names.map(name => [name.toUpperCase() + '_SERVICE_URL', bases[name]])),
  };
  async function close() {
    for (const child of processes) if (child.exitCode === null) child.kill();
    await Promise.all(processes.map(child => child.exitCode !== null ? undefined : new Promise(done => { child.once('exit', done); setTimeout(done, 3000).unref(); })));
    await Promise.all(Object.values(db).map(client => client.$disconnect()));
    sockets.forEach(socket => socket.destroy()); if (smtp.listening) await new Promise(done => smtp.close(done));
    const errors = [];
    for (const entry of databases) { try { command('docker', ['exec', entry.container, 'dropdb', '--force', '-U', original.POSTGRES_USER, entry.name]); } catch { errors.push('Base temporal pendiente de eliminar: ' + entry.name); } }
    if (vhostCreated) { try { command('docker', ['exec', rabbit, 'rabbitmqctl', 'delete_vhost', prefix]); } catch { errors.push('Vhost temporal pendiente de eliminar: ' + prefix); } }
    if (redisContainer) { try { command('docker', ['rm', '-f', redisContainer]); } catch { errors.push('Redis temporal pendiente de eliminar: ' + redisContainer); } }
    const secrets = [original.POSTGRES_PASSWORD, original.RABBITMQ_PASSWORD, ...Object.entries(env).filter(([key]) => /SECRET|KEY|PASSWORD/.test(key)).map(([, value]) => value)].filter(value => value?.length > 6);
    for (const [name, log] of Object.entries(logs)) writeFileSync(resolve(directory, name + '.log'), secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), log));
    writeFileSync(resolve(directory, 'isolation.json'), JSON.stringify({ runId: id, temporaryDatabases: databases.map(row => row.name), cleanup: errors.length ? errors : 'complete', external: 'Firebase, LiveKit media, Mercado Pago and production SMTP not tested' }, null, 2));
    if (errors.length) throw new Error(errors.join('\n'));
  }
  try {
    await new Promise(done => smtp.listen(0, '127.0.0.1', done)); env.SMTP_PORT = String(smtp.address().port);
    for (const [index, name] of names.entries()) {
      const container = command('docker', ['compose', 'ps', '-q', 'postgres-' + name]).trim();
      if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('Inicia PostgreSQL local antes de esta prueba');
      const database = prefix + '_' + name;
      command('docker', ['exec', container, 'createdb', '-U', original.POSTGRES_USER, database]); databases.push({ container, name: database });
      const connection = new URL(original[name.toUpperCase() + '_DATABASE_URL']); connection.hostname = '127.0.0.1'; connection.port = String(5433 + index); connection.pathname = '/' + database;
      const service = resolve(root, 'services', name + '-service'); env[name.toUpperCase() + '_DATABASE_URL'] = connection.toString();
      command(process.execPath, [resolve(service, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: service, env: { ...env, DATABASE_URL: connection.toString() } });
      const { PrismaClient } = require(resolve(service, 'src/generated/prisma')); db[name] = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
    }
    rabbit = command('docker', ['compose', 'ps', '-q', 'rabbitmq']).trim(); if (!/^[a-f0-9]{12,64}$/.test(rabbit)) throw new Error('RabbitMQ local no disponible');
    command('docker', ['exec', rabbit, 'rabbitmqctl', 'add_vhost', prefix]); vhostCreated = true;
    command('docker', ['exec', rabbit, 'rabbitmqctl', 'set_permissions', '-p', prefix, original.RABBITMQ_USER, '.*', '.*', '.*']);
    const rabbitUrl = new URL(original.RABBITMQ_URL); rabbitUrl.hostname = '127.0.0.1'; rabbitUrl.port = '5672'; rabbitUrl.pathname = '/' + prefix; env.RABBITMQ_URL = rabbitUrl.toString();
    redisContainer = command('docker', ['run', '-d', '--name', prefix + '_redis', '-p', '127.0.0.1::6379', 'redis:7.4-alpine', '--save', '', '--appendonly', 'no']).trim();
    if (!/^[a-f0-9]{12,64}$/.test(redisContainer)) throw new Error('No se inició Redis aislado');
    const redisAddress = command('docker', ['port', redisContainer, '6379/tcp']).trim(); if (!/^127\.0\.0\.1:\d+$/.test(redisAddress)) throw new Error('Puerto Redis inválido'); env.REDIS_URL = 'redis://' + redisAddress;
    for (const name of names) {
      const service = resolve(root, 'services', name + '-service'); logs[name] = '';
      const child = spawn(process.execPath, [resolve(service, 'dist/main.js')], { cwd: service, env: { ...env, PORT: String(ports[name]), DATABASE_URL: env[name.toUpperCase() + '_DATABASE_URL'] }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.on('data', data => { logs[name] += data; }); child.stderr.on('data', data => { logs[name] += data; }); processes.push(child); child.on('error', error => { logs[name] += error.message; });
    }
    for (const name of names) await poll(async () => { try { return (await fetch(bases[name] + '/ready', { signal: AbortSignal.timeout(3000) })).ok; } catch { return false; } }, Boolean, 45_000);
    return { id, db, env, bases, mails, directory, close };
  } catch (error) { await close(); throw error; }
}
