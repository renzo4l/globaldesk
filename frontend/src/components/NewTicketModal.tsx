import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Lightbulb,
  Paperclip,
  PlusCircle,
  ShieldAlert,
  Sparkles,
  Trash2,
  UploadCloud,
  X,
} from 'lucide-react';
import {
  Department,
  ImpactLevel,
  KnowledgeArticle,
  PriorityLevel,
  TicketAttachment,
  TicketCategory,
  TicketType,
  UrgencyLevel,
} from '../types/itsm';
import {
  calculateItilPriority,
  SLA_POLICY_BY_PRIORITY,
  suggestContextualArticlesForTicket,
} from '../utils/itilRules';
import { CORPORATE_DEPARTMENTS as DEPARTMENTS } from '../utils/formatters';
import { KNOWLEDGE_BASE_ARTICLES } from '../data/mockData';
import { LOGO_PATHS } from '../assets/logos';
import { useAnimatedOpen } from '../utils/useAnimatedPresence';

export interface PrefillTicketDraft {
  title?: string;
  description?: string;
  category?: TicketCategory;
  type?: TicketType;
  impact?: ImpactLevel;
  urgency?: UrgencyLevel;
  sourceArticleCode?: string;
}

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTicket: (ticketData: {
    title: string;
    description: string;
    type: TicketType;
    category: TicketCategory;
    department: Department;
    impact: ImpactLevel;
    urgency: UrgencyLevel;
    attachments: TicketAttachment[];
    requesterName?: string;
    requesterEmail?: string;
  }) => void;
  initialCategory?: TicketCategory;
  initialType?: TicketType;
  initialDraft?: PrefillTicketDraft | null;
  articles?: KnowledgeArticle[];
  defaultRequester?: {
    name?: string;
    email?: string;
    department?: Department;
  } | null;
}

const CATEGORIES: { value: TicketCategory; label: string; hint: string }[] = [
  {
    value: 'Hardware',
    label: 'Hardware & Periféricos',
    hint: 'Notebooks, monitores, docas USB-C, baterias, teclados e mouses',
  },
  {
    value: 'Acessos/Sistemas',
    label: 'Acessos, Contas & Segurança',
    hint: 'Reset de senha, Authenticator e pastas',
  },
  {
    value: 'Software',
    label: 'Softwares & Licenciamento',
    hint: 'Microsoft 365, VS Code, Adobe Acrobat e plugins',
  },
  {
    value: 'Rede',
    label: 'Rede & Conectividade',
    hint: 'Wi-Fi corporativo 802.1X, lentidão de link, cabeamento estruturado e DNS',
  },
  {
    value: 'Telefonia',
    label: 'Telefonia & Ramais VoIP',
    hint: 'Ramais IP, aparelhos de mesa, headsets e conferências',
  },
];

const IMPACT_OPTIONS: {
  level: ImpactLevel;
  shortTitle: string;
  friendlyLabel: string;
  desc: string;
}[] = [
    {
      level: 'Usuário Único',
      shortTitle: 'Apenas para mim',
      friendlyLabel: 'Individual (Usuário Único)',
      desc: 'Afeta somente minha estação de trabalho ou meu acesso individual',
    },
    {
      level: 'Setor',
      shortTitle: 'Afeta todo o setor',
      friendlyLabel: 'Setorial (Departamento / Equipe)',
      desc: 'Interrompe ou degrada as atividades de vários colegas do mesmo departamento',
    },
    {
      level: 'Organização',
      shortTitle: 'Afeta toda a empresa',
      friendlyLabel: 'Crítico Corporativo (Organização)',
      desc: 'Indisponibilidade sistêmica que paralisa múltiplas unidades ou toda a empresa',
    },
  ];

