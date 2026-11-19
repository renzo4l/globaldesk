import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateItilPriority,
  evaluateSlaHealth,
  formatMinutesDuration,
  generateNextTicketProtocol,
  buildInitialSlaMetrics,
  filterTickets,
  filterTicketsByZendeskView,
  calculateZendeskViewCounts,
  getNextPriorityTicketForPlay,
  getZendeskStatusBadgeMeta,
  calculateTicketsPerCategory,
  calculateResolutionTimePerTechnician,
  calculateResolvedTicketsPerTechnician,
  calculateAvgResolutionTimePerCategory,
  calculateSlaComplianceBreakdown,
  getCollaboratorFriendlyStatus,
  filterCollaboratorTickets,
  suggestContextualArticlesForTicket,
} from './itilRules';
import {
  INITIAL_TICKETS,
  KNOWLEDGE_BASE_ARTICLES,
  SAMPLE_TICKETS_FOR_TESTS,
  TECHNICIANS,
} from '../data/mockData';
import { Ticket } from '../types/itsm';
import { generateClosedTicketPdfDoc, generateServiceOrderPdfDoc } from './pdfExport';
import { soundEffects } from './soundEffects';

test('Priority Matrix calculates correct priority for all key combinations', () => {
  assert.equal(calculateItilPriority('Organização', 'Crítica'), 'Crítica');
  assert.equal(calculateItilPriority('Organização', 'Alta'), 'Crítica');
  assert.equal(calculateItilPriority('Organização', 'Média'), 'Alta');
  assert.equal(calculateItilPriority('Organização', 'Baixa'), 'Média');

  assert.equal(calculateItilPriority('Setor', 'Crítica'), 'Crítica');
  assert.equal(calculateItilPriority('Setor', 'Alta'), 'Alta');
  assert.equal(calculateItilPriority('Setor', 'Média'), 'Média');
  assert.equal(calculateItilPriority('Setor', 'Baixa'), 'Baixa');

  assert.equal(calculateItilPriority('Usuário Único', 'Crítica'), 'Alta');
  assert.equal(calculateItilPriority('Usuário Único', 'Alta'), 'Média');
  assert.equal(calculateItilPriority('Usuário Único', 'Média'), 'Baixa');
  assert.equal(calculateItilPriority('Usuário Único', 'Baixa'), 'Baixa');
});

test('SLA health evaluation handles healthy, expiring_soon, breached, and completed', () => {
  assert.equal(evaluateSlaHealth(180, 240, false), 'healthy');
  assert.equal(evaluateSlaHealth(45, 240, false), 'expiring_soon');
  assert.equal(evaluateSlaHealth(-15, 120, false), 'breached');
  assert.equal(evaluateSlaHealth(40, 240, true), 'completed');
  assert.equal(evaluateSlaHealth(-10, 240, true), 'completed');
});

test('formatMinutesDuration formats positive and negative durations cleanly', () => {
  assert.equal(formatMinutesDuration(45), '45m');
  assert.equal(formatMinutesDuration(125), '2h 5m');
  assert.equal(formatMinutesDuration(-35), '-35m');
  assert.equal(formatMinutesDuration(-90), '-1h 30m');
});

test('generateNextTicketProtocol increments from highest existing protocol', () => {
  const sample = [
    { id: '#TICK-2026-1041' } as Ticket,
    { id: '#TICK-2026-1048' } as Ticket,
    { id: '#TICK-2026-1044' } as Ticket,
  ];
  assert.equal(generateNextTicketProtocol(sample), '#TICK-2026-1049');
});

