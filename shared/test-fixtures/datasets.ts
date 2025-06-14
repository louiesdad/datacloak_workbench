/**
 * Shared Test Fixtures - Datasets
 * 
 * Mock data and test fixtures for dataset-related testing across all packages
 */

import { Dataset, DatasetMetadata, ColumnInfo, FieldType, PIIType } from '../contracts/api';

// =============================================================================
// Sample Dataset Fixtures
// =============================================================================

export const SAMPLE_SMALL_DATASET: Dataset = {
  id: 'ds_test_001',
  name: 'Customer Feedback Sample',
  filename: 'customer_feedback_sample.csv',
  size: 2048,
  rowCount: 10,
  columnCount: 4,
  uploadedAt: '2024-01-14T10:00:00Z',
  lastModified: '2024-01-14T10:00:00Z',
  fileType: 'csv',
  status: 'ready',
  metadata: {
    delimiter: ',',
    encoding: 'utf-8',
    hasHeader: true,
    columns: [
      {
        name: 'customer_id',
        type: 'integer' as FieldType,
        confidence: 1.0,
        nullable: false,
        unique: true,
        hasPII: false,
        piiTypes: []
      },
      {
        name: 'email',
        type: 'email' as FieldType,
        confidence: 0.95,
        nullable: false,
        unique: true,
        hasPII: true,
        piiTypes: ['email' as PIIType]
      },
      {
        name: 'feedback',
        type: 'string' as FieldType,
        confidence: 1.0,
        nullable: true,
        unique: false,
        hasPII: false,
        piiTypes: []
      },
      {
        name: 'rating',
        type: 'integer' as FieldType,
        confidence: 1.0,
        nullable: false,
        unique: false,
        hasPII: false,
        piiTypes: []
      }
    ],
    preview: [
      { customer_id: 1, email: 'john@example.com', feedback: 'Great product!', rating: 5 },
      { customer_id: 2, email: 'jane@example.com', feedback: 'Could be better', rating: 3 },
      { customer_id: 3, email: 'bob@example.com', feedback: 'Amazing service', rating: 5 }
    ]
  }
};

export const SAMPLE_LARGE_DATASET: Dataset = {
  id: 'ds_test_002',
  name: 'Sales Data Large',
  filename: 'sales_data_large.xlsx',
  size: 52428800, // 50MB
  rowCount: 100000,
  columnCount: 12,
  uploadedAt: '2024-01-14T09:00:00Z',
  lastModified: '2024-01-14T09:30:00Z',
  fileType: 'excel',
  status: 'ready'
};

export const SAMPLE_PII_DATASET: Dataset = {
  id: 'ds_test_003',
  name: 'Employee Records (PII)',
  filename: 'employee_records.csv',
  size: 10240,
  rowCount: 50,
  columnCount: 8,
  uploadedAt: '2024-01-14T11:00:00Z',
  lastModified: '2024-01-14T11:00:00Z',
  fileType: 'csv',
  status: 'ready',
  metadata: {
    delimiter: ',',
    encoding: 'utf-8',
    hasHeader: true,
    columns: [
      {
        name: 'employee_id',
        type: 'string' as FieldType,
        confidence: 1.0,
        nullable: false,
        unique: true,
        hasPII: false,
        piiTypes: []
      },
      {
        name: 'full_name',
        type: 'string' as FieldType,
        confidence: 0.9,
        nullable: false,
        unique: false,
        hasPII: true,
        piiTypes: ['name' as PIIType]
      },
      {
        name: 'email',
        type: 'email' as FieldType,
        confidence: 0.98,
        nullable: false,
        unique: true,
        hasPII: true,
        piiTypes: ['email' as PIIType]
      },
      {
        name: 'phone',
        type: 'phone' as FieldType,
        confidence: 0.85,
        nullable: true,
        unique: false,
        hasPII: true,
        piiTypes: ['phone' as PIIType]
      },
      {
        name: 'ssn',
        type: 'ssn' as FieldType,
        confidence: 0.95,
        nullable: false,
        unique: true,
        hasPII: true,
        piiTypes: ['ssn' as PIIType]
      },
      {
        name: 'salary',
        type: 'currency' as FieldType,
        confidence: 0.9,
        nullable: false,
        unique: false,
        hasPII: false,
        piiTypes: []
      },
      {
        name: 'department',
        type: 'string' as FieldType,
        confidence: 1.0,
        nullable: false,
        unique: false,
        hasPII: false,
        piiTypes: []
      },
      {
        name: 'hire_date',
        type: 'date' as FieldType,
        confidence: 0.95,
        nullable: false,
        unique: false,
        hasPII: false,
        piiTypes: []
      }
    ],
    preview: [
      {
        employee_id: 'EMP001',
        full_name: 'John Smith',
        email: 'j.smith@company.com',
        phone: '555-123-4567',
        ssn: '123-45-6789',
        salary: 75000,
        department: 'Engineering',
        hire_date: '2020-01-15'
      },
      {
        employee_id: 'EMP002',
        full_name: 'Jane Doe',
        email: 'j.doe@company.com',
        phone: '555-987-6543',
        ssn: '987-65-4321',
        salary: 82000,
        department: 'Marketing',
        hire_date: '2019-03-22'
      }
    ]
  }
};

