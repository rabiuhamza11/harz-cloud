/**
 * HARZ Cloud — Sub-Agent Orchestration
 * 
 * Coordinates 7+ AI agents to work together on tasks:
 * - Magani (Orchestrator)
 * - Hauwa (Marketing & Content)
 * - Rabi (Finance & Orders)
 * - Aisha (Customer Support & CRM)
 * - Nuruddeen (Platform Health)
 * - Omega (Producer & Deploy)
 * - Danjuma (Security)
 * 
 * Features:
 * - Task delegation & routing
 * - Parallel execution
 * - Result aggregation
 * - Inter-agent messaging
 * - Task dependencies & pipelines
 * - Retry on failure
 * - Status tracking
 */

const crypto = require('crypto');

// Agent registry
const AGENTS = {
  magani: {
    name: 'Magani',
    role: 'Orchestrator & Infrastructure',
    level: 0,
    capabilities: ['delegate', 'execute', 'report', 'escalate', 'system_admin'],
    can_delegate_to: ['hauwa', 'rabi', 'aisha', 'nuruddeen', 'omega', 'danjuma'],
    model: 'nemotron-550b',
    max_concurrent_tasks: 10
  },
  hauwa: {
    name: 'Hauwa',
    role: 'Marketing & Content',
    level: 2,
    capabilities: ['content_generation', 'social_media', 'ad_copy', 'seo', 'email_campaigns', 'hashtags'],
    can_delegate_to: [],
    model: 'nemotron-550b',
    max_concurrent_tasks: 5
  },
  rabi: {
    name: 'Rabi',
    role: 'Finance & Orders',
    level: 2,
    capabilities: ['order_tracking', 'payment_monitoring', 'revenue_reporting', 'commission_calculation', 'invoice_generation'],
    can_delegate_to: [],
    model: 'nemotron-550b',
    max_concurrent_tasks: 5
  },
  aisha: {
    name: 'Aisha',
    role: 'Customer Support & CRM',
    level: 3,
    capabilities: ['customer_inquiry', 'auto_reply', 'faq_answering', 'order_status', 'escalation', 'crm_logging'],
    can_delegate_to: ['rabi'],
    model: 'nemotron-120b',
    max_concurrent_tasks: 20
  },
  nuruddeen: {
    name: 'Nuruddeen',
    role: 'Platform Health',
    level: 2,
    capabilities: ['uptime_monitoring', 'ssl_checking', 'performance_audit', 'dns_lookup', 'incident_response'],
    can_delegate_to: ['danjuma'],
    model: 'nemotron-120b',
    max_concurrent_tasks: 10
  },
  omega: {
    name: 'Omega',
    role: 'Producer & Deploy',
    level: 1,
    capabilities: ['code_generation', 'deployment', 'testing', 'ci_cd', 'repo_management', 'build_automation'],
    can_delegate_to: ['nuruddeen'],
    model: 'nemotron-550b',
    max_concurrent_tasks: 3
  },
  danjuma: {
    name: 'Danjuma',
    role: 'Security',
    level: 1,
    capabilities: ['threat_detection', 'vulnerability_scan', 'audit_review', 'access_control', 'incident_response', 'compliance_check'],
    can_delegate_to: [],
    model: 'nemotron-550b',
    max_concurrent_tasks: 5
  }
};

// Task status constants
const TASK_STATUS = {
  PENDING: 'pending',
  ASSIGNED: 'assigned',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  RETRYING: 'retrying'
};

/**
 * Create a new orchestration task
 */
function createTask(params) {
  const {
    name,
    description,
    assigned_agent,
    delegated_by,
    priority = 'normal',
    dependencies = [],
    parent_task_id = null,
    max_retries = 3,
    timeout_seconds = 300,
    metadata = {}
  } = params;
  
  return {
    id: crypto.randomUUID(),
    name,
    description,
    assigned_agent,
    delegated_by: delegated_by || 'system',
    priority, // low, normal, high, critical
    status: TASK_STATUS.PENDING,
    dependencies, // Array of task IDs that must complete first
    parent_task_id,
    subtasks: [],
    max_retries,
    retry_count: 0,
    timeout_seconds,
    result: null,
    error: null,
    metadata,
    created_at: new Date().toISOString(),
    assigned_at: null,
    started_at: null,
    completed_at: null,
    duration_ms: null
  };
}

/**
 * Delegate a task to an agent
 */
