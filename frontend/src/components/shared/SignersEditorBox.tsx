import React from 'react';
import { PenTool } from 'lucide-react';
import { CustomTermSigners } from '../../utils/assetTermsPdf';

export interface SignersEditorBoxProps {
  signers: CustomTermSigners;
  onChange: (updated: CustomTermSigners) => void;
  leftTitle?: string;
  rightTitle?: string;
}

export const SignersEditorBox: React.FC<SignersEditorBoxProps> = ({
  signers,
  onChange,
  leftTitle = '1ª Assinatura (Esquerda · Técnico / TI)',
  rightTitle = '2ª Assinatura (Direita · Recebedor / Aprovador)',
}) => {
  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
          <PenTool className="w-3.5 h-3.5 text-blue-600" />
          Nomes para Assinatura no Documento PDF (Editável)
        </span>
        <span className="text-[11px] text-slate-400">
          Altere os nomes ou cargos antes de gerar o PDF
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Assinatura Esquerda */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 block">
            {leftTitle}
          </span>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Nome Completo na Linha de Assinatura *
            </label>
            <input
              type="text"
              required
              value={signers.leftSignerName}
              onChange={(e) =>
                onChange({ ...signers, leftSignerName: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Cargo / Qualificação Abaixo da Linha
            </label>
            <input
              type="text"
              value={signers.leftSignerRole}
              onChange={(e) =>
                onChange({ ...signers, leftSignerRole: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
            />
          </div>
        </div>

        {/* Assinatura Direita */}
        <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
          <span className="text-[11px] font-bold text-slate-500 block">
            {rightTitle}
          </span>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Nome Completo na Linha de Assinatura *
            </label>
            <input
              type="text"
              required
              value={signers.rightSignerName}
              onChange={(e) =>
                onChange({ ...signers, rightSignerName: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-xs font-semibold text-slate-800 border border-slate-300 rounded-md focus:border-blue-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
              Cargo / Setor Abaixo da Linha
            </label>
            <input
              type="text"
              value={signers.rightSignerRole}
              onChange={(e) =>
                onChange({ ...signers, rightSignerRole: e.target.value })
              }
              className="w-full px-2.5 py-1.5 text-xs text-slate-600 border border-slate-200 rounded-md focus:border-blue-600 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
