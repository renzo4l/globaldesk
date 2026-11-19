import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Boxes,
  CheckCircle2,
  DollarSign,
  Eye,
  FileDown,
  HardDrive,
  Laptop,
  PackagePlus,
  RefreshCw,
  Search,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  AssetCategory,
  AssetCondition,
  AssetMovementRecord,
  AssetStatus,
  ITAsset,
  SystemUser,
} from '../types/itsm';
import { api } from '../services/api';
import {
  CustomTermSigners,
  downloadAssetTermPdf,
} from '../utils/assetTermsPdf';
import {
  ASSET_CATEGORY_LABELS as CATEGORY_LABELS,
  formatCurrencyBR,
} from '../utils/formatters';
import { useDebounce } from '../utils/useDebounce';
import {
  AssetTableRowsSkeleton,
  KpiCardsSkeleton,
} from './shared/SkeletonLoaders';

const LazyAssetDetailDrawer = lazy(() =>
  import('./AssetDetailDrawer').then((m) => ({ default: m.AssetDetailDrawer }))
);
const LazyAssetAcquisitionModal = lazy(() =>
  import('./AssetActionModals').then((m) => ({
    default: m.AssetAcquisitionModal,
  }))
);
const LazyAssetMoveModal = lazy(() =>
  import('./AssetActionModals').then((m) => ({ default: m.AssetMoveModal }))
);
const LazyAssetDisposeModal = lazy(() =>
  import('./AssetActionModals').then((m) => ({ default: m.AssetDisposeModal }))
);
const LazyAssetSignersExportModal = lazy(() =>
  import('./AssetActionModals').then((m) => ({
    default: m.AssetSignersExportModal,
  }))
);

const ROW_STATUS_META: Record<
  AssetStatus,
  { label: string; badgeClass: string }
