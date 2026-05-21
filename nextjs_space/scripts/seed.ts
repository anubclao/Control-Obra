import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seeding de la base de datos...');

  // Crear usuario administrador por defecto
  const adminEmail = 'admin@controlobra.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Administrador',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('✓ Usuario administrador creado: admin@controlobra.com / admin123');
  } else {
    console.log('✓ Usuario administrador ya existe');
  }

  // Crear usuario de prueba obligatorio
  const testEmail = 'john@doe.com';
  const existingTest = await prisma.user.findUnique({
    where: { email: testEmail },
  });

  if (!existingTest) {
    const hashedPassword = await bcrypt.hash('johndoe123', 10);
    await prisma.user.create({
      data: {
        email: testEmail,
        name: 'John Doe',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });
    console.log('✓ Usuario de prueba creado');
  } else {
    console.log('✓ Usuario de prueba ya existe');
  }

  // Crear usuario normal de ejemplo
  const userEmail = 'usuario@controlobra.com';
  const existingUser = await prisma.user.findUnique({
    where: { email: userEmail },
  });

  if (!existingUser) {
    const hashedPassword = await bcrypt.hash('usuario123', 10);
    await prisma.user.create({
      data: {
        email: userEmail,
        name: 'Usuario Normal',
        password: hashedPassword,
        role: 'USER',
      },
    });
    console.log('✓ Usuario normal creado: usuario@controlobra.com / usuario123');
  } else {
    console.log('✓ Usuario normal ya existe');
  }

  console.log('Seeding completado!');
}

main()
  .catch((e) => {
    console.error('Error durante el seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
