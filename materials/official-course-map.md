# Official course map - learn-data-reliability-with-phoebe

Built 2026-09-08. Hub bucket `dsec` (Data Ops & Security), difficulty tier 3. Two tracks: leader
6 x 45 min, builder 8 x 45 min.

Running artifact: a **reliability contract** for one pipeline, `orders` at **Harborlight**, a
fictional marketplace. Hourly partitions, 24 a night, 30 nights = 720 events, feeding a settlement
report somebody has to sign.

---

## The seam against sibling courses (enforced, not aspirational)

| Sibling | What it owns | What this course does instead |
|---|---|---|
| `learn-ai-observability-with-phoebe` (ai, d3) | "On-call for AI" (a5), "Alerting and SLOs" (b8), traces, spans, OTel GenAI conventions | **Tables, partitions and the people on call for them.** No trace, no span, no token anywhere. The SLO vocabulary is shared; the objects are not |
| `learn-data-observability-with-phoebe` (dsec, d1) | Detection: the five signals, thresholds learned from history, the monitor bench (caught / false pages / MTTD) | The promise, the budget and the humans. Detection is assumed; here a bad partition only has to be counted. b1 hands "how you notice" to that course by name |
| `learn-dataops-with-phoebe` (dsec, d4) | CI/CD, orchestration, DBOps, MLOps | Nothing about deployment. Backfills (b5) are operating discipline, not pipeline construction |
| `learn-data-orchestration-with-phoebe` (deng) | Scheduling, DAGs, the punctual-liar replay | The orchestrator's success flag appears once, as the SLI implementation that lied |

---

## Verified facts (with their source tier)

**Tier 1, read from the primary source.**

- **SRE book, chapter "Service Level Objectives".** An SLI is "a carefully defined quantitative
  measure of some aspect of the level of service that is provided". An SLO is "a target value or
  range of values for a service level that is measured by an SLI". An SLA is "an explicit or
  implicit contract with your users that includes consequences of meeting (or missing) the SLOs
  they contain"; "if there is no explicit consequence, then you are almost certainly looking at an
  SLO". "It's both unrealistic and undesirable to insist that SLOs will be met 100% of the time";
  allow "an error budget - a rate at which the SLOs can be missed". Target advice: don't pick
  based on current performance; keep it simple; avoid absolutes; have as few SLOs as possible;
  perfection can wait ("better to start with a loose target that you tighten"). Numeric framing:
  99 percent and 99.999 percent as "2 nines" and "5 nines"; Google Compute Engine's published
  99.95 percent as "three and a half nines".
  <https://sre.google/sre-book/service-level-objectives/>
