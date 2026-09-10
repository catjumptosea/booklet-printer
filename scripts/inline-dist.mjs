import { readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const distRoot = resolve('dist');
const htmlPath = resolve(distRoot, 'index.html');
let html = await readFile(htmlPath, 'utf8');

const scriptMatch = html.match(/<script[^>]+src="([^"]+)"[^>]*><\/script>/i);
const styleMatch = html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/i);

if (!scriptMatch || !styleMatch) {
  throw new Error('Unable to find the generated JavaScript or CSS asset.');
}

const scriptPath = resolve(distRoot, scriptMatch[1].replace(/^\.\//, ''));
const stylePath = resolve(distRoot, styleMatch[1].replace(/^\.\//, ''));
const script = (await readFile(scriptPath, 'utf8')).replace(/<\/script/gi, '<\\/script');
const style = (await readFile(stylePath, 'utf8')).replace(/<\/style/gi, '<\\/style');

html = html
  .replace(scriptMatch[0], () => `<script type="module">${script}</script>`)
  .replace(styleMatch[0], () => `<style>${style}</style>`);

await writeFile(htmlPath, html, 'utf8');

const entries = await readdir(distRoot, { withFileTypes: true });
for (const entry of entries) {
  if (entry.name !== 'index.html') {
    await rm(resolve(distRoot, entry.name), { recursive: true, force: true });
  }
}

console.log('Created standalone dist/index.html');
