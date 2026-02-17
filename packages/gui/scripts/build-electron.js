#!/usr/bin/env node
/**
 * Build Electron main process using esbuild
 */

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  try {
    // Build main process
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../electron/main.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../dist/electron/main.js'),
      format: 'esm',
      sourcemap: true,
      external: ['electron', 'electron-squirrel-startup'],
      banner: {
        js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
      },
    });

    // Build preload script
    await esbuild.build({
      entryPoints: [path.join(__dirname, '../electron/preload.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '../dist/electron/preload.js'),
      format: 'esm',
      sourcemap: true,
      external: ['electron'],
    });

    console.log('✅ Electron main process built successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();
