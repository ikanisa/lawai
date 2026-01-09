import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@lawai.example' },
    update: {},
    create: {
      email: 'admin@lawai.example',
      name: 'System Admin',
      role: 'ADMIN',
      passwordHash: adminPassword,
    },
  });
  console.log('Created admin user:', admin.email);

  // Create staff user
  const staffPassword = await bcrypt.hash('staff123', 10);
  const staff = await prisma.user.upsert({
    where: { email: 'staff@lawai.example' },
    update: {},
    create: {
      email: 'staff@lawai.example',
      name: 'Staff User',
      role: 'STAFF',
      passwordHash: staffPassword,
    },
  });
  console.log('Created staff user:', staff.email);

  // Create initial system settings
  await prisma.systemSetting.upsert({
    where: { key: 'ai_model' },
    update: {},
    create: {
      key: 'ai_model',
      value: { model: 'gpt-4-turbo-preview' },
      description: 'Default AI model for legal queries',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'max_tokens' },
    update: {},
    create: {
      key: 'max_tokens',
      value: { maxTokens: 2000 },
      description: 'Maximum tokens for AI responses',
    },
  });

  console.log('Database seeded successfully!');
  console.log('\nDefault credentials:');
  console.log('Admin: admin@lawai.example / admin123');
  console.log('Staff: staff@lawai.example / staff123');
  console.log('\n⚠️  Change these passwords immediately in production!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
