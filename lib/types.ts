export type TabKey = "dashboard" | "kassenbuch" | "darlehen" | "ausgaben" | "verkauf" | "backups";

export interface DarlehenKaeuferAnteil {
  id: string;
  kaeufer: string;
  anteil: number;
}

export interface DarlehenEntry {
  id: number;
  datum: string;
  name: string;
  preis: number;
  geprueftVon: string;
  kaeuferAnteile: DarlehenKaeuferAnteil[];
  anzahl?: number;
}

export interface AusgabenEntry {
  id: number;
  datum: string;
  ausgabe: string;
  preis: number;
  beschreibung: string;
  geprueftVon: string;
}

export interface VerkaufEntry {
  id: number;
  datum: string;
  produkt: string;
  preis: number;
  beschreibung: string;
  geprueftVon: string;
}

export interface KassenbuchEntry {
  id: number;
  datum: string;
  typ: "Darlehen" | "Ausgabe" | "Verkauf";
  einnahmen: number;
  ausgaben: number;
  saldo: number;
  geprueftVon: string;
}
