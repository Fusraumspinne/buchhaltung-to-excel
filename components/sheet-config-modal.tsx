"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
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

  const moveColumn = (colId: string, direction: "up" | "down") => {
    setColumns((prev) => {
      const currentIndex = prev.findIndex((column) => column.id === colId);
      const targetIndex = currentIndex + (direction === "up" ? -1 : 1);

      if (
        currentIndex < 0 ||
        targetIndex < 0 ||
        targetIndex >= prev.length
      ) {
        return prev;
      }

      const next = [...prev];
      [next[currentIndex], next[targetIndex]] = [
        next[targetIndex],
        next[currentIndex],
      ];
      return next;
    });
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-xl border border-slate-200 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-xl">
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

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
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
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              {(Object.entries(CATEGORY_LABELS) as [SheetCategory, string][]).map(
                ([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setCategory(key)}
                    className={`rounded border px-3 py-2 text-xs font-bold transition-all cursor-pointer sm:py-1.5 ${
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
                  className={`h-8 w-8 rounded-full border-2 transition-all cursor-pointer sm:h-7 sm:w-7 ${
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

              {columns.map((col, index) => (
                <div
                  key={col.id}
                  className="space-y-2 rounded border border-slate-200 bg-white p-3"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="flex shrink-0 items-center gap-1 sm:flex-col sm:gap-0.5">
                      <button
                        onClick={() => moveColumn(col.id, "up")}
                        disabled={index === 0}
                        title="Spalte nach oben verschieben"
                        className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 cursor-pointer"
                      >
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveColumn(col.id, "down")}
                        disabled={index === columns.length - 1}
                        title="Spalte nach unten verschieben"
                        className="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-300 cursor-pointer"
                      >
                        <ChevronDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => updateColumn(col.id, { title: e.target.value })}
                      placeholder="Spaltenname"
                      className="min-w-0 flex-1 rounded border border-slate-200 px-2 py-2 text-xs outline-none transition-colors focus:border-slate-400 sm:py-1.5"
                    />
                    <select
                      value={col.type}
                      onChange={(e) => {
                        const newType = e.target.value as ColumnType;
                        updateColumn(col.id, {
                          type: newType,
                        });
                      }}
                      className="rounded border border-slate-200 bg-white px-2 py-2 text-xs outline-none transition-colors focus:border-slate-400 cursor-pointer sm:py-1.5"
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
                      className="self-start p-1 text-slate-300 transition-colors hover:text-red-500 cursor-pointer sm:self-auto"
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

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5">
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
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
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
