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
    <div className="mb-5 min-w-0 sm:mb-6">
      <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-3 sm:-mx-1 sm:px-1">
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
                className={`shrink-0 rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer sm:py-1.5 ${
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
                className={`flex max-w-[14rem] shrink-0 items-center gap-1.5 rounded border px-3 py-2 text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer sm:py-1.5 ${
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
                <span className="truncate">{sheet.name}</span>
              </button>
            );
          })}

          <button
            onClick={onAddSheet}
            className="flex shrink-0 items-center gap-1 rounded border border-dashed border-slate-300 px-2.5 py-2 text-slate-400 transition-all hover:border-slate-400 hover:text-slate-600 cursor-pointer sm:py-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Sheet</span>
          </button>
        </div>
      </div>
    </div>
  );
}
