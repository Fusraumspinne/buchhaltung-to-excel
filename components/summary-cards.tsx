interface SummaryCardsProps {
  totalDarlehen: number;
  totalAusgaben: number;
  totalVerkauf: number;
  gesamtSaldo: number;
}

export function SummaryCards({
  totalDarlehen,
  totalAusgaben,
  totalVerkauf,
  gesamtSaldo,
}: SummaryCardsProps) {
  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:mb-8 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-t border-b-2 border-slate-100 bg-slate-50/50 p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Darlehen</p>
        <p className="text-lg font-black text-slate-900 sm:text-xl">{totalDarlehen.toFixed(2)} EUR</p>
      </div>
      <div className="rounded-t border-b-2 border-slate-100 bg-slate-50/50 p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Ausgaben</p>
        <p className="text-lg font-black text-slate-900 sm:text-xl">{totalAusgaben.toFixed(2)} EUR</p>
      </div>
      <div className="rounded-t border-b-2 border-slate-100 bg-slate-50/50 p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Verkauf</p>
        <p className="text-lg font-black text-slate-900 sm:text-xl">{totalVerkauf.toFixed(2)} EUR</p>
      </div>
      <div
        className={`rounded-t border-b-2 p-3 transition-all ${
          gesamtSaldo >= 0 ? "bg-green-50/30 border-green-200" : "bg-red-50/30 border-red-200"
        }`}
      >
        <p
          className={`text-[10px] uppercase font-bold mb-1 tracking-widest ${
            gesamtSaldo >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          Gesamt
        </p>
        <p className={`text-lg font-black sm:text-xl ${gesamtSaldo >= 0 ? "text-green-700" : "text-red-700"}`}>
          {gesamtSaldo.toFixed(2)} EUR
        </p>
      </div>
    </div>
  );
}
