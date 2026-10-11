#!/usr/bin/env node
/*
 * Builds the Chrome flavour of the extension into build/ and packs it into a
 * zip ready for the Chrome Web Store dashboard.
 *
 * The React app, content script and background script are shared with the
 * Firefox build; only the manifest differs, and Chrome's is already the one
 * copied verbatim out of public/, so nothing has to be written over it here.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build');

const run = (command, args, env, cwd = root) => {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    process.exit(result.status === null ? 1 : result.status);
  }
};

fs.rmSync(outDir, { recursive: true, force: true });

run('npx', ['react-app-rewired', 'build'], {
  REACT_APP_BUILD_EXTENSION: 'true',
  // Keeps every script in its own file so the extension_pages CSP
  // ("script-src 'self'") never has to allow an inline bootstrap.
  INLINE_RUNTIME_CHUNK: 'false',
  // Source maps only bloat the uploaded package.
  GENERATE_SOURCEMAP: 'false',
});

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(outDir, 'manifest.json'), 'utf8'));

if (manifest.version !== version) {
  throw new Error(
    `Version mismatch: package.json is ${version} but public/manifest.json is ${manifest.version}.`
  );
}

// public/ carries .DS_Store files on macOS and they are copied verbatim; they
// have no business in the uploaded package.
const pruneJunk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pruneJunk(full);
    else if (entry.name === '.DS_Store') fs.rmSync(full, { force: true });
  }
};
pruneJunk(outDir);
// The Firefox manifest template lands in the output because everything under
// public/ is copied verbatim; it does not belong in the Chrome package.
fs.rmSync(path.join(outDir, 'manifest.firefox.json'), { force: true });

console.log(`\nChrome build ready in ${path.relative(root, outDir)}/`);
console.log('Load it via chrome://extensions -> Developer mode -> Load unpacked');

const artifactDir = path.join(root, 'web-ext-artifacts');
fs.mkdirSync(artifactDir, { recursive: true });
const zipPath = path.join(artifactDir, `altvision-chrome-${version}.zip`);
fs.rmSync(zipPath, { force: true });
// -FS drops entries that no longer exist, -x keeps macOS metadata out of the
// package so the Web Store review does not trip over it.
run('zip', ['-r', '-FS', '-q', zipPath, '.', '-x', '.DS_Store', '-x', '*/.DS_Store'], {}, outDir);
console.log(`Uploadable archive: ${path.relative(root, zipPath)}`);
