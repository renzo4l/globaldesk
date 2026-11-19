import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FilePlus2,
  FileText,
  KeyRound,
  Layers,
  Laptop,
  MessageSquare,
  Monitor,
  PhoneCall,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Wifi,
  X,
} from 'lucide-react';
import {
  KnowledgeArticle,
  Technician,
  Ticket,
  TicketCategory,
  TicketType,
} from '../types/itsm';
import {
  CollaboratorTicketTab,
  filterCollaboratorTickets,
  formatMinutesDuration,
  getCollaboratorFriendlyStatus,
  SLA_POLICY_BY_PRIORITY,
} from '../utils/itilRules';
import { PrefillTicketDraft } from './NewTicketModal';
import { LOGO_PATHS } from '../assets/logos';
import { useDebounce } from '../utils/useDebounce';
import { TicketTableSkeleton } from './shared/SkeletonLoaders';

interface SelfServicePortalProps {
  articles: KnowledgeArticle[];
  tickets: Ticket[];
  technicians: Technician[];
  isLoadingTickets?: boolean;
  onSelectTicket: (ticketId: string) => void;
  onOpenNewTicketModal: (draft?: PrefillTicketDraft) => void;
}

interface ServiceCatalogCardMeta {
  category: TicketCategory;
  title: string;
  subtitle: string;
  itemsSummary: string;
  accentColor: string;
  iconBg: string;
  defaultType: TicketType;
  quickRequests: {
    label: string;
    type: TicketType;
    draftTitle: string;
    draftDescription: string;
  }[];
}

