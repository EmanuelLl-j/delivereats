import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const action = process.argv[2];
if (!['migrate', 'seed'].includes(action)) {
  throw new Error('Uso: node scripts/run-databases.mjs <migrate|seed>');
}
if (!existsSync('.env')) {
  throw new Error('Falta .env. Copia .env.example antes de administrar las bases.');
}
process.loadEnvFile('.env');

const services = [
  ['@delivereats/users-service', 'USERS_DATABASE_URL', 'postgres-users:5432', 'localhost:5433'],
  ['@delivereats/orders-service', 'ORDERS_DATABASE_URL', 'postgres-orders:5432', 'localhost:5434'],
  [
    '@delivereats/drivers-service',
    'DRIVERS_DATABASE_URL',
    'postgres-drivers:5432',
    'localhost:5435',
  ],
  [
    '@delivereats/notifications-service',
    'NOTIFICATIONS_DATABASE_URL',
    'postgres-notifications:5432',
    'localhost:5436',
  ],
];

for (const [workspace, variable, dockerHost, localHost] of services) {
  const configured = process.env[variable];
  if (!configured) throw new Error(`Falta ${variable} en .env`);
  const databaseUrl = configured.replace(dockerHost, localHost);
  const result = spawnSync('pnpm', ['--filter', workspace, `db:${action}`], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl },
    shell: process.platform === 'win32',
  });
  if (result.error) console.error(result.error);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
