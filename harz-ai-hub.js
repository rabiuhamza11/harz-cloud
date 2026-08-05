/**
 * HARZ AI Hub — African AI Model Hub (like Hugging Face, but for Africa)
 * 
 * Features:
 * 1. Model Hub — Browse, search, and share AI models (Hausa, English, Pidgin, African languages)
 * 2. Inference API — Run any model via HARZ Cloud (powered by Hugging Face backend)
 * 3. Datasets — African language datasets for training
 * 4. Spaces — Deploy AI demos and apps
 * 5. Leaderboard — Most popular models and datasets
 */

const { Database } = require('./database');

// Curated model registry — models available on HARZ AI Hub
const HARZ_MODELS = [
  // LLMs — Text Generation
  {
    id: 'harz-llama-3.1-8b',
    name: 'HARZ Llama 3.1 8B',
    original_model: 'meta-llama/Llama-3.1-8B-Instruct',
    type: 'text-generation',
    category: 'LLM',
    description: 'Meta\'s Llama 3.1 8B Instruct — excellent for general chat, Hausa, and English. Optimized for African context.',
    languages: ['en', 'ha', 'pcm'],
    tags: ['chat', 'assistant', 'multilingual', 'instruct'],
    downloads: 0,
    likes: 0,
    size: '16GB',
    license: 'llama-3.1',
    provider: 'huggingface',
    context_length: 128000,
    is_featured: true,
    created: '2026-08-05'
  },
  {
    id: 'harz-qwen-2.5-7b',
    name: 'HARZ Qwen 2.5 7B',
    original_model: 'Qwen/Qwen2.5-7B-Instruct',
    type: 'text-generation',
    category: 'LLM',
    description: 'Alibaba\'s Qwen 2.5 7B — strong multilingual support including African languages. Great for code and reasoning.',
    languages: ['en', 'ha', 'fr', 'sw'],
    tags: ['chat', 'code', 'multilingual', 'reasoning'],
    downloads: 0,
    likes: 0,
    size: '14GB',
    license: 'apache-2.0',
    provider: 'huggingface',
    context_length: 32768,
    is_featured: true,
    created: '2026-08-05'
  },
  {
    id: 'harz-mistral-7b',
    name: 'HARZ Mistral 7B',
    original_model: 'mistralai/Mistral-7B-Instruct-v0.3',
    type: 'text-generation',
    category: 'LLM',
    description: 'Mistral 7B Instruct — fast, efficient, and great for creative writing in English and Hausa.',
    languages: ['en', 'ha'],
    tags: ['chat', 'creative', 'fast'],
    downloads: 0,
    likes: 0,
    size: '14GB',
    license: 'apache-2.0',
    provider: 'huggingface',
    context_length: 32768,
    is_featured: false,
    created: '2026-08-05'
  },
  {
    id: 'harz-deepseek-r1',
    name: 'HARZ DeepSeek R1',
    original_model: 'deepseek-ai/DeepSeek-R1',
    type: 'text-generation',
    category: 'LLM',
    description: 'DeepSeek R1 — advanced reasoning model. Best for complex problem solving and math.',
    languages: ['en'],
    tags: ['reasoning', 'math', 'analysis'],
    downloads: 0,
    likes: 0,
    size: '32GB',
    license: 'mit',
    provider: 'huggingface',
    context_length: 65536,
    is_featured: false,
    created: '2026-08-05'
  },
  // Embedding Models
  {
    id: 'harz-embeddings',
    name: 'HARZ Embeddings',
    original_model: 'sentence-transformers/all-MiniLM-L6-v2',
    type: 'embeddings',
    category: 'Embedding',
    description: 'Multilingual sentence embeddings — perfect for semantic search, RAG, and document matching in African languages.',
    languages: ['en', 'ha', 'pcm', 'fr', 'sw', 'yo', 'ig'],
    tags: ['embeddings', 'search', 'rag', 'similarity'],
    downloads: 0,
    likes: 0,
    size: '90MB',
    license: 'apache-2.0',
    provider: 'huggingface',
    context_length: 512,
    is_featured: true,
    created: '2026-08-05'
  },
  // Translation Models
  {
    id: 'harz-translator',
    name: 'HARZ Hausa Translator',
    original_model: 'Helsinki-NLP/opus-mt-en-ha',
    type: 'translation',
    category: 'Translation',
    description: 'English to Hausa translation model. Built for the Nigerian market.',
    languages: ['en', 'ha'],
    tags: ['translation', 'hausa', 'nlp'],
    downloads: 0,
    likes: 0,
    size: '300MB',
    license: 'apache-2.0',
    provider: 'huggingface',
    context_length: 512,
    is_featured: false,
    created: '2026-08-05'
  },
  // Image Models
  {
    id: 'harz-stable-diffusion',
    name: 'HARZ Image Generator',
    original_model: 'stabilityai/stable-diffusion-xl-base-1.0',
    type: 'image-generation',
    category: 'Image',
    description: 'Stable Diffusion XL — generate images from text prompts. Great for marketing content and designs.',
    languages: ['en'],
    tags: ['image', 'generation', 'design', 'marketing'],
    downloads: 0,
    likes: 0,
    size: '6.9GB',
    license: 'openrail++',
    provider: 'huggingface',
    context_length: 77,
    is_featured: true,
    created: '2026-08-05'
  },
  // Speech Models
  {
    id: 'harz-whisper',
    name: 'HARZ Whisper',
    original_model: 'openai/whisper-large-v3',
    type: 'speech-to-text',
    category: 'Speech',
    description: 'OpenAI Whisper — speech-to-text transcription. Supports Hausa and 96 other languages.',
    languages: ['en', 'ha', 'fr', 'sw', 'yo', 'ig', 'pcm'],
    tags: ['speech', 'transcription', 'hausa', 'audio'],
    downloads: 0,
    likes: 0,
    size: '3GB',
    license: 'mit',
    provider: 'huggingface',
    context_length: 0,
    is_featured: true,
    created: '2026-08-05'
  },
  // Code Models
  {
    id: 'harz-coder',
    name: 'HARZ Code Assistant',
    original_model: 'Qwen/Qwen2.5-Coder-7B-Instruct',
    type: 'text-generation',
    category: 'Code',
    description: 'Qwen 2.5 Coder — code generation and completion. Supports 40+ programming languages.',
    languages: ['en'],
    tags: ['code', 'programming', 'developer', 'autocomplete'],
    downloads: 0,
    likes: 0,
    size: '14GB',
    license: 'apache-2.0',
    provider: 'huggingface',
    context_length: 32768,
    is_featured: false,
    created: '2026-08-05'
  }
];

