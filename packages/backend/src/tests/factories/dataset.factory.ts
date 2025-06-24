/**
 * Dataset Factory
 * 
 * Generates test datasets for various testing scenarios including
 * large file processing, batch operations, and performance testing.
 */

import { AbstractFactory, TestDataUtils, testRandom } from './base.factory';

export interface TestDataset {
  id: string;
  name: string;
  description: string;
  format: 'csv' | 'json' | 'xlsx' | 'txt';
  size: number;
  rows: TestDataRow[];
  metadata: {
    created: Date;
    source: string;
    version: string;
    tags: string[];
    owner: string;
  };
  schema?: {
    columns: Array<{
      name: string;
      type: 'string' | 'number' | 'date' | 'boolean';
      nullable: boolean;
      hasPII: boolean;
      piiTypes?: string[];
    }>;
  };
}

export interface TestDataRow {
  id: string;
  data: Record<string, any>;
  metadata?: {
    rowNumber: number;
    processingTime?: number;
    errors?: string[];
  };
}

export class DatasetFactory extends AbstractFactory<TestDataset> {
  build(overrides?: Partial<TestDataset>): TestDataset {
    const name = `test_dataset_${this.sequence()}`;
    const format = testRandom.choice(['csv', 'json', 'xlsx', 'txt'] as const);
    const size = testRandom.integer(10, 100);
    
    const columns = this.generateColumns();
    const rows = this.generateRows(size, columns);

    const base: TestDataset = {
      id: this.generateUuid(),
      name,
      description: `Test dataset for ${name} containing ${size} rows`,
      format,
      size,
      rows,
      metadata: {
        created: this.generateTimestamp(),
        source: 'test_factory',
        version: '1.0.0',
        tags: ['test', 'synthetic', format],
        owner: `test_user_${this.sequence()}`
      },
      schema: {
        columns
      }
    };

    return this.merge(base, overrides);
  }

