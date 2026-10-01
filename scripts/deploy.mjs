// npm run deploy: build, then publish dist/ to this repo's gh-pages branch over git SSH.
// GitHub Pages serves that branch at https://buicongnguyen.github.io/game_RPG/.
import {spawnSync} from 'node:child_process';
import {cp, mkdir, readdir, rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const remote = process.env.DEPLOY_REMOTE || 'git@github.com:buicongnguyen/game_RPG.git';
const work = path.join(root, '.deploy');
const run = (cmd, args, cwd = work) => { const r = spawnSync(cmd, args, {cwd, stdio: 'inherit'}); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
const out = args => spawnSync('git', args, {cwd: work, encoding: 'utf8'}).stdout.trim();

run(process.execPath, [path.join(root, 'scripts/build.mjs')], root);
if (!existsSync(path.join(work, '.git'))) { await mkdir(work, {recursive: true}); run('git', ['init', '-q']); run('git', ['remote', 'add', 'origin', remote]); }
run('git', ['fetch', '-q', 'origin']);
if (out(['ls-remote', '--heads', 'origin', 'gh-pages'])) run('git', ['checkout', '-q', '-B', 'gh-pages', 'origin/gh-pages']);
else run('git', ['checkout', '-q', '--orphan', 'gh-pages']);
for (const e of await readdir(work)) if (e !== '.git') await rm(path.join(work, e), {recursive: true, force: true});
await cp(path.join(root, 'dist'), work, {recursive: true});
run('git', ['add', '-A']);
if (!out(['status', '--porcelain'])) { console.log('Nothing new to deploy.'); process.exit(0); }
const message = ['Deploy The Lantern Trail ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', process.env.DEPLOY_TRAILER].filter(Boolean).join('\n\n');
run('git', ['commit', '-q', '-m', message]);
run('git', ['push', '-q', 'origin', 'gh-pages']);
console.log('Pushed gh-pages. Live in a minute or two at https://buicongnguyen.github.io/game_RPG/');
