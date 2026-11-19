# 🌐 Global Desk — Plataforma Corporativa de ITSM & CMDB (ITIL v4)

> **Plataforma Full-Stack de Service Desk, Governança de SLA, Ordens de Serviço (O.S.) e Gestão Patrimonial de Ativos de TI (CMDB)** desenvolvida sob medida para a operação de Engenharia & TI do **Grupo Global**.

---

## 📋 Descrição para o Repositório GitHub (About / Description)

> **Descrição curta sugerida para o GitHub:**  
> `Plataforma corporativa Full-Stack de Service Desk (ITSM) e Gestão de Inventário/Ativos de TI (CMDB) baseada em ITIL v4, com arquitetura Zero-Trust, SLA automatizado e geração de O.S. e Termos Patrimoniais em PDF (React 19, TypeScript, Node.js, Express, Prisma & PostgreSQL).`

> **Topics sugeridos:**  
> `itsm` `itil-v4` `service-desk` `cmdb` `asset-management` `react` `typescript` `tailwindcss` `nodejs` `express` `prisma` `postgresql` `zero-trust` `windows-server` `iis`

---

## ✨ Principais Módulos e Funcionalidades

### 1. 🖥️ Console Operacional Técnico (`/tecnico` — Zendesk Agent Workspace Style)
- **Visualizações Dinâmicas (9 Views Operacionais):** Triagem prioritária de incidentes críticos (P1), filas dedicadas por nível de suporte (**N1 · Elias**, **N2 · Mauricio** e **N3 · Alexandre**), monitoramento de SLA em risco e chamados aguardando resposta do solicitante.
- **Matriz Dinâmica de Prioridade ITIL v4 (`Impacto × Urgência`):** Cálculo automático de prioridade (**P1 Crítica**, **P2 Alta**, **P3 Média**, **P4 Baixa**) com metas formais de 1ª resposta e resolução final.
- **Next Ticket Routing (*Reproduzir Fila / Play*):** Algoritmo que seleciona automaticamente o próximo chamado não resolvido de maior criticidade e menor tempo restante de SLA.
- **Comunicação Segregada (Público vs. Canal Técnico Interno):** Notas técnicas internas com categorias (*Diagnóstico, Handoff, Infraestrutura, Escalonamento*) e *snippets* de comandos/logs nunca são expostas aos colaboradores solicitantes.
- **Ações em Lote e Popover de Pré-visualização:** Alteração de status e reatribuição de múltiplos chamados simultaneamente, além de *hover card* instantâneo na fila de alta densidade.

### 2. 📄 Emissão de Ordens de Serviço (O.S.) e Auditoria em PDF
- **Encerramento Técnico Formal:** Geração de Ordem de Serviço numerada (`OS-2026-XXXX`) com classificação de desfecho (*Concluído com Sucesso*, *Workaround*, *Inviabilidade Técnica*, *Cancelado* ou *Fora do Escopo*), insumos utilizados e aceite do solicitante.
- **Laudos e Relatórios PDF (`jsPDF` sob demanda):**
  - PDF individual da Ordem de Serviço com assinaturas customizáveis;
  - Relatório Consolidado de O.S. em formato paisagem (A4 Landscape);
  - Relatório Integral de Auditoria do Chamado Fechado com linha do tempo rastreável.

### 3. 🗄️ Gestão de Inventário & Ativos de TI — CMDB (`Asset Management`)
- **Controle Patrimonial Completo:** Tombamento sequencial automático (`PAT-2026-XXXX`), rastreamento de *Service Tag / Número de Série*, nota fiscal (NF-e), fornecedor, valor contábil, garantia e localização física.
- **Ciclo de Vida Auditável & Emissão Automática de Termos Oficiais (`TERM-2026-XXXX`):**
  1. **Aquisição & Incorporação:** Entrada de novo equipamento com geração automática do *Termo de Aquisição e Incorporação Patrimonial* em PDF.
  2. **Movimentação / Entrega / Devolução / Manutenção:** Transferência de custódia nominal a colaboradores ou remessa para laboratório/RMA com checklist de acessórios e emissão do *Termo de Responsabilidade e Guarda* ou *Termo de Devolução*.
  3. **Baixa Patrimonial (Laudo Condenatório):** Desincorporação auditável com justificativa técnica obrigatória e emissão do *Laudo Técnico de Baixa Patrimonial* em PDF.

