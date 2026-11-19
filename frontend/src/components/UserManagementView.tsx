import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Search,
  UserPlus,
  Users,
  XCircle,
  Pencil,
  Save,
  Trash2,
} from 'lucide-react';
import { Department, SupportTier, SystemUser, SystemUserRole } from '../types/itsm';
import { LOGO_PATHS } from '../assets/logos';
import { CORPORATE_DEPARTMENTS as DEPARTMENTS } from '../utils/formatters';

interface UserManagementViewProps {
  users: SystemUser[];
  onAddUser: (newUser: SystemUser, password?: string) => void;
  onUpdateUser?: (userId: string, updatedData: Partial<SystemUser> & { password?: string }) => void;
  onToggleUserStatus?: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
  isSuperAdmin?: boolean;
}

const ROLES: { role: SystemUserRole; tier?: SupportTier; desc: string }[] = [
  {
    role: 'Analista N1 (Service Desk)',
    tier: 'N1',
    desc: 'Atendimento inicial, triagem de incidentes e requisições rotineiras',
  },
  {
    role: 'Analista N2 (Infraestrutura/Redes)',
    tier: 'N2',
    desc: 'Sustentação avançada de infraestrutura, redes e hardware corporativo',
  },
  {
    role: 'Analista N3 (Coordenação/Sistemas)',
    tier: 'N3',
    desc: 'Coordenação operacional, sistemas legados, ERP e alinhamento executivo',
  },
  {
    role: 'Administrador de TI',
    tier: 'N3',
    desc: 'Gestão completa da plataforma, políticas de segurança e governança',
  },
  {
    role: 'Colaborador Solicitante',
    desc: 'Acesso ao catálogo de serviços corporativos e autoatendimento',
  },
];

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onAddUser,
  onUpdateUser,
  onToggleUserStatus,
  onDeleteUser,
}) => {
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [targetEditUserId, setTargetEditUserId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<SystemUserRole>('Analista N1 (Service Desk)');
  const [department, setDepartment] = useState<Department>('Engenharia & TI');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleChecking, setIsGoogleChecking] = useState(false);
  const [isGoogleVerified, setIsGoogleVerified] = useState(false);
  const [googleCheckFeedback, setGoogleCheckFeedback] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [searchUser, setSearchUser] = useState('');

  // Password validation rules
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const hasMinLength = password.length >= 8;

  const validPasswordRulesCount = [
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSymbol,
    hasMinLength,
  ].filter(Boolean).length;

  const isPasswordValid = validPasswordRulesCount === 5;
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  // Google email format and identity verification
  const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handleValidateWithGoogle = () => {
    if (!isEmailFormatValid) {
      setGoogleCheckFeedback('Informe um endereço de e-mail corporativo válido para verificar.');
      setIsGoogleVerified(false);
      return;
    }

    setIsGoogleChecking(true);
    setGoogleCheckFeedback(null);

    // Simulate Google Workspace / Google OAuth token identity check
    setTimeout(() => {
      setIsGoogleChecking(false);
      const domain = email.split('@')[1] || '';
      setIsGoogleVerified(true);
      setGoogleCheckFeedback(
        `Conta Google verificada com sucesso (${domain}). Pronta para autenticação SSO corporativa.`
      );
    }, 700);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (fullName.trim().length < 3) {
      setFormError('Informe o nome completo do usuário (mínimo de 3 caracteres).');
      return;
    }

    if (!isEmailFormatValid) {
      setFormError('Informe um e-mail válido para o usuário.');
      return;
    }

    const selectedRoleObj = ROLES.find((r) => r.role === selectedRole);
    const names = fullName.trim().split(/\s+/);
    const initials =
      names.length > 1
        ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
        : fullName.slice(0, 2).toUpperCase();

    // Modo EDIÇÃO
    if (formMode === 'edit' && targetEditUserId) {
      if (onUpdateUser) {
        onUpdateUser(targetEditUserId, {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          role: selectedRole,
          tier: selectedRoleObj?.tier,
          department,
          avatarInitials: initials,
        });
      }
      setFormSuccess(`Usuário ${fullName.trim()} atualizado com sucesso no sistema!`);
      resetFormToCreate();
      setTimeout(() => setFormSuccess(''), 5000);
      return;
    }

    // Modo CRIAÇÃO
    if (!isGoogleVerified) {
      setFormError('Por favor, confirme a validação da conta pelo Google antes de criar o usuário.');
      return;
    }

    if (!isPasswordValid) {
      setFormError('A senha deve atender a todos os 5 critérios de segurança obrigatórios.');
      return;
    }

    if (!passwordsMatch) {
      setFormError('A confirmação de senha não confere com a senha digitada.');
      return;
    }

    // Check if email already exists
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
      setFormError('Já existe um usuário cadastrado com este endereço de e-mail.');
      return;
    }

    const newUser: SystemUser = {
      id: `usr-${Date.now()}`,
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role: selectedRole,
      tier: selectedRoleObj?.tier,
      department,
      isGoogleVerified: true,
      googleAccountDomain: email.split('@')[1],
      createdAt: 'Hoje',
      status: 'Ativo',
      avatarInitials: initials,
    };

    onAddUser(newUser, password);

    setFormSuccess(`Usuário ${newUser.fullName} cadastrado com sucesso com validação Google!`);
    resetFormToCreate();
    setTimeout(() => setFormSuccess(''), 6000);
  };

  const resetFormToCreate = () => {
    setFormMode('create');
    setTargetEditUserId(null);
    setFullName('');
    setEmail('');
    setSelectedRole('Analista N1 (Service Desk)');
    setDepartment('Engenharia & TI');
    setPassword('');
    setConfirmPassword('');
    setIsGoogleVerified(false);
    setGoogleCheckFeedback(null);
    setFormError('');
  };

  const loadUserToForm = (u: SystemUser) => {
    setFormMode('edit');
    setTargetEditUserId(u.id);
    setFullName(u.fullName);
    setEmail(u.email);
    setSelectedRole(u.role);
    setDepartment(u.department);
    setIsGoogleVerified(true);
    setGoogleCheckFeedback(`Conta Google corporativa associada: ${u.email}`);
    setFormError('');
    setFormSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredUsers = useMemo(() => {
    const q = searchUser.toLowerCase().trim();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q)
    );
  }, [users, searchUser]);

  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <img src={LOGO_PATHS.dark} alt="Grupo Global" className="h-5 object-contain" />
            <span className="text-slate-300">|</span>
            <Users className="w-4 h-4 text-blue-600" />
            Gestão de Contas &amp; Criação de Usuários do Grupo Global
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre novos analistas ou colaboradores com validação de conta Google e requisitos avançados de senha.
          </p>
        </div>
        <div className="font-mono text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
          Total de Usuários: <strong>{users.length}</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Form: User Creation */}
        <section
          aria-label="Formulário de Criação de Usuário"
          className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                {formMode === 'edit' ? (
                  <>
                    <Pencil className="w-4 h-4 text-emerald-600" />
                    Editar Dados do Usuário
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 text-blue-600" />
                    Cadastrar Novo Usuário no Sistema
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {formMode === 'edit'
                  ? 'Modifique os dados do usuário e salve diretamente na base de dados.'
                  : 'Defina as credenciais, verificação Google e perfil de acesso do profissional.'}
              </p>
            </div>
            {formMode === 'edit' && (
              <button
                type="button"
                onClick={resetFormToCreate}
                className="px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                + Novo Usuário
              </button>
            )}
          </div>

          {formError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div
              role="status"
              className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-semibold flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{formSuccess}</span>
            </div>
          )}

          <form onSubmit={handleSaveForm} className="space-y-4">
            {/* Nome Completo */}
            <div>
              <label htmlFor="user-fullname" className="block text-xs font-semibold text-slate-800 mb-1">
                Nome Completo do Usuário
              </label>
              <input
                id="user-fullname"
                type="text"
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (formError) setFormError('');
                }}
                className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Informe o nome e sobrenome oficial do analista ou solicitante.
              </p>
            </div>

            {/* E-mail Corporativo & Validação Google */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="user-email" className="block text-xs font-semibold text-slate-800">
                  E-mail Corporativo (Conta Google)
                </label>
                {isGoogleVerified && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    <Check className="w-3 h-3 text-emerald-600" />
                    Google Verificado
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsGoogleVerified(false);
                    setGoogleCheckFeedback(null);
                    if (formError) setFormError('');
                  }}
                  className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                />

                <button
                  type="button"
                  disabled={!isEmailFormatValid || isGoogleChecking || isGoogleVerified}
                  onClick={handleValidateWithGoogle}
                  className="px-3 py-2 text-xs font-bold rounded-lg bg-white border border-slate-300 hover:border-blue-400 text-slate-700 hover:text-blue-700 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{isGoogleChecking ? 'Verificando...' : isGoogleVerified ? 'Verificado' : 'Validar com Google'}</span>
                </button>
              </div>

              {googleCheckFeedback && (
                <p
                  className={`text-[11px] leading-relaxed ${
                    isGoogleVerified ? 'text-emerald-700 font-medium' : 'text-amber-800'
                  }`}
                >
                  {googleCheckFeedback}
                </p>
              )}
              {!googleCheckFeedback && (
                <p className="text-[11px] text-slate-500">
                  Clique em "Validar com Google" para autenticar o domínio corporativo e habilitar o cadastro.
                </p>
              )}
            </div>

            {/* Perfil e Setor */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="user-role" className="block text-xs font-semibold text-slate-800 mb-1">
                  Perfil de Acesso
                </label>
                <select
                  id="user-role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as SystemUserRole)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {ROLES.map((r) => (
                    <option key={r.role} value={r.role}>
                      {r.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="user-department" className="block text-xs font-semibold text-slate-800 mb-1">
                  Setor / Departamento
                </label>
                <select
                  id="user-department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value as Department)}
                  className="w-full text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Senha com Validação Estrita (Obrigatória na Criação, Opcional na Edição) */}
            {formMode === 'create' ? (
              <>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/40 space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="user-password" className="block text-xs font-semibold text-slate-800 flex items-center gap-1">
                      <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                      Senha de Acesso ao Sistema
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-500 hover:text-slate-800 text-[11px] flex items-center gap-1"
                    >
                      {showPassword ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5" /> Ocultar
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5" /> Exibir
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    id="user-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className="w-full text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />

                  {/* Password Requirements Checklist */}
                  <div className="space-y-1.5 pt-1">
                    <span className="block text-[11px] font-bold text-slate-700">
                      Critérios de Segurança Obrigatórios da Senha:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-[11px]">
                      <div
                        className={`flex items-center gap-1.5 ${
                          hasUpperCase ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {hasUpperCase ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Pelo menos 1 letra maiúscula (A-Z)</span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 ${
                          hasLowerCase ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {hasLowerCase ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Pelo menos 1 letra minúscula (a-z)</span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 ${
                          hasNumber ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {hasNumber ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Pelo menos 1 número (0-9)</span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 ${
                          hasSymbol ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {hasSymbol ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Pelo menos 1 símbolo (!@#$%...)</span>
                      </div>

                      <div
                        className={`flex items-center gap-1.5 sm:col-span-2 ${
                          hasMinLength ? 'text-emerald-700 font-semibold' : 'text-slate-500'
                        }`}
                      >
                        {hasMinLength ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-slate-400" />
                        )}
                        <span>Comprimento mínimo de 8 caracteres</span>
                      </div>
                    </div>
                  </div>

                  {/* Password Strength Progress Bar */}
                  <div className="pt-1">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500">Força da Senha:</span>
                      <span className="font-bold text-slate-800">
                        {validPasswordRulesCount === 5
                          ? 'Excelente (Conforme)'
                          : validPasswordRulesCount >= 3
                          ? 'Moderada'
                          : 'Fraca / Incompleta'}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          validPasswordRulesCount === 5
                            ? 'bg-emerald-600 w-full'
                            : validPasswordRulesCount >= 3
                            ? 'bg-amber-500 w-3/5'
                            : 'bg-red-500 w-1/5'
                        }`}
                      />
                    </div>
                  </div>
                </div>

                {/* Confirmação de Senha */}
                <div>
                  <label htmlFor="user-confirm-password" className="block text-xs font-semibold text-slate-800 mb-1">
                    Confirmação da Senha
                  </label>
                  <input
                    id="user-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (formError) setFormError('');
                    }}
                    className={`w-full text-xs bg-white border rounded-lg px-3 py-2 text-slate-900 font-mono tracking-wider focus:outline-none focus:ring-2 ${
                      confirmPassword.length > 0 && !passwordsMatch
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-slate-300 focus:ring-blue-600'
                    }`}
                  />
                  {confirmPassword.length > 0 && !passwordsMatch && (
                    <p className="text-[11px] text-red-600 mt-1 font-medium">
                      As senhas não coincidem.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed">
                ℹ️ <strong>Modo de Edição Ativo</strong>: As credenciais de acesso corporativo continuam ativas via SSO Google Workspace. Você está atualizando o cadastro oficial de permissões e departamento.
              </div>
            )}

            <div className="flex gap-2">
              {formMode === 'edit' && (
                <button
                  type="button"
                  onClick={resetFormToCreate}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={formMode === 'create' ? (!isPasswordValid || !passwordsMatch || !isGoogleVerified) : false}
                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {formMode === 'edit' ? (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Salvar Alterações do Usuário</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Criar Conta de Usuário no Global Desk</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Right 7 Cols: Registered Users List */}
        <section
          aria-label="Usuários Cadastrados no Sistema"
          className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Usuários Ativos &amp; Permissões da Equipe
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Relação dos técnicos (Elias, Alexandre, Mauricio) e novos usuários com autenticação corporativa.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <label htmlFor="search-user-input" className="block text-[11px] font-semibold text-slate-700 mb-1">
                Filtrar Usuários por Nome ou E-mail
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="search-user-input"
                  type="text"
                  value={searchUser}
                  onChange={(e) => setSearchUser(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-600 font-medium"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-3">Profissional</th>
                  <th className="py-2.5 px-3">Perfil &amp; Nível</th>
                  <th className="py-2.5 px-3">Setor</th>
                  <th className="py-2.5 px-3">Autenticação Google</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-full font-bold flex items-center justify-center text-xs shrink-0 ${
                            u.isSuperAdmin
                              ? 'bg-amber-100 text-amber-800 border border-amber-300'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {u.avatarInitials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <strong className="text-slate-900 block truncate">
                              {u.fullName}
                            </strong>
                            {u.isSuperAdmin && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500 text-white">
                                SUPER ADMIN
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono block truncate">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800 block">
                        {u.role}
                      </span>
                      {u.tier && (
                        <span className="text-[11px] text-blue-600 font-mono font-medium">
                          Nível {u.tier}
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-slate-700 font-medium">
                      {u.department}
                    </td>

                    <td className="py-3 px-3">
                      {u.isGoogleVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                          <Check className="w-3 h-3 text-emerald-600 shrink-0" />
                          <span>Google Autenticado</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Pendente</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${
                          u.status === 'Ativo'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!u.isSuperAdmin && onUpdateUser && (
                          <button
                            type="button"
                            onClick={() => loadUserToForm(u)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded transition-colors cursor-pointer"
                            title="Carregar dados no formulário de edição"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                        )}

                        {u.isSuperAdmin ? (
                          <span className="text-[11px] text-slate-400 font-mono italic">Protegido</span>
                        ) : (
                          <>
                            {onToggleUserStatus && (
                              <button
                                type="button"
                                onClick={() => onToggleUserStatus(u.id)}
                                className={`px-2 py-1 text-[11px] font-semibold rounded border transition-colors cursor-pointer ${
                                  u.status === 'Ativo'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
                                    : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                                }`}
                              >
                                {u.status === 'Ativo' ? 'Desativar' : 'Reativar'}
                              </button>
                            )}

                            {onDeleteUser && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Tem certeza que deseja apagar permanentemente o usuário ${u.fullName} (${u.email})?`)) {
                                    onDeleteUser(u.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded transition-colors cursor-pointer"
                                title="Apagar Usuário"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
