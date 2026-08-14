#!/usr/bin/env node
// Start both Vite and Express servers using spawn (no shell, safe with & in paths)
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const targets = [
  { name: 'Vite',     cmd: 'node',  args: [join(__dirname, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5174'] },
  { name: 'Express',  cmd: 'node',  args: [join(__dirname, 'server', 'index.js')] },
];

const children = [];

for (const t of targets) {
  const child = spawn(t.cmd, t.args, {
    cwd: __dirname,
    stdio: 'inherit',
  });
  children.push({ name: t.name, child });
  child.on('exit', (code) => {
    console.log(`[${t.name}] exited with code ${code}`);
    children.forEach((c) => c.child.kill());
    process.exit(code ?? 0);
  });
}

console.log('All servers started. Press Ctrl+C to stop.\n');

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  children.forEach(({ name, child }) => {
    console.log(`Killing ${name}...`);
    child.kill();
  });
  process.exit(0);
});
