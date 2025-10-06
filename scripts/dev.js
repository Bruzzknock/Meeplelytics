#!/usr/bin/env node
import { spawn } from 'node:child_process';

const processes = [
  spawn('npm', ['--workspace', 'server', 'run', 'dev'], { stdio: 'inherit' }),
  spawn('npm', ['--workspace', 'web', 'run', 'dev'], { stdio: 'inherit' })
];

processes.forEach((child) => {
  child.on('exit', (code) => {
    if (code !== 0) {
      processes.forEach((proc) => proc.kill());
      process.exit(code ?? 1);
    }
  });
});

process.on('SIGINT', () => {
  processes.forEach((child) => child.kill('SIGINT'));
  process.exit(0);
});