  /**
   * Generate column definitions for the dataset
   */
  private generateColumns(): Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'boolean';
    nullable: boolean;
    hasPII: boolean;
    piiTypes?: string[];
  }> {
    const columnTemplates = [
      { name: 'id', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'timestamp', type: 'date' as const, nullable: false, hasPII: false },
      { name: 'user_email', type: 'string' as const, nullable: true, hasPII: true, piiTypes: ['email'] },
      { name: 'phone_number', type: 'string' as const, nullable: true, hasPII: true, piiTypes: ['phone'] },
      { name: 'customer_name', type: 'string' as const, nullable: true, hasPII: true, piiTypes: ['name'] },
      { name: 'feedback_text', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'rating', type: 'number' as const, nullable: false, hasPII: false },
      { name: 'is_verified', type: 'boolean' as const, nullable: false, hasPII: false },
      { name: 'category', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'address', type: 'string' as const, nullable: true, hasPII: true, piiTypes: ['address'] }
    ];

    // Select 4-8 columns randomly
    const columnCount = testRandom.integer(4, 8);
    const selectedColumns = [];
    
    // Always include id and feedback_text
    selectedColumns.push(
      { ...columnTemplates[0] },
      { ...columnTemplates[5] }
    );

    // Add random additional columns
    for (let i = 0; i < columnCount - 2; i++) {
      const randomColumn = testRandom.choice(columnTemplates.slice(1));
      if (!selectedColumns.some(col => col.name === randomColumn.name)) {
        selectedColumns.push({ ...randomColumn });
      }
    }

    return selectedColumns;
  }

  /**
   * Generate test data rows based on column definitions
   */
  private generateRows(count: number, columns: any[]): TestDataRow[] {
    const rows: TestDataRow[] = [];

    for (let i = 0; i < count; i++) {
      const data: Record<string, any> = {};

      for (const column of columns) {
        if (column.nullable && testRandom.boolean()) {
          data[column.name] = null;
          continue;
        }

        switch (column.type) {
          case 'string':
            if (column.hasPII) {
              data[column.name] = this.generatePIIValue(column.piiTypes?.[0] || 'text');
            } else if (column.name === 'feedback_text') {
              const sentiment = testRandom.choice(['positive', 'negative', 'neutral', 'mixed']);
              data[column.name] = TestDataUtils.generateText(sentiment, testRandom.integer(50, 200));
            } else if (column.name === 'category') {
              data[column.name] = testRandom.choice(['support', 'sales', 'feedback', 'complaint', 'inquiry']);
            } else {
              data[column.name] = `${column.name}_${i}_${testRandom.string(6)}`;
            }
            break;

          case 'number':
            if (column.name === 'rating') {
              data[column.name] = testRandom.integer(1, 5);
            } else {
              data[column.name] = testRandom.integer(1, 1000);
            }
            break;

          case 'date':
            data[column.name] = this.generateTimestamp(testRandom.integer(0, 30));
            break;

          case 'boolean':
            data[column.name] = testRandom.boolean();
            break;

          default:
            data[column.name] = `value_${i}`;
        }
      }

      rows.push({
        id: `row_${i}`,
        data,
        metadata: {
          rowNumber: i + 1
        }
      });
    }

    return rows;
  }

  /**
   * Generate PII values based on type
   */
  private generatePIIValue(piiType: string): string {
    const pii = TestDataUtils.generatePII();
    
    switch (piiType) {
      case 'email':
        return pii.email;
      case 'phone':
        return pii.phone;
      case 'name':
        return pii.name;
      case 'address':
        return pii.address;
      case 'ssn':
        return pii.ssn;
      case 'credit_card':
        return pii.creditCard;
      default:
        return `pii_${piiType}_${testRandom.string(8)}`;
    }
  }

  /**
   * Create a large dataset for performance testing
   */
  createLargeDataset(rowCount: number = 10000, overrides?: Partial<TestDataset>): TestDataset {
    return this.create({
      name: `large_dataset_${rowCount}_rows`,
      description: `Large test dataset with ${rowCount} rows for performance testing`,
      size: rowCount,
      ...overrides
    });
  }

  /**
   * Create a dataset with high PII density
   */
  createPIIRichDataset(rowCount: number = 100, overrides?: Partial<TestDataset>): TestDataset {
    const piiColumns = [
      { name: 'id', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'customer_email', type: 'string' as const, nullable: false, hasPII: true, piiTypes: ['email'] },
      { name: 'phone_number', type: 'string' as const, nullable: false, hasPII: true, piiTypes: ['phone'] },
      { name: 'full_name', type: 'string' as const, nullable: false, hasPII: true, piiTypes: ['name'] },
      { name: 'home_address', type: 'string' as const, nullable: false, hasPII: true, piiTypes: ['address'] },
      { name: 'ssn', type: 'string' as const, nullable: true, hasPII: true, piiTypes: ['ssn'] },
      { name: 'feedback', type: 'string' as const, nullable: false, hasPII: false }
    ];

    const rows = this.generateRows(rowCount, piiColumns);

    return this.create({
      name: `pii_rich_dataset_${rowCount}_rows`,
      description: `Dataset with high PII density for privacy testing`,
      size: rowCount,
      rows,
      schema: { columns: piiColumns },
      metadata: {
        ...this.create().metadata,
        tags: ['test', 'pii', 'privacy', 'high-risk']
      },
      ...overrides
    });
  }

  /**
   * Create a clean dataset without PII
   */
  createCleanDataset(rowCount: number = 100, overrides?: Partial<TestDataset>): TestDataset {
    const cleanColumns = [
      { name: 'id', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'timestamp', type: 'date' as const, nullable: false, hasPII: false },
      { name: 'feedback_text', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'rating', type: 'number' as const, nullable: false, hasPII: false },
      { name: 'category', type: 'string' as const, nullable: false, hasPII: false },
      { name: 'is_verified', type: 'boolean' as const, nullable: false, hasPII: false }
    ];

    const rows = this.generateRows(rowCount, cleanColumns);

    return this.create({
      name: `clean_dataset_${rowCount}_rows`,
      description: `Clean dataset without PII for general testing`,
      size: rowCount,
      rows,
      schema: { columns: cleanColumns },
      metadata: {
        ...this.create().metadata,
        tags: ['test', 'clean', 'no-pii', 'safe']
      },
      ...overrides
    });
  }

  /**
   * Convert dataset to CSV format (string)
   */
  toCSV(dataset: TestDataset): string {
    if (!dataset.schema?.columns) {
      throw new Error('Dataset schema is required for CSV conversion');
    }

    const headers = dataset.schema.columns.map(col => col.name);
    const csvRows = [headers.join(',')];

    for (const row of dataset.rows) {
      const values = headers.map(header => {
        const value = row.data[header];
        if (value === null || value === undefined) {
          return '';
        }
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }

  /**
   * Convert dataset to JSON format
   */
  toJSON(dataset: TestDataset): object {
    return {
      id: dataset.id,
      name: dataset.name,
      description: dataset.description,
      metadata: dataset.metadata,
      schema: dataset.schema,
      data: dataset.rows.map(row => row.data)
    };
  }
}

// Export factory instance
export const datasetFactory = new DatasetFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('dataset', datasetFactory);