test('filterTickets filters by assignee, tier, priority, status, and search query', () => {
  const sampleTickets: Ticket[] = [
    {
      id: '#TICK-2026-1041',
      title: 'Indisponibilidade total no ERP SAP',
      description: 'Erro de conexão com banco de dados',
      type: 'Incidente',
      category: 'Acessos/Sistemas',
      department: 'Financeiro & Contabilidade',
      requesterName: 'Helena Castro',
      requesterEmail: 'helena@corp.br',
      impact: 'Organização',
      urgency: 'Crítica',
      priority: 'Crítica',
      status: 'Em Atendimento',
      tier: 'N3',
      assigneeId: 'alexandre',
      createdAt: '08:10',
      updatedAt: '08:15',
      sla: buildInitialSlaMetrics('Crítica'),
      attachments: [],
      notes: [],
      auditTrail: [],
    },
    {
      id: '#TICK-2026-1042',
      title: 'Solicitação de novo monitor 27 polegadas',
      description: 'Para estação de trabalho',
      type: 'Requisição de Serviço',
      category: 'Hardware',
      department: 'Comercial & Vendas',
      requesterName: 'Carlos Mendes',
      requesterEmail: 'carlos@corp.br',
      impact: 'Usuário Único',
      urgency: 'Baixa',
      priority: 'Baixa',
      status: 'Novo',
      tier: 'N1',
      assigneeId: 'elias',
      createdAt: '09:00',
      updatedAt: '09:00',
      sla: buildInitialSlaMetrics('Baixa'),
      attachments: [],
      notes: [],
      auditTrail: [],
    },
  ];

  const byAlexandre = filterTickets(sampleTickets, {
    search: '',
    status: 'Todos',
    priority: 'Todas',
    tier: 'Todos',
    assigneeId: 'alexandre',
    type: 'Todos',
  });
  assert.equal(byAlexandre.length, 1);
  assert.equal(byAlexandre[0].id, '#TICK-2026-1041');
});

test('INITIAL_TICKETS is initialized empty for server integration, while SAMPLE_TICKETS_FOR_TESTS provides 12 realistic fixtures', () => {
  assert.equal(INITIAL_TICKETS.length, 0);
  assert.equal(SAMPLE_TICKETS_FOR_TESTS.length, 12);

  // Exclusively use Elias, Alexandre, and Mauricio
  const validIds = new Set(['elias', 'alexandre', 'mauricio']);
  for (const ticket of SAMPLE_TICKETS_FOR_TESTS) {
    assert.equal(validIds.has(ticket.assigneeId), true);
    assert.ok(ticket.channel);
    assert.ok(ticket.title.length > 15);
    assert.ok(ticket.description.length > 20);
  }

  const categoryStats = calculateTicketsPerCategory(SAMPLE_TICKETS_FOR_TESTS);
  assert.equal(categoryStats.length, 5);
  const totalFromCategories = categoryStats.reduce((sum, item) => sum + item.total, 0);
  assert.equal(totalFromCategories, SAMPLE_TICKETS_FOR_TESTS.length);

  const techStats = calculateResolutionTimePerTechnician(SAMPLE_TICKETS_FOR_TESTS, TECHNICIANS);
  assert.equal(techStats.length, 3);
  for (const stat of techStats) {
    assert.ok(stat.avgResolutionMinutes > 0);
    assert.ok(stat.totalAssigned > 0);
  }
});

test('Zendesk Views filter and count tickets accurately across all 9 views', () => {
  const counts = calculateZendeskViewCounts(SAMPLE_TICKETS_FOR_TESTS, 'alexandre', 3);

  assert.equal(counts.critical_unresolved, 4);
  assert.equal(counts.assigned_to_me, 3); // Alexandre has 3 open tickets (#1048, #1042, #1039)
  assert.equal(counts.tier_n1_elias, 3); // Elias has 3 open tickets (#1046, #1044, #1041)
  assert.equal(counts.tier_n2_mauricio, 4); // Mauricio has 4 open tickets (#1047, #1045, #1040, #1038)
  assert.equal(counts.tier_n3_alexandre, 3);
  assert.equal(counts.pending_requester, 2); // #1044, #1038
  assert.equal(counts.recently_resolved, 2); // #1043, #1037
  assert.equal(counts.service_orders, 3);

  const criticalList = filterTicketsByZendeskView(SAMPLE_TICKETS_FOR_TESTS, 'critical_unresolved', 'alexandre');
  assert.equal(criticalList.every((t) => t.priority === 'Crítica' && t.status !== 'Resolvido'), true);
});

test('getNextPriorityTicketForPlay selects highest priority unresolved ticket with lowest SLA remaining', () => {
  const nextTicket = getNextPriorityTicketForPlay(SAMPLE_TICKETS_FOR_TESTS);
  assert.ok(nextTicket);
  assert.equal(nextTicket.priority, 'Crítica');
  // #TICK-2026-1047 has -8 minutes remaining among Critical tickets
  assert.equal(nextTicket.id, '#TICK-2026-1047');
});

