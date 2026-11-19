import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  FileCheck,
  FileDown,
  HardDrive,
  PackagePlus,
  PenTool,
  ShieldAlert,
  Trash2,
  Wrench,
  X,
} from 'lucide-react';
import {
  AssetCategory,
  AssetCondition,
  AssetMovementRecord,
  ITAsset,
  MovementType,
  SystemUser,
} from '../types/itsm';
import {
  CustomTermSigners,
  downloadAssetTermPdf,
  getDefaultTermSigners,
} from '../utils/assetTermsPdf';
import { CORPORATE_DEPARTMENTS as DEPARTMENTS } from '../utils/formatters';
import { SignersEditorBox } from './shared/SignersEditorBox';
import { useAnimatedOpen, useAnimatedPresence } from '../utils/useAnimatedPresence';

const ACCESSORY_PRESETS = [
  'Carregador original',
  'Mouse sem fio',
  'Mochila executiva',
  'Cabo de força NBR',
  'Cabo HDMI / DisplayPort',
  'Headset USB corporativo',
];

// ============================================================================
// 1. MODAL DE AQUISIÇÃO (NOVO ATIVO) OU EDIÇÃO CADASTRAL
// ============================================================================
interface AssetAcquisitionModalProps {
  isOpen: boolean;
  editingAsset?: ITAsset | null;
  users: SystemUser[];
  activeTechName: string;
  onClose: () => void;
  onSubmitAcquisition: (
    data: any,
    customSigners: CustomTermSigners
  ) => Promise<void>;
  onSubmitEdit?: (assetId: string, data: any) => Promise<void>;
}