async function delegateTask(task, Database) {
  const agent = AGENTS[task.assigned_agent];
  if (!agent) {
    return { success: false, error: 'Unknown agent: ' + task.assigned_agent };
  }
  
  // Check if agent can receive this task
  if (agent.max_concurrent_tasks <= 0) {
    return { success: false, error: 'Agent at capacity' };
  }
  
  // Check dependencies
  if (task.dependencies.length > 0) {
    for (const depId of task.dependencies) {
      const dep = await Database.findOne('agent_tasks', { id: depId });
      if (!dep || dep.status !== TASK_STATUS.COMPLETED) {
        return { 
          success: false, 
          error: 'Dependency not met: ' + depId,
          dependency_status: dep?.status || 'not_found'
        };
      }
    }
  }
  
  // Update task status
  task.status = TASK_STATUS.ASSIGNED;
  task.assigned_at = new Date().toISOString();
  
  await Database.insert('agent_tasks', task);
  
  // Log inter-agent message
  await Database.insert('agent_messages', {
    id: crypto.randomUUID(),
    message_id: crypto.randomUUID(),
    from_agent: task.delegated_by,
    to_agent: task.assigned_agent,
    message_type: 'task_delegation',
    priority: task.priority,
    subject: task.name,
    content: task.description,
    related_entity: 'agent_tasks',
    related_entity_id: task.id,
    requires_action: true,
    action_taken: false,
    status: 'sent',
    created_date: new Date().toISOString()
  });
  
  return { success: true, task_id: task.id, assigned_to: agent.name };
}

/**
 * Execute a task (simulate agent processing)
 */
async function executeTask(taskId, Database, agentHandler) {
  const task = await Database.findOne('agent_tasks', { id: taskId });
  if (!task) {
    return { success: false, error: 'Task not found' };
  }
  
  // Update to running
  task.status = TASK_STATUS.RUNNING;
  task.started_at = new Date().toISOString();
  
  await Database.update('agent_tasks', taskId, {
    status: TASK_STATUS.RUNNING,
    started_at: task.started_at
  });
  
  try {
    // Execute via handler if provided, otherwise simulate
    let result;
    if (agentHandler && typeof agentHandler === 'function') {
      result = await agentHandler(task);
    } else {
      result = {
        agent: task.assigned_agent,
        task: task.name,
        status: 'completed',
        output: 'Task processed by ' + AGENTS[task.assigned_agent]?.name,
        data: task.metadata
      };
    }
    
    // Mark completed
    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt) - new Date(task.started_at);
    
    await Database.update('agent_tasks', taskId, {
      status: TASK_STATUS.COMPLETED,
      result: JSON.stringify(result),
      completed_at: completedAt,
      duration_ms: duration
    });
    
    // Update agent message
    await Database.updateWhere('agent_messages', 
      { related_entity_id: taskId, requires_action: true },
      { action_taken: true, status: 'completed' }
    );
    
    return { success: true, task_id: taskId, result, duration_ms: duration };
  } catch (e) {
    // Handle failure
    task.retry_count = (task.retry_count || 0) + 1;
    
    if (task.retry_count < task.max_retries) {
      await Database.update('agent_tasks', taskId, {
        status: TASK_STATUS.RETRYING,
        retry_count: task.retry_count,
        error: e.message
      });
      
      return { 
        success: false, 
        task_id: taskId, 
        error: e.message, 
        retrying: true,
        retry_count: task.retry_count,
        max_retries: task.max_retries
      };
    }
    
    await Database.update('agent_tasks', taskId, {
      status: TASK_STATUS.FAILED,
      error: e.message,
      completed_at: new Date().toISOString()
    });
    
    return { success: false, task_id: taskId, error: e.message, retries_exhausted: true };
  }
}

/**
 * Create a pipeline of tasks with dependencies
 */
async function createPipeline(tasks, Database) {
  const taskIds = [];
  let prevId = null;
  
  for (let i = 0; i < tasks.length; i++) {
    const task = createTask({
      ...tasks[i],
      dependencies: prevId ? [prevId] : [],
      parent_task_id: null
    });
    
    const result = await delegateTask(task, Database);
    if (!result.success) {
      return { success: false, error: 'Pipeline failed at step ' + i, failed_task: tasks[i].name };
    }
    
    taskIds.push(task.id);
    prevId = task.id;
  }
  
  return { success: true, pipeline_id: crypto.randomUUID(), task_ids: taskIds };
}

/**
 * Broadcast a message to all agents
 */
