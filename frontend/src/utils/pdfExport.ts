import type { jsPDF as JsPDFInstance } from 'jspdf';
import { AuditLogItem, ServiceOrder, Ticket, TicketNote } from '../types/itsm';
import { LOGO_GRUPO_GLOBAL_BRANCO } from '../assets/logos';

export interface CustomOsSigners {
  leftSignerName?: string;
  leftSignerRole?: string;
  rightSignerName?: string;
  rightSignerRole?: string;
}

/**
 * Generates a high-fidelity formatted PDF document for an individual Service Order (O.S.).
 * Dynamically imports jsPDF on demand to keep the initial application bundle light.
 */
export async function generateServiceOrderPdfDoc(
  order: ServiceOrder,
  customSigners?: CustomOsSigners
): Promise<JsPDFInstance> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const leftMargin = 15;
  const contentWidth = 180;
  let currentY = 14;

  // 1. Corporate Header Bar (Global Desk Blue) - 3 Delimited Columns
  doc.setFillColor(30, 64, 175); // Blue-700
  doc.roundedRect(leftMargin, currentY, contentWidth, 26, 2, 2, 'F');

  // Insert Official Grupo Global Logo
  try {
    doc.addImage(LOGO_GRUPO_GLOBAL_BRANCO, 'PNG', leftMargin + 3.5, currentY + 4, 34, 18);
  } catch {
    // Graceful fallback
  }

  const textStartX = leftMargin + 41;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRUPO GLOBAL · SERVICE DESK', textStartX, currentY + 8.5);

  doc.setFontSize(8.2);
  doc.text('RELATÓRIO OFICIAL DE ORDEM DE SERVIÇO (O.S.)', textStartX, currentY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.text('Central de Atendimento & Gestão de Incidentes de TI', textStartX, currentY + 20.5);

  // Subtle vertical divider in header
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(144, currentY + 4, 144, currentY + 22);

  // Header Right: OS Number badge
  const rightEdgeX = pageWidth - leftMargin - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(order.id, rightEdgeX, currentY + 8.5, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.text(`Emitido: ${order.finalizedAt}`, rightEdgeX, currentY + 14.5, { align: 'right' });
  doc.text(`Protocolo: ${order.ticketId}`, rightEdgeX, currentY + 20.5, { align: 'right' });

  currentY += 31;

  // 2. Metadata Quick Strip
  doc.setFillColor(248, 250, 252); // Slate-50
  doc.setDrawColor(226, 232, 240); // Slate-200
  doc.roundedRect(leftMargin, currentY, contentWidth, 14, 1.5, 1.5, 'FD');

  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);

  // Column 1: Categoria
  doc.text('CATEGORIA:', leftMargin + 4, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.category || 'TI').slice(0, 22), leftMargin + 4, currentY + 10);

  // Column 2: Tipo Intervenção
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('INTERVENÇÃO:', leftMargin + 46, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(String(order.interventionType || 'Remoto').slice(0, 26), leftMargin + 46, currentY + 10);

  // Column 3: SLA Status
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('CUMPRIMENTO DE SLA:', leftMargin + 102, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175); // Blue-700
  if (order.slaMet) {
    doc.text('DENTRO DA META', leftMargin + 102, currentY + 10);
  } else {
    doc.text('SLA EXCEDIDO', leftMargin + 102, currentY + 10);
  }

  // Column 4: Desfecho
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(100, 116, 139);
  doc.text('DESFECHO:', leftMargin + 146, currentY + 5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(30, 64, 175);
  const outcomeShort =
    order.finalizationOutcome === 'concluido_sucesso'
      ? 'CONCLUÍDO'
      : order.finalizationOutcome === 'solucao_contorno'
      ? 'WORKAROUND'
      : order.finalizationOutcome === 'nao_concluido'
      ? 'NÃO CONCLUÍDO'
      : 'ENCERRADO';
  doc.text(outcomeShort, leftMargin + 146, currentY + 10);

  currentY += 19;

  // 3. Section 1: Dados do Chamado e Solicitante (Bounded Grid Boxes)
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216); // Blue-700
  doc.text('1. DADOS DO CHAMADO DE ORIGEM & SOLICITANTE', leftMargin + 3, currentY + 4.3);
  currentY += 8;

  // Row 1: Solicitante (60mm) | Departamento (55mm) | E-mail (65mm)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, currentY, 60, 12, 'FD');
  doc.rect(leftMargin + 60, currentY, 55, 12, 'FD');
  doc.rect(leftMargin + 115, currentY, 65, 12, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('SOLICITANTE', leftMargin + 3, currentY + 4);
  doc.text('DEPARTAMENTO', leftMargin + 63, currentY + 4);
  doc.text('E-MAIL CORPORATIVO', leftMargin + 118, currentY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(doc.splitTextToSize(order.requesterName || '—', 54)[0] || '—', leftMargin + 3, currentY + 8.8);
  doc.text(doc.splitTextToSize(order.department || '—', 49)[0] || '—', leftMargin + 63, currentY + 8.8);
  doc.text(doc.splitTextToSize(order.requesterEmail || '—', 59)[0] || '—', leftMargin + 118, currentY + 8.8);
  currentY += 12;

  // Row 2: Assunto
  const subjectLines: string[] = doc.splitTextToSize(order.ticketTitle || '—', contentWidth - 6);
  const subjectBoxH = Math.max(11.5, 6 + subjectLines.length * 4);
  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, currentY, contentWidth, subjectBoxH, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('ASSUNTO DO CHAMADO', leftMargin + 3, currentY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(subjectLines, leftMargin + 3, currentY + 8.5);
  currentY += subjectBoxH + 2;

  if (order.ticketDescription) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const splitDesc: string[] = doc.splitTextToSize(order.ticketDescription, contentWidth - 6);
    const descBoxH = Math.max(12, 6 + splitDesc.length * 3.8);
    doc.setFillColor(255, 255, 255);
    doc.rect(leftMargin, currentY, contentWidth, descBoxH, 'FD');
    doc.setFontSize(6.8);
    doc.setTextColor(100, 116, 139);
    doc.text('DESCRIÇÃO INICIAL DO SOLICITANTE', leftMargin + 3, currentY + 4);
    doc.setFontSize(7.8);
    doc.setTextColor(51, 65, 85);
    doc.text(splitDesc, leftMargin + 3, currentY + 8.2);
    currentY += descBoxH + 4;
  } else {
    currentY += 3;
  }

  // 4. Section 2: Cronograma & Equipe Técnica
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text('2. CRONOGRAMA DE ATENDIMENTO & RESPONSÁVEL TÉCNICO', leftMargin + 3, currentY + 4.3);
  currentY += 8;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(leftMargin, currentY, 60, 12, 'FD');
  doc.rect(leftMargin + 60, currentY, 60, 12, 'FD');
  doc.rect(leftMargin + 120, currentY, 60, 12, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('INÍCIO DO ATENDIMENTO', leftMargin + 3, currentY + 4);
  doc.text('FINALIZAÇÃO', leftMargin + 63, currentY + 4);
  doc.text('DURAÇÃO TOTAL', leftMargin + 123, currentY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(order.startedAt || '—', leftMargin + 3, currentY + 8.8);
  doc.text(order.finalizedAt || '—', leftMargin + 63, currentY + 8.8);
  doc.text(order.durationText || '—', leftMargin + 123, currentY + 8.8);
  currentY += 12;

  doc.setFillColor(248, 250, 252);
  doc.rect(leftMargin, currentY, 100, 12, 'FD');
  doc.rect(leftMargin + 100, currentY, 80, 12, 'FD');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text('ANALISTA EXECUTOR', leftMargin + 3, currentY + 4);
  doc.text('MODALIDADE DE INTERVENÇÃO', leftMargin + 103, currentY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text(
    doc.splitTextToSize(`${order.technicianName} (Nível ${order.technicianTier})`, 94)[0],
    leftMargin + 3,
    currentY + 8.8
  );
  doc.text(
    doc.splitTextToSize(order.interventionType || 'Remoto', 74)[0],
    leftMargin + 103,
    currentY + 8.8
  );

  currentY += 16;

  // 5. Section 3: Desfecho & Parecer Técnico
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text('3. DESFECHO TÉCNICO & LAUDO PERICIAL DA INTERVENÇÃO', leftMargin + 3, currentY + 4.3);
  currentY += 8.5;

  doc.setFontSize(8.3);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Classificação do Desfecho:', leftMargin + 2, currentY);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text(order.outcomeLabel, leftMargin + 44, currentY);

  currentY += 5.5;

  // Warning box if non-completed
  if (order.nonCompletionReason) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const splitReason: string[] = doc.splitTextToSize(order.nonCompletionReason, contentWidth - 6);
    const warnH = Math.max(13, 7 + splitReason.length * 4);
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.setDrawColor(191, 219, 254); // Blue-200
    doc.roundedRect(leftMargin, currentY, contentWidth, warnH, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 64, 175);
    doc.text('JUSTIFICATIVA DE IMPEDIMENTO / NÃO CONCLUSÃO:', leftMargin + 3, currentY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 58, 138);
    doc.text(splitReason, leftMargin + 3, currentY + 9);

    currentY += warnH + 3;
  }

  // Laudo Técnico
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(15, 23, 42);
  doc.text('Laudo Técnico & Procedimentos Executados:', leftMargin + 2, currentY);
  currentY += 4;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const splitSolution: string[] = doc.splitTextToSize(order.solutionSummary, contentWidth - 8);
  const solutionBoxHeight = Math.max(14, splitSolution.length * 4.1 + 5);
  doc.roundedRect(leftMargin, currentY, contentWidth, solutionBoxHeight, 1.5, 1.5, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.text(splitSolution, leftMargin + 4, currentY + 4.8);

  currentY += solutionBoxHeight + 4;

  if (order.partsOrSupplies) {
    const partsLines: string[] = doc.splitTextToSize(order.partsOrSupplies, contentWidth - 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text('Insumos / Peças / Licenças:', leftMargin + 2, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(partsLines, leftMargin + 44, currentY);
    currentY += partsLines.length * 4 + 3;
  }

  // 6. Section 4: Aceite do Cliente & Homologação
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(29, 78, 216);
  doc.text('4. TERMO DE HOMOLOGAÇÃO & ACEITE DO CLIENTE', leftMargin + 3, currentY + 4.3);
  currentY += 8.5;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.8);
  doc.setTextColor(51, 65, 85);
  const acceptanceText = `"${order.clientAcceptance}"`;
  const splitAcceptance: string[] = doc.splitTextToSize(acceptanceText, contentWidth - 4);
  doc.text(splitAcceptance, leftMargin + 2, currentY);
  currentY += splitAcceptance.length * 4 + 8;

  // Signatures Lines (Customizable Signers)
  const colWidth = (contentWidth - 10) / 2;
  const sigLineY = Math.min(266, currentY + 8);

  const leftName = customSigners?.leftSignerName?.trim() || order.technicianName;
  const leftRole =
    customSigners?.leftSignerRole?.trim() ||
    `Analista Executor (${order.technicianTier}) · Service Desk`;
  const rightName = customSigners?.rightSignerName?.trim() || order.requesterName;
  const rightRole =
    customSigners?.rightSignerRole?.trim() ||
    `Solicitante · Depto. ${order.department}`;

  // Signature 1: Technician
  doc.setDrawColor(148, 163, 184); // Slate-400
  doc.line(leftMargin + 8, sigLineY, leftMargin + colWidth - 8, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    doc.splitTextToSize(leftName, colWidth - 16)[0] || leftName,
    leftMargin + colWidth / 2,
    sigLineY + 4.5,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(100, 116, 139);
  doc.text(
    doc.splitTextToSize(leftRole, colWidth - 16)[0] || leftRole,
    leftMargin + colWidth / 2,
    sigLineY + 8.5,
    { align: 'center' }
  );

  // Signature 2: Requester
  const sig2X = leftMargin + colWidth + 10;
  doc.line(sig2X + 8, sigLineY, sig2X + colWidth - 8, sigLineY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(
    doc.splitTextToSize(rightName, colWidth - 16)[0] || rightName,
    sig2X + colWidth / 2,
    sigLineY + 4.5,
    { align: 'center' }
  );
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.4);
  doc.setTextColor(100, 116, 139);
  doc.text(
    doc.splitTextToSize(rightRole, colWidth - 16)[0] || rightRole,
    sig2X + colWidth / 2,
    sigLineY + 8.5,
    { align: 'center' }
  );

  // 7. Footer / Digital Stamp
  const footerY = 286;
  doc.setDrawColor(226, 232, 240);
  doc.line(leftMargin, footerY - 4, pageWidth - leftMargin, footerY - 4);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.text('Global Desk ITSM · Documento gerado eletronicamente em conformidade com as políticas operacionais de TI.', leftMargin, footerY);
  doc.text(`Registro Oficial: ${order.id} · Página 1 de 1`, pageWidth - leftMargin, footerY, { align: 'right' });

  return doc;
}

/**
 * Downloads a formatted PDF for a given Service Order.
 */
export async function downloadServiceOrderPdf(
  order: ServiceOrder,
  customSigners?: CustomOsSigners
): Promise<void> {
  const doc = await generateServiceOrderPdfDoc(order, customSigners);
  const cleanId = order.id.replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`Ordem-Servico-${cleanId}-GlobalDesk.pdf`);
}

/**
 * Generates and downloads a consolidated summary report of multiple Service Orders.
 */
export async function downloadConsolidatedOrdersPdf(orders: ServiceOrder[]): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 297;
  const leftMargin = 15;
  const contentWidth = 267;
  let currentY = 15;

  // Header
  doc.setFillColor(30, 64, 175);
  doc.roundedRect(leftMargin, currentY, contentWidth, 22, 2, 2, 'F');

  try {
    doc.addImage(LOGO_GRUPO_GLOBAL_BRANCO, 'PNG', leftMargin + 4, currentY + 2.5, 38, 17);
  } catch {
    // fallback
  }

  const textStartX = leftMargin + 46;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('GRUPO GLOBAL · RELATÓRIO CONSOLIDADO DE ORDENS DE SERVIÇO', textStartX, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(`Total de registros emitidos: ${orders.length} | Exportado eletronicamente pelo Service Desk`, textStartX, currentY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  const dateStr = new Date().toLocaleDateString('pt-BR');
  doc.text(`Data de Emissão: ${dateStr}`, pageWidth - leftMargin - 6, currentY + 12, { align: 'right' });

  currentY += 28;

  // Table Header
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.rect(leftMargin, currentY, contentWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(29, 78, 216); // Blue-700

  doc.text('CÓDIGO O.S.', leftMargin + 3, currentY + 5.5);
  doc.text('CHAMADO', leftMargin + 32, currentY + 5.5);
  doc.text('SOLICITANTE & DEPTO', leftMargin + 65, currentY + 5.5);
  doc.text('ANALISTA', leftMargin + 125, currentY + 5.5);
  doc.text('INTERVENÇÃO', leftMargin + 160, currentY + 5.5);
  doc.text('DURAÇÃO', leftMargin + 205, currentY + 5.5);
  doc.text('DESFECHO', leftMargin + 225, currentY + 5.5);
  doc.text('SLA', leftMargin + 252, currentY + 5.5);

  currentY += 8;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);

  orders.forEach((ord, index) => {
    if (currentY > 190) {
      doc.addPage();
      currentY = 15;
    }

    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(leftMargin, currentY, contentWidth, 7, 'F');
    }

    doc.setTextColor(15, 23, 42);
    doc.text(ord.id, leftMargin + 3, currentY + 5);
    doc.text(ord.ticketId, leftMargin + 32, currentY + 5);
    doc.text(`${ord.requesterName} (${ord.department})`.slice(0, 32), leftMargin + 65, currentY + 5);
    doc.text(`${ord.technicianName} (${ord.technicianTier})`, leftMargin + 125, currentY + 5);
    doc.text(ord.interventionType.slice(0, 22), leftMargin + 160, currentY + 5);
    doc.text(ord.durationText, leftMargin + 205, currentY + 5);
    doc.text((ord.outcomeLabel || 'Concluído').slice(0, 16), leftMargin + 225, currentY + 5);

    doc.setTextColor(30, 64, 175);
    if (ord.slaMet) {
      doc.text('No Prazo', leftMargin + 252, currentY + 5);
    } else {
      doc.text('Excedido', leftMargin + 252, currentY + 5);
    }

    currentY += 7;
  });

  doc.save(`Relatorio-Consolidado-OS-GlobalDesk-${dateStr.replace(/\//g, '-')}.pdf`);
}

/**
 * Generates a comprehensive PDF audit report for a closed/resolved ticket,
 * including full ITIL metadata, original description, associated Service Order (O.S.),
 * all public & internal comments, and complete audit trail.
 */
export async function generateClosedTicketPdfDoc(
  ticket: Ticket,
  serviceOrder?: ServiceOrder
): Promise<JsPDFInstance> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 15;
  const contentWidth = 180;
  let currentY = 14;

  const checkAddPage = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = 15;
      // Secondary Running Header (Corporate Blue)
      doc.setFillColor(239, 246, 255); // Blue-50
      doc.rect(leftMargin, currentY, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 64, 175); // Blue-700
      doc.text(`GRUPO GLOBAL · AUDITORIA DE CHAMADO ${ticket.id}`, leftMargin + 3, currentY + 4.5);
      doc.text(`Status: ${ticket.status}`, pageWidth - leftMargin - 3, currentY + 4.5, { align: 'right' });
      currentY += 11;
    }
  };

  // 1. Corporate Header Bar (Global Desk Blue)
  doc.setFillColor(30, 64, 175); // Blue-700
  doc.roundedRect(leftMargin, currentY, contentWidth, 26, 2, 2, 'F');

  // Insert Official Grupo Global Logo
  try {
    doc.addImage(LOGO_GRUPO_GLOBAL_BRANCO, 'PNG', leftMargin + 3.5, currentY + 4, 34, 18);
  } catch {
    // Graceful fallback
  }

  const textStartX = leftMargin + 41;

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRUPO GLOBAL · SERVICE DESK & AUDITORIA', textStartX, currentY + 8.5);

  doc.setFontSize(8.2);
  doc.text('RELATÓRIO TÉCNICO DE ENCERRAMENTO E AUDITORIA', textStartX, currentY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.3);
  doc.text('Histórico Integral de Interações, Notas e Log de Eventos', textStartX, currentY + 20.5);

  // Subtle vertical divider in header
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(0.2);
  doc.line(144, currentY + 4, 144, currentY + 22);

  // Header Right: Ticket Protocol badge
  const rightEdgeX = pageWidth - leftMargin - 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text(ticket.id, rightEdgeX, currentY + 8.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const exportDate = new Date().toLocaleDateString('pt-BR');
  doc.text(`Status: ${ticket.status.toUpperCase()}`, rightEdgeX, currentY + 14.5, { align: 'right' });
  doc.text(`Emissão: ${exportDate}`, rightEdgeX, currentY + 20.5, { align: 'right' });

  currentY += 32;

  // 2. Section 1: Informações Gerais do Chamado
  checkAddPage(30);
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('1. DADOS GERAIS E CLASSIFICAÇÃO ITIL V4', leftMargin + 4, currentY + 4.5);
  currentY += 9;

  // Key-Value Grid Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, currentY, contentWidth, 32, 1.5, 1.5, 'FD');

  doc.setFontSize(8);
  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Título:', leftMargin + 4, currentY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(ticket.title.slice(0, 75), leftMargin + 18, currentY + 6);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Solicitante:', leftMargin + 4, currentY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${ticket.requesterName} (${ticket.requesterEmail})`, leftMargin + 24, currentY + 13);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Departamento:', leftMargin + 110, currentY + 13);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(ticket.department, leftMargin + 135, currentY + 13);

  // Row 3
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Tipo / Cat.:', leftMargin + 4, currentY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${ticket.type} · ${ticket.category} (${ticket.channel || 'Portal Web'})`, leftMargin + 24, currentY + 20);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Analista:', leftMargin + 110, currentY + 20);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`${ticket.assigneeId.toUpperCase()} (${ticket.tier})`, leftMargin + 135, currentY + 20);

  // Row 4
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Matriz ITIL:', leftMargin + 4, currentY + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(`Prioridade ${ticket.priority} (Impacto: ${ticket.impact} | Urgência: ${ticket.urgency})`, leftMargin + 24, currentY + 27);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('Data Abertura:', leftMargin + 110, currentY + 27);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);
  doc.text(ticket.createdAt, leftMargin + 135, currentY + 27);

  currentY += 38;

  // 3. Section 2: Descrição Inicial do Chamado
  checkAddPage(25);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text('2. DESCRIÇÃO INICIAL DO RELATO DO SOLICITANTE', leftMargin + 4, currentY + 4.5);
  currentY += 9;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);

  const descLines = doc.splitTextToSize(ticket.description || 'Nenhuma descrição detalhada fornecida.', contentWidth - 8);
  const descBoxHeight = Math.max(12, descLines.length * 4.5 + 4);

  checkAddPage(descBoxHeight + 5);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(leftMargin, currentY, contentWidth, descBoxHeight, 1.5, 1.5, 'FD');

  doc.text(descLines, leftMargin + 4, currentY + 5);
  currentY += descBoxHeight + 6;

  // 4. Section 3: Detalhes da Ordem de Serviço (O.S.) se existente
  if (serviceOrder) {
    checkAddPage(35);
    doc.setFillColor(239, 246, 255); // Blue-50
    doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 64, 175); // Blue-700
    doc.text(`3. DADOS DA ORDEM DE SERVIÇO EMITIDA (${serviceOrder.id})`, leftMargin + 4, currentY + 4.5);
    currentY += 9;

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(191, 219, 254); // Blue-200
    doc.roundedRect(leftMargin, currentY, contentWidth, 24, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Código O.S.:', leftMargin + 4, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(serviceOrder.id, leftMargin + 26, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Intervenção:', leftMargin + 70, currentY + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    doc.text(serviceOrder.interventionType, leftMargin + 92, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Desfecho:', leftMargin + 135, currentY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text(serviceOrder.outcomeLabel || 'Concluído', leftMargin + 152, currentY + 6);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Parecer Técnico / Resolução:', leftMargin + 4, currentY + 13);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(15, 23, 42);
    const solLines = doc.splitTextToSize(serviceOrder.solutionSummary, contentWidth - 48);
    doc.text(solLines[0] || '', leftMargin + 48, currentY + 13);

    if (serviceOrder.partsOrSupplies) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Peças/Insumos:', leftMargin + 4, currentY + 19);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(serviceOrder.partsOrSupplies, leftMargin + 28, currentY + 19);
    }

    currentY += 30;
  }

  // 5. Section 4: Histórico Integral de Interações (Notas Técnicas & Comentários)
  const notes = ticket.notes || [];
  checkAddPage(20);
  doc.setFillColor(239, 246, 255);
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175);
  doc.text(`4. HISTÓRICO INTEGRAL DE INTERAÇÕES E NOTAS (${notes.length} REGISTROS)`, leftMargin + 4, currentY + 4.5);
  currentY += 9;

  if (notes.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhuma nota técnica ou comentário registrado neste chamado.', leftMargin + 4, currentY + 4);
    currentY += 10;
  } else {
    notes.forEach((note: TicketNote) => {
      const isInternal = note.visibility === 'internal';
      const authorLabel = `${note.authorName} (${note.authorRole || 'Usuário'})`;
      const timeLabel = note.createdAt;
      const typeLabel = isInternal ? '🔒 NOTA TÉCNICA INTERNA' : '💬 RESPOSTA AO SOLICITANTE';

      const contentLines = doc.splitTextToSize(note.content, contentWidth - 10);
      const noteBoxHeight = Math.max(16, contentLines.length * 4 + 10);

      checkAddPage(noteBoxHeight + 6);

      // Note Box Container (Corporate Blue / Light Slate)
      if (isInternal) {
        doc.setFillColor(239, 246, 255); // Blue-50
        doc.setDrawColor(191, 219, 254); // Blue-200
      } else {
        doc.setFillColor(248, 250, 252); // Slate-50
        doc.setDrawColor(203, 213, 225); // Slate-300
      }
      doc.roundedRect(leftMargin, currentY, contentWidth, noteBoxHeight, 1.5, 1.5, 'FD');

      // Note Header Line inside Box
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(30, 64, 175); // Blue-700
      doc.text(typeLabel, leftMargin + 4, currentY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(authorLabel, leftMargin + 50, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(timeLabel, pageWidth - leftMargin - 4, currentY + 5, { align: 'right' });

      // Separator line inside note box
      doc.setDrawColor(226, 232, 240);
      doc.line(leftMargin + 4, currentY + 7.5, pageWidth - leftMargin - 4, currentY + 7.5);

      // Content
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(contentLines, leftMargin + 4, currentY + 12);

      currentY += noteBoxHeight + 4;
    });
  }

  // 6. Section 5: Log de Auditoria Rastreável (Audit Trail)
  const auditLogs = ticket.auditTrail || [];
  checkAddPage(25);
  doc.setFillColor(239, 246, 255); // Blue-50
  doc.roundedRect(leftMargin, currentY, contentWidth, 6, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 64, 175); // Blue-700
  doc.text(`5. TRILHA AUDITÁVEL E RASTREABILIDADE DE EVENTOS (${auditLogs.length} EVENTOS)`, leftMargin + 4, currentY + 4.5);
  currentY += 9;

  if (auditLogs.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('Nenhum evento de auditoria gravado.', leftMargin + 4, currentY + 4);
    currentY += 10;
  } else {
    // Table Header
    doc.setFillColor(219, 234, 254); // Blue-100
    doc.rect(leftMargin, currentY, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 64, 175); // Blue-700

    doc.text('DATA / HORA', leftMargin + 3, currentY + 4);
    doc.text('AGENTE / ATOR', leftMargin + 35, currentY + 4);
    doc.text('TIPO DE AÇÃO', leftMargin + 85, currentY + 4);
    doc.text('DESCRIÇÃO DETALHADA DO EVENTO', leftMargin + 120, currentY + 4);

    currentY += 6;

    auditLogs.forEach((log: AuditLogItem, index: number) => {
      checkAddPage(6);
      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(leftMargin, currentY, contentWidth, 5.5, 'F');
      }

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);

      doc.text(log.timestamp.slice(0, 18), leftMargin + 3, currentY + 3.8);
      doc.text(log.actor.slice(0, 26), leftMargin + 35, currentY + 3.8);
      doc.text(log.actionType.toUpperCase(), leftMargin + 85, currentY + 3.8);
      doc.text(log.description.slice(0, 45), leftMargin + 120, currentY + 3.8);

      currentY += 5.5;
    });
  }

  // Page numbers footer on every page
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.line(leftMargin, pageHeight - 12, pageWidth - leftMargin, pageHeight - 12);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Grupo Global ITSM · Relatório de Encerramento e Auditoria Gerado Eletronicamente', leftMargin, pageHeight - 7);
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - leftMargin, pageHeight - 7, { align: 'right' });
  }

  return doc;
}

export async function downloadClosedTicketPdf(
  ticket: Ticket,
  serviceOrder?: ServiceOrder
): Promise<void> {
  const doc = await generateClosedTicketPdfDoc(ticket, serviceOrder);
  const cleanId = ticket.id.replace(/[^a-zA-Z0-9-]/g, '');
  doc.save(`Auditoria-Chamado-${cleanId}-GrupoGlobal.pdf`);
}
