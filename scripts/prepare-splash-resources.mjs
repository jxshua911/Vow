import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const logoPath = resolve(root, 'public/vow-logo.svg');
const svg = await readFile(logoPath, 'utf8');
const viewBox = svg.match(/viewBox="([\d.\s-]+)"/)?.[1];
const paths = [...svg.matchAll(/<path\b([^>]*)\/>/g)]
  .map(([, attributes]) => attributes.match(/\bd="([^"]+)"/)?.[1])
  .filter((path) => path !== undefined);

if (!viewBox || paths.length === 0) {
  throw new Error(`Could not read splash logo paths from ${logoPath}`);
}

const [x, y, width, height] = viewBox.trim().split(/\s+/).map(Number);
if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
  throw new Error(`Invalid splash logo viewBox: ${viewBox}`);
}

for (const [directory, fillColor] of [
  ['drawable', '#FF000000'],
  ['drawable-night', '#FFFFFFFF'],
]) {
  const outputPath = resolve(root, `android/app/src/main/res/${directory}/vow_splash_logo_source.xml`);
  const pathsXml = paths.map((pathData) =>
    `    <path android:fillColor="${fillColor}" android:fillType="evenOdd" android:pathData="${pathData}" />`,
  ).join('\n');
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="256dp"\n    android:height="${(256 * height / width).toFixed(2)}dp"\n    android:viewportWidth="${width}"\n    android:viewportHeight="${height}">\n${pathsXml}\n</vector>\n`;
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, xml);
}
