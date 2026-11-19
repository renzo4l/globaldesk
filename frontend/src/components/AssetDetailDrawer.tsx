import React, { useEffect } from 'react';
import {
  ArrowRightLeft,
  Building2,
  Calendar,
  Cpu,
  FileDown,
  FileText,
  History,
  MapPin,
  Pencil,
  Trash2,
  User,
  X,
} from 'lucide-react';
import {
  AssetCondition,
  AssetMovementRecord,
  AssetStatus,
  ITAsset,
  MovementType,
} from '../types/itsm';
import { downloadAssetTermPdf } from '../utils/assetTermsPdf';
import {
  ASSET_CATEGORY_LABELS as CATEGORY_LABELS,
  formatCurrencyBR,
  formatDateBR,
} from '../utils/formatters';
import { useAnimatedPresence } from '../utils/useAnimatedPresence';

export { CATEGORY_LABELS };

interface AssetDetailDrawerProps {
  asset: ITAsset | null;
  onClose: () => void;
  onEditAsset: (asset: ITAsset) => void;
  onMoveAsset: (asset: ITAsset) => void;
  onDisposeAsset: (asset: ITAsset) => void;
  onRequestExportTerm?: (asset: ITAsset, movement: AssetMovementRecord) => void;
}

export const STATUS_META: Record<
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

export const CONDITION_META: Record<
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

const MOVEMENT_TYPE_META: Record<
  MovementType,
  { label: string; colorClass: string }
