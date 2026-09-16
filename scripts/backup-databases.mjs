import { spawn, execFileSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';
import { randomUUID } from 'node:crypto';
const production = process.argv.includes('--production');
const envFile = production ? '.env.production' : '.env';
const env = parseEnv(readFileSync(envFile, 'utf8'));
const directory = resolve('backups', new Date().toISOString().replaceAll(':', '-') + '-' + randomUUID().slice(0, 8));
mkdirSync(directory, { recursive: true });
const compose = ['compose', '--env-file', envFile, '-f', 'docker-compose.yml', ...(production ? ['-f', 'docker-compose.production.yml'] : [])];
const manifest = { createdAt: new Date().toISOString(), complete: false, databases: [] };
try {
  for (const name of ['users', 'orders', 'drivers', 'notifications']) {
    const container = execFileSync('docker', [...compose, 'ps', '-q', 'postgres-' + name], { encoding: 'utf8', windowsHide: true }).trim();
    if (!/^[a-f0-9]{12,64}$/.test(container)) throw new Error('PostgreSQL no está disponible: ' + name);
    const child = spawn('docker', ['exec', container, 'pg_dump', '-U', env.POSTGRES_USER, '-Fc', name + '_db'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const completed = new Promise((done, fail) => { child.once('error', fail); child.once('exit', code => code === 0 ? done() : fail(new Error('pg_dump falló para ' + name))); });
    child.stderr.resume();
    await Promise.all([pipeline(child.stdout, createWriteStream(resolve(directory, name + '.dump'), { flags: 'wx', mode: 0o600 })), completed]);
    manifest.databases.push({ service: name, file: name + '.dump', format: 'PostgreSQL custom' });
  }
  manifest.complete = true;
} finally { writeFileSync(resolve(directory, 'manifest.json'), JSON.stringify(manifest, null, 2), { mode: 0o600 }); }
console.log('Copia local creada: ' + directory + '. Contiene datos privados; cifra y copia a tu almacenamiento de respaldo. No se borró ni modificó ningún registro.');
