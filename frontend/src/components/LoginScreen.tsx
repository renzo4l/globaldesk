import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, Lock, Mail, AlertCircle, Terminal, Users } from 'lucide-react';
import { api } from '../services/api';

interface LoginScreenProps {
  onLoginSuccess: (user: any) => void;
  initialTab?: 'collaborator' | 'technician';
}

declare global {
  interface Window {
    google?: any;
  }
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, initialTab = 'collaborator' }) => {
  const [activeTab, setActiveTab] = useState<'collaborator' | 'technician'>(initialTab);
  const activeTabRef = useRef<'collaborator' | 'technician'>(activeTab);
  activeTabRef.current = activeTab;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const WORKSPACE_DOMAIN = (import.meta.env.VITE_WORKSPACE_DOMAIN || 'corporativo.com.br').trim();

  const handleGoogleCallback = async (response: { credential: string }) => {
    const currentSelectedTab = activeTabRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.loginGoogle({
        idToken: response.credential,
        expectedRole: currentSelectedTab,
      });

      if (currentSelectedTab === 'technician' && data.user.role === 'COLABORADOR') {
        throw new Error(
          `A conta ${data.user.email} não possui permissão de Equipe Técnica. Entre pela aba Colaborador.`
        );
      }

      onLoginSuccess(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Acesso negado pela organização.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCallbackRef = useRef(handleGoogleCallback);
  handleGoogleCallbackRef.current = handleGoogleCallback;

  useEffect(() => {
    setError(null);
    const initializeGoogleButton = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
          callback: (res: { credential: string }) => handleGoogleCallbackRef.current(res),
          hosted_domain: WORKSPACE_DOMAIN,
        });

        const btnContainer = document.getElementById('google-workspace-btn');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            text: 'continue_with',
            width: 320,
            logo_alignment: 'left',
          });
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGoogleButton();
    } else {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (window.google?.accounts?.id) {
          clearInterval(timer);
          initializeGoogleButton();
        } else if (attempts >= 25) {
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [activeTab, WORKSPACE_DOMAIN]);

  const handleTechSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.loginTech({ email, password });
      onLoginSuccess(data.user);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha na autenticação técnica.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-blue-950 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-blue-200 animate-in zoom-in-95 duration-200">
        {/* Cabeçalho Corporativo */}
        <div className="bg-blue-700 px-8 py-6 text-center border-b border-blue-800">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white/15 border border-white/25 text-white mb-3 transition-transform hover:scale-105">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Global Desk ITSM</h1>
          <p className="text-xs text-blue-100 mt-1">Central Corporativa de Serviços &amp; Suporte TI</p>
        </div>

        {/* Seletor de Perfil */}
        <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setActiveTab('collaborator')}
            className={`flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === 'collaborator'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Users className="w-4 h-4" />
            Colaborador
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('technician')}
            className={`flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all border-b-2 cursor-pointer ${
              activeTab === 'technician'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Equipe Técnica
          </button>
        </div>

        {/* Corpo do Formulário */}
        <div className="p-8">
          {error && (
            <div className="mb-5 p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-red-700 text-xs animate-in slide-in-from-top-3 duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'collaborator' ? (
            <div key="tab-collab" className="text-center space-y-5 animate-in fade-in duration-150">
              <div>
                <h2 className="text-base font-semibold text-slate-800">Acesso via Google Workspace</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Utilize sua conta institucional (<strong className="text-slate-700">@{WORKSPACE_DOMAIN}</strong>) para abrir e acompanhar seus chamados.
                </p>
              </div>

              <div className="py-2 flex justify-center">
                <div id="google-workspace-btn" />
              </div>

              <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400">
                Autenticação protegida por SSO corporativo. Contas pessoais (@gmail.com) são bloqueadas automaticamente.
              </div>
            </div>
          ) : (
            <form key="tab-tech" onSubmit={handleTechSubmit} className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">E-mail Técnico</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={`analista@${WORKSPACE_DOMAIN}`}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Senha de Operação</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all active-press disabled:opacity-50 cursor-pointer"
              >
                {loading ? 'Validando credenciais...' : 'Entrar no Console Técnico'}
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-slate-400">ou via SSO</span>
                </div>
              </div>

              <div className="flex justify-center">
                <div id="google-workspace-btn" />
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
