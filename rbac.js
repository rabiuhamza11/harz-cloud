/**
 * HARZ Cloud — Role-Based Access Control (RBAC)
 * Implements the Zero Trust Security Model from HARZ AEOS
 * 
 * Levels:
 *   Level 0 — Owner (Rabiu): Full access to everything
 *   Level 1 — Admin: Read all, write all, no delete without approval
 *   Level 2 — Manager: Read all, write department entities only
 *   Level 3 — User: Read public, write own records only
 *   Level 4 — Agent: Read public, write assigned entities only
 *   Level 5 — Guest: Read public entities only
 */

const ROLES = {
  owner: {
    level: 0,
    name: 'Owner',
    description: 'Full access to all entities, functions, and systems',
    permissions: {
      '*': ['create', 'read', 'update', 'delete', 'export', 'admin']
    }
  },
  
  admin: {
    level: 1,
    name: 'Administrator',
    description: 'Read all entities, write all, delete with approval',
    permissions: {
      '*': ['create', 'read', 'update', 'export'],
      'users': ['create', 'read', 'update', 'delete', 'export', 'admin'],
      'audit_log': ['read', 'export'],
      'roles': ['read', 'update', 'admin']
    },
    cannot: ['delete:harzpay_orders', 'delete:orders', 'delete:users']
  },
  
  manager: {
    level: 2,
    name: 'Manager',
    description: 'Read all, write department entities',
    permissions: {
      'products': ['create', 'read', 'update', 'export'],
      'orders': ['create', 'read', 'update', 'export'],
      'crm': ['create', 'read', 'update', 'export'],
      'harzpay_orders': ['read', 'update', 'export'],
      'users': ['read'],
      'music_tracks': ['create', 'read', 'update', 'export'],
      'films': ['create', 'read', 'update', 'export'],
      'estate_properties': ['create', 'read', 'update', 'export'],
      'agent_chats': ['read', 'export'],
      'audit_log': ['read'],
      'backup_snapshots': ['read', 'export']
    }
  },
  
  user: {
    level: 3,
    name: 'User',
    description: 'Read public, write own records only (RLS enforced)',
    permissions: {
      'products': ['read'],
      'orders': ['create', 'read'],
      'crm': ['create', 'read'],
      'harzpay_orders': ['create', 'read'],
      'users': ['read'],
      'music_tracks': ['read'],
      'films': ['read'],
      'estate_properties': ['read'],
      'estate_inquiries': ['create', 'read'],
      'agent_chats': ['create', 'read'],
      'consultation_bookings': ['create', 'read'],
      'newsletter_subs': ['create', 'read'],
      'health_profiles': ['create', 'read', 'update'],
      'mindcare_profiles': ['create', 'read', 'update'],
      'mood_entries': ['create', 'read', 'update'],
      'mindcare_journals': ['create', 'read', 'update'],
      'edu_enrollments': ['create', 'read', 'update'],
      'edu_certificates': ['read'],
      'reviews': ['create', 'read'],
      'p2p_listings': ['create', 'read', 'update'],
      'p2p_trades': ['create', 'read', 'update'],
      'exchange_orders': ['create', 'read', 'update'],
      'referrals': ['read']
    },
    rls: true  // Row-level security enforced
  },
  
  agent: {
    level: 4,
    name: 'AI Agent',
    description: 'Read public, write assigned entities',
    permissions: {
      'products': ['create', 'read', 'update'],
      'orders': ['create', 'read', 'update'],
      'crm': ['create', 'read', 'update'],
      'harzpay_orders': ['create', 'read', 'update'],
      'agent_chats': ['create', 'read'],
      'audit_log': ['create', 'read'],
      'whatsapp_crm': ['create', 'read', 'update'],
      'customer_memory': ['create', 'read', 'update'],
      'agent_messages': ['create', 'read', 'update'],
      'ecosystem_analytics': ['create', 'read', 'update'],
      'notifications': ['create', 'read'],
      'music_purchases': ['create', 'read', 'update'],
      'film_purchases': ['create', 'read', 'update']
    },
    rls: false  // Agents work across all records
  },
  
  guest: {
    level: 5,
    name: 'Guest',
    description: 'Read public entities only',
    permissions: {
      'products': ['read'],
      'music_tracks': ['read'],
      'films': ['read'],
      'estate_properties': ['read'],
      'edu_courses': ['read'],
      'freelance_services': ['read'],
      'saas_tools': ['read'],
      'health_agents': ['read'],
      'edu_agents': ['read']
    }
  }
};

