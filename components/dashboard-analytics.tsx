import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { KassenbuchEntry } from "@/lib/types";

type RangeKey = "week" | "month" | "year";

interface DashboardAnalyticsProps {
  rows: KassenbuchEntry[];
}

interface Bucket {
  label: string;
  income: number;
  expense: number;
  net: number;
  balance: number;
}

const rangeOptions: Array<{ key: RangeKey; label: string }> = [
  { key: "week", label: "Woche" },
  { key: "month", label: "Monat" },
  { key: "year", label: "Jahr" },
];

function parseDateInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatShortCurrency(value: number) {
  return value.toLocaleString("de-DE", {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  });
}

function formatMoney(value: number) {
  return value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function DashboardAnalytics({ rows }: DashboardAnalyticsProps) {
  const [range, setRange] = useState<RangeKey>("week");

  const chartData = useMemo(() => {
    const now = new Date();

    if (range === "year") {
      const buckets: Bucket[] = [];
      const monthKeys: string[] = [];

      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthKeys.push(key);
        buckets.push({
          label: d.toLocaleDateString("de-DE", { month: "short" }),
          income: 0,
          expense: 0,
          net: 0,
          balance: 0,
        });
      }

      const monthIndex = new Map<string, number>();
      monthKeys.forEach((key, index) => monthIndex.set(key, index));

      rows.forEach((row) => {
        const d = parseDateInput(row.datum);
        if (!d) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const idx = monthIndex.get(key);
        if (idx === undefined) return;

        buckets[idx].income += row.einnahmen;
        buckets[idx].expense += row.ausgaben;
        buckets[idx].net += row.einnahmen - row.ausgaben;
      });

      let runningBalance = 0;
      rows
        .map((row) => ({ date: parseDateInput(row.datum), change: row.einnahmen - row.ausgaben }))
        .filter((item): item is { date: Date; change: number } => item.date !== null)
        .forEach((item) => {
          const key = `${item.date.getFullYear()}-${String(item.date.getMonth() + 1).padStart(2, "0")}`;
          if (!monthIndex.has(key)) {
            runningBalance += item.change;
          }
        });

      buckets.forEach((bucket) => {
        runningBalance += bucket.net;
        bucket.balance = runningBalance;
      });

      return buckets;
    }

    const days = range === "week" ? 7 : 30;
    const end = startOfDay(now);
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1));

    const buckets: Bucket[] = [];
    const dayKeys: string[] = [];

    for (let i = 0; i < days; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      dayKeys.push(key);
      buckets.push({
        label:
          range === "week"
            ? d.toLocaleDateString("de-DE", { weekday: "short" })
            : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
        income: 0,
        expense: 0,
        net: 0,
        balance: 0,
      });
    }

    const dayIndex = new Map<string, number>();
    dayKeys.forEach((key, index) => dayIndex.set(key, index));

    rows.forEach((row) => {
      const d = parseDateInput(row.datum);
      if (!d) return;
      const day = startOfDay(d);
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
      const idx = dayIndex.get(key);
      if (idx === undefined) return;

      buckets[idx].income += row.einnahmen;
      buckets[idx].expense += row.ausgaben;
      buckets[idx].net += row.einnahmen - row.ausgaben;
    });

    let runningBalance = 0;
    rows
      .map((row) => ({ date: parseDateInput(row.datum), change: row.einnahmen - row.ausgaben }))
      .filter((item): item is { date: Date; change: number } => item.date !== null)
      .forEach((item) => {
        const day = startOfDay(item.date);
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        if (!dayIndex.has(key)) {
          runningBalance += item.change;
        }
      });

    buckets.forEach((bucket) => {
      runningBalance += bucket.net;
      bucket.balance = runningBalance;
    });

    return buckets;
  }, [rows, range]);

  const meta = useMemo(() => {
    const daysWithMovement = chartData.filter((item) => item.income !== 0 || item.expense !== 0).length;
    const bookings = rows.filter((row) => {
      const d = parseDateInput(row.datum);
      if (!d) return false;

      if (range === "year") {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        return d >= start;
      }

      const days = range === "week" ? 7 : 30;
      const end = startOfDay(new Date());
      const start = new Date(end);
      start.setDate(end.getDate() - (days - 1));
      const day = startOfDay(d);
      return day >= start && day <= end;
    }).length;

    return chartData.reduce(
      (acc, bucket) => {
        acc.maxFlow = Math.max(acc.maxFlow, bucket.income, bucket.expense);
        acc.maxNetAbs = Math.max(acc.maxNetAbs, Math.abs(bucket.balance));
        return acc;
      },
      { maxFlow: 0, maxNetAbs: 0, daysWithMovement, bookings },
    );
  }, [chartData, range, rows]);

  const hasRows = rows.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Analyse Dashboard</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {rangeOptions.map((option) => (
              <button
                key={option.key}
                onClick={() => setRange(option.key)}
                className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all border ${
                  range === option.key
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {!hasRows ? (
        <div className="bg-white border border-slate-200 rounded p-6 text-center text-xs text-slate-500">
          Keine Daten vorhanden. Füge zuerst Einträge im Kassenbuch hinzu.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="bg-white border border-slate-200 rounded p-3 sm:p-4">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Kontostand-Verlauf</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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

          <div className="bg-white border border-slate-200 rounded p-3 sm:p-4">
            <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">Einnahmen vs Ausgaben</div>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }} barGap={4}>
                  <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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
      )}
    </div>
  );
}
