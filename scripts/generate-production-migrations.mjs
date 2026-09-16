import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Generates additive migrations against the committed baseline; never accesses a database.
for (const service of ['users', 'orders', 'drivers']) {
  const cwd = resolve(`services/${service}-service`);
  const baseline = resolve(cwd, 'prisma/baseline.tmp.prisma');
  const target = resolve(cwd, 'prisma/migrations/202609060001_production_foundation');
  if (existsSync(target)) throw new Error(`Migration already exists: ${target}`);
  const schema = execFileSync('git', ['show', `HEAD:services/${service}-service/prisma/schema.prisma`], { encoding: 'utf8' });
  writeFileSync(baseline, schema);
  const sql = execFileSync(process.execPath, [resolve(cwd, 'node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-schema-datamodel', baseline, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], { cwd, encoding: 'utf8' });
  mkdirSync(target, { recursive: true });
  const backfill = service === 'orders'
    ? '\n-- Preserve existing approved businesses without approving new applications.\nUPDATE merchants SET "applicationStatus" = \'APPROVED\' WHERE "isActive" = true;\n'
    : service === 'drivers' ? '\nUPDATE driver_profiles SET "applicationStatus" = \'APPROVED\' WHERE "approvedAt" IS NOT NULL;\n' : '';
  writeFileSync(resolve(target, 'migration.sql'), sql + backfill);
  // A generated baseline is intentionally ignored and retained for reproducibility.
  process.stdout.write(`Generated ${service}: ${target}\n`);
}