// Curated datasets for African AI
const HARZ_DATASETS = [
  {
    id: 'hausa-text-corpus',
    name: 'Hausa Text Corpus',
    description: '50,000+ Hausa text samples from news, literature, and social media. Perfect for training Hausa language models.',
    size: '120MB',
    format: 'JSONL',
    languages: ['ha'],
    category: 'NLP',
    downloads: 0,
    tags: ['hausa', 'nlp', 'training', 'text'],
    license: 'cc-by-4.0',
    is_featured: true
  },
  {
    id: 'hausa-english-parallel',
    name: 'Hausa-English Parallel Corpus',
    description: '30,000+ sentence pairs for machine translation between Hausa and English.',
    size: '45MB',
    format: 'TSV',
    languages: ['ha', 'en'],
    category: 'Translation',
    downloads: 0,
    tags: ['translation', 'hausa', 'english', 'parallel'],
    license: 'cc-by-4.0',
    is_featured: true
  },
  {
    id: 'nigerian-pidgin-corpus',
    name: 'Nigerian Pidgin Corpus',
    description: '20,000+ Pidgin English text samples from social media, music, and conversations.',
    size: '35MB',
    format: 'JSONL',
    languages: ['pcm'],
    category: 'NLP',
    downloads: 0,
    tags: ['pidgin', 'nigeria', 'nlp', 'social'],
    license: 'cc-by-4.0',
    is_featured: false
  },
  {
    id: 'african-languages-audio',
    name: 'African Languages Audio Dataset',
    description: '10,000+ audio clips in Hausa, Yoruba, Igbo, and Swahili for speech recognition training.',
    size: '2.5GB',
    format: 'WAV+JSON',
    languages: ['ha', 'yo', 'ig', 'sw'],
    category: 'Speech',
    downloads: 0,
    tags: ['audio', 'speech', 'hausa', 'yoruba', 'igbo'],
    license: 'cc-by-4.0',
    is_featured: true
  },
  {
    id: 'nigerian-code-snippets',
    name: 'Nigerian Code Snippets',
    description: '15,000+ code snippets from Nigerian open-source projects. Great for training local code models.',
    size: '80MB',
    format: 'JSONL',
    languages: ['en'],
    category: 'Code',
    downloads: 0,
    tags: ['code', 'nigeria', 'programming', 'training'],
    license: 'mit',
    is_featured: false
  }
];

