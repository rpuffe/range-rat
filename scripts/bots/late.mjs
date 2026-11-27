// Council round 13 #0b: late.mjs is now a thin wrapper around late11.mjs, so old command lines still work.
// late11.mjs delivers souvenirs (JOB=1) and pings by hand, so it clears the Stadium; late.mjs used to sit there
// 80 shifts on requests 0/6 (playtest round 8, B #1). The old defaults: through endless (STOPV=99), 4 endless days.
//   node scripts/bots/late.mjs [N] [seed]     env as late11.mjs (START_FILE, SNAP_FILE, ENDLESS, AP, PINGR, ...)
process.env.STOPV ??= '99';
process.env.JOB ??= '1';
await import('./late11.mjs');
