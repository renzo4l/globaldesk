import React, { useCallback, useMemo, useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Check, X, Search, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { useDebounce } from '../utils/useDebounce';

export interface KbArticle {
  id: string;
  title: string;
  category: string;
  summary: string;
  content: string;
  tags?: string;
  authorName: string;
  isPublished: boolean;
  updatedAt?: string;
}

interface KnowledgeBaseManagerProps {
  articles: KbArticle[];
  currentTechName: string;
  onRefresh: () => void;
}

interface KbArticleCardProps {
  art: KbArticle;
  onEdit: (article: KbArticle) => void;
  onDelete: (id: string) => void;
}

const KbArticleCard: React.FC<KbArticleCardProps> = React.memo(
  ({ art, onEdit, onDelete }) => {
    return (
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm hover-lift transition-all duration-150 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded-md">
              {art.category}
            </span>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                art.isPublished
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {art.isPublished ? (
                <Eye className="w-3 h-3" />
              ) : (
                <EyeOff className="w-3 h-3" />
              )}
              {art.isPublished ? 'Publicado' : 'Rascunho'}
            </span>
          </div>
          <h4 className="text-sm font-bold text-slate-800">{art.title}</h4>
          <p className="text-xs text-slate-500 mt-1 line-clamp-2">
            {art.summary}
          </p>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-[11px] text-slate-400">
          <span>Autor: {art.authorName}</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(art)}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg active:scale-[0.98] transition-all duration-150 cursor-pointer"
              title="Editar Artigo"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(art.id)}
              className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg active:scale-[0.98] transition-all duration-150 cursor-pointer"
              title="Excluir Artigo"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }
);
KbArticleCard.displayName = 'KbArticleCard';

export const KnowledgeBaseManager: React.FC<KnowledgeBaseManagerProps> = ({
  articles,
  currentTechName,
  onRefresh,
}) => {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 220);
  const [editingArticle, setEditingArticle] = useState<Partial<KbArticle> | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(query) ||
        a.category.toLowerCase().includes(query) ||
        a.summary.toLowerCase().includes(query)
    );
  }, [articles, debouncedSearch]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArticle?.title || !editingArticle?.content) return;

    setSaving(true);
    try {
      if (editingArticle.id) {
        await api.updateKbArticle(editingArticle.id, editingArticle);
      } else {
        await api.createKbArticle({
          ...editingArticle,
          authorName: currentTechName,
        });
      }
      setEditingArticle(null);
      onRefresh();
    } catch (err) {
      console.error('Erro ao salvar artigo:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleEditArticle = useCallback((article: KbArticle) => {
    setEditingArticle(article);
  }, []);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Deseja realmente excluir este artigo da Base de Conhecimento?')) return;
      try {
        await api.deleteKbArticle(id);
        onRefresh();
      } catch (err) {
        console.error('Erro ao excluir:', err);
      }
    },
    [onRefresh]
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Base de Conhecimento &amp; Autoatendimento</h2>
            <p className="text-xs text-slate-500">
              Gerencie os guias exibidos aos colaboradores antes da abertura de chamados.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            setEditingArticle({
              title: '',
              category: 'Rede & VPN',
              summary: '',
              content: '',
              tags: '',
              isPublished: true,
            })
          }
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm active:scale-[0.98] transition-all duration-150 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Novo Artigo / Tutorial
        </button>
      </div>

      {/* Formulário de Criação / Edição */}
      {editingArticle && (
        <form
          onSubmit={handleSave}
          className="bg-white p-6 rounded-xl border-2 border-blue-500/30 shadow-md space-y-4 animate-in fade-in zoom-in-95 duration-200"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-800">
              {editingArticle.id ? 'Editar Artigo Existente' : 'Criar Novo Artigo'}
            </h3>
            <button
              type="button"
              onClick={() => setEditingArticle(null)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Título do Guia *</label>
              <input
                type="text"
                required
                value={editingArticle.title || ''}
                onChange={(e) => setEditingArticle({ ...editingArticle, title: e.target.value })}
                placeholder="Ex: Como reconectar o cliente VPN FortiClient"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Categoria *</label>
              <select
                value={editingArticle.category || 'Geral'}
                onChange={(e) => setEditingArticle({ ...editingArticle, category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 bg-white"
              >
                <option value="Rede & VPN">Rede &amp; VPN</option>
                <option value="Hardware & Impressoras">Hardware &amp; Impressoras</option>
                <option value="Sistemas & ERP">Sistemas &amp; ERP</option>
                <option value="E-mail & Workspace">E-mail &amp; Workspace</option>
                <option value="Acessos & Senhas">Acessos &amp; Senhas</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Resumo Curto (Card) *</label>
            <input
              type="text"
              required
              value={editingArticle.summary || ''}
              onChange={(e) => setEditingArticle({ ...editingArticle, summary: e.target.value })}
              placeholder="Breve descrição exibida na lista de ajuda rápida do colaborador"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Passo a Passo / Solução Detalhada *
            </label>
            <textarea
              required
              rows={5}
              value={editingArticle.content || ''}
              onChange={(e) => setEditingArticle({ ...editingArticle, content: e.target.value })}
              placeholder="Descreva os passos claros para o usuário resolver o problema..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-blue-500 font-sans"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={editingArticle.isPublished ?? true}
                onChange={(e) =>
                  setEditingArticle({ ...editingArticle, isPublished: e.target.checked })
                }
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Visível imediatamente no Portal do Colaborador
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditingArticle(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg active:scale-[0.98] transition-all duration-150 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {saving ? 'Gravando...' : 'Salvar Artigo'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Barra de Busca com Debounce */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filtrar artigos por título ou categoria..."
          className="w-full pl-10 pr-4 py-2.5 bg-white text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 transition-all duration-150"
        />
      </div>

      {/* Lista de Artigos Memoizada */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((art) => (
          <KbArticleCard
            key={art.id}
            art={art}
            onEdit={handleEditArticle}
            onDelete={handleDelete}
          />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-8 text-center text-slate-400 text-xs">
            Nenhum artigo encontrado. Clique em &quot;Novo Artigo / Tutorial&quot; para criar o primeiro guia.
          </div>
        )}
      </div>
    </div>
  );
};
