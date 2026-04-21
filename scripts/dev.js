#!/usr/bin/env node
/**
 * Script de desarrollo: levanta backend y, si existe, frontend.
 * Si frontend/school-app no existe, solo levanta el backend (evita fallo de npm run dev).
 */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const rootDir = path.join(__dirname, '..');
const frontendPath = path.join(rootDir, 'frontend', 'school-app');
const frontendExists = fs.existsSync(frontendPath) && fs.existsSync(path.join(frontendPath, 'package.json'));

const commands = ['npm run dev --prefix backend'];
const names = ['backend'];

if (frontendExists) {
  commands.push('npm run dev --prefix frontend/school-app');
  names.push('frontend');
} else {
  console.log('(frontend/school-app no encontrado: solo se inicia el backend)\n');
}

const isWindows = process.platform === 'win32';
const args = ['concurrently', '-n', names.join(','), '-c', 'blue,green', ...commands];
const child = spawn('npx', args, {
  cwd: rootDir,
  stdio: 'inherit',
  shell: isWindows
});

child.on('error', (err) => {
  console.error(err);
  process.exit(1);
});
child.on('exit', (code) => process.exit(code ?? 0));
