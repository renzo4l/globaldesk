import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Filter,
  Gauge,
  PieChart as PieIcon,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Technician,
  TechnicianId,
  Ticket,
  TicketCategory,
} from '../types/itsm';
import {
  calculateAvgResolutionTimePerCategory,
  calculateDashboardKpis,
  calculateResolvedTicketsPerTechnician,
  calculateSlaComplianceBreakdown,
  formatMinutesDuration,
} from '../utils/itilRules';

interface PerformanceAnalyticsProps {
  tickets: Ticket[];
  technicians: Technician[];
  activeTechId?: TechnicianId;
  onRefresh?: () => void;
}

export const PerformanceAnalytics: React.FC<PerformanceAnalyticsProps> = ({
  tickets,
  technicians,
  activeTechId,
  onRefresh,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'Todas'>('Todas');

  const filteredTickets = useMemo(() => {
    if (categoryFilter === 'Todas') return tickets;
    return tickets.filter((t) => t.category === categoryFilter);
  }, [tickets, categoryFilter]);

  const kpis = useMemo(() => {
    return calculateDashboardKpis(filteredTickets);
  }, [filteredTickets]);

  const resolvedByTechData = useMemo(() => {
    return calculateResolvedTicketsPerTechnician(filteredTickets, technicians);
  }, [filteredTickets, technicians]);

  const avgTimePerCategoryData = useMemo(() => {
    return calculateAvgResolutionTimePerCategory(tickets);
  }, [tickets]);

  const slaBreakdown = useMemo(() => {
    return calculateSlaComplianceBreakdown(filteredTickets);
  }, [filteredTickets]);

  const slaPieData = useMemo(() => {
    return [
      {
        name: 'Dentro do SLA',
        value: slaBreakdown.compliantCount,
        color: '#10B981', // emerald-500
      },
      {
        name: 'Em Risco / Expirando',
        value: slaBreakdown.atRiskCount,
        color: '#F59E0B', // amber-500
      },
      {
        name: 'SLA Violado',
        value: slaBreakdown.breachedCount,
        color: '#EF4444', // red-500
      },
    ].filter((item) => item.value > 0);
  }, [slaBreakdown]);

  const totalTicketsCount = tickets.length;

  return (
    <div className="space-y-6">
      {/* Top Header & Operational Context */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Métricas Operacionais ITIL v4
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Atualização Contínua
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 shrink-0" />
            Performance Analytics · Console de Eficiência do Service Desk
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Indicadores gerenciais de atendimento por analista (Elias N1, Mauricio N2 e Alexandre N3), tempo médio de resolução por categoria e taxa de conformidade com os Acordos de Nível de Serviço (SLA).
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Categoria:</span>
            <select
              aria-label="Filtrar métricas por categoria"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as TicketCategory | 'Todas')}
              className="bg-transparent font-semibold text-blue-700 focus:outline-none cursor-pointer"
            >
              <option value="Todas">Todas as Categorias</option>
              <option value="Hardware">Hardware</option>
              <option value="Software">Software</option>
              <option value="Rede">Rede</option>
              <option value="Acessos/Sistemas">Acessos/Sistemas</option>
              <option value="Telefonia">Telefonia</option>
            </select>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              aria-label="Atualizar dados de desempenho"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: SLA Compliance */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
              Taxa de Conformidade SLA
            </span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {slaBreakdown.complianceRatePercent}%
            </span>
            <span className="text-xs font-semibold text-emerald-700 flex items-center">
              <ArrowUpRight className="w-3.5 h-3.5" />
              Meta corporativa: 95%
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>{slaBreakdown.compliantCount} conformes</span>
            <span className="text-red-600 font-semibold">{slaBreakdown.breachedCount} violados</span>
          </div>
        </div>

        {/* KPI 2: Total Resolved Tickets */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
              Chamados Resolvidos
            </span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-200">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {kpis.totalResolvedTickets}
            </span>
            <span className="text-xs text-slate-500">
              de {filteredTickets.length} chamados
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Fila em aberto: {kpis.totalOpenTickets}</span>
            <span className="font-mono font-semibold text-blue-700">
              {filteredTickets.length > 0 ? Math.round((kpis.totalResolvedTickets / filteredTickets.length) * 100) : 0}% taxa
            </span>
          </div>
        </div>

        {/* KPI 3: Average Resolution Time */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
              Tempo Médio de Resolução
            </span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-200">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {formatMinutesDuration(kpis.avgResolutionMinutes)}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({kpis.avgResolutionMinutes}m)
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>MTTR operacional</span>
            <span className="text-slate-600 font-medium">Meta geral &lt; 2h</span>
          </div>
        </div>

        {/* KPI 4: Critical & Risk Queue */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
              Incidentes Críticos P1
            </span>
            <div className="w-7 h-7 rounded-lg bg-red-50 text-red-700 flex items-center justify-center border border-red-200">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight">
              {kpis.criticalOpenCount}
            </span>
            <span className="text-xs text-red-600 font-semibold">
              em atendimento
            </span>
          </div>
          <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
            <span>Risco de estouro: {kpis.expiringSoonCount}</span>
            <span className="text-slate-700 font-mono">Alexandre (N3)</span>
          </div>
        </div>
      </div>

      {/* Main Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CHART 1: Tickets Resolved by Technician */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-600" />
                Chamados Resolvidos por Analista (Throughput Técnico)
              </h3>
              <p className="text-xs text-slate-500">
                Comparativo de chamados concluídos vs em andamento por especialista da equipe.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded self-start sm:self-auto">
              3 Analistas Corporativos
            </span>
          </div>

          {totalTicketsCount === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-slate-200 rounded-lg">
              <UserCheck className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Nenhum chamado atribuído no momento</p>
              <p className="text-[11px] text-slate-400">A fila de chamados está limpa e pronta para receber tickets do servidor.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={resolvedByTechData}
                  margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value ?? 0)} chamados`,
                      name === 'resolvedCount' ? 'Resolvidos' : 'Em Aberto',
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(val) => (val === 'resolvedCount' ? 'Concluídos' : 'Em Aberto')}
                  />
                  <Bar dataKey="resolvedCount" name="resolvedCount" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="openCount" name="openCount" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Individual Technician Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
            {resolvedByTechData.map((tech) => (
              <div
                key={tech.id}
                className={`p-2.5 rounded-lg border text-xs transition-colors ${
                  activeTechId === tech.id
                    ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{tech.name}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold bg-white border border-slate-200 text-slate-700">
                    {tech.tier}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Taxa: <strong>{tech.resolutionRatePercent}%</strong></span>
                  <span className="font-mono text-emerald-700 font-semibold">{tech.resolvedCount} resolvidos</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 2: Average Resolution Time per Category */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Tempo Médio de Resolução por Categoria (MTTR em Minutos)
              </h3>
              <p className="text-xs text-slate-500">
                Duração real vs meta estipulada em minutos nas 5 categorias do catálogo de serviços.
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 self-start sm:self-auto">
              5 Categorias
            </span>
          </div>

          {totalTicketsCount === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-slate-200 rounded-lg">
              <Clock className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Sem chamados registrados no momento</p>
              <p className="text-[11px] text-slate-400">Assim que novos tickets forem abertos, o tempo médio por categoria será calculado em tempo real.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={avgTimePerCategoryData}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 30, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: '#64748B' }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="shortLabel"
                    type="category"
                    tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }}
                    axisLine={{ stroke: '#CBD5E1' }}
                    tickLine={false}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value ?? 0)} min`,
                      name === 'avgResolutionMinutes' ? 'Média Real' : 'Meta Máxima',
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                    formatter={(val) => (val === 'avgResolutionMinutes' ? 'Tempo Médio Real (min)' : 'Meta SLA (min)')}
                  />
                  <Bar dataKey="avgResolutionMinutes" name="avgResolutionMinutes" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="slaTargetMinutes" name="slaTargetMinutes" fill="#CBD5E1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quick Category Summary Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-slate-100">
            {avgTimePerCategoryData.map((item) => (
              <div key={item.category} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <div className="text-[10px] font-bold text-slate-500 uppercase">{item.shortLabel}</div>
                <div className="text-xs font-extrabold text-slate-900 font-mono mt-0.5">
                  {item.formattedDuration}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {item.ticketsSampled} {item.ticketsSampled === 1 ? 'ticket' : 'tickets'}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 3: SLA Compliance Rate by Priority Level */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-emerald-600" />
                Taxa de Cumprimento de SLA por Prioridade (P1 a P4)
              </h3>
              <p className="text-xs text-slate-500">
                Percentual de atendimento dentro da janela contratada de 1ª resposta e resolução final.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                Geral: {slaBreakdown.complianceRatePercent}%
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={slaBreakdown.complianceByPriority}
                margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="code"
                  tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  axisLine={{ stroke: '#CBD5E1' }}
                  tickLine={false}
                  unit="%"
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value ?? 0)}%`,
                    name === 'ratePercent' ? 'Conformidade' : String(name),
                  ]}
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderRadius: '8px',
                    border: 'none',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="ratePercent" name="ratePercent" radius={[4, 4, 0, 0]}>
                  {slaBreakdown.complianceByPriority.map((entry) => {
                    const color =
                      entry.ratePercent >= 90
                        ? '#10B981'
                        : entry.ratePercent >= 75
                        ? '#F59E0B'
                        : '#EF4444';
                    return <Cell key={`cell-sla-${entry.code}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100">
            {slaBreakdown.complianceByPriority.map((item) => (
              <div key={item.code} className="p-2 rounded-lg bg-slate-50 border border-slate-200 text-center">
                <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-slate-800">
                  <span className="font-mono text-blue-700">{item.code}</span>
                  <span>({item.priority})</span>
                </div>
                <div
                  className={`text-sm font-extrabold font-mono mt-0.5 ${
                    item.ratePercent >= 90
                      ? 'text-emerald-700'
                      : item.ratePercent >= 75
                      ? 'text-amber-700'
                      : 'text-red-700'
                  }`}
                >
                  {item.ratePercent}%
                </div>
                <div className="text-[10px] text-slate-500">
                  Meta: {item.targetText} ({item.compliant}/{item.total})
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CHART 4: Tickets Distribution & SLA Health Status */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <PieIcon className="w-4 h-4 text-blue-600" />
                Distribuição de Status de SLA &amp; Fila
              </h3>
              <p className="text-xs text-slate-500">
                Composição do total de chamados ativos entre saudável, em risco e violado.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Total: {filteredTickets.length} chamados
            </span>
          </div>

          {totalTicketsCount === 0 || slaPieData.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-slate-200 rounded-lg">
              <PieIcon className="w-8 h-8 text-slate-400 mb-2" />
              <p className="text-xs font-semibold text-slate-700">Fila Limpa / Sem Incidentes</p>
              <p className="text-[11px] text-slate-400">Nenhum chamado ativo ou com violação de prazo no momento.</p>
            </div>
          ) : (
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slaPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {slaPieData.map((entry, index) => (
                      <Cell key={`cell-pie-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${Number(value ?? 0)} chamados`,
                      String(name),
                    ]}
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderRadius: '8px',
                      border: 'none',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center">
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-800 uppercase">Conformes</div>
              <div className="text-sm font-extrabold text-emerald-700 font-mono mt-0.5">
                {slaBreakdown.compliantCount}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold text-amber-800 uppercase">Em Risco</div>
              <div className="text-sm font-extrabold text-amber-700 font-mono mt-0.5">
                {slaBreakdown.atRiskCount}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-red-50 border border-red-200">
              <div className="text-[10px] font-bold text-red-800 uppercase">Violados</div>
              <div className="text-sm font-extrabold text-red-700 font-mono mt-0.5">
                {slaBreakdown.breachedCount}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
