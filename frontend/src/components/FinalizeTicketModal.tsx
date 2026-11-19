import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileCheck,
  FileText,
  PenTool,
  X,
} from 'lucide-react';
import {
  FinalizationOutcome,
  InterventionType,
  SupportTier,
  Technician,
  TechnicianId,
  Ticket,
} from '../types/itsm';
import { formatMinutesDuration } from '../utils/itilRules';
import type { CustomOsSigners } from '../utils/pdfExport';
import { LOGO_PATHS } from '../assets/logos';
import { useAnimatedPresence } from '../utils/useAnimatedPresence';

interface FinalizeTicketModalProps {
  isOpen: boolean;
  ticket: Ticket | null;
  technicians: Technician[];
  activeTechActor: Technician;
  nextOsNumber: number;
  onClose: () => void;
  onConfirmFinalize: (finalizationData: {
    ticketId: string;
    osNumber: string;
    technicianId: TechnicianId;
    technicianName: string;
    technicianTier: SupportTier;
    startedAt: string;
    finalizedAt: string;
    durationText: string;
    interventionType: InterventionType;
    finalizationOutcome: FinalizationOutcome;
    outcomeLabel: string;
    solutionSummary: string;
    nonCompletionReason?: string;
    partsOrSupplies?: string;
    clientAcceptance: string;
    customSigners?: CustomOsSigners;
  }) => void;
}

const INTERVENTION_TYPES: InterventionType[] = [
  'Suporte Remoto',
  'Atendimento Presencial',
  'Configuração de Software',
  'Manutenção de Hardware',
  'Infraestrutura / Redes',
];

const FINALIZATION_OUTCOMES: {
  id: FinalizationOutcome;
  label: string;
  badgeClass: string;
  isResolved: boolean;
  desc: string;
}[] = [
  {
    id: 'concluido_sucesso',
    label: 'Concluído com Sucesso',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    isResolved: true,
    desc: 'Ocorrência resolvida integralmente ou requisição entregue com validação.',
  },
  {
    id: 'solucao_contorno',
    label: 'Concluído com Solução de Contorno (Workaround)',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    isResolved: true,
    desc: 'Serviço restabelecido provisoriamente; causa raiz exigirá intervenção programada.',
  },
  {
    id: 'nao_concluido',
    label: 'Encerrado sem Conclusão / Inviabilidade Técnica',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    isResolved: false,
    desc: 'Atendimento não pôde ser completado por inviabilidade física, perda total de equipamento ou impedimento técnico.',
  },
  {
    id: 'cancelado_usuario',
    label: 'Cancelado pelo Solicitante',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
    isResolved: false,
    desc: 'Usuário informou desistência, abertura em duplicidade ou resolução autônoma prévia.',
  },
  {
    id: 'fora_escopo',
    label: 'Rejeitado / Fora do Escopo de TI',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    isResolved: false,
    desc: 'Demanda não atende às políticas corporativas ou não pertence ao catálogo homologado.',
  },
];