const SERVICE_CATALOG_ITEMS: ServiceCatalogCardMeta[] = [
  {
    category: 'Hardware',
    title: 'Hardware & Periféricos',
    subtitle: 'Estações de trabalho e acessórios',
    itemsSummary: 'Notebooks, monitores, teclado/mouse, docas USB-C, baterias.',
    accentColor: 'border-blue-200 hover:border-blue-500',
    iconBg: 'bg-blue-50 text-blue-600 border-blue-200',
    defaultType: 'Incidente',
    quickRequests: [
      {
        label: 'Falha em Monitor Externo ou Dock Station',
        type: 'Incidente',
        draftTitle: 'Falha de sinal de vídeo em monitor externo / Dock Station USB-C',
        draftDescription:
          'Monitor secundário conectado via Dock Station Dell WD19TB não apresenta sinal de vídeo após reconexão.',
      },
      {
        label: 'Solicitar Periférico (Teclado, Mouse ou Headset)',
        type: 'Requisição de Serviço',
        draftTitle: 'Solicitação de kit periférico corporativo (Teclado/Mouse sem fio)',
        draftDescription:
          'Solicito fornecimento ou substituição de periférico homologado para estação de trabalho.',
      },
    ],
  },
  {
    category: 'Acessos/Sistemas',
    title: 'Acessos, Contas & Segurança',
    subtitle: 'Identidade, credenciais e ERP',
    itemsSummary:
      'Desbloqueio de senha, MFA, permissões de pastas, VPN, ERP SAP.',
    accentColor: 'border-indigo-200 hover:border-indigo-500',
    iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    defaultType: 'Requisição de Serviço',
    quickRequests: [
      {
        label: 'Erro de Conexão ou Token na VPN FortiClient',
        type: 'Incidente',
        draftTitle: 'Erro de autenticação ou travamento em 40%/98% na VPN FortiClient',
        draftDescription:
          'Não consigo estabelecer túnel seguro na VPN FortiClient mesmo após validar o código MFA.',
      },
      {
        label: 'Reset de Senha AD / Recadastramento MFA',
        type: 'Requisição de Serviço',
        draftTitle: 'Recadastramento de token Microsoft Authenticator (MFA) / Senha AD',
        draftDescription:
          'Necessito redefinir o segundo fator de autenticação MFA devido à troca de aparelho corporativo.',
      },
      {
        label: 'Liberação de Perfil SAP S/4HANA ou Pasta de Rede',
        type: 'Requisição de Serviço',
        draftTitle: 'Solicitação de permissão de acesso ao ERP SAP S/4HANA / Diretório',
        draftDescription:
          'Solicito liberação de perfil transacional no SAP S/4HANA conforme aprovação do gestor da área.',
      },
    ],
  },
  {
    category: 'Software',
    title: 'Softwares & Licenciamento',
    subtitle: 'Aplicações corporativas homologadas',
    itemsSummary:
      'Instalação de ferramentas homologadas (Power BI, Office 365, VS Code).',
    accentColor: 'border-emerald-200 hover:border-emerald-500',
    iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    defaultType: 'Requisição de Serviço',
    quickRequests: [
      {
        label: 'Instalação e Licença do Power BI Pro / Desktop',
        type: 'Requisição de Serviço',
        draftTitle: 'Instalação e ativação de licença Microsoft Power BI Pro',
        draftDescription:
          'Solicito instalação do pacote Power BI Desktop e atribuição de licença Pro para publicação de relatórios.',
      },
      {
        label: 'Instalação de VS Code, Adobe Acrobat ou Office 365',
        type: 'Requisição de Serviço',
        draftTitle: 'Instalação de software homologado na estação de trabalho',
        draftDescription:
          'Necessito da instalação de ferramenta homologada do catálogo corporativo de softwares.',
      },
    ],
  },
  {
    category: 'Rede',
    title: 'Rede & Conectividade',
    subtitle: 'Infraestrutura local e Wi-Fi',
    itemsSummary:
      'Wi-Fi corporativo, lentidão de link, cabo de rede e acesso à internet.',
    accentColor: 'border-amber-200 hover:border-amber-500',
    iconBg: 'bg-amber-50 text-amber-700 border-amber-200',
    defaultType: 'Incidente',
    quickRequests: [
      {
        label: 'Queda ou Instabilidade no Wi-Fi Corporativo',
        type: 'Incidente',
        draftTitle: 'Instabilidade ou falha de autenticação na rede Wi-Fi Corporativa',
        draftDescription:
          'Estação de trabalho desconecta repetidamente da rede sem fio corporativa 802.1X.',
      },
      {
        label: 'Ponto de Rede Cabeado Inoperante na Bancada',
        type: 'Incidente',
        draftTitle: 'Ponto de rede Ethernet sem link na estação de trabalho',
        draftDescription:
          'Cabo de rede conectado na doca/notebook não obtém endereço IP corporativo via DHCP.',
      },
    ],
  },
  {
    category: 'Telefonia',
    title: 'Telefonia & Ramais VoIP',
    subtitle: 'Comunicação unificada e ramais IP',
    itemsSummary:
      'Ramais corporativos VoIP, aparelhos IP de mesa, headsets e desvios.',
    accentColor: 'border-purple-200 hover:border-purple-500',
    iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
    defaultType: 'Incidente',
    quickRequests: [
      {
        label: 'Ramal VoIP Mudo ou Sem Registro no Servidor SIP',
        type: 'Incidente',
        draftTitle: 'Falha de registro ou ausência de áudio em ramal VoIP corporativo',
        draftDescription:
          'Aparelho telefônico IP ou softphone corporativo apresenta mensagem "Sem Serviço" ou falha de áudio.',
      },
      {
        label: 'Configuração de Novo Ramal ou Grupo de Captura',
        type: 'Requisição de Serviço',
        draftTitle: 'Solicitação de configuração de ramal VoIP / grupo de captura',
        draftDescription:
          'Solicito provisionamento de ramal IP e inclusão no grupo de captura do departamento.',
      },
    ],
  },
];

