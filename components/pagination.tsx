import React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-4 border-t border-slate-100 bg-slate-50/20">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Erste Seite"
      >
        <ChevronsLeft className="w-4 h-4 text-slate-600" />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Vorherige Seite"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>

      <div className="flex items-center gap-1 mx-2">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Seite</span>
        <span className="min-w-[24px] h-6 flex items-center justify-center bg-white border border-slate-200 rounded text-xs font-bold text-slate-800 shadow-sm">
          {currentPage}
        </span>
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">von</span>
        <span className="text-xs font-bold text-slate-600">{totalPages}</span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Nächste Seite"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        title="Letzte Seite"
      >
        <ChevronsRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}
