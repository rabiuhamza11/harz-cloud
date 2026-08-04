/**
 * HARZ Cloud — Agent Memory Persistence
 * 
 * Long-term memory storage for all AI agents:
 * - Conversation memory (chat history per user/agent)
 * - User preferences & learned facts
 * - Task history & patterns
 * - Entity knowledge base
 * - Cross-agent shared memory
 * - Memory consolidation & summarization
 * 
 * Memory Types:
 * 1. conversation — Chat messages between agent and user
 * 2. fact — Learned facts about users, products, systems
 * 3. preference — User preferences and settings
 * 4. instruction — Standing instructions from owner
 * 5. pattern — Recurring patterns and trends
 * 6. knowledge — General knowledge base entries
 * 7. context — Working context for current task
 */

const crypto = require('crypto');

// Memory types with retention policies
const MEMORY_TYPES = {
  conversation: {
    name: 'Conversation',
    description: 'Chat messages between agent and user',
    retention_days: 90,
    max_per_user: 1000,
    can_delete: true,
    auto_summarize: true,
    summarize_threshold: 50 // Summarize after 50 messages
  },
  fact: {
    name: 'Fact',
    description: 'Learned facts about users, products, systems',
    retention_days: null, // Permanent
    max_per_user: 500,
    can_delete: false, // Facts are permanent
    auto_summarize: false
  },
  preference: {
    name: 'Preference',
    description: 'User preferences and settings',
    retention_days: null,
    max_per_user: 100,
    can_delete: true,
    auto_summarize: false
  },
  instruction: {
    name: 'Instruction',
    description: 'Standing instructions from owner',
    retention_days: null,
    max_per_user: 50,
    can_delete: true,
    auto_summarize: false
  },
  pattern: {
    name: 'Pattern',
    description: 'Recurring patterns and trends observed',
    retention_days: 365,
    max_per_user: 200,
    can_delete: true,
    auto_summarize: true,
    summarize_threshold: 30
  },
  knowledge: {
    name: 'Knowledge',
    description: 'General knowledge base entries',
    retention_days: null,
    max_per_user: 1000,
    can_delete: false,
    auto_summarize: false
  },
  context: {
    name: 'Context',
    description: 'Working context for current task',
    retention_days: 7,
    max_per_user: 100,
    can_delete: true,
    auto_summarize: false
  }
};

/**
 * Store a memory entry
 */
async function storeMemory(params, Database) {
  const {
    agent_name,
    user_email,
    memory_type,
    content,
    metadata = {},
    importance = 'normal', // low, normal, high, critical
    tags = [],
    expires_at = null
  } = params;
  
  // Validate memory type
  if (!MEMORY_TYPES[memory_type]) {
    return { success: false, error: 'Invalid memory type: ' + memory_type };
  }
  
  const config = MEMORY_TYPES[memory_type];
  
  // Check max entries for this user
  const existing = await Database.find('agent_memory', {
    user_email,
    memory_type
  }, { limit: config.max_per_user });
  
  if (existing.length >= config.max_per_user) {
    // Delete oldest if at capacity and can_delete
    if (config.can_delete) {
      const oldest = existing.sort((a, b) => 
        new Date(a.created_date) - new Date(b.created_date)
      )[0];
      await Database.delete('agent_memory', oldest.id);
    } else {
      // Summarize if can't delete
      await consolidateMemory(user_email, memory_type, Database);
    }
  }
  
  const memory = {
    id: crypto.randomUUID(),
    agent_name,
    user_email,
    memory_type,
    content,
    metadata: JSON.stringify(metadata),
    importance,
    tags: JSON.stringify(tags),
    is_summarized: false,
    source: metadata.source || 'agent',
    confidence_score: metadata.confidence || 1.0,
    access_count: 0,
    last_accessed: null,
    expires_at: expires_at || (config.retention_days 
      ? new Date(Date.now() + config.retention_days * 86400000).toISOString() 
      : null),
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString()
  };
  
  await Database.insert('agent_memory', memory);
  
  return { success: true, memory_id: memory.id, type: memory_type };
}

/**
 * Retrieve memories for an agent/user
 */
