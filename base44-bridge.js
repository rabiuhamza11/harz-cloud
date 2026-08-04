/**
 * HARZ Cloud ↔ Base44 Bridge
 * Bidirectional sync between HARZ Cloud SQLite and Base44 entities
 * 
 * Strategy: HARZ Cloud is primary (local, fast), Base44 is secondary (cloud, backup)
 * - Reads: Try HARZ Cloud first, fall back to Base44
 * - Writes: Write to HARZ Cloud, mirror to Base44 async
 * - Sync: Periodic full sync of key entities
 */

const https = require('https');
const { Database } = require('./database');

const BASE44_APP_ID = '6a1e2efdc14fbb292286fb2f';
const BASE44_API = 'https://superagent-2286fb2f.base44.app';
const BASE44_FUNCTIONS = `${BASE44_API}/functions`;
const OMEGA_API_KEY = 'omega_harz_321424_2026';

// Entity mapping: HARZ Cloud table → Base44 entity name
const ENTITY_MAP = {
  // Commerce
  'products': 'Product',
  'orders': 'Order',
  'harzpay_orders': 'HarzPayOrder',
  'harzpay_affiliates': 'HarzPayAffiliate',
  'sellers': 'Seller',
  'referrals': 'Referral',
  
  // CRM
  'crm': 'WhatsAppCRM',
  'customer_memory': 'CustomerMemory',
  
  // Music
  'music_tracks': 'MusicTrack',
  'music_artists': 'MusicArtist',
  'music_purchases': 'MusicPurchase',
  
  // Film
  'films': 'Film',
  'film_creators': 'FilmCreator',
  'film_purchases': 'FilmPurchase',
  'film_reviews': 'FilmReview',
  
  // Estate
  'estate_properties': 'EstateProperty',
  'estate_inquiries': 'EstateInquiry',
  'estate_pros': 'EstatePro',
  'estate_materials': 'EstateMaterial',
  'estate_reviews': 'EstateReview',
  'estate_submissions': 'EstateSubmission',
  
  // Education
  'edu_courses': 'EduCourse',
  'edu_students': 'EduStudent',
  'edu_enrollments': 'EduEnrollment',
  'edu_instructors': 'EduInstructor',
  'edu_certificates': 'EduCertificate',
  'edu_assessments': 'EduAssessment',
  
  // Content
  'content_projects': 'ContentProject',
  'content_scripts': 'ContentScript',
  'content_campaigns': 'ContentCampaign',
  'analytics_metrics': 'AnalyticsMetric',
  'publish_schedules': 'PublishSchedule',
  'trend_research': 'TrendResearch',
  
  // Social
  'connect_posts': 'ConnectPost',
  'connect_comments': 'ConnectComment',
  'connect_messages': 'ConnectMessage',
  'connect_communities': 'ConnectCommunity',
  'connect_notifications': 'ConnectNotification',
  'connect_businesses': 'ConnectBusiness',
  'connect_products': 'ConnectProduct',
  'connect_orders': 'ConnectOrder',
  
  // Finance
  'fx_rates': 'FxRate',
  'fx_trades': 'FxTrade',
  'micro_loans': 'MicroLoan',
  'loan_applications': 'LoanApplication',
  'apex_accounts': 'ApexAccount',
  'apex_transactions': 'ApexTransaction',
  'apex_cards': 'ApexCard',
  'apex_loans': 'ApexLoan',
  'apex_beneficiaries': 'ApexBeneficiary',
  'apex_savings_goals': 'ApexSavingsGoal',
  'apex_bills': 'ApexBill',
  
  // Ajo
  'ajo_groups': 'AjoGroup',
  'ajo_members': 'AjoMember',
  'ajo_contributions': 'AjoContribution',
  
  // Bills
  'bill_payments': 'BillPayment',
  'bill_providers': 'BillProvider',
  
  // Security
  'audit_logs': 'OmegaAuditLog',
  'approvals': 'OmegaApproval',
  'agent_messages': 'AgentMessage',
  'agent_registry': 'OmegaAgentRegistry',
  
  // Analytics
  'ecosystem_analytics': 'EcosystemAnalytics',
  'analytics_snapshots': 'AnalyticsSnapshot',
  
  // AI Executives
  'ai_executives': 'AIExecutive',
  'production_pipelines': 'ProductionPipeline',
  
  // Other
  'consultations': 'ConsultationBooking',
  'freelance_services': 'FreelanceService',
  'build_projects': 'BuildProject',
  'venture_projects': 'VentureProject',
  'venture_artifacts': 'VentureArtifact',
  'deploy_tasks': 'DeployTask',
  
  // Health
  'health_profiles': 'HealthProfile',
  'health_metrics': 'HealthMetric',
  'medications': 'Medication',
  'medical_records': 'MedicalRecord',
  'appointments': 'Appointment',
  'emergency_contacts': 'EmergencyContact',
  'wearable_devices': 'WearableDevice',
  'mental_wellness_logs': 'MentalWellnessLog',
  'family_members': 'FamilyMember',
  'nutrition_plans': 'NutritionPlan',
  'fitness_plans': 'FitnessPlan',
  'health_agents': 'HealthAgent',
  'symptom_assessments': 'SymptomAssessment',
  
  // MindCare
  'mindcare_profiles': 'MindCareProfile',
  'mood_entries': 'MoodEntry',
  'mindcare_journals': 'MindCareJournal',
  'assessment_results': 'AssessmentResult',
  'mindcare_agents': 'MindCareAgent',
  'therapy_exercises': 'TherapyExercise',
  'meditation_sessions': 'MeditationSession',
  'crisis_alerts': 'CrisisAlert',
  'wellness_goals': 'WellnessGoal',
  
  // Cyber
  'cyber_threats': 'CyberThreat',
  'cyber_incidents': 'CyberIncident',
  'cyber_vulnerabilities': 'CyberVulnerability',
  'cyber_agents': 'CyberAgent',
  'cyber_endpoints': 'CyberEndpoint',
  'threat_intel': 'ThreatIntel',
  'security_events': 'SecurityEvent',
  'compliance_reports': 'ComplianceReport',
  
  // IoT
  'iot_devices': 'IoTDevice',
  'iot_alerts': 'IoTAlert',
  'iot_automations': 'IoTAutomation',
  
  // Identity
  'identity_profiles': 'IdentityProfile',
  'identity_credentials': 'IdentityCredential',
  'identity_sessions': 'IdentitySession',
  
  // Cloud
  'cloud_users': 'CloudUser',
  'cloud_agents': 'CloudAgent',
  'cloud_requests': 'CloudRequest',
  'cloud_subscriptions': 'CloudSubscription',
  
  // Exchange
  'exchange_orders': 'ExchangeOrder',
  'exchange_wallets': 'ExchangeWallet',
  'exchange_pairs': 'ExchangePair',
  'p2p_listings': 'P2PListing',
  'p2p_trades': 'P2PTrade',
  
  // Hosting/Domain
  'hm_domains': 'HMDomain',
  'hm_hosting_orders': 'HMHostingOrder',
  'hm_tickets': 'HMTicket',
  'hm_invoices': 'HMInvoice',
  'domain_orders': 'DomainOrder',
  
  // Other
  'wholesaler_accounts': 'WholesalerAccount',
  'wholesale_orders': 'WholesaleOrder',
  'ai_studio_generations': 'AIStudioGeneration',
  'chatbot_configs': 'ChatbotConfig',
  'saas_billing_plans': 'SaaSBillingPlan',
  'newsletter_subs': 'NewsletterSub',
  'event_tickets': 'EventTicket',
  'file_store': 'FileStore',
  'number_lookups': 'NumberLookup',
  'bridge_tokens': 'BridgeToken',
};