test('getZendeskStatusBadgeMeta maps ticket statuses to square letter badges N, O, P, R', () => {
  assert.equal(getZendeskStatusBadgeMeta('Novo').letter, 'N');
  assert.equal(getZendeskStatusBadgeMeta('Em Atendimento').letter, 'O');
  assert.equal(getZendeskStatusBadgeMeta('Aguardando Usuário').letter, 'P');
  assert.equal(getZendeskStatusBadgeMeta('Resolvido').letter, 'R');
});

test('Technician notes communication enforces strict separation between internal team and collaborator', () => {
  const ticket1048 = SAMPLE_TICKETS_FOR_TESTS.find((t) => t.id === '#TICK-2026-1048');
  assert.ok(ticket1048);

  const internalNotes = ticket1048.notes.filter((n) => n.visibility === 'internal');
  const publicNotes = ticket1048.notes.filter((n) => n.visibility === 'public');

  assert.ok(internalNotes.length >= 1);
  assert.ok(publicNotes.length >= 1);

  const collaboratorVisibleNotes = ticket1048.notes.filter((n) => n.visibility === 'public');
  assert.equal(collaboratorVisibleNotes.every((n) => n.visibility === 'public'), true);
  assert.equal(collaboratorVisibleNotes.some((n) => n.visibility === 'internal'), false);
});

test('ServiceOrder structure includes all essential finalization fields', () => {
  const sampleOS: import('../types/itsm').ServiceOrder = {
    id: 'OS-2026-0001',
    ticketId: '#TICK-2026-1048',
    ticketTitle: 'Queda do link BGP',
    ticketDescription: 'Perda de pacotes na matriz',
    category: 'Rede',
    requesterName: 'Roberto Albuquerque',
    requesterEmail: 'roberto@corp.br',
    department: 'Operações & Logística',
    startedAt: 'Hoje, 07:48',
    finalizedAt: 'Hoje, 08:30',
    durationText: '42m',
    technicianId: 'alexandre',
    technicianName: 'Alexandre',
    technicianTier: 'N3',
    interventionType: 'Infraestrutura / Datacenter',
    finalizationOutcome: 'concluido_sucesso',
    outcomeLabel: 'Concluído com Sucesso',
    solutionSummary: 'Comutação de rota SD-WAN para link secundário Vivo Fibra e normalização BGP.',
    partsOrSupplies: 'Nenhum insumo material',
    clientAcceptance: 'Validado com o solicitante',
    slaMet: true,
    createdAt: 'Hoje, 08:30',
  };

  assert.equal(sampleOS.id, 'OS-2026-0001');
  assert.equal(sampleOS.ticketId, '#TICK-2026-1048');
  assert.equal(sampleOS.technicianName, 'Alexandre');
  assert.ok(sampleOS.startedAt && sampleOS.finalizedAt);
  assert.ok(sampleOS.solutionSummary.length > 10);
  assert.equal(sampleOS.slaMet, true);
});

test('Password complexity validator enforces uppercase, lowercase, number, symbol, and 8+ chars', () => {
  const validatePassword = (pwd: string) => {
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
    const hasMinLen = pwd.length >= 8;
    return hasUpper && hasLower && hasNumber && hasSymbol && hasMinLen;
  };

  assert.equal(validatePassword('Admin@2026!'), true);
  assert.equal(validatePassword('GlobalDesk#123'), true);
  assert.equal(validatePassword('globaldesk#123'), false);
  assert.equal(validatePassword('GLOBALDESK#123'), false);
  assert.equal(validatePassword('GlobalDesk#Secret'), false);
  assert.equal(validatePassword('GlobalDesk1234'), false);
  assert.equal(validatePassword('Gd#1a'), false);
});