// HARZ Spaces — AI app demos
const HARZ_SPACES = [
  {
    id: 'harz-chat',
    name: 'HARZ AI Chat',
    description: 'Chat with HARZ AI in Hausa, English, or Pidgin. Powered by Llama 3.1.',
    model: 'harz-llama-3.1-8b',
    type: 'chat',
    status: 'live',
    url: 'https://harz-cloud-backend.onrender.com/ai/chat',
    author: 'HARZ Team',
    views: 0,
    likes: 0,
    is_featured: true
  },
  {
    id: 'harz-translator',
    name: 'Hausa Translator',
    description: 'Translate between English and Hausa instantly.',
    model: 'harz-translator',
    type: 'translation',
    status: 'live',
    url: 'https://harz-cloud-backend.onrender.com/ai/translate',
    author: 'HARZ Team',
    views: 0,
    likes: 0,
    is_featured: false
  },
  {
    id: 'harz-image-gen',
    name: 'HARZ Image Studio',
    description: 'Generate images from text prompts. Create marketing visuals, logos, and designs.',
    model: 'harz-stable-diffusion',
    type: 'image',
    status: 'coming-soon',
    url: null,
    author: 'HARZ Team',
    views: 0,
    likes: 0,
    is_featured: false
  },
  {
    id: 'harz-transcribe',
    name: 'HARZ Speech-to-Text',
    description: 'Transcribe Hausa and English audio to text in real-time.',
    model: 'harz-whisper',
    type: 'speech',
    status: 'coming-soon',
    url: null,
    author: 'HARZ Team',
    views: 0,
    likes: 0,
    is_featured: false
  }
];

// Leaderboard data
function getLeaderboard() {
  const modelLeaderboard = HARZ_MODELS
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 10)
    .map((m, i) => ({
      rank: i + 1,
      id: m.id,
      name: m.name,
      category: m.category,
      downloads: m.downloads,
      likes: m.likes
    }));

  const datasetLeaderboard = HARZ_DATASETS
    .sort((a, b) => b.downloads - a.downloads)
    .slice(0, 10)
    .map((d, i) => ({
      rank: i + 1,
      id: d.id,
      name: d.name,
      category: d.category,
      downloads: d.downloads
    }));

  return { models: modelLeaderboard, datasets: datasetLeaderboard };
}

// Get stats
function getHubStats() {
  return {
    total_models: HARZ_MODELS.length,
    total_datasets: HARZ_DATASETS.length,
    total_spaces: HARZ_SPACES.length,
    total_downloads: HARZ_MODELS.reduce((sum, m) => sum + m.downloads, 0),
    total_likes: HARZ_MODELS.reduce((sum, m) => sum + m.likes, 0),
    categories: [...new Set(HARZ_MODELS.map(m => m.category))],
    languages: [...new Set(HARZ_MODELS.flatMap(m => m.languages))],
    providers: ['huggingface', 'groq'],
    powered_by: 'Hugging Face Inference API',
    region: 'Africa'
  };
}

