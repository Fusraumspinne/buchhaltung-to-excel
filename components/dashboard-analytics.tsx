import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KassenbuchEntry } from "@/lib/types";

type RangeKey = "week" | "month" | "year" | "all";
type BucketMode = "day" | "month";

interface DashboardAnalyticsProps {
  rows: KassenbuchEntry[];
}

interface Bucket {
  label: string;
  key: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
  bookings: number;
}

interface DatedRow extends KassenbuchEntry {
  date: Date;
  day: Date;
}

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: "week", label: "Woche" },
  { key: "month", label: "Monat" },
  { key: "year", label: "Jahr" },
  { key: "all", label: "Gesamt" },
];

function parseDateInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function daysBetween(start: Date, end: Date) {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

function formatShortCurrency(value: number) {
  return value.toLocaleString("de-DE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPeriodDate(date: Date) {
  return date.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function bucketLabel(date: Date, mode: BucketMode, range: RangeKey, hasMultipleYears: boolean) {
  if (mode === "month") {
    return date.toLocaleDateString("de-DE", {
      month: "short",
      ...(range === "all" || hasMultipleYears ? { year: "2-digit" } : {}),
    });
  }

  if (range === "week") {
    return date.toLocaleDateString("de-DE", { weekday: "short" });
  }

  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

function getDatedRows(rows: KassenbuchEntry[]): DatedRow[] {
  return rows
    .map((row) => {
      const date = parseDateInput(row.datum);
      return date ? { ...row, date, day: startOfDay(date) } : null;
    })
    .filter((row): row is DatedRow => row !== null)
    .sort((a, b) => a.day.getTime() - b.day.getTime() || a.id - b.id);
}

function getRangeBounds(range: RangeKey, datedRows: DatedRow[]) {
  const now = startOfDay(new Date());

  if (range === "all") {
    if (datedRows.length === 0) return null;
    return {
      start: datedRows[0].day,
      end: datedRows[datedRows.length - 1].day,
    };
  }

  if (range === "year") {
    return {
      start: new Date(now.getFullYear(), now.getMonth() - 11, 1),
      end: now,
    };
  }

  const days = range === "week" ? 7 : 30;
  const start = new Date(now);
  start.setDate(now.getDate() - (days - 1));

  return { start, end: now };
}

function buildBuckets(range: RangeKey, start: Date, end: Date): Array<{ key: string; date: Date; label: string }> {
  const mode: BucketMode =
    range === "year" || (range === "all" && daysBetween(start, end) > 45)
      ? "month"
      : "day";
  const buckets: Array<{ key: string; date: Date; label: string }> = [];
  const hasMultipleYears = start.getFullYear() !== end.getFullYear();

  if (mode === "month") {
    const cursor = startOfMonth(start);
    const finalMonth = startOfMonth(end);

    while (cursor <= finalMonth) {
      buckets.push({
        key: monthKey(cursor),
        date: new Date(cursor),
        label: bucketLabel(cursor, mode, range, hasMultipleYears),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }

    return buckets;
  }

  const cursor = startOfDay(start);
  const finalDay = startOfDay(end);

  while (cursor <= finalDay) {
    buckets.push({
      key: dayKey(cursor),
      date: new Date(cursor),
      label: bucketLabel(cursor, mode, range, hasMultipleYears),
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return buckets;
}

function keyForDate(date: Date, bucketKeySet: Set<string>) {
  const exactDay = dayKey(date);
  if (bucketKeySet.has(exactDay)) return exactDay;
  return monthKey(date);
}

export function DashboardAnalytics({ rows }: DashboardAnalyticsProps) {
  const [range, setRange] = useState<RangeKey>("week");

  const datedRows = useMemo(() => getDatedRows(rows), [rows]);

  const analytics = useMemo(() => {
    const bounds = getRangeBounds(range, datedRows);
    if (!bounds) {
      return {
        chartData: [] as Bucket[],
        selectedRows: [] as DatedRow[],
        periodLabel: "",
      };
    }

    const bucketSeeds = buildBuckets(range, bounds.start, bounds.end);
    const bucketIndex = new Map<string, Bucket>();
    const bucketKeySet = new Set(bucketSeeds.map((bucket) => bucket.key));
    const chartData: Bucket[] = bucketSeeds.map((bucket) => {
      const next = {
        key: bucket.key,
        label: bucket.label,
        income: 0,
        expense: 0,
        net: 0,
        balance: 0,
        bookings: 0,
      };
      bucketIndex.set(bucket.key, next);
      return next;
    });

    const selectedRows = datedRows.filter(
      (row) => row.day >= startOfDay(bounds.start) && row.day <= startOfDay(bounds.end)
    );

    selectedRows.forEach((row) => {
      const bucket = bucketIndex.get(keyForDate(row.day, bucketKeySet));
      if (!bucket) return;
      bucket.income += row.einnahmen;
      bucket.expense += row.ausgaben;
      bucket.net += row.einnahmen - row.ausgaben;
      bucket.bookings += 1;
    });

    let runningBalance = datedRows
      .filter((row) => row.day < startOfDay(bounds.start))
      .reduce((sum, row) => sum + row.einnahmen - row.ausgaben, 0);

    chartData.forEach((bucket) => {
      runningBalance += bucket.net;
      bucket.balance = runningBalance;
    });

    return {
      chartData,
      selectedRows,
      periodLabel: `${formatPeriodDate(bounds.start)} bis ${formatPeriodDate(bounds.end)}`,
    };
  }, [datedRows, range]);

  const breakdown = useMemo(() => {
    const totalIncome = analytics.selectedRows.reduce((sum, row) => sum + row.einnahmen, 0);
    const totalExpense = analytics.selectedRows.reduce((sum, row) => sum + row.ausgaben, 0);
    const cashflowPie = [
      { name: "Einnahmen", value: totalIncome, fill: "#16a34a" },
      { name: "Ausgaben", value: totalExpense, fill: "#dc2626" },
    ].filter((entry) => entry.value > 0);

    return { cashflowPie };
  }, [analytics.selectedRows]);

  const meta = useMemo(() => {
    const daysWithMovement = analytics.chartData.filter(
      (item) => item.income !== 0 || item.expense !== 0
    ).length;

    return analytics.chartData.reduce(
      (acc, bucket) => {
        acc.maxFlow = Math.max(acc.maxFlow, bucket.income, bucket.expense);
        acc.maxNetAbs = Math.max(acc.maxNetAbs, Math.abs(bucket.balance));
        return acc;
      },
      {
        maxFlow: 0,
        maxNetAbs: 0,
        daysWithMovement,
        bookings: analytics.selectedRows.length,
      }
    );
  }, [analytics.chartData, analytics.selectedRows.length]);

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
              Analyse Dashboard
            </h2>
            {analytics.periodLabel && (
              <div className="mt-1 text-[11px] font-medium text-slate-400">
                {analytics.periodLabel} · {meta.bookings} Buchungen · {meta.daysWithMovement} aktive Abschnitte
              </div>
            )}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setRange(option.key)}
                className={`flex-1 rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer sm:flex-none ${
                  range === option.key
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasRows ? (
        <div className="rounded border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
          Keine Daten vorhanden. Füge zuerst Einträge im Kassenbuch hinzu.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Kontostand-Verlauf
              </div>
              <div className="h-48 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatShortCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value) => [`${formatMoney(Number(value ?? 0))} EUR`, "Kontostand"]}
                      labelClassName="text-xs"
                      contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1", fontSize: 12 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      stroke="#0f172a"
                      strokeWidth={2}
                      dot={{ r: 2, fill: "#0f172a" }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Einnahmen vs Ausgaben
              </div>
              <div className="h-48 sm:h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }} barGap={4}>
                    <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis
                      tick={{ fontSize: 11, fill: "#64748b" }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(value) => formatShortCurrency(Number(value))}
                    />
                    <Tooltip
                      formatter={(value, name) => [
                        `${formatMoney(Number(value ?? 0))} EUR`,
                        String(name) === "income" ? "Einnahmen" : "Ausgaben",
                      ]}
                      labelClassName="text-xs"
                      contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1", fontSize: 12 }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: "#64748b" }}
                      formatter={(value) => (value === "income" ? "Einnahmen" : "Ausgaben")}
                    />
                    <Bar dataKey="income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" fill="#dc2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Einnahmen / Ausgaben
              </div>
              <div className="h-56">
                {breakdown.cashflowPie.length === 0 ? (
                  <EmptyChart message="Keine Einnahmen oder Ausgaben im gewählten Zeitraum." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={breakdown.cashflowPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={44}
                        outerRadius={76}
                        paddingAngle={2}
                      >
                        {breakdown.cashflowPie.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [
                          `${formatMoney(Number(value ?? 0))} EUR`,
                          String(name),
                        ]}
                        contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#64748b" }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="rounded border border-slate-200 bg-white p-3 sm:p-4">
              <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                Buchungen
              </div>
              <div className="h-48 sm:h-52">
                {analytics.selectedRows.length === 0 ? (
                  <EmptyChart message="Keine Buchungen im gewählten Zeitraum." />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analytics.chartData}
                      margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
                      barGap={4}
                    >
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "#64748b" }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip
                        formatter={(value) => [`${Number(value ?? 0)} Buchungen`, "Anzahl"]}
                        labelClassName="text-xs"
                        contentStyle={{ borderRadius: 8, borderColor: "#cbd5e1", fontSize: 12 }}
                      />
                      <Bar dataKey="bookings" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded border border-dashed border-slate-200 text-center text-xs text-slate-400">
      {message}
    </div>
  );
}
