import { v4 as uuidv4 } from 'uuid';
import { Factory, TestDataOptions } from './types';

export interface TestDataset {
  id: string;
  filename: string;
  originalFilename: string;
  size: number;
  recordCount: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
  piiDetected?: number;
  complianceScore?: number;
  riskLevel?: string;
}

export interface TestAnalysisBatch {
  id: string;
  datasetId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRecords: number;
  completedRecords: number;
  createdAt: string;
  updatedAt: string;
}

class DatasetFactory implements Factory<TestDataset> {
  create(options: TestDataOptions = {}): TestDataset {
    const id = uuidv4();
    const now = new Date().toISOString();
    
    return {
      id,
      filename: `dataset-${id.slice(0, 8)}.csv`,
      originalFilename: options.overrides?.originalFilename || 'test-data.csv',
      size: options.overrides?.size || 1024,
      recordCount: options.overrides?.recordCount || 100,
      mimeType: options.overrides?.mimeType || 'text/csv',
      createdAt: now,
      updatedAt: now,
      piiDetected: options.overrides?.piiDetected || 0,
      complianceScore: options.overrides?.complianceScore || 95.5,
      riskLevel: options.overrides?.riskLevel || 'low',
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestDataset[] {
    return Array.from({ length: count }, (_, index) => 
      this.create({
        ...options,
        overrides: {
          ...options.overrides,
          originalFilename: `test-data-${index + 1}.csv`
        }
      })
    );
  }

  build(overrides: Partial<TestDataset> = {}): TestDataset {
    return this.create({ overrides });
  }

  // Specialized factory methods
  createWithPII(piiCount: number = 5): TestDataset {
    return this.create({
      overrides: {
        piiDetected: piiCount,
        complianceScore: Math.max(50, 95 - piiCount * 5),
        riskLevel: piiCount > 10 ? 'high' : piiCount > 5 ? 'medium' : 'low'
      }
    });
  }

  createLarge(recordCount: number = 10000): TestDataset {
    return this.create({
      overrides: {
        recordCount,
        size: recordCount * 50, // Approximate 50 bytes per record
        originalFilename: 'large-dataset.csv'
      }
    });
  }
}

class AnalysisBatchFactory implements Factory<TestAnalysisBatch> {
  create(options: TestDataOptions = {}): TestAnalysisBatch {
    const id = uuidv4();
    const now = new Date().toISOString();
    const totalRecords = options.overrides?.totalRecords || 100;
    const progress = options.overrides?.progress || 0;
    
    return {
      id,
      datasetId: options.overrides?.datasetId || uuidv4(),
      status: options.overrides?.status || 'pending',
      progress,
      totalRecords,
      completedRecords: Math.floor((progress / 100) * totalRecords),
      createdAt: now,
      updatedAt: now,
      ...options.overrides
    };
  }

  createMany(count: number, options: TestDataOptions = {}): TestAnalysisBatch[] {
    return Array.from({ length: count }, () => this.create(options));
  }

  build(overrides: Partial<TestAnalysisBatch> = {}): TestAnalysisBatch {
    return this.create({ overrides });
  }

  createCompleted(datasetId: string): TestAnalysisBatch {
    return this.create({
      overrides: {
        datasetId,
        status: 'completed' as const,
        progress: 100,
        completedRecords: 100,
        totalRecords: 100
      }
    });
  }
}

// Export factory instances
export const datasetFactory = new DatasetFactory();
export const analysisBatchFactory = new AnalysisBatchFactory();

// CSV data generator
export function generateCSVData(records: number = 10): string {
  const headers = ['name', 'email', 'comment', 'rating'];
  const rows = [headers.join(',')];
  
  for (let i = 0; i < records; i++) {
    const row = [
      `User ${i + 1}`,
      `user${i + 1}@example.com`,
      `This is a test comment ${i + 1}`,
      Math.floor(Math.random() * 5) + 1
    ];
    rows.push(row.join(','));
  }
  
  return rows.join('\n');
}