// Reverse map: Base44 entity → HARZ Cloud table
const TABLE_MAP = {};
for (const [table, entity] of Object.entries(ENTITY_MAP)) {
  TABLE_MAP[entity] = table;
}

/**
 * HTTP request helper for Base44 API
 */
function base44Request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE44_FUNCTIONS + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': OMEGA_API_KEY,
      },
      timeout: 10000,
    };
    
    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Base44 request timeout')); });
    
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Call Omega Producer with an action
 */
async function callOmega(action, params = {}) {
  try {
    const res = await base44Request('/omegaProducer', 'POST', {
      action,
      api_key: OMEGA_API_KEY,
      ...params,
    });
    if (res.status === 200) return res.data;
    throw new Error(`Omega ${action} failed: ${res.status}`);
  } catch (e) {
    console.error(`[Bridge] Omega call failed (${action}):`, e.message);
    throw e;
  }
}

/**
 * Read entity from Base44 via the entity API
 */
async function readFromBase44(entityName, query = {}, options = {}) {
  const params = new URLSearchParams();
  if (query) params.set('query', JSON.stringify(query));
  if (options.limit) params.set('limit', options.limit);
  if (options.skip) params.set('skip', options.skip);
  if (options.sort) params.set('sort', options.sort);
  
  try {
    const res = await base44Request(`/entities/${entityName}?${params}`, 'GET');
    if (res.status === 200 && Array.isArray(res.data)) {
      return res.data;
    }
    return [];
  } catch (e) {
    console.error(`[Bridge] Read from Base44 failed (${entityName}):`, e.message);
    return [];
  }
}