> = {
  AQUISICAO: {
    label: 'Aquisição & Incorporação',
    colorClass: 'bg-teal-50 text-teal-800 border-teal-200',
  },
  MOVIMENTACAO_ENTREGA: {
    label: 'Entrega / Alocação de Custódia',
    colorClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  DEVOLUCAO: {
    label: 'Devolução ao Estoque de TI',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  MANUTENCAO: {
    label: 'Remessa p/ Manutenção Técnica',
    colorClass: 'bg-amber-50 text-amber-900 border-amber-200',
  },
  EXCLUSAO_BAIXA: {
    label: 'Baixa & Exclusão Patrimonial',
    colorClass: 'bg-red-50 text-red-800 border-red-200',
  },
};

function formatCurrency(val?: number | null): string {
  return formatCurrencyBR(val, '—');
}

function formatDate(dateStr?: string | null): string {
  return formatDateBR(dateStr, '—');
}

export const AssetDetailDrawer: React.FC<AssetDetailDrawerProps> = ({
  asset: assetProp,
  onClose,
  onEditAsset,
  onMoveAsset,
  onDisposeAsset,
  onRequestExportTerm,
}) => {
  const { renderedValue: asset, isClosing } = useAnimatedPresence(assetProp, 180);

  useEffect(() => {
    if (!assetProp) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [assetProp, onClose]);

  if (!asset) return null;

  const statusMeta = STATUS_META[asset.status] || STATUS_META.DISPONIVEL;
  const conditionMeta = CONDITION_META[asset.condition] || CONDITION_META.BOM;
  const isDisposed = asset.status === 'BAIXADO_DESCARTADO';

  const isWarrantyValid =
    asset.warrantyUntil && new Date(asset.warrantyUntil) >= new Date();

  return (
    <div
      className={`fixed inset-0 z-50 flex justify-end bg-slate-900/50 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
    >
      <div className="flex-1" onClick={onClose} aria-hidden="true" />
      <div
        className={`bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden ${
          isClosing
            ? 'animate-out slide-out-to-right'
            : 'animate-in slide-in-from-right'
        } duration-200`}
      >
        {/* Cabeçalho Fixo */}
        <div className="px-6 py-4 bg-blue-700 text-white flex items-start justify-between gap-4 shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-md bg-white/15 text-white border border-white/30 font-mono text-xs font-bold">
                {asset.assetTag}
              </span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusMeta.badgeClass}`}
              >
                {statusMeta.label}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${conditionMeta.badgeClass}`}
              >
                Condição: {conditionMeta.label}
              </span>
            </div>
            <h2 className="text-base font-bold text-white leading-snug pt-1">
              {asset.name}
            </h2>
            <p className="text-xs text-blue-100 font-mono">
              {asset.brand} · {asset.model} · S/N: {asset.serialNumber}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEditAsset(asset)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>Editar Ficha</span>
            </button>

            {!isDisposed && (
              <button
                type="button"
                onClick={() => onMoveAsset(asset)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Movimentar / Entregar</span>
              </button>
            )}
          </div>

          {!isDisposed && (
            <button
              type="button"
              onClick={() => onDisposeAsset(asset)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 active:scale-[0.98] transition-all duration-150 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Baixa Patrimonial</span>
            </button>
          )}
        </div>

        {/* Corpo Rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Card 1: Custódia e Localização Atual */}
          <section className="bg-slate-50/80 rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Custódia Atual &amp; Localização Física
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                <span className="text-[11px] text-slate-400 block">
                  Responsável / Usuário Vinculado
                </span>
                <span className="font-bold text-slate-900 mt-0.5 block">
                  {asset.assignedTo?.name || 'Estoque Central de TI'}
                </span>
                {asset.assignedTo?.email && (
                  <span className="text-[11px] text-slate-500 font-mono">
                    {asset.assignedTo.email}
                  </span>
                )}
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> Departamento
                </span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {asset.department}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200/80">
                <span className="text-[11px] text-slate-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Local Físico
                </span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {asset.location || 'Matriz Corporativa'}
                </span>
              </div>
            </div>
          </section>

          {/* Card 2: Especificações Técnicas & Dados Fiscais */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                Especificações de Hardware / Software
              </h3>
              <div className="text-xs space-y-1.5">
                <div>
                  <span className="text-slate-400">Categoria: </span>
                  <strong className="text-slate-800">
                    {CATEGORY_LABELS[asset.category] || asset.category}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-400">Configuração: </span>
                  <p className="text-slate-700 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {asset.specifications ||
                      'Nenhuma especificação técnica detalhada informada.'}
                  </p>
                </div>
                {asset.notes && (
                  <div>
                    <span className="text-slate-400">Observações de TI: </span>
                    <p className="text-slate-600 italic mt-0.5">{asset.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                Dados Fiscais de Aquisição &amp; Garantia
              </h3>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Nota Fiscal (NF-e)
                  </span>
                  <span className="font-mono font-bold text-slate-800">
                    {asset.invoiceNumber || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Valor Contábil
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatCurrency(asset.purchaseValue)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-[11px] text-slate-400 block">
                    Fornecedor Homologado
                  </span>
                  <span className="font-semibold text-slate-800">
                    {asset.supplier || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Data de Compra
                  </span>
                  <span className="font-medium text-slate-700">
                    {formatDate(asset.purchaseDate)}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">
                    Garantia até
                  </span>
                  <span
                    className={`font-semibold ${
                      asset.warrantyUntil
                        ? isWarrantyValid
                          ? 'text-emerald-700'
                          : 'text-red-600'
                        : 'text-slate-600'
                    }`}
                  >
                    {formatDate(asset.warrantyUntil)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* Card 3: Timeline Cronológica de Movimentações e Termos */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <History className="w-4 h-4 text-blue-600" />
                Histórico Auditável de Movimentações &amp; Termos (
                {asset.movements?.length || 0})
              </h3>
              <span className="text-[11px] text-slate-400">
                Clique em &quot;Baixar Termo PDF&quot; para reimprimir qualquer
                documento
              </span>
            </div>

            <div className="relative pl-5 border-l-2 border-slate-200 space-y-4">
              {(asset.movements || []).map((mov: AssetMovementRecord) => {
                const meta =
                  MOVEMENT_TYPE_META[mov.type] ||
                  MOVEMENT_TYPE_META.MOVIMENTACAO_ENTREGA;
                return (
                  <div
                    key={mov.id}
                    className="relative bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2.5"
                  >
                    <span className="w-3 h-3 rounded-full bg-blue-600 ring-4 ring-white absolute -left-[23px] top-4" />

                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${meta.colorClass}`}
                        >
                          {meta.label}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-700">
                          {mov.termNumber}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          onRequestExportTerm
                            ? onRequestExportTerm(asset, mov)
                            : downloadAssetTermPdf(asset, mov)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer"
                        title={`Configurar assinaturas e baixar PDF do termo ${mov.termNumber}`}
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>Baixar Termo PDF</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-700 leading-relaxed">
                      {mov.reason}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                      <div>
                        <span>Origem ➔ Destino: </span>
                        <strong className="text-slate-700">
                          {mov.fromUserName || 'Origem'} ➔{' '}
                          {mov.toUserName || 'Destino'}
                        </strong>
                      </div>
                      <div>
                        <span>Analista Executor: </span>
                        <strong className="text-slate-700">
                          {mov.performedByName}
                        </strong>
                      </div>
                      {mov.accessoriesIncluded && (
                        <div className="sm:col-span-2">
                          <span>Acessórios registrados: </span>
                          <strong className="text-slate-700">
                            {mov.accessoriesIncluded}
                          </strong>
                        </div>
                      )}
                      {mov.disposalMethod && (
                        <div className="sm:col-span-2 text-red-700">
                          <span>Destinação da Baixa: </span>
                          <strong>{mov.disposalMethod}</strong>
                        </div>
                      )}
                      <div className="sm:col-span-2 flex items-center gap-1 text-slate-400 font-mono">
                        <Calendar className="w-3 h-3" />
                        <span>
                          {new Date(mov.createdAt).toLocaleString('pt-BR')} ·
                          Estado Físico: {mov.conditionAtMoment}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {(!asset.movements || asset.movements.length === 0) && (
                <div className="text-xs text-slate-400 py-4">
                  Nenhuma movimentação registrada para este equipamento.
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

