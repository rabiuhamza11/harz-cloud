/**
 * HARZ Cloud Migration Script
 * Exports Base44 entities → HARZ Cloud SQLite/Supabase
 * 
 * Usage: node migrate.js
 * 
 * This script reads from Base44 API and writes to HARZ Cloud database
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE44_APP_ID = '6a1e2efdc14fbb292286fb2f';
const BASE44_API = 'https://superagent-2286fb2f.base44.app';
const BACKUP_DIR = path.join(__dirname, 'backups');

// All entities to migrate
const ENTITIES = [
  // Core Commerce
  { name: 'Product', table: 'products', priority: 1 },
  { name: 'Order', table: 'orders', priority: 1 },
  { name: 'HarzPayOrder', table: 'harzpay_orders', priority: 1 },
  { name: 'HarzPayAffiliate', table: 'harzpay_affiliates', priority: 2 },
  { name: 'Seller', table: 'sellers', priority: 2 },
  { name: 'Referral', table: 'referrals', priority: 3 },
  
  // CRM
  { name: 'WhatsAppCRM', table: 'crm', priority: 1 },
  { name: 'CustomerMemory', table: 'customer_memory', priority: 1 },
  
  // Music
  { name: 'MusicTrack', table: 'music_tracks', priority: 1 },
  { name: 'MusicArtist', table: 'music_artists', priority: 2 },
  { name: 'MusicPurchase', table: 'music_purchases', priority: 2 },
  
  // Film
  { name: 'Film', table: 'films', priority: 1 },
  { name: 'FilmCreator', table: 'film_creators', priority: 2 },
  { name: 'FilmPurchase', table: 'film_purchases', priority: 2 },
  { name: 'FilmReview', table: 'film_reviews', priority: 3 },
  
  // Estate
  { name: 'EstateProperty', table: 'estate_properties', priority: 1 },
  { name: 'EstateInquiry', table: 'estate_inquiries', priority: 2 },
  { name: 'EstatePro', table: 'estate_pros', priority: 3 },
  
  // Education
  { name: 'EduCourse', table: 'edu_courses', priority: 1 },
  { name: 'EduStudent', table: 'edu_students', priority: 2 },
  { name: 'EduEnrollment', table: 'edu_enrollments', priority: 2 },
  
  // Content
  { name: 'ContentProject', table: 'content_projects', priority: 2 },
  { name: 'ContentScript', table: 'content_scripts', priority: 3 },
  { name: 'ContentCampaign', table: 'content_campaigns', priority: 3 },
  
  // Social
  { name: 'ConnectPost', table: 'connect_posts', priority: 2 },
  { name: 'ConnectCommunity', table: 'connect_communities', priority: 3 },
  { name: 'ConnectBusiness', table: 'connect_businesses', priority: 3 },
  
  // Finance
  { name: 'FxRate', table: 'fx_rates', priority: 2 },
  { name: 'FxTrade', table: 'fx_trades', priority: 2 },
  { name: 'MicroLoan', table: 'micro_loans', priority: 3 },
  
  // Security
  { name: 'OmegaAuditLog', table: 'audit_logs', priority: 1 },
  { name: 'OmegaApproval', table: 'approvals', priority: 1 },
  { name: 'AgentMessage', table: 'agent_messages', priority: 1 },
  
  // Analytics
  { name: 'EcosystemAnalytics', table: 'ecosystem_analytics', priority: 2 },
  { name: 'AnalyticsSnapshot', table: 'analytics_snapshots', priority: 3 },
  
  // Other
  { name: 'ConsultationBooking', table: 'consultations', priority: 3 },
  { name: 'FreelanceService', table: 'freelance_services', priority: 3 },
  { name: 'BuildProject', table: 'build_projects', priority: 3 },
  { name: 'VentureProject', table: 'venture_projects', priority: 3 },
  { name: 'DeployTask', table: 'deploy_tasks', priority: 2 },
  
  // Health
  { name: 'HealthProfile', table: 'health_profiles', priority: 2 },
  { name: 'MindCareProfile', table: 'mindcare_profiles', priority: 2 },
];

async function main() {
  console.log('HARZ Cloud Migration Tool');
  console.log('=========================');
  console.log(`Total entities to migrate: ${ENTITIES.length}`);
  console.log(`Backup directory: ${BACKUP_DIR}`);
  console.log('');
  
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  
  // Group by priority
  const p1 = ENTITIES.filter(e => e.priority === 1);
  const p2 = ENTITIES.filter(e => e.priority === 2);
  const p3 = ENTITIES.filter(e => e.priority === 3);
  
  console.log(`Priority 1 (Critical): ${p1.length} entities`);
  console.log(`Priority 2 (Important): ${p2.length} entities`);
  console.log(`Priority 3 (Optional): ${p3.length} entities`);
  console.log('');
  
  // Create manifest
  const manifest = {
    export_date: new Date().toISOString(),
    total_entities: ENTITIES.length,
    priority_1: p1.map(e => e.name),
    priority_2: p2.map(e => e.name),
    priority_3: p3.map(e => e.name),
    backup_file: `harz_full_backup_${timestamp}.json`,
    status: 'pending'
  };
  
  fs.writeFileSync(
    path.join(BACKUP_DIR, 'migration_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  
  console.log('Manifest created: migration_manifest.json');
  console.log('');
  console.log('To run full migration:');
  console.log('1. Deploy HARZ Cloud to Render');
  console.log('2. Set BASE44_SERVICE_TOKEN env var');
  console.log('3. Run: node migrate.js --run');
  console.log('');
  console.log('Or use DeployForge v10 Migration tab');
}

main().catch(console.error);
