import { createRequire } from 'node:module';
import { readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require = createRequire(realpathSync(new URL('../apps/web/node_modules/next/package.json', import.meta.url)));
const sharp = require('sharp');
const source = readFileSync(new URL('../assets/brand/mark.svg', import.meta.url), 'utf8');
for (const [name, background, accent, ink] of [['client', '#0B2139', '#F9B600', '#0B2139'], ['driver', '#063C2B', '#24B47E', '#FFFFFF']]) {
  const input = Buffer.from(source.replaceAll('#F9B600', accent).replaceAll('#0B2139', ink));
  await sharp(input).png().toFile(fileURLToPath(new URL('../assets/brand/' + name + '-foreground.png', import.meta.url)));
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background } }).composite([{ input }]).png().toFile(fileURLToPath(new URL('../assets/brand/' + name + '-icon.png', import.meta.url)));
}
console.log('Iconos originales DeliverEats generados desde el SVG del repositorio.');
