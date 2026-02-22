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
let debounceTimer = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function killElectronProcess() {
  if (!electronProcess) return;

  return new Promise(resolve => {
    if (electronProcess.killed) {
      resolve();
      return;
    }

    electronProcess.once('exit', () => {
      electronProcess = null;
      resolve();
    });

    electronProcess.kill('SIGTERM');

    setTimeout(() => {
      if (electronProcess && !electronProcess.killed) {
        electronProcess.kill('SIGKILL');
      }
      electronProcess = null;
      resolve();
    }, 3000);
  });
}

async function startElectron() {
  if (electronProcess) {
    await killElectronProcess();
    await sleep(500);
  }

  console.log('🚀 Starting Electron...');
  electronProcess = spawn(electron, ['.'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  electronProcess.on('close', code => {
    if (!isRestarting && code !== 0) {
      console.log(`Electron exited with code ${code}`);
    }
  });
}

function rebuildAndRestart() {
  if (isRestarting) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(async () => {
    isRestarting = true;
    console.log('\n📦 Rebuilding Electron main process...');

    const buildProcess = spawn('node', ['build-electron.js'], {
      stdio: 'inherit',
      cwd: __dirname,
    });

    buildProcess.on('close', async code => {
      if (code === 0) {
        console.log('✅ Build complete, restarting Electron...\n');
        await startElectron();
      } else {
        console.log('❌ Build failed');
      }
      isRestarting = false;
    });
  }, 500);
}

// Initial build and start
rebuildAndRestart();

// Watch for changes in electron directory
const watcher = watch(path.join(__dirname, '../electron'), {
  ignored: /node_modules/,
  persistent: true,
  ignoreInitial: true,
});

watcher.on('change', filePath => {
  console.log(`📝 File changed: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  rebuildAndRestart();
});

watcher.on('add', filePath => {
  console.log(`📝 File added: ${path.relative(path.join(__dirname, '..'), filePath)}`);
  rebuildAndRestart();
});

console.log('👀 Watching for changes in electron/ directory...');
console.log('Press Ctrl+C to exit\n');

async function cleanup() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  await watcher.close();
  if (electronProcess) {
    await killElectronProcess();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...');
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n👋 Shutting down...');
  await cleanup();
  process.exit(0);
});