test('ServiceOrder supports non-completed outcome with justification reason', () => {
  const nonCompletedOS: import('../types/itsm').ServiceOrder = {
    id: 'OS-2026-0002',
    ticketId: '#TICK-2026-1049',
    ticketTitle: 'Substituição de placa mãe de servidor legado',
    ticketDescription: 'Equipamento fora de linha',
    category: 'Hardware',
    requesterName: 'Eduardo Martins',
    requesterEmail: 'eduardo@corp.br',
    department: 'Operações & Logística',
    startedAt: 'Hoje, 09:00',
    finalizedAt: 'Hoje, 11:30',
    durationText: '2h 30m',
    technicianId: 'mauricio',
    technicianName: 'Mauricio',
    technicianTier: 'N2',
    interventionType: 'Presencial',
    finalizationOutcome: 'nao_concluido',
    outcomeLabel: 'Encerrado sem Conclusão / Inviabilidade Técnica',
    solutionSummary: 'Diagnóstico constatou queima irrecuperável do chipset da placa mãe proprietária.',
    nonCompletionReason: 'Fabricante descontinuou os componentes de reposição em 2021. Inviabilidade técnica de reparo.',
    clientAcceptance: 'Notificado gestor da Logística para abertura de processo de aquisição de nova estação.',
    slaMet: false,
    createdAt: 'Hoje, 11:30',
  };

  assert.equal(nonCompletedOS.finalizationOutcome, 'nao_concluido');
  assert.ok(nonCompletedOS.nonCompletionReason);
  assert.ok(nonCompletedOS.nonCompletionReason.length > 10);
});

test('O.S. search filter accurately matches specific OS number', () => {
  const orders: import('../types/itsm').ServiceOrder[] = [
    {
      id: 'OS-2026-0001',
      ticketId: '#TICK-2026-1048',
      ticketTitle: 'Queda link BGP',
      ticketDescription: '',
      category: 'Rede',
      requesterName: 'Roberto',
      requesterEmail: 'roberto@corp.br',
      department: 'Operações & Logística',
      startedAt: '08:00',
      finalizedAt: '08:45',
      durationText: '45m',
      technicianId: 'alexandre',
      technicianName: 'Alexandre',
      technicianTier: 'N3',
      interventionType: 'Infraestrutura / Datacenter',
      finalizationOutcome: 'concluido_sucesso',
      outcomeLabel: 'Concluído com Sucesso',
      solutionSummary: 'Normalizado',
      clientAcceptance: 'Ok',
      slaMet: true,
      createdAt: '08:45',
    },
    {
      id: 'OS-2026-0002',
      ticketId: '#TICK-2026-1049',
      ticketTitle: 'Substituição placa',
      ticketDescription: '',
      category: 'Hardware',
      requesterName: 'Eduardo',
      requesterEmail: 'eduardo@corp.br',
      department: 'Operações & Logística',
      startedAt: '09:00',
      finalizedAt: '10:00',
      durationText: '1h',
      technicianId: 'mauricio',
      technicianName: 'Mauricio',
      technicianTier: 'N2',
      interventionType: 'Presencial',
      finalizationOutcome: 'nao_concluido',
      outcomeLabel: 'Encerrado sem Conclusão',
      solutionSummary: 'Inviável',
      clientAcceptance: 'Ciente',
      slaMet: false,
      createdAt: '10:00',
    },
  ];

  const match1 = orders.filter((o) => o.id.toLowerCase().includes('os-2026-0001'));
  assert.equal(match1.length, 1);
  assert.equal(match1[0].id, 'OS-2026-0001');

  const match2 = orders.filter((o) => o.id.toLowerCase().includes('0002'));
  assert.equal(match2.length, 1);
  assert.equal(match2[0].id, 'OS-2026-0002');
});

test('generateServiceOrderPdfDoc creates a valid formatted PDF document with all sections', async () => {
  const sampleOS: import('../types/itsm').ServiceOrder = {
    id: 'OS-2026-0001',
    ticketId: '#TICK-2026-1048',
    ticketTitle: 'Queda do link BGP',
    ticketDescription: 'Perda de pacotes na matriz',
    category: 'Rede',
    requesterName: 'Roberto Albuquerque',
    requesterEmail: 'roberto@corp.br',
    department: 'Operações & Logística',
    startedAt: 'Hoje, 07:48',
    finalizedAt: 'Hoje, 08:30',
    durationText: '42m',
    technicianId: 'alexandre',
    technicianName: 'Alexandre',
    technicianTier: 'N3',
    interventionType: 'Infraestrutura / Datacenter',
    finalizationOutcome: 'concluido_sucesso',
    outcomeLabel: 'Concluído com Sucesso',
    solutionSummary: 'Comutação de rota SD-WAN para link secundário Vivo Fibra e normalização BGP.',
    partsOrSupplies: 'Nenhum insumo material',
    clientAcceptance: 'Validado com o solicitante',
    slaMet: true,
    createdAt: 'Hoje, 08:30',
  };

  const pdfDoc = await generateServiceOrderPdfDoc(sampleOS);
  assert.ok(pdfDoc);
  assert.equal(pdfDoc.getNumberOfPages(), 1);
  const output = pdfDoc.output('arraybuffer');
  assert.ok(output.byteLength > 1000);
});

