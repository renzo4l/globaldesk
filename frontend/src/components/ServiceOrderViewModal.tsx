import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileCheck,
  FileDown,
  Loader2,
  Printer,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import { ServiceOrder } from '../types/itsm';
import { downloadServiceOrderPdf } from '../utils/pdfExport';
import { LOGO_PATHS } from '../assets/logos';
import { useAnimatedPresence } from '../utils/useAnimatedPresence';

interface ServiceOrderViewModalProps {
  order: ServiceOrder | null;
  onClose: () => void;
}

export const ServiceOrderViewModal: React.FC<ServiceOrderViewModalProps> = ({
  order: orderProp,
  onClose,
}) => {
  const { renderedValue: order, isClosing } = useAnimatedPresence(orderProp, 180);
  const [isExporting, setIsExporting] = useState(false);
  const [leftSignerName, setLeftSignerName] = useState('');
  const [leftSignerRole, setLeftSignerRole] = useState('');
  const [rightSignerName, setRightSignerName] = useState('');
  const [rightSignerRole, setRightSignerRole] = useState('');

  useEffect(() => {
    if (order) {
      setLeftSignerName(order.technicianName);
      setLeftSignerRole(`Analista Executor (${order.technicianTier}) · Service Desk`);
      setRightSignerName(order.requesterName);
      setRightSignerRole(`Solicitante · Depto. ${order.department}`);
    }
  }, [order]);

  useEffect(() => {
    if (!order) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [order, onClose]);

  if (!order) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleExportPdf = () => {
    setIsExporting(true);
    setTimeout(() => {
      try {
        downloadServiceOrderPdf(order, {
          leftSignerName,
          leftSignerRole,
          rightSignerName,
          rightSignerRole,
        });
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="os-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200">
                Documento de Registro Técnico
              </span>
              <span className="font-mono text-xs font-bold text-slate-700">
                {order.id}
              </span>
            </div>
            <h2
              id="os-modal-title"
              className="text-lg font-bold text-slate-900 leading-snug flex items-center gap-2"
            >
              <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
              Ordem de Serviço (O.S.) — Finalização
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              title="Baixar Ordem de Serviço em documento PDF formatado"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Exportando...' : 'Exportar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimir
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar O.S."
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Document Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 text-xs">
          {/* Official Letterhead */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={LOGO_PATHS.dark} alt="Grupo Global" className="h-9 object-contain" />
              <div>
                <div className="font-bold text-sm text-slate-900 tracking-tight">
                  GRUPO GLOBAL · SERVICE DESK CORPORATIVO
                </div>
                <div className="text-slate-500 text-[11px]">
                  Central Unificada de Atendimento &amp; Gestão de Incidentes
                </div>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="font-mono font-bold text-sm text-blue-700">
                {order.id}
              </div>
              <div className="text-[11px] font-medium text-emerald-700 flex items-center gap-1 sm:justify-end">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Atendimento Concluído &amp; Homologado
              </div>
            </div>
          </div>

          {/* Section 1: Dados do Chamado Original */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center justify-between">
              <span>1. Dados do Chamado de Origem</span>
              <span className="font-mono text-blue-600">{order.ticketId}</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Solicitante:</span>
                <strong className="text-slate-900">{order.requesterName}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">E-mail:</span>
                <span className="text-slate-700 font-mono text-[11px]">{order.requesterEmail}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Departamento:</span>
                <strong className="text-slate-900">{order.department}</strong>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-slate-500 block">Assunto / Descrição Original:</span>
              <p className="font-semibold text-slate-900 mt-0.5">{order.ticketTitle}</p>
              {order.ticketDescription && (
                <p className="text-slate-600 mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/70 text-[11px] leading-relaxed">
                  {order.ticketDescription}
                </p>
              )}
            </div>
          </div>

          {/* Section 2: Cronologia & SLA */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-2.5">
            <div className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              2. Cronograma de Atendimento &amp; Tempo Total
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-slate-500 block">Início do Chamado:</span>
                <strong className="text-slate-900">{order.startedAt}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Finalização:</span>
                <strong className="text-slate-900">{order.finalizedAt}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tempo Decorrido:</span>
                <strong className="text-slate-900 font-mono">{order.durationText}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Avaliação do SLA:</span>
                <span
                  className={`inline-block font-bold px-2 py-0.5 rounded text-[11px] ${
                    order.slaMet
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {order.slaMet ? 'Dentro da Meta' : 'Excedido'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Execução Técnica e Parecer */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="font-bold text-slate-800 text-xs border-b border-slate-100 pb-1.5 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-blue-600" />
              3. Execução Técnica &amp; Parecer Conclusivo
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-500 block">Analista Executor:</span>
                <strong className="text-slate-900">
                  {order.technicianName} ({order.technicianTier})
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tipo de Intervenção:</span>
                <strong className="text-slate-900">{order.interventionType}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Desfecho da O.S.:</span>
                <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                  order.finalizationOutcome === 'concluido_sucesso'
                    ? 'bg-emerald-100 text-emerald-800'
                    : order.finalizationOutcome === 'solucao_contorno'
                    ? 'bg-amber-100 text-amber-900'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {order.outcomeLabel || 'Concluído'}
                </span>
              </div>
            </div>

            {order.nonCompletionReason && (
              <div className="bg-red-50/60 border border-red-200 p-3 rounded-lg text-red-900 space-y-1">
                <span className="font-bold text-[11px] uppercase tracking-wide block text-red-800">
                  Justificativa de Impedimento / Não Conclusão:
                </span>
                <p className="leading-relaxed font-medium">{order.nonCompletionReason}</p>
              </div>
            )}

            <div>
              <span className="text-slate-500 block mb-1">
                {order.finalizationOutcome === 'nao_concluido' || order.finalizationOutcome === 'cancelado_usuario'
                  ? 'Laudo Técnico Conclusivo do Atendimento:'
                  : 'Laudo Técnico & Solução Aplicada:'}
              </span>
              <div className="bg-slate-50 border border-slate-200 p-3 rounded-lg text-slate-900 leading-relaxed font-medium">
                {order.solutionSummary}
              </div>
            </div>

            {order.partsOrSupplies && (
              <div>
                <span className="text-slate-500 block mb-0.5">
                  Peças / Materiais / Licenças Utilizadas:
                </span>
                <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg text-slate-800">
                  {order.partsOrSupplies}
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Aceite e Assinatura */}
          <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/40">
            <div className="font-bold text-slate-800 text-xs border-b border-slate-200 pb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              4. Aceite &amp; Validação do Solicitante
            </div>

            <p className="text-slate-700 italic">
              "{order.clientAcceptance}"
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  1ª Assinatura no PDF (Analista Executor)
                </span>
                <input
                  type="text"
                  value={leftSignerName}
                  onChange={(e) => setLeftSignerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
                  placeholder="Nome do Analista"
                />
                <input
                  type="text"
                  value={leftSignerRole}
                  onChange={(e) => setLeftSignerRole(e.target.value)}
                  className="w-full px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
                  placeholder="Cargo / Nível"
                />
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">
                  2ª Assinatura no PDF (Solicitante / Recebedor)
                </span>
                <input
                  type="text"
                  value={rightSignerName}
                  onChange={(e) => setRightSignerName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
                  placeholder="Nome do Solicitante"
                />
                <input
                  type="text"
                  value={rightSignerRole}
                  onChange={(e) => setRightSignerRole(e.target.value)}
                  className="w-full px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
                  placeholder="Departamento / Cargo"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <span className="text-slate-500 text-[11px]">
            Ordem de Serviço salva permanentemente na Área do Técnico
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={isExporting}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white border border-blue-600 hover:bg-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileDown className="w-3.5 h-3.5" />
              )}
              <span>{isExporting ? 'Gerando Documento...' : 'Exportar PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