// Search models
function searchModels(query, filters = {}) {
  let results = HARZ_MODELS;
  
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(m => 
      m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.tags.some(t => t.toLowerCase().includes(q)) ||
      m.languages.some(l => l.toLowerCase().includes(q))
    );
  }
  
  if (filters.category) results = results.filter(m => m.category === filters.category);
  if (filters.type) results = results.filter(m => m.type === filters.type);
  if (filters.language) results = results.filter(m => m.languages.includes(filters.language));
  if (filters.featured) results = results.filter(m => m.is_featured);
  
  return results;
}

// Get model by ID
function getModel(modelId) {
  return HARZ_MODELS.find(m => m.id === modelId);
}

// Run inference
async function runInference(modelId, input, options = {}) {
  const model = getModel(modelId);
  if (!model) {
    return { success: false, error: 'Model not found' };
  }

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    return { success: false, error: 'Hugging Face token not configured' };
  }

  try {
    // Text generation
    if (model.type === 'text-generation') {
      const messages = options.messages || [{ role: 'user', content: input }];
      const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model.original_model,
          messages,
          max_tokens: options.max_tokens || 500,
          temperature: options.temperature || 0.7
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        // Increment download count
        model.downloads++;
        return {
          success: true,
          model: model.id,
          original_model: model.original_model,
          provider: 'huggingface',
          response: data.choices?.[0]?.message?.content || 'No response',
          tokens: data.usage?.total_tokens || 0
        };
      } else {
        return { success: false, error: `Inference failed: ${resp.status}` };
      }
    }

    // Translation
    if (model.type === 'translation') {
      const resp = await fetch(`https://api-inference.huggingface.co/models/${model.original_model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: input })
      });

      if (resp.ok) {
        const data = await resp.json();
        model.downloads++;
        return {
          success: true,
          model: model.id,
          provider: 'huggingface',
          response: Array.isArray(data) ? data[0]?.translation_text : data
        };
      } else {
        return { success: false, error: `Translation failed: ${resp.status}` };
      }
    }

    // Embeddings
    if (model.type === 'embeddings') {
      const resp = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${model.original_model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ inputs: input })
      });

      if (resp.ok) {
        const data = await resp.json();
        model.downloads++;
        return {
          success: true,
          model: model.id,
          provider: 'huggingface',
          embeddings: data
        };
      } else {
        return { success: false, error: `Embeddings failed: ${resp.status}` };
      }
    }

    // Speech-to-text
    if (model.type === 'speech-to-text') {
      return {
        success: false,
        error: 'Speech-to-text coming soon. Upload audio file via /ai/transcribe'
      };
    }

    // Image generation
    if (model.type === 'image-generation') {
      return {
        success: false,
        error: 'Image generation coming soon. Use /ai/generate-image'
      };
    }

    return { success: false, error: `Model type ${model.type} not supported yet` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Setup all HARZ AI Hub routes
function setupAIHub(app) {
  // === Model Hub ===
  
  // Get hub homepage/stats
  app.get('/ai-hub', (req, res) => {
    res.json({
      name: 'HARZ AI Hub',
      tagline: 'The African AI Model Hub',
      description: 'Browse, run, and share AI models built for Africa. Hausa, English, Pidgin, and more.',
      stats: getHubStats(),
      featured_models: HARZ_MODELS.filter(m => m.is_featured),
      featured_datasets: HARZ_DATASETS.filter(d => d.is_featured),
      featured_spaces: HARZ_SPACES.filter(s => s.is_featured)
    });
  });

  // List all models
  app.get('/ai-hub/models', (req, res) => {
    const { search, category, type, language, featured } = req.query;
    const results = searchModels(search, { category, type, language, featured: featured === 'true' });
    res.json({
      count: results.length,
      models: results,
      filters: { search, category, type, language, featured }
    });
  });

  // Get specific model
  app.get('/ai-hub/models/:id', (req, res) => {
    const model = getModel(req.params.id);
    if (model) {
      res.json({ model, provider: 'HARZ AI Hub' });
    } else {
      res.status(404).json({ error: 'Model not found' });
    }
  });

  // Run inference on a specific model
  app.post('/ai-hub/models/:id/run', async (req, res) => {
    const result = await runInference(req.params.id, req.body.input, req.body);
    res.json(result);
  });

  // === Datasets ===
  
  // List all datasets
  app.get('/ai-hub/datasets', (req, res) => {
    const { search, category, language } = req.query;
    let results = HARZ_DATASETS;
    
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(d =>
        d.name.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    if (category) results = results.filter(d => d.category === category);
    if (language) results = results.filter(d => d.languages.includes(language));
    
    res.json({ count: results.length, datasets: results });
  });

  // Get specific dataset
  app.get('/ai-hub/datasets/:id', (req, res) => {
    const dataset = HARZ_DATASETS.find(d => d.id === req.params.id);
    if (dataset) {
      res.json({ dataset });
    } else {
      res.status(404).json({ error: 'Dataset not found' });
    }
  });

  // === Spaces ===
  
  // List all spaces
  app.get('/ai-hub/spaces', (req, res) => {
    res.json({ count: HARZ_SPACES.length, spaces: HARZ_SPACES });
  });

  // Get specific space
  app.get('/ai-hub/spaces/:id', (req, res) => {
    const space = HARZ_SPACES.find(s => s.id === req.params.id);
    if (space) {
      space.views++;
      res.json({ space });
    } else {
      res.status(404).json({ error: 'Space not found' });
    }
  });

  // === Leaderboard ===
  
  app.get('/ai-hub/leaderboard', (req, res) => {
    res.json(getLeaderboard());
  });

  // === Compare models ===
  
  app.post('/ai-hub/compare', async (req, res) => {
    const { models: modelIds, input } = req.body;
    if (!modelIds || !Array.isArray(modelIds) || !input) {
      return res.status(400).json({ error: 'Provide models array and input text' });
    }

    const results = [];
    for (const id of modelIds.slice(0, 5)) {
      const result = await runInference(id, input, { max_tokens: 100 });
      results.push({
        model: id,
        name: getModel(id)?.name || id,
        success: result.success,
        response: result.response || result.error
      });
    }

    res.json({ count: results.length, results });
  });

  // === Categories & Languages ===
  
  app.get('/ai-hub/categories', (req, res) => {
    const categories = {};
    HARZ_MODELS.forEach(m => {
      if (!categories[m.category]) categories[m.category] = { count: 0, models: [] };
      categories[m.category].count++;
      categories[m.category].models.push({ id: m.id, name: m.name });
    });
    res.json({ categories });
  });

  app.get('/ai-hub/languages', (req, res) => {
    const languages = {};
    HARZ_MODELS.forEach(m => {
      m.languages.forEach(lang => {
        if (!languages[lang]) languages[lang] = { count: 0, models: [] };
        languages[lang].count++;
        languages[lang].models.push({ id: m.id, name: m.name });
      });
    });
    res.json({ languages });
  });

  // === Like a model ===
  
  app.post('/ai-hub/models/:id/like', (req, res) => {
    const model = getModel(req.params.id);
    if (model) {
      model.likes++;
      res.json({ success: true, likes: model.likes });
    } else {
      res.status(404).json({ error: 'Model not found' });
    }
  });

  console.log('✓ HARZ AI Hub module loaded — /ai-hub endpoints ready');
}

module.exports = { setupAIHub, HARZ_MODELS, HARZ_DATASETS, HARZ_SPACES, getHubStats };
