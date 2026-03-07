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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      <div className="bg-slate-50/50 border-b-2 border-slate-100 rounded-t p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Darlehen</p>
        <p className="text-xl font-black text-slate-900">{totalDarlehen.toFixed(2)} EUR</p>
      </div>
      <div className="bg-slate-50/50 border-b-2 border-slate-100 rounded-t p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Ausgaben</p>
        <p className="text-xl font-black text-slate-900">{totalAusgaben.toFixed(2)} EUR</p>
      </div>
      <div className="bg-slate-50/50 border-b-2 border-slate-100 rounded-t p-3 transition-all">
        <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Verkauf</p>
        <p className="text-xl font-black text-slate-900">{totalVerkauf.toFixed(2)} EUR</p>
      </div>
      <div
        className={`border-b-2 rounded-t p-3 transition-all ${
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
        <p className={`text-xl font-black ${gesamtSaldo >= 0 ? "text-green-700" : "text-red-700"}`}>
          {gesamtSaldo.toFixed(2)} EUR
        </p>
      </div>
    </div>
  );
}
