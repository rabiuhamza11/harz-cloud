/**
 * HARZ Cloud Paystack Integration
 * Handles: Checkout initialization, verification, webhooks
 */

const https = require('https');

class Paystack {
  constructor() {
    this.secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    this.baseUrl = 'api.paystack.co';
  }

  initialize(data) {
    return this.request('POST', '/transaction/initialize', data);
  }

  verify(reference) {
    return this.request('GET', `/transaction/verify/${reference}`);
  }

  listTransactions(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request('GET', `/transaction?${query}`);
  }

  createSubaccount(data) {
    return this.request('POST', '/subaccount', data);
  }

  listBanks() {
    return this.request('GET', '/bank');
  }

  resolveAccount(accountNumber, bankCode) {
    return this.request('GET', `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
  }

  refund(reference, amount = null) {
    const data = { transaction: reference };
    if (amount) data.amount = amount;
    return this.request('POST', '/refund', data);
  }


  request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path,
        method,
        headers: {
          'Authorization': `Bearer ${this.secretKey}`,
          'Content-Type': 'application/json'
        }
      };

      const req = https.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(new Error(`Parse error: ${body}`));
          }
        });
      });

      req.on('error', reject);
      
      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }
}

module.exports = { Paystack: new Paystack() };
