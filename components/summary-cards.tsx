import { SheetConfig, SheetRow, GESAMTBETRAG_COLUMN_ID } from "@/lib/types";

interface SummaryCardsProps {
  sheets: SheetConfig[];
  data: Record<string, SheetRow[]>;
}

export function SummaryCards({ sheets, data }: SummaryCardsProps) {
  const totals = sheets.reduce(
    (acc, sheet) => {
      if (sheet.category === "sonstiges") return acc;
      const rows = data[sheet.id] || [];
      const sum = rows.reduce(
        (s, row) => s + (Number(row[GESAMTBETRAG_COLUMN_ID]) || 0),
        0
      );
      if (sheet.category === "einnahmen") acc.einnahmen += sum;
      else acc.ausgaben += sum;
      return acc;
    },
    { einnahmen: 0, ausgaben: 0 }
  );

  const gesamtSaldo = totals.einnahmen - totals.ausgaben;

  return (
    <div className="mb-6 sm:mb-8 space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-t border-b-2 border-slate-100 bg-slate-50/50 p-3 transition-all">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">
            Einnahmen
          </p>
          <p className="text-lg font-black text-slate-900 sm:text-xl">
            {totals.einnahmen.toFixed(2)} EUR
          </p>
        </div>
        <div className="rounded-t border-b-2 border-slate-100 bg-slate-50/50 p-3 transition-all">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">
            Ausgaben
          </p>
          <p className="text-lg font-black text-slate-900 sm:text-xl">
            {totals.ausgaben.toFixed(2)} EUR
          </p>
        </div>
        <div
          className={`rounded-t border-b-2 p-3 transition-all ${
            gesamtSaldo >= 0
              ? "bg-green-50/30 border-green-200"
              : "bg-red-50/30 border-red-200"
          }`}
        >
          <p
            className={`text-[10px] uppercase font-bold mb-1 tracking-widest ${
              gesamtSaldo >= 0 ? "text-green-600" : "text-red-600"
            }`}
          >
            Gesamt
          </p>
          <p
            className={`text-lg font-black sm:text-xl ${
              gesamtSaldo >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {gesamtSaldo.toFixed(2)} EUR
          </p>
        </div>
      </div>
    </div>
  );
}
