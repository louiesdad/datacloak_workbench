/**
 * Test Data Factories Example Test
 * 
 * Demonstrates how to use the test data factories for consistent test data generation.
 * This serves as both documentation and validation of the factory system.
 */

import {
  FactoryRegistry,
  userFactory,
  datasetFactory,
  sentimentFactory,
  fieldDataFactory,
  configFactory,
  cacheFactory,
  jobFactory,
  relationshipsFactory
} from '../factories';

describe('Test Data Factories', () => {
  beforeEach(() => {
    // Reset all factories before each test for consistent results
    FactoryRegistry.reset();
  });

  describe('Factory Registry', () => {
    it('should register and retrieve factories', () => {
      const user = FactoryRegistry.create('user');
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
    });

    it('should create multiple items with consistent sequence', () => {
      const users = FactoryRegistry.createMany('user', 3);
      expect(users).toHaveLength(3);
      expect(users[0].id).not.toBe(users[1].id);
    });
  });

  describe('User Factory', () => {
    it('should create a user with default values', () => {
      const user = userFactory.create();
      
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('username');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('role');
      expect(['admin', 'user', 'analyst', 'readonly']).toContain(user.role);
      expect(user.permissions).toBeInstanceOf(Array);
    });

    it('should create admin user with correct permissions', () => {
      const admin = userFactory.createAdmin();
      
      expect(admin.role).toBe('admin');
      expect(admin.isActive).toBe(true);
      expect(admin.permissions).toContain('read:admin');
      expect(admin.permissions).toContain('write:admin');
    });

    it('should create team with different roles', () => {
      const team = userFactory.createUserTeam(5);
      
      expect(team).toHaveLength(5);
      const adminUser = team.find(user => user.role === 'admin');
      expect(adminUser).toBeDefined();
    });
  });

  describe('Dataset Factory', () => {
    it('should create dataset with rows and schema', () => {
      const dataset = datasetFactory.create();
      
      expect(dataset).toHaveProperty('id');
      expect(dataset).toHaveProperty('rows');
      expect(dataset).toHaveProperty('schema');
      expect(dataset.rows.length).toBe(dataset.size);
      expect(dataset.schema?.columns).toBeInstanceOf(Array);
    });

    it('should create large dataset for performance testing', () => {
      const largeDataset = datasetFactory.createLargeDataset(1000);
      
      expect(largeDataset.size).toBe(1000);
      expect(largeDataset.rows).toHaveLength(1000);
      expect(largeDataset.name).toContain('large_dataset_1000_rows');
    });

    it('should create PII-rich dataset', () => {
      const piiDataset = datasetFactory.createPIIRichDataset(50);
      
      expect(piiDataset.size).toBe(50);
      expect(piiDataset.metadata.tags).toContain('pii');
      const piiColumns = piiDataset.schema?.columns.filter(col => col.hasPII);
      expect(piiColumns?.length).toBeGreaterThan(0);
    });

    it('should convert dataset to CSV format', () => {
      const dataset = datasetFactory.create({ size: 3 });
      const csv = datasetFactory.toCSV(dataset);
      
      expect(csv).toContain(','); // Should have CSV structure
      const lines = csv.split('\n');
      expect(lines.length).toBe(4); // Header + 3 rows
    });
  });

  describe('Sentiment Factory', () => {
    it('should create sentiment with valid scores', () => {
      const sentiment = sentimentFactory.create();
      
      expect(sentiment).toHaveProperty('sentiment');
      expect(sentiment).toHaveProperty('confidence');
      expect(sentiment).toHaveProperty('scores');
      expect(['positive', 'negative', 'neutral', 'mixed']).toContain(sentiment.sentiment);
      
      const totalScore = sentiment.scores.positive + sentiment.scores.negative + sentiment.scores.neutral + (sentiment.scores.mixed || 0);
      expect(totalScore).toBeCloseTo(1, 1); // Should sum to ~1
    });

    it('should create balanced dataset', () => {
      const dataset = sentimentFactory.createBalancedDataset(100);
      
      expect(dataset).toHaveLength(100);
      
      const sentimentCounts = {
        positive: dataset.filter(s => s.sentiment === 'positive').length,
        negative: dataset.filter(s => s.sentiment === 'negative').length,
        neutral: dataset.filter(s => s.sentiment === 'neutral').length,
        mixed: dataset.filter(s => s.sentiment === 'mixed').length
      };
      
      // Should be roughly balanced (within 5 of each other)
      const values = Object.values(sentimentCounts);
      const max = Math.max(...values);
      const min = Math.min(...values);
      expect(max - min).toBeLessThanOrEqual(5);
    });

    it('should create positive sentiment with high confidence', () => {
      const positive = sentimentFactory.createPositive();
      
      expect(positive.sentiment).toBe('positive');
      expect(positive.confidence).toBeGreaterThan(0.8);
      expect(positive.scores.positive).toBeGreaterThan(0.8);
    });
  });

  describe('Field Data Factory', () => {
    it('should create field with or without PII', () => {
      const field = fieldDataFactory.create();
      
      expect(field).toHaveProperty('fieldName');
      expect(field).toHaveProperty('text');
      expect(field).toHaveProperty('expectedPIITypes');
      expect(field.expectedPIITypes).toBeInstanceOf(Array);
    });

    it('should create field with specific PII type', () => {
      const emailField = fieldDataFactory.createWithPII('email');
      
      expect(emailField.expectedPIITypes).toContain('email');
      expect(emailField.text).toMatch(/@/); // Should contain email pattern
      expect(emailField.riskLevel).toBe('high');
    });

    it('should create dataset with specified PII percentage', () => {
      const fields = fieldDataFactory.createDataset(100, 0.3);
      
      expect(fields).toHaveLength(100);
      const piiFields = fields.filter(f => f.expectedPIITypes && f.expectedPIITypes.length > 0);
      const piiPercentage = piiFields.length / fields.length;
      expect(piiPercentage).toBeCloseTo(0.3, 1); // Within 10% of target
    });
  });

  describe('Config Factory', () => {
    it('should create config with environment-specific settings', () => {
      const config = configFactory.create();
      
      expect(config).toHaveProperty('environment');
      expect(config).toHaveProperty('settings');
      expect(['development', 'staging', 'production', 'test']).toContain(config.environment);
    });

    it('should create production config with appropriate settings', () => {
      const prodConfig = configFactory.createProduction();
      
      expect(prodConfig.environment).toBe('production');
      expect(prodConfig.settings.database.ssl).toBe(true);
      expect(prodConfig.settings.api.rateLimit.enabled).toBe(true);
      expect(prodConfig.settings.logging.level).toBe('info');
    });

    it('should create test config with safe defaults', () => {
      const testConfig = configFactory.createTest();
      
      expect(testConfig.environment).toBe('test');
      expect(testConfig.settings.database.name).toBe(':memory:');
      expect(testConfig.settings.sentiment.provider).toBe('mock');
      expect(testConfig.settings.api.rateLimit.enabled).toBe(false);
    });
  });

  describe('Cache Factory', () => {
    it('should create cache entry with metadata', () => {
      const entry = cacheFactory.create();
      
      expect(entry).toHaveProperty('key');
      expect(entry).toHaveProperty('value');
      expect(entry).toHaveProperty('ttl');
      expect(entry).toHaveProperty('metadata');
      expect(entry.expiresAt.getTime()).toBeGreaterThan(entry.createdAt.getTime());
    });

    it('should create expired cache entry', () => {
      const expired = cacheFactory.createExpired();
      
      expect(expired.expiresAt.getTime()).toBeLessThan(Date.now());
    });

    it('should create cache operation with duration', () => {
      const operation = cacheFactory.createOperation();
      
      expect(operation).toHaveProperty('operation');
      expect(operation).toHaveProperty('duration');
      expect(['get', 'set', 'delete', 'clear', 'exists', 'expire']).toContain(operation.operation);
    });
  });

  describe('Job Factory', () => {
    it('should create job with progress tracking', () => {
      const job = jobFactory.create();
      
      expect(job).toHaveProperty('type');
      expect(job).toHaveProperty('status');
      expect(job).toHaveProperty('progress');
      expect(job.progress.percentage).toBeGreaterThanOrEqual(0);
      expect(job.progress.percentage).toBeLessThanOrEqual(100);
    });

    it('should create completed job with result', () => {
      const completed = jobFactory.createCompleted();
      
      expect(completed.status).toBe('completed');
      expect(completed.progress.percentage).toBe(100);
      expect(completed).toHaveProperty('result');
    });

    it('should create failed job with error', () => {
      const failed = jobFactory.createFailed();
      
      expect(failed.status).toBe('failed');
      expect(failed).toHaveProperty('error');
      expect(failed.error?.message).toBeDefined();
    });

    it('should create job workflow', () => {
      const workflow = jobFactory.createWorkflow(3);
      
      expect(workflow).toHaveLength(3);
      workflow.forEach(job => {
        expect(job.metadata.tags).toContain('workflow');
      });
    });
  });

  describe('Relationships Factory', () => {
    it('should create workspace with related entities', () => {
      const workspace = relationshipsFactory.create();
      
      expect(workspace).toHaveProperty('projects');
      expect(workspace).toHaveProperty('users');
      expect(workspace.projects.length).toBeGreaterThan(0);
      expect(workspace.users.length).toBeGreaterThan(0);
      
      // Check project ownership relationships
      workspace.projects.forEach(project => {
        const owner = workspace.users.find(user => user.id === project.ownerId);
        expect(owner).toBeDefined();
      });
    });

    it('should create analysis session with relationships', () => {
      const session = relationshipsFactory.createAnalysisSession();
      
      expect(session).toHaveProperty('userId');
      expect(session).toHaveProperty('projectId');
      expect(session).toHaveProperty('datasetId');
      expect(session).toHaveProperty('sentimentResults');
      expect(session).toHaveProperty('jobs');
      expect(session.sentimentResults.length).toBeGreaterThan(0);
      expect(session.jobs.length).toBeGreaterThan(0);
    });

    it('should create complete workspace scenario', () => {
      const { workspace, analysisSessions } = relationshipsFactory.createCompleteWorkspace();
      
      expect(workspace.projects.length).toBeGreaterThan(0);
      expect(analysisSessions.length).toBeGreaterThan(0);
      
      // Verify relationships
      analysisSessions.forEach(session => {
        const user = workspace.users.find(u => u.id === session.userId);
        const project = workspace.projects.find(p => p.id === session.projectId);
        expect(user).toBeDefined();
        expect(project).toBeDefined();
      });
    });
  });

  describe('Factory Reset and Consistency', () => {
    it('should produce consistent results with same seed', () => {
      const user1 = userFactory.create();
      FactoryRegistry.reset(); // Reset to same seed
      const user2 = userFactory.create();
      
      // Should have same structure and similar values due to seeded random
      expect(user1.role).toBe(user2.role);
      expect(user1.firstName).toBe(user2.firstName);
    });

    it('should generate unique IDs across factory resets', () => {
      const ids = new Set();
      
      for (let i = 0; i < 10; i++) {
        const user = userFactory.create();
        expect(ids.has(user.id)).toBe(false);
        ids.add(user.id);
        FactoryRegistry.reset();
      }
    });
  });
});