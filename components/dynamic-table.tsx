import { SheetCellValue, SheetConfig, SheetRow, CATEGORY_LABELS } from "@/lib/types";
import {
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  Settings,
  Trash2,
  Unlock,
} from "lucide-react";

interface DynamicTableProps {
  config: SheetConfig;
  rows: SheetRow[];
  allRows: SheetRow[];
  onAdd: () => void;
  onRemove: (id: number) => void;
  onMove: (id: number, direction: "up" | "down") => void;
  onToggleLock: (id: number, locked: boolean) => void;
  onUpdate: (rowId: number, field: string, value: SheetCellValue) => void;
  onConfigure: () => void;
}

export function DynamicTable({
  config,
  rows,
  allRows,
  onAdd,
  onRemove,
  onMove,
  onToggleLock,
  onUpdate,
  onConfigure,
}: DynamicTableProps) {
  const categoryLabel = CATEGORY_LABELS[config.category];

  const totals = config.columns.reduce((acc, col) => {
    if (col.type === "number") {
      acc[col.id] = allRows.reduce((sum, row) => {
        const val = Number(row[col.id]) || 0;
        return sum + val;
      }, 0);
    }
    return acc;
  }, {} as Record<string, number>);

  const hasAnyTotal = Object.values(totals).some((val) => val > 0);

  return (
    <div className="min-w-0 overflow-hidden border-t border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/30 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 max-w-full truncate text-[10px] font-black uppercase tracking-widest text-slate-500">
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
          className="flex items-center gap-1 self-start text-[10px] font-bold uppercase tracking-wider text-slate-400 transition-colors hover:text-slate-600 cursor-pointer sm:self-auto"
        >
          <Settings className="w-3.5 h-3.5" /> Konfigurieren
        </button>
      </div>

      <div className="overflow-x-auto overscroll-x-contain">
        <table className="w-full border-collapse" style={{ minWidth: `${Math.max(640, 160 + config.columns.length * 160)}px` }}>
          <thead>
            <tr className="bg-slate-50/80 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
              <th className="px-4 py-3 w-28">ID</th>
              <th className="px-4 py-3 w-32">Datum</th>
              {config.columns.map((col) => (
                <th key={col.id} className={`px-4 py-3 ${columnClass(col.type)}`}>
                  {col.title}
                  {col.required && (
                    <span className="ml-1 text-[8px] text-slate-300">*</span>
                  )}
                </th>
              ))}
              <th className="px-4 py-3 w-20 text-center" />
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
              rows.map((row) => {
                const isLocked = Boolean(row._locked);
                const rowIndex = allRows.findIndex((entry) => entry._id === row._id);
                const canMoveUp = rowIndex > 0;
                const canMoveDown = rowIndex >= 0 && rowIndex < allRows.length - 1;

                return (
                  <tr
                    key={row._id}
                    className={`group transition-colors ${
                      isLocked
                        ? "bg-slate-50/60 text-slate-400"
                        : "hover:bg-slate-50/40"
                    }`}
                  >
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">
                      <div className="flex items-center gap-2">
                        <span className="min-w-10">#{row._id}</span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => onMove(row._id, "up")}
                            disabled={!canMoveUp}
                            title="Eintrag nach oben verschieben"
                            className="rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 cursor-pointer"
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onMove(row._id, "down")}
                            disabled={!canMoveDown}
                            title="Eintrag nach unten verschieben"
                            className="rounded p-0.5 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 cursor-pointer"
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="date"
                        value={row._datum}
                        disabled={isLocked}
                        onChange={(e) => onUpdate(row._id, "_datum", e.target.value)}
                        className="w-full rounded border border-transparent bg-transparent p-1 text-xs outline-none focus:border-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                      />
                    </td>
                    {config.columns.map((col) => (
                      <td
                        key={col.id}
                        className={`px-2 py-2 ${cellClass(col.type)}`}
                      >
                        {renderCellInput(col, row, onUpdate, isLocked)}
                      </td>
                    ))}
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onRemove(row._id)}
                          disabled={isLocked}
                          title={isLocked ? "Zum Löschen erst entsperren" : "Eintrag löschen"}
                          className="p-1 text-slate-300 transition-all hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:text-slate-300 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onToggleLock(row._id, !isLocked)}
                          title={isLocked ? "Eintrag entsperren" : "Eintrag sperren"}
                          className={`p-1 transition-all cursor-pointer ${
                            isLocked
                              ? "text-slate-700 hover:text-slate-900"
                              : "text-slate-300 hover:text-slate-600"
                          }`}
                        >
                          {isLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Unlock className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
            {rows.length > 0 && hasAnyTotal && (
              <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-100">
                <td className="px-4 py-3 text-xs text-slate-500 italic">
                  GESAMT
                </td>
                <td className="px-4 py-3" />
                {config.columns.map((col) => (
                  <td
                    key={`total-${col.id}`}
                    className={`px-4 py-3 text-xs ${col.type === "number" ? "text-right text-slate-900" : ""}`}
                  >
                    {col.type === "number" ? totals[col.id].toFixed(2) : ""}
                  </td>
                ))}
                <td className="px-4 py-3" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-start border-t border-slate-100 bg-slate-50/30 px-3 py-4 sm:px-4">
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
  onUpdate: (rowId: number, field: string, value: SheetCellValue) => void,
  isLocked: boolean
) {
  const value = row[col.id];

  switch (col.type) {
    case "number":
      const numberValue = typeof value === "number" || typeof value === "string" ? value : "";
      return (
        <input
          type="number"
          step="0.01"
          value={numberValue === 0 || numberValue === "" ? "" : numberValue}
          placeholder="0.00"
          disabled={isLocked}
          onChange={(e) =>
            onUpdate(
              row._id,
              col.id,
              e.target.value === "" ? 0 : Number(e.target.value)
            )
          }
          className="w-24 rounded border border-transparent bg-transparent p-1 text-right text-xs outline-none focus:border-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
        />
      );

    case "boolean":
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          disabled={isLocked}
          onChange={(e) => onUpdate(row._id, col.id, e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-slate-900 accent-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        />
      );

    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          disabled={isLocked}
          onChange={(e) => onUpdate(row._id, col.id, e.target.value)}
          className="w-full rounded border border-transparent bg-transparent p-1 text-xs outline-none focus:border-slate-100 cursor-pointer disabled:cursor-not-allowed disabled:text-slate-400"
        />
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          placeholder={col.title}
          disabled={isLocked}
          onChange={(e) => onUpdate(row._id, col.id, e.target.value)}
          className="w-full bg-transparent p-1 text-xs border border-transparent focus:border-slate-100 rounded outline-none disabled:cursor-not-allowed disabled:text-slate-400"
        />
      );
  }
}

function columnClass(type: SheetConfig["columns"][number]["type"]) {
  if (type === "number") return "w-32 text-right";
  if (type === "boolean") return "w-28 text-center";
  if (type === "date") return "w-36";
  return "";
}

function cellClass(type: SheetConfig["columns"][number]["type"]) {
  if (type === "number") return "text-right";
  if (type === "boolean") return "text-center";
  return "";
}
