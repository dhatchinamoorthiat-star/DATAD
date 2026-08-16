const path = require('path');

process.env.NVIDIA_API_KEY = 'test-nvidia-key';
process.env.AI_PRIMARY_PROVIDER = 'nvidia';
process.env.AI_FALLBACK_PROVIDER = 'ollama';
process.env.NODE_ENV = 'test';

describe('NVIDIA NIM Migration', () => {

  describe('ModelRegistry — Capability-Driven Scoring', () => {
    let registry;

    beforeAll(() => {
      registry = require('../ai/runtime-v2/modelRegistry');
    });

    test('lists all models', () => {
      const all = registry.listAllModels();
      expect(all.length).toBeGreaterThan(0);
      const nvidiaModels = all.filter((m) => m.provider === 'nvidia');
      expect(nvidiaModels.length).toBeGreaterThanOrEqual(3);
    });

    test('finds models by provider', () => {
      const nvidiaModels = registry.findModelsByProvider('nvidia');
      expect(nvidiaModels.length).toBeGreaterThanOrEqual(3);
      nvidiaModels.forEach((m) => expect(m.provider).toBe('nvidia'));
    });

    test('gets a specific model', () => {
      const model = registry.getModel('meta/llama-3.3-70b-instruct');
      expect(model).not.toBeNull();
      expect(model.provider).toBe('nvidia');
      expect(model.reasoningScore).toBeDefined();
      expect(model.codingScore).toBeDefined();
      expect(model.writingScore).toBeDefined();
      expect(model.speed).toBeDefined();
      expect(model.cost).toBeDefined();
      expect(model.contextWindow).toBeDefined();
      expect(model.visionSupport).toBeDefined();
      expect(model.embeddingSupport).toBeDefined();
      expect(model.availability).toBeDefined();
    });

    test('scores models for reasoning capability', () => {
      const ranked = registry.rankModelsForCapability('reasoning', 3);
      expect(ranked.length).toBe(3);
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    });

    test('finds best model for reasoning', () => {
      const best = registry.findBestModelForCapability('reasoning');
      expect(best).not.toBeNull();
      expect(best.score).toBeGreaterThan(0);
    });

    test('scores models for a specific intent', () => {
      // meta/llama-3.3-70b-instruct was removed from the registry after a
      // live sweep found it consistently times out on this NVIDIA account
      // (see modelRegistry.js). Using a model still in the registry.
      const score = registry.scoreModelForIntent('meta/llama-3.1-70b-instruct', 'coding');
      expect(score).toBeGreaterThan(0);
    });

    test('ranks models for intent', () => {
      const ranked = registry.rankModelsForIntent('coding', 3);
      expect(ranked.length).toBe(3);
      expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    });

    test('embedding model has embeddingSupport true', () => {
      const model = registry.getModel('nvidia/nv-embedqa-e5-v5');
      expect(model).not.toBeNull();
      expect(model.embeddingSupport).toBe(true);
    });
  });

  describe('Router — Fallback Chain', () => {
    let router;

    beforeAll(() => {
      router = require('../ai/router');
    });

    test('routes summarise-note to a provider', () => {
      const provider = router.routeTask('summarise-note');
      expect(['nvidia', 'ollama', 'groq', 'openai']).toContain(provider);
    });

    test('routes chat to a provider', () => {
      const provider = router.routeTask('chat');
      expect(provider).toBeTruthy();
    });

    test('routes review-resume to a provider', () => {
      const provider = router.routeTask('review-resume');
      expect(provider).toBeTruthy();
    });

    test('estimates cost for NVIDIA', () => {
      const cost = router.estimateCost('nvidia', 1000, 200);
      expect(cost).toBeGreaterThan(0);
    });

    test('estimates zero cost for Ollama', () => {
      const cost = router.estimateCost('ollama', 1000, 200);
      expect(cost).toBe(0);
    });

    test('TASK_CAPABILITY maps all tasks', () => {
      const tasks = [
        'summarise-note', 'news-summary', 'moderation', 'resume-tip',
        'daily-reflection', 'daily-briefing', 'daily-case',
        'company-enrichment', 'interview-questions', 'planner-suggest',
        'chat', 'review-resume', 'career-advice', 'case-framework',
        'weekly-newsletter', 'fact-verify',
      ];
      for (const task of tasks) {
        expect(router.TASK_CAPABILITY[task]).toBeTruthy();
      }
    });
  });

  describe('NvidiaProvider', () => {
    let NvidiaProvider;

    beforeAll(() => {
      NvidiaProvider = require('../ai/providers/nvidiaProvider');
    });

    test('creates provider with config', () => {
      const provider = new NvidiaProvider({
        model: 'meta/llama-3.3-70b-instruct',
        maxTokens: 2048,
        temperature: 0.7,
      });
      expect(provider.name).toBe('nvidia');
      expect(provider.model).toBe('meta/llama-3.3-70b-instruct');
      expect(provider.isAvailable()).toBe(true);
    });

    test('isAvailable returns false without NVIDIA_API_KEY', () => {
      const key = process.env.NVIDIA_API_KEY;
      delete process.env.NVIDIA_API_KEY;
      const provider = new NvidiaProvider({});
      expect(provider.isAvailable()).toBe(false);
      process.env.NVIDIA_API_KEY = key;
    });

    test('getModelInfo returns defaults for unknown model', () => {
      const provider = new NvidiaProvider({});
      const info = provider.getModelInfo('unknown-model');
      expect(info.contextWindow).toBe(128000);
      expect(info.supportsVision).toBe(false);
    });

    test('getModelInfo returns known model info', () => {
      const provider = new NvidiaProvider({});
      const info = provider.getModelInfo('nvidia/nemotron-4-340b-instruct');
      expect(info.contextWindow).toBe(4096);
      expect(info.maxTokens).toBe(1024);
    });
  });

  describe('Provider Factory', () => {
    let factory;

    beforeAll(() => {
      factory = require('../ai/providers');
    });

    test('buildProvider creates NvidiaProvider for nvidia', () => {
      const provider = factory.buildProvider('nvidia');
      expect(provider.constructor.name).toBe('NvidiaProvider');
      expect(provider.name).toBe('nvidia');
    });

    test('buildProvider creates AnthropicProvider for anthropic', () => {
      const provider = factory.buildProvider('anthropic');
      expect(provider.constructor.name).toBe('AnthropicProvider');
    });

    test('getProvider returns nvidia when NVIDIA_API_KEY is set', () => {
      factory.clearCache();
      const provider = factory.getProvider();
      expect(provider.name).toBe('nvidia');
    });

    test('getProvider returns ollama when NVIDIA_API_KEY is not set', () => {
      const key = process.env.NVIDIA_API_KEY;
      delete process.env.NVIDIA_API_KEY;
      factory.clearCache();
      const provider = factory.getProvider();
      expect(provider.name).toBe('ollama');
      process.env.NVIDIA_API_KEY = key;
      factory.clearCache();
    });
  });

  describe('Embeddings — NVIDIA Priority', () => {
    let embed;

    beforeAll(() => {
      // Mock the OpenAI client to prevent real API calls
      jest.mock('openai', () => {
        const mockCreate = jest.fn().mockResolvedValue({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        });
        return jest.fn().mockImplementation(() => ({
          embeddings: { create: mockCreate },
          chat: {
            completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: 'test' } }] }) },
          },
        }));
      });
      embed = require('../ai/embeddings/embed');
    });

    afterAll(() => {
      jest.restoreAllMocks();
    });

    test('EMBEDDING_DIM is 1536', () => {
      expect(embed.EMBEDDING_DIM).toBe(1536);
    });

    test('cosineSimilarity returns 1 for identical vectors', () => {
      const sim = embed.cosineSimilarity([1, 2, 3], [1, 2, 3]);
      expect(sim).toBeCloseTo(1, 5);
    });

    test('cosineSimilarity returns 0 for null inputs', () => {
      expect(embed.cosineSimilarity(null, [1, 2, 3])).toBe(0);
      expect(embed.cosineSimilarity([1, 2, 3], null)).toBe(0);
    });

    test('cosineSimilarity returns 0 for mismatched dimensions', () => {
      expect(embed.cosineSimilarity([1, 2], [1, 2, 3])).toBe(0);
    });
  });

  describe('Automation Config — Defaults', () => {
    let cfg;

    beforeAll(() => {
      cfg = require('../config/automation');
    });

    test('primary provider defaults to nvidia', () => {
      expect(cfg.providers.primary).toBe('nvidia');
    });

    test('fallback provider defaults to ollama', () => {
      expect(cfg.providers.fallback).toBe('ollama');
    });

    test('nvidia config has correct baseURL', () => {
      expect(cfg.providers.nvidia.baseURL).toBe('https://integrate.api.nvidia.com/v1');
    });

    test('ollama config exists', () => {
      expect(cfg.providers.ollama).toBeDefined();
      expect(cfg.providers.ollama.apiKey).toBe('ollama');
    });
  });

  describe('CostOptimizer — NVIDIA Support', () => {
    let costOptimizer;

    beforeAll(() => {
      costOptimizer = require('../ai/runtime-v2/costOptimizer');
    });

    test('estimateCost for nvidia uses correct rates', () => {
      const cost = costOptimizer.estimateCost({ provider: 'nvidia', promptTokens: 1000, completionTokens: 200 });
      expect(cost).toBeCloseTo(0.00044, 6);
    });

    test('getCostProfile for nvidia returns budget tier', () => {
      const profile = costOptimizer.getCostProfile('nvidia');
      expect(profile.tier).toBe('budget');
      expect(profile.costScore).toBe(88);
    });

    test('getCostProfile for ollama returns free tier', () => {
      const profile = costOptimizer.getCostProfile('ollama');
      expect(profile.tier).toBe('free');
      expect(profile.costScore).toBe(100);
    });
  });

  describe('LatencyOptimizer — NVIDIA Support', () => {
    let latencyOptimizer;

    beforeAll(() => {
      latencyOptimizer = require('../ai/runtime-v2/latencyOptimizer');
    });

    test('LATENCY_PROFILES includes nvidia', () => {
      expect(latencyOptimizer.LATENCY_PROFILES.nvidia).toBeDefined();
      expect(latencyOptimizer.LATENCY_PROFILES.nvidia.tier).toBe('fast');
    });

    test('estimateLatency for nvidia returns 600ms', () => {
      expect(latencyOptimizer.estimateLatency('nvidia')).toBe(600);
    });

    test('getLatencyProfile for nvidia returns correct profile', () => {
      const profile = latencyOptimizer.getLatencyProfile('nvidia');
      expect(profile.tier).toBe('fast');
      expect(profile.latencyScore).toBe(88);
    });
  });
});
