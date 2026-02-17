#!/usr/bin/env node
/**
 * Electron development launcher with auto-reload
 */

import { spawn } from 'child_process';
import { watch } from 'chokidar';
import electron from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let electronProcess = null;
let isRestarting = false;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
  }

  console.log('🚀 Starting Electron...');
  electronProcess = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  electronProcess.on('close', (code) => {
    if (!isRestarting && code !== 0) {
      console.log(`Electron exited with code ${code}`);
    }
  });
}

function rebuildAndRestart() {
  if (isRestarting) return;

  isRestarting = true;
  console.log('\n📦 Rebuilding Electron main process...');

  const buildProcess = spawn('node', ['build-electron.js'], {
    stdio: 'inherit',
    cwd: __dirname,
  });

  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build complete, restarting Electron...\n');
      startElectron();
    } else {
      console.log('❌ Build failed');
    }
    isRestarting = false;
  });
}

// Initial build and start
rebuildAndRestart();

// Watch for changes in electron directory
const watcher = watch(path.join(__dirname, '../electron'), {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', (filePath) => {
  console.log(`📝 File changed: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  rebuildAndRestart();
});

watcher.on('add', (filePath) => {
  console.log(`📝 File added: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  rebuildAndRestart();
});

console.log('👀 Watching for changes in electron/ directory...');
console.log('Press Ctrl+C to exit\n');

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  watcher.close();
  if (electronProcess) {
    electronProcess.kill();
  }
  process.exit(0);
});
