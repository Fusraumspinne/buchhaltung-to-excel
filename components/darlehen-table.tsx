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
  globalMaxId,
  onAdd,
  onRemove,
  onUpdate,
  onAddKaeufer,
  onRemoveKaeufer,
  onUpdateKaeufer,
}: DarlehenTableProps) {
  return (
    <div className="bg-white border-t border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              <th className="px-4 py-3 min-w-85">Käufer und Anzahl</th>
              <th className="px-4 py-3 w-32 text-right">Gesamtbetrag</th>
              <th className="px-4 py-3 w-44">Geprüft von</th>
              <th className="px-4 py-3 w-10 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isEditable = row.id === globalMaxId;
              return (
              <tr key={row.id} className="hover:bg-slate-50/40 transition-colors">
                <td className="px-4 py-3 text-xs font-bold text-slate-600 align-top">#{row.id}</td>
                <td className="px-2 py-2 align-top">
                  <input
                    type="date"
                    required
                    value={row.datum}
                    disabled={!isEditable}
                    onChange={(e) => onUpdate(row.id, "datum", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2">
                  <div className="space-y-2">
                    {row.kaeuferAnteile.map((anteil) => (
                      <div key={anteil.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          value={anteil.kaeufer}
                          disabled={!isEditable}
                          placeholder="Käufername"
                          onChange={(e) => onUpdateKaeufer(row.id, anteil.id, "kaeufer", e.target.value)}
                          className="flex-1 min-w-[150px] bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                        />
                        <div className="flex items-center gap-2 w-28 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            disabled={!isEditable}
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
                            className="w-full bg-transparent p-1 text-xs text-right border border-transparent focus:border-slate-100 rounded outline-none"
                          />
                          <span className="text-[11px] text-slate-400">Anzahl</span>
                        </div>
                        <div className="w-6 flex justify-center">
                          {row.kaeuferAnteile.length > 1 && isEditable && (
                            <button
                              onClick={() => onRemoveKaeufer(row.id, anteil.id)}
                              className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      {(() => {
                        const canAddKaeufer = row.kaeuferAnteile.every(
                          (item) => item.kaeufer.trim() !== "" && item.anteil > 0,
                        );
                        if (!isEditable) return null;
                        return (
                          <button
                            onClick={() => onAddKaeufer(row.id)}
                            disabled={!canAddKaeufer}
                            className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-900 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <UserRoundPlus className="w-3.5 h-3.5" /> Käufer
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2 text-right align-top">
                  <input
                    type="number"
                    step="0.01"
                    required
                    disabled={!isEditable}
                    value={row.preis === 0 ? "" : row.preis}
                    placeholder="0.00"
                    onChange={(e) => onUpdate(row.id, "preis", e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-24 bg-transparent p-1 text-xs text-right border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2 align-top">
                  <input
                    type="text"
                    required
                    disabled={!isEditable}
                    value={row.geprueftVon}
                    placeholder="Prüfer"
                    onChange={(e) => onUpdate(row.id, "geprueftVon", e.target.value)}
                    className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
                  />
                </td>
                <td className="px-2 py-2 text-center align-top">
                  {row.id === globalMaxId && (
                    <button
                      onClick={() => onRemove(row.id)}
                      className="text-slate-300 hover:text-red-500 transition-colors p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
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
