import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
// Use the installed Expo Router generator (the same one used by Expo CLI), never handwritten route casts.
for (const app of ['client', 'driver']) {
  const cwd = resolve(`apps/mobile-${app}`);
  execFileSync(process.execPath, ['-e', "require('node:fs').mkdirSync('.expo/types', { recursive: true }); require('expo-router/build/typed-routes').regenerateDeclarations('.expo/types');"], { cwd, env: { ...process.env, EXPO_ROUTER_APP_ROOT: resolve(cwd, 'app') }, stdio: 'inherit' });
}
