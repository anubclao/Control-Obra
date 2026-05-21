-- =============================================
-- CONTROL OBRA - SQL FULL PARA PHPMYADMIN
-- Generado automaticamente
-- Fecha: 2026-05-21 08:44:23
-- =============================================

-- IMPORTANTE:
-- 1) Crear previamente la base en phpMyAdmin (ej: control_obra_db)
-- 2) Seleccionar esa base antes de importar este archivo
-- 3) Si tu hosting restringe CREATE FUNCTION/TRIGGER/PROCEDURE,
--    esas sentencias pueden fallar por permisos.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CONTABILIDAD', 'TESORERIA', 'HSEQ', 'CLIENTE', 'USER') NOT NULL DEFAULT 'USER',
    `phone` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Invitation` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CONTABILIDAD', 'TESORERIA', 'HSEQ', 'CLIENTE', 'USER') NOT NULL DEFAULT 'USER',
    `projectId` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `maxUses` INTEGER NOT NULL DEFAULT 1,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdById` VARCHAR(191) NOT NULL,
    `usedById` VARCHAR(191) NULL,

    UNIQUE INDEX `Invitation_code_key`(`code`),
    UNIQUE INDEX `Invitation_usedById_key`(`usedById`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailOtp` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `codeHash` VARCHAR(191) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `requestedIp` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `EmailOtp_email_createdAt_idx`(`email`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProjectAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `role` ENUM('ADMIN', 'GERENTE', 'DIRECTOR', 'RESIDENTE', 'CONTABILIDAD', 'TESORERIA', 'HSEQ', 'CLIENTE', 'USER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProjectAssignment_userId_projectId_key`(`userId`, `projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `client` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NULL,
    `startDate` DATETIME(3) NOT NULL,
    `estimatedEndDate` DATETIME(3) NOT NULL,
    `totalBudget` DOUBLE NOT NULL,
    `status` ENUM('IN_PLANNING', 'IN_EXECUTION', 'PAUSED', 'COMPLETED') NOT NULL DEFAULT 'IN_PLANNING',
    `description` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CostCenter` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `assignedBudget` DOUBLE NOT NULL,
    `spentAmount` DOUBLE NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contractor` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nit` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` ENUM('COMPLETE', 'INCOMPLETE', 'EXPIRED') NOT NULL DEFAULT 'INCOMPLETE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `legalRepName` VARCHAR(191) NULL,
    `legalRepEmail` VARCHAR(191) NULL,
    `legalRepPhone` VARCHAR(191) NULL,
    `legalRepCedula` VARCHAR(191) NULL,
    `reportedIncome` DOUBLE NULL,
    `incomeYear` INTEGER NULL,
    `ref1Name` VARCHAR(191) NULL,
    `ref1Company` VARCHAR(191) NULL,
    `ref1Phone` VARCHAR(191) NULL,
    `ref1Email` VARCHAR(191) NULL,
    `ref2Name` VARCHAR(191) NULL,
    `ref2Company` VARCHAR(191) NULL,
    `ref2Phone` VARCHAR(191) NULL,
    `ref2Email` VARCHAR(191) NULL,
    `ref3Name` VARCHAR(191) NULL,
    `ref3Company` VARCHAR(191) NULL,
    `ref3Phone` VARCHAR(191) NULL,
    `ref3Email` VARCHAR(191) NULL,

    UNIQUE INDEX `Contractor_nit_key`(`nit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Document` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('CEDULA', 'RUT', 'CAMARA_COMERCIO', 'CERTIFICADO_BANCARIO') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `expirationDate` DATETIME(3) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `contractorId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkCut` (
    `id` VARCHAR(191) NOT NULL,
    `cutNumber` INTEGER NOT NULL,
    `periodStart` DATETIME(3) NOT NULL,
    `periodEnd` DATETIME(3) NOT NULL,
    `requestedAmount` DOUBLE NOT NULL,
    `description` TEXT NOT NULL,
    `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejectionReason` TEXT NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractorId` VARCHAR(191) NOT NULL,
    `costCenterId` VARCHAR(191) NOT NULL,
    `approvedById` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkCutDocument` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `workCutId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLog` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `activities` TEXT NOT NULL,
    `weather` VARCHAR(191) NOT NULL,
    `personnel` TEXT NOT NULL,
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractorId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WorkLogPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `description` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `workLogId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Budget` (
    `id` VARCHAR(191) NOT NULL,
    `aiuPercentage` DOUBLE NOT NULL DEFAULT 18,
    `adminPercentage` DOUBLE NOT NULL DEFAULT 8,
    `imprevistoPercentage` DOUBLE NOT NULL DEFAULT 5,
    `utilidadPercentage` DOUBLE NOT NULL DEFAULT 5,
    `ivaUtilityPercentage` DOUBLE NOT NULL DEFAULT 19,
    `ptIndexPercentage` DOUBLE NOT NULL DEFAULT 100,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `totalDirectCostPC` DOUBLE NOT NULL DEFAULT 0,
    `totalDirectCostPT` DOUBLE NOT NULL DEFAULT 0,
    `totalAIU_PC` DOUBLE NOT NULL DEFAULT 0,
    `totalAIU_PT` DOUBLE NOT NULL DEFAULT 0,
    `totalIvaUtilidad_PC` DOUBLE NOT NULL DEFAULT 0,
    `totalIvaUtilidad_PT` DOUBLE NOT NULL DEFAULT 0,
    `totalPC` DOUBLE NOT NULL DEFAULT 0,
    `totalPT` DOUBLE NOT NULL DEFAULT 0,
    `projectId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Budget_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetVersion` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `snapshotTotalPC` DOUBLE NOT NULL DEFAULT 0,
    `snapshotTotalPT` DOUBLE NOT NULL DEFAULT 0,
    `budgetId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetLayer` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `totalDirectCostPC` DOUBLE NOT NULL DEFAULT 0,
    `totalDirectCostPT` DOUBLE NOT NULL DEFAULT 0,
    `budgetId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `BudgetLayer_budgetId_code_key`(`budgetId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetItem` (
    `id` VARCHAR(191) NOT NULL,
    `itemNumber` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unitPricePC` DOUBLE NOT NULL,
    `unitPricePT` DOUBLE NOT NULL,
    `totalPC` DOUBLE NOT NULL,
    `totalPT` DOUBLE NOT NULL,
    `status` ENUM('GREEN', 'YELLOW', 'RED') NOT NULL DEFAULT 'GREEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `layerId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetItemAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `budgetItemId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `assignedById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BudgetItemAssignment_projectId_userId_idx`(`projectId`, `userId`),
    UNIQUE INDEX `BudgetItemAssignment_userId_budgetItemId_key`(`userId`, `budgetItemId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BudgetFile` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `sharepointPath` VARCHAR(191) NULL,
    `layerCode` VARCHAR(191) NULL,
    `itemsImported` INTEGER NOT NULL DEFAULT 0,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `projectId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorBudget` (
    `id` VARCHAR(191) NOT NULL,
    `versionNumber` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `aiuPercentage` DOUBLE NOT NULL DEFAULT 18,
    `adminPercentage` DOUBLE NOT NULL DEFAULT 8,
    `imprevistoPercentage` DOUBLE NOT NULL DEFAULT 5,
    `utilidadPercentage` DOUBLE NOT NULL DEFAULT 5,
    `ivaUtilityPercentage` DOUBLE NOT NULL DEFAULT 19,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `totalDirectCostPC` DOUBLE NOT NULL DEFAULT 0,
    `totalDirectCostPT` DOUBLE NOT NULL DEFAULT 0,
    `totalAIU_PC` DOUBLE NOT NULL DEFAULT 0,
    `totalAIU_PT` DOUBLE NOT NULL DEFAULT 0,
    `totalIvaUtilidad_PC` DOUBLE NOT NULL DEFAULT 0,
    `totalIvaUtilidad_PT` DOUBLE NOT NULL DEFAULT 0,
    `totalPC` DOUBLE NOT NULL DEFAULT 0,
    `totalPT` DOUBLE NOT NULL DEFAULT 0,
    `contractId` VARCHAR(191) NOT NULL,

    INDEX `ContractorBudget_contractId_idx`(`contractId`),
    INDEX `ContractorBudget_contractId_isActive_idx`(`contractId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorBudgetLayer` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `order` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `totalDirectCostPC` DOUBLE NOT NULL DEFAULT 0,
    `totalDirectCostPT` DOUBLE NOT NULL DEFAULT 0,
    `budgetId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `ContractorBudgetLayer_budgetId_code_key`(`budgetId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorBudgetItem` (
    `id` VARCHAR(191) NOT NULL,
    `itemNumber` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unitPricePC` DOUBLE NOT NULL,
    `unitPricePT` DOUBLE NOT NULL,
    `totalPC` DOUBLE NOT NULL,
    `totalPT` DOUBLE NOT NULL,
    `status` ENUM('GREEN', 'YELLOW', 'RED') NOT NULL DEFAULT 'GREEN',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `layerId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorDailyProgress` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `weather` VARCHAR(191) NULL,
    `temperature` DOUBLE NULL,
    `generalNotes` TEXT NULL,
    `personnelCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contractId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `ContractorDailyProgress_contractId_date_idx`(`contractId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractorProgressEntry` (
    `id` VARCHAR(191) NOT NULL,
    `quantityToday` DOUBLE NOT NULL,
    `notes` TEXT NULL,
    `exceedsQuantity` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `dailyProgressId` VARCHAR(191) NOT NULL,
    `budgetItemId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contract` (
    `id` VARCHAR(191) NOT NULL,
    `contractNumber` VARCHAR(191) NOT NULL,
    `contractType` ENUM('OBRA', 'SUMINISTRO', 'SERVICIOS', 'CONSULTORIA', 'MIXTO') NOT NULL DEFAULT 'OBRA',
    `paymentMethod` ENUM('POR_CORTES', 'ANTICIPO', 'PRECIO_GLOBAL', 'ADMINISTRACION') NOT NULL DEFAULT 'POR_CORTES',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `contractObject` TEXT NOT NULL,
    `contractValue` DOUBLE NOT NULL DEFAULT 0,
    `status` ENUM('DRAFT', 'ENABLED', 'SUSPENDED', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `observations` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractorId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Contract_contractNumber_key`(`contractNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ContractDocument` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `documentType` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentRequest` (
    `id` VARCHAR(191) NOT NULL,
    `paymentNumber` VARCHAR(191) NOT NULL,
    `concept` TEXT NOT NULL,
    `amount` DOUBLE NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'COP',
    `paymentType` ENUM('CORTE_OBRA', 'ANTICIPO', 'RETENCION', 'SUMINISTRO', 'SERVICIOS', 'HONORARIOS', 'OTROS') NOT NULL DEFAULT 'CORTE_OBRA',
    `priority` ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT') NOT NULL DEFAULT 'NORMAL',
    `status` ENUM('PENDING', 'APPROVED_LEVEL_1', 'APPROVED_LEVEL_2', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `beneficiaryName` VARCHAR(191) NULL,
    `beneficiaryNit` VARCHAR(191) NULL,
    `bankName` VARCHAR(191) NULL,
    `accountType` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `currentApprovalLevel` INTEGER NOT NULL DEFAULT 1,
    `requiredApprovalLevel` INTEGER NOT NULL DEFAULT 2,
    `dueDate` DATETIME(3) NULL,
    `paidAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `notes` TEXT NULL,
    `rejectionReason` TEXT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `contractorId` VARCHAR(191) NULL,
    `workCutId` VARCHAR(191) NULL,
    `contractId` VARCHAR(191) NULL,
    `createdById` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `PaymentRequest_paymentNumber_key`(`paymentNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentApproval` (
    `id` VARCHAR(191) NOT NULL,
    `level` INTEGER NOT NULL,
    `action` ENUM('APPROVED', 'REJECTED', 'RETURNED') NOT NULL,
    `comments` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentRequestId` VARCHAR(191) NOT NULL,
    `approverId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PaymentDocument` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `documentType` VARCHAR(191) NULL,
    `description` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `paymentRequestId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TaxConfig` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `rate` DOUBLE NOT NULL,
    `type` ENUM('IVA', 'RETENCION_FUENTE', 'RETENCION_IVA', 'RETENCION_ICA', 'ESTAMPILLAS', 'OTROS') NOT NULL,
    `appliesTo` ENUM('VENTAS', 'COMPRAS', 'AMBOS') NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `TaxConfig_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Employee` (
    `id` VARCHAR(191) NOT NULL,
    `employeeNumber` VARCHAR(191) NOT NULL,
    `position` VARCHAR(191) NOT NULL,
    `department` ENUM('GERENCIA', 'OPERACIONES', 'CONTABILIDAD', 'TESORERIA', 'HSEQ', 'COMERCIAL', 'ADMINISTRATIVO') NOT NULL DEFAULT 'OPERACIONES',
    `contractType` ENUM('INDEFINIDO', 'FIJO', 'OBRA_LABOR', 'PRESTACION', 'APRENDIZAJE') NOT NULL DEFAULT 'INDEFINIDO',
    `startDate` DATETIME(3) NOT NULL,
    `endDate` DATETIME(3) NULL,
    `salary` DOUBLE NULL,
    `legalBonus` DOUBLE NULL,
    `extraLegalBonus` DOUBLE NULL,
    `eps` VARCHAR(191) NULL,
    `pensionFund` VARCHAR(191) NULL,
    `arl` VARCHAR(191) NULL,
    `riskLevel` INTEGER NOT NULL DEFAULT 1,
    `bankName` VARCHAR(191) NULL,
    `accountType` VARCHAR(191) NULL,
    `accountNumber` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `userId` VARCHAR(191) NULL,

    UNIQUE INDEX `Employee_employeeNumber_key`(`employeeNumber`),
    UNIQUE INDEX `Employee_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmployeeDocument` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('CEDULA', 'CONTRATO', 'AFILIACION_EPS', 'AFILIACION_PENSION', 'AFILIACION_ARL', 'EXAMEN_INGRESO', 'EXAMEN_PERIODICO', 'CERTIFICACION_ALTURAS', 'LICENCIA_CONDUCIR', 'CURSO_SST', 'TITULO_PROFESIONAL', 'DIPLOMA', 'LIBRETA_MILITAR', 'CERTIFICADOS_EXPERIENCIA', 'OTROS') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `expirationDate` DATETIME(3) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `employeeId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailyProgress` (
    `id` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `weather` VARCHAR(191) NULL,
    `temperature` DOUBLE NULL,
    `generalNotes` TEXT NULL,
    `personnelCount` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,

    INDEX `DailyProgress_projectId_date_idx`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressEntry` (
    `id` VARCHAR(191) NOT NULL,
    `quantityToday` DOUBLE NOT NULL,
    `notes` TEXT NULL,
    `exceedsQuantity` BOOLEAN NOT NULL DEFAULT false,
    `status` VARCHAR(191) NOT NULL DEFAULT 'APPROVED',
    `approvedById` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `dailyProgressId` VARCHAR(191) NOT NULL,
    `budgetItemId` VARCHAR(191) NOT NULL,
    `contractorId` VARCHAR(191) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressEntryAudit` (
    `id` VARCHAR(191) NOT NULL,
    `progressEntryId` VARCHAR(191) NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `budgetItemId` VARCHAR(191) NOT NULL,
    `actorUserId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `oldQuantity` DOUBLE NULL,
    `newQuantity` DOUBLE NULL,
    `oldNotes` TEXT NULL,
    `newNotes` TEXT NULL,
    `oldStatus` VARCHAR(191) NULL,
    `newStatus` VARCHAR(191) NULL,
    `oldContractorId` VARCHAR(191) NULL,
    `newContractorId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ProgressEntryAudit_projectId_createdAt_idx`(`projectId`, `createdAt`),
    INDEX `ProgressEntryAudit_actorUserId_createdAt_idx`(`actorUserId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProgressPhoto` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `caption` VARCHAR(191) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `dailyProgressId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `id` VARCHAR(191) NOT NULL,
    `clientNumber` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NOT NULL,
    `nit` VARCHAR(191) NULL,
    `contactName` VARCHAR(191) NOT NULL,
    `contactPosition` VARCHAR(191) NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `sector` VARCHAR(191) NULL,
    `source` ENUM('REFERIDO', 'WEB', 'REDES_SOCIALES', 'FERIA', 'LLAMADA_FRIA', 'OTROS') NOT NULL DEFAULT 'REFERIDO',
    `status` ENUM('PROSPECT', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST') NOT NULL DEFAULT 'PROSPECT',
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Client_clientNumber_key`(`clientNumber`),
    UNIQUE INDEX `Client_nit_key`(`nit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Quotation` (
    `id` VARCHAR(191) NOT NULL,
    `quotationNumber` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `validUntil` DATETIME(3) NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DOUBLE NOT NULL DEFAULT 0,
    `discountPercent` DOUBLE NOT NULL DEFAULT 0,
    `discountAmount` DOUBLE NOT NULL DEFAULT 0,
    `ivaPercent` DOUBLE NOT NULL DEFAULT 19,
    `ivaAmount` DOUBLE NOT NULL DEFAULT 0,
    `total` DOUBLE NOT NULL DEFAULT 0,
    `paymentTerms` TEXT NULL,
    `deliveryTerms` TEXT NULL,
    `warranty` VARCHAR(191) NULL,
    `observations` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `respondedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `clientId` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NULL,

    UNIQUE INDEX `Quotation_quotationNumber_key`(`quotationNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuotationItem` (
    `id` VARCHAR(191) NOT NULL,
    `itemNumber` INTEGER NOT NULL,
    `description` TEXT NOT NULL,
    `unit` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unitPrice` DOUBLE NOT NULL,
    `totalPrice` DOUBLE NOT NULL,
    `notes` TEXT NULL,
    `quotationId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Supplier` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nit` VARCHAR(191) NOT NULL,
    `contact` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `status` ENUM('COMPLETE', 'INCOMPLETE', 'EXPIRED') NOT NULL DEFAULT 'INCOMPLETE',
    `category` ENUM('MATERIALES', 'FERRETERIA', 'ACABADOS', 'ELECTRICO', 'HIDRAULICO', 'MAQUINARIA', 'TRANSPORTE', 'OTROS') NOT NULL DEFAULT 'MATERIALES',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `department` VARCHAR(191) NULL,
    `postalCode` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `legalRepName` VARCHAR(191) NULL,
    `legalRepEmail` VARCHAR(191) NULL,
    `legalRepPhone` VARCHAR(191) NULL,
    `legalRepCedula` VARCHAR(191) NULL,
    `reportedIncome` DOUBLE NULL,
    `incomeYear` INTEGER NULL,
    `ref1Name` VARCHAR(191) NULL,
    `ref1Company` VARCHAR(191) NULL,
    `ref1Phone` VARCHAR(191) NULL,
    `ref1Email` VARCHAR(191) NULL,
    `ref2Name` VARCHAR(191) NULL,
    `ref2Company` VARCHAR(191) NULL,
    `ref2Phone` VARCHAR(191) NULL,
    `ref2Email` VARCHAR(191) NULL,
    `ref3Name` VARCHAR(191) NULL,
    `ref3Company` VARCHAR(191) NULL,
    `ref3Phone` VARCHAR(191) NULL,
    `ref3Email` VARCHAR(191) NULL,
    `paymentTerms` VARCHAR(191) NULL,
    `deliveryTerms` VARCHAR(191) NULL,
    `minOrderValue` DOUBLE NULL,

    UNIQUE INDEX `Supplier_nit_key`(`nit`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SupplierDocument` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('CEDULA', 'RUT', 'CAMARA_COMERCIO', 'CERTIFICADO_BANCARIO') NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `cloudStoragePath` VARCHAR(191) NOT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `expirationDate` DATETIME(3) NULL,
    `uploadedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sharepointPath` VARCHAR(191) NULL,
    `supplierId` VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


-- =============================================
-- SOURCE: migrations/add_access_control_roles.sql
-- =============================================

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

-- =============================================
-- SOURCE: migrations/add_access_control_db_objects.sql
-- =============================================

-- =============================================
-- ACCESS CONTROL DB OBJECTS
-- Views + Procedures + Triggers para RBAC
-- =============================================

CREATE TABLE IF NOT EXISTS `AccessControlAudit` (
  `id` VARCHAR(191) NOT NULL,
  `entity` VARCHAR(50) NOT NULL,
  `entityId` VARCHAR(191) NOT NULL,
  `action` VARCHAR(30) NOT NULL,
  `details` JSON NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `AccessControlAudit_entity_idx` (`entity`, `entityId`),
  KEY `AccessControlAudit_createdAt_idx` (`createdAt`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE OR REPLACE VIEW `v_access_role_summary` AS
SELECT
  ar.id,
  ar.name,
  ar.description,
  ar.isActive,
  ar.isSystem,
  ar.createdAt,
  ar.updatedAt,
  COUNT(uar.userId) AS usersCount
FROM AccessRole ar
LEFT JOIN UserAccessRole uar ON uar.accessRoleId = ar.id
GROUP BY ar.id, ar.name, ar.description, ar.isActive, ar.isSystem, ar.createdAt, ar.updatedAt;

CREATE OR REPLACE VIEW `v_user_access_profile` AS
SELECT
  u.id AS userId,
  u.name AS userName,
  u.email,
  u.role AS legacyRole,
  u.isActive AS userActive,
  uar.id AS assignmentId,
  uar.assignedAt,
  uar.assignedById,
  ar.id AS accessRoleId,
  ar.name AS accessRoleName,
  ar.description AS accessRoleDescription,
  ar.isActive AS accessRoleActive,
  ar.isSystem AS accessRoleSystem
FROM User u
LEFT JOIN UserAccessRole uar ON uar.userId = u.id
LEFT JOIN AccessRole ar ON ar.id = uar.accessRoleId;

DROP PROCEDURE IF EXISTS sp_assign_user_access_role;

DELIMITER $$
CREATE PROCEDURE sp_assign_user_access_role(
  IN p_user_id VARCHAR(191),
  IN p_access_role_id VARCHAR(191),
  IN p_assigned_by_id VARCHAR(191)
)
BEGIN
  DECLARE v_user_exists INT DEFAULT 0;
  DECLARE v_role_exists INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;

  SELECT COUNT(*) INTO v_user_exists
  FROM User
  WHERE id = p_user_id;

  IF v_user_exists = 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Usuario no encontrado';
  END IF;

  DELETE FROM UserAccessRole
  WHERE userId = p_user_id;

  IF p_access_role_id IS NOT NULL AND p_access_role_id != '' THEN
    SELECT COUNT(*) INTO v_role_exists
    FROM AccessRole
    WHERE id = p_access_role_id AND isActive = 1;

    IF v_role_exists = 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Rol de acceso no valido';
    END IF;

    INSERT INTO UserAccessRole (id, userId, accessRoleId, assignedAt, assignedById)
    VALUES (CONCAT('uar_', REPLACE(UUID(), '-', '')), p_user_id, p_access_role_id, NOW(3), p_assigned_by_id);
  END IF;

  COMMIT;
END$$
DELIMITER ;

DROP TRIGGER IF EXISTS tr_user_access_role_audit_insert;
DROP TRIGGER IF EXISTS tr_user_access_role_audit_delete;
DROP TRIGGER IF EXISTS tr_menu_permission_audit_update;

DELIMITER $$
CREATE TRIGGER tr_user_access_role_audit_insert
AFTER INSERT ON UserAccessRole
FOR EACH ROW
BEGIN
  INSERT INTO AccessControlAudit (id, entity, entityId, action, details)
  VALUES (
    CONCAT('aca_', REPLACE(UUID(), '-', '')),
    'UserAccessRole',
    NEW.userId,
    'ASSIGNED',
    JSON_OBJECT('accessRoleId', NEW.accessRoleId, 'assignedById', NEW.assignedById)
  );
END$$

CREATE TRIGGER tr_user_access_role_audit_delete
AFTER DELETE ON UserAccessRole
FOR EACH ROW
BEGIN
  INSERT INTO AccessControlAudit (id, entity, entityId, action, details)
  VALUES (
    CONCAT('aca_', REPLACE(UUID(), '-', '')),
    'UserAccessRole',
    OLD.userId,
    'UNASSIGNED',
    JSON_OBJECT('accessRoleId', OLD.accessRoleId, 'assignedById', OLD.assignedById)
  );
END$$

CREATE TRIGGER tr_menu_permission_audit_update
AFTER UPDATE ON MenuPermission
FOR EACH ROW
BEGIN
  IF OLD.allowed <> NEW.allowed THEN
    INSERT INTO AccessControlAudit (id, entity, entityId, action, details)
    VALUES (
      CONCAT('aca_', REPLACE(UUID(), '-', '')),
      'MenuPermission',
      NEW.accessRoleId,
      'PERMISSION_CHANGED',
      JSON_OBJECT('menuKey', NEW.menuKey, 'oldAllowed', OLD.allowed, 'newAllowed', NEW.allowed)
    );
  END IF;
END$$
DELIMITER ;

-- =============================================
-- SOURCE: ../database/mysql/functions.sql
-- =============================================

-- =============================================
-- CONTROL DE OBRA - MySQL Functions
-- =============================================
-- Ejecutar despuÃ©s de crear las tablas (Prisma migrate)
-- Requiere MySQL 8.0+

USE control_obra_db;

-- =============================================
-- fn_format_cop: Formatea un nÃºmero como pesos colombianos
-- Ejemplo: fn_format_cop(1500000) => '$ 1.500.000'
-- =============================================
DROP FUNCTION IF EXISTS fn_format_cop;

DELIMITER $$
CREATE FUNCTION fn_format_cop(p_amount DECIMAL(20,2))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    DECLARE v_int_part BIGINT;
    DECLARE v_formatted VARCHAR(50);
    DECLARE v_length INT;
    DECLARE v_pos INT;
    DECLARE v_result VARCHAR(50) DEFAULT '';
    DECLARE v_digit CHAR(1);

    SET v_int_part = FLOOR(p_amount);
    SET v_formatted = CAST(v_int_part AS CHAR);
    SET v_length = LENGTH(v_formatted);
    SET v_pos = 1;

    WHILE v_pos <= v_length DO
        SET v_digit = SUBSTRING(v_formatted, v_pos, 1);
        IF v_pos > 1 AND MOD(v_length - v_pos + 1, 3) = 0 THEN
            SET v_result = CONCAT(v_result, '.');
        END IF;
        SET v_result = CONCAT(v_result, v_digit);
        SET v_pos = v_pos + 1;
    END WHILE;

    RETURN CONCAT('$ ', v_result);
END$$
DELIMITER ;


-- =============================================
-- fn_days_until: DÃ­as hasta una fecha (negativo si ya pasÃ³)
-- Ejemplo: fn_days_until('2026-12-31') => 248
-- =============================================
DROP FUNCTION IF EXISTS fn_days_until;

DELIMITER $$
CREATE FUNCTION fn_days_until(p_date DATE)
RETURNS INT
DETERMINISTIC
BEGIN
    RETURN DATEDIFF(p_date, CURDATE());
END$$
DELIMITER ;


-- =============================================
-- fn_doc_expired: 1 si el documento estÃ¡ vencido, 0 si estÃ¡ vigente
-- Ejemplo: fn_doc_expired('2025-01-01') => 1
-- =============================================
DROP FUNCTION IF EXISTS fn_doc_expired;

DELIMITER $$
CREATE FUNCTION fn_doc_expired(p_expiration_date DATE)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF p_expiration_date IS NULL THEN
        RETURN 0;
    END IF;
    RETURN IF(p_expiration_date < CURDATE(), 1, 0);
END$$
DELIMITER ;


-- =============================================
-- fn_doc_expires_soon: 1 si vence en los prÃ³ximos N dÃ­as
-- Ejemplo: fn_doc_expires_soon('2026-05-15', 30) => 1
-- =============================================
DROP FUNCTION IF EXISTS fn_doc_expires_soon;

DELIMITER $$
CREATE FUNCTION fn_doc_expires_soon(p_expiration_date DATE, p_days INT)
RETURNS TINYINT
DETERMINISTIC
BEGIN
    IF p_expiration_date IS NULL THEN
        RETURN 0;
    END IF;
    RETURN IF(
        p_expiration_date >= CURDATE() AND p_expiration_date <= DATE_ADD(CURDATE(), INTERVAL p_days DAY),
        1, 0
    );
END$$
DELIMITER ;


-- =============================================
-- fn_calc_aiu: Calcula el total de AIU sobre un costo directo
-- ParÃ¡metros: costo directo, % admin, % imprevistos, % utilidad, % IVA sobre utilidad
-- Retorna: monto total de AIU (sin incluir el costo directo)
-- =============================================
DROP FUNCTION IF EXISTS fn_calc_aiu;

DELIMITER $$
CREATE FUNCTION fn_calc_aiu(
    p_direct_cost     DECIMAL(20,2),
    p_admin_pct       DECIMAL(5,2),
    p_imprev_pct      DECIMAL(5,2),
    p_utilidad_pct    DECIMAL(5,2),
    p_iva_utilidad_pct DECIMAL(5,2)
)
RETURNS DECIMAL(20,2)
DETERMINISTIC
BEGIN
    DECLARE v_admin       DECIMAL(20,2);
    DECLARE v_imprev      DECIMAL(20,2);
    DECLARE v_utilidad    DECIMAL(20,2);
    DECLARE v_iva_util    DECIMAL(20,2);

    SET v_admin    = p_direct_cost * (p_admin_pct / 100);
    SET v_imprev   = p_direct_cost * (p_imprev_pct / 100);
    SET v_utilidad = p_direct_cost * (p_utilidad_pct / 100);
    SET v_iva_util = v_utilidad * (p_iva_utilidad_pct / 100);

    RETURN v_admin + v_imprev + v_utilidad + v_iva_util;
END$$
DELIMITER ;


-- =============================================
-- fn_payment_status_label: Etiqueta en espaÃ±ol para estado de pago
-- =============================================
DROP FUNCTION IF EXISTS fn_payment_status_label;

DELIMITER $$
CREATE FUNCTION fn_payment_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'PENDING'          THEN 'Pendiente'
        WHEN 'APPROVED_LEVEL_1' THEN 'Aprobado por Director'
        WHEN 'APPROVED_LEVEL_2' THEN 'Aprobado por Gerencia'
        WHEN 'APPROVED'         THEN 'Completamente Aprobado'
        WHEN 'REJECTED'         THEN 'Rechazado'
        WHEN 'PAID'             THEN 'Pagado'
        WHEN 'CANCELLED'        THEN 'Cancelado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_project_status_label: Etiqueta en espaÃ±ol para estado de proyecto
-- =============================================
DROP FUNCTION IF EXISTS fn_project_status_label;

DELIMITER $$
CREATE FUNCTION fn_project_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'IN_PLANNING'  THEN 'En PlaneaciÃ³n'
        WHEN 'IN_EXECUTION' THEN 'En EjecuciÃ³n'
        WHEN 'PAUSED'       THEN 'Pausado'
        WHEN 'COMPLETED'    THEN 'Completado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_work_cut_status_label: Etiqueta para estado de corte
-- =============================================
DROP FUNCTION IF EXISTS fn_work_cut_status_label;

DELIMITER $$
CREATE FUNCTION fn_work_cut_status_label(p_status VARCHAR(30))
RETURNS VARCHAR(50)
DETERMINISTIC
BEGIN
    RETURN CASE p_status
        WHEN 'PENDING'   THEN 'Pendiente'
        WHEN 'IN_REVIEW' THEN 'En RevisiÃ³n'
        WHEN 'APPROVED'  THEN 'Aprobado'
        WHEN 'REJECTED'  THEN 'Rechazado'
        ELSE p_status
    END;
END$$
DELIMITER ;


-- =============================================
-- fn_budget_item_status: Estado de rentabilidad de un Ã­tem
-- GREEN=rentable, YELLOW=riesgo leve, RED=pÃ©rdida
-- =============================================
DROP FUNCTION IF EXISTS fn_budget_item_status;

DELIMITER $$
CREATE FUNCTION fn_budget_item_status(p_pc DECIMAL(20,2), p_pt DECIMAL(20,2))
RETURNS VARCHAR(10)
DETERMINISTIC
BEGIN
    DECLARE v_diff_pct DECIMAL(5,2);
    IF p_pt = 0 THEN RETURN 'GREEN'; END IF;
    SET v_diff_pct = ((p_pt - p_pc) / p_pt) * 100;
    RETURN CASE
        WHEN p_pc >= p_pt       THEN 'GREEN'
        WHEN v_diff_pct < 10    THEN 'YELLOW'
        ELSE                         'RED'
    END;
END$$
DELIMITER ;

-- =============================================
-- SOURCE: ../database/mysql/triggers.sql
-- =============================================

-- =============================================
-- CONTROL DE OBRA - MySQL Triggers
-- =============================================
-- Ejecutar despuÃ©s de crear las tablas y funciones
-- Los triggers mantienen consistencia de datos calculados

USE control_obra_db;


-- =============================================
-- TRIGGERS: BudgetItem â†’ actualiza totales de BudgetLayer
-- =============================================

DROP TRIGGER IF EXISTS tr_budget_item_after_insert;
DROP TRIGGER IF EXISTS tr_budget_item_after_update;
DROP TRIGGER IF EXISTS tr_budget_item_after_delete;

DELIMITER $$

-- DespuÃ©s de insertar un Ã­tem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_insert
AFTER INSERT ON BudgetItem
FOR EACH ROW
BEGIN
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        updatedAt = NOW()
    WHERE id = NEW.layerId;
END$$


-- DespuÃ©s de actualizar un Ã­tem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_update
AFTER UPDATE ON BudgetItem
FOR EACH ROW
BEGIN
    -- Actualizar la capa afectada (puede haber cambiado de capa)
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = NEW.layerId),
        updatedAt = NOW()
    WHERE id = NEW.layerId;

    -- Si cambiÃ³ de capa, actualizar la capa anterior tambiÃ©n
    IF OLD.layerId != NEW.layerId THEN
        UPDATE BudgetLayer
        SET
            totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
            totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
            updatedAt = NOW()
        WHERE id = OLD.layerId;
    END IF;
END$$


-- DespuÃ©s de eliminar un Ã­tem: actualiza totales de la capa
CREATE TRIGGER tr_budget_item_after_delete
AFTER DELETE ON BudgetItem
FOR EACH ROW
BEGIN
    UPDATE BudgetLayer
    SET
        totalDirectCostPC = (SELECT COALESCE(SUM(totalPC), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
        totalDirectCostPT = (SELECT COALESCE(SUM(totalPT), 0) FROM BudgetItem WHERE layerId = OLD.layerId),
        updatedAt = NOW()
    WHERE id = OLD.layerId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: BudgetLayer â†’ actualiza totales de Budget
-- =============================================

DROP TRIGGER IF EXISTS tr_budget_layer_after_update;

DELIMITER $$

-- DespuÃ©s de actualizar una capa: recalcula totales del presupuesto
CREATE TRIGGER tr_budget_layer_after_update
AFTER UPDATE ON BudgetLayer
FOR EACH ROW
BEGIN
    DECLARE v_total_pc         DECIMAL(20,2);
    DECLARE v_total_pt         DECIMAL(20,2);
    DECLARE v_aiu_pc           DECIMAL(20,2);
    DECLARE v_aiu_pt           DECIMAL(20,2);
    DECLARE v_iva_pc           DECIMAL(20,2);
    DECLARE v_iva_pt           DECIMAL(20,2);
    DECLARE v_admin_pct        DECIMAL(5,2);
    DECLARE v_imprev_pct       DECIMAL(5,2);
    DECLARE v_util_pct         DECIMAL(5,2);
    DECLARE v_iva_util_pct     DECIMAL(5,2);

    -- Obtener porcentajes del presupuesto
    SELECT adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage
    INTO v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct
    FROM Budget WHERE id = NEW.budgetId;

    -- Sumar costos directos de todas las capas
    SELECT
        COALESCE(SUM(totalDirectCostPC), 0),
        COALESCE(SUM(totalDirectCostPT), 0)
    INTO v_total_pc, v_total_pt
    FROM BudgetLayer WHERE budgetId = NEW.budgetId;

    -- Calcular AIU
    SET v_aiu_pc = fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct);
    SET v_aiu_pt = fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct);

    -- IVA sobre utilidad
    SET v_iva_pc = v_total_pc * (v_util_pct / 100) * (v_iva_util_pct / 100);
    SET v_iva_pt = v_total_pt * (v_util_pct / 100) * (v_iva_util_pct / 100);

    -- Actualizar totales del presupuesto
    UPDATE Budget SET
        totalDirectCostPC   = v_total_pc,
        totalDirectCostPT   = v_total_pt,
        totalAIU_PC         = v_aiu_pc,
        totalAIU_PT         = v_aiu_pt,
        totalIvaUtilidad_PC = v_iva_pc,
        totalIvaUtilidad_PT = v_iva_pt,
        totalPC             = v_total_pc + v_aiu_pc,
        totalPT             = v_total_pt + v_aiu_pt,
        updatedAt           = NOW()
    WHERE id = NEW.budgetId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: PaymentApproval â†’ actualiza estado de PaymentRequest
-- =============================================

DROP TRIGGER IF EXISTS tr_payment_approval_after_insert;

DELIMITER $$

CREATE TRIGGER tr_payment_approval_after_insert
AFTER INSERT ON PaymentApproval
FOR EACH ROW
BEGIN
    DECLARE v_required_level  INT;
    DECLARE v_current_status  VARCHAR(30);

    SELECT requiredApprovalLevel, status
    INTO v_required_level, v_current_status
    FROM PaymentRequest WHERE id = NEW.paymentRequestId;

    IF NEW.action = 'REJECTED' THEN
        UPDATE PaymentRequest SET
            status = 'REJECTED',
            rejectionReason = NEW.comments,
            updatedAt = NOW()
        WHERE id = NEW.paymentRequestId;

    ELSEIF NEW.action = 'APPROVED' THEN
        IF NEW.level = 1 AND v_required_level >= 2 THEN
            UPDATE PaymentRequest SET
                status = 'APPROVED_LEVEL_1',
                currentApprovalLevel = 2,
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        ELSEIF NEW.level = 2 AND v_required_level >= 3 THEN
            UPDATE PaymentRequest SET
                status = 'APPROVED_LEVEL_2',
                currentApprovalLevel = 3,
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        ELSE
            UPDATE PaymentRequest SET
                status = 'APPROVED',
                updatedAt = NOW()
            WHERE id = NEW.paymentRequestId;
        END IF;
    END IF;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: WorkCut â†’ actualiza status de Contractor
-- =============================================

DROP TRIGGER IF EXISTS tr_work_cut_after_update;

DELIMITER $$

-- Cuando se aprueba un corte, verificar si el subcontratista tiene todos los docs
CREATE TRIGGER tr_work_cut_after_update
AFTER UPDATE ON WorkCut
FOR EACH ROW
BEGIN
    DECLARE v_required_docs  INT DEFAULT 4;  -- CEDULA, RUT, CAMARA_COMERCIO, CERTIFICADO_BANCARIO
    DECLARE v_docs_count     INT;

    IF NEW.status = 'APPROVED' AND OLD.status != 'APPROVED' THEN
        -- Contar documentos vigentes del subcontratista
        SELECT COUNT(DISTINCT type) INTO v_docs_count
        FROM Document
        WHERE contractorId = NEW.contractorId
            AND (expirationDate IS NULL OR expirationDate >= CURDATE());

        -- Actualizar status del subcontratista
        UPDATE Contractor SET
            status = IF(v_docs_count >= v_required_docs, 'COMPLETE', 'INCOMPLETE'),
            updatedAt = NOW()
        WHERE id = NEW.contractorId;
    END IF;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: Document â†’ actualiza status de Contractor automÃ¡ticamente
-- =============================================

DROP TRIGGER IF EXISTS tr_document_after_insert;
DROP TRIGGER IF EXISTS tr_document_after_delete;

DELIMITER $$

CREATE TRIGGER tr_document_after_insert
AFTER INSERT ON Document
FOR EACH ROW
BEGIN
    DECLARE v_docs_count INT;

    SELECT COUNT(DISTINCT type) INTO v_docs_count
    FROM Document
    WHERE contractorId = NEW.contractorId
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = IF(v_docs_count >= 4, 'COMPLETE', 'INCOMPLETE'),
        updatedAt = NOW()
    WHERE id = NEW.contractorId;
END$$


CREATE TRIGGER tr_document_after_delete
AFTER DELETE ON Document
FOR EACH ROW
BEGIN
    DECLARE v_docs_count INT;

    SELECT COUNT(DISTINCT type) INTO v_docs_count
    FROM Document
    WHERE contractorId = OLD.contractorId
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = IF(v_docs_count >= 4, 'COMPLETE', 'INCOMPLETE'),
        updatedAt = NOW()
    WHERE id = OLD.contractorId;
END$$

DELIMITER ;


-- =============================================
-- TRIGGERS: Audit Log para cambios crÃ­ticos
-- Requiere tabla AuditLog (no en el schema Prisma, creada aquÃ­)
-- =============================================

CREATE TABLE IF NOT EXISTS AuditLog (
    id          VARCHAR(25) NOT NULL PRIMARY KEY,
    tableName   VARCHAR(50) NOT NULL,
    recordId    VARCHAR(25) NOT NULL,
    action      ENUM('INSERT','UPDATE','DELETE') NOT NULL,
    changedField VARCHAR(100),
    oldValue    TEXT,
    newValue    TEXT,
    changedAt   DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_table_record (tableName, recordId),
    INDEX idx_audit_changed_at (changedAt)
);

DROP TRIGGER IF EXISTS tr_project_status_audit;

DELIMITER $$

-- Auditar cambios de estado en proyectos
CREATE TRIGGER tr_project_status_audit
AFTER UPDATE ON Project
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO AuditLog (id, tableName, recordId, action, changedField, oldValue, newValue)
        VALUES (
            CONCAT('aud_', UNIX_TIMESTAMP(NOW(6)), '_', FLOOR(RAND() * 10000)),
            'Project',
            NEW.id,
            'UPDATE',
            'status',
            OLD.status,
            NEW.status
        );
    END IF;
END$$

DELIMITER ;

DROP TRIGGER IF EXISTS tr_payment_status_audit;

DELIMITER $$

-- Auditar cambios de estado en pagos
CREATE TRIGGER tr_payment_status_audit
AFTER UPDATE ON PaymentRequest
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO AuditLog (id, tableName, recordId, action, changedField, oldValue, newValue)
        VALUES (
            CONCAT('aud_', UNIX_TIMESTAMP(NOW(6)), '_', FLOOR(RAND() * 10000)),
            'PaymentRequest',
            NEW.id,
            'UPDATE',
            'status',
            OLD.status,
            NEW.status
        );
    END IF;
END$$

DELIMITER ;

-- =============================================
-- SOURCE: ../database/mysql/procedures.sql
-- =============================================

-- =============================================
-- CONTROL DE OBRA - MySQL Stored Procedures
-- =============================================
-- Ejecutar despuÃ©s de triggers.sql

USE control_obra_db;


-- =============================================
-- sp_recalculate_budget
-- Recalcula todos los totales de un presupuesto en cascada
-- (layer totals â†’ budget totals con AIU)
-- =============================================
DROP PROCEDURE IF EXISTS sp_recalculate_budget;

DELIMITER $$
CREATE PROCEDURE sp_recalculate_budget(IN p_budget_id VARCHAR(25))
BEGIN
    DECLARE v_admin_pct    DECIMAL(5,2);
    DECLARE v_imprev_pct   DECIMAL(5,2);
    DECLARE v_util_pct     DECIMAL(5,2);
    DECLARE v_iva_util_pct DECIMAL(5,2);
    DECLARE v_total_pc     DECIMAL(20,2) DEFAULT 0;
    DECLARE v_total_pt     DECIMAL(20,2) DEFAULT 0;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    -- Obtener porcentajes del presupuesto
    SELECT adminPercentage, imprevistoPercentage, utilidadPercentage, ivaUtilityPercentage
    INTO v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct
    FROM Budget WHERE id = p_budget_id;

    -- 1. Actualizar totales de cada capa desde sus Ã­tems
    UPDATE BudgetLayer bl
    SET
        totalDirectCostPC = (
            SELECT COALESCE(SUM(totalPC), 0)
            FROM BudgetItem WHERE layerId = bl.id
        ),
        totalDirectCostPT = (
            SELECT COALESCE(SUM(totalPT), 0)
            FROM BudgetItem WHERE layerId = bl.id
        ),
        updatedAt = NOW()
    WHERE bl.budgetId = p_budget_id;

    -- 2. Sumar totales de capas para el presupuesto
    SELECT
        COALESCE(SUM(totalDirectCostPC), 0),
        COALESCE(SUM(totalDirectCostPT), 0)
    INTO v_total_pc, v_total_pt
    FROM BudgetLayer WHERE budgetId = p_budget_id;

    -- 3. Actualizar totales del presupuesto con AIU
    UPDATE Budget SET
        totalDirectCostPC   = v_total_pc,
        totalDirectCostPT   = v_total_pt,
        totalAIU_PC         = fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalAIU_PT         = fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalIvaUtilidad_PC = v_total_pc * (v_util_pct / 100) * (v_iva_util_pct / 100),
        totalIvaUtilidad_PT = v_total_pt * (v_util_pct / 100) * (v_iva_util_pct / 100),
        totalPC = v_total_pc + fn_calc_aiu(v_total_pc, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        totalPT = v_total_pt + fn_calc_aiu(v_total_pt, v_admin_pct, v_imprev_pct, v_util_pct, v_iva_util_pct),
        updatedAt = NOW()
    WHERE id = p_budget_id;

    -- 4. Actualizar status de cada Ã­tem (GREEN/YELLOW/RED)
    UPDATE BudgetItem bi
    JOIN BudgetLayer bl ON bl.id = bi.layerId
    SET bi.status = fn_budget_item_status(bi.totalPC, bi.totalPT),
        bi.updatedAt = NOW()
    WHERE bl.budgetId = p_budget_id;

    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_approve_payment
-- Procesa una aprobaciÃ³n de pago con control de niveles
-- OUT p_new_status: el nuevo estado del pago
-- =============================================
DROP PROCEDURE IF EXISTS sp_approve_payment;

DELIMITER $$
CREATE PROCEDURE sp_approve_payment(
    IN  p_payment_id   VARCHAR(25),
    IN  p_approver_id  VARCHAR(25),
    IN  p_level        INT,
    IN  p_comments     TEXT,
    OUT p_new_status   VARCHAR(30)
)
BEGIN
    DECLARE v_current_level   INT;
    DECLARE v_required_level  INT;
    DECLARE v_current_status  VARCHAR(30);
    DECLARE v_approval_id     VARCHAR(25);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT currentApprovalLevel, requiredApprovalLevel, status
    INTO v_current_level, v_required_level, v_current_status
    FROM PaymentRequest WHERE id = p_payment_id FOR UPDATE;

    -- Verificar que el pago estÃ¡ en estado correcto para aprobar
    IF v_current_status NOT IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El pago no estÃ¡ en un estado que permita aprobaciÃ³n';
    END IF;

    -- Verificar que el nivel de aprobaciÃ³n es correcto
    IF p_level != v_current_level THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El nivel de aprobaciÃ³n no corresponde al nivel actual del pago';
    END IF;

    -- Generar ID para la aprobaciÃ³n
    SET v_approval_id = CONCAT('apl_', UNIX_TIMESTAMP(NOW(6)));

    -- Registrar la aprobaciÃ³n
    INSERT INTO PaymentApproval (id, level, action, comments, paymentRequestId, approverId, createdAt)
    VALUES (v_approval_id, p_level, 'APPROVED', p_comments, p_payment_id, p_approver_id, NOW());

    -- El trigger tr_payment_approval_after_insert actualiza el status
    -- Leer el nuevo status actualizado por el trigger
    SELECT status INTO p_new_status FROM PaymentRequest WHERE id = p_payment_id;

    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_reject_payment
-- Rechaza un pago con razÃ³n de rechazo
-- =============================================
DROP PROCEDURE IF EXISTS sp_reject_payment;

DELIMITER $$
CREATE PROCEDURE sp_reject_payment(
    IN p_payment_id  VARCHAR(25),
    IN p_approver_id VARCHAR(25),
    IN p_level       INT,
    IN p_comments    TEXT
)
BEGIN
    DECLARE v_current_status VARCHAR(30);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;

    SELECT status INTO v_current_status
    FROM PaymentRequest WHERE id = p_payment_id FOR UPDATE;

    IF v_current_status NOT IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'El pago no estÃ¡ en un estado que permita rechazo';
    END IF;

    -- Registrar el rechazo
    INSERT INTO PaymentApproval (id, level, action, comments, paymentRequestId, approverId, createdAt)
    VALUES (CONCAT('apl_', UNIX_TIMESTAMP(NOW(6))), p_level, 'REJECTED', p_comments, p_payment_id, p_approver_id, NOW());

    -- El trigger tr_payment_approval_after_insert actualiza el status
    COMMIT;
END$$
DELIMITER ;


-- =============================================
-- sp_get_project_dashboard
-- Devuelve todos los datos del dashboard de un proyecto
-- (pagos, cortes, presupuesto, bitÃ¡cora reciente)
-- =============================================
DROP PROCEDURE IF EXISTS sp_get_project_dashboard;

DELIMITER $$
CREATE PROCEDURE sp_get_project_dashboard(IN p_project_id VARCHAR(25))
BEGIN
    -- Resumen del proyecto
    SELECT * FROM v_project_summary WHERE projectId = p_project_id;

    -- Resumen financiero
    SELECT * FROM v_financial_summary WHERE projectId = p_project_id;

    -- Ãšltimos 5 cortes
    SELECT * FROM v_work_cut_summary
    WHERE projectId = p_project_id
    ORDER BY createdAt DESC LIMIT 5;

    -- Ãšltimos 5 pagos
    SELECT * FROM v_payment_dashboard
    WHERE projectId = p_project_id
    ORDER BY createdAt DESC LIMIT 5;

    -- Presupuesto por capa
    SELECT
        layerCode,
        layerName,
        SUM(totalPC) AS totalPC,
        SUM(totalPT) AS totalPT,
        SUM(executedValuePC) AS executedPC,
        AVG(progressPct) AS avgProgressPct
    FROM v_budget_progress
    WHERE projectId = p_project_id
    GROUP BY layerCode, layerName
    ORDER BY layerCode;
END$$
DELIMITER ;


-- =============================================
-- sp_get_financial_report
-- Reporte financiero completo de un proyecto en un rango de fechas
-- =============================================
DROP PROCEDURE IF EXISTS sp_get_financial_report;

DELIMITER $$
CREATE PROCEDURE sp_get_financial_report(
    IN p_project_id VARCHAR(25),
    IN p_start_date DATE,
    IN p_end_date   DATE
)
BEGIN
    -- Resumen general
    SELECT
        fs.*,
        fn_format_cop(fs.totalPaid)    AS totalPaidFormatted,
        fn_format_cop(fs.totalPending) AS totalPendingFormatted,
        fn_format_cop(fs.budgetPC)     AS budgetFormatted
    FROM v_financial_summary fs
    WHERE fs.projectId = p_project_id;

    -- Pagos en el rango
    SELECT
        pd.paymentNumber,
        pd.concept,
        pd.amount,
        pd.amountFormatted,
        pd.paymentType,
        pd.statusLabel,
        pd.contractorName,
        pd.paidAt,
        pd.createdAt
    FROM v_payment_dashboard pd
    WHERE pd.projectId = p_project_id
        AND (
            (p_start_date IS NULL OR DATE(pd.createdAt) >= p_start_date)
            AND (p_end_date IS NULL OR DATE(pd.createdAt) <= p_end_date)
        )
    ORDER BY pd.createdAt DESC;

    -- Resumen por tipo de pago
    SELECT
        paymentType,
        COUNT(*) AS cantidad,
        SUM(amount) AS total,
        fn_format_cop(SUM(amount)) AS totalFormatted
    FROM PaymentRequest
    WHERE projectId = p_project_id
        AND status = 'PAID'
        AND (p_start_date IS NULL OR DATE(createdAt) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(createdAt) <= p_end_date)
    GROUP BY paymentType;

    -- Cortes aprobados en el rango
    SELECT
        wcs.cutNumber,
        wcs.periodStart,
        wcs.periodEnd,
        wcs.requestedAmountFormatted,
        wcs.contractorName,
        wcs.approvedAt,
        wcs.paymentStatusLabel
    FROM v_work_cut_summary wcs
    WHERE wcs.projectId = p_project_id
        AND wcs.statusLabel = 'Aprobado'
        AND (p_start_date IS NULL OR DATE(wcs.approvedAt) >= p_start_date)
        AND (p_end_date IS NULL OR DATE(wcs.approvedAt) <= p_end_date)
    ORDER BY wcs.approvedAt DESC;
END$$
DELIMITER ;


-- =============================================
-- sp_check_expiring_documents
-- Devuelve todos los documentos prÃ³ximos a vencer o vencidos
-- (para dashboard de alertas)
-- =============================================
DROP PROCEDURE IF EXISTS sp_check_expiring_documents;

DELIMITER $$
CREATE PROCEDURE sp_check_expiring_documents(IN p_days_warning INT)
BEGIN
    -- Documentos de subcontratistas
    SELECT
        'SUBCONTRATISTA'    AS entityType,
        c.id                AS entityId,
        c.name              AS entityName,
        d.type              AS docType,
        d.expirationDate,
        fn_days_until(DATE(d.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(d.expirationDate)) AS isExpired
    FROM Contractor c
    JOIN Document d ON d.contractorId = c.id
    WHERE d.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(d.expirationDate)) = 1
             OR fn_days_until(DATE(d.expirationDate)) <= IFNULL(p_days_warning, 30))

    UNION ALL

    -- Documentos de empleados
    SELECT
        'EMPLEADO'          AS entityType,
        e.id                AS entityId,
        COALESCE(u.name, e.employeeNumber) AS entityName,
        ed.type             AS docType,
        ed.expirationDate,
        fn_days_until(DATE(ed.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(ed.expirationDate)) AS isExpired
    FROM Employee e
    LEFT JOIN User u ON u.id = e.userId
    JOIN EmployeeDocument ed ON ed.employeeId = e.id
    WHERE ed.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(ed.expirationDate)) = 1
             OR fn_days_until(DATE(ed.expirationDate)) <= IFNULL(p_days_warning, 30))

    UNION ALL

    -- Documentos de proveedores
    SELECT
        'PROVEEDOR'         AS entityType,
        s.id                AS entityId,
        s.name              AS entityName,
        sd.type             AS docType,
        sd.expirationDate,
        fn_days_until(DATE(sd.expirationDate)) AS daysUntilExpiry,
        fn_doc_expired(DATE(sd.expirationDate)) AS isExpired
    FROM Supplier s
    JOIN SupplierDocument sd ON sd.supplierId = s.id
    WHERE sd.expirationDate IS NOT NULL
        AND (fn_doc_expired(DATE(sd.expirationDate)) = 1
             OR fn_days_until(DATE(sd.expirationDate)) <= IFNULL(p_days_warning, 30))

    ORDER BY daysUntilExpiry ASC;
END$$
DELIMITER ;


-- =============================================
-- sp_update_contractor_status
-- Recalcula y actualiza el status de un subcontratista
-- basado en sus documentos actuales
-- =============================================
DROP PROCEDURE IF EXISTS sp_update_contractor_status;

DELIMITER $$
CREATE PROCEDURE sp_update_contractor_status(IN p_contractor_id VARCHAR(25))
BEGIN
    DECLARE v_docs_count INT;
    DECLARE v_expired_count INT;

    SELECT
        COUNT(DISTINCT type),
        SUM(fn_doc_expired(DATE(expirationDate)))
    INTO v_docs_count, v_expired_count
    FROM Document
    WHERE contractorId = p_contractor_id
        AND (expirationDate IS NULL OR expirationDate >= CURDATE());

    UPDATE Contractor SET
        status = CASE
            WHEN v_expired_count > 0    THEN 'EXPIRED'
            WHEN v_docs_count >= 4      THEN 'COMPLETE'
            ELSE                             'INCOMPLETE'
        END,
        updatedAt = NOW()
    WHERE id = p_contractor_id;
END$$
DELIMITER ;

-- =============================================
-- SOURCE: ../database/mysql/views.sql
-- =============================================

-- =============================================
-- CONTROL DE OBRA - MySQL Views
-- =============================================
-- Requiere que las funciones de functions.sql estÃ©n creadas
-- Los nombres de tabla corresponden al mapeo de Prisma (PascalCase â†’ tabla)

USE control_obra_db;


-- =============================================
-- v_project_summary
-- Resumen de proyectos con presupuesto, pagos y subcontratistas
-- =============================================
CREATE OR REPLACE VIEW v_project_summary AS
SELECT
    p.id                                        AS projectId,
    p.code                                      AS projectCode,
    p.name                                      AS projectName,
    p.client,
    p.location,
    p.status,
    fn_project_status_label(p.status)           AS statusLabel,
    p.startDate,
    p.estimatedEndDate,
    p.totalBudget,
    fn_format_cop(p.totalBudget)                AS totalBudgetFormatted,
    fn_days_until(DATE(p.estimatedEndDate))     AS daysUntilEnd,
    -- Presupuesto
    COALESCE(b.totalPC, 0)                      AS budgetTotalPC,
    COALESCE(b.totalPT, 0)                      AS budgetTotalPT,
    COALESCE(b.totalDirectCostPC, 0)            AS budgetDirectCostPC,
    -- Pagos
    COALESCE(pag_stats.totalPaid, 0)            AS totalPaid,
    COALESCE(pag_stats.totalPending, 0)         AS totalPending,
    COALESCE(pag_stats.countPaid, 0)            AS paymentsCount,
    -- Cortes
    COALESCE(cut_stats.totalCuts, 0)            AS totalCuts,
    COALESCE(cut_stats.approvedCuts, 0)         AS approvedCuts,
    COALESCE(cut_stats.pendingCuts, 0)          AS pendingCuts,
    -- Subcontratistas
    COALESCE(cnt_stats.contractorCount, 0)      AS contractorCount,
    -- EjecuciÃ³n
    CASE
        WHEN COALESCE(b.totalPC, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(pag_stats.totalPaid, 0) / b.totalPC) * 100, 2)
    END                                         AS executionPct
FROM Project p
LEFT JOIN Budget b ON b.projectId = p.id
LEFT JOIN (
    SELECT
        projectId,
        SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END)     AS totalPaid,
        SUM(CASE WHEN status IN ('PENDING','APPROVED_LEVEL_1',
            'APPROVED_LEVEL_2','APPROVED') THEN amount ELSE 0 END) AS totalPending,
        COUNT(CASE WHEN status = 'PAID' THEN 1 END)                AS countPaid
    FROM PaymentRequest
    GROUP BY projectId
) pag_stats ON pag_stats.projectId = p.id
LEFT JOIN (
    SELECT
        projectId,
        COUNT(*) AS totalCuts,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approvedCuts,
        SUM(CASE WHEN status IN ('PENDING','IN_REVIEW') THEN 1 ELSE 0 END) AS pendingCuts
    FROM WorkCut
    GROUP BY projectId
) cut_stats ON cut_stats.projectId = p.id
LEFT JOIN (
    SELECT projectId, COUNT(DISTINCT contractorId) AS contractorCount
    FROM WorkCut
    GROUP BY projectId
) cnt_stats ON cnt_stats.projectId = p.id;


-- =============================================
-- v_budget_progress
-- Ãtems de presupuesto con avance acumulado y rentabilidad
-- =============================================
CREATE OR REPLACE VIEW v_budget_progress AS
SELECT
    bi.id                                       AS itemId,
    bi.itemNumber,
    bi.description                              AS itemDescription,
    bi.unit,
    bi.quantity                                 AS totalQuantity,
    bi.unitPricePC,
    bi.unitPricePT,
    bi.totalPC,
    bi.totalPT,
    bi.status                                   AS profitStatus,
    fn_budget_item_status(bi.totalPC, bi.totalPT) AS profitStatusCalc,
    -- Capa
    bl.code                                     AS layerCode,
    bl.name                                     AS layerName,
    -- Proyecto (a travÃ©s de la capa y presupuesto)
    b.projectId,
    -- Avance
    COALESCE(prog.executedQty, 0)              AS executedQuantity,
    CASE
        WHEN bi.quantity = 0 THEN 0
        ELSE ROUND((COALESCE(prog.executedQty, 0) / bi.quantity) * 100, 2)
    END                                         AS progressPct,
    COALESCE(prog.executedQty, 0) * bi.unitPricePC AS executedValuePC,
    COALESCE(prog.executedQty, 0) * bi.unitPricePT AS executedValuePT
FROM BudgetItem bi
JOIN BudgetLayer bl  ON bl.id = bi.layerId
JOIN Budget b        ON b.id  = bl.budgetId
LEFT JOIN (
    SELECT budgetItemId, SUM(quantityToday) AS executedQty
    FROM ProgressEntry
    WHERE status = 'APPROVED'
    GROUP BY budgetItemId
) prog ON prog.budgetItemId = bi.id;


-- =============================================
-- v_payment_dashboard
-- Pagos con informaciÃ³n completa para panel de control
-- =============================================
CREATE OR REPLACE VIEW v_payment_dashboard AS
SELECT
    pr.id                                       AS paymentId,
    pr.paymentNumber,
    pr.concept,
    pr.amount,
    fn_format_cop(pr.amount)                    AS amountFormatted,
    pr.currency,
    pr.paymentType,
    pr.priority,
    pr.status,
    fn_payment_status_label(pr.status)          AS statusLabel,
    pr.currentApprovalLevel,
    pr.requiredApprovalLevel,
    pr.dueDate,
    fn_days_until(DATE(pr.dueDate))             AS daysUntilDue,
    pr.paidAt,
    pr.createdAt,
    -- Proyecto
    p.id                                        AS projectId,
    p.name                                      AS projectName,
    p.code                                      AS projectCode,
    -- Subcontratista
    c.id                                        AS contractorId,
    c.name                                      AS contractorName,
    c.nit                                       AS contractorNit,
    -- Beneficiario alternativo
    pr.beneficiaryName,
    pr.beneficiaryNit,
    pr.bankName,
    pr.accountType,
    -- Creador
    u.name                                      AS createdByName,
    pr.createdById,
    -- Corte relacionado
    pr.workCutId,
    wc.cutNumber                                AS workCutNumber,
    -- Contrato relacionado
    pr.contractId,
    ct.contractNumber,
    -- Ãšltima aprobaciÃ³n
    last_ap.approverName                        AS lastApproverName,
    last_ap.approvedAt                          AS lastApprovalAt
FROM PaymentRequest pr
JOIN Project p ON p.id = pr.projectId
LEFT JOIN Contractor c ON c.id = pr.contractorId
LEFT JOIN User u ON u.id = pr.createdById
LEFT JOIN WorkCut wc ON wc.id = pr.workCutId
LEFT JOIN Contract ct ON ct.id = pr.contractId
LEFT JOIN (
    SELECT
        pa.paymentRequestId,
        u2.name AS approverName,
        pa.createdAt AS approvedAt,
        ROW_NUMBER() OVER (PARTITION BY pa.paymentRequestId ORDER BY pa.createdAt DESC) AS rn
    FROM PaymentApproval pa
    JOIN User u2 ON u2.id = pa.approverId
) last_ap ON last_ap.paymentRequestId = pr.id AND last_ap.rn = 1;


-- =============================================
-- v_contractor_doc_status
-- Subcontratistas con estado de documentaciÃ³n
-- =============================================
CREATE OR REPLACE VIEW v_contractor_doc_status AS
SELECT
    c.id                                        AS contractorId,
    c.name,
    c.nit,
    c.status,
    c.city,
    -- Documentos requeridos: CEDULA, RUT, CAMARA_COMERCIO, CERTIFICADO_BANCARIO
    MAX(CASE WHEN d.type = 'CEDULA' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCedula,
    MAX(CASE WHEN d.type = 'RUT' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)    AS hasRut,
    MAX(CASE WHEN d.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCamara,
    MAX(CASE WHEN d.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCertBancario,
    -- % de completitud (sobre 4 documentos requeridos)
    ROUND(
        (MAX(CASE WHEN d.type = 'CEDULA' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'RUT' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        + MAX(CASE WHEN d.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(d.expirationDate)) = 0 THEN 1 ELSE 0 END)
        ) / 4 * 100, 0
    )                                           AS docCompletePct,
    -- Documentos prÃ³ximos a vencer (30 dÃ­as)
    SUM(CASE WHEN d.expirationDate IS NOT NULL AND fn_doc_expires_soon(DATE(d.expirationDate), 30) = 1 THEN 1 ELSE 0 END) AS docExpiringSoon,
    -- Documentos vencidos
    SUM(CASE WHEN fn_doc_expired(DATE(d.expirationDate)) = 1 THEN 1 ELSE 0 END) AS docExpired,
    COUNT(d.id)                                 AS totalDocs
FROM Contractor c
LEFT JOIN Document d ON d.contractorId = c.id
GROUP BY c.id, c.name, c.nit, c.status, c.city;


-- =============================================
-- v_work_cut_summary
-- Cortes de obra con estado de pago asociado
-- =============================================
CREATE OR REPLACE VIEW v_work_cut_summary AS
SELECT
    wc.id                                       AS cutId,
    wc.cutNumber,
    wc.periodStart,
    wc.periodEnd,
    wc.requestedAmount,
    fn_format_cop(wc.requestedAmount)           AS requestedAmountFormatted,
    wc.status,
    fn_work_cut_status_label(wc.status)         AS statusLabel,
    wc.createdAt,
    wc.approvedAt,
    -- Proyecto
    p.id                                        AS projectId,
    p.name                                      AS projectName,
    p.code                                      AS projectCode,
    -- Subcontratista
    c.id                                        AS contractorId,
    c.name                                      AS contractorName,
    -- Centro de costo
    cc.name                                     AS costCenterName,
    -- Aprobador
    u.name                                      AS approvedByName,
    -- Pago relacionado
    pr.id                                       AS paymentRequestId,
    pr.paymentNumber,
    pr.status                                   AS paymentStatus,
    fn_payment_status_label(pr.status)          AS paymentStatusLabel,
    pr.amount                                   AS paymentAmount
FROM WorkCut wc
JOIN Project p    ON p.id  = wc.projectId
JOIN Contractor c ON c.id  = wc.contractorId
JOIN CostCenter cc ON cc.id = wc.costCenterId
LEFT JOIN User u  ON u.id  = wc.approvedById
LEFT JOIN PaymentRequest pr ON pr.workCutId = wc.id AND pr.status != 'CANCELLED';


-- =============================================
-- v_employee_doc_expiry
-- Empleados con documentos prÃ³ximos a vencer o vencidos
-- =============================================
CREATE OR REPLACE VIEW v_employee_doc_expiry AS
SELECT
    e.id                                        AS employeeId,
    e.employeeNumber,
    u.name                                      AS employeeName,
    u.email                                     AS employeeEmail,
    e.position,
    e.department,
    e.status                                    AS employeeStatus,
    ed.id                                       AS docId,
    ed.type                                     AS docType,
    ed.fileName,
    ed.expirationDate,
    fn_days_until(DATE(ed.expirationDate))      AS daysUntilExpiry,
    fn_doc_expired(DATE(ed.expirationDate))     AS isExpired,
    fn_doc_expires_soon(DATE(ed.expirationDate), 30) AS expiresSoon30,
    fn_doc_expires_soon(DATE(ed.expirationDate), 60) AS expiresSoon60
FROM Employee e
LEFT JOIN User u ON u.id = e.userId
JOIN EmployeeDocument ed ON ed.employeeId = e.id
WHERE ed.expirationDate IS NOT NULL
    AND (fn_doc_expired(DATE(ed.expirationDate)) = 1
         OR fn_doc_expires_soon(DATE(ed.expirationDate), 60) = 1);


-- =============================================
-- v_financial_summary
-- Resumen financiero por proyecto
-- =============================================
CREATE OR REPLACE VIEW v_financial_summary AS
SELECT
    p.id                                        AS projectId,
    p.code                                      AS projectCode,
    p.name                                      AS projectName,
    p.status,
    p.startDate,
    p.estimatedEndDate,
    -- Presupuesto
    COALESCE(b.totalPC, 0)                      AS budgetPC,
    COALESCE(b.totalPT, 0)                      AS budgetPT,
    COALESCE(b.totalDirectCostPC, 0)            AS directCostPC,
    COALESCE(b.totalAIU_PC, 0)                  AS aiuPC,
    COALESCE(b.totalIvaUtilidad_PC, 0)          AS ivaPC,
    -- Pagos por estado
    COALESCE(SUM(CASE WHEN pr.status = 'PAID' THEN pr.amount ELSE 0 END), 0) AS totalPaid,
    COALESCE(SUM(CASE WHEN pr.status = 'APPROVED' THEN pr.amount ELSE 0 END), 0) AS totalApproved,
    COALESCE(SUM(CASE WHEN pr.status IN ('PENDING','APPROVED_LEVEL_1','APPROVED_LEVEL_2') THEN pr.amount ELSE 0 END), 0) AS totalPending,
    COALESCE(SUM(CASE WHEN pr.status = 'REJECTED' THEN pr.amount ELSE 0 END), 0) AS totalRejected,
    -- Pagos por tipo
    COALESCE(SUM(CASE WHEN pr.paymentType = 'ANTICIPO' THEN pr.amount ELSE 0 END), 0) AS totalAnticipos,
    COALESCE(SUM(CASE WHEN pr.paymentType = 'CORTE_OBRA' THEN pr.amount ELSE 0 END), 0) AS totalCortes,
    COALESCE(SUM(CASE WHEN pr.paymentType = 'SUMINISTRO' THEN pr.amount ELSE 0 END), 0) AS totalSuministros,
    -- Saldo disponible
    COALESCE(b.totalPC, 0) - COALESCE(SUM(CASE WHEN pr.status IN ('PAID','APPROVED') THEN pr.amount ELSE 0 END), 0) AS saldoDisponible,
    -- % ejecuciÃ³n financiera
    CASE
        WHEN COALESCE(b.totalPC, 0) = 0 THEN 0
        ELSE ROUND(
            COALESCE(SUM(CASE WHEN pr.status = 'PAID' THEN pr.amount ELSE 0 END), 0)
            / b.totalPC * 100, 2
        )
    END AS executionPct
FROM Project p
LEFT JOIN Budget b ON b.projectId = p.id
LEFT JOIN PaymentRequest pr ON pr.projectId = p.id
GROUP BY p.id, p.code, p.name, p.status, p.startDate, p.estimatedEndDate,
         b.totalPC, b.totalPT, b.totalDirectCostPC, b.totalAIU_PC, b.totalIvaUtilidad_PC;


-- =============================================
-- v_quotation_pipeline
-- Pipeline de ventas con cotizaciones por estado
-- =============================================
CREATE OR REPLACE VIEW v_quotation_pipeline AS
SELECT
    q.id                                        AS quotationId,
    q.quotationNumber,
    q.title,
    q.status,
    q.validUntil,
    fn_days_until(DATE(q.validUntil))           AS daysUntilExpiry,
    q.subtotal,
    q.discountAmount,
    q.ivaAmount,
    q.total,
    fn_format_cop(q.total)                      AS totalFormatted,
    q.createdAt,
    q.sentAt,
    -- Cliente
    c.id                                        AS clientId,
    c.clientNumber,
    c.companyName                               AS clientName,
    c.contactName,
    c.email                                     AS clientEmail,
    c.city                                      AS clientCity,
    c.status                                    AS clientStatus,
    -- Items
    COALESCE(item_stats.itemCount, 0)           AS itemCount
FROM Quotation q
JOIN Client c ON c.id = q.clientId
LEFT JOIN (
    SELECT quotationId, COUNT(*) AS itemCount
    FROM QuotationItem
    GROUP BY quotationId
) item_stats ON item_stats.quotationId = q.id;


-- =============================================
-- v_supplier_doc_status
-- Proveedores con estado de documentaciÃ³n
-- =============================================
CREATE OR REPLACE VIEW v_supplier_doc_status AS
SELECT
    s.id                                        AS supplierId,
    s.name,
    s.nit,
    s.status,
    s.category,
    s.city,
    MAX(CASE WHEN sd.type = 'CEDULA' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCedula,
    MAX(CASE WHEN sd.type = 'RUT' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasRut,
    MAX(CASE WHEN sd.type = 'CAMARA_COMERCIO' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCamara,
    MAX(CASE WHEN sd.type = 'CERTIFICADO_BANCARIO' AND fn_doc_expired(DATE(sd.expirationDate)) = 0 THEN 1 ELSE 0 END) AS hasCertBancario,
    ROUND(
        (MAX(CASE WHEN sd.type = 'CEDULA' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'RUT' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'CAMARA_COMERCIO' THEN 1 ELSE 0 END)
        + MAX(CASE WHEN sd.type = 'CERTIFICADO_BANCARIO' THEN 1 ELSE 0 END)
        ) / 4 * 100, 0
    )                                           AS docCompletePct,
    COUNT(sd.id)                                AS totalDocs
FROM Supplier s
LEFT JOIN SupplierDocument sd ON sd.supplierId = s.id
GROUP BY s.id, s.name, s.nit, s.status, s.category, s.city;

SET FOREIGN_KEY_CHECKS = 1;
-- FIN DEL SCRIPT
