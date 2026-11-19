import {
  AssetCategory,
  AssetCondition,
  Department,
  PriorityLevel,
} from '../types/itsm';

export const CORPORATE_DEPARTMENTS: Department[] = [
  'Financeiro & Contabilidade',
  'Recursos Humanos',
  'Operações & Logística',
  'Comercial & Vendas',
  'Engenharia & TI',
  'Jurídico & Compliance',
  'Diretoria Executiva',
  'Suprimentos & Compras',
];

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  COMPUTADOR: 'Computador / Desktop',
  NOTEBOOK: 'Notebook Corporativo',
  MONITOR: 'Monitor de Vídeo',
  PERIFERICO: 'Periférico / Acessório',
  IMPRESSORA: 'Impressora / Multifuncional',
  REDE_SERVIDOR: 'Ativo de Rede / Servidor',
  CELULAR_TABLET: 'Smartphone / Tablet',
  LICENCA_SOFTWARE: 'Licença de Software',
  OUTROS: 'Outros Equipamentos',
};

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
  NOVO: 'Novo (Zero Uso)',
  BOM: 'Bom Estado (Operacional)',
  DESGASTADO: 'Desgastado (Marcas de Uso)',
  DEFEITUOSO: 'Defeituoso / Inoperante',
};

export function formatCurrencyBR(
  value?: number | null,
  fallback = 'Não informado'
): string {
  if (value === undefined || value === null || Number.isNaN(Number(value))) {
    return fallback;
  }
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value));
}

export function formatDateBR(
  dateStr?: string | null,
  fallback = 'Não informado'
): string {
  if (!dateStr) return fallback;
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('pt-BR');
}

export function formatDateTimeBR(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleString('pt-BR');
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleString('pt-BR');
}

/**
 * Formata timestamps de chamados preservando a distinção entre hoje ("Hoje, HH:mm")
 * e datas anteriores ("DD/MM, HH:mm").
 */
export function formatTicketTimestamp(
  rawDate?: string | null,
  fallback = 'Agora'
): string {
  if (!rawDate) return fallback;
  const timeMs = Date.parse(rawDate);
  if (Number.isNaN(timeMs)) return rawDate;

  const date = new Date(timeMs);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timePart = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isToday) {
    return `Hoje, ${timePart}`;
  }

  const datePart = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  });
  return `${datePart}, ${timePart}`;
}

export function getPriorityBadgeClasses(priority: PriorityLevel): string {
  switch (priority) {
    case 'Crítica':
      return 'bg-red-50 text-red-700 border-red-300';
    case 'Alta':
      return 'bg-orange-50 text-orange-700 border-orange-300';
    case 'Média':
      return 'bg-amber-50 text-amber-700 border-amber-300';
    case 'Baixa':
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}
