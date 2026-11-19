import { PrismaClient, UserRole, SupportTier } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Provisionando conta Superadmin inicial...');

    const adminName = process.env.SUPERADMIN_NAME || 'Administrador de TI';
    const adminEmail =
        process.env.SUPERADMIN_EMAIL || 'admin@corporativo.com.br';
    const workspaceDomain =
        process.env.WORKSPACE_DOMAIN ||
        adminEmail.split('@')[1] ||
        'corporativo.com.br';

    await prisma.user.upsert({
        where: { id: 'usr-alexandre' },
        update: {
            name: adminName,
            email: adminEmail,
            role: UserRole.ADMIN,
            tier: SupportTier.N3,
            avatarInitials: 'AT',
            googleAccountDomain: workspaceDomain,
            status: 'Ativo',
        },
        create: {
            id: 'usr-alexandre',
            name: adminName,
            email: adminEmail,
            role: UserRole.ADMIN,
            tier: SupportTier.N3,
            department: 'Engenharia & TI',
            avatarInitials: 'AT',
            isGoogleVerified: true,
            googleAccountDomain: workspaceDomain,
        },
    });

    console.log(
        'Seed concluído com sucesso! Apenas o Superadmin foi provisionado.'
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
