/**
 * HARZ Cloud — Row-Level Security (RLS)
 * 
 * Enforces per-user data isolation:
 * - Users can only see records they created
 * - Admins and Owners see all records
 * - Agents work across all records (no RLS)
 * - Public entities are readable by everyone
 */

const { isRLSEnforced, isPublicEntity, isAdminEntity, ROLES } = require('./rbac');

/**
 * Filter records based on RLS policy
 * @param {Array} records - Records to filter
 * @param {Object} user - { id, email, role }
 * @param {String} entity - Entity name
 * @param {String} action - 'read', 'update', 'delete'
 * @returns {Array} Filtered records
 */
function enforceRLS(records, user, entity, action) {
  // No user = no access (unless public entity for read)
  if (!user) {
    if (action === 'read' && isPublicEntity(entity)) {
      return records;
    }
    return [];
  }

  const { role, email, id } = user;

  // Owner and Admin see everything
  if (role === 'owner' || role === 'admin') {
    return records;
  }

  // Agents see all records (they work across the system)
  if (role === 'agent') {
    return records;
  }

  // Managers see all records for read, but only their own for write
  if (role === 'manager') {
    if (action === 'read') {
      return records;
    }
    // For write operations, managers can modify any record
    // in entities they have permission for
    return records;
  }

  // Public entities are readable by everyone
  if (action === 'read' && isPublicEntity(entity)) {
    return records;
  }

  // For users with RLS enforced — filter by created_by
  if (isRLSEnforced(role)) {
    return records.filter(record => {
      // User can see their own records
      if (record.created_by === email) return true;
      if (record.created_by === id) return true;
      
      // User can see records where they are the subject
      if (record.user_email === email) return true;
      if (record.customer_email === email) return true;
      if (record.buyer_email === email) return true;
      if (record.student_email === email) return true;
      if (record.seller_email === email) return true;
      
      // User can see records they own
      if (record.owner_email === email) return true;
      
      return false;
    });
  }

  // Default: no access
  return [];
}

/**
 * Check if user can perform action on a specific record
 * @param {Object} record - The record to check
 * @param {Object} user - { id, email, role }
 * @param {String} entity - Entity name
 * @param {String} action - 'read', 'update', 'delete'
 * @returns {Boolean}
 */
function canAccessRecord(record, user, entity, action) {
  if (!user) {
    return action === 'read' && isPublicEntity(entity);
  }

  const { role, email, id } = user;

  if (role === 'owner' || role === 'admin') return true;
  if (role === 'agent') return true;
  if (role === 'manager') return true;

  if (action === 'read' && isPublicEntity(entity)) return true;

  if (isRLSEnforced(role)) {
    return (
      record.created_by === email ||
      record.created_by === id ||
      record.user_email === email ||
      record.customer_email === email ||
      record.buyer_email === email ||
      record.student_email === email ||
      record.owner_email === email
    );
  }

  return false;
}

/**
 * Add ownership fields to a record on create
 * Ensures created_by is set to the user's email
 */
function addOwnership(data, user) {
  if (!user) return { ...data, created_by: 'system' };
  return {
    ...data,
    created_by: user.email || user.id || 'system',
    owner_id: user.id || null,
    owner_email: user.email || null
  };
}

/**
 * Get RLS query filter for database queries
 * Instead of filtering after fetch, this builds a query filter
 * to only fetch records the user can see
 */
function getRLSQueryFilter(user, entity, action) {
  if (!user) {
    if (action === 'read' && isPublicEntity(entity)) {
      return {}; // No filter — public
    }
    return { _deny_all: true }; // Deny all
  }

  const { role, email, id } = user;

  if (role === 'owner' || role === 'admin') return {};
  if (role === 'agent') return {};
  if (role === 'manager') return {};

  if (action === 'read' && isPublicEntity(entity)) return {};

  if (isRLSEnforced(role)) {
    // Return OR filter — match any ownership field
    return {
      _rls: true,
      _rls_fields: ['created_by', 'user_email', 'customer_email', 'buyer_email', 'student_email', 'owner_email'],
      _rls_value: email
    };
  }

  return { _deny_all: true };
}

module.exports = {
  enforceRLS,
  canAccessRecord,
  addOwnership,
  getRLSQueryFilter
};