### 4. 🤝 Portal de Autoatendimento do Colaborador (`/`)
- **Pesquisa Semântica Instantânea (*Search-First*):** Busca com *typeahead* e *debounce* para deflexão inteligente de chamados antes da abertura.
- **Catálogo de Serviços Homologados:** Solicitações rápidas pré-preenchidas para *Hardware & Periféricos*, *Acessos, Contas & Segurança (VPN/MFA/SAP)*, *Softwares & Licenciamento*, *Rede & Conectividade* e *Telefonia VoIP*.
- **Rastreador "Meus Chamados":** Visão simplificada com linguagem amigável para acompanhamento do prazo de SLA e interação pública com a equipe de TI.

### 5. 📊 Analytics, Base de Conhecimento (KB) e Gestão de Usuários
- **Performance Analytics (`Recharts`):** Gráficos executivos de chamados por categoria, taxa de cumprimento de SLA e tempo médio de resolução por analista.
- **Gerenciador de Base de Conhecimento:** Criação, edição e publicação de runbooks e tutoriais de autoatendimento sincronizados com o banco PostgreSQL.
- **Gestão de Credenciais & RBAC:** Administração de contas corporativas, níveis de suporte (`N1`, `N2`, `N3`) e ativação/suspensão de acessos.

---

## 🛡️ Arquitetura de Segurança Zero-Trust

| Camada | Implementação |
| :--- | :--- |
| **Autenticação & Sessão** | JWT assinado no servidor e armazenado exclusivamente em cookie `HttpOnly`, `SameSite=Lax` (imune a roubo via XSS). |
| **SSO Corporativo** | Integração OAuth 2.0 com Google Workspace restrita por domínio corporativo (`WORKSPACE_DOMAIN`). |
| **Criptografia de Senhas** | Hashing com `bcrypt` (`12 salt rounds`) e validação de complexidade forte. |
| **Controle de Acesso (RBAC)** | Middlewares `requireAuth`, `requireTechRole` e `requireAdminRole`. Colaboradores só acessam seus próprios chamados (`where.requesterId = req.user.id`) e nunca recebem notas `INTERNAL`. |
| **Anti-Mass Assignment & Validação** | Schemas estritos com **Zod** no back-end e projeção segura `SAFE_USER_SELECT` no Prisma (jamais retornando `passwordHash`). |
| **Hardening HTTP** | Cabeçalhos de segurança via `helmet`, política estrita de `CORS` por whitelist e proteção anti-força bruta/DoS via `express-rate-limit`. |

---

## ⚡ Engenharia de UI/UX & Otimização de Performance

- **Animações Aceleradas por GPU:** Transições fluidas baseadas exclusivamente em `transform` e `opacity` (`cubic-bezier(0.16, 1, 0.3, 1)`), com animações de entrada/saída (`useAnimatedPresence`) em Drawers e Modais, transições suaves de abas (`150ms`) e suporte nativo a `@media (prefers-reduced-motion: reduce)` para acessibilidade e sessões RDP.
- **Skeleton Screens Anti-CLS:** Estados de carregamento estruturados (`animate-pulse`) para tabelas de chamados, inventário CMDB e cards de KPI.
- **Code Splitting & Lazy Loading:** Carregamento sob demanda (`React.lazy` + `Suspense`) dos módulos pesados e importação dinâmica do motor PDF (`await import('jspdf')`) apenas no instante da exportação, além de separação de chunks no Vite (`vendor-react`, `vendor-icons`, `vendor-pdf`).
- **Prevenção de Re-renderizações:** Linhas de tabelas de alta densidade isoladas com `React.memo`, callbacks estabilizados com `useCallback`, agregações com `useMemo` e *debounce* (`220ms`) nas barras de pesquisa.
- **Índices Compostos no PostgreSQL:** Índices otimizados no `schema.prisma` (`status`, `priority`, `requesterId`, `assigneeId`, `assetTag`, `[status, createdAt]`, `[requesterId, createdAt]`).