export const FinalizeTicketModal: React.FC<FinalizeTicketModalProps> = ({
  isOpen,
  ticket: ticketProp,
  technicians,
  activeTechActor,
  nextOsNumber,
  onClose,
  onConfirmFinalize,
}) => {
  const { renderedValue: ticket, isClosing } = useAnimatedPresence(
    isOpen ? ticketProp : null,
    180
  );
  const [selectedTechId, setSelectedTechId] = useState<TechnicianId>(
    ticketProp?.assigneeId || activeTechActor.id
  );
  const [startedAt, setStartedAt] = useState('Hoje, 08:00');
  const [finalizedAt, setFinalizedAt] = useState('Hoje, 11:00');
  const [interventionType, setInterventionType] =
    useState<InterventionType>('Suporte Remoto');
  const [finalizationOutcome, setFinalizationOutcome] =
    useState<FinalizationOutcome>('concluido_sucesso');
  const [solutionSummary, setSolutionSummary] = useState('');
  const [nonCompletionReason, setNonCompletionReason] = useState('');
  const [partsOrSupplies, setPartsOrSupplies] = useState('');
  const [clientAcceptance, setClientAcceptance] = useState(
    'Serviço validado e aprovado com o solicitante via canal corporativo.'
  );
  const [leftSignerName, setLeftSignerName] = useState(activeTechActor.name);
  const [leftSignerRole, setLeftSignerRole] = useState(
    `Analista Executor (${activeTechActor.tier}) · Service Desk`
  );
  const [rightSignerName, setRightSignerName] = useState('');
  const [rightSignerRole, setRightSignerRole] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && ticket) {
      const nowFormatted = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date());

      const initialTechId = ticket.assigneeId || activeTechActor.id;
      const initialTech =
        technicians.find((t) => t.id === initialTechId) || activeTechActor;

      setSelectedTechId(initialTechId);
      setStartedAt(ticket.createdAt || 'Hoje, 08:00');
      setFinalizedAt(`Hoje, ${nowFormatted.split(' ')[1] || '11:00'}`);
      setInterventionType('Suporte Remoto');
      setFinalizationOutcome('concluido_sucesso');
      setSolutionSummary('');
      setNonCompletionReason('');
      setPartsOrSupplies('');
      setClientAcceptance(
        'Serviço validado e aprovado com o solicitante via canal corporativo.'
      );
      setLeftSignerName(initialTech.name);
      setLeftSignerRole(
        `Analista Executor (${initialTech.tier}) · Service Desk`
      );
      setRightSignerName(ticket.requesterName);
      setRightSignerRole(`Solicitante · Depto. ${ticket.department}`);
      setErrorMsg('');
    }
  }, [isOpen, ticket, activeTechActor, technicians]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!ticket) return null;

  const osCode = `OS-2026-${String(nextOsNumber).padStart(4, '0')}`;

  const currentOutcomeObj =
    FINALIZATION_OUTCOMES.find((o) => o.id === finalizationOutcome) ||
    FINALIZATION_OUTCOMES[0];

  const isCompletedOutcome = currentOutcomeObj.isResolved;

  // Calculate elapsed time
  const elapsedMinutes = Math.max(
    20,
    ticket.sla.resolutionTargetMinutes - ticket.sla.resolutionRemainingMinutes
  );
  const durationText = formatMinutesDuration(elapsedMinutes);
  const isSlaMet = ticket.sla.resolutionRemainingMinutes >= 0;

  const selectedTech =
    technicians.find((t) => t.id === selectedTechId) || activeTechActor;

  const handleTechChange = (techId: TechnicianId) => {
    setSelectedTechId(techId);
    const tech = technicians.find((t) => t.id === techId);
    if (tech) {
      setLeftSignerName(tech.name);
      setLeftSignerRole(`Analista Executor (${tech.tier}) · Service Desk`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isCompletedOutcome && !nonCompletionReason.trim()) {
      setErrorMsg(
        'Informe o motivo detalhado do impedimento ou cancelamento para registrar a não conclusão do chamado.'
      );
      return;
    }

    if (!solutionSummary.trim()) {
      setErrorMsg(
        isCompletedOutcome
          ? 'O parecer técnico e descrição da solução aplicada são obrigatórios para emissão da O.S.'
          : 'O laudo técnico conclusivo é obrigatório para registrar o desfecho da O.S.'
      );
      return;
    }

    onConfirmFinalize({
      ticketId: ticket.id,
      osNumber: osCode,
      technicianId: selectedTech.id,
      technicianName: selectedTech.name,
      technicianTier: selectedTech.tier,
      startedAt: startedAt.trim(),
      finalizedAt: finalizedAt.trim(),
      durationText,
      interventionType,
      finalizationOutcome,
      outcomeLabel: currentOutcomeObj.label,
      solutionSummary: solutionSummary.trim(),
      nonCompletionReason: !isCompletedOutcome
        ? nonCompletionReason.trim()
        : undefined,
      partsOrSupplies: partsOrSupplies.trim() || undefined,
      clientAcceptance: clientAcceptance.trim(),
      customSigners: {
        leftSignerName: leftSignerName.trim() || selectedTech.name,
        leftSignerRole:
          leftSignerRole.trim() ||
          `Analista Executor (${selectedTech.tier}) · Service Desk`,
        rightSignerName: rightSignerName.trim() || ticket.requesterName,
        rightSignerRole:
          rightSignerRole.trim() ||
          `Solicitante · Depto. ${ticket.department}`,
      },
    });

    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="finalize-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2">
              <img
                src={LOGO_PATHS.dark}
                alt="Grupo Global"
                className="h-5 object-contain"
              />
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                Ordem de Serviço (O.S.)
              </span>
              <span className="font-mono text-xs font-semibold text-blue-600">
                {osCode}
              </span>
            </div>
            <h2
              id="finalize-modal-title"
              className="text-lg font-bold text-slate-900 leading-snug flex items-center gap-2"
            >
              <FileCheck className="w-5 h-5 text-blue-600 shrink-0" />
              Finalização de Chamado &amp; Emissão de O.S.
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar pop-up de finalização"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {errorMsg && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2 animate-in fade-in duration-150"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 1. Resumo do Chamado Inicial */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Chamado Inicial de Referência
              </span>
              <span className="font-mono text-xs font-semibold text-blue-700">
                {ticket.id}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-500 block">Solicitante:</span>
                <strong className="text-slate-800">
                  {ticket.requesterName}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Setor:</span>
                <strong className="text-slate-800">{ticket.department}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Categoria:</span>
                <strong className="text-slate-800">{ticket.category}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Prioridade:</span>
                <strong className="text-slate-800">{ticket.priority}</strong>
              </div>
            </div>

            <div className="text-xs pt-1">
              <span className="text-slate-500 block">Assunto Original:</span>
              <p className="font-semibold text-slate-900 mt-0.5">
                {ticket.title}
              </p>
            </div>
          </div>

          {/* 2. Seleção do Desfecho / Tipo de Finalização */}
          <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
            <label
              htmlFor="modal-outcome-select"
              className="block text-xs font-bold text-slate-900"
            >
              Desfecho do Chamado (Tipo de Finalização)
            </label>
            <select
              id="modal-outcome-select"
              value={finalizationOutcome}
              onChange={(e) => {
                setFinalizationOutcome(e.target.value as FinalizationOutcome);
                setErrorMsg('');
              }}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {FINALIZATION_OUTCOMES.map((out) => (
                <option key={out.id} value={out.id}>
                  {out.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-600 leading-normal">
              {currentOutcomeObj.desc}
            </p>

            {!isCompletedOutcome && (
              <div className="pt-2 border-t border-slate-100 animate-in fade-in duration-150">
                <div className="flex items-center gap-1.5 text-amber-800 text-xs font-semibold mb-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Encerramento sem conclusão operacional:</span>
                </div>
                <label
                  htmlFor="non-completion-reason"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Motivo Conclusivo do Impedimento ou Cancelamento (Obrigatório)
                </label>
                <textarea
                  id="non-completion-reason"
                  rows={2}
                  value={nonCompletionReason}
                  onChange={(e) => {
                    setNonCompletionReason(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-red-50/40 border border-red-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-red-500"
                />
              </div>
            )}
          </div>

          {/* 3. Cronologia e SLA da O.S. */}
          <div className="p-4 rounded-xl border border-blue-200/80 bg-blue-50/30 space-y-3">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Cronograma &amp; Cumprimento de SLA
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="os-started-at"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Data &amp; Hora de Início
                </label>
                <input
                  id="os-started-at"
                  type="text"
                  value={startedAt}
                  onChange={(e) => setStartedAt(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label
                  htmlFor="os-finalized-at"
                  className="block text-[11px] font-semibold text-slate-700 mb-1"
                >
                  Data &amp; Hora de Finalização
                </label>
                <input
                  id="os-finalized-at"
                  type="text"
                  value={finalizedAt}
                  onChange={(e) => setFinalizedAt(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <span className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Duração do Atendimento
                </span>
                <div className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono font-semibold text-slate-900 flex items-center justify-between">
                  <span>{durationText}</span>
                  <span
                    className={`text-[11px] font-sans font-bold px-1.5 py-0.2 rounded ${
                      isSlaMet
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-red-700 bg-red-50'
                    }`}
                  >
                    {isSlaMet ? 'SLA Cumprido' : 'SLA Excedido'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Parâmetros da Ordem de Serviço */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="os-tech-executor"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Técnico Executor Responsável pela O.S.
                </label>
                <select
                  id="os-tech-executor"
                  value={selectedTechId}
                  onChange={(e) =>
                    handleTechChange(e.target.value as TechnicianId)
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.tier}) — {t.role.split('·')[0]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="os-intervention-type"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Tipo de Intervenção Realizada
                </label>
                <select
                  id="os-intervention-type"
                  value={interventionType}
                  onChange={(e) =>
                    setInterventionType(e.target.value as InterventionType)
                  }
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {INTERVENTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Parecer Técnico e Solução Aplicada */}
            <div>
              <label
                htmlFor="os-solution-summary"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                {isCompletedOutcome
                  ? 'Diagnóstico Conclusivo & Solução Aplicada (Parecer da O.S.)'
                  : 'Parecer Técnico do Desfecho / Laudo de Encerramento'}
              </label>
              <textarea
                id="os-solution-summary"
                rows={3}
                value={solutionSummary}
                onChange={(e) => {
                  setSolutionSummary(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className={`w-full px-3 py-2 text-xs sm:text-sm bg-white border rounded-lg text-slate-900 focus:outline-none focus:ring-2 ${
                  isCompletedOutcome
                    ? 'border-slate-300 focus:ring-emerald-600'
                    : 'border-slate-300 focus:ring-blue-600'
                }`}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                {isCompletedOutcome
                  ? 'Descreva os procedimentos executados, testes de conformidade e o estado final do serviço restaurado.'
                  : 'Registre o parecer final, orientações fornecidas ao solicitante e eventuais encaminhamentos necessários.'}
              </p>
            </div>

            {/* Peças / Insumos Utilizados */}
            <div>
              <label
                htmlFor="os-parts-supplies"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Peças, Materiais ou Licenças Utilizadas (Opcional)
              </label>
              <input
                id="os-parts-supplies"
                type="text"
                value={partsOrSupplies}
                onChange={(e) => setPartsOrSupplies(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Exemplo: Cabo HDMI 2.0, Memória RAM 16GB, Licença MS365 E5 ou
                deixe vazio se não houve troca física.
              </p>
            </div>

            {/* Aceite e Validação do Solicitante */}
            <div>
              <label
                htmlFor="os-client-acceptance"
                className="block text-xs font-semibold text-slate-800 mb-1"
              >
                Aceite &amp; Validação do Solicitante
              </label>
              <input
                id="os-client-acceptance"
                type="text"
                value={clientAcceptance}
                onChange={(e) => setClientAcceptance(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>

            {/* 5. Personalização dos Nomes das Assinaturas no PDF */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-blue-600" />
                  Nomes para Assinatura no PDF da O.S. (Editável)
                </span>
                <span className="text-[11px] text-slate-400">
                  Personalize antes de emitir
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    1ª Assinatura (Analista Executor)
                  </span>
                  <input
                    type="text"
                    value={leftSignerName}
                    onChange={(e) => setLeftSignerName(e.target.value)}
                    placeholder="Nome do Analista"
                    className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
                  />
                  <input
                    type="text"
                    value={leftSignerRole}
                    onChange={(e) => setLeftSignerRole(e.target.value)}
                    placeholder="Cargo / Nível"
                    className="w-full px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">
                    2ª Assinatura (Solicitante / Recebedor)
                  </span>
                  <input
                    type="text"
                    value={rightSignerName}
                    onChange={(e) => setRightSignerName(e.target.value)}
                    placeholder="Nome do Solicitante"
                    className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
                  />
                  <input
                    type="text"
                    value={rightSignerRole}
                    onChange={(e) => setRightSignerRole(e.target.value)}
                    placeholder="Setor / Cargo"
                    className="w-full px-2.5 py-1 text-[11px] text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 text-xs font-semibold text-white rounded-lg transition-all active-press flex items-center gap-1.5 shadow-xs cursor-pointer bg-blue-600 hover:bg-blue-700"
          >
            {isCompletedOutcome ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <FileCheck className="w-4 h-4" />
            )}
            Concluir Chamado &amp; Emitir O.S. PDF
          </button>
        </div>
      </div>
    </div>
  );
};