async function broadcastToAgents(fromAgent, subject, content, Database) {
  const results = [];
  
  for (const [agentId, agent] of Object.entries(AGENTS)) {
    if (agentId === fromAgent) continue;
    
    const message = {
      id: crypto.randomUUID(),
      message_id: crypto.randomUUID(),
      from_agent: fromAgent,
      to_agent: agentId,
      message_type: 'broadcast',
      priority: 'normal',
      subject,
      content,
      requires_action: false,
      action_taken: false,
      status: 'sent',
      created_date: new Date().toISOString()
    };
    
    await Database.insert('agent_messages', message);
    results.push({ agent: agentId, message_id: message.message_id });
  }
  
  return { success: true, sent_to: results.length, results };
}

/**
 * Get agent status and current load
 */
async function getAgentStatus(agentId, Database) {
  const agent = AGENTS[agentId];
  if (!agent) return null;
  
  const activeTasks = await Database.find('agent_tasks', {
    assigned_agent: agentId,
    status: [TASK_STATUS.RUNNING, TASK_STATUS.ASSIGNED, TASK_STATUS.PENDING, TASK_STATUS.RETRYING]
  }, { limit: 100 });
  
  const completedTasks = await Database.find('agent_tasks', {
    assigned_agent: agentId,
    status: TASK_STATUS.COMPLETED
  }, { limit: 100 });
  
  const failedTasks = await Database.find('agent_tasks', {
    assigned_agent: agentId,
    status: TASK_STATUS.FAILED
  }, { limit: 100 });
  
  return {
    agent_id: agentId,
    name: agent.name,
    role: agent.role,
    level: agent.level,
    capabilities: agent.capabilities,
    model: agent.model,
    current_load: activeTasks.length,
    max_concurrent: agent.max_concurrent_tasks,
    completed: completedTasks.length,
    failed: failedTasks.length,
    success_rate: completedTasks.length > 0 
      ? ((completedTasks.length / (completedTasks.length + failedTasks.length)) * 100).toFixed(1) + '%'
      : '—',
    can_receive_tasks: activeTasks.length < agent.max_concurrent_tasks
  };
}

/**
 * Get all agents status
 */
async function getAllAgentsStatus(Database) {
  const statuses = [];
  for (const agentId of Object.keys(AGENTS)) {
    const status = await getAgentStatus(agentId, Database);
    if (status) statuses.push(status);
  }
  return statuses;
}

/**
 * Get task by ID with full details
 */
async function getTask(taskId, Database) {
  const task = await Database.findOne('agent_tasks', { id: taskId });
  if (!task) return null;
  
  // Get subtasks
  const subtasks = await Database.find('agent_tasks', { parent_task_id: taskId });
  
  // Get related messages
  const messages = await Database.find('agent_messages', { related_entity_id: taskId });
  
  return {
    ...task,
    subtasks: subtasks.length,
    messages: messages.length,
    agent_info: AGENTS[task.assigned_agent]
  };
}

/**
 * List agents
 */
function listAgents() {
  return Object.entries(AGENTS).map(([id, agent]) => ({
    id,
    name: agent.name,
    role: agent.role,
    level: agent.level,
    capabilities: agent.capabilities,
    model: agent.model,
    can_delegate_to: agent.can_delegate_to
  }));
}

/**
 * Route a task to the best agent based on capability
 */
function routeTask(taskDescription) {
  const lower = taskDescription.toLowerCase();
  
  if (lower.match(/market|content|ad|social|seo|email|copy|post/)) return 'hauwa';
  if (lower.match(/payment|order|revenue|finance|invoice|commission|refund/)) return 'rabi';
  if (lower.match(/customer|support|inquiry|faq|crm|reply|complain/)) return 'aisha';
  if (lower.match(/uptime|health|platform|ssl|dns|incident|monitor/)) return 'nuruddeen';
  if (lower.match(/deploy|build|code|repo|github|ci|cd|test/)) return 'omega';
  if (lower.match(/security|threat|vulnerab|audit|access|compliance/)) return 'danjuma';
  if (lower.match(/orchestrat|delegate|system|infrastructure|escalat/)) return 'magani';
  
  return 'magani'; // Default to orchestrator
}

module.exports = {
  AGENTS,
  TASK_STATUS,
  createTask,
  delegateTask,
  executeTask,
  createPipeline,
  broadcastToAgents,
  getAgentStatus,
  getAllAgentsStatus,
  getTask,
  listAgents,
  routeTask
};
