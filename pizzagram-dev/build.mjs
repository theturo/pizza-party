// Impacchetta l'SDK Firebase in un unico modulo servito dal sito (CSP: script-src 'self').
import { build } from 'esbuild';

await build({
  entryPoints: ['src/firebase-entry.js'],
  outfile: '../pizzagram/vendor/firebase.js',
  bundle: true,
  format: 'esm',
  minify: true,
  target: ['es2020', 'safari15'],
  legalComments: 'linked',
  logLevel: 'info'
});
