import { promises as fs } from 'fs';
import { join } from 'path';

export interface TestDataOptions {
  rows: number;
  includePII: boolean;
  includeNulls: boolean;
  sentiment?: 'mixed' | 'positive' | 'negative';
}

export const createTestCSV = async (options: TestDataOptions): Promise<string> => {
  const { rows, includePII, includeNulls, sentiment = 'mixed' } = options;
  
  // Define headers based on options
  const headers = ['id', 'name', 'comment'];
  if (includePII) {
    headers.push('email', 'phone', 'address');
  }
  headers.push('created_date', 'amount', 'category');
  
  const csvContent = [headers.join(',')];
  
  // Sample data arrays
  const names = ['John Smith', 'Jane Doe', 'Bob Johnson', 'Alice Brown', 'Charlie Wilson', 'Diana Prince'];
  const categories = ['electronics', 'clothing', 'books', 'home', 'sports'];
  const positiveComments = [
    'I love this product!',
    'Excellent quality and service',
    'Amazing experience, highly recommend',
    'Fantastic value for money',
    'Outstanding customer support'
  ];
  const negativeComments = [
    'Terrible product, waste of money',
    'Awful quality, broke immediately',
    'Horrible customer service',
    'Very disappointed with this purchase',
    'Complete garbage, avoid at all costs'
  ];
  const neutralComments = [
    'It\'s okay, nothing special',
    'Average product, meets expectations',
    'Standard quality, reasonable price',
    'Works as described',
    'Decent but not exceptional'
  ];
  
  for (let i = 1; i <= rows; i++) {
    const row: string[] = [];
    
    // ID
    row.push(i.toString());
    
    // Name
    const name = includeNulls && Math.random() < 0.05 ? '' : names[i % names.length];
    row.push(`"${name}"`);
    
    // Comment (sentiment-based)
    let comment = '';
    if (sentiment === 'positive') {
      comment = positiveComments[i % positiveComments.length];
    } else if (sentiment === 'negative') {
      comment = negativeComments[i % negativeComments.length];
    } else {
      // Mixed sentiment
      const sentimentType = i % 3;
      if (sentimentType === 0) comment = positiveComments[i % positiveComments.length];
      else if (sentimentType === 1) comment = negativeComments[i % negativeComments.length];
      else comment = neutralComments[i % neutralComments.length];
    }
    row.push(`"${comment}"`);
    
    // PII fields (if included)
    if (includePII) {
      // Email
      const email = includeNulls && Math.random() < 0.05 ? '' : `user${i}@example.com`;
      row.push(email);
      
      // Phone
      const phone = includeNulls && Math.random() < 0.05 ? '' : `555-${String(i).padStart(4, '0')}`;
      row.push(phone);
      
      // Address
      const address = includeNulls && Math.random() < 0.05 ? '' : `${i} Main St, City ${i}`;
      row.push(`"${address}"`);
    }
    
    // Created date
    const date = new Date(2024, 0, 1 + (i % 365));
    row.push(date.toISOString().split('T')[0]);
    
    // Amount
    const amount = includeNulls && Math.random() < 0.05 ? '' : (Math.random() * 1000 + 10).toFixed(2);
    row.push(amount);
    
    // Category
    const category = categories[i % categories.length];
    row.push(category);
    
    csvContent.push(row.join(','));
  }
  
  return csvContent.join('\n');
};

export const createTestFiles = async (testDir: string) => {
  await fs.mkdir(testDir, { recursive: true });
  
  const files = {
    small: join(testDir, 'small-test.csv'),
    medium: join(testDir, 'medium-test.csv'),
    large: join(testDir, 'large-test.csv'),
    withPII: join(testDir, 'pii-test.csv'),
    positiveOnly: join(testDir, 'positive-sentiment.csv'),
    negativeOnly: join(testDir, 'negative-sentiment.csv'),
    invalidFormat: join(testDir, 'invalid.txt'),
    malformed: join(testDir, 'malformed.csv')
  };
  
  // Small file (10 rows)
  const smallData = await createTestCSV({ rows: 10, includePII: false, includeNulls: false });
  await fs.writeFile(files.small, smallData);
  
  // Medium file (1000 rows)
  const mediumData = await createTestCSV({ rows: 1000, includePII: true, includeNulls: true });
  await fs.writeFile(files.medium, mediumData);
  
  // Large file (10000 rows)
  const largeData = await createTestCSV({ rows: 10000, includePII: true, includeNulls: true });
  await fs.writeFile(files.large, largeData);
  
  // PII-focused file
  const piiData = await createTestCSV({ rows: 100, includePII: true, includeNulls: false });
  await fs.writeFile(files.withPII, piiData);
  
  // Sentiment-specific files
  const positiveData = await createTestCSV({ rows: 50, includePII: false, includeNulls: false, sentiment: 'positive' });
  await fs.writeFile(files.positiveOnly, positiveData);
  
  const negativeData = await createTestCSV({ rows: 50, includePII: false, includeNulls: false, sentiment: 'negative' });
  await fs.writeFile(files.negativeOnly, negativeData);
  
  // Invalid format file
  await fs.writeFile(files.invalidFormat, 'This is not a CSV file');
  
  // Malformed CSV
  await fs.writeFile(files.malformed, 'header1,header2\nvalue1\nvalue1,value2,value3');
  
  return files;
};

export const cleanupTestFiles = async (testDir: string) => {
  try {
    await fs.rmdir(testDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
};

// Mock platform bridge for browser testing
export const createMockPlatformBridge = () => {
  return {
    fileSystem: {
      selectFiles: async (): Promise<string[]> => {
        // In browser tests, we'll return mock file paths
        return ['/mock/test-file.csv'];
      },
      
      getFileInfo: async (path: string) => {
        // Return mock file info based on path
        const fileName = path.split('/').pop() || 'test-file.csv';
        return {
          name: fileName,
          path: path,
          size: fileName.includes('large') ? 50 * 1024 * 1024 : 1024 * 1024, // 50MB or 1MB
          lastModified: new Date(),
          type: 'text/csv'
        };
      },
      
      validateFile: async (path: string, maxSizeGB: number) => {
        const fileInfo = await this.getFileInfo(path);
        const sizeInGB = fileInfo.size / (1024 * 1024 * 1024);
        
        if (sizeInGB > maxSizeGB) {
          return {
            valid: false,
            error: `File too large: ${sizeInGB.toFixed(2)}GB (max: ${maxSizeGB}GB)`
          };
        }
        
        return { valid: true };
      },
      
      readFileContent: async (path: string): Promise<string> => {
        // Return mock CSV content for browser tests
        return await createTestCSV({ rows: 100, includePII: true, includeNulls: true });
      }
    },
    
    notifications: {
      show: (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        console.log(`[${type.toUpperCase()}] ${message}`);
      }
    }
  };
};