- **SRE workbook, chapter "Implementing SLOs".** SLI *specification* ("the assessment of service
  outcome that you think matters to users, independent of how it is measured") versus SLI
  *implementation* (specification plus a way to measure it, with tradeoffs in quality, coverage
  and cost). The SLI menu: request-driven - availability, latency, quality; **data processing -
  freshness** ("the proportion of the data that was updated more recently than some time
  threshold"), **correctness** ("the proportion of records coming into the pipeline that resulted
  in the correct value coming out"), **coverage** ("the proportion of jobs that processed above
  some target amount of data"); **storage - durability** ("the proportion of records written that
  can be successfully read"). Error budget = 100 percent minus the SLO; worked example of a 99.9
  percent SLO over 3 million requests giving a budget of 3,000 errors, and one incident consuming
  13 percent of a budget. <https://sre.google/workbook/implementing-slos/>

**Tier 2, established practice.**

- Multi-window burn-rate alerting (a fast short window and a slow long window, paging on either)
  as the standard alternative to threshold paging. The specific windows and rates on the bench
  (2 h at 14.4x, 12 h at 3x) are the bench's own choices, stated as such; the workbook's
  dedicated alerting chapter is not quoted.
- Blameless postmortems, runbooks, toil measurement - taught as professional norm.

**Nothing on the b8 bench is modelled.** The 720 events and 35 failures are fixed; the budget
arithmetic and every page decision are computed. "Actionable" is defined mechanically as the
first page inside a real incident.

---

## Frozen canon - the b8 on-call bench

Computed in node from `assets/rel-live.js` before any page quoted a number. Any page citing these
must match exactly.

- **720 hourly partitions, 35 bad, achieved compliance 95.14 percent.**
- Five incidents: night 4 late load (3 bad partitions), night 9 upstream outage (14), night 15
  corrupt batch (6, on time and wrong), night 21 flapping connector (8 scattered), night 27
  partial load (4).

| SLO target | Budget (bad partitions allowed) | Budget left at night 30 | Exhausted on night |
|---|---|---|---|
| 95 percent | 36 | **3 percent** | never |
| 97 percent | 21.6 | 0 | **15** |
| 99 percent | 7.2 | 0 | **9** |
| 99.9 percent (the current p50 night, promised for every night) | 0.72 | 0 | **4** |

| Alert policy | Pages in 30 nights | Pages per week | Actionable | Incidents paged of 5 |
|---|---|---|---|---|
| No alerting | 0 | 0 | - | 0 |
| Page on every bad partition | **35** | **8.2** | 5 (**14 percent**) | 5 |
| Multi-window burn rate (rising edge, 12 h suppression) | **5** | **1.2** | 5 (**100 percent**) | 5 |

- The alert policy decides the pages; the target decides the budget. **They are separate
  levers**, and the bench shows the page counts do not move when the target does.
- Burn-rate pages land on nights 4, 9, 15, 21 and 27 - one per incident, at the first bad hour
  of each.

---

## Coverage per session

`✓` = taught to working depth. `◐` = named and handed to the session or course that owns it.

### Leader track

| Session | Covers | Depth |
|---|---|---|
| a1 A promise with a number | SLI, SLO, SLA per the SRE book; why 100 percent is the wrong target; 95.14 vs "basically 99" | ✓ |
| a2 Error budgets buy decisions | Budget as currency, 95 / 97 / 99 / 99.9 exhaustion nights from canon | ✓ |
| a3 On-call is a design, not a rota | Load, escalation, the humane version, 8.2 vs 1.2 pages a week | ✓ |
| a4 Postmortems that change something | Blameless, actions with owners, what the five incidents teach | ✓ |
| a5 Backfills and debt as reliability work | Why they belong in the budget conversation | ✓ |
| a6 Reporting reliability upward | SLO compliance, budget burn, toil; the three numbers | ✓ |
| Vendor incident tooling | Named as a category, no comparison | ◐ |

### Builder track

| Session | Covers | Depth |
|---|---|---|
| b1 SLIs for one pipeline | The data-processing menu, spec vs implementation, the partition log, 685 of 720 | ✓ |
| b2 SLOs from history, not hope | Percentiles, start loose then tighten, the four targets and their exhaustion nights | ✓ |
| b3 Error-budget arithmetic and burn-rate alerts | 100 minus SLO, fast and slow windows, rising edge, 35 vs 5 pages | ✓ |
| b4 Runbooks a tired person can follow | Structure, the first three steps, what not to include | ✓ |
| b5 Backfills without breaking downstream | Idempotency, watermarks, replay, the settlement report | ✓ |
| b6 The incident package | Timeline, impact in budget terms, actions with owners | ✓ |
| b7 Toil: measuring and buying it down | Definition, the toil budget, what to automate first | ✓ |
| b8 The on-call bench | The full matrix, both over-corrections | ✓ |
| How a bad partition gets noticed | Pointed at `learn-data-observability` | ◐ |

## Not covered, by design

- **Traces, spans and LLM service alerting.** The AI observability course.
- **Detection thresholds and monitor design.** The data observability course.
- **Pipeline construction, CI/CD, orchestration.** DataOps and orchestration courses.
- **A dedicated burn-rate alerting derivation.** The bench's windows are stated as choices.
- **Severity weighting of incidents.** Every bad partition counts the same on the bench.

## Re-verify before delivery

The SRE book and workbook are stable. If a learner's platform computes SLOs over calendar months
rather than rolling windows, b2 and b3 need a one-line note on the difference.
