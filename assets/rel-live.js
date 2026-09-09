/* rel-live.js - the on-call bench for learn-data-reliability-with-phoebe.

   Real computation over a fixed history. Harborlight's orders pipeline lands one
   partition per hour, 24 a night, 30 nights = 720 events. Five incidents are
   injected: a late night, an upstream outage, a corrupt batch, a flapping
   connector and a partial load. The freshness-and-correctness SLI is simply
   whether each hourly partition was good. You pick an SLO target and an alerting
   policy; the engine computes the error budget, how it burns hour by hour, when
   each policy would have paged, and how many of those pages were the first page
   of a real incident rather than a repeat.

   What is real: the 720 events, the burn arithmetic, every page decision.
   Nothing is modelled about the human; "actionable" is defined mechanically as
   the first page inside an incident. Exposes window.REL_ENGINE and renders into
   [data-rel-bench]. */
(function (root) {
  "use strict";

  var NIGHTS = 30, HOURS = 24, TOTAL = NIGHTS * HOURS;

  /* incidents: night (1-based), start hour, list of bad hour offsets */
  var INCIDENTS = [
    { id: 1, night: 4,  name: "Late load",          hours: [0,1,2],
      note: "Upstream export retried twice; three partitions landed after their hour." },
    { id: 2, night: 9,  name: "Upstream outage",    hours: [0,1,2,3,4,5,6,7,8,9,10,11,12,13],
      note: "Source API down for 14 hours. Nothing you can fix from this side; everything you can communicate." },
    { id: 3, night: 15, name: "Corrupt batch",      hours: [5,6,7,8,9,10],
      note: "A currency column arrived as text for six partitions. Landed on time, wrong." },
    { id: 4, night: 21, name: "Flapping connector", hours: [1,4,7,11,14,18,21,23],
      note: "Eight scattered bad partitions across one night. No single failure, no clean start or end." },
    { id: 5, night: 27, name: "Partial load",       hours: [2,3,4,5],
      note: "One of three shards missing for four hours." }
  ];

  /* 720 events, each { night, hour, good, incident } */
  var EVENTS = (function () {
    var out = [];
    for (var n = 1; n <= NIGHTS; n++) {
      for (var h = 0; h < HOURS; h++) {
        var inc = null;
        INCIDENTS.forEach(function (i) { if (i.night === n && i.hours.indexOf(h) >= 0) inc = i; });
        out.push({ night: n, hour: h, idx: (n - 1) * HOURS + h, good: !inc, incident: inc });
      }
    }
    return out;
  })();
  var BAD_TOTAL = EVENTS.filter(function (e) { return !e.good; }).length;

  var SLO_OPTIONS = [
    { id: "slo_95",  target: 0.95,  label: "95 percent",   blurb: "Loose. One bad partition in twenty." },
    { id: "slo_97",  target: 0.97,  label: "97 percent",   blurb: "What the trailing quarter actually delivered, rounded up." },
    { id: "slo_99",  target: 0.99,  label: "99 percent",   blurb: "Seven bad partitions a month. Sounds reasonable in a meeting." },
    { id: "slo_999", target: 0.999, label: "99.9 percent", blurb: "The current p50 night, promised for every night. The over-correction." }
  ];

  var POLICIES = [
    { id: "none",      label: "No alerting", blurb: "Find out from the dashboard on Monday." },
    { id: "threshold", label: "Page on every bad partition",
      blurb: "The reflex. Every SLI breach is a page, however small." },
    { id: "burn",      label: "Multi-window burn rate",
      blurb: "Page when the budget is burning fast over a short window, or steadily over a long one. Dedupes inside an incident." }
  ];

  /* Burn-rate alerting, hourly granularity. Budget for the window is (1 - target) * TOTAL events.
     fast: 2-hour window, burn rate >= 14.4 (would exhaust a 30-day budget in ~2 days)
     slow: 12-hour window, burn rate >= 3 (would exhaust in ~10 days)
     A page is suppressed if another page fired inside the previous 6 hours. */
  function pagesFor(policy, target) {
    var budget = (1 - target) * TOTAL;           /* allowed bad events in the window */
    var budgetPerHour = budget / TOTAL;           /* allowed bad events per hour at 1x burn */
    var pages = [];
    var lastPage = -Infinity;
    var wasFiring = false;
    for (var i = 0; i < EVENTS.length; i++) {
      var e = EVENTS[i];
      var fire = false;
      if (policy === "threshold") {
        fire = !e.good;
      } else if (policy === "burn") {
        var bad2 = 0, bad12 = 0;
        for (var k = 0; k < 12 && i - k >= 0; k++) { if (!EVENTS[i - k].good) { bad12++; if (k < 2) bad2++; } }
        var rate2 = budgetPerHour > 0 ? (bad2 / 2) / budgetPerHour : Infinity;
        var rate12 = budgetPerHour > 0 ? (bad12 / 12) / budgetPerHour : Infinity;
        var condition = (bad2 > 0 && rate2 >= 14.4) || (bad12 > 0 && rate12 >= 3);
        /* page on the rising edge only, and never twice inside 12 hours: one page per incident */
        fire = condition && !wasFiring && (i - lastPage >= 12);
        wasFiring = condition;
      }
      if (fire) { pages.push(e); lastPage = i; }
    }
    return pages;
  }

  function run(sloId, policyId) {
    var slo = SLO_OPTIONS.filter(function (s) { return s.id === sloId; })[0] || SLO_OPTIONS[1];
    var budget = (1 - slo.target) * TOTAL;
    var pages = pagesFor(policyId, slo.target);

    /* budget burn by night, and the night it ran out */
    var burned = 0, exhaustedNight = null, byNight = [];
    for (var n = 1; n <= NIGHTS; n++) {
      var badTonight = EVENTS.filter(function (e) { return e.night === n && !e.good; }).length;
      burned += badTonight;
      if (exhaustedNight === null && burned > budget) exhaustedNight = n;
      byNight.push({ night: n, bad: badTonight, remaining: Math.max(0, budget - burned) });
    }
    var remainingPct = budget > 0 ? Math.max(0, (budget - burned) / budget) : 0;

    /* actionable = first page inside an incident; repeats and clean-night pages are not */
    var seen = {};
    var actionable = 0;
    pages.forEach(function (p) {
      if (p.incident && !seen[p.incident.id]) { seen[p.incident.id] = true; actionable++; }
    });
    var incidentsPaged = Object.keys(seen).length;

    return {
      slo: slo, policy: policyId, budget: budget, burned: burned, badTotal: BAD_TOTAL,
      remainingPct: remainingPct, exhaustedNight: exhaustedNight,
      pages: pages.length, pagesPerWeek: pages.length / (NIGHTS / 7),
      actionable: actionable, actionableRate: pages.length ? actionable / pages.length : 0,
      incidentsPaged: incidentsPaged, incidents: INCIDENTS.length,
      compliance: (TOTAL - burned) / TOTAL,
      byNight: byNight, pageList: pages
    };
  }

  function ladder() {
    var rows = [];
    SLO_OPTIONS.forEach(function (s) {
      POLICIES.forEach(function (p) {
        var r = run(s.id, p.id);
        rows.push({ slo: s.label, policy: p.label, remainingPct: r.remainingPct, exhaustedNight: r.exhaustedNight,
                    pagesPerWeek: r.pagesPerWeek, pages: r.pages, actionable: r.actionable, actionableRate: r.actionableRate,
                    incidentsPaged: r.incidentsPaged });
      });
    });
    return rows;
  }

  root.REL_ENGINE = { EVENTS: EVENTS, INCIDENTS: INCIDENTS, SLO_OPTIONS: SLO_OPTIONS, POLICIES: POLICIES,
                      TOTAL: TOTAL, BAD_TOTAL: BAD_TOTAL, run: run, ladder: ladder };
})(typeof window !== "undefined" ? window : globalThis);

