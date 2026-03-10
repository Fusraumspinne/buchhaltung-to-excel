import { AusgabenEntry } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";

interface AusgabenTableProps {
  rows: AusgabenEntry[];
  globalMaxId: number;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, field: keyof AusgabenEntry, value: string | number) => void;
}

export function AusgabenTable({ rows, globalMaxId: _globalMaxId, onAdd, onRemove, onUpdate }: AusgabenTableProps) {
  return (
    <div className="bg-white border-t border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              <th className="px-4 py-3">Ausgabe</th>
              <th className="px-4 py-3 w-28 text-right">Gesamtbetrag</th>
              <th className="px-4 py-3">Beschreibung</th>
              <th className="px-4 py-3 w-44">Geprüft von</th>
              <th className="px-4 py-3 w-10 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              return (
              <tr key={row.id} className="group hover:bg-slate-50/40 transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-slate-600">#{row.id}</td>
                <td className="px-2 py-2">
                  <input
                    type="date"
                    value={row.datum}
                    onChange={(e) => onUpdate(row.id, "datum", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={row.ausgabe}
                    placeholder="Ausgabe"
                    onChange={(e) => onUpdate(row.id, "ausgabe", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2 text-right">
                  <input
                    type="number"
                    step="0.01"
                    value={row.preis === 0 ? "" : row.preis}
                    placeholder="0.00"
                    onChange={(e) => onUpdate(row.id, "preis", e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-20 bg-transparent p-1 text-xs text-right border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={row.beschreibung}
                    placeholder="Beschreibung"
                    onChange={(e) => onUpdate(row.id, "beschreibung", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2">
                  <input
                    type="text"
                    value={row.geprueftVon}
                    placeholder="Prüfer"
                    onChange={(e) => onUpdate(row.id, "geprueftVon", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => onRemove(row.id)}
                    className="p-1 text-slate-300 transition-all cursor-pointer hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-start px-4 py-4 bg-slate-50/30 border-t border-slate-100">
        <button
          onClick={onAdd}
          className="group flex items-center gap-1.5 text-slate-400 hover:text-slate-900 text-[10px] font-black uppercase tracking-widest outline-none transition-all cursor-pointer"
        >
          <div className="bg-slate-100 group-hover:bg-slate-200 p-1 rounded transition-colors">
            <Plus className="w-3 h-3" />
          </div>
          Hinzufügen
        </button>
      </div>
    </div>
  );
}
