/**
 * HARZ Cloud — WebSocket Real-time
 * Live updates for chat, notifications, and dashboards
 */

const clients = new Map();

function handleWebSocket(ws, req) {
  const clientId = Math.random().toString(36).substring(7);
  const userEmail = req.headers['x-user-email'] || 'anonymous';
  
  clients.set(clientId, { ws, userEmail, connected_at: new Date().toISOString() });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          ws.subscribed_channels = ws.subscribed_channels || new Set();
          if (data.channels) {
            data.channels.forEach(ch => ws.subscribed_channels.add(ch));
          }
          ws.send(JSON.stringify({ type: 'subscribed', channels: Array.from(ws.subscribed_channels) }));
          break;
          
        case 'unsubscribe':
          if (data.channels && ws.subscribed_channels) {
            data.channels.forEach(ch => ws.subscribed_channels.delete(ch));
          }
          ws.send(JSON.stringify({ type: 'unsubscribed' }));
          break;
          
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
          break;
          
        case 'chat_message':
          broadcast(data.channel, {
            type: 'chat_message',
            from: userEmail,
            message: data.message,
            timestamp: new Date().toISOString()
          });
          break;
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
  });
  
  // Send welcome
  ws.send(JSON.stringify({
    type: 'connected',
    client_id: clientId,
    timestamp: new Date().toISOString()
  }));
}

function broadcast(channel, message) {
  for (const [id, client] of clients) {
    if (client.ws.subscribed_channels?.has(channel) && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify({ ...message, channel }));
    }
  }
}

function broadcastToUser(userEmail, message) {
  for (const [id, client] of clients) {
    if (client.userEmail === userEmail && client.ws.readyState === 1) {
      client.ws.send(JSON.stringify(message));
    }
  }
}

function getConnectedClients() {
  return {
    total: clients.size,
    clients: Array.from(clients.entries()).map(([id, c]) => ({
      id,
      user: c.userEmail,
      connected_at: c.connected_at,
      channels: c.ws.subscribed_channels ? Array.from(c.ws.subscribed_channels) : []
    }))
  };
}

module.exports = { handleWebSocket, broadcast, broadcastToUser, getConnectedClients };