/**
 * Write entity to Base44 (create or update)
 */
async function writeToBase44(entityName, record, isUpdate = false) {
  try {
    // Use omegaProducer for writes since entity API may need auth
    const action = isUpdate ? 'update_order' : 'create_order';
    const result = await callOmega(isUpdate ? 'update_record' : 'create_record', {
      entity: entityName,
      data: record,
    });
    return result;
  } catch (e) {
    console.error(`[Bridge] Write to Base44 failed (${entityName}):`, e.message);
    return null;
  }
}

// ============ BRIDGE API ============

const Bridge = {
  ENTITY_MAP,
  TABLE_MAP,
  
  /**
   * Unified read — tries HARZ Cloud first, falls back to Base44
   */
  async read(table, query = {}, options = {}) {
    // Try HARZ Cloud first
    try {
      const local = await Database.find(table, query, options);
      if (local && local.length > 0) {
        return { source: 'harz_cloud', data: local };
      }
    } catch (e) {
      console.error(`[Bridge] Local read failed (${table}):`, e.message);
    }
    
    // Fall back to Base44
    const entityName = ENTITY_MAP[table];
    if (entityName) {
      const remote = await readFromBase44(entityName, query, options);
      if (remote && remote.length > 0) {
        // Sync back to local for next time
        for (const record of remote) {
          try {
            await Database.insert(table, record);
          } catch (e) {
            // Record may already exist, try update
            try {
              await Database.update(table, record.id, record);
            } catch {}
          }
        }
        return { source: 'base44', data: remote };
      }
    }
    
    return { source: 'none', data: [] };
  },
  
  /**
   * Unified write — writes to HARZ Cloud, mirrors to Base44 async
   */
  async write(table, data, isUpdate = false) {
    let localResult = null;
    let b44Result = null;
    
    // Write to HARZ Cloud (primary)
    try {
      if (isUpdate && data.id) {
        localResult = await Database.update(table, data.id, data);
      } else {
        localResult = await Database.insert(table, data);
      }
    } catch (e) {
      console.error(`[Bridge] Local write failed (${table}):`, e.message);
    }
    
    // Mirror to Base44 (async, non-blocking)
    const entityName = ENTITY_MAP[table];
    if (entityName) {
      writeToBase44(entityName, data, isUpdate)
        .then(r => {
          if (r) console.log(`[Bridge] Mirrored to Base44: ${entityName}/${data.id || 'new'}`);
        })
        .catch(e => console.error(`[Bridge] Mirror failed (${entityName}):`, e.message));
    }
    
    return { source: 'harz_cloud', data: localResult, mirrored: !!entityName };
  },
  
  /**
   * Delete from both backends
   */
  async delete(table, id) {
    let localDeleted = false;
    
    try {
      localDeleted = await Database.delete(table, id);
    } catch (e) {
      console.error(`[Bridge] Local delete failed:`, e.message);
    }
    
    // Note: Base44 entity delete may need separate endpoint
    // For now, we mark as deleted locally and skip remote
    
    return { local: localDeleted };
  },
  
  /**
   * Full sync — pull all data from Base44 to HARZ Cloud
   */
  async syncFromBase44(tables = null) {
    const tablesToSync = tables || Object.keys(ENTITY_MAP);
    const results = { total: 0, synced: 0, failed: 0, details: {} };
    
    console.log(`[Bridge] Starting sync from Base44: ${tablesToSync.length} tables`);
    
    for (const table of tablesToSync) {
      const entityName = ENTITY_MAP[table];
      if (!entityName) {
        results.details[table] = { error: 'No entity mapping' };
        continue;
      }
      
      try {
        const records = await readFromBase44(entityName, {}, { limit: 500 });
        let count = 0;
        
        for (const record of records) {
          try {
            // Check if exists locally
            const existing = await Database.findOne(table, { id: record.id });
            if (existing) {
              // Update if remote is newer
              if (new Date(record.updated_date || 0) > new Date(existing.updated_date || 0)) {
                await Database.update(table, record.id, record);
                count++;
              }
            } else {
              // Insert new
              await Database.insert(table, record);
              count++;
            }
          } catch (e) {
            // Record may exist with different format, try update
            try {
              await Database.update(table, record.id, record);
              count++;
            } catch (e2) {
              results.failed++;
            }
          }
        }
        
        results.synced += count;
        results.total += records.length;
        results.details[table] = { entity: entityName, records: records.length, synced: count };
        console.log(`[Bridge] ${table}: ${count}/${records.length} synced`);
      } catch (e) {
        results.failed++;
        results.details[table] = { error: e.message };
        console.error(`[Bridge] Sync failed (${table}):`, e.message);
      }
    }
    
    console.log(`[Bridge] Sync complete: ${results.synced}/${results.total} synced, ${results.failed} failed`);
    return results;
  },
  
  /**
   * Push all HARZ Cloud data to Base44
   */
  async syncToBase44(tables = null) {
    const tablesToSync = tables || Object.keys(ENTITY_MAP);
    const results = { total: 0, pushed: 0, failed: 0, details: {} };
    
    console.log(`[Bridge] Starting push to Base44: ${tablesToSync.length} tables`);
    
    for (const table of tablesToSync) {
      const entityName = ENTITY_MAP[table];
      if (!entityName) continue;
      
      try {
        const localRecords = await Database.exportTable(table);
        let count = 0;
        
        for (const record of localRecords) {
          const result = await writeToBase44(entityName, record, true);
          if (result) count++;
          else results.failed++;
        }
        
        results.pushed += count;
        results.total += localRecords.length;
        results.details[table] = { entity: entityName, pushed: count };
      } catch (e) {
        results.failed++;
        results.details[table] = { error: e.message };
      }
    }
    
    return results;
  },
  
  /**
   * Get ecosystem status from Base44
   */
  async getEcosystemStatus() {
    try {
      const result = await callOmega('ecosystem_status');
      return result;
    } catch (e) {
      return { error: e.message, status: 'disconnected' };
    }
  },
  
  /**
   * Get revenue report from Base44
   */
  async getRevenueReport() {
    try {
      const result = await callOmega('revenue_report');
      return result;
    } catch (e) {
      return { error: e.message, revenue: 0, orders: 0 };
    }
  },
  
  /**
   * Agent chat via Base44 Omega Producer
   */
  async agentChat(agent, message, sender = 'system') {
    try {
      const result = await callOmega('agent_chat', { agent, message, sender_phone: sender });
      return result;
    } catch (e) {
      return { error: e.message, reply: 'Agent communication failed' };
    }
  },
  
  /**
   * List orders from both backends (merged)
   */
  async listOrders(options = {}) {
    const { data, source } = await Bridge.read('harzpay_orders', {}, options);
    
    // Also check Order entity
    const { data: orders } = await Bridge.read('orders', {}, options);
    
    // Merge and deduplicate
    const all = [...data, ...orders];
    const seen = new Set();
    const merged = all.filter(r => {
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
    
    return { source, count: merged.length, data: merged };
  },
  
  /**
   * List CRM records from both backends
   */
  async listCRM(options = {}) {
    const { data, source } = await Bridge.read('crm', {}, options);
    return { source, count: data.length, data };
  },
  
  /**
   * List products from both backends
   */
  async listProducts(options = {}) {
    const { data, source } = await Bridge.read('products', {}, options);
    return { source, count: data.length, data };
  },
  
  /**
   * Check Base44 connection
   */
  async checkConnection() {
    try {
      const result = await callOmega('ecosystem_status');
      return { connected: true, status: result };
    } catch (e) {
      return { connected: false, error: e.message };
    }
  },
  
  /**
   * Get sync status
   */
  async getSyncStatus() {
    const tables = await Database.listTables();
    const entityCount = Object.keys(ENTITY_MAP).length;
    const mapped = tables.filter(t => ENTITY_MAP[t]).length;
    
    return {
      local_tables: tables.length,
      mapped_tables: mapped,
      total_entities: entityCount,
      mapping_coverage: `${Math.round(mapped / entityCount * 100)}%`,
      base44_app_id: BASE44_APP_ID,
      base44_api: BASE44_API,
    };
  },
};

module.exports = { Bridge, ENTITY_MAP, TABLE_MAP, callOmega, readFromBase44, writeToBase44 };
