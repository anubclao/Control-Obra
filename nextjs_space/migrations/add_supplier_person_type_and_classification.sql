-- =============================================
-- SUPPLIER PERSON TYPE + COMMERCIAL CLASSIFICATION
-- Agrega tipo de persona, contactos secundarios y clasificación comercial
-- =============================================

ALTER TABLE `Supplier`
  ADD COLUMN `personType` VARCHAR(20) NOT NULL DEFAULT 'JURIDICA' AFTER `phone`,
  ADD COLUMN `secondaryEmail` VARCHAR(191) NULL AFTER `website`,
  ADD COLUMN `secondaryPhone` VARCHAR(50) NULL AFTER `secondaryEmail`,
  ADD COLUMN `commercialType` VARCHAR(20) NULL AFTER `secondaryPhone`,
  ADD COLUMN `commercialSubcategory` VARCHAR(100) NULL AFTER `commercialType`;