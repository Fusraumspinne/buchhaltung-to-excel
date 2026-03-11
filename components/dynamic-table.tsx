import { SheetConfig, SheetRow, CATEGORY_LABELS } from "@/lib/types";
import { Plus, Settings, Trash2 } from "lucide-react";

interface DynamicTableProps {
  config: SheetConfig;
  rows: SheetRow[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onUpdate: (rowId: number, field: string, value: string | number) => void;
  onConfigure: () => void;
}

export function DynamicTable({
  config,
  rows,
  onAdd,
  onRemove,
  onUpdate,
  onConfigure,
}: DynamicTableProps) {
  const categoryLabel = CATEGORY_LABELS[config.category];

  return (
    <div className="overflow-hidden border-t border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
            {config.name}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: config.color + "18",
              color: config.color,
            }}
          >
            {categoryLabel}
          </span>
        </div>
        <button
          onClick={onConfigure}
          className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" /> Konfigurieren
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: `${Math.max(600, 120 + config.columns.length * 160)}px` }}>
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-20">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              {config.columns.map((col) => (
                <th
                  key={col.id}
                  className={`px-4 py-3 ${col.type === "number" ? "text-right w-32" : ""}`}
                >
                  {col.title}
                  {col.required && (
                    <span className="ml-1 text-[8px] text-slate-300">*</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 w-10 text-center" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={config.columns.length + 3}
                  className="px-4 py-6 text-xs text-slate-400 text-center"
                >
                  Noch keine Einträge vorhanden.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row._id}
                  className="group hover:bg-slate-50/40 transition-colors"
                >
                  <td className="px-4 py-3 text-xs font-bold text-slate-600">
                    #{row._id}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      type="date"
                      value={row._datum}
                      onChange={(e) => onUpdate(row._id, "_datum", e.target.value)}
                      className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none cursor-pointer"
                    />
                  </td>
                  {config.columns.map((col) => (
                    <td
                      key={col.id}
                      className={`px-2 py-2 ${col.type === "number" ? "text-right" : ""}`}
                    >
                      {renderCellInput(col, row, onUpdate)}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center">
                    <button
                      onClick={() => onRemove(row._id)}
                      className="p-1 text-slate-300 transition-all cursor-pointer hover:text-red-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
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

function renderCellInput(
  col: SheetConfig["columns"][number],
  row: SheetRow,
  onUpdate: (rowId: number, field: string, value: string | number) => void
) {
  const value = row[col.id];

  switch (col.type) {
    case "number":
      return (
        <input
          type="number"
          step="0.01"
          value={value === 0 || value === undefined || value === "" ? "" : value}
          placeholder="0.00"
          onChange={(e) =>
            onUpdate(
              row._id,
              col.id,
              e.target.value === "" ? 0 : Number(e.target.value)
            )
          }
          className="w-24 rounded border border-transparent bg-transparent p-1 text-right text-xs outline-none focus:border-slate-100"
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={col.title}
          onChange={(e) => onUpdate(row._id, col.id, e.target.value)}
          className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none"
        />
      );
  }
}