export const SelfServicePortal: React.FC<SelfServicePortalProps> = ({
  articles,
  tickets,
  technicians,
  isLoadingTickets = false,
  onSelectTicket,
  onOpenNewTicketModal,
}) => {
  // Block A: Hero Search & Instant Typeahead State
  const [heroSearchQuery, setHeroSearchQuery] = useState('');
  const debouncedHeroSearch = useDebounce(heroSearchQuery, 200);
  const [isTypeaheadOpen, setIsTypeaheadOpen] = useState(false);

  // Block B & C: Service Catalog & Knowledge Base State
  const [selectedCategory, setSelectedCategory] = useState<
    TicketCategory | 'Todas'
  >('Todas');
  const [expandedArticleId, setExpandedArticleId] = useState<string | null>(
    articles[0]?.id || null
  );
  const [helpfulVotes, setHelpfulVotes] = useState<Record<string, boolean>>({});

  // Block D: "Meus Chamados" Ticket Tracker State
  const [trackerTab, setTrackerTab] = useState<CollaboratorTicketTab>('todos');
  const [trackerSearch, setTrackerSearch] = useState('');
  const debouncedTrackerSearch = useDebounce(trackerSearch, 220);
  const [trackerDeptFilter, setTrackerDeptFilter] = useState<string>('Todos');

  const kbSectionRef = useRef<HTMLElement | null>(null);

  // Instant Typeahead suggestions for Hero Search Bar (debounced 200ms)
  const typeaheadSuggestions = useMemo(() => {
    const q = debouncedHeroSearch.trim().toLowerCase();
    if (!q) return [];
    return articles
      .filter((art) => {
        const text = [
          art.title,
          art.code,
          art.summary,
          art.category,
          ...art.keywords,
          ...art.steps,
        ]
          .join(' ')
          .toLowerCase();
        return text.includes(q);
      })
      .slice(0, 4);
  }, [articles, debouncedHeroSearch]);

  // Filtered Knowledge Base articles for Block C (debounced 200ms)
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      const matchCategory =
        selectedCategory === 'Todas' || art.category === selectedCategory;
      if (!matchCategory) return false;

      const q = debouncedHeroSearch.trim().toLowerCase();
      if (!q) return true;
      const text = [
        art.title,
        art.code,
        art.summary,
        art.category,
        ...art.keywords,
        ...art.steps,
      ]
        .join(' ')
        .toLowerCase();
      return text.includes(q);
    });
  }, [articles, selectedCategory, debouncedHeroSearch]);

  // Active Service Catalog card details when a category is selected
  const activeCatalogMeta = useMemo(() => {
    if (selectedCategory === 'Todas') return null;
    return (
      SERVICE_CATALOG_ITEMS.find((c) => c.category === selectedCategory) || null
    );
  }, [selectedCategory]);

  // Ticket tracker counts per tab
  const trackerCounts = useMemo(() => {
    return {
      todos: tickets.length,
      abertos: tickets.filter(
        (t) => t.status === 'Novo' || t.status === 'Em Atendimento'
      ).length,
      aguardando_resposta: tickets.filter(
        (t) => t.status === 'Aguardando Usuário'
      ).length,
      resolvidos: tickets.filter((t) => t.status === 'Resolvido').length,
    };
  }, [tickets]);

  const filteredTrackerTickets = useMemo(() => {
    return filterCollaboratorTickets(
      tickets,
      trackerTab,
      debouncedTrackerSearch,
      trackerDeptFilter
    );
  }, [tickets, trackerTab, debouncedTrackerSearch, trackerDeptFilter]);

  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    tickets.forEach((t) => set.add(t.department));
    return ['Todos', ...Array.from(set)];
  }, [tickets]);

  const handleSelectTypeaheadArticle = (article: KnowledgeArticle) => {
    setSelectedCategory('Todas');
    setExpandedArticleId(article.id);
    setIsTypeaheadOpen(false);
    kbSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleOpenTicketFromHeroSearch = () => {
    const queryText = heroSearchQuery.trim();
    setIsTypeaheadOpen(false);
    onOpenNewTicketModal({
      title: queryText
        ? `Suporte Técnico: ${queryText}`
        : '',
      description: queryText
        ? `Solicitação aberta a partir da busca na Central de Ajuda referente a: "${queryText}".`
        : '',
      category:
        selectedCategory !== 'Todas' ? selectedCategory : 'Acessos/Sistemas',
      type: 'Incidente',
    });
  };

  const handleCategoryCardClick = (cat: TicketCategory) => {
    if (selectedCategory === cat) {
      setSelectedCategory('Todas');
    } else {
      setSelectedCategory(cat);
      const firstMatching = articles.find((a) => a.category === cat);
      if (firstMatching) {
        setExpandedArticleId(firstMatching.id);
      }
    }
  };

  const handleHelpfulVote = (articleId: string) => {
    setHelpfulVotes((prev) => ({
      ...prev,
      [articleId]: !prev[articleId],
    }));
  };

  const handleOpenPrefilledFromArticle = (art: KnowledgeArticle) => {
    onOpenNewTicketModal({
      title: `Auxílio Técnico (${art.code}): ${art.title}`,
      description: `Segui os passos do artigo ${art.code} (${art.title}) na Base de Conhecimento, porém o problema persiste e preciso de atendimento da equipe técnica.`,
      category: art.category,
      type:
        art.category === 'Software'
          ? 'Requisição de Serviço'
          : 'Incidente',
      sourceArticleCode: art.code,
    });
  };

  const renderCategoryIcon = (category: TicketCategory) => {
    switch (category) {
      case 'Hardware':
        return <Monitor className="w-5 h-5" />;
      case 'Acessos/Sistemas':
        return <KeyRound className="w-5 h-5" />;
      case 'Software':
        return <Laptop className="w-5 h-5" />;
      case 'Rede':
        return <Wifi className="w-5 h-5" />;
      case 'Telefonia':
        return <PhoneCall className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* =====================================================================
          BLOCO A: HERO BANNER COM PESQUISA SEMÂNTICA INSTANTÂNEA (SEARCH-FIRST)
         ===================================================================== */}
      <section
        aria-label="Central de Ajuda e Pesquisa Instantânea"
        className="relative rounded-2xl border border-blue-200/80 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-6 sm:p-10 shadow-md"
      >
        <div className="max-w-3xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-blue-200 text-xs font-semibold shadow-xs">
            <img src={LOGO_PATHS.white} alt="Grupo Global" className="h-4 object-contain" />
            <span className="text-slate-400">|</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-300" />
            <span>
              Grupo Global Help Center · Autoatendimento &amp; Suporte
            </span>
          </div>

          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white">
            Como podemos ajudar você hoje?
          </h2>

          <p className="text-xs sm:text-sm text-blue-100/90 max-w-2xl mx-auto leading-relaxed">
            Pesquise procedimentos passo a passo homologados pela nossa engenharia
            ou abra uma solicitação estruturada diretamente para a equipe técnica
            (Elias, Mauricio e Alexandre).
          </p>

          {/* Hero Search Bar with Instant Typeahead Dropdown */}
          <div className="relative max-w-2xl mx-auto text-left">
            <label
              htmlFor="kb-global-search"
              className="sr-only"
            >
              Pesquisar artigos, soluções de problemas ou serviços de TI
            </label>
            <div className="relative flex items-center bg-white rounded-xl shadow-lg border-2 border-transparent focus-within:border-blue-400 transition-all">
              <Search className="w-5 h-5 text-slate-400 ml-4 shrink-0 pointer-events-none" />
              <input
                id="kb-global-search"
                type="text"
                value={heroSearchQuery}
                onFocus={() => setIsTypeaheadOpen(true)}
                onChange={(e) => {
                  setHeroSearchQuery(e.target.value);
                  setIsTypeaheadOpen(true);
                }}
                aria-label="Pesquisar na Central de Ajuda Global Desk"
                className="w-full px-3.5 py-3.5 text-sm sm:text-base text-slate-900 bg-transparent font-medium focus:outline-none"
              />
              {heroSearchQuery.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHeroSearchQuery('');
                    setIsTypeaheadOpen(false);
                  }}
                  aria-label="Limpar termo de pesquisa"
                  className="p-2 mr-1 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setIsTypeaheadOpen(false);
                  kbSectionRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  });
                }}
                className="mr-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shrink-0"
              >
                Buscar Solução
              </button>
            </div>

            {/* Instant Typeahead Dropdown */}
            {isTypeaheadOpen && heroSearchQuery.trim().length > 0 && (
              <div
                role="listbox"
                aria-label="Sugestões instantâneas da Central de Ajuda"
                className="absolute left-0 right-0 top-full mt-2 z-30 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-900 animate-in fade-in duration-150"
              >
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                    Artigos Recomendados para Autoatendimento (
                    {typeaheadSuggestions.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsTypeaheadOpen(false)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                  >
                    Fechar sugestões
                  </button>
                </div>

                {typeaheadSuggestions.length > 0 ? (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {typeaheadSuggestions.map((art) => (
                      <button
                        key={art.id}
                        type="button"
                        onClick={() => handleSelectTypeaheadArticle(art)}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50/60 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="font-mono font-bold text-blue-600">
                              {art.code}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 font-medium">
                              {art.category}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-500">
                              {art.readTimeMinutes} min de leitura
                            </span>
                          </div>
                          <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                            {art.title}
                          </div>
                          <p className="text-xs text-slate-600 line-clamp-1">
                            {art.summary}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-blue-600 shrink-0 flex items-center gap-1 self-center">
                          Ler guia
                          <ArrowRight className="w-3.5 h-3.5" />
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-xs text-slate-600">
                    Nenhum artigo exato encontrado para{' '}
                    <strong className="text-slate-900">
                      &ldquo;{heroSearchQuery}&rdquo;
                    </strong>
                    . Você pode abrir um chamado direto abaixo com este assunto.
                  </div>
                )}

                {/* Direct CTA to Open Pre-filled Ticket from Search Query */}
                <div className="p-3 bg-blue-50/90 border-t border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-blue-950">
                    <span className="font-bold">
                      Não encontrou o que procurava?
                    </span>{' '}
                    Abra uma solicitação técnica já preenchida com sua pesquisa.
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenTicketFromHeroSearch}
                    className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Abrir chamado direto sobre este assunto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================================
          BLOCO B: CATÁLOGO DE SERVIÇOS E CATEGORIAS EM CARDS VISUAIS
         ===================================================================== */}
      <section
        id="section-service-catalog"
        aria-label="Catálogo de Serviços e Categorias"
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Catálogo Corporativo de Serviços (Service Catalog)
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900">
              Selecione uma Categoria para Triagem ou Autoatendimento
            </h2>
          </div>

          {selectedCategory !== 'Todas' && (
            <button
              type="button"
              onClick={() => setSelectedCategory('Todas')}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 self-start sm:self-auto"
            >
              <X className="w-3.5 h-3.5" />
              Limpar filtro de categoria ({selectedCategory})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {SERVICE_CATALOG_ITEMS.map((item) => {
            const isSelected = selectedCategory === item.category;
            const articleCount = articles.filter(
              (a) => a.category === item.category
            ).length;

            return (
              <div
                key={item.category}
                className={`rounded-2xl border bg-white p-4 flex flex-col justify-between transition-all shadow-2xs ${isSelected
                  ? 'border-blue-600 ring-2 ring-blue-600/20 bg-blue-50/20'
                  : item.accentColor
                  }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${item.iconBg}`}
                    >
                      {renderCategoryIcon(item.category)}
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-100 text-slate-700">
                      {articleCount} guias
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {item.itemsSummary}
                    </p>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleCategoryCardClick(item.category)}
                    className={`text-xs font-semibold transition-colors ${isSelected
                      ? 'text-blue-700 font-bold'
                      : 'text-slate-700 hover:text-blue-600'
                      }`}
                  >
                    {isSelected ? '✓ Categoria Ativa' : 'Filtrar Artigos'}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onOpenNewTicketModal({
                        category: item.category,
                        type: item.defaultType,
                        title: '',
                        description: '',
                      })
                    }
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-800 transition-colors"
                  >
                    + Solicitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Request Templates Bar when a Category is selected */}
        {activeCatalogMeta && (
          <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3 animate-in fade-in duration-150">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                Formulários de Solicitação Rápida — {activeCatalogMeta.title}
              </div>
              <p className="text-[11px] text-blue-800">
                Clique em um modelo abaixo para abrir o formulário inteligente já
                configurado para esta necessidade:
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {activeCatalogMeta.quickRequests.map((req, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    onOpenNewTicketModal({
                      category: activeCatalogMeta.category,
                      type: req.type,
                      title: req.draftTitle,
                      description: req.draftDescription,
                    })
                  }
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white text-blue-900 border border-blue-300 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{req.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          BLOCO C: BASE DE CONHECIMENTO INTERATIVA (KNOWLEDGE BASE & SELF-RESOLUTION)
         ===================================================================== */}
      <section
        id="section-knowledge-base"
        ref={kbSectionRef}
        aria-label="Base de Conhecimento e Autoatendimento"
        className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-5 shadow-2xs"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Base de Conhecimento
              </h2>
              <p className="text-xs text-slate-500">
                Procedimentos técnicos validados.
              </p>
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto">
            {(
              [
                'Todas',
                'Hardware',
                'Acessos/Sistemas',
                'Software',
                'Rede',
                'Telefonia',
              ] as const
            ).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${selectedCategory === cat
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredArticles.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-xl border border-dashed border-slate-200 space-y-3">
            <p className="text-sm font-bold text-slate-800">
              Nenhum artigo encontrado para os filtros selecionados.
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Limpe a busca ou abra um chamado diretamente com nossa equipe
              técnica para atendimento individual.
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setHeroSearchQuery('');
                  setSelectedCategory('Todas');
                }}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Restaurar Todos os Artigos
              </button>
              <button
                type="button"
                onClick={handleOpenTicketFromHeroSearch}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Abrir Chamado sobre este Assunto
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredArticles.map((art) => {
              const isExpanded = expandedArticleId === art.id;
              const hasVoted = Boolean(helpfulVotes[art.id]);
              const displayLikes = art.helpfulCount + (hasVoted ? 1 : 0);

              return (
                <article
                  key={art.id}
                  className={`rounded-xl border transition-all flex flex-col justify-between overflow-hidden ${isExpanded
                    ? 'border-blue-500 ring-1 ring-blue-500/20 bg-white shadow-sm md:col-span-2'
                    : 'border-slate-200/90 bg-white hover:border-blue-300'
                    }`}
                >
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          {art.code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {art.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {art.readTimeMinutes} min de leitura
                        </span>
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {displayLikes} avaliações positivas
                        </span>
                      </div>
                    </div>

                    <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug">
                      {art.title}
                    </h3>

                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {art.summary}
                    </p>

                    {isExpanded && (
                      <div className="pt-4 border-t border-slate-100 space-y-4 mt-3 animate-in fade-in duration-150">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                            Passo a Passo Numerado de Resolução:
                          </div>
                          <ol className="space-y-2.5">
                            {art.steps.map((step, idx) => (
                              <li
                                key={idx}
                                className="flex items-start gap-3 text-xs sm:text-sm text-slate-800 leading-relaxed"
                              >
                                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                                  {idx + 1}
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                        </div>

                        {/* Bloco de Utilidade + Transição Suave para Chamado Pré-Preenchido */}
                        <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-bold text-slate-800">
                              Este artigo foi útil?
                            </span>
                            <button
                              type="button"
                              onClick={() => handleHelpfulVote(art.id)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors ${hasVoted
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-white text-slate-700 border-slate-300 hover:border-blue-500 hover:text-blue-600'
                                }`}
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              <span>
                                {hasVoted
                                  ? `Sim, resolveu! (${displayLikes})`
                                  : `Sim, foi útil (${displayLikes})`}
                              </span>
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenPrefilledFromArticle(art)}
                            className="px-3.5 py-2 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>
                              Ainda precisa de ajuda? Transformar este problema em
                              um chamado pré-preenchido
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedArticleId(isExpanded ? null : art.id)
                      }
                      className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <span>
                        {isExpanded
                          ? 'Recolher passo a passo'
                          : 'Ler passo a passo completo'}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {!isExpanded && (
                      <button
                        type="button"
                        onClick={() => handleOpenPrefilledFromArticle(art)}
                        className="text-[11px] font-semibold text-slate-600 hover:text-blue-600 transition-colors"
                      >
                        + Abrir chamado pré-preenchido
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* =====================================================================
          BLOCO D: CENTRAL DE ACOMPANHAMENTO "MEUS CHAMADOS" (TICKET TRACKER)
         ===================================================================== */}
      <section
        id="section-my-tickets"
        aria-label="Central de Acompanhamento Meus Chamados"
        className="bg-white rounded-2xl border border-slate-200/90 p-6 space-y-5 shadow-2xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Central de Acompanhamento — Meus Chamados
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe o andamento das suas solicitações, prazos de SLA e
                interaja com a equipe técnica.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => onOpenNewTicketModal()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              Abrir Novo Chamado
            </button>
          </div>
        </div>

        {/* Quick Status Filter Tabs + Search & Department Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="Filtros de status dos meus chamados"
            className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto"
          >
            {(
              [
                {
                  id: 'todos',
                  label: 'Todos',
                  count: trackerCounts.todos,
                },
                {
                  id: 'abertos',
                  label: 'Em Aberto / Em Andamento',
                  count: trackerCounts.abertos,
                },
                {
                  id: 'aguardando_resposta',
                  label: 'Aguardando Minha Resposta',
                  count: trackerCounts.aguardando_resposta,
                },
                {
                  id: 'resolvidos',
                  label: 'Resolvidos',
                  count: trackerCounts.resolvidos,
                },
              ] as const
            ).map((tab) => {
              const active = trackerTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setTrackerTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${active
                    ? 'bg-white text-blue-700 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono ${active
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-slate-200/80 text-slate-700'
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                aria-label="Filtrar chamados por protocolo ou assunto"
                value={trackerSearch}
                onChange={(e) => setTrackerSearch(e.target.value)}
                className="w-full sm:w-56 pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <select
              aria-label="Filtrar chamados por departamento"
              value={trackerDeptFilter}
              onChange={(e) => setTrackerDeptFilter(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              {availableDepartments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'Todos' ? 'Todos os Departamentos' : dept}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Ticket Tracker Cards / Table */}
        {isLoadingTickets && tickets.length === 0 ? (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <TicketTableSkeleton rows={4} />
          </div>
        ) : filteredTrackerTickets.length === 0 ? (
          <div className="py-12 px-4 text-center border border-dashed border-slate-200 rounded-xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <FilePlus2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Nenhum chamado encontrado neste filtro
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Altere a aba de status selecionada ou registre uma nova
                solicitação na Central de Ajuda.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrackerTickets.map((t) => {
              const assignedTech = technicians.find(
                (x) => x.id === t.assigneeId
              );
              const friendlyStatus = getCollaboratorFriendlyStatus(t.status);
              const slaPolicy = SLA_POLICY_BY_PRIORITY[t.priority];
              const publicMessages = t.notes.filter(
                (n) => n.visibility === 'public'
              );
              const latestPublicNote =
                publicMessages[publicMessages.length - 1] || null;

              return (
                <div
                  key={t.id}
                  className="p-4 rounded-xl border border-slate-200/90 bg-white hover:border-blue-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Top Row: Protocol, Friendly Status Badge, Type, Category & SLA Indicator */}
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <button
                        type="button"
                        onClick={() => onSelectTicket(t.id)}
                        className="font-mono font-bold text-blue-600 hover:underline"
                      >
                        {t.id}
                      </button>

                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${friendlyStatus.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${friendlyStatus.dotClass}`}
                        />
                        {friendlyStatus.friendlyLabel}
                      </span>

                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                        {t.type}
                      </span>

                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px]">
                        {t.category}
                      </span>

                      {/* SLA Visual Indicator */}
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold ${t.status === 'Resolvido'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : t.sla.resolutionRemainingMinutes < 0
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : t.sla.health === 'expiring_soon'
                              ? 'bg-amber-50 text-amber-900 border border-amber-200'
                              : 'bg-blue-50 text-blue-800 border border-blue-200'
                          }`}
                      >
                        <Clock className="w-3 h-3" />
                        {t.status === 'Resolvido'
                          ? `SLA Concluído (Meta ${slaPolicy.resolutionLabel})`
                          : t.sla.resolutionRemainingMinutes < 0
                            ? `Prioridade ${t.priority} · Excedido em ${formatMinutesDuration(
                              Math.abs(t.sla.resolutionRemainingMinutes)
                            )}`
                            : `Prazo estimado: ${formatMinutesDuration(
                              t.sla.resolutionRemainingMinutes
                            )} restantes (Meta ${slaPolicy.resolutionLabel})`}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                      {t.title}
                    </h3>

                    {/* Metadata & Public Message Indicator */}
                    <div className="text-xs text-slate-500 flex items-center gap-2.5 flex-wrap">
                      <span>
                        Solicitante:{' '}
                        <strong className="text-slate-700">
                          {t.requesterName}
                        </strong>{' '}
                        ({t.department})
                      </span>
                      <span>·</span>
                      <span>Aberto: {t.createdAt}</span>
                      <span>·</span>
                      <span>
                        Analista Responsável:{' '}
                        <strong className="text-slate-800">
                          {assignedTech
                            ? `${assignedTech.name} (${t.tier})`
                            : 'Equipe Global Desk'}
                        </strong>
                      </span>

                      {publicMessages.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-semibold text-[11px]">
                          <MessageSquare className="w-3 h-3" />
                          {publicMessages.length}{' '}
                          {publicMessages.length === 1
                            ? 'mensagem pública da equipe'
                            : 'mensagens públicas da equipe'}
                        </span>
                      )}
                    </div>

                    {/* Latest Public Response Snippet (Never shows internal notes) */}
                    {latestPublicNote && (
                      <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700 flex items-start gap-2">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <span className="font-bold text-slate-900">
                            Última atualização pública (
                            {latestPublicNote.authorName}):
                          </span>{' '}
                          <span className="line-clamp-1">
                            {latestPublicNote.content}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action CTA: Ver Linha do Tempo / Responder */}
                  <div className="shrink-0 flex items-center gap-2 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => onSelectTicket(t.id)}
                      className="px-4 py-2 text-xs font-bold rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-2xs"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      Ver Linha do Tempo / Responder
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
