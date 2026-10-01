// npm run build: a static site in dist/ (minified bundle, the baked art with content hashes,
// no source, no Blender kit). Works at a domain root or in a subfolder such as /game_RPG/.
import {cp, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build, transform} from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
if (path.relative(root, out) !== 'dist') throw new Error('Unexpected build directory');
await rm(out, {recursive: true, force: true});
await mkdir(path.join(out, 'js'), {recursive: true});

const result = await build({absWorkingDir: root, entryPoints: ['src/trail-main.js'], outdir: path.join(out, 'js'), bundle: true, format: 'esm', splitting: true,
  minify: true, sourcemap: false, target: 'es2022', entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]', legalComments: 'eof', metafile: true});
const entry = Object.entries(result.metafile.outputs).find(([, o]) => o.entryPoint)[0];
const html = (await readFile(path.join(root, 'index.html'), 'utf8')).replace('./src/trail-main.js', './' + path.relative(out, path.resolve(root, entry)).split(path.sep).join('/'));
await writeFile(path.join(out, 'index.html'), html);
await writeFile(path.join(out, 'style.css'), (await transform(await readFile(path.join(root, 'style.css'), 'utf8'), {loader: 'css', minify: true})).code);

// Runtime art only. The baked files keep fixed names, so the stage asks for file?v=<content hash>.
await mkdir(path.join(out, 'assets/trail'), {recursive: true});
const versions = {};
for (const file of await readdir(path.join(root, 'assets/trail'))) {
  if (file.endsWith('-preview.webp')) continue;
  const data = await readFile(path.join(root, 'assets/trail', file));
  await writeFile(path.join(out, 'assets/trail', file), data);
  versions[file] = createHash('sha256').update(data).digest('base64url').slice(0, 10);
}
const manifest = JSON.parse(await readFile(path.join(out, 'assets/trail/manifest.json'), 'utf8'));
await writeFile(path.join(out, 'assets/trail/manifest.json'), JSON.stringify({...manifest, versions}));
await cp(path.join(root, 'assets/ui'), path.join(out, 'assets/ui'), {recursive: true});
for (const f of ['fruit.webp', 'sky-lantern.webp']) await cp(path.join(root, 'assets', f), path.join(out, 'assets', f));
await writeFile(path.join(out, '.nojekyll'), '');
const {version} = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
await writeFile(path.join(out, 'build-info.json'), JSON.stringify({name: 'The Lantern Trail', version}, null, 2) + '\n');
let bytes = 0, files = 0;
async function measure(dir) { for (const e of await readdir(dir, {withFileTypes: true})) { const f = path.join(dir, e.name); if (e.isDirectory()) await measure(f); else { files++; bytes += (await stat(f)).size; } } }
await measure(out);
console.log(`Built ${files} files (${(bytes / 1048576).toFixed(2)} MiB) in dist/.`);
