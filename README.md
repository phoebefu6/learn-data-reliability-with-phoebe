# Learn Data Reliability with Phoebe

Fourteen sessions on the promise, the budget and the people on call for a data pipeline. Not detection, which the observability course owns, and not traces, which the AI observability course owns: this is service-level indicators for partitions, targets set from history rather than hope, error budgets that buy decisions, alerting that pages once per incident, and the runbooks, backfills and postmortems that make a rota survivable.

**Live:** https://phoebefu6.github.io/learn-data-reliability-with-phoebe/

Two tracks. **Leader, 6 sessions, no SQL:** a promise with a number, error budgets, on-call as a design, postmortems that change something, backfills as reliability work, reporting upward. **Builder, 8 sessions:** one pipeline measured, promised, alerted, documented and replayed.

- `assets/rel-live.js` holds the **on-call bench**. Harborlight's orders pipeline lands 24 hourly partitions a night for 30 nights, 720 events, 35 bad in five incidents. You pick the SLO target and the alert policy; the engine computes the budget, how it burns, when it runs out, and every page decision. "Actionable" is defined mechanically as the first page inside a real incident. Nothing is modelled.
- **What the history supports:** 95.14 percent. At **95 percent** the budget ends with 3 percent left. At **97** it is exhausted on night 15, at **99** on night 9, and at **99.9 percent** - the current p50 night promised for every night - on **night 4**.
- **Two policies, same five incidents caught:** paging on every bad partition gives **35 pages, 8.2 a week, 14 percent actionable**. Multi-window burn-rate alerting gives **5 pages, 1.2 a week, 100 percent actionable**, one at the first bad hour of each incident.
- **The lesson in the matrix:** the target decides the budget and the policy decides the pages. Changing one never moves the other, which is why tightening an SLO to quiet a pager has never once worked.
- **Sources read at the primary:** the SRE book chapter on SLOs (SLI, SLO, SLA, error budgets, "don't pick based on current performance") and the SRE workbook chapter on implementing SLOs (specification versus implementation; freshness, correctness and coverage as the data-processing menu).
- Running artifact: a **reliability contract** for one pipeline at Harborlight, a fictional marketplace.
- Full source map, verification tiers and frozen canon: `materials/official-course-map.md`

by Phoebe Fu
