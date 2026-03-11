"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import {
  SheetConfig,
  SheetCategory,
  ColumnConfig,
  ColumnType,
  SHEET_COLORS,
  CATEGORY_LABELS,
  COLUMN_TYPE_LABELS,
  createId,
  createGesamtbetragColumn,
} from "@/lib/types";

interface SheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: SheetConfig) => void;
  onDelete?: () => void;
  initialConfig?: SheetConfig;
}

export function SheetConfigModal({
  isOpen,
  onClose,
  onSave,
  onDelete,
  initialConfig,
}: SheetConfigModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<SheetCategory>("einnahmen");
  const [color, setColor] = useState(SHEET_COLORS[0]);
  const [columns, setColumns] = useState<ColumnConfig[]>([]);

  useEffect(() => {
    if (isOpen) {
      if (initialConfig) {
        setName(initialConfig.name);
        setCategory(initialConfig.category);
        setColor(initialConfig.color);
        setColumns(initialConfig.columns.filter((c) => !c.required));
      } else {
        setName("");
        setCategory("einnahmen");
        setColor(SHEET_COLORS[0]);
        setColumns([]);
      }
    }
  }, [isOpen, initialConfig]);

  if (!isOpen) return null;

  const needsGesamtbetrag = category === "einnahmen" || category === "ausgaben";

  const addColumn = () => {
    setColumns((prev) => [
      ...prev,
      { id: createId("col"), title: "", type: "text" },
    ]);
  };

  const removeColumn = (colId: string) => {
    setColumns((prev) => prev.filter((c) => c.id !== colId));
  };

  const updateColumn = (colId: string, updates: Partial<ColumnConfig>) => {
    setColumns((prev) =>
      prev.map((c) => (c.id === colId ? { ...c, ...updates } : c))
    );
  };

  const handleSave = () => {
    if (!name.trim()) return;

    const allColumns: ColumnConfig[] = [];
    if (needsGesamtbetrag) {
      allColumns.push(createGesamtbetragColumn());
    }
    allColumns.push(
      ...columns
        .filter((c) => c.title.trim())
        .map((c) => ({
          ...c,
        }))
    );

    const config: SheetConfig = {
      id: initialConfig?.id || createId("sheet"),
      name: name.trim(),
      category,
      color,
      columns: allColumns,
    };

    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-100 p-4 sm:p-5">
          <h3 className="text-base font-bold text-slate-900">
            {initialConfig ? "Sheet bearbeiten" : "Neues Sheet erstellen"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Darlehen, Rechnungen, Inventar..."
              className="w-full rounded border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Kategorie
            </label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(CATEGORY_LABELS) as [SheetCategory, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`rounded border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      category === key
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Farbe
            </label>
            <div className="flex flex-wrap gap-2">
              {SHEET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-all cursor-pointer ${
                    color === c ? "border-slate-900 scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Spalten
            </label>

            <div className="space-y-2">
              <div className="rounded border border-slate-100 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-400">
                <span className="font-bold text-slate-500">Standardfelder:</span> ID, Datum
                {needsGesamtbetrag && (
                  <span>
                    , Gesamtbetrag
                  </span>
                )}
              </div>

              {columns.map((col) => (
                <div
                  key={col.id}
                  className="rounded border border-slate-200 bg-white p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => updateColumn(col.id, { title: e.target.value })}
                      placeholder="Spaltenname"
                      className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400 transition-colors"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => {
                        const newType = e.target.value as ColumnType;
                        updateColumn(col.id, {
                          type: newType,
                        });
                      }}
                      className="rounded border border-slate-200 px-2 py-1.5 text-xs outline-none focus:border-slate-400 cursor-pointer bg-white"
                    >
                      {(Object.entries(COLUMN_TYPE_LABELS) as [ColumnType, string][]).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                    <button
                      onClick={() => removeColumn(col.id)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                onClick={addColumn}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-all cursor-pointer pt-1"
              >
                <div className="bg-slate-100 hover:bg-slate-200 p-1 rounded transition-colors">
                  <Plus className="w-3 h-3" />
                </div>
                Spalte hinzufügen
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {onDelete && initialConfig && (
              <button
                onClick={() => {
                  onDelete();
                  onClose();
                }}
                className="text-xs font-bold text-red-500 hover:text-red-700 transition-colors cursor-pointer"
              >
                Sheet löschen
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Abbrechen
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim()}
              className="rounded-lg bg-slate-900 px-6 py-2 text-sm font-medium text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
            >
              Speichern
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
