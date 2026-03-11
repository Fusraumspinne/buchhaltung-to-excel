import { SheetConfig } from "@/lib/types";
import { Plus } from "lucide-react";

interface NavigationTabsProps {
  activeTab: string;
  sheets: SheetConfig[];
  onChange: (tab: string) => void;
  onAddSheet: () => void;
}

export function NavigationTabs({ activeTab, sheets, onChange, onAddSheet }: NavigationTabsProps) {
  return (
    <div className="mb-5 sm:mb-6">
      <div className="-mx-1 overflow-x-auto px-1 pb-3">
        <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "kassenbuch", label: "Kassenbuch" },
          ].map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onChange(tab.key)}
                className={`shrink-0 rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200"
                    : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}

          {sheets.map((sheet) => {
            const isActive = activeTab === sheet.id;
            return (
              <button
                key={sheet.id}
                onClick={() => onChange(sheet.id)}
                className={`shrink-0 rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "text-white shadow-md shadow-slate-200"
                    : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
                }`}
                style={
                  isActive
                    ? { backgroundColor: sheet.color, borderColor: sheet.color }
                    : { borderLeftColor: sheet.color, borderLeftWidth: 3 }
                }
              >
                {sheet.name}
              </button>
            );
          })}

          <button
            onClick={onAddSheet}
            className="shrink-0 rounded border border-dashed border-slate-300 px-2.5 py-1.5 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all cursor-pointer flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Sheet</span>
          </button>

          <button
            onClick={() => onChange("backups")}
            className={`shrink-0 rounded border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === "backups"
                ? "bg-slate-900 text-white border-slate-900 shadow-md shadow-slate-200"
                : "bg-white hover:bg-slate-50 text-slate-500 border-slate-200"
            }`}
          >
            Backups
          </button>
        </div>
      </div>
    </div>
  );
}
