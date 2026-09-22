import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  totalPages?: number;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
  itemLabel?: string;
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
  itemLabel = 'records',
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);

  // Generate page numbers with ellipsis (e.g., 1 ... 4 5 6 ... 20)
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) {
        pages.push('ellipsis');
      }

      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (safePage < totalPages - 2) {
        pages.push('ellipsis');
      }
      pages.push(totalPages);
    }
    return pages;
  }, [safePage, totalPages]);

  if (totalItems === 0) {
    return null;
  }

  return (
    <nav
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 ${className}`}
      aria-label="Pagination Navigation"
    >
      {/* Summary and Page Size Select */}
      <div className="flex flex-wrap items-center gap-3">
        <span>
          Showing <strong className="font-bold text-slate-900">{startItem}</strong> to{' '}
          <strong className="font-bold text-slate-900">{endItem}</strong> of{' '}
          <strong className="font-bold text-slate-900">{totalItems}</strong> {itemLabel}
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <span className="text-[11px] text-slate-400">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700 outline-none focus:border-orange-400"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          className="p-1.5 h-8 w-8 justify-center disabled:opacity-30"
          title="First page"
          aria-label="First page"
        >
          <ChevronsLeft size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          className="p-1.5 h-8 w-8 justify-center disabled:opacity-30"
          title="Previous page"
          aria-label="Previous page"
        >
          <ChevronLeft size={14} />
        </Button>

        {/* Page Number Pills */}
        <div className="hidden sm:flex items-center gap-1">
          {pageNumbers.map((page, idx) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-1.5 text-slate-400 text-xs font-bold select-none"
                >
                  ...
                </span>
              );
            }

            const isActive = page === safePage;
            return (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                aria-current={isActive ? 'page' : undefined}
                className={`h-8 min-w-8 rounded-lg px-2 text-xs font-bold transition ${
                  isActive
                    ? 'bg-orange-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Mobile current indicator */}
        <span className="sm:hidden px-2 text-[11px] font-bold text-slate-700">
          {safePage} / {totalPages}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= totalPages}
          className="p-1.5 h-8 w-8 justify-center disabled:opacity-30"
          title="Next page"
          aria-label="Next page"
        >
          <ChevronRight size={14} />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={safePage >= totalPages}
          className="p-1.5 h-8 w-8 justify-center disabled:opacity-30"
          title="Last page"
          aria-label="Last page"
        >
          <ChevronsRight size={14} />
        </Button>
      </div>
    </nav>
  );
}
