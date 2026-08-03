/**
 * HARZ Cloud Backend — Independent Infrastructure
 * Replaces: Base44 backend functions, Cloudflare Workers
 * Deploy: Render free tier
 * Database: SQLite (local) → Supabase PostgreSQL (production)
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Database } = require('./database');
const { Storage } = require('./storage');
const { Paystack } = require('./paystack');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'harz_cloud_321424_2026';
const API_KEY = process.env.HARZ_API_KEY || 'harz_cloud_live_321424';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Key authentication
function authenticate(req, res, next) {
  const key = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (key !== API_KEY && key !== JWT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized: Invalid API key' });
  }
  next();
}

// JWT authentication (for user-level auth)
function authUser(req, res, next) {
  const token = req.headers['x-auth-token'];
  if (!token) {
    return res.status(401).json({ error: 'No auth token provided' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ============ HEALTH CHECK ============
app.get('/health', (req, res) => {
  res.json({
    status: 'operational',
    service: 'HARZ Cloud Backend',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============ AUTH ============
app.post('/auth/signup', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    
    const existing = await Database.findOne('users', { email });
    if (existing) {
      return res.status(409).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await Database.insert('users', {
      name, email, phone,
      password: hashedPassword,
      role: 'user',
      created_date: new Date().toISOString()
    });
    
    const token = jwt.sign({ id: user.id, email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, name, email, phone, role: 'user' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await Database.findOne('users', { email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    
    const token = jwt.sign({ id: user.id, email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    delete user.password;
    res.json({ token, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ GENERIC ENTITY CRUD ============
// Mirrors Base44 entity functionality

// List records
app.get('/api/:entity', authenticate, async (req, res) => {
  try {
    const { entity } = req.params;
    const { limit = 50, skip = 0, sort, ...query } = req.query;
    
    const records = await Database.find(entity, query, {
      limit: parseInt(limit),
      skip: parseInt(skip),
      sort
    });
    
    res.json({
      count: records.length,
      records,
      has_more: records.length === parseInt(limit)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get single record
app.get('/api/:entity/:id', authenticate, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const record = await Database.findOne(entity, { id });
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create record
app.post('/api/:entity', authenticate, async (req, res) => {
  try {
    const { entity } = req.params;
    const data = {
      ...req.body,
      id: crypto.randomUUID(),
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString(),
      created_by: req.user?.email || 'system'
    };
    
    const record = await Database.insert(entity, data);
    res.status(201).json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update record
app.put('/api/:entity/:id', authenticate, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const data = {
      ...req.body,
      updated_date: new Date().toISOString()
    };
    delete data.id;
    delete data.created_date;
    
    const record = await Database.update(entity, id, data);
    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json(record);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete record
app.delete('/api/:entity/:id', authenticate, async (req, res) => {
  try {
    const { entity, id } = req.params;
    const deleted = await Database.delete(entity, id);
    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ PAYSTACK INTEGRATION ============
app.post('/paystack/initialize', authenticate, async (req, res) => {
  try {
    const { email, amount, reference, metadata, callback_url } = req.body;
    
    const result = await Paystack.initialize({
      email,
      amount, // in kobo
      currency: 'NGN',
      reference,
      metadata,
      callback_url: callback_url || 'https://rabiuhamza11.github.io/harz-portfolio/harz-super-app.html',
      channels: ['card', 'bank', 'ussd', 'bank_transfer']
    });
    
    // Log order
    await Database.insert('harzpay_orders', {
      id: crypto.randomUUID(),
      reference,
      amount: amount / 100,
      currency: 'NGN',
      customer_email: email,
      payment_method: 'paystack',
      status: 'pending',
      metadata: JSON.stringify(metadata),
      created_date: new Date().toISOString()
    });
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/paystack/verify/:reference', authenticate, async (req, res) => {
  try {
    const { reference } = req.params;
    const result = await Paystack.verify(reference);
    
    // Update order status
    await Database.updateWhere('harzpay_orders', { reference }, {
      status: result.status === 'success' ? 'paid' : 'failed',
      payment_status: result.status,
      updated_date: new Date().toISOString()
    });
    
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/paystack/webhook', async (req, res) => {
  try {
    const hash = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '').digest('hex');
    const signature = req.headers['x-paystack-signature'];
    
    if (hash !== signature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    const event = req.body;
    console.log(`Paystack webhook: ${event.event}`);
    
    if (event.event === 'charge.success') {
      const data = event.data;
      await Database.updateWhere('harzpay_orders', { reference: data.reference }, {
        status: 'paid',
        payment_status: 'success',
        tx_reference: data.id,
        updated_date: new Date().toISOString()
      });
      
      // Log to audit
      await Database.insert('audit_log', {
        id: crypto.randomUUID(),
        event_type: 'payment_success',
        entity: 'harzpay_orders',
        reference: data.reference,
        amount: data.amount / 100,
        details: JSON.stringify(data),
        created_date: new Date().toISOString()
      });
    }
    
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ AGENT CHAT (Omega Producer replacement) ============
app.post('/agent/chat', authenticate, async (req, res) => {
  try {
    const { agent_name, message, user_email, conversation_id } = req.body;
    
    // Store message
    const chatRecord = await Database.insert('agent_chats', {
      id: crypto.randomUUID(),
      agent_name,
      message,
      user_email,
      conversation_id: conversation_id || crypto.randomUUID(),
      direction: 'inbound',
      created_date: new Date().toISOString()
    });
    
    // Route to appropriate agent
    const agents = {
      magani: 'Orchestrator & Infrastructure',
      hauwa: 'Marketing & Content',
      rabi: 'Finance & Orders',
      aisha: 'Customer Support & CRM',
      nuruddeen: 'Platform Health',
      omega: 'Producer & Deploy',
      danjuma: 'Security'
    };
    
    res.json({
      chat_id: chatRecord.id,
      agent: agent_name,
      role: agents[agent_name] || 'Unknown',
      status: 'received',
      message: `Message received by ${agent_name}. Processing...`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ BACKUP & EXPORT ============
app.get('/backup/export', authenticate, async (req, res) => {
  try {
    const entities = req.query.entities?.split(',') || [
      'products', 'orders', 'users', 'crm', 'harzpay_orders',
      'music_tracks', 'films', 'estate_properties', 'agents'
    ];
    
    const backup = {
      export_date: new Date().toISOString(),
      version: '1.0.0',
      entities: {}
    };
    
    for (const entity of entities) {
      try {
        backup.entities[entity] = await Database.find(entity, {}, { limit: 10000 });
      } catch (e) {
        backup.entities[entity] = { error: e.message };
      }
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="harz_backup_${Date.now()}.json"`);
    res.json(backup);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/backup/import', authenticate, async (req, res) => {
  try {
    const { entities } = req.body;
    let imported = 0;
    
    for (const [entityName, records] of Object.entries(entities)) {
      if (!Array.isArray(records)) continue;
      for (const record of records) {
        await Database.insert(entityName, record);
        imported++;
      }
    }
    
    res.json({ success: true, imported });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ ECOSYSTEM STATUS ============
app.get('/status', authenticate, async (req, res) => {
  try {
    const stats = {};
    const entities = ['products', 'orders', 'users', 'crm', 'harzpay_orders', 'music_tracks', 'films'];
    
    for (const entity of entities) {
      try {
        const records = await Database.find(entity, {}, { limit: 10000 });
        stats[entity] = records.length;
      } catch (e) {
        stats[entity] = 0;
      }
    }
    
    res.json({
      service: 'HARZ Cloud',
      status: 'operational',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      stats
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`HARZ Cloud Backend running on port ${PORT}`);
  console.log(`Health: http://localhost:${PORT}/health`);
  console.log(`API: http://localhost:${PORT}/api/:entity`);
});

module.exports = app;