// =============================================================================
// Raw CSV Data Fixtures
// =============================================================================

export const SAMPLE_CSV_SMALL = `customer_id,email,feedback,rating
1,john@example.com,Great product!,5
2,jane@example.com,Could be better,3
3,bob@example.com,Amazing service,5
4,alice@example.com,Fast delivery,4
5,charlie@example.com,Poor quality,2
6,diana@example.com,Excellent support,5
7,eve@example.com,Average experience,3
8,frank@example.com,Highly recommend,5
9,grace@example.com,Not satisfied,1
10,henry@example.com,Will buy again,4`;

export const SAMPLE_CSV_WITH_PII = `employee_id,full_name,email,phone,ssn,salary,department,hire_date
EMP001,John Smith,j.smith@company.com,555-123-4567,123-45-6789,75000,Engineering,2020-01-15
EMP002,Jane Doe,j.doe@company.com,555-987-6543,987-65-4321,82000,Marketing,2019-03-22
EMP003,Bob Johnson,b.johnson@company.com,555-555-1234,111-22-3333,68000,Sales,2021-06-10
EMP004,Alice Brown,a.brown@company.com,555-444-5678,444-55-6666,91000,Engineering,2018-09-05
EMP005,Charlie Wilson,c.wilson@company.com,555-777-8888,777-88-9999,58000,Support,2022-02-28`;

export const SAMPLE_CSV_MIXED_TYPES = `id,name,age,score,active,created_at,ip_address,user_uuid
1,Product A,25,87.5,true,2024-01-15T10:30:00Z,192.168.1.100,550e8400-e29b-41d4-a716-446655440000
2,Product B,32,92.3,false,2024-01-14T14:22:33Z,10.0.0.1,6ba7b810-9dad-11d1-80b4-00c04fd430c8
3,Product C,18,78.9,true,2024-01-13T09:15:42Z,203.0.113.42,6ba7b811-9dad-11d1-80b4-00c04fd430c8
4,Product D,45,95.1,true,2024-01-12T16:45:19Z,172.16.254.1,6ba7b812-9dad-11d1-80b4-00c04fd430c8
5,Product E,29,83.7,false,2024-01-11T11:30:25Z,192.0.2.146,6ba7b813-9dad-11d1-80b4-00c04fd430c8`;

// =============================================================================
// Error Case Fixtures
// =============================================================================

export const SAMPLE_MALFORMED_CSV = `customer_id,email,feedback,rating
1,john@example.com,"Great product, really!",5
2,jane@example.com,"Could be better
with improvements",3
3,bob@example.com,Amazing service,5
4,alice@example.com,"Fast delivery",4
corrupted_line_here_without_proper_format
5,charlie@example.com,Poor quality,2`;

export const SAMPLE_EMPTY_DATASET: Dataset = {
  id: 'ds_test_empty',
  name: 'Empty Dataset',
  filename: 'empty.csv',
  size: 0,
  rowCount: 0,
  columnCount: 0,
  uploadedAt: '2024-01-14T12:00:00Z',
  lastModified: '2024-01-14T12:00:00Z',
  fileType: 'csv',
  status: 'error'
};

