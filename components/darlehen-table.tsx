import { DarlehenEntry, DarlehenKaeuferAnteil } from "@/lib/types";
import { Plus, Trash2, UserRoundPlus } from "lucide-react";

interface DarlehenTableProps {
  rows: DarlehenEntry[];
  globalMaxId: number;
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (id: number, field: "datum" | "preis" | "geprueftVon", value: string | number) => void;
  onAddKaeufer: (rowId: number) => void;
  onRemoveKaeufer: (rowId: number, anteilId: string) => void;
  onUpdateKaeufer: (
    rowId: number,
    anteilId: string,
    field: keyof Pick<DarlehenKaeuferAnteil, "kaeufer" | "anteil">,
    value: string | number,
  ) => void;
}

export function DarlehenTable({
  rows,
  globalMaxId: _globalMaxId,
  onAdd,
  onRemove,
  onUpdate,
  onAddKaeufer,
  onRemoveKaeufer,
  onUpdateKaeufer,
}: DarlehenTableProps) {
  return (
    <div className="overflow-hidden border-t border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-240 border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              <th className="min-w-84 px-4 py-3">Käufer und Anzahl</th>
              <th className="px-4 py-3 w-32 text-right">Gesamtbetrag</th>
              <th className="px-4 py-3 w-44">Geprüft von</th>
              <th className="px-4 py-3 w-10 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              return (
              <tr key={row.id} className="group hover:bg-slate-50/40 transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-slate-600 align-top">#{row.id}</td>
                <td className="px-2 py-2 align-top">
                  <input
                    type="date"
                    value={row.datum}
                    onChange={(e) => onUpdate(row.id, "datum", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="space-y-2">
                    {row.kaeuferAnteile.map((anteil) => (
                      <div key={anteil.id} className="group/anteil flex items-center gap-2">
                        <input
                          type="text"
                          value={anteil.kaeufer}
                          placeholder="Käufername"
                          onChange={(e) => onUpdateKaeufer(row.id, anteil.id, "kaeufer", e.target.value)}
                          className="min-w-38 flex-1 rounded border border-transparent bg-transparent p-1 text-xs outline-none focus:border-slate-100"
                        />
                        <div className="flex w-28 shrink-0 items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={anteil.anteil === 0 ? "" : anteil.anteil}
                            placeholder="Anteil"
                            onChange={(e) =>
                              onUpdateKaeufer(
                                row.id,
                                anteil.id,
                                "anteil",
                                e.target.value === "" ? 0 : Number(e.target.value),
                              )
                            }
                            className="w-full rounded border border-transparent bg-transparent p-1 text-right text-xs outline-none focus:border-slate-100"
                          />
                          <span className="text-[11px] text-slate-400">Anzahl</span>
                        </div>
                        <div className="w-6 flex justify-center">
                          {row.kaeuferAnteile.length > 1 && (
                            <button
                              onClick={() => onRemoveKaeufer(row.id, anteil.id)}
                              className="cursor-pointer p-1 text-slate-300 transition-all hover:text-red-500"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => onAddKaeufer(row.id)}
                        className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-all hover:text-slate-900 cursor-pointer"
                      >
                        <UserRoundPlus className="w-3.5 h-3.5" /> Käufer
                      </button>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-right align-top">
                  <input
                    type="number"
                    step="0.01"
                    value={row.preis === 0 ? "" : row.preis}
                    placeholder="0.00"
                    onChange={(e) => onUpdate(row.id, "preis", e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-24 rounded border border-transparent bg-transparent p-1 text-right text-xs outline-none focus:border-slate-100"
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <input
                    type="text"
                    value={row.geprueftVon}
                    placeholder="Prüfer"
                    onChange={(e) => onUpdate(row.id, "geprueftVon", e.target.value)}
                    className="w-full rounded border border-transparent bg-transparent p-1 text-xs outline-none focus:border-slate-100"
                  />
                </td>
                <td className="px-2 py-2 text-center align-top">
                  <button
                    onClick={() => onRemove(row.id)}
                    className="cursor-pointer p-1 text-slate-300 transition-all hover:text-red-500"
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
      <div className="flex items-center justify-start border-t border-slate-100 bg-slate-50/30 px-4 py-4">
        <button
          onClick={onAdd}
          className="group flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 outline-none transition-all hover:text-slate-900 cursor-pointer"
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
