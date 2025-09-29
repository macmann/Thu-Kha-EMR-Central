import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface CliArgs {
  name?: string;
  code?: string;
  admin?: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { admin: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = argv[i + 1];
    switch (key) {
      case 'name':
        if (next && !next.startsWith('--')) {
          args.name = next;
          i += 1;
        }
        break;
      case 'code':
        if (next && !next.startsWith('--')) {
          args.code = next;
          i += 1;
        }
        break;
      case 'admin': {
        if (!args.admin) args.admin = [];
        if (next && !next.startsWith('--')) {
          args.admin.push(next.toLowerCase());
          i += 1;
        }
        break;
      }
      default:
        break;
    }
  }
  return args;
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

async function ensureAdmins(emails: string[], tenantId: string) {
  if (emails.length === 0) {
    console.log('⚠️  No --admin email provided. Create the tenant membership manually if required.');
    return;
  }

  for (const email of emails) {
    const user = await prisma.user.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        status: 'active',
      },
      select: { userId: true, role: true, email: true },
    });

    if (!user) {
      console.warn(`⚠️  Skipping ${email}: no active user found.`);
      continue;
    }

    await prisma.userTenant.upsert({
      where: { tenantId_userId: { tenantId, userId: user.userId } },
      update: { role: user.role },
      create: { tenantId, userId: user.userId, role: user.role },
    });

    console.log(`✅ Added ${user.email} (${user.role}) to the clinic.`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const name = args.name?.trim();

  if (!name) {
    console.error('Usage: npm run tenant:create -- --name "Clinic Name" [--code slug] [--admin admin@example.com]');
    process.exit(1);
  }

  const code = args.code?.trim() || slugifyName(name);

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name,
        code,
      },
    });

    console.log(`🏥 Created clinic "${tenant.name}" (code: ${tenant.code ?? 'n/a'})`);

    const adminEmails = args.admin ?? [];
    await ensureAdmins(adminEmails, tenant.tenantId);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Failed to create clinic: ${error.message}`);
    } else {
      console.error('❌ Failed to create clinic due to an unknown error.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
