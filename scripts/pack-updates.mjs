import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('--- Packaging Deployment ZIPs ---');

// 1. Assets update: index.html, assets, audio-audit.html
console.log('1. Creating dist-assets-update.zip...');
const assetsTemp = 'temp-assets-zip';
if (fs.existsSync(assetsTemp)) fs.rmSync(assetsTemp, { recursive: true, force: true });
fs.mkdirSync(assetsTemp);
fs.mkdirSync(path.join(assetsTemp, 'assets'));

fs.copyFileSync('dist/index.html', path.join(assetsTemp, 'index.html'));
fs.copyFileSync('dist/audio-audit.html', path.join(assetsTemp, 'audio-audit.html'));

const assetFiles = fs.readdirSync('dist/assets');
for (const f of assetFiles) {
  fs.copyFileSync(path.join('dist/assets', f), path.join(assetsTemp, 'assets', f));
}

execSync(`powershell -Command "Compress-Archive -Path '${assetsTemp}/*' -DestinationPath 'dist-assets-update.zip' -Force"`);
fs.rmSync(assetsTemp, { recursive: true, force: true });
console.log('  ✓ dist-assets-update.zip ready');

// 2. Audio patch: newly generated clips + manifest.json
console.log('2. Creating dist-audio-patch.zip...');
const audioTemp = 'temp-audio-zip';
if (fs.existsSync(audioTemp)) fs.rmSync(audioTemp, { recursive: true, force: true });
fs.mkdirSync(audioTemp, { recursive: true });
const audioSubdir = path.join(audioTemp, 'audio', 'v1');
fs.mkdirSync(audioSubdir, { recursive: true });

fs.copyFileSync('dist/audio/v1/manifest.json', path.join(audioSubdir, 'manifest.json'));

const targetFiles = [
  'abihi.mp3',
  'ilayhi.mp3',
  '3a64d02b160ad10a.mp3',
  'bb82616784e3e672.mp3',
  '756041c85f3a5b10.mp3',
  '35c23f42b09847e2.mp3',
  '94216fdb62db3e34.mp3',
  '2d250b1d9d406130.mp3',
  '0f105889dfe779de.mp3',
  '58b8eecb84758036.mp3',
  'e316ebbe60a2dadc.mp3',
  '1ff1fc7e4c0bceb9.mp3',
  '73aad2de91c83cee.mp3',
  '374488e547311f8d.mp3',
  'bdfae00789dcc5b6.mp3',
  '95e0c8fb053cd4a3.mp3',
  '178d12ebd07d6686.mp3',
  'e1282bea9dc9b820.mp3',
  'a575f4b2ca86afef.mp3',
  '379c3b5ab0bed9e8.mp3',
  '9af4eb237f232336.mp3'
];

for (const tf of targetFiles) {
  const p = path.join('dist/audio/v1', tf);
  if (fs.existsSync(p)) {
    fs.copyFileSync(p, path.join(audioSubdir, tf));
  }
}

execSync(`powershell -Command "Compress-Archive -Path '${audioTemp}/*' -DestinationPath 'dist-audio-patch.zip' -Force"`);
fs.rmSync(audioTemp, { recursive: true, force: true });
console.log('  ✓ dist-audio-patch.zip ready');

// 3. Server update: server.js, app_wrapper.cjs, package.json
console.log('3. Creating server-update.zip...');
const serverTemp = 'temp-server-zip';
if (fs.existsSync(serverTemp)) fs.rmSync(serverTemp, { recursive: true, force: true });
fs.mkdirSync(serverTemp);

fs.copyFileSync('server.js', path.join(serverTemp, 'server.js'));
fs.copyFileSync('app_wrapper.cjs', path.join(serverTemp, 'app_wrapper.cjs'));
fs.copyFileSync('package.json', path.join(serverTemp, 'package.json'));

execSync(`powershell -Command "Compress-Archive -Path '${serverTemp}/*' -DestinationPath 'server-update.zip' -Force"`);
fs.rmSync(serverTemp, { recursive: true, force: true });
console.log('  ✓ server-update.zip ready');

console.log('--- All Packages Built Successfully! ---');