export const SAMPLE_PROCESSING_DATASET: Dataset = {
  id: 'ds_test_processing',
  name: 'Processing Dataset',
  filename: 'large_processing.csv',
  size: 1073741824, // 1GB
  rowCount: 0,
  columnCount: 0,
  uploadedAt: '2024-01-14T13:00:00Z',
  lastModified: '2024-01-14T13:00:00Z',
  fileType: 'csv',
  status: 'processing'
};

// =============================================================================
// Utility Functions for Test Data Generation
// =============================================================================

export function generateRandomDataset(options: {
  rowCount: number;
  includesPII?: boolean;
  fileType?: 'csv' | 'excel';
  status?: 'ready' | 'processing' | 'error';
}): Dataset {
  const { rowCount, includesPII = false, fileType = 'csv', status = 'ready' } = options;
  
  const baseColumns: ColumnInfo[] = [
    {
      name: 'id',
      type: 'integer',
      confidence: 1.0,
      nullable: false,
      unique: true,
      hasPII: false,
      piiTypes: []
    },
    {
      name: 'name',
      type: 'string',
      confidence: 0.9,
      nullable: false,
      unique: false,
      hasPII: includesPII,
      piiTypes: includesPII ? ['name'] : []
    },
    {
      name: 'value',
      type: 'float',
      confidence: 0.95,
      nullable: true,
      unique: false,
      hasPII: false,
      piiTypes: []
    }
  ];

  if (includesPII) {
    baseColumns.push({
      name: 'email',
      type: 'email',
      confidence: 0.98,
      nullable: false,
      unique: true,
      hasPII: true,
      piiTypes: ['email']
    });
  }

  return {
    id: `ds_generated_${Date.now()}`,
    name: `Generated Dataset ${rowCount} rows`,
    filename: `generated_${rowCount}.${fileType}`,
    size: rowCount * 100, // Rough estimate
    rowCount,
    columnCount: baseColumns.length,
    uploadedAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    fileType,
    status,
    metadata: {
      delimiter: ',',
      encoding: 'utf-8',
      hasHeader: true,
      columns: baseColumns,
      preview: generateSampleRows(3, baseColumns, includesPII)
    }
  };
}

function generateSampleRows(count: number, columns: ColumnInfo[], includesPII: boolean): Record<string, any>[] {
  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i <= count; i++) {
    const row: Record<string, any> = {};
    
    columns.forEach(col => {
      switch (col.type) {
        case 'integer':
          row[col.name] = i;
          break;
        case 'string':
          row[col.name] = col.name === 'name' ? `Sample Name ${i}` : `Value ${i}`;
          break;
        case 'float':
          row[col.name] = Math.round((Math.random() * 100) * 100) / 100;
          break;
        case 'email':
          row[col.name] = `user${i}@example.com`;
          break;
        default:
          row[col.name] = `Value ${i}`;
      }
    });
    
    rows.push(row);
  }
  
  return rows;
}

// =============================================================================
// Export Collections
// =============================================================================

export const ALL_SAMPLE_DATASETS = [
  SAMPLE_SMALL_DATASET,
  SAMPLE_LARGE_DATASET,
  SAMPLE_PII_DATASET,
  SAMPLE_EMPTY_DATASET,
  SAMPLE_PROCESSING_DATASET
];

export const SAMPLE_CSV_DATA = {
  small: SAMPLE_CSV_SMALL,
  withPII: SAMPLE_CSV_WITH_PII,
  mixedTypes: SAMPLE_CSV_MIXED_TYPES,
  malformed: SAMPLE_MALFORMED_CSV
};

export const TEST_FILE_SIZES = {
  tiny: 1024, // 1KB
  small: 1024 * 100, // 100KB  
  medium: 1024 * 1024, // 1MB
  large: 1024 * 1024 * 10, // 10MB
  huge: 1024 * 1024 * 100, // 100MB
  extreme: 1024 * 1024 * 1024 * 5 // 5GB
};