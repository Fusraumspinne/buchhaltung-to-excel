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
    <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-slate-100 bg-slate-50/20 px-2 py-3 sm:gap-2 sm:py-4">
      <button
        onClick={() => onPageChange(1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Erste Seite"
      >
        <ChevronsLeft className="w-4 h-4 text-slate-600" />
      </button>
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Vorherige Seite"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>

      <div className="mx-1.5 flex items-center gap-1 sm:mx-2">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider sm:text-[11px]">Seite</span>
        <span className="flex h-6 items-center justify-center text-xs font-bold text-slate-600">
          {currentPage}
        </span>
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider sm:text-[11px]">von</span>
        <span className="text-xs font-bold text-slate-600">{totalPages}</span>
      </div>

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Nächste Seite"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
      <button
        onClick={() => onPageChange(totalPages)}
        disabled={currentPage === totalPages}
        className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
        title="Letzte Seite"
      >
        <ChevronsRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}