/* ============================================================
   the widget - renders the on-call bench into [data-rel-bench]
   ============================================================ */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var E = window.REL_ENGINE; if (!E) return;
  function el(t, c, x) { var n = document.createElement(t); if (c) n.className = c; if (x !== undefined && x !== null) n.textContent = x; return n; }

  document.querySelectorAll("[data-rel-bench]").forEach(function (host) {
    var slo = "slo_97", policy = "none";
    var wrap = el("div", "wk rb-wrap");
    var head = el("div", "wk-head");
    head.appendChild(el("b", null, "The on-call bench"));
    head.appendChild(el("span", null, "Harborlight orders pipeline · 30 nights · 720 hourly partitions · 5 incidents"));
    wrap.appendChild(head);
    var body = el("div", "wk-body");
    body.appendChild(el("p", "hb-honesty",
      "The 720 partitions and their 35 failures are fixed and identical for every learner. The budget arithmetic " +
      "and every page decision are computed here. Actionable is defined mechanically: the first page inside a real " +
      "incident. Nothing about the human is modelled."));

    var reads = el("div", "rb-reads");
    function readout(cls, label) { var b = el("div", "rb-read " + cls); var big = el("b", "rb-big", "-"); b.appendChild(big); b.appendChild(el("span", "rb-rlab", label)); reads.appendChild(b); return big; }
    var outBudget = readout("rb-r1", "error budget left at night 30");
    var outPages = readout("rb-r2", "pages per week");
    var outAct = readout("rb-r3", "of pages actionable");
    body.appendChild(reads);

    function group(title, items, current, onPick) {
      var g = el("div", "rb-group"); g.appendChild(el("span", "rb-glab", title));
      var row = el("div", "rb-opts");
      items.forEach(function (it) {
        var lab = el("label", "rb-opt" + (it.id === "slo_999" || it.id === "threshold" ? " rb-anti" : ""));
        var rb = document.createElement("input"); rb.type = "radio"; rb.name = title; rb.checked = it.id === current;
        rb.addEventListener("change", function () { onPick(it.id); paint(); });
        var t = el("span", "rb-otxt"); t.appendChild(el("b", null, it.label)); t.appendChild(el("span", "rb-oblurb", it.blurb));
        lab.appendChild(rb); lab.appendChild(t); row.appendChild(lab);
      });
      g.appendChild(row); return g;
    }
    body.appendChild(group("SLO target", E.SLO_OPTIONS, slo, function (id) { slo = id; }));
    body.appendChild(group("Alert policy", E.POLICIES, policy, function (id) { policy = id; }));

    body.appendChild(el("p", "rb-striplab", "Thirty nights. Bar height is bad partitions that night; the line is budget remaining. Hover a night."));
    var strip = el("div", "rb-strip"); body.appendChild(strip);
    var legend = el("div", "rb-legend");
    [["rb-c-quiet", "clean night"], ["rb-c-bad", "bad partitions"], ["rb-c-page", "paged"], ["rb-c-out", "budget exhausted"]].forEach(function (p) {
      var s = el("span", "rb-lg"); s.appendChild(el("i", p[0])); s.appendChild(el("span", null, p[1])); legend.appendChild(s); });
    body.appendChild(legend);
    var notes = el("div", "rb-notes"); body.appendChild(notes);
    wrap.appendChild(body);
    var foot = el("div", "wk-foot");
    foot.appendChild(el("span", null, "Five incidents: a late load, a 14-hour upstream outage, a corrupt batch, a flapping connector and a partial load."));
    wrap.appendChild(foot);
    host.appendChild(wrap);

    function paint() {
      var r = E.run(slo, policy);
      outBudget.textContent = Math.round(r.remainingPct * 100) + "%";
      outPages.textContent = r.pagesPerWeek.toFixed(1);
      outAct.textContent = r.pages ? Math.round(r.actionableRate * 100) + "%" : "-";
      strip.textContent = "";
      var pagedNights = {}; r.pageList.forEach(function (p) { pagedNights[p.night] = (pagedNights[p.night] || 0) + 1; });
      r.byNight.forEach(function (n) {
        var cell = el("div", "rb-night");
        var bar = el("i", "rb-bar " + (n.bad ? "rb-c-bad" : "rb-c-quiet")); bar.style.height = Math.max(4, n.bad * 5) + "px";
        if (r.exhaustedNight !== null && n.night >= r.exhaustedNight) cell.classList.add("rb-c-out");
        if (pagedNights[n.night]) { var dot = el("b", "rb-page", String(pagedNights[n.night])); cell.appendChild(dot); }
        cell.appendChild(bar);
        cell.appendChild(el("span", "rb-nlab", String(n.night)));
        var inc = E.INCIDENTS.filter(function (i) { return i.night === n.night; })[0];
        cell.title = "Night " + n.night + (inc ? " · " + inc.name + "\n" + inc.note : " · clean") +
          "\nbad partitions " + n.bad + " · budget left " + n.remaining.toFixed(1) + " of " + r.budget.toFixed(1) +
          (pagedNights[n.night] ? "\npages tonight: " + pagedNights[n.night] : "");
        strip.appendChild(cell);
      });
      notes.textContent = "";
      if (r.exhaustedNight !== null) notes.appendChild(el("p", "dh-verdict warn",
        "Budget exhausted on night " + r.exhaustedNight + " of 30. A " + r.slo.label + " target against a pipeline that achieved " +
        (r.compliance * 100).toFixed(2) + " percent is a promise the history says you cannot keep."));
      if (policy === "threshold") notes.appendChild(el("p", "dh-verdict warn",
        r.pages + " pages, " + r.actionable + " of them the first word of a real incident. The other " + (r.pages - r.actionable) +
        " told the on-call something they already knew."));
      if (policy === "burn" && r.actionableRate === 1) notes.appendChild(el("p", "dh-verdict",
        r.pages + " pages in 30 nights, one per incident, every one actionable. The alert policy decides the pages; the target decides the budget. They are separate levers."));
      if (policy === "none") notes.appendChild(el("p", "dh-verdict warn",
        "No pages. All five incidents were found by whoever opened the dashboard first, which is the baseline every policy is measured against."));
    }
    paint();
  });
})();
