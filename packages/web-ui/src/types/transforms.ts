// Transform Engine Types
// Defines the data transformation system for the TransformDesigner

export type TransformOperationType = 
  | 'filter'
  | 'sort'
  | 'join'
  | 'aggregate'
  | 'compute'
  | 'rename'
  | 'select'
  | 'deduplicate';

export type ComparisonOperator = 
  | 'equals'
  | 'not_equals'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'contains'
  | 'starts_with'
  | 'ends_with'
  | 'regex'
  | 'is_null'
  | 'is_not_null';

export type AggregateFunction = 
  | 'count'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'first'
  | 'last'
  | 'distinct_count';

export type JoinType = 
  | 'inner'
  | 'left'
  | 'right'
  | 'full';

export type SortDirection = 'asc' | 'desc';

export interface TransformOperation {
  id: string;
  type: TransformOperationType;
  name: string;
  description?: string;
  enabled: boolean;
  config: TransformConfig;
}

export type TransformConfig = 
  | FilterConfig
  | SortConfig
  | JoinConfig
  | AggregateConfig
  | ComputeConfig
  | RenameConfig
  | SelectConfig
  | DeduplicateConfig;

export interface FilterConfig {
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean | null;
  caseSensitive?: boolean;
}

export interface SortConfig {
  fields: Array<{
    field: string;
    direction: SortDirection;
  }>;
}

export interface JoinConfig {
  rightTable: string;
  type: JoinType;
  conditions: Array<{
    leftField: string;
    rightField: string;
  }>;
}

export interface AggregateConfig {
  groupBy: string[];
  aggregations: Array<{
    field: string;
    function: AggregateFunction;
    alias?: string;
  }>;
}

export interface ComputeConfig {
  newField: string;
  expression: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
}

export interface RenameConfig {
  mappings: Array<{
    oldName: string;
    newName: string;
  }>;
}

export interface SelectConfig {
  fields: string[];
  exclude?: boolean; // If true, exclude these fields instead of including
}

export interface DeduplicateConfig {
  fields?: string[]; // If not provided, deduplicate on all fields
  keepFirst?: boolean; // If false, keep last occurrence
}

export interface TransformPipeline {
  id: string;
  name: string;
  description?: string;
  operations: TransformOperation[];
  sourceTable: string;
  created: Date;
  modified: Date;
}

export interface TransformPreview {
  originalData: Record<string, any>[];
  transformedData: Record<string, any>[];
  affectedRows: number;
  totalRows: number;
  executionTime: number;
  errors?: string[];
}

export interface TransformValidation {
  valid: boolean;
  errors: Array<{
    operationId: string;
    field?: string;
    message: string;
    severity: 'error' | 'warning';
  }>;
}

// Undo/Redo State Management
export interface TransformState {
  pipeline: TransformPipeline;
  preview?: TransformPreview;
  validation?: TransformValidation;
}

export interface UndoRedoManager {
  history: TransformState[];
  currentIndex: number;
  maxHistorySize: number;
}

// Transform Builder Helpers
export interface FieldInfo {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  samples: any[];
}

export interface TableSchema {
  name: string;
  fields: FieldInfo[];
  rowCount: number;
}

// API Integration Types
export interface TransformExecutionRequest {
  pipeline: TransformPipeline;
  previewOnly: boolean;
  maxRows?: number;
}

export interface TransformExecutionResponse {
  success: boolean;
  preview?: TransformPreview;
  validation?: TransformValidation;
  error?: string;
}