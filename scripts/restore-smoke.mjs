import { execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseEnv } from 'node:util';

const root = resolve('backups');
const selected = process.argv[2] || readdirSync(root, { withFileTypes: true }).filter(row => row.isDirectory()).map(row => row.name).sort().at(-1);
if (!selected) throw new Error('Primero crea una copia con pnpm backup:local');
const directory = resolve(root, selected);
const inside = relative(root, directory);
if (!inside || inside.startsWith('..') || isAbsolute(inside)) throw new Error('Selecciona una copia dentro de backups');
const manifest = JSON.parse(readFileSync(resolve(directory, 'manifest.json'), 'utf8'));
if (manifest.complete !== true) throw new Error('La copia no está completa');
const env = parseEnv(readFileSync('.env', 'utf8'));
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const artifact = resolve('.test-artifacts', 'restore-' + runId);
mkdirSync(artifact, { recursive: true });
const results = [];
const command = args => execFileSync('docker', args, { encoding: 'utf8', windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
for (const service of ['users', 'orders', 'drivers', 'notifications']) {
  const file = resolve(directory, service + '.dump');
  if (!existsSync(file) || !manifest.databases.some(row => row.service === service && row.file === service + '.dump')) throw new Error('Falta una base en la copia');
  const container = command(['compose', 'ps', '-q', 'postgres-' + service]).trim();
  if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('PostgreSQL no disponible: ' + service);
  const database = `delivereats_test_restore_${service}_${runId}`;
  if (!/^delivereats_test_restore_(users|orders|drivers|notifications)_[a-f0-9]{12}$/.test(database)) throw new Error('Destino no aislado');
  command(['exec', container, 'createdb', '-U', env.POSTGRES_USER, database]);
  try {
    const child = spawn('docker', ['exec', '-i', container, 'pg_restore', '--exit-on-error', '--no-owner', '--no-acl', '-U', env.POSTGRES_USER, '-d', database], { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] });
    child.stderr.resume();
    const completed = new Promise((done, fail) => { child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(new Error('Restauración fallida: ' + service))); });
    await Promise.all([pipeline(createReadStream(file), child.stdin), completed]);
    const tables = Number(command(['exec', container, 'psql', '-U', env.POSTGRES_USER, '-d', database, '-Atc', "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"]).trim());
    if (!Number.isInteger(tables) || tables < 2) throw new Error('El esquema restaurado está vacío');
    results.push({ service, status: 'PASS', tables, cleanup: 'pending' });
    console.log(`PASS ${service}: copia restaurada en base temporal (${tables} tablas)`);
  } finally {
    // Exactly this newly created test database, never the backed-up or normal one.
    command(['exec', container, 'dropdb', '--force', '-U', env.POSTGRES_USER, database]);
    if (results.at(-1)?.service === service) results.at(-1).cleanup = 'complete';
    writeFileSync(resolve(artifact, 'results.json'), JSON.stringify({ backup: inside, results }, null, 2));
  }
}
console.log('Evidencia: ' + artifact + '. No se modificaron las bases normales.');
