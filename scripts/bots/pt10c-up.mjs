// Playtest round 10, reviewer C: bring up my own game server (RR_DEV=1) and my own headful Edge (CDP), and keep both
// alive until killed. node scripts/bots/pt10c-up.mjs <serverPort> <cdpPort> <userDataDir>
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { ROOT } from './pt10c-lib.mjs';
const [sp = '8731', cp = '9731', dir] = process.argv.slice(2);
const server = spawn(process.execPath, [join(ROOT, 'server', 'server.mjs')], { env: { ...process.env, PORT: sp, RR_DEV: '1' }, stdio: 'inherit' });
const exe = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const edge = spawn(exe, [`--remote-debugging-port=${cp}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,800', '--window-position=0,0',
  '--autoplay-policy=no-user-gesture-required', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
const bye = () => { try { edge.kill(); } catch {} try { server.kill(); } catch {} process.exit(0); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
server.on('exit', c => { console.log('server exit', c); });
setInterval(() => {}, 1 << 30);