// Entity visibility (public vs private)
const PUBLIC_ENTITIES = [
  'products', 'music_tracks', 'films', 'estate_properties',
  'edu_courses', 'freelance_services', 'saas_tools',
  'health_agents', 'edu_agents', 'estate_pros',
  'estate_materials', 'bill_providers', 'fx_rates',
  'fx_pairs', 'exchange_pairs', 'monetization_channels',
  'content_projects', 'trend_research', 'analytics_metrics',
  'event_tickets', 'estate_reviews', 'connect_posts',
  'connect_communities', 'connect_businesses',
  'wholesaler_accounts', 'saas_billing_plans',
  'cloud_agents', 'ai_studio_generations'
];

const ADMIN_ONLY_ENTITIES = [
  'users', 'audit_log', 'roles', 'api_keys',
  'omega_approval', 'omega_audit_log', 'omega_agent_registry',
  'security_events', 'cyber_threats', 'cyber_incidents',
  'cyber_vulnerabilities', 'threat_intel', 'compliance_reports',
  'backup_snapshots', 'deploy_tasks', 'venture_projects',
  'production_pipeline', 'apex_cards', 'apex_loans',
  'micro_loans', 'loan_applications', 'wholesale_orders',
  'cloud_users', 'cloud_subscriptions', 'cloud_requests'
];

/**
 * Check if a role can perform an action on an entity
 */
function canAccess(role, entity, action) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;
  
  // Owner can do everything
  if (role === 'owner') return true;
  
  // Check wildcard permissions
  const wildcardPerms = roleConfig.permissions['*'];
  if (wildcardPerms && wildcardPerms.includes(action)) {
    // Check cannot list
    if (roleConfig.cannot) {
      const blocked = roleConfig.cannot.find(c => {
        const [blockedAction, blockedEntity] = c.split(':');
        return blockedAction === action && blockedEntity === entity;
      });
      if (blocked) return false;
    }
    return true;
  }
  
  // Check entity-specific permissions
  const entityPerms = roleConfig.permissions[entity];
  if (entityPerms && entityPerms.includes(action)) {
    return true;
  }
  
  return false;
}

/**
 * Get all allowed actions for a role on an entity
 */
function getAllowedActions(role, entity) {
  const actions = ['create', 'read', 'update', 'delete', 'export', 'admin'];
  return actions.filter(a => canAccess(role, entity, a));
}

/**
 * Check if entity is public (readable by guests)
 */
function isPublicEntity(entity) {
  return PUBLIC_ENTITIES.includes(entity);
}

/**
 * Check if entity is admin-only
 */
function isAdminEntity(entity) {
  return ADMIN_ONLY_ENTITIES.includes(entity);
}

/**
 * Check if RLS is enforced for this role
 */
function isRLSEnforced(role) {
  const roleConfig = ROLES[role];
  return roleConfig && roleConfig.rls === true;
}

/**
 * Get role info
 */
function getRoleInfo(role) {
  const config = ROLES[role];
  if (!config) return null;
  return {
    role,
    name: config.name,
    level: config.level,
    description: config.description,
    rls: config.rls || false,
    entity_count: Object.keys(config.permissions).filter(k => k !== '*').length,
    has_wildcard: !!config.permissions['*']
  };
}

/**
 * List all roles
 */
function listRoles() {
  return Object.entries(ROLES).map(([key, config]) => ({
    role: key,
    name: config.name,
    level: config.level,
    description: config.description,
    rls: config.rls || false
  }));
}

module.exports = {
  ROLES,
  PUBLIC_ENTITIES,
  ADMIN_ONLY_ENTITIES,
  canAccess,
  getAllowedActions,
  isPublicEntity,
  isAdminEntity,
  isRLSEnforced,
  getRoleInfo,
  listRoles
};
