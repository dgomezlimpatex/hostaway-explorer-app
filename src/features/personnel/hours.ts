export type PeriodMode = "monthly" | "weekly";
export interface Period {
  from: string;
  to: string;
  mode: PeriodMode;
}
export interface Person {
  id: string;
  name: string;
  contractHoursPerWeek?: number | null;
  isActive?: boolean;
}
export interface ContractVersion {
  id: number;
  cleaner_id: string;
  hours_per_week: number;
  effective_date: string;
  is_baseline: boolean;
  changed_at?: string;
  changed_by?: string;
}
export interface SchedulePayload {
  id: string;
  cleaner_id?: string;
  is_active: boolean;
  schedule_type?: string;
  days_of_week?: number[];
  start_time?: string;
  end_time?: string;
  duracion?: number;
  location_name?: string;
  name?: string;
  property?: string;
  start_date?: string;
  end_date?: string;
  frequency?: string;
  day_of_month?: number;
}
export interface ScheduleVersion {
  id: number;
  cleaner_id: string;
  source_type: "maintenance" | "recurring";
  source_id: string;
  effective_date: string;
  payload: SchedulePayload;
  is_baseline: boolean;
}
export interface AssignedTask {
  id: string;
  cleaner_id?: string;
  task_assignments?: { cleaner_id: string }[];
  property: string;
  date: string;
  start_time?: string;
  end_time?: string;
  duracion?: number;
  status: string;
  type?: string;
}
export interface Adjustment {
  id: string;
  cleaner_id: string;
  date: string;
  hours: number;
  reason: string;
  category: string;
  notes?: string;
  created_by?: string;
}
export interface HoursData {
  tasks: AssignedTask[];
  contracts: ContractVersion[];
  schedules: ScheduleVersion[];
  adjustments: Adjustment[];
  executions: Set<string>;
}
export type LinePhase = "elapsed" | "future" | "adjustment";
export interface HoursLine {
  id: string;
  cleanerId: string;
  date: string;
  label: string;
  source: "task" | "maintenance" | "recurring" | "adjustment";
  sourceId: string;
  start?: string;
  end?: string;
  minutes: number;
  phase: LinePhase;
  status: string;
  issue?: string;
  inProgress?: boolean;
}
export interface HoursSummary {
  person: Person;
  lines: HoursLine[];
  elapsed: number;
  future: number;
  adjustments: number;
  total: number;
  target: number | null;
  balance: number | null;
  reference: boolean;
  incomplete: boolean;
  issues: number;
}
export const madridNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}`;
};
export const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (from: string, to: string) => {
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  return days;
};
export const getPeriod = (date: string, mode: PeriodMode): Period => {
  const safe =
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !Number.isNaN(Date.parse(`${date}T12:00:00Z`))
      ? date
      : madridNow().slice(0, 10);
  if (mode === "weekly") {
    const dow = new Date(`${safe}T12:00:00Z`).getUTCDay();
    const from = addDays(safe, -((dow + 6) % 7));
    return { from, to: addDays(from, 6), mode };
  }
  const from = safe.slice(0, 7) + "-01";
  const d = new Date(`${from}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { from, to: addDays(d.toISOString().slice(0, 10), -1), mode };
};
export const shiftPeriod = (p: Period, n: number) =>
  p.mode === "weekly"
    ? addDays(p.from, 7 * n)
    : (() => {
        const d = new Date(`${p.from}T12:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + n);
        return d.toISOString().slice(0, 10);
      })();
export const hoursText = (h: number | null) =>
  h === null
    ? "—"
    : `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 2 }).format(h)} h`;
export const dateText = (date: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Madrid",
  }).format(new Date(`${date}T12:00:00Z`));
export const periodText = (p: Period) =>
  p.mode === "monthly"
    ? new Intl.DateTimeFormat("es-ES", {
        month: "long",
        year: "numeric",
        timeZone: "Europe/Madrid",
      }).format(new Date(`${p.from}T12:00:00Z`))
    : `${dateText(p.from)} – ${dateText(p.to)} ${p.to.slice(0, 4)}`;
const timeMinutes = (value?: string) =>
  value && /^\d{2}:\d{2}/.test(value)
    ? Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
    : NaN;
const occurrence = (
  base: Omit<HoursLine, "minutes" | "phase">,
  duration: number | undefined,
  now: string,
): HoursLine => {
  const start = timeMinutes(base.start),
    end = timeMinutes(base.end);
  const interval =
    Number.isFinite(start) && Number.isFinite(end)
      ? end - start + (end < start ? 1440 : 0)
      : NaN;
  const minutes =
    Number.isFinite(Number(duration)) && Number(duration) > 0
      ? Number(duration)
      : interval > 0
        ? interval
        : 0;
  const endMinute = Number.isFinite(end)
    ? end + (Number.isFinite(start) && end < start ? 1440 : 0)
    : Number.isFinite(start) && minutes > 0
      ? start + minutes
      : NaN;
  const endKey = Number.isFinite(endMinute)
    ? `${addDays(base.date, Math.floor(endMinute / 1440))}T${String(Math.floor((endMinute % 1440) / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}:00`
    : `${base.date}T23:59:59`;
  return {
    ...base,
    minutes,
    phase: endKey <= now ? "elapsed" : "future",
    inProgress:
      !!base.start &&
      `${base.date}T${base.start.slice(0, 5)}:00` <= now &&
      endKey > now,
    issue:
      minutes <= 0
        ? "Sin duración válida"
        : !Number.isFinite(endMinute)
          ? "Sin horario de fin; revisar el corte diario"
          : undefined,
  };
};
export const calculateHours = (
  people: Person[],
  data: HoursData,
  period: Period,
  now = madridNow(),
): HoursSummary[] => {
  const days = daysBetween(period.from, period.to),
    wanted = new Set(people.map((p) => p.id));
  const lines = new Map(people.map((p) => [p.id, [] as HoursLine[]]));
  for (const task of data.tasks) {
    if (
      ["cancelled", "canceled"].includes(task.status) ||
      task.date < period.from ||
      task.date > period.to
    )
      continue;
    const owners = task.task_assignments?.length
      ? task.task_assignments.map((a) => a.cleaner_id)
      : task.cleaner_id
        ? [task.cleaner_id]
        : [];
    for (const id of new Set(owners))
      if (wanted.has(id))
        lines.get(id)!.push(
          occurrence(
            {
              id: `task:${task.id}:${id}`,
              cleanerId: id,
              date: task.date,
              label: task.property,
              source: "task",
              sourceId: task.id,
              start: task.start_time,
              end: task.end_time,
              status: task.status,
            },
            task.duracion,
            now,
          ),
        );
  }
  const groups = new Map<string, ScheduleVersion[]>();
  for (const v of data.schedules)
    if (wanted.has(v.cleaner_id)) {
      const key = `${v.cleaner_id}:${v.source_type}:${v.source_id}`;
      groups.set(key, [...(groups.get(key) || []), v]);
    }
  for (const versions of groups.values()) {
    versions.sort(
      (a, b) => a.effective_date.localeCompare(b.effective_date) || a.id - b.id,
    );
    let cursor = -1;
    for (const date of days) {
      while (
        cursor + 1 < versions.length &&
        versions[cursor + 1].effective_date <= date
      )
        cursor++;
      if (cursor < 0) continue;
      const v = versions[cursor],
        s = v.payload,
        dow = new Date(`${date}T12:00:00Z`).getUTCDay();
      if (!s.is_active || s.schedule_type === "unavailability") continue;
      if (v.source_type === "maintenance" && !s.days_of_week?.includes(dow))
        continue;
      if (v.source_type === "recurring") {
        if (
          (s.start_date && date < s.start_date) ||
          (s.end_date && date > s.end_date) ||
          data.executions.has(`${v.source_id}_${date}`)
        )
          continue;
        if (s.frequency === "weekly" && !s.days_of_week?.includes(dow))
          continue;
        if (
          s.frequency === "monthly" &&
          s.day_of_month !== Number(date.slice(8))
        )
          continue;
        if (!["daily", "weekly", "monthly"].includes(s.frequency || ""))
          continue;
      }
      lines.get(v.cleaner_id)!.push(
        occurrence(
          {
            id: `${v.source_type}:${v.source_id}:${date}:${v.cleaner_id}`,
            cleanerId: v.cleaner_id,
            date,
            label:
              s.location_name || s.property || s.name || "Tarea recurrente",
            source: v.source_type,
            sourceId: v.source_id,
            start: s.start_time,
            end: s.end_time,
            status: "scheduled",
          },
          s.duracion,
          now,
        ),
      );
    }
  }
  for (const a of data.adjustments)
    if (
      wanted.has(a.cleaner_id) &&
      a.date >= period.from &&
      a.date <= period.to
    )
      lines.get(a.cleaner_id)!.push({
        id: `adjustment:${a.id}`,
        cleanerId: a.cleaner_id,
        date: a.date,
        label: a.reason,
        source: "adjustment",
        sourceId: a.id,
        minutes: Number(a.hours) * 60,
        phase: "adjustment",
        status: a.category,
      });
  return people.map((person) => {
    const entries = lines
      .get(person.id)!
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) ||
          (a.start || "").localeCompare(b.start || ""),
      );
    const sum = (phase: LinePhase) =>
      entries
        .filter((e) => e.phase === phase)
        .reduce((s, e) => s + e.minutes, 0) / 60;
    const versions = data.contracts
      .filter((v) => v.cleaner_id === person.id)
      .sort(
        (a, b) =>
          a.effective_date.localeCompare(b.effective_date) || a.id - b.id,
      );
    let target: number | null = 0,
      reference = false;
    for (const day of days) {
      let v = versions.filter((v) => v.effective_date <= day).slice(-1)[0];
      if (!v) {
        const baseline = versions[0];
        if (
          baseline?.is_baseline &&
          period.from <= now.slice(0, 10) &&
          period.to >= now.slice(0, 10) &&
          baseline.effective_date <= period.to
        ) {
          v = baseline;
          reference = true;
        } else {
          target = null;
          break;
        }
      }
      const daysInMonth = Number(getPeriod(day, "monthly").to.slice(8));
      target +=
        Number(v.hours_per_week) *
        (period.mode === "monthly" ? 4.345 / daysInMonth : 1 / 7);
    }
    const elapsed = sum("elapsed"),
      future = sum("future"),
      adjustments = sum("adjustment"),
      total = elapsed + future + adjustments;
    const trackingStart = versions.find((v) => v.is_baseline)?.effective_date;
    const incomplete =
      target === null ||
      reference ||
      !!(trackingStart && period.from < trackingStart);
    return {
      person,
      lines: entries,
      elapsed,
      future,
      adjustments,
      total,
      target,
      balance: target === null ? null : total - target,
      reference,
      incomplete,
      issues: entries.filter((e) => e.issue).length,
    };
  });
};
export const csvText = (rows: (string | number | null)[][]) =>
  "\uFEFF" +
  rows
    .map((row) =>
      row
        .map((cell) => {
          const value = String(cell ?? "");
          return (
            '"' +
            (typeof cell === "string" && /^[=+\-@\t\r]/.test(value)
              ? "'" + value
              : value
            ).replace(/"/g, '""') +
            '"'
          );
        })
        .join(";"),
    )
    .join("\r\n");
export const downloadCSV = (
  name: string,
  rows: (string | number | null)[][],
) => {
  const url = URL.createObjectURL(
    new Blob([csvText(rows)], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
