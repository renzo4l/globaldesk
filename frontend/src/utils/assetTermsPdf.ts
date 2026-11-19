import type { jsPDF as JsPDFInstance } from 'jspdf';
import {
  AssetMovementRecord,
  ITAsset,
} from '../types/itsm';
import { LOGO_GRUPO_GLOBAL_BRANCO } from '../assets/logos';
import {
  ASSET_CATEGORY_LABELS as CATEGORY_LABELS,
  ASSET_CONDITION_LABELS as CONDITION_LABELS,
  formatCurrencyBR,
  formatDateBR,
  formatDateTimeBR,
} from './formatters';

export interface CustomTermSigners {
  leftSignerName: string;
  leftSignerRole: string;
  rightSignerName: string;
  rightSignerRole: string;
}

/**
 * Retorna os nomes e cargos padrão dos signatários de um Termo Patrimonial,
 * permitindo que o usuário os edite antes da exportação em PDF.
 */
export function getDefaultTermSigners(
  asset: ITAsset,
  movement: AssetMovementRecord
): CustomTermSigners {
  const isAcquisition = movement.type === 'AQUISICAO';
  const isDisposal = movement.type === 'EXCLUSAO_BAIXA';
  const isReturn = movement.type === 'DEVOLUCAO';

  const leftSignerName = movement.performedByName || 'Analista de TI';
  const leftSignerRole = isDisposal
    ? 'Técnico Responsável pelo Laudo · TI'
    : 'Analista Responsável · Engenharia & TI';

  const rightSignerName = isAcquisition
    ? 'Coordenação de TI'
    : isDisposal
      ? 'Coordenação de TI / Diretoria'
      : isReturn
        ? movement.fromUserName || 'Colaborador Devolvedor'
        : movement.toUserName || asset.assignedTo?.name || 'Colaborador Recebedor';

  const rightSignerRole = isAcquisition
    ? 'Conferência e Homologação Patrimonial'
    : isDisposal
      ? 'Aprovação de Baixa Patrimonial'
      : `Setor: ${movement.toDepartment || asset.department}`;

  return {
    leftSignerName,
    leftSignerRole,
    rightSignerName,
    rightSignerRole,
  };
}

interface GridCellSpec {
  label: string;
  value: string;
  width: number; // Soma na linha deve ser 180mm
  valueColor?: [number, number, number];
}

/**
 * Desenha uma linha de células estruturadas com quebra automática de texto dentro de cada coluna,
 * impedindo qualquer sobreposição horizontal ou vertical entre campos.
 */
function drawGridRow(
  doc: JsPDFInstance,
  leftMargin: number,
  startY: number,
  cells: GridCellSpec[]
): number {
  const prepared = cells.map((cell) => {
    const safeText = String(cell.value || '—').trim() || '—';
    const maxTextWidth = Math.max(12, cell.width - 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const lines: string[] = doc.splitTextToSize(safeText, maxTextWidth);
    return { ...cell, lines };
  });

  const maxLines = Math.max(1, ...prepared.map((c) => c.lines.length));
  const rowHeight = Math.max(12.5, 6.5 + maxLines * 4.2);

  let currentX = leftMargin;
  for (const cell of prepared) {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.rect(currentX, startY, cell.width, rowHeight, 'FD');

    // Label superior da célula
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text(cell.label.toUpperCase(), currentX + 3, startY + 4.2);

    // Valor com quebra contida na largura da célula
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.3);
    if (cell.valueColor) {
      doc.setTextColor(
        cell.valueColor[0],
        cell.valueColor[1],
        cell.valueColor[2]
      );
    } else {
      doc.setTextColor(15, 23, 42);
    }
    doc.text(cell.lines, currentX + 3, startY + 8.8);

    currentX += cell.width;
  }

  return startY + rowHeight;
}

