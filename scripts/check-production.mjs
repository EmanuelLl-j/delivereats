import { readFileSync, existsSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { productionEnvironmentIssues } = require('../packages/backend-kit/dist/environment.js');
const path = resolve(process.argv[2] ?? '.env.production');
if (!existsSync(path)) { console.error('Crea .env.production desde .env.production.example y completa los valores en tu servidor; no pegues secretos en el chat.'); process.exit(1); }
const env = parseEnv(readFileSync(path, 'utf8'));
const issues = productionEnvironmentIssues({ ...env, NODE_ENV: 'production' });
if (env.NODE_ENV !== 'production') issues.push('NODE_ENV debe ser production');
if (env.COOKIE_SECURE !== 'true') issues.push('COOKIE_SECURE debe ser true');
for (const name of ['TLS_CERTIFICATE_PATH', 'TLS_PRIVATE_KEY_PATH']) if (!env[name] || !existsSync(env[name])) issues.push(name + ': archivo de certificado no disponible en este servidor');
if (issues.length) { console.error('No listo para desplegar:\n- ' + issues.join('\n- ')); process.exitCode = 1; }
else console.log('Configuración estática de producción válida. Esto no demuestra conectividad, entrega de correo, audio ni pagos.');
for (const [service, name] of [['Firebase', 'FIREBASE_SERVICE_ACCOUNT_JSON'], ['LiveKit', 'LIVEKIT_API_SECRET'], ['Mercado Pago', 'MERCADOPAGO_ACCESS_TOKEN']]) console.log(service + ': ' + (env[name] ? 'configurado; pendiente de prueba externa' : 'pendiente de credenciales externas (función deshabilitada)'));
