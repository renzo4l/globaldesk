import React from 'react';

/**
 * Skeleton Screen para Cards de KPI (Dashboard Técnico e Inventário CMDB),
 * prevenindo Cumulative Layout Shift (CLS) durante requisições da API.
 */
export const KpiCardsSkeleton: React.FC<{ count?: number }> = React.memo(
  ({ count = 4 }) => {
    const gridColsClass =
      count === 5
        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

    return (
      <div
        role="status"
        aria-label="Carregando indicadores..."
        className={`grid ${gridColsClass} gap-4`}
      >
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs animate-pulse flex items-center justify-between"
          >
            <div className="space-y-2.5 flex-1">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-7 w-16 bg-slate-200 rounded-md" />
              <div className="h-2.5 w-32 bg-slate-100 rounded" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 shrink-0" />
          </div>
        ))}
      </div>
    );
  }
);
KpiCardsSkeleton.displayName = 'KpiCardsSkeleton';

/**
 * Skeleton Screen para a Tabela Operacional de Chamados (High-Density Queue).
 */
export const TicketTableSkeleton: React.FC<{ rows?: number }> = React.memo(
  ({ rows = 8 }) => {
    return (
      <div
        role="status"
        aria-label="Carregando fila de chamados..."
        className="w-full overflow-hidden animate-pulse"
      >
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-4">
          <div className="h-3 w-4 bg-slate-200 rounded" />
          <div className="h-3 w-8 bg-slate-200 rounded" />
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-48 bg-slate-200 rounded flex-1" />
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
          <div className="h-3 w-24 bg-slate-200 rounded" />
        </div>
        <div className="divide-y divide-slate-200/70">
          {Array.from({ length: rows }).map((_, idx) => (
            <div
              key={idx}
              className="px-4 py-3 flex items-center justify-between gap-4 bg-white"
            >
              <div className="w-4 h-4 bg-slate-200 rounded shrink-0" />
              <div className="w-5 h-5 bg-slate-200 rounded-xs shrink-0" />
              <div className="h-3.5 w-24 bg-slate-200 rounded shrink-0" />
              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="h-3.5 w-3/4 bg-slate-200 rounded" />
                <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
              </div>
              <div className="h-4 w-16 bg-slate-100 rounded shrink-0 hidden sm:block" />
              <div className="space-y-1 shrink-0 hidden md:block">
                <div className="h-3 w-20 bg-slate-200 rounded" />
                <div className="h-2.5 w-14 bg-slate-100 rounded" />
              </div>
              <div className="space-y-1 shrink-0 hidden lg:block">
                <div className="h-3 w-24 bg-slate-200 rounded" />
                <div className="h-2.5 w-20 bg-slate-100 rounded" />
              </div>
              <div className="h-6 w-28 bg-slate-100 rounded shrink-0" />
              <div className="h-5 w-20 bg-slate-200 rounded shrink-0" />
            </div>
          ))}
        </div>
      </div>
    );
  }
);
TicketTableSkeleton.displayName = 'TicketTableSkeleton';

/**
 * Skeleton Screen para linhas da Tabela de Inventário de Ativos (CMDB).
 */
export const AssetTableRowsSkeleton: React.FC<{ rows?: number }> = React.memo(
  ({ rows = 5 }) => {
    return (
      <>
        {Array.from({ length: rows }).map((_, skeletonIdx) => (
          <tr key={skeletonIdx} className="animate-pulse">
            <td className="py-4 px-4">
              <div className="h-3.5 w-24 bg-slate-200 rounded mb-1.5" />
              <div className="h-2.5 w-20 bg-slate-100 rounded" />
            </td>
            <td className="py-4 px-4">
              <div className="h-3.5 w-48 bg-slate-200 rounded mb-1.5" />
              <div className="h-2.5 w-36 bg-slate-100 rounded" />
            </td>
            <td className="py-4 px-4">
              <div className="h-5 w-28 bg-slate-100 rounded-md" />
            </td>
            <td className="py-4 px-4">
              <div className="h-4 w-24 bg-slate-200 rounded-full mb-1" />
              <div className="h-3.5 w-16 bg-slate-100 rounded" />
            </td>
            <td className="py-4 px-4">
              <div className="h-3.5 w-32 bg-slate-200 rounded mb-1" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </td>
            <td className="py-4 px-4">
              <div className="h-3.5 w-20 bg-slate-200 rounded" />
            </td>
            <td className="py-4 px-4 text-right">
              <div className="h-7 w-40 bg-slate-100 rounded-lg ml-auto" />
            </td>
          </tr>
        ))}
      </>
    );
  }
);
AssetTableRowsSkeleton.displayName = 'AssetTableRowsSkeleton';

/**
 * Skeleton Screen para módulos carregados via React.lazy + Suspense.
 */
export const WorkspaceModuleSkeleton: React.FC = React.memo(() => {
  return (
    <div
      role="status"
      aria-label="Preparando módulo..."
      className="p-6 max-w-[1600px] mx-auto space-y-6 animate-pulse"
    >
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0" />
          <div className="space-y-2">
            <div className="h-4 w-64 bg-slate-200 rounded" />
            <div className="h-3 w-96 bg-slate-100 rounded" />
          </div>
        </div>
        <div className="h-9 w-40 bg-slate-200 rounded-xl" />
      </div>
      <KpiCardsSkeleton count={4} />
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <TicketTableSkeleton rows={6} />
      </div>
    </div>
  );
});
WorkspaceModuleSkeleton.displayName = 'WorkspaceModuleSkeleton';
