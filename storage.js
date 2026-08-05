// HARZ Cloud Storage Module - Cloudflare KV based
// Uses harz-file-storage KV namespace (25MB per file, unlimited keys)

const CF_ACCOUNT = "5ab9477c8379d6dcb1a8b5183484aeae";
const KV_NS_ID = "2aa49bf2e262492c805b7edd8627b5e0";
const CF_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function uploadFile(key, base64Data, metadata = {}) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_ID}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CF_TOKEN}`,
      'Content-Type': 'application/octet-stream',
      'X-CF-Meta-Name': metadata.name || key,
      'X-CF-Meta-Type': metadata.type || 'application/octet-stream',
      'X-CF-Meta-Size': metadata.size || base64Data.length
    },
    body: base64Data
  });
  return res.ok;
}

async function getFile(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_ID}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` }
  });
  return res;
}

async function listFiles(prefix = '') {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_ID}/keys${prefix ? '?prefix=' + encodeURIComponent(prefix) : ''}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` }
  });
  const data = await res.json();
  return data.result || [];
}

async function deleteFile(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${KV_NS_ID}/values/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${CF_TOKEN}` }
  });
  return res.ok;
}

module.exports = { uploadFile, getFile, listFiles, deleteFile };
