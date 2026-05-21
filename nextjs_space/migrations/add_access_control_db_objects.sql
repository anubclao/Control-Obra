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