---

## 🛠️ Stack Tecnológica

- **Front-end (`frontend/`):** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons, Recharts, jsPDF.
- **Back-end (`backend/`):** Node.js (LTS), Express, TypeScript, Prisma ORM, PostgreSQL, Zod, JSON Web Token (`jsonwebtoken`), Bcrypt, Google Auth Library, Helmet, Express Rate Limit.

---

## 📂 Estrutura do Repositório

```text
globaldesk/
├── backend/                     # API REST Node.js + Express + Prisma + PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma        # Modelagem relacional e índices PostgreSQL
│   │   └── seed.ts              # Provisionamento inicial (Superadmin + dados base)
│   ├── src/
│   │   ├── config/              # Validação fail-fast de variáveis de ambiente
│   │   ├── lib/                 # Instância singleton do Prisma Client
│   │   ├── middleware/          # Autenticação JWT HttpOnly e guardas RBAC
│   │   ├── routes/              # Rotas REST (auth, tickets, assets, serviceOrders, kb, users)
│   │   ├── schemas/             # Contratos de validação Zod
│   │   ├── utils/               # Regras ITIL v4 e cálculos de SLA no servidor
│   │   └── server.ts            # Entrypoint Express com Helmet, CORS e Rate Limit
│   └── .env.example             # Modelo seguro de variáveis de ambiente
├── frontend/                    # SPA React 19 + TypeScript + Vite + Tailwind CSS v4
│   ├── src/
│   │   ├── assets/              # Logotipos vetoriais/base64 oficiais do Grupo Global
│   │   ├── components/          # Console Técnico, Portal, CMDB, Drawers, Modais e Skeletons
│   │   ├── services/            # Cliente HTTP centralizado (credentials: 'include')
│   │   ├── types/               # Tipagens TypeScript do domínio ITSM & CMDB
│   │   ├── utils/               # Regras ITIL, geradores PDF (O.S./Termos) e hooks de performance
│   │   ├── App.tsx              # Roteamento por perfil e orquestração de estado
│   │   └── index.css            # Design tokens, keyframes GPU e acessibilidade
│   └── vite.config.ts           # Code splitting e manualChunks de produção
├── LICENSE                      # Licença do projeto
└── README.md                    # Documentação principal
```

---

## 🚀 Como Executar em Ambiente de Desenvolvimento

### Pré-requisitos
- **Node.js v20+ (LTS)**
- **PostgreSQL 14+** rodando localmente na porta `5432` (banco `globaldesk`)

### 1. Configurar e Iniciar o Back-end (`porta 3001`)
```bash
cd backend
npm install

# Copie o arquivo de exemplo e configure sua senha do PostgreSQL em .env
cp .env.example .env

# Gere o Prisma Client, sincronize o schema e popule o Superadmin inicial
npx prisma generate
npx prisma db push
npx prisma db seed

# Inicie o servidor em modo de desenvolvimento
npm run dev
```

### 2. Configurar e Iniciar o Front-end (`porta 3000`)
```bash
cd frontend
npm install

# Execute os testes unitários e validação de tipos
npx tsc --noEmit
npm test

# Inicie a interface web
npm run dev
```

Acesse:
- **Portal do Colaborador:** `http://localhost:3000/`
- **Console Técnico & CMDB:** `http://localhost:3000/tecnico`

---

**Desenvolvido para Engenharia & TI · Grupo Global**