export const AssetAcquisitionModal: React.FC<AssetAcquisitionModalProps> = ({
  isOpen,
  editingAsset,
  users,
  activeTechName,
  onClose,
  onSubmitAcquisition,
  onSubmitEdit,
}) => {
  const { shouldRender, isClosing } = useAnimatedOpen(isOpen, 180);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [category, setCategory] = useState<AssetCategory>('NOTEBOOK');
  const [condition, setCondition] = useState<AssetCondition>('NOVO');
  const [specifications, setSpecifications] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [supplier, setSupplier] = useState('');
  const [purchaseValue, setPurchaseValue] = useState('');
  const [warrantyUntil, setWarrantyUntil] = useState('');
  const [department, setDepartment] = useState('Engenharia & TI');
  const [location, setLocation] = useState('Almoxarifado TI - Matriz');
  const [assignedToId, setAssignedToId] = useState('');
  const [accessoriesIncluded, setAccessoriesIncluded] = useState(
    'Carregador original, Cabo de força'
  );
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [signers, setSigners] = useState<CustomTermSigners>({
    leftSignerName: activeTechName,
    leftSignerRole: 'Analista Conferente · Engenharia & TI',
    rightSignerName: 'Coordenação de TI',
    rightSignerRole: 'Homologação e Incorporação Patrimonial',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setBrand(editingAsset.brand);
      setModel(editingAsset.model);
      setSerialNumber(editingAsset.serialNumber);
      setCategory(editingAsset.category);
      setCondition(editingAsset.condition);
      setSpecifications(editingAsset.specifications || '');
      setPurchaseDate(
        editingAsset.purchaseDate
          ? new Date(editingAsset.purchaseDate).toISOString().slice(0, 10)
          : ''
      );
      setInvoiceNumber(editingAsset.invoiceNumber || '');
      setSupplier(editingAsset.supplier || '');
      setPurchaseValue(
        editingAsset.purchaseValue !== null &&
          editingAsset.purchaseValue !== undefined
          ? String(editingAsset.purchaseValue)
          : ''
      );
      setWarrantyUntil(
        editingAsset.warrantyUntil
          ? new Date(editingAsset.warrantyUntil).toISOString().slice(0, 10)
          : ''
      );
      setDepartment(editingAsset.department || 'Engenharia & TI');
      setLocation(editingAsset.location || 'Almoxarifado TI - Matriz');
      setAssignedToId(editingAsset.assignedToId || '');
      setNotes(editingAsset.notes || '');
      setError(null);
    } else {
      setName('');
      setBrand('');
      setModel('');
      setSerialNumber('');
      setCategory('NOTEBOOK');
      setCondition('NOVO');
      setSpecifications('');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
      setInvoiceNumber('');
      setSupplier('');
      setPurchaseValue('');
      setWarrantyUntil('');
      setDepartment('Engenharia & TI');
      setLocation('Almoxarifado TI - Matriz');
      setAssignedToId('');
      setAccessoriesIncluded('Carregador original, Cabo de força');
      setNotes('');
      setReason('');
      setSigners({
        leftSignerName: activeTechName,
        leftSignerRole: 'Analista Conferente · Engenharia & TI',
        rightSignerName: 'Coordenação de TI',
        rightSignerRole: 'Homologação e Incorporação Patrimonial',
      });
      setError(null);
    }
  }, [editingAsset, isOpen, activeTechName]);

  if (!shouldRender) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (editingAsset && onSubmitEdit) {
        await onSubmitEdit(editingAsset.id, {
          name,
          brand,
          model,
          serialNumber,
          category,
          condition,
          specifications,
          purchaseDate: purchaseDate || null,
          invoiceNumber,
          supplier,
          purchaseValue: purchaseValue ? Number(purchaseValue) : null,
          warrantyUntil: warrantyUntil || null,
          department,
          location,
          notes,
        });
      } else {
        await onSubmitAcquisition(
          {
            name,
            brand,
            model,
            serialNumber,
            category,
            condition,
            specifications,
            purchaseDate: purchaseDate || undefined,
            invoiceNumber,
            supplier,
            purchaseValue: purchaseValue ? Number(purchaseValue) : undefined,
            warrantyUntil: warrantyUntil || undefined,
            department,
            location,
            assignedToId: assignedToId || undefined,
            notes,
            accessoriesIncluded,
            reason:
              reason ||
              `Entrada e incorporação patrimonial conferida por ${signers.leftSignerName}.`,
            performedByName: signers.leftSignerName || activeTechName,
          },
          signers
        );
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar ativo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
    >
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8 ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-white border border-white/25">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {editingAsset
                  ? `Editar Ficha Patrimonial · ${editingAsset.assetTag}`
                  : 'Aquisição & Entrada de Novo Ativo de TI'}
              </h3>
              <p className="text-xs text-blue-100">
                {editingAsset
                  ? 'Atualize especificações técnicas, nota fiscal ou localização física do equipamento.'
                  : 'Gera automaticamente etiqueta PAT-2026-XXXX e emite o Termo Oficial de Incorporação em PDF.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-5 max-h-[82vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Bloco 1: Identificação Técnica */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-blue-600" />
              1. Identificação e Especificações Técnicas
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Descrição / Nome do Ativo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Notebook Dell Latitude 5440 i7 32GB"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Categoria *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                >
                  <option value="NOTEBOOK">Notebook Corporativo</option>
                  <option value="COMPUTADOR">Computador / Workstation</option>
                  <option value="MONITOR">Monitor de Vídeo</option>
                  <option value="PERIFERICO">Periférico / Acessório</option>
                  <option value="IMPRESSORA">Impressora / Multifuncional</option>
                  <option value="REDE_SERVIDOR">Rede / Switch / Servidor</option>
                  <option value="CELULAR_TABLET">Celular / Tablet Corporativo</option>
                  <option value="LICENCA_SOFTWARE">Licença de Software</option>
                  <option value="OUTROS">Outros Equipamentos</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fabricante / Marca *
                </label>
                <input
                  type="text"
                  required
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="Ex: Dell, Lenovo, Cisco, HP"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Modelo Comercial *
                </label>
                <input
                  type="text"
                  required
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="Ex: Latitude 5440"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Número de Série (Service Tag / S/N) *
                </label>
                <input
                  type="text"
                  required
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="Ex: BR-98412-X"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Especificações Detalhadas (CPU, RAM, Armazenamento, IP, MAC Address)
                </label>
                <input
                  type="text"
                  value={specifications}
                  onChange={(e) => setSpecifications(e.target.value)}
                  placeholder="Ex: Intel Core i7-1365U, 32GB DDR5, NVMe 1TB, MAC 00:1B:44:11:3A:B7"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Condição Física *
                </label>
                <select
                  value={condition}
                  onChange={(e) =>
                    setCondition(e.target.value as AssetCondition)
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                >
                  <option value="NOVO">Novo (Zero Uso)</option>
                  <option value="BOM">Bom Estado</option>
                  <option value="DESGASTADO">Desgastado</option>
                  <option value="DEFEITUOSO">Defeituoso</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bloco 2: Dados Fiscais e Aquisição */}
          <div className="pt-3 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-teal-600" />
              2. Dados Fiscais de Aquisição &amp; Garantia
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Fornecedor / Revenda
                </label>
                <input
                  type="text"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  placeholder="Ex: Dell Computadores do Brasil Ltda"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nota Fiscal (NF-e)
                </label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Ex: NF-e 000.491.200"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Valor de Aquisição (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchaseValue}
                  onChange={(e) => setPurchaseValue(e.target.value)}
                  placeholder="Ex: 7490.00"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Data da Compra
                </label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Vencimento da Garantia
                </label>
                <input
                  type="date"
                  value={warrantyUntil}
                  onChange={(e) => setWarrantyUntil(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departamento Inicial *
                </label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Localização Física
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Almoxarifado TI - Matriz"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Bloco 3: Termo de Entrada e Assinaturas (apenas na criação) */}
          {!editingAsset && (
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                3. Custódia Inicial &amp; Emissão do Termo de Incorporação
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Vincular Imediatamente a um Colaborador (Opcional)
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                  >
                    <option value="">
                      Manter Disponível no Estoque Central de TI
                    </option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.department})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Acessórios Conferidos na Entrada
                  </label>
                  <input
                    type="text"
                    value={accessoriesIncluded}
                    onChange={(e) => setAccessoriesIncluded(e.target.value)}
                    placeholder="Ex: Carregador original, cabo de força, manual"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Parecer de Conferência Técnica (Impresso no Termo de Aquisição PDF)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Equipamento recebido lacrado, submetido a testes de burn-in e imagem corporativa homologada."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
                />
              </div>

              <SignersEditorBox
                signers={signers}
                onChange={setSigners}
                leftTitle="1ª Assinatura (Técnico Conferente)"
                rightTitle="2ª Assinatura (Gestor / Homologador Patrimonial)"
              />
            </div>
          )}

          {/* Rodapé */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Processando...'
                  : editingAsset
                    ? 'Salvar Alterações Cadastrais'
                    : 'Registrar Aquisição & Emitir Termo PDF'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. MODAL DE MOVIMENTAÇÃO / ENTREGA / DEVOLUÇÃO / MANUTENÇÃO
// ============================================================================
interface AssetMoveModalProps {
  asset: ITAsset | null;
  users: SystemUser[];
  activeTechName: string;
  onClose: () => void;
  onConfirmMove: (
    assetId: string,
    payload: any,
    customSigners: CustomTermSigners
  ) => Promise<void>;
}

export const AssetMoveModal: React.FC<AssetMoveModalProps> = ({
  asset: assetProp,
  users,
  activeTechName,
  onClose,
  onConfirmMove,
}) => {
  const { renderedValue: asset, isClosing } = useAnimatedPresence(assetProp, 180);
  const [moveType, setMoveType] = useState<MovementType>('MOVIMENTACAO_ENTREGA');
  const [assignedToId, setAssignedToId] = useState('');
  const [toDepartment, setToDepartment] = useState('Engenharia & TI');
  const [location, setLocation] = useState('');
  const [conditionAtMoment, setConditionAtMoment] =
    useState<AssetCondition>('BOM');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([
    'Carregador original',
  ]);
  const [customAccessories, setCustomAccessories] = useState('');
  const [reason, setReason] = useState('');
  const [signers, setSigners] = useState<CustomTermSigners>({
    leftSignerName: activeTechName,
    leftSignerRole: 'Analista Responsável · Engenharia & TI',
    rightSignerName: 'Colaborador Recebedor',
    rightSignerRole: 'Setor: Engenharia & TI',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setConditionAtMoment(asset.condition);
      setToDepartment(asset.department || 'Engenharia & TI');
      setLocation(asset.location || 'Matriz Corporativa');
      const initialType: MovementType =
        asset.status === 'EM_USO' ? 'DEVOLUCAO' : 'MOVIMENTACAO_ENTREGA';
      setMoveType(initialType);
      setAssignedToId('');
      setReason('');
      setSigners({
        leftSignerName: activeTechName,
        leftSignerRole: 'Analista Responsável · Engenharia & TI',
        rightSignerName:
          initialType === 'DEVOLUCAO'
            ? asset.assignedTo?.name || 'Colaborador Devolvedor'
            : 'Colaborador Recebedor',
        rightSignerRole: `Setor: ${asset.department || 'Engenharia & TI'}`,
      });
      setError(null);
    }
  }, [asset, activeTechName]);

  if (!asset) return null;

  const toggleAccessory = (item: string) => {
    setSelectedAccessories((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleMoveTypeChange = (nextType: MovementType) => {
    setMoveType(nextType);
    if (nextType === 'DEVOLUCAO') {
      setSigners((prev) => ({
        ...prev,
        rightSignerName: asset.assignedTo?.name || 'Colaborador Devolvedor',
        rightSignerRole: `Devolução · Setor ${asset.department}`,
      }));
    } else if (nextType === 'MANUTENCAO') {
      setSigners((prev) => ({
        ...prev,
        rightSignerName: 'Responsável Laboratório / Assistência Técnica',
        rightSignerRole: 'Bancada de Manutenção / RMA',
      }));
    }
  };

  const handleUserChange = (userId: string) => {
    setAssignedToId(userId);
    const found = users.find((u) => u.id === userId);
    if (found) {
      setToDepartment(found.department);
      setLocation(`Estação de Trabalho · ${found.department}`);
      setSigners((prev) => ({
        ...prev,
        rightSignerName: found.fullName,
        rightSignerRole: `${found.role} · ${found.department}`,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (moveType === 'MOVIMENTACAO_ENTREGA' && !assignedToId) {
      setError('Selecione o colaborador que receberá a custódia do equipamento.');
      return;
    }

    const allAccessories = [
      ...selectedAccessories,
      ...(customAccessories.trim() ? [customAccessories.trim()] : []),
    ].join(', ');

    const targetUser = users.find((u) => u.id === assignedToId);

    setSubmitting(true);
    try {
      await onConfirmMove(
        asset.id,
        {
          type: moveType,
          assignedToId:
            moveType === 'MOVIMENTACAO_ENTREGA' ? assignedToId : null,
          toUserName:
            moveType === 'MOVIMENTACAO_ENTREGA'
              ? signers.rightSignerName || targetUser?.fullName
              : moveType === 'DEVOLUCAO'
                ? 'Estoque Central de TI'
                : 'Laboratório de Manutenção TI',
          toDepartment:
            moveType === 'DEVOLUCAO' || moveType === 'MANUTENCAO'
              ? 'Engenharia & TI'
              : toDepartment,
          location:
            moveType === 'DEVOLUCAO'
              ? 'Almoxarifado TI - Matriz'
              : moveType === 'MANUTENCAO'
                ? 'Bancada Técnica / RMA'
                : location,
          conditionAtMoment,
          accessoriesIncluded: allAccessories || 'Nenhum acessório adicional',
          reason,
          performedByName: signers.leftSignerName || activeTechName,
        },
        signers
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar movimentação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
    >
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8 ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-white">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Movimentação &amp; Termo de Custódia · {asset.assetTag}
              </h3>
              <p className="text-xs text-blue-100">
                {asset.name} ({asset.brand} {asset.model} · S/N:{' '}
                {asset.serialNumber})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Seletor de Tipo de Movimentação */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Tipo de Operação Patrimonial *
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleMoveTypeChange('MOVIMENTACAO_ENTREGA')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  moveType === 'MOVIMENTACAO_ENTREGA'
                    ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-2 ring-blue-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Entrega / Alocação</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Entregar ao colaborador ou transferir setor
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleMoveTypeChange('DEVOLUCAO')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  moveType === 'DEVOLUCAO'
                    ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold">Devolução ao Estoque</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Retorna ao Almoxarifado de TI como Disponível
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleMoveTypeChange('MANUTENCAO')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  moveType === 'MANUTENCAO'
                    ? 'border-amber-600 bg-amber-50/70 text-amber-900 ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="text-xs font-bold flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5" />
                  Envio p/ Manutenção
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Altera status para Em Manutenção / Reparo
                </div>
              </button>
            </div>
          </div>

          {moveType === 'MOVIMENTACAO_ENTREGA' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Colaborador Recebedor (Custódia Nominal) *
                </label>
                <select
                  required
                  value={assignedToId}
                  onChange={(e) => handleUserChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                >
                  <option value="">
                    Selecione um colaborador ou analista...
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} — {u.email} ({u.department})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Departamento de Destino *
                </label>
                <select
                  value={toDepartment}
                  onChange={(e) => setToDepartment(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                >
                  {DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Localização / Posto de Trabalho
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Matriz · 2º Andar · Mesa 14"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado Físico no Ato da Movimentação *
              </label>
              <select
                value={conditionAtMoment}
                onChange={(e) =>
                  setConditionAtMoment(e.target.value as AssetCondition)
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-blue-600 outline-none"
              >
                <option value="NOVO">Novo (Zero Uso)</option>
                <option value="BOM">Bom Estado (Operacional)</option>
                <option value="DESGASTADO">Desgastado (Marcas de Uso)</option>
                <option value="DEFEITUOSO">Defeituoso / Avariado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Outros Acessórios / Periféricos Inclusos
              </label>
              <input
                type="text"
                value={customAccessories}
                onChange={(e) => setCustomAccessories(e.target.value)}
                placeholder="Ex: Adaptador RJ45, Suporte ergonômico"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
              />
            </div>
          </div>

          {/* Checklist Rápido de Acessórios */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Checklist de Acessórios Entregues / Conferidos
            </label>
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_PRESETS.map((acc) => {
                const active = selectedAccessories.includes(acc);
                return (
                  <button
                    key={acc}
                    type="button"
                    onClick={() => toggleAccessory(acc)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 border-blue-400 text-blue-800 font-semibold'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {active ? '✓ ' : '+ '}
                    {acc}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Justificativa / Observações para o Termo de Responsabilidade *
            </label>
            <textarea
              required
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo da movimentação (ex: Entrega de kit onboarding para novo analista financeiro / Devolução por substituição de máquina)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-blue-600 outline-none"
            />
          </div>

          {/* Editor de Nomes das Assinaturas */}
          <SignersEditorBox
            signers={signers}
            onChange={setSigners}
            leftTitle="1ª Assinatura (Analista de TI Executor)"
            rightTitle={
              moveType === 'DEVOLUCAO'
                ? '2ª Assinatura (Colaborador Devolvedor)'
                : '2ª Assinatura (Colaborador Recebedor)'
            }
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Emitindo Termo...'
                  : 'Confirmar Movimentação & Gerar Termo PDF'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. MODAL DE EXCLUSÃO / BAIXA PATRIMONIAL (LAUDO CONDENATÓRIO)
// ============================================================================
interface AssetDisposeModalProps {
  asset: ITAsset | null;
  activeTechName: string;
  onClose: () => void;
  onConfirmDispose: (
    assetId: string,
    payload: any,
    customSigners: CustomTermSigners
  ) => Promise<void>;
}

export const AssetDisposeModal: React.FC<AssetDisposeModalProps> = ({
  asset: assetProp,
  activeTechName,
  onClose,
  onConfirmDispose,
}) => {
  const { renderedValue: asset, isClosing } = useAnimatedPresence(assetProp, 180);
  const [disposalMethod, setDisposalMethod] = useState(
    'Descarte ecológico certificado (Logística Reversa)'
  );
  const [conditionAtMoment, setConditionAtMoment] =
    useState<AssetCondition>('DEFEITUOSO');
  const [reason, setReason] = useState('');
  const [signers, setSigners] = useState<CustomTermSigners>({
    leftSignerName: activeTechName,
    leftSignerRole: 'Técnico Responsável pelo Laudo · TI',
    rightSignerName: 'Coordenação de TI',
    rightSignerRole: 'Aprovação de Baixa Patrimonial · Diretoria/TI',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (asset) {
      setReason('');
      setSigners({
        leftSignerName: activeTechName,
        leftSignerRole: 'Técnico Responsável pelo Laudo · TI',
        rightSignerName: 'Coordenação de TI',
        rightSignerRole: 'Aprovação de Baixa Patrimonial · Diretoria/TI',
      });
      setError(null);
    }
  }, [asset, activeTechName]);

  if (!asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (reason.trim().length < 15) {
      setError(
        'Por exigência de auditoria, detalhe o laudo técnico condenatório com pelo menos 15 caracteres.'
      );
      return;
    }

    setSubmitting(true);
    try {
      await onConfirmDispose(
        asset.id,
        {
          disposalMethod,
          conditionAtMoment,
          reason,
          performedByName: signers.leftSignerName || activeTechName,
        },
        signers
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao processar baixa patrimonial.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
    >
      <div
        className={`bg-white rounded-2xl border border-blue-200 shadow-2xl max-w-2xl w-full overflow-hidden my-8 ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-blue-100">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                Baixa &amp; Exclusão Patrimonial · {asset.assetTag}
              </h3>
              <p className="text-xs text-blue-100">
                {asset.name} · S/N: {asset.serialNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Atenção — Operação Auditável Irreversível:</strong> O ativo
              terá seu status alterado para{' '}
              <span className="font-bold">BAIXADO / DESCARTADO</span>, será
              desvinculado de qualquer colaborador e terá seu histórico
              preservado no banco para fins de conformidade contábil e ITIL.
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destinação Final do Equipamento *
              </label>
              <select
                value={disposalMethod}
                onChange={(e) => setDisposalMethod(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-red-600 outline-none"
              >
                <option value="Descarte ecológico certificado (Logística Reversa)">
                  Descarte ecológico certificado (Logística Reversa)
                </option>
                <option value="Sucata eletrônica irremediável (Retirada de peças)">
                  Sucata eletrônica irremediável (Retirada de peças)
                </option>
                <option value="Sinistro / Extravio com Boletim de Ocorrência">
                  Sinistro / Extravio com Boletim de Ocorrência
                </option>
                <option value="Obsolescência tecnológica / Doação institucional">
                  Obsolescência tecnológica / Doação institucional
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Estado Físico Final *
              </label>
              <select
                value={conditionAtMoment}
                onChange={(e) =>
                  setConditionAtMoment(e.target.value as AssetCondition)
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:border-red-600 outline-none"
              >
                <option value="DEFEITUOSO">Defeituoso / Irreparável</option>
                <option value="DESGASTADO">Desgastado / Obsoleto</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Laudo Técnico Condenatório (Justificativa da Baixa) *
            </label>
            <textarea
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva detalhadamente o diagnóstico técnico que inviabiliza o reparo ou continuidade de uso (ex: Queima de placa-mãe em curto no circuito VRM; custo de reparo orçado em 85% do valor de um equipamento novo)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-red-600 outline-none"
            />
          </div>

          <SignersEditorBox
            signers={signers}
            onChange={setSigners}
            leftTitle="1ª Assinatura (Autor do Laudo Técnico)"
            rightTitle="2ª Assinatura (Coordenação / Diretoria Aprovadora)"
          />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Emitindo Laudo...'
                  : 'Confirmar Baixa Patrimonial & Emitir Laudo PDF'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. MODAL DE CONFIGURAÇÃO DE ASSINATURAS ANTES DE EXPORTAR TERMO PDF
// ============================================================================
interface AssetSignersExportModalProps {
  target: { asset: ITAsset; movement: AssetMovementRecord } | null;
  onClose: () => void;
}

export const AssetSignersExportModal: React.FC<AssetSignersExportModalProps> = ({
  target: targetProp,
  onClose,
}) => {
  const { renderedValue: target, isClosing } = useAnimatedPresence(targetProp, 180);
  const [signers, setSigners] = useState<CustomTermSigners>({
    leftSignerName: '',
    leftSignerRole: '',
    rightSignerName: '',
    rightSignerRole: '',
  });

  useEffect(() => {
    if (targetProp) {
      setSigners(getDefaultTermSigners(targetProp.asset, targetProp.movement));
    }
  }, [targetProp]);

  if (!target) return null;

  const handleExport = (e: React.FormEvent) => {
    e.preventDefault();
    downloadAssetTermPdf(target.asset, target.movement, signers);
    onClose();
  };

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 ${
        isClosing ? 'animate-out fade-out' : 'animate-in fade-in'
      } duration-200`}
    >
      <div
        className={`bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden ${
          isClosing ? 'animate-out zoom-out-95' : 'animate-in zoom-in-95'
        } duration-200`}
      >
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/15 text-white border border-white/25">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                Personalizar Assinaturas do Termo · {target.movement.termNumber}
              </h3>
              <p className="text-xs text-blue-100">
                Patrimônio {target.asset.assetTag} · {target.asset.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-blue-200 hover:text-white rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleExport} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Confira ou edite abaixo os nomes e cargos que serão impressos nas
            linhas de assinatura do documento PDF oficial:
          </p>

          <SignersEditorBox signers={signers} onChange={setSigners} />

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>Exportar Termo em PDF</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
