import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
process.loadEnvFile('.env');
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const database = 'delivereats_test_concurrency_' + runId;
if (!/^delivereats_test_concurrency_[a-f0-9]{12}$/.test(database)) throw new Error('Base de prueba no válida');
const directory = resolve('.test-artifacts', 'concurrency-' + runId);
mkdirSync(directory, { recursive: true });
const command = (program, args, options = {}) => execFileSync(program, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options });
const container = command('docker', ['compose', 'ps', '-q', 'postgres-drivers']).trim();
if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('PostgreSQL no disponible');
const connection = new URL(process.env.DRIVERS_DATABASE_URL);
connection.hostname = '127.0.0.1'; connection.port = '5435'; connection.pathname = '/' + database;
const service = resolve('services/drivers-service');
const env = { ...process.env, NODE_ENV: 'test', DATABASE_URL: connection.toString(), DRIVERS_TEST_DATABASE_URL: connection.toString() };
command('docker', ['exec', container, 'createdb', '-U', process.env.POSTGRES_USER, database]);
try {
  command(process.execPath, [resolve(service, 'node_modules/prisma/build/index.js'), 'migrate', 'deploy'], { cwd: service, env });
  const result = command(process.execPath, [resolve(service, 'node_modules/vitest/vitest.mjs'), 'run', 'src/concurrency.integration.spec.ts'], { cwd: service, env, timeout: 100000 });
  writeFileSync(resolve(directory, 'result.log'), result);
  process.stdout.write(result);
} catch (error) {
  const result = String(error.stdout ?? '') + String(error.stderr ?? error.message);
  writeFileSync(resolve(directory, 'result.log'), result.replaceAll(connection.toString(), '[DATABASE_URL]'));
  process.stderr.write('Prueba fallida; revisar el registro aislado: ' + directory + '\n');
  process.exitCode = 1;
} finally {
  command('docker', ['exec', container, 'dropdb', '--force', '-U', process.env.POSTGRES_USER, database]);
}