function drawSectionBanner(
  doc: JsPDFInstance,
  leftMargin: number,
  contentWidth: number,
  y: number,
  title: string
): number {
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.setTextColor(29, 78, 216); // Blue-700

  doc.roundedRect(leftMargin, y, contentWidth, 6.5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.text(title, leftMargin + 3, y + 4.5);

  return y + 8;
}

/**
 * Gera e dispara o download do Termo Oficial em PDF (A4) sem sobreposição de textos
 * e com suporte a nomes de assinatura personalizados.
 * Importa jsPDF dinamicamente sob demanda para otimizar o bundle inicial.
 */
export async function downloadAssetTermPdf(
  asset: ITAsset,
  movement: AssetMovementRecord,
  customSigners?: Partial<CustomTermSigners>
): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 15;
  const contentWidth = 180;
  let currentY = 12;

  const isAcquisition = movement.type === 'AQUISICAO';
  const isDisposal = movement.type === 'EXCLUSAO_BAIXA';
  const isReturn = movement.type === 'DEVOLUCAO';
  const isMaintenance = movement.type === 'MANUTENCAO';

  const defaultSigners = getDefaultTermSigners(asset, movement);
  const signers: CustomTermSigners = {
    leftSignerName:
      customSigners?.leftSignerName?.trim() || defaultSigners.leftSignerName,
    leftSignerRole:
      customSigners?.leftSignerRole?.trim() || defaultSigners.leftSignerRole,
    rightSignerName:
      customSigners?.rightSignerName?.trim() || defaultSigners.rightSignerName,
    rightSignerRole:
      customSigners?.rightSignerRole?.trim() || defaultSigners.rightSignerRole,
  };

  // =========================================================================
  // CABEÇALHO CORPORATIVO AZUL COM COLUNAS DELIMITADAS (SEM SOBREPOSIÇÃO)
  // =========================================================================
  doc.setFillColor(30, 64, 175); // Blue-700 Corporativo Padrão
  doc.roundedRect(leftMargin, currentY, contentWidth, 26, 2, 2, 'F');

  // Coluna 1 do Header: Logotipo (18mm -> 52mm)
  try {
    doc.addImage(
      LOGO_GRUPO_GLOBAL_BRANCO,
      'PNG',
      leftMargin + 3.5,
      currentY + 4,
      34,
      18
    );
  } catch {
    // Fallback caso imagem falhe
  }

  // Coluna 2 do Header: Títulos Centrais (55mm -> 141mm | largura máxima 86mm)
  const centerStartX = leftMargin + 41;
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('GRUPO GLOBAL · PATRIMÔNIO DE TI', centerStartX, currentY + 8.5);

  doc.setFontSize(8);
  const docSubtitle = isAcquisition
    ? 'TERMO DE AQUISIÇÃO E INCORPORAÇÃO'
    : isDisposal
      ? 'LAUDO E TERMO DE BAIXA PATRIMONIAL'
      : isReturn
        ? 'TERMO DE DEVOLUÇÃO DE ATIVO DE TI'
        : isMaintenance
          ? 'ORDEM DE REMESSA PARA MANUTENÇÃO'
          : 'TERMO DE RESPONSABILIDADE E GUARDA';

  doc.text(docSubtitle, centerStartX, currentY + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.text(
    'CMDB · Governança e Rastreabilidade Auditável ITIL v4',
    centerStartX,
    currentY + 20.5
  );

  // Linha divisória vertical sutil no cabeçalho (x = 144mm)
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(144, currentY + 4, 144, currentY + 22);

  // Coluna 3 do Header: Metadados do Termo à Direita (146mm -> 191mm)
  const rightEdgeX = pageWidth - leftMargin - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.text(movement.termNumber, rightEdgeX, currentY + 8.5, {
    align: 'right',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Patrimônio: ${asset.assetTag}`, rightEdgeX, currentY + 14.5, {
    align: 'right',
  });
  doc.setFontSize(7);
  doc.text(
    `Emissão: ${formatDateTimeBR(movement.createdAt)}`,
    rightEdgeX,
    currentY + 20.5,
    { align: 'right' }
  );

  currentY += 30;

  // =========================================================================
  // FAIXA DE RESUMO RÁPIDO (4 CÉLULAS PROPORCIONAIS = 180mm)
  // =========================================================================
  currentY = drawGridRow(doc, leftMargin, currentY, [
    { label: 'Código Patrimonial', value: asset.assetTag, width: 42 },
    { label: 'Número de Série (S/N)', value: asset.serialNumber, width: 48 },
    {
      label: 'Categoria do Ativo',
      value: CATEGORY_LABELS[asset.category] || asset.category,
      width: 48,
    },
    {
      label: 'Estado Físico',
      value:
        CONDITION_LABELS[movement.conditionAtMoment] ||
        movement.conditionAtMoment,
      width: 42,
      valueColor: [30, 64, 175],
    },
  ]);

  currentY += 5;

  // =========================================================================
  // SEÇÃO 1: IDENTIFICAÇÃO TÉCNICA DO ATIVO DE TI
  // =========================================================================
  currentY = drawSectionBanner(
    doc,
    leftMargin,
    contentWidth,
    currentY,
    '1. IDENTIFICAÇÃO TÉCNICA E CONFIGURAÇÃO DO EQUIPAMENTO'
  );

  currentY = drawGridRow(doc, leftMargin, currentY, [
    { label: 'Descrição / Equipamento', value: asset.name, width: 105 },
    {
      label: 'Fabricante / Modelo',
      value: `${asset.brand} · ${asset.model}`,
      width: 75,
    },
  ]);

  currentY = drawGridRow(doc, leftMargin, currentY, [
    {
      label: 'Especificações de Hardware / Software',
      value:
        asset.specifications ||
        'Configuração corporativa padrão homologada pela Engenharia & TI',
      width: 115,
    },
    {
      label: 'Localização Física Registrada',
      value: asset.location || 'Matriz Corporativa',
      width: 65,
    },
  ]);

  if (movement.accessoriesIncluded) {
    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Acessórios e Periféricos Inclusos na Operação',
        value: movement.accessoriesIncluded,
        width: 180,
      },
    ]);
  }

  currentY += 5;

  // =========================================================================
  // SEÇÃO 2: DADOS ESPECÍFICOS CONFORME O TIPO DE OPERAÇÃO
  // =========================================================================
  if (isAcquisition) {
    currentY = drawSectionBanner(
      doc,
      leftMargin,
      contentWidth,
      currentY,
      '2. DADOS FISCAIS DE AQUISIÇÃO E INCORPORAÇÃO PATRIMONIAL'
    );

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Fornecedor / Razão Social',
        value: asset.supplier || 'Fornecedor Homologado',
        width: 110,
      },
      {
        label: 'Nota Fiscal (NF-e)',
        value: asset.invoiceNumber || 'Não informada',
        width: 70,
      },
    ]);

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Data de Compra',
        value: formatDateBR(asset.purchaseDate),
        width: 45,
      },
      {
        label: 'Valor Contábil de Aquisição',
        value: formatCurrencyBR(asset.purchaseValue),
        width: 45,
        valueColor: [30, 64, 175],
      },
      {
        label: 'Garantia até',
        value: formatDateBR(asset.warrantyUntil),
        width: 45,
      },
      {
        label: 'Setor de Alocação',
        value: movement.toDepartment || asset.department,
        width: 45,
      },
    ]);
  } else if (isDisposal) {
    currentY = drawSectionBanner(
      doc,
      leftMargin,
      contentWidth,
      currentY,
      '2. DADOS DA BAIXA E DESINCORPORAÇÃO PATRIMONIAL DEFINITIVA'
    );

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Destinação Final do Equipamento Baixado',
        value: movement.disposalMethod || 'Descarte ecológico certificado',
        width: 115,
        valueColor: [30, 64, 175],
      },
      {
        label: 'Setor de Origem',
        value: movement.fromDepartment || asset.department,
        width: 65,
      },
    ]);

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Valor Contábil Original',
        value: formatCurrencyBR(asset.purchaseValue),
        width: 60,
      },
      {
        label: 'Nota Fiscal de Origem',
        value: asset.invoiceNumber || 'Não informada',
        width: 60,
      },
      {
        label: 'Responsável pelo Laudo Técnico',
        value: signers.leftSignerName,
        width: 60,
      },
    ]);
  } else {
    currentY = drawSectionBanner(
      doc,
      leftMargin,
      contentWidth,
      currentY,
      '2. REGISTRO DE CUSTÓDIA E PARTES ENVOLVIDAS NA MOVIMENTAÇÃO'
    );

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Custódia de Origem (Entregador)',
        value: `${movement.fromUserName || 'Estoque Central de TI'} (${movement.fromDepartment || 'Engenharia & TI'})`,
        width: 90,
      },
      {
        label: 'Nova Custódia (Recebedor / Destino)',
        value: `${movement.toUserName || 'Estoque Central de TI'} (${movement.toDepartment || asset.department})`,
        width: 90,
        valueColor: [30, 64, 175],
      },
    ]);

    currentY = drawGridRow(doc, leftMargin, currentY, [
      {
        label: 'Analista de TI Executor',
        value: signers.leftSignerName,
        width: 90,
      },
      {
        label: 'Departamento de Destino',
        value: movement.toDepartment || asset.department,
        width: 90,
      },
    ]);
  }

  currentY += 5;

  // =========================================================================
  // SEÇÃO 3: PARECER / JUSTIFICATIVA TÉCNICA / LAUDO DO TERMO
  // =========================================================================
  currentY = drawSectionBanner(
    doc,
    leftMargin,
    contentWidth,
    currentY,
    isDisposal
      ? '3. LAUDO TÉCNICO CONDENATÓRIO E MOTIVO DA BAIXA PATRIMONIAL'
      : '3. JUSTIFICATIVA OPERACIONAL E PARECER TÉCNICO DO TERMO'
  );

  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(255, 255, 255);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.3);
  const reasonLines: string[] = doc.splitTextToSize(
    movement.reason || 'Movimentação registrada pelo setor de TI.',
    contentWidth - 8
  );
  const boxHeight = Math.max(15, reasonLines.length * 4.3 + 6);
  doc.roundedRect(leftMargin, currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.text(reasonLines, leftMargin + 4, currentY + 5);

  currentY += boxHeight + 5;

  // =========================================================================
  // SEÇÃO 4: CLÁUSULA DE RESPONSABILIDADE E COMPROMISSO CORPORATIVO
  // =========================================================================
  let legalTitle = '4. DECLARAÇÃO DE CONFERÊNCIA E INCORPORAÇÃO PATRIMONIAL';
  let legalParagraph =
    'Pelo presente instrumento, atesta-se que o ativo de tecnologia acima especificado foi devidamente conferido, testado e etiquetado pela equipe de Engenharia & TI do Grupo Global, passando a integrar o acervo patrimonial da organização sob o código de tombamento indicado neste documento.';

  if (isDisposal) {
    legalTitle = '4. DECLARAÇÃO DE INVIABILIDADE TÉCNICA E BAIXA CONTÁBIL';
    legalParagraph =
      'Atestamos para os devidos fins de auditoria interna e controle patrimonial que o ativo identificado neste laudo encontra-se tecnicamente inoperante, obsoleto ou economicamente inviável para reparo. Autoriza-se a desincorporação definitiva do parque tecnológico e a destinação ambientalmente adequada conforme política corporativa.';
  } else if (isReturn) {
    legalTitle = '4. QUITAÇÃO DE DEVOLUÇÃO E RETORNO AO ESTOQUE DE TI';
    legalParagraph =
      'Declaramos que o equipamento e os acessórios listados neste termo foram devolvidos pelo colaborador/setor à custódia da equipe de Engenharia & TI nas condições físicas descritas acima, encerrando a responsabilidade individual anterior a partir desta data.';
  } else if (!isAcquisition) {
    legalTitle =
      '4. CLÁUSULA DE RESPONSABILIDADE PELA GUARDA E CONSERVAÇÃO DO ATIVO';
    legalParagraph =
      'Pelo presente Termo de Responsabilidade, o(a) colaborador(a) / responsável declara receber o equipamento corporativo acima especificado em perfeito estado de funcionamento, comprometendo-se a: (I) utilizá-lo estritamente para fins profissionais no Grupo Global; (II) zelar pela guarda, conservação e segurança física do bem; (III) comunicar imediatamente ao Service Desk qualquer anomalia, extravio ou sinistro; e (IV) restituí-lo imediatamente em caso de desligamento, mudança de função ou solicitação da Engenharia & TI.';
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const legalLines: string[] = doc.splitTextToSize(
    legalParagraph,
    contentWidth - 8
  );
  const legalBoxHeight = legalLines.length * 4.1 + 11;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(
    leftMargin,
    currentY,
    contentWidth,
    legalBoxHeight,
    1.5,
    1.5,
    'FD'
  );
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(30, 64, 175);
  doc.text(legalTitle, leftMargin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  doc.text(legalLines, leftMargin + 4, currentY + 9.8);

  currentY += legalBoxHeight + 18;

  // =========================================================================
  // SEÇÃO 5: ASSINATURAS PERSONALIZÁVEIS E VALIDAÇÃO FORMAL
  // =========================================================================
  const sigLineY = Math.min(264, Math.max(currentY + 6, 246));

  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.35);

  // Bloco de Assinatura 1 (Esquerda: 20mm -> 98mm | Centro = 59mm | Largura máx = 76mm)
  doc.line(leftMargin + 5, sigLineY, leftMargin + 83, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const leftNameLines: string[] = doc.splitTextToSize(signers.leftSignerName, 76);
  doc.text(leftNameLines[0] || signers.leftSignerName, leftMargin + 44, sigLineY + 5, {
    align: 'center',
  });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(100, 116, 139);
  const leftRoleLines: string[] = doc.splitTextToSize(signers.leftSignerRole, 76);
  doc.text(leftRoleLines[0] || signers.leftSignerRole, leftMargin + 44, sigLineY + 9.2, {
    align: 'center',
  });

  // Bloco de Assinatura 2 (Direita: 112mm -> 190mm | Centro = 151mm | Largura máx = 76mm)
  doc.line(leftMargin + 97, sigLineY, leftMargin + 175, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  const rightNameLines: string[] = doc.splitTextToSize(signers.rightSignerName, 76);
  doc.text(
    rightNameLines[0] || signers.rightSignerName,
    leftMargin + 136,
    sigLineY + 5,
    {
      align: 'center',
    }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.setTextColor(100, 116, 139);
  const rightRoleLines: string[] = doc.splitTextToSize(signers.rightSignerRole, 76);
  doc.text(
    rightRoleLines[0] || signers.rightSignerRole,
    leftMargin + 136,
    sigLineY + 9.2,
    {
      align: 'center',
    }
  );

  // Rodapé Oficial
  doc.setDrawColor(226, 232, 240);
  doc.line(leftMargin, 281, pageWidth - leftMargin, 281);
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Documento oficial gerado pelo módulo CMDB Global Desk · Termo ${movement.termNumber} · Patrimônio ${asset.assetTag}`,
    leftMargin,
    286
  );
  doc.text('Página 1 de 1', pageWidth - leftMargin, 286, { align: 'right' });

  const cleanTag = asset.assetTag.replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanTerm = movement.termNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  doc.save(`${cleanTerm}_${cleanTag}.pdf`);
}
