/**
 * HARZ Cloud Test Suite
 * Run: node test.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
const API_KEY = 'harz_cloud_live_321424';

let tests = 0;
let passed = 0;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    };
    
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });
    
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test(name, fn) {
  tests++;
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

async function runTests() {
  console.log('HARZ Cloud Test Suite');
  console.log('=====================');
  console.log('');
  
  // Wait for server to start
  await new Promise(r => setTimeout(r, 1000));
  
  // Health check
  await test('Health check returns 200', async () => {
    const res = await request('GET', '/health');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.status === 'operational', 'Status should be operational');
  });
  
  // Create user
  let userToken = null;
  await test('User signup', async () => {
    const res = await request('POST', '/auth/signup', {
      name: 'Test User',
      email: 'test@harz.cloud',
      password: 'test123456'
    });
    assert(res.status === 200 || res.status === 201, `Expected 200/201, got ${res.status}`);
    if (res.data.token) userToken = res.data.token;
  });
  
  // Login
  await test('User login', async () => {
    const res = await request('POST', '/auth/login', {
      email: 'test@harz.cloud',
      password: 'test123456'
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.token, 'Should return token');
    userToken = res.data.token;
  });
  
  // Create entity record
  let recordId = null;
  await test('Create product record', async () => {
    const res = await request('POST', '/api/products', {
      title: 'Test Product',
      price: 5000,
      currency: 'NGN',
      category: 'test'
    });
    assert(res.status === 201, `Expected 201, got ${res.status}`);
    assert(res.data.id, 'Should return id');
    recordId = res.data.id;
  });
  
  // List records
  await test('List products', async () => {
    const res = await request('GET', '/api/products');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.records !== undefined, 'Should return records array');
  });
  
  // Get single record
  await test('Get single product', async () => {
    const res = await request('GET', `/api/products/${recordId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.title === 'Test Product', 'Title should match');
  });
  
  // Update record
  await test('Update product', async () => {
    const res = await request('PUT', `/api/products/${recordId}`, {
      price: 7000
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.price === 7000, 'Price should be updated');
  });
  
  // Delete record
  await test('Delete product', async () => {
    const res = await request('DELETE', `/api/products/${recordId}`);
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.success === true, 'Should return success');
  });
  
  // Ecosystem status
  await test('Ecosystem status', async () => {
    const res = await request('GET', '/status');
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.data.service === 'HARZ Cloud', 'Service name should match');
  });
  
  // Unauthorized request
  await test('Reject unauthorized request', async () => {
    const res = await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/products',
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, data: body }));
      });
      req.end();
    });
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });
  
  console.log('');
  console.log(`Results: ${passed}/${tests} passed`);
  if (passed === tests) {
    console.log('🎉 All tests passed!');
  } else {
    console.log('⚠️  Some tests failed');
  }
  
  process.exit(passed === tests ? 0 : 1);
}

runTests().catch(console.error);
