-- =============================================
-- ACCESS CONTROL: ROLES + MENU PERMISSIONS
-- =============================================

CREATE TABLE IF NOT EXISTS `AccessRole` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `description` TEXT NULL,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `AccessRole_name_key` (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `MenuPermission` (
  `id` VARCHAR(191) NOT NULL,
  `accessRoleId` VARCHAR(191) NOT NULL,
  `menuKey` VARCHAR(120) NOT NULL,
  `allowed` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `MenuPermission_accessRoleId_menuKey_key` (`accessRoleId`, `menuKey`),
  KEY `MenuPermission_accessRoleId_idx` (`accessRoleId`),
  CONSTRAINT `MenuPermission_accessRoleId_fkey` FOREIGN KEY (`accessRoleId`) REFERENCES `AccessRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `UserAccessRole` (
  `id` VARCHAR(191) NOT NULL,
  `userId` VARCHAR(191) NOT NULL,
  `accessRoleId` VARCHAR(191) NOT NULL,
  `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `assignedById` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `UserAccessRole_userId_key` (`userId`),
  KEY `UserAccessRole_accessRoleId_idx` (`accessRoleId`),
  KEY `UserAccessRole_assignedById_idx` (`assignedById`),
  CONSTRAINT `UserAccessRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserAccessRole_accessRoleId_fkey` FOREIGN KEY (`accessRoleId`) REFERENCES `AccessRole`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `UserAccessRole_assignedById_fkey` FOREIGN KEY (`assignedById`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Roles base opcionales
INSERT IGNORE INTO `AccessRole` (`id`, `name`, `description`, `isActive`, `isSystem`)
VALUES
  ('sys_admin', 'Administrador Total', 'Acceso completo al sistema', 1, 1),
  ('sys_gerencia', 'Gerencia General', 'Acceso amplio para gestion', 1, 1),
  ('sys_obra', 'Equipo Tecnico Obra', 'Acceso a modulos tecnicos', 1, 1);

-- Catalogo de menus para inicializar permisos
INSERT IGNORE INTO `MenuPermission` (`id`, `accessRoleId`, `menuKey`, `allowed`)
VALUES
  ('sys_admin_dashboard', 'sys_admin', 'dashboard', 1),
  ('sys_admin_proyectos', 'sys_admin', 'proyectos', 1),
  ('sys_admin_presupuestos', 'sys_admin', 'presupuestos', 1),
  ('sys_admin_registro_gastos', 'sys_admin', 'registro_gastos', 1),
  ('sys_admin_aiu', 'sys_admin', 'aiu', 1),
  ('sys_admin_registro_avances', 'sys_admin', 'registro_avances', 1),
  ('sys_admin_cortes_obra', 'sys_admin', 'cortes_obra', 1),
  ('sys_admin_contratistas', 'sys_admin', 'contratistas', 1),
  ('sys_admin_proveedores', 'sys_admin', 'proveedores', 1),
  ('sys_admin_rrhh', 'sys_admin', 'rrhh', 1),
  ('sys_admin_tesoreria', 'sys_admin', 'tesoreria', 1),
  ('sys_admin_impuestos', 'sys_admin', 'impuestos', 1),
  ('sys_admin_usuarios', 'sys_admin', 'usuarios', 1),
  ('sys_admin_roles', 'sys_admin', 'roles', 1),
  ('sys_admin_cotizaciones', 'sys_admin', 'cotizaciones', 1),
  ('sys_admin_clientes', 'sys_admin', 'clientes', 1),

  ('sys_gerencia_dashboard', 'sys_gerencia', 'dashboard', 1),
  ('sys_gerencia_proyectos', 'sys_gerencia', 'proyectos', 1),
  ('sys_gerencia_presupuestos', 'sys_gerencia', 'presupuestos', 1),
  ('sys_gerencia_registro_gastos', 'sys_gerencia', 'registro_gastos', 1),
  ('sys_gerencia_aiu', 'sys_gerencia', 'aiu', 1),
  ('sys_gerencia_registro_avances', 'sys_gerencia', 'registro_avances', 1),
  ('sys_gerencia_cortes_obra', 'sys_gerencia', 'cortes_obra', 1),
  ('sys_gerencia_contratistas', 'sys_gerencia', 'contratistas', 1),
  ('sys_gerencia_proveedores', 'sys_gerencia', 'proveedores', 1),
  ('sys_gerencia_rrhh', 'sys_gerencia', 'rrhh', 1),
  ('sys_gerencia_tesoreria', 'sys_gerencia', 'tesoreria', 1),
  ('sys_gerencia_impuestos', 'sys_gerencia', 'impuestos', 1),
  ('sys_gerencia_usuarios', 'sys_gerencia', 'usuarios', 1),
  ('sys_gerencia_roles', 'sys_gerencia', 'roles', 1),
  ('sys_gerencia_cotizaciones', 'sys_gerencia', 'cotizaciones', 1),
  ('sys_gerencia_clientes', 'sys_gerencia', 'clientes', 1),

  ('sys_obra_dashboard', 'sys_obra', 'dashboard', 1),
  ('sys_obra_proyectos', 'sys_obra', 'proyectos', 1),
  ('sys_obra_presupuestos', 'sys_obra', 'presupuestos', 1),
  ('sys_obra_registro_gastos', 'sys_obra', 'registro_gastos', 1),
  ('sys_obra_aiu', 'sys_obra', 'aiu', 1),
  ('sys_obra_registro_avances', 'sys_obra', 'registro_avances', 1),
  ('sys_obra_cortes_obra', 'sys_obra', 'cortes_obra', 1);
