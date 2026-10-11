#!/usr/bin/env node
/*
 * Builds the Firefox flavour of the extension into build-firefox/.
 *
 * The React app, content script and background script are shared with the
 * Chrome build; only the manifest differs, because Firefox's MV3 still runs the
 * background as an event page ("scripts") rather than a service worker, and
 * needs a browser_specific_settings.gecko.id before storage.sync will work.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'build-firefox');
const sourceManifest = path.join(root, 'public', 'manifest.firefox.json');

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

// Checked before building, not after: a dirty tree means the source archive
// could not match the package, and there is no point spending a build on it.
if (process.argv.includes('--source')) {
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  if (dirty) {
    console.error('Refusing to package source: the working tree has uncommitted changes,');
    console.error('so the source archive would not match the extension being built.\n' + dirty);
    process.exit(1);
  }
}

fs.rmSync(outDir, { recursive: true, force: true });

run('npx', ['react-app-rewired', 'build'], {
  REACT_APP_BUILD_EXTENSION: 'true',
  BUILD_PATH: 'build-firefox',
  // Keeps every script in its own file so the extension_pages CSP
  // ("script-src 'self'") never has to allow an inline bootstrap.
  INLINE_RUNTIME_CHUNK: 'false',
  // Source maps are not needed in the package: reviewers get the source itself
  // (--source below), and fewer generated files means fewer ways for their
  // rebuild to differ from ours.
  GENERATE_SOURCEMAP: 'false',
});

const manifest = JSON.parse(fs.readFileSync(sourceManifest, 'utf8'));
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

if (manifest.version !== version) {
  throw new Error(
    `Version mismatch: package.json is ${version} but public/manifest.firefox.json is ${manifest.version}.`
  );
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

// public/ carries .DS_Store files on macOS and they are copied verbatim; AMO
// flags them, so drop them from the package.
const pruneJunk = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) pruneJunk(full);
    else if (entry.name === '.DS_Store') fs.rmSync(full, { force: true });
  }
};
pruneJunk(outDir);
// The Chrome manifest and the Firefox template both land in the output because
// everything under public/ is copied verbatim; neither belongs in the package.
fs.rmSync(path.join(outDir, 'manifest.firefox.json'), { force: true });

console.log(`\nFirefox build ready in ${path.relative(root, outDir)}/`);
console.log('Load it via about:debugging#/runtime/this-firefox -> Load Temporary Add-on -> manifest.json');

if (process.argv.includes('--zip')) {
  const artifactDir = path.join(root, 'web-ext-artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const zipPath = path.join(artifactDir, `altvision-firefox-${version}.zip`);
  fs.rmSync(zipPath, { force: true });
  // -FS drops entries that no longer exist, -x keeps macOS metadata out of the
  // package so the AMO linter does not flag it.
  run('zip', ['-r', '-FS', '-q', zipPath, '.', '-x', '.DS_Store', '-x', '*/.DS_Store'], {}, outDir);
  console.log(`Signable archive: ${path.relative(root, zipPath)}`);
}

// addons.mozilla.org requires the source of any minified or bundled add-on,
// rebuilds it and diffs the result against the uploaded package. Archive
// exactly what is committed, so the reviewer builds the same tree we did.
if (process.argv.includes('--source')) {
  const artifactDir = path.join(root, 'web-ext-artifacts');
  fs.mkdirSync(artifactDir, { recursive: true });
  const srcPath = path.join(artifactDir, `altvision-firefox-${version}-source.zip`);
  fs.rmSync(srcPath, { force: true });
  run('git', ['archive', '--format=zip', '-o', srcPath, 'HEAD'], {});
  console.log(`Reviewer source archive: ${path.relative(root, srcPath)}`);
}
