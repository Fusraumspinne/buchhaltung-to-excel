import { TabKey } from "@/lib/types";

interface NavigationTabsProps {
  activeTab: TabKey;
  onChange: (tab: TabKey) => void;
}

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "dashboard", label: "Dashboard" },
  { key: "kassenbuch", label: "Kassenbuch" },
  { key: "darlehen", label: "Darlehen" },
  { key: "ausgaben", label: "Ausgaben" },
  { key: "verkauf", label: "Verkauf" },
  { key: "backups", label: "Backups" },
];

export function NavigationTabs({ activeTab, onChange }: NavigationTabsProps) {
  return (
    <div className="mb-5 border-b border-slate-100 sm:mb-6">
      <div className="-mx-1 overflow-x-auto px-1 pb-3">
        <div className="flex min-w-max gap-2 sm:min-w-0 sm:flex-wrap">
        {tabs.map((tab) => {
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
        </div>
      </div>
    </div>
  );
}