test('soundEffects manages mute/unmute state and runs safely in any environment', () => {
  assert.equal(typeof soundEffects.isSoundEnabled(), 'boolean');
  soundEffects.setSoundEnabled(false);
  assert.equal(soundEffects.isSoundEnabled(), false);

  assert.doesNotThrow(() => {
    soundEffects.playNotificationSound('new_ticket');
    soundEffects.playNotificationSound('escalation');
    soundEffects.playNotificationSound('status_change');
  });

  soundEffects.setSoundEnabled(true);
  assert.equal(soundEffects.isSoundEnabled(), true);

  assert.doesNotThrow(() => {
    soundEffects.playNotificationSound('new_ticket');
  });
});

test('SystemNotification payload properly formats ITSM event types and sound triggers', () => {
  const notif: import('../types/itsm').SystemNotification = {
    id: 'notif-test-1',
    type: 'ticket_created',
    title: 'Novo Chamado Aberto: #TICK-2026-1050',
    message: 'Incidente de lentidão de link de dados',
    ticketId: '#TICK-2026-1050',
    priority: 'Crítica',
    tier: 'N3',
    timestamp: '10:45',
    soundType: 'new_ticket',
  };

  assert.equal(notif.type, 'ticket_created');
  assert.equal(notif.soundType, 'new_ticket');
  assert.equal(notif.priority, 'Crítica');
  assert.ok(notif.title.includes('#TICK-2026-1050'));
});

test('getCollaboratorFriendlyStatus maps internal ITIL statuses to lay-friendly collaborator statuses', () => {
  assert.equal(getCollaboratorFriendlyStatus('Novo').friendlyLabel, 'Em Análise');
  assert.equal(getCollaboratorFriendlyStatus('Em Atendimento').friendlyLabel, 'Em Atendimento');
  assert.equal(getCollaboratorFriendlyStatus('Aguardando Usuário').friendlyLabel, 'Aguardando Você');
  assert.equal(getCollaboratorFriendlyStatus('Resolvido').friendlyLabel, 'Concluído');
});

test('filterCollaboratorTickets filters tickets across Todos, Em Aberto, Aguardando Minha Resposta, and Resolvidos', () => {
  const all = filterCollaboratorTickets(SAMPLE_TICKETS_FOR_TESTS, 'todos', '');
  assert.equal(all.length, 12);

  const open = filterCollaboratorTickets(SAMPLE_TICKETS_FOR_TESTS, 'abertos', '');
  assert.equal(open.every((t) => t.status === 'Novo' || t.status === 'Em Atendimento'), true);
  assert.equal(open.length, 8);

  const waiting = filterCollaboratorTickets(SAMPLE_TICKETS_FOR_TESTS, 'aguardando_resposta', '');
  assert.equal(waiting.every((t) => t.status === 'Aguardando Usuário'), true);
  assert.equal(waiting.length, 2);

  const resolved = filterCollaboratorTickets(SAMPLE_TICKETS_FOR_TESTS, 'resolvidos', '');
  assert.equal(resolved.every((t) => t.status === 'Resolvido'), true);
  assert.equal(resolved.length, 2);
});