const URGENCY_OPTIONS: {
  level: UrgencyLevel;
  friendlyLabel: string;
  desc: string;
}[] = [
    {
      level: 'Baixa',
      friendlyLabel: 'Baixa — Solicitação programável',
      desc: 'Posso continuar trabalhando normalmente enquanto aguardo o atendimento',
    },
    {
      level: 'Média',
      friendlyLabel: 'Média — Alternativa temporária disponível',
      desc: 'Há impacto parcial no meu fluxo, mas consigo contornar provisoriamente',
    },
    {
      level: 'Alta',
      friendlyLabel: 'Alta — Atividade principal comprometida',
      desc: 'Meu trabalho principal está travado ou com severa degradação operacional',
    },
    {
      level: 'Crítica',
      friendlyLabel: 'Crítica — Parada imediata sem contingência',
      desc: 'Operação inadiável totalmente parada sem nenhuma alternativa viável',
    },
  ];

export const NewTicketModal: React.FC<NewTicketModalProps> = ({
  isOpen,
  onClose,
  onCreateTicket,
  initialCategory = 'Acessos/Sistemas',
  initialType = 'Incidente',
  initialDraft = null,
  articles = KNOWLEDGE_BASE_ARTICLES,
  defaultRequester = null,
}) => {
  const { shouldRender, isClosing } = useAnimatedOpen(isOpen, 180);
  const [ticketType, setTicketType] = useState<TicketType>(initialType);
  const [category, setCategory] = useState<TicketCategory>(initialCategory);
  const [department, setDepartment] = useState<Department>(
    defaultRequester?.department || 'Engenharia & TI'
  );
  const [requesterName, setRequesterName] = useState(
    defaultRequester?.name || 'Mariana Siqueira'
  );
  const [requesterEmail, setRequesterEmail] = useState(
    defaultRequester?.email || 'mariana.siqueira@corporativo.com.br'
  );
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [impact, setImpact] = useState<ImpactLevel>('Usuário Único');
  const [urgency, setUrgency] = useState<UrgencyLevel>('Média');
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [fileNameInput, setFileNameInput] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [expandedSuggestionId, setExpandedSuggestionId] = useState<
    string | null
  >(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState(false);
  const [touchedFields, setTouchedFields] = useState<{
    title?: boolean;
    description?: boolean;
  }>({});
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    if (defaultRequester?.name) setRequesterName(defaultRequester.name);
    if (defaultRequester?.email) setRequesterEmail(defaultRequester.email);
    if (defaultRequester?.department) setDepartment(defaultRequester.department);
    if (initialDraft) {
      setTicketType(initialDraft.type || initialType);
      setCategory(initialDraft.category || initialCategory);
      setTitle(initialDraft.title || '');
      setDescription(initialDraft.description || '');
      setImpact(
        initialDraft.impact ||
        (initialDraft.type === 'Requisição de Serviço'
          ? 'Usuário Único'
          : 'Setor')
      );
      setUrgency(
        initialDraft.urgency ||
        (initialDraft.type === 'Requisição de Serviço' ? 'Baixa' : 'Alta')
      );
    } else {
      setTicketType(initialType);
      setCategory(initialCategory);
    }
    setDismissedSuggestions(false);
    setExpandedSuggestionId(null);
    setFormError('');
    setTouchedFields({});
  }, [isOpen, initialDraft, initialCategory, initialType, defaultRequester]);

  const contextualArticles = useMemo(() => {
    if (dismissedSuggestions) return [];
    return suggestContextualArticlesForTicket(articles, title, category, 2);
  }, [articles, title, category, dismissedSuggestions]);

  if (!shouldRender) return null;

  const computedPriority: PriorityLevel = calculateItilPriority(
    impact,
    urgency
  );
  const slaTarget = SLA_POLICY_BY_PRIORITY[computedPriority];

  const isTitleValid = title.trim().length >= 6;
  const isDescriptionValid = description.trim().length >= 12;

  const formatByteSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = Math.round(bytes / 1024);
    if (kb < 1024) return `${kb} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const added: TicketAttachment[] = Array.from(fileList).map((file, idx) => ({
      id: `att-${Date.now()}-${idx}`,
      fileName: file.name,
      fileSize: formatByteSize(file.size || 148000),
      fileType: file.type || 'application/octet-stream',
      uploadedAt: 'Agora',
      previewNote:
        'Evidência anexada via upload direto na abertura estruturada',
    }));
    setAttachments((prev) => [...prev, ...added]);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFilesSelected(e.dataTransfer.files);
    }
  };

  const handleAddNamedAttachment = () => {
    const trimmed = fileNameInput.trim();
    if (!trimmed) return;
    const hasExtension = /\.[a-z0-9]{2,5}$/i.test(trimmed);
    const normalizedName = hasExtension ? trimmed : `${trimmed}.png`;
    const newAtt: TicketAttachment = {
      id: `att-${Date.now()}`,
      fileName: normalizedName,
      fileSize: '214 KB',
      fileType: normalizedName.endsWith('.pdf')
        ? 'application/pdf'
        : normalizedName.endsWith('.log')
          ? 'text/plain'
          : 'image/png',
      uploadedAt: 'Agora',
      previewNote: 'Evidência anexada pelo solicitante na abertura do chamado',
    };
    setAttachments((prev) => [...prev, newAtt]);
    setFileNameInput('');
  };

  const handleQuickSampleAttachment = (
    sampleName: string,
    sampleSize: string,
    sampleType: string
  ) => {
    if (attachments.some((a) => a.fileName === sampleName)) return;
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        fileName: sampleName,
        fileSize: sampleSize,
        fileType: sampleType,
        uploadedAt: 'Agora',
        previewNote: 'Captura / log técnico anexado pelo colaborador',
      },
    ]);
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouchedFields({ title: true, description: true });

    if (!title.trim() || title.trim().length < 5) {
      setFormError(
        'Informe um assunto claro com pelo menos 5 caracteres para identificar sua solicitação.'
      );
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      setFormError(
        'Descreva os detalhes do ocorrido ou da necessidade operacional (mínimo de 10 caracteres).'
      );
      return;
    }

    onCreateTicket({
      title: title.trim(),
      description: description.trim(),
      type: ticketType,
      category,
      department,
      impact,
      urgency,
      attachments,
      requesterName: requesterName.trim() || 'Mariana Siqueira',
      requesterEmail:
        requesterEmail.trim() || 'mariana.siqueira@corporativo.com.br',
    });

    setTitle('');
    setDescription('');
    setAttachments([]);
    setFormError('');
    setTouchedFields({});
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/65 backdrop-blur-sm ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ticket-title"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div
        className={`relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 max-h-[93vh] flex flex-col overflow-hidden ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between gap-4">
          <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <img src={LOGO_PATHS.dark} alt="Grupo Global" className="h-5 object-contain" />
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-100 text-blue-800">
                Grupo Global Desk
              </span>
              <span className="text-xs text-slate-500 font-mono">
                Roteamento Automático N1 / N2 / N3
              </span>
              {initialDraft?.sourceArticleCode && (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-100 text-amber-900 border border-amber-200">
                  Originado de {initialDraft.sourceArticleCode}
                </span>
              )}
            </div>
            <h2
              id="modal-ticket-title"
              className="text-lg font-bold text-slate-900 leading-snug flex items-center gap-2"
            >
              <PlusCircle className="w-5 h-5 text-blue-600 shrink-0" />
              Formulário Inteligente de Abertura de Chamado
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar formulário de novo chamado"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {formError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2.5"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Diferenciação Clara Orientada às Práticas de Serviço */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              1. Como podemos classificar sua necessidade?
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setTicketType('Incidente');
                  if (urgency === 'Baixa') setUrgency('Alta');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${ticketType === 'Incidente'
                  ? 'border-red-600 bg-red-50/40 ring-1 ring-red-600 text-slate-900'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <ShieldAlert
                        className={`w-4 h-4 shrink-0 ${ticketType === 'Incidente'
                          ? 'text-red-600'
                          : 'text-slate-400'
                          }`}
                      />
                      Estou com uma falha / algo parou de funcionar
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Erro em sistema, queda de conexão, bloqueio inesperado de
                    acesso ou defeito físico em equipamento.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                  <span className="font-mono font-semibold text-red-700">
                    Classificação: Incidente
                  </span>
                  <span className="text-slate-500">Restauração de serviço</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setTicketType('Requisição de Serviço');
                  if (impact === 'Organização') setImpact('Usuário Único');
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${ticketType === 'Requisição de Serviço'
                  ? 'border-blue-600 bg-blue-50/50 ring-1 ring-blue-600 text-slate-900'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                  }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
                      <FileText
                        className={`w-4 h-4 shrink-0 ${ticketType === 'Requisição de Serviço'
                          ? 'text-blue-600'
                          : 'text-slate-400'
                          }`}
                      />
                      Preciso de um novo recurso, acesso ou equipamento
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Instalação de software homologado, liberação de permissão em
                    pasta/SAP, novo periférico ou configuração.
                  </p>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-200/70 flex items-center justify-between text-[11px]">
                  <span className="font-mono font-semibold text-blue-700">
                    Classificação: Requisição de Serviço
                  </span>
                  <span className="text-slate-500">Catálogo padrão</span>
                </div>
              </button>
            </div>
          </div>

          {/* 2. Assunto Claro + Sugestão Automática Contextual da Base de Conhecimento */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="modal-ticket-title-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                2. Assunto Resumido da Solicitação
              </label>
              <span
                className={`text-[11px] font-mono ${isTitleValid ? 'text-emerald-700 font-semibold' : 'text-slate-400'
                  }`}
              >
                {isTitleValid ? '✓ Assunto válido' : 'Mínimo 5 caracteres'}
              </span>
            </div>

            <input
              id="modal-ticket-title-input"
              type="text"
              value={title}
              onBlur={() =>
                setTouchedFields((prev) => ({ ...prev, title: true }))
              }
              onChange={(e) => {
                setTitle(e.target.value);
                if (dismissedSuggestions) setDismissedSuggestions(false);
                if (formError) setFormError('');
              }}
              className={`w-full px-3.5 py-2.5 text-sm bg-white border rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 transition-colors ${touchedFields.title && !isTitleValid
                ? 'border-red-400 focus:ring-red-500'
                : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600'
                }`}
            />
            <p className="text-[11px] text-slate-500">
              Informe de modo direto o sistema, recurso ou equipamento envolvido
              (exemplo: Falha de token no VPN FortiClient, Instalação do Power
              BI Desktop, Monitor sem sinal na USB-C).
            </p>

            {/* Sugestão Automática Contextual de Artigos (Deflexão Inteligente) */}
            {contextualArticles.length > 0 && (
              <div
                aria-label="Sugestões automáticas da Base de Conhecimento"
                className="p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 space-y-2.5 animate-in fade-in duration-150"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center shrink-0">
                      <Lightbulb className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-amber-950">
                        Encontramos {contextualArticles.length}{' '}
                        {contextualArticles.length === 1
                          ? 'guia rápido relacionado'
                          : 'guias rápidos relacionados'}{' '}
                        ao seu assunto!
                      </h3>
                      <p className="text-[11px] text-amber-800">
                        Veja se o procedimento abaixo resolve seu problema
                        imediatamente sem precisar aguardar na fila:
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDismissedSuggestions(true)}
                    className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 px-2 py-0.5 rounded hover:bg-amber-100/80 shrink-0"
                  >
                    Ocultar
                  </button>
                </div>

                <div className="space-y-2">
                  {contextualArticles.map((art) => {
                    const isExpanded = expandedSuggestionId === art.id;
                    return (
                      <div
                        key={art.id}
                        className="rounded-lg bg-white border border-amber-200 p-3 space-y-2 shadow-2xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="font-mono font-bold text-blue-600">
                                {art.code}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-600 font-medium">
                                {art.category}
                              </span>
                              <span className="text-slate-400">·</span>
                              <span className="text-slate-500">
                                Leitura: {art.readTimeMinutes} min
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-slate-900">
                              {art.title}
                            </h4>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedSuggestionId(
                                isExpanded ? null : art.id
                              )
                            }
                            className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center gap-1 shrink-0"
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>
                              {isExpanded ? 'Ocultar passos' : 'Ver solução'}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="pt-2 border-t border-slate-100 space-y-2">
                            <ol className="list-decimal pl-4 space-y-1 text-xs text-slate-700">
                              {art.steps.map((step, index) => (
                                <li key={index} className="leading-relaxed">
                                  {step}
                                </li>
                              ))}
                            </ol>
                            <div className="pt-1.5 flex items-center justify-end">
                              <button
                                type="button"
                                onClick={onClose}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Este artigo resolveu! Fechar formulário
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 3. Categoria do Catálogo e Departamento Solicitante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="modal-category-select"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                3. Categoria de Serviço
              </label>
              <select
                id="modal-category-select"
                value={category}
                onChange={(e) => setCategory(e.target.value as TicketCategory)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label} ({cat.value})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                {CATEGORIES.find((c) => c.value === category)?.hint}
              </p>
            </div>

            <div>
              <label
                htmlFor="modal-dept-select"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                4. Departamento Solicitante
              </label>
              <select
                id="modal-dept-select"
                value={department}
                onChange={(e) => setDepartment(e.target.value as Department)}
                className="w-full text-xs sm:text-sm bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Centro de custo e lotação para direcionamento de SLA.
              </p>
            </div>
          </div>

          {/* Identificação do Colaborador */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="modal-requester-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Nome Completo do Solicitante
              </label>
              <input
                id="modal-requester-name"
                type="text"
                value={requesterName}
                onChange={(e) => setRequesterName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label
                htmlFor="modal-requester-email"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                E-mail Corporativo
              </label>
              <input
                id="modal-requester-email"
                type="email"
                value={requesterEmail}
                onChange={(e) => setRequesterEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* 5. Descrição Detalhada do Problema ou Solicitação */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="modal-ticket-desc-input"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                5. Detalhamento Técnico / Contexto
              </label>
              <span
                className={`text-[11px] font-mono ${isDescriptionValid
                  ? 'text-emerald-700 font-semibold'
                  : 'text-slate-400'
                  }`}
              >
                {isDescriptionValid
                  ? '✓ Detalhamento preenchido'
                  : 'Mínimo 10 caracteres'}
              </span>
            </div>
            <textarea
              id="modal-ticket-desc-input"
              rows={3}
              value={description}
              onBlur={() =>
                setTouchedFields((prev) => ({ ...prev, description: true }))
              }
              onChange={(e) => {
                setDescription(e.target.value);
                if (formError) setFormError('');
              }}
              className={`w-full px-3.5 py-2.5 text-xs sm:text-sm bg-white border rounded-xl text-slate-900 focus:outline-none focus:ring-2 transition-colors ${touchedFields.description && !isDescriptionValid
                ? 'border-red-400 focus:ring-red-500'
                : 'border-slate-300 focus:ring-blue-600 focus:border-blue-600'
                }`}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Inclua mensagens de erro apresentadas, número de patrimônio (asset
              tag), horário de início ou aprovações de gestor quando aplicável.
            </p>
          </div>

          {/* 6. Seleção Simplificada de Impacto e Urgência com Textos Explicativos Amigáveis */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  6. Abrangência (Impacto) &amp; Urgência
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-md text-xs font-bold ${computedPriority === 'Crítica'
                  ? 'bg-red-100 text-red-800 border border-red-300'
                  : computedPriority === 'Alta'
                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                    : computedPriority === 'Média'
                      ? 'bg-blue-100 text-blue-800 border border-blue-300'
                      : 'bg-slate-200 text-slate-800 border border-slate-300'
                  }`}
              >
                Prioridade Resultante: {computedPriority} ({slaTarget.code})
              </span>
            </div>

            {/* Cards Amigáveis de Impacto */}
            <div>
              <span className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                Quem está sendo afetado por esta situação? (Impacto)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {IMPACT_OPTIONS.map((opt) => {
                  const selected = impact === opt.level;
                  return (
                    <button
                      key={opt.level}
                      type="button"
                      onClick={() => setImpact(opt.level)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${selected
                        ? 'border-blue-600 bg-white ring-1 ring-blue-600 shadow-2xs'
                        : 'border-slate-200/90 bg-white/70 hover:bg-white text-slate-700'
                        }`}
                    >
                      <div className="text-xs font-bold text-slate-900">
                        {opt.shortTitle}
                      </div>
                      <div className="text-[10px] font-mono text-blue-700 mt-0.5">
                        {opt.friendlyLabel}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Seletor Amigável de Urgência */}
            <div>
              <label
                htmlFor="modal-urgency-select"
                className="block text-[11px] font-semibold text-slate-700 mb-1"
              >
                Qual o nível de urgência para sua rotina neste momento?
              </label>
              <select
                id="modal-urgency-select"
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as UrgencyLevel)}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {URGENCY_OPTIONS.map((opt) => (
                  <option key={opt.level} value={opt.level}>
                    {opt.friendlyLabel} — {opt.desc}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                Meta 1ª Resposta:{' '}
                <strong className="text-slate-900">
                  {slaTarget.firstResponseLabel}
                </strong>
              </span>
              <span>
                Prazo Estimado de Resolução:{' '}
                <strong className="text-slate-900">
                  {slaTarget.resolutionLabel}
                </strong>
              </span>
              <span className="text-[11px] text-slate-500">
                {slaTarget.escalationRule}
              </span>
            </div>
          </div>

          {/* 7. Área de Arrastar e Soltar (Drag and Drop) para Prints, Logs ou Formulários */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5 text-blue-600" />
              7. Anexos, Prints de Erro ou Logs (Arrastar e Soltar)
            </label>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              aria-label="Área para arrastar e soltar arquivos ou clicar para selecionar evidências"
              className={`p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition-all ${isDraggingOver
                ? 'border-blue-600 bg-blue-50/70'
                : 'border-slate-300 bg-slate-50/50 hover:bg-slate-50 hover:border-blue-400'
                }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />
              <UploadCloud className="w-6 h-6 text-blue-600 mx-auto mb-1.5" />
              <p className="text-xs font-semibold text-slate-800">
                Arraste e solte capturas de tela, relatórios PDF ou logs aqui, ou{' '}
                <span className="text-blue-600 underline">
                  clique para selecionar do computador
                </span>
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Formatos aceitos: PNG, JPG, PDF, LOG, TXT, XLSX (até 10 MB por
                arquivo)
              </p>
            </div>

            {/* Atalhos rápidos + adição nominal de evidência */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Nome do arquivo de evidência ou log"
                  value={fileNameInput}
                  onChange={(e) => setFileNameInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                />
                <button
                  type="button"
                  onClick={handleAddNamedAttachment}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors whitespace-nowrap shrink-0 border border-slate-300"
                >
                  + Anexar Nome de Arquivo
                </button>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSampleAttachment(
                      'print_erro_tela.png',
                      '312 KB',
                      'image/png'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  + Print de Tela
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleQuickSampleAttachment(
                      'diagnostico_rede.log',
                      '94 KB',
                      'text/plain'
                    )
                  }
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors"
                >
                  + Log de Diagnóstico
                </button>
              </div>
            </div>

            {attachments.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {attachments.map((att) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs"
                  >
                    <span className="font-mono text-slate-800 flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold">{att.fileName}</span>
                      <span className="text-slate-500">({att.fileSize})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att.id)}
                      aria-label={`Remover anexo ${att.fileName}`}
                      className="text-red-600 hover:text-red-800 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <CheckCircle2 className="w-4 h-4" />
            Registrar Chamado no Global Desk
          </button>
        </div>
      </div>
    </div>
  );
};