> = {
  DISPONIVEL: {
    label: 'Disponível em Estoque',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  EM_USO: {
    label: 'Em Uso (Alocado)',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  MANUTENCAO: {
    label: 'Em Manutenção',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  BAIXADO_DESCARTADO: {
    label: 'Baixado / Descartado',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

const ROW_CONDITION_META: Record<
  AssetCondition,
  { label: string; badgeClass: string }
> = {
  NOVO: {
    label: 'Novo',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  BOM: {
    label: 'Bom Estado',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  DESGASTADO: {
    label: 'Desgastado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  DEFEITUOSO: {
    label: 'Defeituoso',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

interface AssetTableRowProps {
  asset: ITAsset;
  onSelectAsset: (id: string) => void;
  onExportTerm: (asset: ITAsset, movement: AssetMovementRecord) => void;
  onMoveAsset: (asset: ITAsset) => void;
  onDisposeAsset: (asset: ITAsset) => void;
}

const AssetTableRow: React.FC<AssetTableRowProps> = React.memo(
  ({
    asset,
    onSelectAsset,
    onExportTerm,
    onMoveAsset,
    onDisposeAsset,
  }) => {
    const statusMeta =
      ROW_STATUS_META[asset.status as AssetStatus] ||
      ROW_STATUS_META.DISPONIVEL;
    const condMeta =
      ROW_CONDITION_META[asset.condition] || ROW_CONDITION_META.BOM;
    const isDisposed = asset.status === 'BAIXADO_DESCARTADO';
    const latestMov = asset.movements?.[0];

    return (
      <tr
        className={`hover:bg-slate-50/80 transition-all duration-150 ${
          isDisposed ? 'opacity-65 bg-slate-50/40' : ''
        }`}
      >
        <td className="py-3.5 px-4 whitespace-nowrap">
          <button
            type="button"
            onClick={() => onSelectAsset(asset.id)}
            className="font-mono font-bold text-blue-700 hover:underline active:scale-[0.98] transition-all duration-150 cursor-pointer block"
          >
            {asset.assetTag}
          </button>
          {latestMov && (
            <span className="text-[10px] font-mono text-slate-400">
              Últ. Termo: {latestMov.termNumber}
            </span>
          )}
        </td>

        <td className="py-3.5 px-4">
          <div className="font-bold text-slate-900">{asset.name}</div>
          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
            {asset.brand} · {asset.model} · S/N:{' '}
            <strong className="text-slate-700">{asset.serialNumber}</strong>
          </div>
        </td>

        <td className="py-3.5 px-4 whitespace-nowrap">
          <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-semibold text-[11px]">
            {CATEGORY_LABELS[asset.category] || asset.category}
          </span>
        </td>

        <td className="py-3.5 px-4 whitespace-nowrap">
          <div className="flex flex-col items-start gap-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${condMeta.badgeClass}`}
            >
              Estado: {condMeta.label}
            </span>
          </div>
        </td>

        <td className="py-3.5 px-4">
          <div className="font-semibold text-slate-800">
            {asset.assignedTo?.name || 'Estoque Central de TI'}
          </div>
          <div className="text-[11px] text-slate-500">
            {asset.department}
            {asset.location ? ` · ${asset.location}` : ''}
          </div>
        </td>

        <td className="py-3.5 px-4 whitespace-nowrap font-mono font-semibold text-slate-800">
          {formatCurrencyBR(asset.purchaseValue, '—')}
        </td>

        <td className="py-3.5 px-4 text-right whitespace-nowrap">
          <div className="inline-flex items-center justify-end gap-1.5">
            <button
              type="button"
              onClick={() => onSelectAsset(asset.id)}
              title="Ver Ficha Completa & Timeline de Termos"
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 inline-flex items-center gap-1 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-slate-600" />
              <span>Ficha &amp; Termos</span>
            </button>

            {latestMov && (
              <button
                type="button"
                onClick={() => onExportTerm(asset, latestMov)}
                title={`Configurar assinaturas e baixar termo PDF (${latestMov.termNumber})`}
                className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <FileDown className="w-3.5 h-3.5" />
              </button>
            )}

            {!isDisposed && (
              <>
                <button
                  type="button"
                  onClick={() => onMoveAsset(asset)}
                  title="Movimentar / Entregar / Devolver Ativo"
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 inline-flex items-center gap-1 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Movimentar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDisposeAsset(asset)}
                  title="Baixar / Excluir Patrimônio com Laudo"
                  className="p-1.5 rounded-lg bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 active:scale-[0.98] transition-all duration-150 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }
);
AssetTableRow.displayName = 'AssetTableRow';

interface AssetInventoryTabProps {
  users: SystemUser[];
  activeTechName: string;
  onNotify?: (notif: {
    type: 'status_changed' | 'order_finalized';
    title: string;
    message: string;
    soundType?: 'new_ticket' | 'escalation' | 'status_change';
  }) => void;
}

export const AssetInventoryTab: React.FC<AssetInventoryTabProps> = ({
  users,
  activeTechName,
  onNotify,
}) => {
  const [assets, setAssets] = useState<ITAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 220);
  const [categoryFilter, setCategoryFilter] = useState<string>('TODAS');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [departmentFilter, setDepartmentFilter] = useState<string>('TODOS');

  // Modais e Drawer states
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [isAcquireModalOpen, setIsAcquireModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<ITAsset | null>(null);
  const [assetToMove, setAssetToMove] = useState<ITAsset | null>(null);
  const [assetToDispose, setAssetToDispose] = useState<ITAsset | null>(null);
  const [termExportTarget, setTermExportTarget] = useState<{
    asset: ITAsset;
    movement: AssetMovementRecord;
  } | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getAssets();
      if (Array.isArray(list)) {
        setAssets(list);
      }
    } catch (err) {
      console.error('Erro ao carregar inventário de ativos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) || null,
    [assets, selectedAssetId]
  );

  // KPIs calculados sobre o inventário completo
  const kpis = useMemo(() => {
    const total = assets.length;
    const inUse = assets.filter((a) => a.status === 'EM_USO').length;
    const available = assets.filter((a) => a.status === 'DISPONIVEL').length;
    const maintenance = assets.filter((a) => a.status === 'MANUTENCAO').length;
    const totalValue = assets
      .filter((a) => a.status !== 'BAIXADO_DESCARTADO')
      .reduce((acc, item) => acc + (Number(item.purchaseValue) || 0), 0);

    return { total, inUse, available, maintenance, totalValue };
  }, [assets]);

  // Lista filtrada na tabela com debounce na busca textual
  const filteredAssets = useMemo(() => {
    const q = debouncedSearchQuery.toLowerCase().trim();
    return assets.filter((asset) => {
      if (statusFilter !== 'TODOS' && asset.status !== statusFilter) {
        return false;
      }
      if (categoryFilter !== 'TODAS' && asset.category !== categoryFilter) {
        return false;
      }
      if (
        departmentFilter !== 'TODOS' &&
        asset.department !== departmentFilter
      ) {
        return false;
      }
      if (q) {
        const matchTag = asset.assetTag.toLowerCase().includes(q);
        const matchName = asset.name.toLowerCase().includes(q);
        const matchBrandModel = `${asset.brand} ${asset.model}`
          .toLowerCase()
          .includes(q);
        const matchSerial = asset.serialNumber.toLowerCase().includes(q);
        const matchUser =
          asset.assignedTo?.name?.toLowerCase().includes(q) ||
          asset.assignedTo?.email?.toLowerCase().includes(q);
        if (
          !matchTag &&
          !matchName &&
          !matchBrandModel &&
          !matchSerial &&
          !matchUser
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    assets,
    statusFilter,
    categoryFilter,
    departmentFilter,
    debouncedSearchQuery,
  ]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    assets.forEach((a) => {
      if (a.department) depts.add(a.department);
    });
    return Array.from(depts).sort();
  }, [assets]);

  const handleSelectAsset = useCallback((id: string) => {
    setSelectedAssetId(id);
  }, []);

  const handleRequestExportTerm = useCallback(
    (asset: ITAsset, movement: AssetMovementRecord) => {
      setTermExportTarget({ asset, movement });
    },
    []
  );

  const handleOpenMoveAsset = useCallback((asset: ITAsset) => {
    setAssetToMove(asset);
  }, []);

  const handleOpenDisposeAsset = useCallback((asset: ITAsset) => {
    setAssetToDispose(asset);
  }, []);

  const handleOpenEditAsset = useCallback((asset: ITAsset) => {
    setEditingAsset(asset);
    setIsAcquireModalOpen(true);
  }, []);

  // 1. Handler de Aquisição (Novo Ativo) -> Emite PDF automaticamente com assinaturas personalizadas
  const handleCreateAsset = useCallback(
    async (payload: any, customSigners: CustomTermSigners) => {
      const res = await api.createAsset(payload);
      await fetchAssets();
      if (res?.asset && res?.latestMovement) {
        await downloadAssetTermPdf(res.asset, res.latestMovement, customSigners);
        onNotify?.({
          type: 'order_finalized',
          title: `Ativo Incorporado: ${res.asset.assetTag}`,
          message: `Termo de Aquisição ${res.latestMovement.termNumber} gerado em PDF com sucesso.`,
          soundType: 'status_change',
        });
      }
    },
    [fetchAssets, onNotify]
  );

  // 1.1 Handler de Edição Cadastral
  const handleEditAsset = useCallback(
    async (assetId: string, payload: any) => {
      await api.updateAsset(assetId, payload);
      await fetchAssets();
      onNotify?.({
        type: 'status_changed',
        title: 'Ficha Patrimonial Atualizada',
        message: 'Os dados técnicos e cadastrais do ativo foram atualizados.',
        soundType: 'status_change',
      });
    },
    [fetchAssets, onNotify]
  );

  // 2. Handler de Movimentação / Entrega / Devolução -> Emite PDF automaticamente com assinaturas personalizadas
  const handleMoveAsset = useCallback(
    async (
      assetId: string,
      payload: any,
      customSigners: CustomTermSigners
    ) => {
      const res = await api.moveAsset(assetId, payload);
      await fetchAssets();
      if (res?.asset && res?.latestMovement) {
        await downloadAssetTermPdf(res.asset, res.latestMovement, customSigners);
        onNotify?.({
          type: 'order_finalized',
          title: `Termo de Movimentação Emitido: ${res.latestMovement.termNumber}`,
          message: `Ativo ${res.asset.assetTag} movimentado e PDF baixado automaticamente.`,
          soundType: 'status_change',
        });
      }
    },
    [fetchAssets, onNotify]
  );

  // 3. Handler de Baixa Patrimonial -> Emite PDF automaticamente com assinaturas personalizadas
  const handleDisposeAsset = useCallback(
    async (
      assetId: string,
      payload: any,
      customSigners: CustomTermSigners
    ) => {
      const res = await api.disposeAsset(assetId, payload);
      await fetchAssets();
      if (res?.asset && res?.latestMovement) {
        await downloadAssetTermPdf(res.asset, res.latestMovement, customSigners);
        onNotify?.({
          type: 'order_finalized',
          title: `Baixa Patrimonial Concluída: ${res.asset.assetTag}`,
          message: `Laudo Condenatório ${res.latestMovement.termNumber} gerado em PDF.`,
          soundType: 'escalation',
        });
      }
    },
    [fetchAssets, onNotify]
  );

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Cabeçalho do Módulo CMDB */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900">
                Gestão de Inventário &amp; Ativos de TI (CMDB)
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 rounded-md">
                ITIL v4 Asset Management
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Controle patrimonial, custódia nominal de equipamentos e emissão
              automática de Termos de Aquisição, Responsabilidade e Baixa em
              PDF.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={fetchAssets}
            title="Sincronizar inventário com PostgreSQL"
            className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl inline-flex items-center gap-1.5 active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingAsset(null);
              setIsAcquireModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs inline-flex items-center gap-2 active:scale-[0.98] transition-all duration-150 cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>+ Registrar Aquisição (Novo Ativo)</span>
          </button>
        </div>
      </div>

      {/* 1. Dashboard de KPIs do Inventário (5 Cards Superiores Interativos ou Skeleton) */}
      {loading && assets.length === 0 ? (
        <KpiCardsSkeleton count={5} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            type="button"
            onClick={() => setStatusFilter('TODOS')}
            className={`text-left bg-white rounded-xl border p-4 shadow-2xs flex items-center justify-between hover-lift active:scale-[0.98] transition-all duration-150 cursor-pointer ${
              statusFilter === 'TODOS'
                ? 'border-slate-400 ring-2 ring-slate-200'
                : 'border-slate-200'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                Total de Ativos
              </span>
              <span className="text-2xl font-extrabold text-slate-900 mt-1 block font-mono">
                {kpis.total}
              </span>
              <span className="text-[11px] text-slate-500">
                Itens tombados no CMDB
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(statusFilter === 'EM_USO' ? 'TODOS' : 'EM_USO')
            }
            className={`text-left bg-white rounded-xl border p-4 shadow-2xs flex items-center justify-between hover-lift active:scale-[0.98] transition-all duration-150 cursor-pointer ${
              statusFilter === 'EM_USO'
                ? 'border-blue-500 ring-2 ring-blue-100'
                : 'border-blue-200/80'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">
                Ativos Em Uso
              </span>
              <span className="text-2xl font-extrabold text-blue-700 mt-1 block font-mono">
                {kpis.inUse}
              </span>
              <span className="text-[11px] text-slate-500">
                Alocados a colaboradores
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Laptop className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === 'DISPONIVEL' ? 'TODOS' : 'DISPONIVEL'
              )
            }
            className={`text-left bg-white rounded-xl border p-4 shadow-2xs flex items-center justify-between hover-lift active:scale-[0.98] transition-all duration-150 cursor-pointer ${
              statusFilter === 'DISPONIVEL'
                ? 'border-emerald-500 ring-2 ring-emerald-100'
                : 'border-emerald-200/80'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                Disponíveis
              </span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
                {kpis.available}
              </span>
              <span className="text-[11px] text-slate-500">
                Prontos no estoque de TI
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === 'MANUTENCAO' ? 'TODOS' : 'MANUTENCAO'
              )
            }
            className={`text-left bg-white rounded-xl border p-4 shadow-2xs flex items-center justify-between hover-lift active:scale-[0.98] transition-all duration-150 cursor-pointer ${
              statusFilter === 'MANUTENCAO'
                ? 'border-amber-500 ring-2 ring-amber-100'
                : 'border-amber-200/80'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block">
                Em Manutenção
              </span>
              <span className="text-2xl font-extrabold text-amber-700 mt-1 block font-mono">
                {kpis.maintenance}
              </span>
              <span className="text-[11px] text-slate-500">
                Em bancada ou garantia/RMA
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
          </button>

          <div className="bg-white rounded-xl border border-teal-200/80 p-4 shadow-2xs flex items-center justify-between hover-lift transition-all duration-150">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-teal-700 block">
                Valor do Parque (R$)
              </span>
              <span className="text-lg font-extrabold text-teal-800 mt-1 block font-mono">
                {formatCurrencyBR(kpis.totalValue, 'R$ 0,00')}
              </span>
              <span className="text-[11px] text-slate-500">
                Patrimônio ativo estimado
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      )}

      {/* 2. Barra de Busca Rápida & Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por Patrimônio (PAT-2026-...), Nº de Série, Modelo, Marca ou Colaborador..."
            className="w-full pl-10 pr-9 py-2 text-xs bg-slate-50 focus:bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-600 transition-all duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Filtrar por Categoria"
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium outline-none focus:border-blue-600"
          >
            <option value="TODAS">Todas as Categorias</option>
            {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrar por Status"
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium outline-none focus:border-blue-600"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="DISPONIVEL">Disponível em Estoque</option>
            <option value="EM_USO">Em Uso (Alocado)</option>
            <option value="MANUTENCAO">Em Manutenção</option>
            <option value="BAIXADO_DESCARTADO">Baixado / Descartado</option>
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filtrar por Departamento"
            className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 font-medium outline-none focus:border-blue-600"
          >
            <option value="TODOS">Todos os Setores</option>
            {uniqueDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
          {(searchQuery ||
            categoryFilter !== 'TODAS' ||
            statusFilter !== 'TODOS' ||
            departmentFilter !== 'TODOS') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setCategoryFilter('TODAS');
                setStatusFilter('TODOS');
                setDepartmentFilter('TODOS');
              }}
              className="px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-200 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* 3. Tabela Rica de Ativos (Memoizada + Skeleton Screen) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Patrimônio</th>
                <th className="py-3.5 px-4">Equipamento &amp; Série</th>
                <th className="py-3.5 px-4">Categoria</th>
                <th className="py-3.5 px-4">Status &amp; Condição</th>
                <th className="py-3.5 px-4">Custódia / Localização</th>
                <th className="py-3.5 px-4">Valor Contábil</th>
                <th className="py-3.5 px-4 text-right">Ações Patrimoniais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => (
                <AssetTableRow
                  key={asset.id}
                  asset={asset}
                  onSelectAsset={handleSelectAsset}
                  onExportTerm={handleRequestExportTerm}
                  onMoveAsset={handleOpenMoveAsset}
                  onDisposeAsset={handleOpenDisposeAsset}
                />
              ))}

              {loading && assets.length === 0 && (
                <AssetTableRowsSkeleton rows={5} />
              )}

              {!loading && filteredAssets.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-slate-400 text-xs"
                  >
                    Nenhum ativo encontrado para os filtros aplicados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais e Drawer sob demanda (Code Splitting via React.lazy + Suspense) */}
      <Suspense fallback={null}>
        <LazyAssetDetailDrawer
          asset={selectedAsset}
          onClose={() => setSelectedAssetId(null)}
          onEditAsset={handleOpenEditAsset}
          onMoveAsset={handleOpenMoveAsset}
          onDisposeAsset={handleOpenDisposeAsset}
          onRequestExportTerm={handleRequestExportTerm}
        />

        <LazyAssetSignersExportModal
          target={termExportTarget}
          onClose={() => setTermExportTarget(null)}
        />

        <LazyAssetAcquisitionModal
          isOpen={isAcquireModalOpen}
          editingAsset={editingAsset}
          users={users}
          activeTechName={activeTechName}
          onClose={() => {
            setIsAcquireModalOpen(false);
            setEditingAsset(null);
          }}
          onSubmitAcquisition={handleCreateAsset}
          onSubmitEdit={handleEditAsset}
        />

        <LazyAssetMoveModal
          asset={assetToMove}
          users={users}
          activeTechName={activeTechName}
          onClose={() => setAssetToMove(null)}
          onConfirmMove={handleMoveAsset}
        />

        <LazyAssetDisposeModal
          asset={assetToDispose}
          activeTechName={activeTechName}
          onClose={() => setAssetToDispose(null)}
          onConfirmDispose={handleDisposeAsset}
        />
      </Suspense>
    </div>
  );
};
