// Reviewer C: evaluate one expression in a page target (by id prefix or index). node pt10c-eval.mjs <id|#n> "<expr>"
import { targets, attach } from './pt10c-lib.mjs';
const [sel, expr] = process.argv.slice(2);
const ts = await targets();
const t = sel.startsWith('#') ? ts[+sel.slice(1)] : ts.find(x => x.id.startsWith(sel));
const b = await attach(t.id);
console.log(JSON.stringify(await b.ev(expr, 60000), null, 1));
process.exit(0);
