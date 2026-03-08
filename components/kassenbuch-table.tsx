import { KassenbuchEntry } from "@/lib/types";

interface KassenbuchTableProps {
  rows: KassenbuchEntry[];
}

export function KassenbuchTable({ rows }: KassenbuchTableProps) {
  return (
    <div className="bg-white border-t border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              <th className="px-4 py-3 w-28">Typ</th>
              <th className="px-4 py-3 w-28 text-right">Einnahmen</th>
              <th className="px-4 py-3 w-28 text-right">Ausgaben</th>
              <th className="px-4 py-3 w-28 text-right">Saldo</th>
              <th className="px-4 py-3 w-40">Geprueft von</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-xs text-slate-400 text-center">
                  Noch keine Einträge vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.typ}-${row.id}`} className="hover:bg-slate-50/40 transition-colors">
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">#{row.id}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.datum}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.typ}</td>
                  <td className="px-4 py-3 text-xs text-right text-green-600 font-medium">
                    {row.einnahmen > 0 ? row.einnahmen.toFixed(2) : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs text-right text-red-600 font-medium">
                    {row.ausgaben > 0 ? row.ausgaben.toFixed(2) : "-"}
                  </td>
                  <td className={`px-4 py-3 text-xs text-right font-bold ${row.saldo >= 0 ? 'text-slate-800' : 'text-red-700'}`}>
                    {row.saldo.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-600">{row.geprueftVon || "-"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
