import React, { useEffect } from 'react';
import { ShieldCheck, Users, X, Clock, Layers } from 'lucide-react';
import {
  ImpactLevel,
  Technician,
  UrgencyLevel,
} from '../types/itsm';
import {
  ITIL_PRIORITY_MATRIX,
  SLA_POLICY_BY_PRIORITY,
} from '../utils/itilRules';
import { LOGO_PATHS } from '../assets/logos';
import { useAnimatedOpen } from '../utils/useAnimatedPresence';

interface ItilGovernanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  technicians: Technician[];
}

export const ItilGovernanceModal: React.FC<ItilGovernanceModalProps> = ({
  isOpen,
  onClose,
  technicians,
}) => {
  const { shouldRender, isClosing } = useAnimatedOpen(isOpen, 180);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="governance-modal-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative bg-white rounded-xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-blue-50/40">
          <div className="flex items-center gap-2.5">
            <img src={LOGO_PATHS.dark} alt="Grupo Global" className="h-5 object-contain" />
            <span className="text-slate-300">|</span>
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <h2
              id="governance-modal-title"
              className="text-base font-bold text-slate-900"
            >
              Diretrizes Operacionais Grupo Global · Matriz de Prioridade, SLA &amp; Escalonamento
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar janela de diretrizes"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* 1. Matriz de Prioridade */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-700" />
              1. Matriz de Cálculo Dinâmico de Prioridade (Impacto × Urgência)
            </h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Impacto / Abrangência</th>
                    <th className="p-3">Urgência Crítica</th>
                    <th className="p-3">Urgência Alta</th>
                    <th className="p-3">Urgência Média</th>
                    <th className="p-3">Urgência Baixa</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(
                    ['Organização', 'Setor', 'Usuário Único'] as ImpactLevel[]
                  ).map((imp) => (
                    <tr key={imp}>
                      <td className="p-3 font-semibold text-slate-900 bg-slate-50/50">
                        {imp}
                      </td>
                      {(
                        ['Crítica', 'Alta', 'Média', 'Baixa'] as UrgencyLevel[]
                      ).map((urg) => {
                        const prio = ITIL_PRIORITY_MATRIX[imp][urg];
                        const policy = SLA_POLICY_BY_PRIORITY[prio];
                        return (
                          <td key={urg} className="p-3 font-medium">
                            <span className="font-semibold text-slate-900">
                              {prio}
                            </span>{' '}
                            <span className="font-mono text-slate-500">
                              ({policy.code})
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* 2. Metas de SLA */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-700" />
              2. Acordos de Nível de Serviço (SLA) por Prioridade
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.values(SLA_POLICY_BY_PRIORITY).map((policy) => (
                <div
                  key={policy.code}
                  className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {policy.priority}
                    </span>
                    <span className="font-mono font-semibold px-2 py-0.5 rounded bg-blue-600 text-white">
                      {policy.code}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-slate-200/80">
                    <div className="flex justify-between">
                      <span className="text-slate-500">1ª Resposta:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {policy.firstResponseLabel}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Resolução:</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {policy.resolutionLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
                    {policy.escalationRule}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Equipe de Técnicos e Escalonamento */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-700" />
              3. Estrutura de Técnicos &amp; Matriz de Escalonamento Funcional/Hierárquico
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {technicians.map((tech) => (
                <div
                  key={tech.id}
                  className="p-3.5 rounded-lg border border-slate-200 bg-white space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-sm">
                      {tech.fullName}
                    </span>
                    <span className="font-mono font-semibold text-slate-700">
                      {tech.tier}
                    </span>
                  </div>
                  <div className="text-slate-600 font-medium">{tech.role}</div>
                  <div className="text-[11px] text-slate-500 pt-1">
                    Especialidades: {tech.specialties.join(' · ')}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
