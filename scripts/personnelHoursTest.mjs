import { build } from "esbuild";
import assert from "node:assert/strict";
const result = await build({
  entryPoints: ["src/features/personnel/hours.ts"],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const h = await import(
  "data:text/javascript;base64," +
    Buffer.from(result.outputFiles[0].text).toString("base64")
);
const period = h.getPeriod("2026-09-11", "monthly");
const people = [
  { id: "mary", name: "Marysleidis", contractHoursPerWeek: 20 },
  { id: "helena", name: "Helena", contractHoursPerWeek: 20 },
  { id: "bernardo", name: "Bernardo", contractHoursPerWeek: 0 },
];
const contracts = people.map((p, i) => ({
  id: i,
  cleaner_id: p.id,
  hours_per_week: p.contractHoursPerWeek,
  effective_date: "2026-08-01",
  is_baseline: true,
}));
const data = {
  tasks: [],
  contracts,
  schedules: [],
  adjustments: [],
  executions: new Set(),
};
const calculate = (d = data, now = "2026-09-11T12:00:00") =>
  h.calculateHours(people, d, period, now);
assert.ok(Math.abs(calculate()[0].target - 86.9) < 1e-9);
assert.equal(calculate()[2].target, 0);
const task = {
  id: "SC",
  property: "Hotel SC",
  date: "2026-09-11",
  start_time: "09:30",
  end_time: "14:00",
  duracion: 270,
  status: "pending",
  cleaner_id: "bernardo",
  task_assignments: [
    { cleaner_id: "mary" },
    { cleaner_id: "mary" },
    { cleaner_id: "helena" },
  ],
};
const assigned = {
  ...data,
  tasks: [task, { ...task, id: "cancelled", status: "cancelled" }],
};
assert.equal(calculate(assigned)[0].future, 4.5);
assert.equal(calculate(assigned)[0].elapsed, 0);
assert.equal(calculate(assigned)[1].future, 4.5);
assert.equal(calculate(assigned)[2].total, 0);
assert.equal(calculate(assigned, "2026-09-11T14:00:00")[0].elapsed, 4.5);
assert.equal(
  calculate(assigned, "2026-09-11T14:00:00")[0].total,
  calculate(assigned)[0].total,
);
const version = (id, who, source, date, payload) => ({
  id,
  cleaner_id: who,
  source_type: source,
  source_id: payload.id,
  effective_date: date,
  payload,
  is_baseline: false,
});
const external = {
  id: "external",
  is_active: true,
  schedule_type: "unavailability",
  days_of_week: [0, 1, 2, 3, 4, 5, 6],
  start_time: "14:45",
  end_time: "23:00",
};
const recurring = {
  id: "r-sc",
  is_active: true,
  days_of_week: [5],
  frequency: "weekly",
  start_date: "2026-09-11",
  end_date: "2026-09-11",
  start_time: "09:30",
  end_time: "14:00",
  property: "Hotel SC",
};
const schedules = [
  version(1, "mary", "maintenance", "2026-08-01", external),
  version(2, "helena", "maintenance", "2026-08-01", {
    ...external,
    id: "morning",
    start_time: "07:00",
    end_time: "14:45",
  }),
  version(3, "helena", "maintenance", "2026-08-01", {
    ...external,
    id: "evening",
    start_time: "18:00",
    end_time: "23:00",
  }),
  version(4, "mary", "recurring", "2026-08-01", recurring),
];
const dedup = {
  ...assigned,
  schedules,
  executions: new Set(["r-sc_2026-09-11"]),
};
assert.equal(calculate(dedup)[0].total, 4.5);
assert.equal(calculate(dedup)[0].lines.length, 1);
assert.equal(calculate(dedup)[1].total, 4.5);
assert.equal(calculate({ ...data, schedules })[0].total, 4.5);
const maintenance = {
  id: "real-maintenance",
  is_active: true,
  schedule_type: "maintenance",
  days_of_week: [5],
  start_time: "08:00",
  end_time: "09:00",
};
assert.equal(
  calculate({
    ...data,
    schedules: [version(5, "mary", "maintenance", "2026-09-01", maintenance)],
  })[0].total,
  4,
);
const history = [
  version(5, "mary", "maintenance", "2026-09-01", maintenance),
  version(6, "mary", "maintenance", "2026-09-19", {
    ...maintenance,
    end_time: "10:00",
  }),
];
assert.equal(calculate({ ...data, schedules: history })[0].total, 5);
const adj = {
  id: "a",
  cleaner_id: "mary",
  date: "2026-09-11",
  hours: -0.25,
  category: "correction",
  reason: "Corrección",
};
const adjusted = calculate({ ...dedup, adjustments: [adj] })[0];
assert.equal(adjusted.total, 4.25);
assert.equal(
  adjusted.lines.reduce((s, l) => s + l.minutes, 0) / 60,
  adjusted.total,
);
const change = {
  id: 10,
  cleaner_id: "mary",
  effective_date: "2026-09-16",
  hours_per_week: 40,
  is_baseline: false,
};
assert.ok(
  Math.abs(
    calculate({ ...data, contracts: [...contracts, change] })[0].target -
      130.35,
  ) < 1e-9,
);
const past = h.calculateHours(
  people,
  { ...data, contracts: [{ ...contracts[0], effective_date: "2026-09-11" }] },
  h.getPeriod("2026-08-01", "monthly"),
  "2026-09-11T12:00:00",
)[0];
assert.equal(past.target, null);
assert.equal(past.incomplete, true);
const baseline = calculate({
  ...data,
  contracts: [{ ...contracts[0], effective_date: "2026-09-11" }],
})[0];
assert.equal(baseline.reference, true);
assert.ok(Math.abs(baseline.target - 86.9) < 1e-9);
const invalid = calculate({
  ...data,
  tasks: [{ ...task, duracion: null, start_time: "", end_time: "" }],
})[0];
assert.equal(invalid.total, 0);
assert.equal(invalid.issues, 1);
assert.equal(
  h.madridNow(new Date("2026-09-10T22:15:00Z")),
  "2026-09-11T00:15:00",
);
assert.equal(
  h.madridNow(new Date("2026-01-10T23:15:00Z")),
  "2026-01-11T00:15:00",
);
assert.equal(h.getPeriod("2026-09-13", "weekly").from, "2026-09-07");
assert.ok(
  h.csvText([['=HYPERLINK("x")', "Mary; name", 4.25]]).includes("'=HYPERLINK"),
);
console.log(
  "Personnel hours: contract factor, 0h, assignment owners, cancellation, cutoff, shared work, recurring deduplication, external work, schedule versions, adjustments, weighted contract history, missing history, invalid duration, Madrid and CSV passed.",
);
const pageBuild = await build({
  entryPoints: ["src/features/personnel/pagination.ts"],
  bundle: true,
  format: "esm",
  write: false,
  platform: "node",
});
const { allPages } = await import(
  "data:text/javascript;base64," +
    Buffer.from(pageBuild.outputFiles[0].text).toString("base64")
);
const records = Array.from({ length: 1207 }, (_, id) => ({ id }));
const pages = await allPages((start, end) =>
  Promise.resolve({ data: records.slice(start, end + 1), error: null }),
);
assert.equal(pages.length, 1207);
assert.deepEqual(pages, records);
await assert.rejects(
  () =>
    allPages((start, end) =>
      Promise.resolve(
        start
          ? { data: null, error: { message: "Connection lost" } }
          : { data: records.slice(start, end + 1), error: null },
      ),
    ),
  /Connection lost/,
);
console.log(
  "Pagination: all 1,207 rows loaded; later-page failure rejects partial totals.",
);
