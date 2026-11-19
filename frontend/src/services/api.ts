import { AssetMovementRecord, ITAsset } from '../types/itsm';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\s+/g, '');

async function request<T = any>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const headers: Record<string, string> = {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers as Record<string, string>),
    };

    const res = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        credentials: 'include',
        headers,
    });

    if (!res.ok) {
        if (
            res.status === 401 &&
            endpoint !== '/auth/tech-login' &&
            endpoint !== '/auth/google' &&
            endpoint !== '/auth/me' &&
            typeof window !== 'undefined'
        ) {
            window.dispatchEvent(new CustomEvent('globaldesk:unauthorized'));
        }
        const errorBody = await res.json().catch(() => ({}));
        throw new Error(errorBody.error || `Erro na requisição (${res.status})`);
    }

    return res.json();
}

export const api = {
    // 0. Sessão e Autenticação
    async getCurrentSession() {
        return request<{ user: any }>('/auth/me');
    },

    async loginGoogle(data: { idToken: string; expectedRole?: 'collaborator' | 'technician' }) {
        return request<{ user: any }>('/auth/google', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async loginTech(data: { email: string; password: string }) {
        return request<{ user: any }>('/auth/tech-login', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async logout() {
        return request<{ message: string }>('/auth/logout', {
            method: 'POST',
        });
    },

    // 1. Obter todos os chamados com filtros
    async getTickets(params?: {
        status?: string;
        priority?: string;
        assigneeId?: string;
        search?: string;
    }) {
        const query = new URLSearchParams();
        if (params?.status && params.status !== 'Todos') query.append('status', params.status);
        if (params?.priority && params.priority !== 'Todas') query.append('priority', params.priority);
        if (params?.assigneeId && params.assigneeId !== 'Todos')
            query.append('assigneeId', params.assigneeId);
        if (params?.search) query.append('search', params.search);

        const qs = query.toString();
        return request(`/tickets${qs ? `?${qs}` : ''}`);
    },

    // 2. Criar novo chamado (identidade extraída exclusivamente do cookie HttpOnly no back-end)
    async createTicket(data: {
        title: string;
        description: string;
        type: string;
        category: string;
        department: string;
        impact: string;
        urgency: string;
        requesterName?: string;
        requesterEmail?: string;
    }) {
        return request('/tickets', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // 2.1 Excluir chamado
    async deleteTicket(id: string) {
        return request(`/tickets/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    // 3. Atualizar status, responsável ou escalonamento
    async updateTicket(
        id: string,
        data: {
            status?: string;
            tier?: string;
            assigneeId?: string;
            actorName?: string;
            reason?: string;
        }
    ) {
        return request(`/tickets/${encodeURIComponent(id)}`, {
            method: 'PATCH',
            body: JSON.stringify(data),
        });
    },

    // 4. Adicionar nota pública ou técnica interna (autor extraído do token JWT no back-end)
    async addNote(
        ticketId: string,
        data: {
            authorName?: string;
            authorRole?: string;
            visibility: 'PUBLIC' | 'INTERNAL';
            category?: string;
            targetTechName?: string;
            commandSnippet?: string;
            content: string;
        }
    ) {
        return request(`/tickets/${encodeURIComponent(ticketId)}/notes`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // 5. Diretório Corporativo de Usuários e Técnicos
    async getUsers() {
        return request('/users');
    },

    async createUser(data: {
        id?: string;
        fullName?: string;
        name?: string;
        email: string;
        password?: string;
        role?: string;
        tier?: string;
        department?: string;
        avatarInitials?: string;
    }) {
        return request('/users', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async updateUser(
        id: string,
        data: {
            fullName?: string;
            name?: string;
            email?: string;
            password?: string;
            role?: string;
            tier?: string;
            department?: string;
            avatarInitials?: string;
            status?: string;
        }
    ) {
        return request(`/users/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async toggleUserStatus(id: string) {
        return request(`/users/${encodeURIComponent(id)}/status`, {
            method: 'PATCH',
        });
    },

    async deleteUser(id: string) {
        return request(`/users/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    // 6. Ordens de Serviço (O.S.)
    async getServiceOrders() {
        return request('/service-orders');
    },

    async finalizeTicket(
        ticketId: string,
        data: {
            technicianId: string;
            interventionType: string;
            finalizationOutcome: string;
            outcomeLabel: string;
            solutionSummary: string;
            nonCompletionReason?: string;
            partsOrSupplies?: string;
            clientAcceptance: string;
            startedAt: string;
            finalizedAt: string;
            durationText: string;
            slaMet: boolean;
        }
    ) {
        return request(`/tickets/${encodeURIComponent(ticketId)}/finalize`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    // 7. Base de Conhecimento (KB)
    async getKbArticles() {
        return request('/kb');
    },

    async createKbArticle(data: any) {
        return request('/kb', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async updateKbArticle(id: string, data: any) {
        return request(`/kb/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },

    async deleteKbArticle(id: string) {
        return request(`/kb/${encodeURIComponent(id)}`, {
            method: 'DELETE',
        });
    },

    // 8. Gestão de Inventário & Ativos de TI (CMDB)
    async getAssets(params?: {
        status?: string;
        category?: string;
        department?: string;
        search?: string;
    }) {
        const query = new URLSearchParams();
        if (params?.status && params.status !== 'TODOS') query.append('status', params.status);
        if (params?.category && params.category !== 'TODAS')
            query.append('category', params.category);
        if (params?.department && params.department !== 'TODOS')
            query.append('department', params.department);
        if (params?.search) query.append('search', params.search);

        const qs = query.toString();
        return request(`/assets${qs ? `?${qs}` : ''}`);
    },

    async createAsset(data: {
        name: string;
        brand: string;
        model: string;
        serialNumber: string;
        category: string;
        condition: string;
        specifications?: string;
        purchaseDate?: string;
        invoiceNumber?: string;
        supplier?: string;
        purchaseValue?: number | string;
        warrantyUntil?: string;
        department: string;
        location?: string;
        assignedToId?: string;
        notes?: string;
        performedByName: string;
        accessoriesIncluded?: string;
        reason?: string;
    }) {
        return request<{ asset: ITAsset; latestMovement: AssetMovementRecord }>('/assets', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    },

    async moveAsset(
        assetId: string,
        data: {
            type: string;
            status?: string;
            assignedToId?: string | null;
            toUserName?: string;
            toDepartment?: string;
            location?: string;
            conditionAtMoment: string;
            accessoriesIncluded?: string;
            reason: string;
            performedByName: string;
        }
    ) {
        return request<{ asset: ITAsset; latestMovement: AssetMovementRecord }>(
            `/assets/${encodeURIComponent(assetId)}/move`,
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );
    },

    async disposeAsset(
        assetId: string,
        data: {
            reason: string;
            disposalMethod: string;
            conditionAtMoment?: string;
            performedByName: string;
        }
    ) {
        return request<{ asset: ITAsset; latestMovement: AssetMovementRecord }>(
            `/assets/${encodeURIComponent(assetId)}/dispose`,
            {
                method: 'POST',
                body: JSON.stringify(data),
            }
        );
    },

    async updateAsset(assetId: string, data: Record<string, unknown>) {
        return request<ITAsset>(`/assets/${encodeURIComponent(assetId)}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    },
};
