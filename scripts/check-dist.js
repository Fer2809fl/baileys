import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const distributionRoot = resolve('lib');

async function collectJavaScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectJavaScript(path));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(path);
    }
  }

  return files;
}

const files = await collectJavaScript(distributionRoot);
if (!files.includes(resolve(distributionRoot, 'index.js'))) {
  throw new Error('No se encontró lib/index.js. La distribución no está completa.');
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) {
    console.error(`No se pudo validar ${file}: ${result.error.message}`);
    failed++;
  } else if (result.status !== 0) {
    failed++;
  }
}

if (failed > 0) {
  console.error(`La validación falló en ${failed} archivo(s) JavaScript.`);
  process.exitCode = 1;
} else {
  console.log(`Distribución válida: ${files.length} archivos JavaScript revisados.`);
}