async function retrieveMemory(params, Database) {
  const {
    user_email,
    agent_name = null,
    memory_type = null,
    search_query = null,
    tags = null,
    importance = null,
    limit = 20,
    include_expired = false
  } = params;
  
  const query = { user_email };
  if (agent_name) query.agent_name = agent_name;
  if (memory_type) query.memory_type = memory_type;
  if (importance) query.importance = importance;
  
  let memories = await Database.find('agent_memory', query, {
    limit: 500, // Fetch more, then filter
    sort: '-created_date'
  });
  
  // Filter expired
  if (!include_expired) {
    const now = new Date().toISOString();
    memories = memories.filter(m => !m.expires_at || m.expires_at > now);
  }
  
  // Search in content
  if (search_query) {
    const lower = search_query.toLowerCase();
    memories = memories.filter(m => 
      m.content?.toLowerCase().includes(lower) ||
      m.metadata?.toLowerCase().includes(lower) ||
      m.tags?.toLowerCase().includes(lower)
    );
  }
  
  // Filter by tags
  if (tags && tags.length > 0) {
    memories = memories.filter(m => {
      try {
        const memTags = JSON.parse(m.tags || '[]');
        return tags.some(t => memTags.includes(t));
      } catch {
        return false;
      }
    });
  }
  
  // Update access count
  const limited = memories.slice(0, limit);
  for (const mem of limited) {
    await Database.update('agent_memory', mem.id, {
      access_count: (mem.access_count || 0) + 1,
      last_accessed: new Date().toISOString()
    });
  }
  
  return {
    count: limited.length,
    total_available: memories.length,
    memories: limited.map(m => ({
      id: m.id,
      type: m.memory_type,
      agent: m.agent_name,
      content: m.content,
      importance: m.importance,
      tags: JSON.parse(m.tags || '[]'),
      metadata: JSON.parse(m.metadata || '{}'),
      created_date: m.created_date,
      access_count: m.access_count
    }))
  };
}

/**
 * Get conversation context for an agent
 * Returns the most recent conversation memories + relevant facts
 */
async function getConversationContext(user_email, agent_name, Database) {
  // Get recent conversations
  const conversations = await retrieveMemory({
    user_email,
    agent_name,
    memory_type: 'conversation',
    limit: 10
  }, Database);
  
  // Get user facts
  const facts = await retrieveMemory({
    user_email,
    memory_type: 'fact',
    limit: 20
  }, Database);
  
  // Get user preferences
  const preferences = await retrieveMemory({
    user_email,
    memory_type: 'preference',
    limit: 10
  }, Database);
  
  // Get standing instructions
  const instructions = await retrieveMemory({
    user_email,
    memory_type: 'instruction',
    limit: 10
  }, Database);
  
  // Get current context
  const context = await retrieveMemory({
    user_email,
    agent_name,
    memory_type: 'context',
    limit: 5
  }, Database);
  
  return {
    conversations: conversations.memories,
    facts: facts.memories,
    preferences: preferences.memories,
    instructions: instructions.memories,
    context: context.memories,
    summary: {
      total_memories: conversations.count + facts.count + preferences.count + instructions.count + context.count,
      has_history: conversations.count > 0,
      knows_user: facts.count > 0
    }
  };
}

/**
 * Consolidate/summarize old memories
 */
async function consolidateMemory(user_email, memory_type, Database) {
  const config = MEMORY_TYPES[memory_type];
  if (!config || !config.auto_summarize) return;
  
  const memories = await Database.find('agent_memory', {
    user_email,
    memory_type,
    is_summarized: false
  }, { limit: 500, sort: 'created_date' });
  
  if (memories.length < config.summarize_threshold) return;
  
  // Group memories and create summary
  const toSummarize = memories.slice(0, Math.floor(memories.length / 2));
  
  // Create summary entry
  const summaryContent = `[Auto-summary of ${toSummarize.length} ${memory_type} memories from ${toSummarize[0]?.created_date} to ${toSummarize[toSummarize.length-1]?.created_date}]`;
  
  const summary = {
    id: crypto.randomUUID(),
    agent_name: 'system',
    user_email,
    memory_type,
    content: summaryContent,
    metadata: JSON.stringify({ 
      summarized_count: toSummarize.length,
      date_range: { start: toSummarize[0]?.created_date, end: toSummarize[toSummarize.length-1]?.created_date }
    }),
    importance: 'normal',
    tags: JSON.stringify(['auto-summary', memory_type]),
    is_summarized: true,
    source: 'consolidation',
    confidence_score: 0.8,
    access_count: 0,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString()
  };
  
  await Database.insert('agent_memory', summary);
  
  // Mark original memories as summarized
  for (const mem of toSummarize) {
    await Database.update('agent_memory', mem.id, {
      is_summarized: true,
      updated_date: new Date().toISOString()
    });
  }
  
  return { summarized: toSummarize.length, summary_id: summary.id };
}

/**
 * Store a conversation message
 */
