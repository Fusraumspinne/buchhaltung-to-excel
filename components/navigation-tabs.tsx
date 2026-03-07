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
];

export function NavigationTabs({ activeTab, onChange }: NavigationTabsProps) {
  return (
    <div className="mb-6 border-b border-slate-100">
      <div className="flex flex-wrap gap-2 pb-3">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onChange(tab.key)}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-all border ${
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
  );
}
