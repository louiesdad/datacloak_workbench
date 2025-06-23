import { randomBytes, createHash } from 'crypto';
import * as bcrypt from 'bcrypt';

export class TestDataGenerators {
  static generateUser(overrides: Partial<any> = {}) {
    const id = Math.floor(Math.random() * 10000);
    return {
      id,
      email: `user${id}@test.com`,
      password: bcrypt.hashSync('password123', 10),
      name: `Test User ${id}`,
      role: 'user',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateFile(overrides: Partial<any> = {}) {
    const id = Math.floor(Math.random() * 10000);
    return {
      id,
      filename: `test-file-${id}.csv`,
      filepath: `/uploads/test-file-${id}.csv`,
      size: Math.floor(Math.random() * 1000000),
      mimetype: 'text/csv',
      user_id: 1,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateAnalysisResult(overrides: Partial<any> = {}) {
    return {
      id: Math.floor(Math.random() * 10000),
      file_id: 1,
      sentiment_score: Math.random() * 2 - 1, // -1 to 1
      sentiment_label: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
      pii_detected: Math.random() > 0.5,
      pii_types: JSON.stringify(['email', 'phone', 'ssn']),
      masked_content: 'This is a masked content with [REDACTED] information',
      processing_time: Math.floor(Math.random() * 5000),
      created_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateJob(overrides: Partial<any> = {}) {
    const id = randomBytes(16).toString('hex');
    return {
      id,
      type: 'sentiment-analysis',
      status: 'pending',
      data: JSON.stringify({ fileId: 1, options: {} }),
      result: null,
      error: null,
      attempts: 0,
      max_attempts: 3,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: null,
      ...overrides
    };
  }

  static generateApiKey(userId: number, overrides: Partial<any> = {}) {
    const key = `test_${randomBytes(32).toString('hex')}`;
    return {
      id: Math.floor(Math.random() * 10000),
      key: createHash('sha256').update(key).digest('hex'),
      user_id: userId,
      name: 'Test API Key',
      permissions: JSON.stringify(['read', 'write']),
      last_used: null,
      created_at: new Date().toISOString(),
      ...overrides
    };
  }

  static generateCSVContent(rows: number = 10, incluePII: boolean = false) {
    const headers = ['id', 'text', 'date', 'category'];
    if (incluePII) {
      headers.push('email', 'phone');
    }

    const lines = [headers.join(',')];
    
    for (let i = 0; i < rows; i++) {
      const row = [
        i + 1,
        `Sample text ${i} with some content`,
        new Date(Date.now() - Math.random() * 86400000 * 30).toISOString(),
        ['tech', 'business', 'health'][Math.floor(Math.random() * 3)]
      ];

      if (incluePII) {
        row.push(
          `user${i}@example.com`,
          `555-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}-${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
        );
      }

      lines.push(row.map(v => `"${v}"`).join(','));
    }

    return lines.join('\\n');
  }

  static generateBatchData(count: number = 5) {
    return Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      text: `Sample text ${i} for batch processing`,
      metadata: {
        source: 'test',
        timestamp: new Date().toISOString()
      }
    }));
  }

  static generateWebSocketMessage(type: string = 'progress', overrides: any = {}) {
    const baseMessage = {
      type,
      timestamp: Date.now(),
      id: randomBytes(8).toString('hex')
    };

    const messageTypes: Record<string, any> = {
      progress: {
        ...baseMessage,
        data: {
          jobId: randomBytes(16).toString('hex'),
          progress: Math.random() * 100,
          status: 'processing',
          message: 'Processing file...'
        }
      },
      error: {
        ...baseMessage,
        data: {
          code: 'PROCESSING_ERROR',
          message: 'An error occurred during processing',
          details: {}
        }
      },
      complete: {
        ...baseMessage,
        data: {
          jobId: randomBytes(16).toString('hex'),
          result: {
            sentiment: 'positive',
            score: 0.85,
            piiDetected: false
          }
        }
      }
    };

    return {
      ...messageTypes[type],
      ...overrides
    };
  }

  static generateSSEEvent(event: string = 'progress', data: any = {}) {
    const defaultData = {
      progress: { percent: 50, message: 'Processing...' },
      complete: { status: 'success', result: {} },
      error: { code: 'ERROR', message: 'Something went wrong' }
    };

    return `event: ${event}\\ndata: ${JSON.stringify(data || defaultData[event] || {})}\\n\\n`;
  }

  static generateAuthToken(userId: number, expiresIn: string = '1h') {
    // Mock JWT token structure
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ 
      userId, 
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600 
    })).toString('base64');
    const signature = randomBytes(32).toString('base64');
    
    return `${header}.${payload}.${signature}`;
  }
}