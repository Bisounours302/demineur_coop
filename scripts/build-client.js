const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.join(__dirname, '..');

const targets = [
  {
    entry: path.join(ROOT, 'src', 'client', 'modes', 'mines', 'index.js'),
    outfile: path.join(ROOT, 'public', 'client.js'),
  },
  {
    entry: path.join(ROOT, 'src', 'client', 'modes', 'paint', 'index.js'),
    outfile: path.join(ROOT, 'public', 'paint-client.js'),
  },
  {
    entry: path.join(ROOT, 'src', 'client', 'modes', 'snake', 'index.js'),
    outfile: path.join(ROOT, 'public', 'snake-client.js'),
  },
];

async function buildAll() {
  await Promise.all(targets.map((target) => esbuild.build({
    entryPoints: [target.entry],
    outfile: target.outfile,
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['es2020'],
    legalComments: 'none',
    charset: 'utf8',
  })));
}

buildAll()
  .then(() => {
    console.log('Client bundles generated successfully.');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
