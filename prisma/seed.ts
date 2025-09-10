import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de MedMind...');

  // ============================================================================
  // 1. CREAR ROLES DEL SISTEMA
  // ============================================================================
  console.log('👥 Creando roles del sistema...');
  
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'student' },
      update: {},
      create: {
        name: 'student',
        displayName: 'Estudiante',
        description: 'Usuario estudiante con acceso básico al chat',
        isSystemRole: true,
      },
    }),
    prisma.role.upsert({
      where: { name: 'content_admin' },
      update: {},
      create: {
        name: 'content_admin',
        displayName: 'Administrador de Contenido',
        description: 'Puede gestionar asistentes y archivos',
        isSystemRole: true,
      },
    }),
    prisma.role.upsert({
      where: { name: 'user_admin' },
      update: {},
      create: {
        name: 'user_admin',
        displayName: 'Administrador de Usuarios',
        description: 'Puede gestionar usuarios y suscripciones',
        isSystemRole: true,
      },
    }),
    prisma.role.upsert({
      where: { name: 'analytics_admin' },
      update: {},
      create: {
        name: 'analytics_admin',
        displayName: 'Administrador de Analytics',
        description: 'Acceso a reportes y estadísticas',
        isSystemRole: true,
      },
    }),
    prisma.role.upsert({
      where: { name: 'super_admin' },
      update: {},
      create: {
        name: 'super_admin',
        displayName: 'Super Administrador',
        description: 'Acceso completo al sistema',
        isSystemRole: true,
      },
    }),
  ]);
  
  console.log(`✅ ${roles.length} roles creados`);

  // ============================================================================
  // 2. CREAR PERMISOS BÁSICOS
  // ============================================================================
  console.log('🔐 Creando permisos básicos...');
  
  const permissions = await Promise.all([
    // Permisos de Asistentes
    prisma.permission.upsert({
      where: { name: 'assistants.create' },
      update: {},
      create: {
        name: 'assistants.create',
        resource: 'assistants',
        action: 'create',
        description: 'Crear nuevos asistentes médicos',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'assistants.read' },
      update: {},
      create: {
        name: 'assistants.read',
        resource: 'assistants',
        action: 'read',
        description: 'Ver lista de asistentes',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'assistants.update' },
      update: {},
      create: {
        name: 'assistants.update',
        resource: 'assistants',
        action: 'update',
        description: 'Editar asistentes existentes',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'assistants.delete' },
      update: {},
      create: {
        name: 'assistants.delete',
        resource: 'assistants',
        action: 'delete',
        description: 'Eliminar asistentes',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'assistants.upload_files' },
      update: {},
      create: {
        name: 'assistants.upload_files',
        resource: 'assistants',
        action: 'manage',
        description: 'Subir PDFs a asistentes',
      },
    }),
    // Permisos de Usuarios
    prisma.permission.upsert({
      where: { name: 'users.read' },
      update: {},
      create: {
        name: 'users.read',
        resource: 'users',
        action: 'read',
        description: 'Ver lista de usuarios',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'users.update' },
      update: {},
      create: {
        name: 'users.update',
        resource: 'users',
        action: 'update',
        description: 'Editar usuarios',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'users.delete' },
      update: {},
      create: {
        name: 'users.delete',
        resource: 'users',
        action: 'delete',
        description: 'Eliminar usuarios',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'users.manage_subscriptions' },
      update: {},
      create: {
        name: 'users.manage_subscriptions',
        resource: 'users',
        action: 'manage',
        description: 'Gestionar suscripciones',
      },
    }),
    // Permisos de Analytics
    prisma.permission.upsert({
      where: { name: 'analytics.view_usage' },
      update: {},
      create: {
        name: 'analytics.view_usage',
        resource: 'analytics',
        action: 'read',
        description: 'Ver estadísticas de uso',
      },
    }),
    prisma.permission.upsert({
      where: { name: 'analytics.view_costs' },
      update: {},
      create: {
        name: 'analytics.view_costs',
        resource: 'analytics',
        action: 'read',
        description: 'Ver reportes de costos',
      },
    }),
    // Permisos de Sistema
    prisma.permission.upsert({
      where: { name: 'system.manage_roles' },
      update: {},
      create: {
        name: 'system.manage_roles',
        resource: 'system',
        action: 'manage',
        description: 'Gestionar roles y permisos',
      },
    }),
  ]);
  
  console.log(`✅ ${permissions.length} permisos creados`);

  // ============================================================================
  // 3. ASIGNAR PERMISOS A ROLES
  // ============================================================================
  console.log('🔗 Asignando permisos a roles...');

  // Buscar roles y permisos por nombre
  const studentRole = await prisma.role.findUnique({ where: { name: 'student' } });
  const contentAdminRole = await prisma.role.findUnique({ where: { name: 'content_admin' } });
  const userAdminRole = await prisma.role.findUnique({ where: { name: 'user_admin' } });
  const analyticsAdminRole = await prisma.role.findUnique({ where: { name: 'analytics_admin' } });
  const superAdminRole = await prisma.role.findUnique({ where: { name: 'super_admin' } });

  // Permisos para Content Admin
  const contentAdminPerms = [
    'assistants.create', 'assistants.read', 'assistants.update', 
    'assistants.delete', 'assistants.upload_files'
  ];
  
  for (const permName of contentAdminPerms) {
    const permission = await prisma.permission.findUnique({ where: { name: permName } });
    if (permission && contentAdminRole) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: contentAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: contentAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Permisos para User Admin
  const userAdminPerms = [
    'users.read', 'users.update', 'users.delete', 'users.manage_subscriptions'
  ];
  
  for (const permName of userAdminPerms) {
    const permission = await prisma.permission.findUnique({ where: { name: permName } });
    if (permission && userAdminRole) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: userAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: userAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Permisos para Analytics Admin
  const analyticsAdminPerms = [
    'analytics.view_usage', 'analytics.view_costs'
  ];
  
  for (const permName of analyticsAdminPerms) {
    const permission = await prisma.permission.findUnique({ where: { name: permName } });
    if (permission && analyticsAdminRole) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: analyticsAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: analyticsAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  // Super Admin tiene TODOS los permisos
  for (const permission of permissions) {
    if (superAdminRole) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
      });
    }
  }

  console.log('✅ Permisos asignados a roles');

  // ============================================================================
  // 4. CREAR USUARIOS DE PRUEBA
  // ============================================================================
  console.log('👤 Creando usuarios de prueba...');

  const saltRounds = 10;
  
  // Estudiante de prueba
  const studentUser = await prisma.user.upsert({
    where: { email: 'estudiante@medmind.pe' },
    update: {},
    create: {
      email: 'estudiante@medmind.pe',
      passwordHash: await bcrypt.hash('password123', saltRounds),
      fullName: 'Juan Pérez Estudiante',
      university: 'Universidad Nacional Mayor de San Marcos',
      semester: 8,
      subscriptionStatus: 'TRIAL',
      subscriptionExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
    },
  });

  // Content Admin
  const contentAdminUser = await prisma.user.upsert({
    where: { email: 'content@medmind.pe' },
    update: {},
    create: {
      email: 'content@medmind.pe',
      passwordHash: await bcrypt.hash('admin123', saltRounds),
      fullName: 'María García - Content Admin',
      subscriptionStatus: 'ACTIVE',
    },
  });

  // User Admin
  const userAdminUser = await prisma.user.upsert({
    where: { email: 'users@medmind.pe' },
    update: {},
    create: {
      email: 'users@medmind.pe',
      passwordHash: await bcrypt.hash('admin123', saltRounds),
      fullName: 'Carlos López - User Admin',
      subscriptionStatus: 'ACTIVE',
    },
  });

  // Analytics Admin
  const analyticsAdminUser = await prisma.user.upsert({
    where: { email: 'analytics@medmind.pe' },
    update: {},
    create: {
      email: 'analytics@medmind.pe',
      passwordHash: await bcrypt.hash('admin123', saltRounds),
      fullName: 'Ana Rodríguez - Analytics Admin',
      subscriptionStatus: 'ACTIVE',
    },
  });

  // Super Admin
  const superAdminUser = await prisma.user.upsert({
    where: { email: 'admin@medmind.pe' },
    update: {},
    create: {
      email: 'admin@medmind.pe',
      passwordHash: await bcrypt.hash('superadmin123', saltRounds),
      fullName: 'Super Administrador',
      subscriptionStatus: 'ACTIVE',
    },
  });

  console.log('✅ 5 usuarios creados');

  // ============================================================================
  // 5. ASIGNAR ROLES A USUARIOS
  // ============================================================================
  console.log('🎭 Asignando roles a usuarios...');

  const userRoleAssignments = [
    { user: studentUser, role: studentRole },
    { user: contentAdminUser, role: contentAdminRole },
    { user: userAdminUser, role: userAdminRole },
    { user: analyticsAdminUser, role: analyticsAdminRole },
    { user: superAdminUser, role: superAdminRole },
  ];

  for (const { user, role } of userRoleAssignments) {
    if (user && role) {
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: role.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          roleId: role.id,
          assignedBy: superAdminUser.id,
        },
      });
    }
  }

  console.log('✅ Roles asignados a usuarios');

  // ============================================================================
  // 6. CREAR ASISTENTES MÉDICOS DE EJEMPLO
  // ============================================================================
  console.log('🩺 Creando asistentes médicos de ejemplo...');

  // Crear asistentes usando create en lugar de upsert ya que name no es único
  const existingAssistants = await prisma.assistant.findMany();
  let assistants: any[] = [];

  if (existingAssistants.length === 0) {
    const cardioAssistant = await prisma.assistant.create({
      data: {
        name: 'Dr. Cardio AI',
        specialty: 'cardiologia',
        openaiAssistantId: 'asst_ejemplo_cardio_123',
        description: 'Especialista en cardiología, ECGs y casos clínicos cardiovasculares',
        instructions: 'Eres un especialista en cardiología que ayuda a estudiantes de medicina...',
        createdBy: contentAdminUser.id,
      },
    });

    const neuroAssistant = await prisma.assistant.create({
      data: {
        name: 'Dra. Neuro AI',
        specialty: 'neurologia',
        openaiAssistantId: 'asst_ejemplo_neuro_456',
        description: 'Especialista en neurología, casos neurológicos y examen neurológico',
        instructions: 'Eres una especialista en neurología que ayuda a estudiantes...',
        createdBy: contentAdminUser.id,
      },
    });

    const internoAssistant = await prisma.assistant.create({
      data: {
        name: 'Dr. Interno AI',
        specialty: 'medicina_interna',
        openaiAssistantId: 'asst_ejemplo_interno_789',
        description: 'Especialista en medicina interna y casos clínicos generales',
        instructions: 'Eres un especialista en medicina interna...',
        createdBy: contentAdminUser.id,
      },
    });

    assistants = [cardioAssistant, neuroAssistant, internoAssistant];
  } else {
    assistants = existingAssistants;
  }

  console.log(`✅ ${assistants.length} asistentes médicos creados`);

  console.log('🎉 Seed completado exitosamente!');
  console.log(`
📊 RESUMEN:
• ${roles.length} roles creados
• ${permissions.length} permisos creados  
• 5 usuarios creados
• ${assistants.length} asistentes médicos creados

🔐 CREDENCIALES DE ACCESO:
• Estudiante: estudiante@medmind.pe / password123
• Content Admin: content@medmind.pe / admin123
• User Admin: users@medmind.pe / admin123
• Analytics Admin: analytics@medmind.pe / admin123
• Super Admin: admin@medmind.pe / superadmin123
  `);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error en seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });