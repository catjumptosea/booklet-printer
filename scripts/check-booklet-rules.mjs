// Rule checks for the booklet planner: padding parity between formats and a
// complete, duplicate-free slot mapping for every printed side.
import { buildBookletPlan } from '../src/lib/booklet.js';

let failures = 0;

for (let pageCount = 0; pageCount <= 80; pageCount += 1) {
  const a5 = buildBookletPlan(pageCount, undefined, 'a5');
  const a6 = buildBookletPlan(pageCount, undefined, 'a6');

  if (a5.blankCount !== a6.blankCount || a5.total !== a6.total) {
    console.log(`PADDING PARITY FAIL pages=${pageCount} a5=${a5.blankCount} a6=${a6.blankCount}`);
    failures += 1;
  }

  for (const plan of [a5, a6]) {
    if (plan.total % 4 !== 0) {
      console.log(`NOT MULTIPLE OF 4 format=${plan.format} pages=${pageCount} total=${plan.total}`);
      failures += 1;
    }

    const seen = new Map();
    for (const sheet of plan.plan) {
      for (const side of ['front', 'back']) {
        for (const key of Object.keys(sheet[side])) {
          const slot = sheet[side][key];
          if (!slot) {
            console.log(`UNDEFINED SLOT format=${plan.format} pages=${pageCount} side=${sheet.index}/${side}/${key}`);
            failures += 1;
            continue;
          }
          // 'outside' is the unused half of the last A4 side and carries no
          // booklet page. 'page' and 'blank' both occupy a booklet page number.
          if (slot.kind !== 'page' && slot.kind !== 'blank') continue;
          seen.set(slot.bookletPage, (seen.get(slot.bookletPage) ?? 0) + 1);
        }
      }
    }

    if (seen.size !== plan.total) {
      console.log(`MISSING PAGES format=${plan.format} pages=${pageCount} seen=${seen.size} total=${plan.total}`);
      failures += 1;
    }
    const duplicated = [...seen.entries()].filter(([, count]) => count !== 1);
    if (duplicated.length) {
      console.log(`DUPLICATE PAGES format=${plan.format} pages=${pageCount}`, duplicated);
      failures += 1;
    }
  }
}

console.log(failures === 0 ? 'ALL RULE CASES PASS' : `FAILURES ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
