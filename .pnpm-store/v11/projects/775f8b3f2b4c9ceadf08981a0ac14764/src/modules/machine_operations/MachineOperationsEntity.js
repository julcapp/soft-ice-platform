const OPERATOR_ROLE = Object.freeze({ OPERATOR: 'OPERATOR', ADMIN: 'ADMIN' });
const OPERATOR_STATUS = Object.freeze({ ACTIVE: 'ACTIVE', SUSPENDED: 'SUSPENDED' });

const PERMISSION = Object.freeze({
  EXECUTE_MAINTENANCE: 'machine_operations:maintenance:execute',
  PERFORM_TEST_RUN: 'machine_operations:test_run:execute',
  RECORD_CONSUMPTION: 'machine_operations:inventory:consume',
  ATTACH_PHOTO_EVIDENCE: 'machine_operations:photo_evidence:create',
  SUBMIT_SERVICE_REPORT: 'machine_operations:service_report:submit',
  VIEW_ALL_ACTIONS: 'machine_operations:actions:read_all',
  APPROVE_SERVICE_REPORT: 'machine_operations:service_report:approve',
  CONFIGURE_CHECKLIST: 'machine_operations:checklist:configure',
  MANAGE_MACHINE_SETTINGS: 'machine_operations:machine_settings:manage',
});

const OPERATOR_PERMISSIONS = Object.freeze([
  PERMISSION.EXECUTE_MAINTENANCE,
  PERMISSION.PERFORM_TEST_RUN,
  PERMISSION.RECORD_CONSUMPTION,
  PERMISSION.ATTACH_PHOTO_EVIDENCE,
  PERMISSION.SUBMIT_SERVICE_REPORT,
]);

const ADMIN_PERMISSIONS = Object.freeze([...OPERATOR_PERMISSIONS,
  PERMISSION.VIEW_ALL_ACTIONS,
  PERMISSION.APPROVE_SERVICE_REPORT,
  PERMISSION.CONFIGURE_CHECKLIST,
  PERMISSION.MANAGE_MACHINE_SETTINGS,
]);

const EXPLICITLY_DENIED_OPERATOR_PERMISSIONS = Object.freeze([
  'pricing:change',
  'commercial_settings:change',
  'loyalty_settings:change',
]);

const INVENTORY_ITEM_TYPE = Object.freeze({ CUP: 'CUP', ICE_CREAM_MIX: 'ICE_CREAM_MIX', TOPPING: 'TOPPING' });
const REQUIRED_TEST_RUN_ITEMS = Object.freeze(Object.values(INVENTORY_ITEM_TYPE));

class Operator {
  constructor(record) {
    Object.assign(this, record);
    this.role = String(record.role || OPERATOR_ROLE.OPERATOR).toUpperCase();
    this.status = String(record.status || OPERATOR_STATUS.ACTIVE).toUpperCase();
    this.permissions = (record.permissions || []).map((entry) => entry.permission || entry);
  }

  hasPermission(permission) {
    if (this.status !== OPERATOR_STATUS.ACTIVE || EXPLICITLY_DENIED_OPERATOR_PERMISSIONS.includes(permission)) return false;
    if (ADMIN_PERMISSIONS.includes(permission) && !OPERATOR_PERMISSIONS.includes(permission) && this.role !== OPERATOR_ROLE.ADMIN) return false;
    const rolePermissions = this.role === OPERATOR_ROLE.ADMIN ? ADMIN_PERMISSIONS : OPERATOR_PERMISSIONS;
    return rolePermissions.includes(permission) || this.permissions.includes(permission);
  }
}

module.exports = {
  ADMIN_PERMISSIONS,
  EXPLICITLY_DENIED_OPERATOR_PERMISSIONS,
  INVENTORY_ITEM_TYPE,
  OPERATOR_PERMISSIONS,
  OPERATOR_ROLE,
  OPERATOR_STATUS,
  Operator,
  PERMISSION,
  REQUIRED_TEST_RUN_ITEMS,
};
