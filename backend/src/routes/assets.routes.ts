import { Router } from 'express';
import {
    AssetCategory,
    AssetCondition,
    AssetStatus,
    MovementType,
    Prisma,
} from '@prisma/client';
import { prisma } from '../lib/prisma';
import {
    SAFE_USER_SELECT,
    requireAuth,
    requireTechRole,
} from '../middleware/auth.middleware';
import { extractTrailingSequenceNumber } from '../utils/itil.utils';
import {
    createAssetSchema,
    disposeAssetSchema,
    moveAssetSchema,
    updateAssetSchema,
    validateBody,
} from '../schemas/validation.schemas';

export const assetsRouter = Router();

// Todas as rotas de Gestão de Inventário & Ativos (CMDB) são restritas à Equipe Técnica
assetsRouter.use(requireAuth, requireTechRole);

const ASSET_INCLUDE = {
    assignedTo: { select: SAFE_USER_SELECT },
    movements: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.AssetInclude;

function parseOptionalDate(raw: unknown): Date | null {
    if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Gera o próximo código sequencial de Patrimônio (PAT-2026-XXXX).
 */
async function generateNextAssetTag(
    tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
    const existing = await tx.asset.findMany({ select: { assetTag: true } });
    const maxNum = extractTrailingSequenceNumber(
        existing.map((item) => item.assetTag),
        0
    );
    return `PAT-2026-${String(maxNum + 1).padStart(4, '0')}`;
}

/**
 * Gera o próximo código sequencial de Termo Oficial (TERM-2026-XXXX).
 */
async function generateNextTermNumber(
    tx: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string> {
    const existing = await tx.assetMovement.findMany({
        select: { termNumber: true },
    });
    const maxNum = extractTrailingSequenceNumber(
        existing.map((item) => item.termNumber),
        0
    );
    return `TERM-2026-${String(maxNum + 1).padStart(4, '0')}`;
}

function normalizeAssetCategory(raw?: string): AssetCategory {
    const valid: Record<string, AssetCategory> = {
        COMPUTADOR: AssetCategory.COMPUTADOR,
        NOTEBOOK: AssetCategory.NOTEBOOK,
        MONITOR: AssetCategory.MONITOR,
        PERIFERICO: AssetCategory.PERIFERICO,
        IMPRESSORA: AssetCategory.IMPRESSORA,
        REDE_SERVIDOR: AssetCategory.REDE_SERVIDOR,
        CELULAR_TABLET: AssetCategory.CELULAR_TABLET,
        LICENCA_SOFTWARE: AssetCategory.LICENCA_SOFTWARE,
        OUTROS: AssetCategory.OUTROS,
    };
    return (raw && valid[raw]) || AssetCategory.NOTEBOOK;
}

function normalizeAssetStatus(raw?: string): AssetStatus {
    const valid: Record<string, AssetStatus> = {
        DISPONIVEL: AssetStatus.DISPONIVEL,
        EM_USO: AssetStatus.EM_USO,
        MANUTENCAO: AssetStatus.MANUTENCAO,
        BAIXADO_DESCARTADO: AssetStatus.BAIXADO_DESCARTADO,
    };
    return (raw && valid[raw]) || AssetStatus.DISPONIVEL;
}

function normalizeAssetCondition(raw?: string): AssetCondition {
    const valid: Record<string, AssetCondition> = {
        NOVO: AssetCondition.NOVO,
        BOM: AssetCondition.BOM,
        DESGASTADO: AssetCondition.DESGASTADO,
        DEFEITUOSO: AssetCondition.DEFEITUOSO,
    };
    return (raw && valid[raw]) || AssetCondition.NOVO;
}

function normalizeMovementType(raw?: string): MovementType {
    const valid: Record<string, MovementType> = {
        AQUISICAO: MovementType.AQUISICAO,
        MOVIMENTACAO_ENTREGA: MovementType.MOVIMENTACAO_ENTREGA,
        DEVOLUCAO: MovementType.DEVOLUCAO,
        MANUTENCAO: MovementType.MANUTENCAO,
        EXCLUSAO_BAIXA: MovementType.EXCLUSAO_BAIXA,
    };
    return (raw && valid[raw]) || MovementType.MOVIMENTACAO_ENTREGA;
}

// 1. Listar todos os ativos com filtros (GET /api/assets)
assetsRouter.get('/', async (req, res) => {
    try {
        const { status, category, department, search } = req.query;
        const where: Prisma.AssetWhereInput = {};

        if (status && status !== 'TODOS' && status !== 'Todos') {
            where.status = normalizeAssetStatus(String(status));
        }

        if (category && category !== 'TODAS' && category !== 'Todas') {
            where.category = normalizeAssetCategory(String(category));
        }

        if (department && department !== 'TODOS' && department !== 'Todos') {
            where.department = {
                contains: String(department),
                mode: 'insensitive',
            };
        }

        if (search && String(search).trim() !== '') {
            const q = String(search).trim();
            where.OR = [
                { assetTag: { contains: q, mode: 'insensitive' } },
                { name: { contains: q, mode: 'insensitive' } },
                { brand: { contains: q, mode: 'insensitive' } },
                { model: { contains: q, mode: 'insensitive' } },
                { serialNumber: { contains: q, mode: 'insensitive' } },
                { department: { contains: q, mode: 'insensitive' } },
                {
                    assignedTo: {
                        is: { name: { contains: q, mode: 'insensitive' } },
                    },
                },
                {
                    assignedTo: {
                        is: { email: { contains: q, mode: 'insensitive' } },
                    },
                },
            ];
        }

        const assets = await prisma.asset.findMany({
            where,
            include: ASSET_INCLUDE,
            orderBy: { createdAt: 'desc' },
        });

        res.json(assets);
    } catch (error) {
        console.error('Erro ao listar ativos de TI:', error);
        res.status(500).json({ error: 'Erro ao listar inventário de ativos.' });
    }
});

// 2. Aquisição / Entrada de Ativo (POST /api/assets)
assetsRouter.post('/', validateBody(createAssetSchema), async (req, res) => {
    try {
        const {
            name,
            brand,
            model,
            serialNumber,
            category,
            condition,
            specifications,
            purchaseDate,
            invoiceNumber,
            supplier,
            purchaseValue,
            warrantyUntil,
            department,
            location,
            assignedToId,
            notes,
            performedByName,
            accessoriesIncluded,
            reason,
        } = req.body;

        const effectiveOperator =
            req.user?.name || performedByName || 'Coordenação de TI';

        const existingSerial = await prisma.asset.findUnique({
            where: { serialNumber },
        });
        if (existingSerial) {
            return res.status(409).json({
                error: `Já existe um ativo cadastrado com o Nº de Série "${serialNumber}" (${existingSerial.assetTag}).`,
            });
        }

        const result = await prisma.$transaction(async (tx) => {
            const assetTag = await generateNextAssetTag(tx);
            const termNumber = await generateNextTermNumber(tx);
            const normalizedCond = normalizeAssetCondition(condition);
            const normalizedCat = normalizeAssetCategory(category);

            let assignedUser = null;
            if (assignedToId) {
                assignedUser = await tx.user.findUnique({
                    where: { id: assignedToId },
                    select: SAFE_USER_SELECT,
                });
            }

            const initialStatus = assignedUser
                ? AssetStatus.EM_USO
                : AssetStatus.DISPONIVEL;

            const createdAsset = await tx.asset.create({
                data: {
                    assetTag,
                    name,
                    brand,
                    model,
                    serialNumber,
                    category: normalizedCat,
                    status: initialStatus,
                    condition: normalizedCond,
                    specifications: specifications || null,
                    purchaseDate: parseOptionalDate(purchaseDate),
                    invoiceNumber: invoiceNumber || null,
                    supplier: supplier || null,
                    purchaseValue:
                        purchaseValue !== undefined &&
                        purchaseValue !== null &&
                        purchaseValue !== '' &&
                        !Number.isNaN(Number(purchaseValue))
                            ? Number(purchaseValue)
                            : null,
                    warrantyUntil: parseOptionalDate(warrantyUntil),
                    department:
                        department ||
                        assignedUser?.department ||
                        'Engenharia & TI',
                    location: location || 'Almoxarifado TI - Matriz',
                    assignedToId: assignedUser?.id || null,
                    notes: notes || null,
                },
            });

            const acquisitionMovement = await tx.assetMovement.create({
                data: {
                    termNumber,
                    assetId: createdAsset.id,
                    type: MovementType.AQUISICAO,
                    fromUserName: supplier
                        ? `Fornecedor: ${supplier}`
                        : 'Aquisição Externa',
                    toUserName: assignedUser?.name || 'Estoque Central de TI',
                    fromDepartment: 'Fornecedor Externo',
                    toDepartment: createdAsset.department,
                    performedByName: effectiveOperator,
                    reason:
                        reason?.trim() ||
                        `Aquisição e incorporação patrimonial via ${invoiceNumber ? `Nota Fiscal ${invoiceNumber}` : 'entrada direta'}${supplier ? ` — Fornecedor: ${supplier}` : ''}.`,
                    conditionAtMoment: normalizedCond,
                    accessoriesIncluded: accessoriesIncluded || null,
                },
            });

            const fullAsset = await tx.asset.findUniqueOrThrow({
                where: { id: createdAsset.id },
                include: ASSET_INCLUDE,
            });

            return { asset: fullAsset, latestMovement: acquisitionMovement };
        });

        res.status(201).json(result);
    } catch (error: unknown) {
        console.error('Erro ao registrar aquisição de ativo:', error);
        const message =
            error instanceof Error
                ? error.message
                : 'Erro interno ao registrar aquisição do ativo.';
        res.status(500).json({ error: message });
    }
});

// 3. Movimentação / Entrega / Devolução / Manutenção (POST /api/assets/:id/move)
assetsRouter.post(
    '/:id/move',
    validateBody(moveAssetSchema),
    async (req, res) => {
        try {
            const id = String(req.params.id);
            const {
                type,
                status,
                assignedToId,
                toUserName: customToUserName,
                toDepartment,
                location,
                conditionAtMoment,
                accessoriesIncluded,
                reason,
                performedByName,
            } = req.body;

            const effectiveOperator =
                req.user?.name || performedByName || 'Coordenação de TI';

            const result = await prisma.$transaction(async (tx) => {
                const currentAsset = await tx.asset.findUnique({
                    where: { id },
                    include: { assignedTo: { select: SAFE_USER_SELECT } },
                });

                if (!currentAsset) {
                    throw new Error('Ativo não encontrado no inventário.');
                }

                if (currentAsset.status === AssetStatus.BAIXADO_DESCARTADO) {
                    throw new Error(
                        'Este ativo já possui baixa patrimonial definitiva e não pode ser movimentado.'
                    );
                }

                const termNumber = await generateNextTermNumber(tx);
                const movType = normalizeMovementType(type);
                const cond = normalizeAssetCondition(
                    conditionAtMoment || currentAsset.condition
                );

                let targetUser = null;
                if (
                    assignedToId &&
                    movType === MovementType.MOVIMENTACAO_ENTREGA
                ) {
                    targetUser = await tx.user.findUnique({
                        where: { id: assignedToId },
                        select: SAFE_USER_SELECT,
                    });
                }

                let nextStatus: AssetStatus = AssetStatus.EM_USO;
                if (status) {
                    nextStatus = normalizeAssetStatus(status);
                } else if (movType === MovementType.DEVOLUCAO) {
                    nextStatus = AssetStatus.DISPONIVEL;
                } else if (movType === MovementType.MANUTENCAO) {
                    nextStatus = AssetStatus.MANUTENCAO;
                } else {
                    nextStatus = AssetStatus.EM_USO;
                }

                const nextAssignedId =
                    movType === MovementType.DEVOLUCAO ||
                    movType === MovementType.MANUTENCAO
                        ? null
                        : targetUser?.id || null;

                const nextDept =
                    toDepartment ||
                    targetUser?.department ||
                    (movType === MovementType.DEVOLUCAO
                        ? 'Engenharia & TI'
                        : currentAsset.department);

                const nextLocation =
                    location !== undefined
                        ? location
                        : movType === MovementType.DEVOLUCAO
                          ? 'Almoxarifado TI - Matriz'
                          : movType === MovementType.MANUTENCAO
                            ? 'Laboratório / Assistência Técnica TI'
                            : currentAsset.location;

                await tx.asset.update({
                    where: { id },
                    data: {
                        status: nextStatus,
                        condition: cond,
                        department: nextDept,
                        location: nextLocation,
                        assignedToId: nextAssignedId,
                    },
                });

                const resolvedToUserName =
                    targetUser?.name ||
                    customToUserName ||
                    (movType === MovementType.DEVOLUCAO
                        ? 'Estoque Central de TI'
                        : movType === MovementType.MANUTENCAO
                          ? 'Laboratório Técnico / RMA'
                          : 'Setor Corporativo');

                const movement = await tx.assetMovement.create({
                    data: {
                        termNumber,
                        assetId: id,
                        type: movType,
                        fromUserName:
                            currentAsset.assignedTo?.name ||
                            'Estoque Central de TI',
                        toUserName: resolvedToUserName,
                        fromDepartment: currentAsset.department,
                        toDepartment: nextDept,
                        performedByName: effectiveOperator,
                        reason,
                        conditionAtMoment: cond,
                        accessoriesIncluded: accessoriesIncluded || null,
                    },
                });

                const updatedAsset = await tx.asset.findUniqueOrThrow({
                    where: { id },
                    include: ASSET_INCLUDE,
                });

                return { asset: updatedAsset, latestMovement: movement };
            });

            res.status(201).json(result);
        } catch (error: unknown) {
            console.error('Erro ao movimentar ativo:', error);
            const message =
                error instanceof Error
                    ? error.message
                    : 'Erro ao registrar movimentação do ativo.';
            res.status(400).json({ error: message });
        }
    }
);

// 4. Exclusão / Baixa Patrimonial (POST /api/assets/:id/dispose)
assetsRouter.post(
    '/:id/dispose',
    validateBody(disposeAssetSchema),
    async (req, res) => {
        try {
            const id = String(req.params.id);
            const {
                reason,
                disposalMethod,
                performedByName,
                conditionAtMoment,
            } = req.body;

            const effectiveOperator =
                req.user?.name || performedByName || 'Coordenação de TI';

            const result = await prisma.$transaction(async (tx) => {
                const currentAsset = await tx.asset.findUnique({
                    where: { id },
                    include: { assignedTo: { select: SAFE_USER_SELECT } },
                });

                if (!currentAsset) {
                    throw new Error('Ativo não encontrado.');
                }

                if (currentAsset.status === AssetStatus.BAIXADO_DESCARTADO) {
                    throw new Error(
                        'Este ativo já se encontra baixado/descartado.'
                    );
                }

                const termNumber = await generateNextTermNumber(tx);
                const cond = normalizeAssetCondition(
                    conditionAtMoment || AssetCondition.DEFEITUOSO
                );

                await tx.asset.update({
                    where: { id },
                    data: {
                        status: AssetStatus.BAIXADO_DESCARTADO,
                        condition: cond,
                        assignedToId: null,
                        location: 'Baixa Patrimonial / Descarte Certificado',
                    },
                });

                const disposalMovement = await tx.assetMovement.create({
                    data: {
                        termNumber,
                        assetId: id,
                        type: MovementType.EXCLUSAO_BAIXA,
                        fromUserName:
                            currentAsset.assignedTo?.name || 'Custódia de TI',
                        toUserName: 'Baixa Patrimonial Definitiva',
                        fromDepartment: currentAsset.department,
                        toDepartment: 'Patrimônio Baixado / Descarte',
                        performedByName: effectiveOperator,
                        reason,
                        conditionAtMoment: cond,
                        disposalMethod:
                            disposalMethod || 'Descarte ecológico certificado',
                    },
                });

                const updatedAsset = await tx.asset.findUniqueOrThrow({
                    where: { id },
                    include: ASSET_INCLUDE,
                });

                return { asset: updatedAsset, latestMovement: disposalMovement };
            });

            res.status(201).json(result);
        } catch (error: unknown) {
            console.error('Erro ao realizar baixa patrimonial:', error);
            const message =
                error instanceof Error
                    ? error.message
                    : 'Erro ao processar baixa patrimonial do ativo.';
            res.status(400).json({ error: message });
        }
    }
);

// 5. Edição Cadastral e Especificações Técnicas do Ativo (PUT /api/assets/:id)
assetsRouter.put('/:id', validateBody(updateAssetSchema), async (req, res) => {
    try {
        const id = String(req.params.id);
        const {
            name,
            brand,
            model,
            serialNumber,
            category,
            condition,
            specifications,
            purchaseDate,
            invoiceNumber,
            supplier,
            purchaseValue,
            warrantyUntil,
            department,
            location,
            notes,
        } = req.body;

        const updateData: Prisma.AssetUpdateInput = {};
        if (name !== undefined) updateData.name = name;
        if (brand !== undefined) updateData.brand = brand;
        if (model !== undefined) updateData.model = model;
        if (serialNumber !== undefined) {
            const existingSerial = await prisma.asset.findUnique({
                where: { serialNumber },
            });
            if (existingSerial && existingSerial.id !== id) {
                return res.status(409).json({
                    error: `Já existe outro ativo cadastrado com o Nº de Série "${serialNumber}" (${existingSerial.assetTag}).`,
                });
            }
            updateData.serialNumber = serialNumber;
        }
        if (category !== undefined)
            updateData.category = normalizeAssetCategory(category);
        if (condition !== undefined)
            updateData.condition = normalizeAssetCondition(condition);
        if (specifications !== undefined)
            updateData.specifications = specifications || null;
        if (purchaseDate !== undefined) {
            updateData.purchaseDate = parseOptionalDate(purchaseDate);
        }
        if (invoiceNumber !== undefined)
            updateData.invoiceNumber = invoiceNumber || null;
        if (supplier !== undefined) updateData.supplier = supplier || null;
        if (purchaseValue !== undefined) {
            updateData.purchaseValue =
                purchaseValue !== '' &&
                purchaseValue !== null &&
                !Number.isNaN(Number(purchaseValue))
                    ? Number(purchaseValue)
                    : null;
        }
        if (warrantyUntil !== undefined) {
            updateData.warrantyUntil = parseOptionalDate(warrantyUntil);
        }
        if (department !== undefined) updateData.department = department;
        if (location !== undefined) updateData.location = location || null;
        if (notes !== undefined) updateData.notes = notes || null;

        const updatedAsset = await prisma.asset.update({
            where: { id },
            data: updateData,
            include: ASSET_INCLUDE,
        });

        res.json(updatedAsset);
    } catch (error: unknown) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2025'
        ) {
            return res.status(404).json({ error: 'Ativo não encontrado.' });
        }
        console.error('Erro ao atualizar cadastro do ativo:', error);
        const message =
            error instanceof Error
                ? error.message
                : 'Erro ao atualizar dados cadastrais do ativo.';
        res.status(500).json({ error: message });
    }
});