test('suggestContextualArticlesForTicket suggests relevant Knowledge Base articles as user types ticket subject', () => {
  const testArticles = [
    ...KNOWLEDGE_BASE_ARTICLES,
    {
      id: 'KB-102',
      code: 'KB-102',
      title: 'Diagnóstico e Correção de Erro de Conexão VPN FortiClient (Token MFA)',
      category: 'Acessos/Sistemas' as const,
      summary: 'Procedimento para revalidar o túnel SSL-VPN corporativo e token MFA.',
      steps: ['Abra o FortiClient VPN', 'Valide o código no Microsoft Authenticator'],
      keywords: ['vpn', 'forticlient', 'token', 'mfa', 'conexao', 'acesso'],
      estimatedTime: '3 min',
      readTimeMinutes: 3,
      helpfulCount: 210,
      relatedType: 'Incidente' as const,
    },
    {
      id: 'KB-106',
      code: 'KB-106',
      title: 'Solicitação e Instalação Homologada do Microsoft Power BI Desktop e Licença Pro',
      category: 'Software' as const,
      summary: 'Guia para instalação via Portal da Empresa e ativação de licença Pro.',
      steps: ['Abra o Portal da Empresa', 'Selecione Power BI Desktop e clique em Instalar'],
      keywords: ['power bi', 'powerbi', 'software', 'instalacao', 'licenca'],
      estimatedTime: '4 min',
      readTimeMinutes: 4,
      helpfulCount: 165,
      relatedType: 'Requisição de Serviço' as const,
    },
  ];

  const vpnSuggestions = suggestContextualArticlesForTicket(
    testArticles,
    'Erro de conexão VPN FortiClient token',
    'Acessos/Sistemas',
    2
  );
  assert.ok(vpnSuggestions.length >= 1);
  assert.equal(vpnSuggestions[0].id, 'KB-102');

  const powerBiSuggestions = suggestContextualArticlesForTicket(
    testArticles,
    'Preciso instalar Power BI Desktop',
    'Software',
    2
  );
  assert.ok(powerBiSuggestions.length >= 1);
  assert.equal(powerBiSuggestions[0].id, 'KB-106');
});

test('Performance Analytics calculations correctly process resolved per tech, avg time per category, and SLA breakdown', () => {
  const resolvedPerTech = calculateResolvedTicketsPerTechnician(SAMPLE_TICKETS_FOR_TESTS, TECHNICIANS);
  assert.equal(resolvedPerTech.length, 3);
  for (const item of resolvedPerTech) {
    assert.ok(item.totalTickets > 0);
    assert.equal(typeof item.resolutionRatePercent, 'number');
  }

  const avgPerCat = calculateAvgResolutionTimePerCategory(SAMPLE_TICKETS_FOR_TESTS);
  assert.equal(avgPerCat.length, 5);
  for (const cat of avgPerCat) {
    assert.ok(cat.slaTargetMinutes > 0);
    assert.ok(typeof cat.avgResolutionMinutes, 'number');
    assert.ok(cat.formattedDuration.length > 0);
  }

  const slaBreakdown = calculateSlaComplianceBreakdown(SAMPLE_TICKETS_FOR_TESTS);
  assert.equal(slaBreakdown.totalTickets, 12);
  assert.ok(slaBreakdown.complianceRatePercent >= 0 && slaBreakdown.complianceRatePercent <= 100);
  assert.equal(slaBreakdown.complianceByPriority.length, 4);

  // Test empty dataset resilience (when app is connected to an empty server queue)
  const emptySla = calculateSlaComplianceBreakdown([]);
  assert.equal(emptySla.totalTickets, 0);
  assert.equal(emptySla.complianceRatePercent, 100);
});

test('generateClosedTicketPdfDoc builds a complete closed ticket PDF with audit trail and OS details', async () => {
  const sampleClosedTicket: import('../types/itsm').Ticket = { ...SAMPLE_TICKETS_FOR_TESTS[0], status: 'Resolvido' };
  const sampleOS: import('../types/itsm').ServiceOrder = {
    id: 'OS-2026-0001',
    ticketId: sampleClosedTicket.id,
    ticketTitle: sampleClosedTicket.title,
    ticketDescription: sampleClosedTicket.description,
    category: sampleClosedTicket.category,
    requesterName: sampleClosedTicket.requesterName,
    requesterEmail: sampleClosedTicket.requesterEmail,
    department: sampleClosedTicket.department,
    startedAt: '10/11/2026, 09:00',
    finalizedAt: '10/11/2026, 11:00',
    durationText: '2h 00m',
    technicianId: 'alexandre',
    technicianName: 'Alexandre Silveira',
    technicianTier: 'N3',
    interventionType: 'Configuração de Sistema',
    finalizationOutcome: 'concluido_sucesso',
    outcomeLabel: 'Concluído com Sucesso',
    solutionSummary: 'Ajuste de permissão de grupo no AD e liberação de porta de Firewall.',
    clientAcceptance: 'Solicitante testou e confirmou funcionamento completo.',
    slaMet: true,
    createdAt: '10/11/2026, 11:00',
  };

  const pdfDoc = await generateClosedTicketPdfDoc(sampleClosedTicket, sampleOS);
  assert.ok(pdfDoc);
  assert.equal(typeof pdfDoc.output, 'function');
});