async function storeConversation(agent_name, user_email, direction, message, metadata = {}, Database) {
  return storeMemory({
    agent_name,
    user_email,
    memory_type: 'conversation',
    content: message,
    metadata: { direction, ...metadata },
    importance: 'normal',
    tags: [direction]
  }, Database);
}

/**
 * Learn a fact about a user
 */
async function learnFact(agent_name, user_email, fact, metadata = {}, Database) {
  return storeMemory({
    agent_name,
    user_email,
    memory_type: 'fact',
    content: fact,
    metadata,
    importance: metadata.importance || 'normal',
    tags: metadata.tags || ['learned']
  }, Database);
}

/**
 * Store a user preference
 */
async function storePreference(agent_name, user_email, preference, value, Database) {
  return storeMemory({
    agent_name,
    user_email,
    memory_type: 'preference',
    content: preference + ': ' + value,
    metadata: { preference, value },
    tags: ['preference']
  }, Database);
}

/**
 * Store a standing instruction
 */
async function storeInstruction(agent_name, user_email, instruction, Database) {
  return storeMemory({
    agent_name,
    user_email,
    memory_type: 'instruction',
    content: instruction,
    importance: 'high',
    tags: ['standing-order'],
    metadata: { source: 'owner' }
  }, Database);
}

/**
 * Delete a memory (if allowed)
 */
async function deleteMemory(memory_id, Database) {
  const memory = await Database.findOne('agent_memory', { id: memory_id });
  if (!memory) return { success: false, error: 'Memory not found' };
  
  const config = MEMORY_TYPES[memory.memory_type];
  if (!config?.can_delete) {
    return { success: false, error: 'This memory type cannot be deleted' };
  }
  
  await Database.delete('agent_memory', memory_id);
  return { success: true, deleted: memory_id };
}

/**
 * Get memory statistics
 */
async function getMemoryStats(user_email, Database) {
  const allMemory = await Database.find('agent_memory', 
    user_email ? { user_email } : {}, 
    { limit: 10000 }
  );
  
  const stats = {
    total: allMemory.length,
    by_type: {},
    by_agent: {},
    by_importance: { low: 0, normal: 0, high: 0, critical: 0 },
    summarized: 0,
    expired: 0
  };
  
  const now = new Date().toISOString();
  
  for (const mem of allMemory) {
    stats.by_type[mem.memory_type] = (stats.by_type[mem.memory_type] || 0) + 1;
    stats.by_agent[mem.agent_name] = (stats.by_agent[mem.agent_name] || 0) + 1;
    if (stats.by_importance[mem.importance] !== undefined) {
      stats.by_importance[mem.importance]++;
    }
    if (mem.is_summarized) stats.summarized++;
    if (mem.expires_at && mem.expires_at < now) stats.expired++;
  }
  
  return stats;
}

/**
 * Search across all memory types
 */
async function searchMemory(query, user_email, Database) {
  const results = await retrieveMemory({
    user_email,
    search_query: query,
    limit: 50
  }, Database);
  
  return {
    query,
    count: results.count,
    results: results.memories
  };
}

/**
 * Share memory between agents
 */
async function shareMemory(from_agent, to_agent, memory_id, Database) {
  const memory = await Database.findOne('agent_memory', { id: memory_id });
  if (!memory) return { success: false, error: 'Memory not found' };
  
  // Create a copy for the other agent
  const shared = {
    id: crypto.randomUUID(),
    agent_name: to_agent,
    user_email: memory.user_email,
    memory_type: memory.memory_type,
    content: memory.content,
    metadata: JSON.stringify({ 
      ...JSON.parse(memory.metadata || '{}'),
      shared_from: from_agent,
      shared_at: new Date().toISOString()
    }),
    importance: memory.importance,
    tags: memory.tags,
    is_summarized: false,
    source: 'shared:' + from_agent,
    confidence_score: memory.confidence_score,
    access_count: 0,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString()
  };
  
  await Database.insert('agent_memory', shared);
  
  // Log inter-agent message
  await Database.insert('agent_messages', {
    id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    from_agent,
    to_agent,
    message_type: 'memory_share',
    subject: 'Memory shared',
    content: memory.content.substring(0, 200),
    related_entity: 'agent_memory',
    related_entity_id: shared.id,
    requires_action: false,
    status: 'sent',
    created_date: new Date().toISOString()
  });
  
  return { success: true, shared_id: shared.id, from: from_agent, to: to_agent };
}

module.exports = {
  MEMORY_TYPES,
  storeMemory,
  retrieveMemory,
  getConversationContext,
  consolidateMemory,
  storeConversation,
  learnFact,
  storePreference,
  storeInstruction,
  deleteMemory,
  getMemoryStats,
  searchMemory,
  shareMemory
};
