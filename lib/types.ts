export type SheetCategory = "einnahmen" | "ausgaben" | "sonstiges";

export type ColumnType = "text" | "number";

export interface ColumnConfig {
  id: string;
  title: string;
  type: ColumnType;
  required?: boolean;
}

export interface SheetConfig {
  id: string;
  name: string;
  category: SheetCategory;
  color: string;
  columns: ColumnConfig[];
}

export interface SheetRow {
  _id: number;
  _datum: string;
  [key: string]: string | number | undefined;
}

export interface KassenbuchEntry {
  id: number;
  datum: string;
  typ: string;
  einnahmen: number;
  ausgaben: number;
  saldo: number;
}

export const SHEET_COLORS = [
  "#e53935",
  "#fb8c00",
  "#fdd835",
  "#43a047",
  "#00bfa5",
  "#00acc1",
  "#1e88e5",
  "#3949ab",
  "#8e24aa",
  "#d81b60",
];

export const CATEGORY_LABELS: Record<SheetCategory, string> = {
  einnahmen: "Einnahmen",
  ausgaben: "Ausgaben",
  sonstiges: "Sonstiges",
};

export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
  text: "Text",
  number: "Zahl",
};

export const GESAMTBETRAG_COLUMN_ID = "gesamtbetrag";

export function createId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createGesamtbetragColumn(): ColumnConfig {
  return {
    id: GESAMTBETRAG_COLUMN_ID,
    title: "Gesamtbetrag",
    type: "number",
    required: true,
  };
}
