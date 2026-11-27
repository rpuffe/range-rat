// Reviewer C: evaluate in a page of my second Edge (seat 2, port 9732). node pt10c-eval2.mjs <idPrefix> "<expr>"
import { targets, attach } from './pt10c-lib.mjs';
import { cdp } from './pt10c-lib.mjs';
const [sel, expr] = process.argv.slice(2);
const t = (await targets(9732)).find(x => x.id.startsWith(sel));
const page = await cdp(t.webSocketDebuggerUrl);
const r = await page.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
console.log(JSON.stringify(r.result.value ?? r.exceptionDetails?.text));
process.exit(0);
