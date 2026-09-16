import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');
const service = existsSync('services/users-service/package.json') ? resolve('services/users-service') : process.cwd();
const require = createRequire(resolve(service, 'package.json'));
const { PrismaClient } = require(existsSync(resolve(service, 'src/generated/prisma/index.js')) ? './src/generated/prisma' : './dist/generated/prisma');
const { hash } = require('bcrypt');
const configuredDatabase = process.env.DATABASE_URL || process.env.USERS_DATABASE_URL;
if (!configuredDatabase) throw new Error('Configura USERS_DATABASE_URL; no se utilizan credenciales predeterminadas.');
let hidden = false;
const output = new Writable({ write(chunk, _encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
const rl = createInterface({ input: process.stdin, output, terminal: Boolean(process.stdin.isTTY) });
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ? configuredDatabase : configuredDatabase.replace('postgres-users:5432', 'localhost:5433') } } });
try {
  if (!process.stdin.isTTY) throw new Error('Ejecuta admin:create desde una terminal interactiva.');
  const firstName = (await rl.question('Nombres: ')).trim();
  const lastName = (await rl.question('Apellidos: ')).trim();
  const email = (await rl.question('Correo del administrador: ')).trim().toLowerCase();
  process.stdout.write('Contraseña (mín. 12 caracteres, mayúscula, minúscula, número y símbolo): ');
  hidden = true;
  const password = await rl.question('');
  hidden = false;
  process.stdout.write('\nConfirmar contraseña: ');
  hidden = true;
  const confirmation = await rl.question('');
  hidden = false;
  process.stdout.write('\n');
  if (firstName.length < 2 || lastName.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Nombre o correo inválidos.');
  if (password !== confirmation || password.length < 12 || Buffer.byteLength(password) > 72 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^\w\s]/.test(password)) throw new Error('Contraseña débil o confirmación distinta.');
  if (await prisma.user.findUnique({ where: { email } })) throw new Error('El correo ya existe. Este comando no sobrescribe cuentas.');
  const passwordHash = await hash(password, 12);
  const created = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: { firstName, lastName, email, passwordHash, role: 'ADMIN', emailVerifiedAt: new Date() } });
    await tx.auditLog.create({ data: { actorUserId: user.id, action: 'ADMIN_BOOTSTRAPPED', entity: 'User', entityId: user.id, metadata: { source: 'interactive-cli' } } });
    return user.id;
  });
  process.stdout.write(`Administrador creado: ${created}\n`);
} catch (error) { process.stderr.write(`${error instanceof Error && !('code' in error) ? error.message : 'No se pudo crear el administrador; revisa la conexión y disponibilidad del correo.'}\n`); process.exitCode = 1; }
finally { hidden = false; rl.close(); await prisma.$disconnect(); }
