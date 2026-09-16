import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

process.loadEnvFile('.env');
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const root = resolve('.test-artifacts', `migrations-${runId}`);
mkdirSync(root, { recursive: true });
const results = [];
function command(executable, args, options = {}) { return execFileSync(executable, args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...options }); }
for (const [service, port] of [['users', 5433], ['orders', 5434], ['drivers', 5435], ['notifications', 5436]]) {
  const serviceDir = resolve(`services/${service}-service`);
  const prisma = resolve(serviceDir, 'node_modules/prisma/build/index.js');
  const container = command('docker', ['compose', 'ps', '-q', `postgres-${service}`]).trim();
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error(`PostgreSQL de ${service} no disponible`);
  const configured = new URL(process.env[`${service.toUpperCase()}_DATABASE_URL`]);
  configured.hostname = '127.0.0.1'; configured.port = String(port);
  const dbUser = process.env.POSTGRES_USER;
  if (!dbUser) throw new Error('Falta POSTGRES_USER');
  for (const scenario of ['clean', 'upgrade']) {
    const database = `delivereats_test_${service}_${scenario}_${runId}`;
    if (!/^delivereats_test_(users|orders|drivers|notifications)_(clean|upgrade)_[a-f0-9]{12}$/.test(database)) throw new Error('Destino no aislado');
    configured.pathname = `/${database}`;
    const env = { ...process.env, DATABASE_URL: configured.toString(), NODE_ENV: 'test' };
    command('docker', ['exec', container, 'createdb', '-U', dbUser, database]);
    try {
      if (scenario === 'upgrade') {
        const baseline = resolve(root, service, 'prisma');
        mkdirSync(resolve(baseline, 'migrations'), { recursive: true });
        writeFileSync(resolve(baseline, 'schema.prisma'), command('git', ['show', `HEAD:services/${service}-service/prisma/schema.prisma`]));
        writeFileSync(resolve(baseline, 'migrations/migration_lock.toml'), 'provider = "postgresql"\n');
        const original = command('git', ['ls-tree', '-r', '--name-only', 'HEAD', `services/${service}-service/prisma/migrations`]).trim().split(/\r?\n/).filter(path => path.endsWith('/migration.sql'));
        for (const path of original) {
          const folder = path.split('/').at(-2);
          mkdirSync(resolve(baseline, 'migrations', folder), { recursive: true });
          writeFileSync(resolve(baseline, 'migrations', folder, 'migration.sql'), command('git', ['show', `HEAD:${path}`]));
        }
        command(process.execPath, [prisma, 'migrate', 'deploy', '--schema', resolve(baseline, 'schema.prisma')], { cwd: serviceDir, env });
        // A sentinel outside the application schema proves the upgrade does not reset the database.
        command('docker', ['exec', '-i', container, 'psql', '-U', dbUser, '-d', database, '-v', 'ON_ERROR_STOP=1'], { input: "CREATE TABLE migration_sentinel (id integer primary key, value text); INSERT INTO migration_sentinel VALUES (1, 'preserve-existing-data');" });
      }
      const log = command(process.execPath, [prisma, 'migrate', 'deploy'], { cwd: serviceDir, env });
      writeFileSync(resolve(root, `${service}-${scenario}.log`), log);
      // Re-running deploy must be safe and apply nothing twice.
      command(process.execPath, [prisma, 'migrate', 'deploy'], { cwd: serviceDir, env });
      if (scenario === 'upgrade') {
        const retained = command('docker', ['exec', container, 'psql', '-U', dbUser, '-d', database, '-Atc', 'SELECT value FROM migration_sentinel WHERE id = 1']).trim();
        if (retained !== 'preserve-existing-data') throw new Error('La migración no conservó el centinela');
      }
      const pending = command('docker', ['exec', container, 'psql', '-U', dbUser, '-d', database, '-Atc', 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL']).trim();
      if (pending !== '0') throw new Error('Existe una migración incompleta');
      results.push({ service, scenario, status: 'PASS' });
      process.stdout.write(`PASS ${service}: ${scenario}\n`);
    } catch (error) {
      const safe = String(error.stderr ?? error.message).replaceAll(configured.toString(), '[DATABASE_URL]');
      writeFileSync(resolve(root, `${service}-${scenario}-error.log`), safe);
      process.stderr.write(`FAIL ${service}: ${scenario}; revisar el registro aislado.\n`);
      results.push({ service, scenario, status: 'FAIL' });
      process.exitCode = 1;
    } finally {
      // Only the freshly created, exact test database is dropped. Normal databases are never targets.
      command('docker', ['exec', container, 'dropdb', '-U', dbUser, database]);
    }
  }
}
writeFileSync(resolve(root, 'results.json'), JSON.stringify(results, null, 2));
process.stdout.write(`Resultados: ${root}\n`);
