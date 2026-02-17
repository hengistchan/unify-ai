#!/usr/bin/env node

/**
 * Post-build script to fix ESM imports
 * Adds .js extensions to relative imports for Node.js ESM compatibility
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { glob } from 'glob';
import { dirname, join } from 'path';

async function fixEsmImports() {
  const files = await glob('dist/**/*.js');
  let totalFixed = 0;

  for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;
    const fileDir = dirname(file);

    // Fix relative imports without extensions
    // Matches: from './xxx' or from '../xxx' but not './xxx.js'
    content = content.replace(
      /(from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, prefix, importPath, suffix) => {
        // Skip if already has an extension
        if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
          return match;
        }

        // Resolve the full path
        const fullPath = join(fileDir, importPath);

        // Check if it's a directory (should add /index.js)
        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          modified = true;
          return `${prefix}${importPath}/index.js${suffix}`;
        }

        // Check if it's a file (should add .js)
        if (existsSync(`${fullPath}.js`)) {
          modified = true;
          return `${prefix}${importPath}.js${suffix}`;
        }

        // Default to treating as directory (common pattern)
        modified = true;
        return `${prefix}${importPath}/index.js${suffix}`;
      }
    );

    // Also fix export statements
    content = content.replace(
      /(export\s+\*\s+from\s+['"])(\.\.?\/[^'"]+)(['"])/g,
      (match, prefix, importPath, suffix) => {
        if (importPath.endsWith('.js') || importPath.endsWith('.json')) {
          return match;
        }

        const fullPath = join(fileDir, importPath);

        if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
          modified = true;
          return `${prefix}${importPath}/index.js${suffix}`;
        }

        if (existsSync(`${fullPath}.js`)) {
          modified = true;
          return `${prefix}${importPath}.js${suffix}`;
        }

        modified = true;
        return `${prefix}${importPath}/index.js${suffix}`;
      }
    );

    if (modified) {
      writeFileSync(file, content);
      console.log(`Fixed: ${file}`);
      totalFixed++;
    }
  }

  console.log(`Processed ${files.length} files, fixed ${totalFixed}`);
}

fixEsmImports().catch(console.error);
