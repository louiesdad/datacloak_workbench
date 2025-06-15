import { AppError } from '../middleware/error.middleware';

export interface TransformOperation {
  id: string;
  type: 'filter' | 'sort' | 'rename' | 'format' | 'group' | 'aggregate' | 'join' | 'pivot';
  config: any;
  enabled: boolean;
}

export interface TransformValidationResult {
  valid: boolean;
  errors: TransformValidationError[];
  warnings: TransformValidationWarning[];
}

export interface TransformValidationError {
  operationId: string;
  operationType: string;
  field: string;
  message: string;
  code: string;
}

export interface TransformValidationWarning {
  operationId: string;
  operationType: string;
  field: string;
  message: string;
  code: string;
}

export interface DatasetSchema {
  columns: {
    name: string;
    type: 'string' | 'number' | 'boolean' | 'date';
    nullable: boolean;
    unique: boolean;
  }[];
  rowCount: number;
}

/**
 * Transform Validation Service
 * Validates transform operations against dataset schema and business rules
 */
export class TransformValidationService {

  /**
   * Validate a complete transform pipeline
   */
  async validateTransformPipeline(
    operations: TransformOperation[], 
    schema: DatasetSchema
  ): Promise<TransformValidationResult> {
    const errors: TransformValidationError[] = [];
    const warnings: TransformValidationWarning[] = [];
    
    let currentSchema = { ...schema };

    // Validate each operation in sequence
    for (const operation of operations) {
      if (!operation.enabled) continue;

      try {
        const operationResult = await this.validateSingleOperation(operation, currentSchema);
        errors.push(...operationResult.errors);
        warnings.push(...operationResult.warnings);

        // Update schema for next operation if this one is valid
        if (operationResult.errors.length === 0) {
          currentSchema = this.updateSchemaAfterOperation(currentSchema, operation);
        }
      } catch (error) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'operation',
          message: `Failed to validate operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'VALIDATION_ERROR'
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate a single transform operation
   */
  async validateSingleOperation(
    operation: TransformOperation, 
    schema: DatasetSchema
  ): Promise<TransformValidationResult> {
    const errors: TransformValidationError[] = [];
    const warnings: TransformValidationWarning[] = [];

    // Basic operation validation
    if (!operation.id) {
      errors.push({
        operationId: operation.id || 'unknown',
        operationType: operation.type,
        field: 'id',
        message: 'Operation ID is required',
        code: 'MISSING_OPERATION_ID'
      });
    }

    if (!operation.type) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type || 'unknown',
        field: 'type',
        message: 'Operation type is required',
        code: 'MISSING_OPERATION_TYPE'
      });
    }

    // Type-specific validation
    switch (operation.type) {
      case 'filter':
        this.validateFilterOperation(operation, schema, errors, warnings);
        break;
      case 'sort':
        this.validateSortOperation(operation, schema, errors, warnings);
        break;
      case 'rename':
        this.validateRenameOperation(operation, schema, errors, warnings);
        break;
      case 'format':
        this.validateFormatOperation(operation, schema, errors, warnings);
        break;
      case 'group':
        this.validateGroupOperation(operation, schema, errors, warnings);
        break;
      case 'aggregate':
        this.validateAggregateOperation(operation, schema, errors, warnings);
        break;
      case 'join':
        this.validateJoinOperation(operation, schema, errors, warnings);
        break;
      case 'pivot':
        this.validatePivotOperation(operation, schema, errors, warnings);
        break;
      default:
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'type',
          message: `Unknown operation type: ${operation.type}`,
          code: 'UNKNOWN_OPERATION_TYPE'
        });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate filter operation
   */
  private validateFilterOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.field) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: 'Filter field is required',
        code: 'MISSING_FILTER_FIELD'
      });
      return;
    }

    // Check if field exists in schema
    const column = schema.columns.find(col => col.name === config.field);
    if (!column) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: `Column '${config.field}' does not exist in dataset`,
        code: 'COLUMN_NOT_FOUND'
      });
      return;
    }

    // Validate operator
    const validOperators = this.getValidOperatorsForType(column.type);
    if (!config.operator || !validOperators.includes(config.operator)) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'operator',
        message: `Invalid operator '${config.operator}' for ${column.type} field`,
        code: 'INVALID_OPERATOR'
      });
    }

    // Validate value
    if (config.value === undefined || config.value === null) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'value',
        message: 'Filter value is required',
        code: 'MISSING_FILTER_VALUE'
      });
    } else {
      // Type-specific value validation
      const valueValidation = this.validateValueForType(config.value, column.type);
      if (!valueValidation.valid) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'value',
          message: valueValidation.message,
          code: 'INVALID_FILTER_VALUE'
        });
      }
    }

    // Performance warning for large datasets
    if (schema.rowCount > 100000 && config.operator === 'contains') {
      warnings.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'performance',
        message: `Text search on large dataset (${schema.rowCount} rows) may be slow`,
        code: 'PERFORMANCE_WARNING'
      });
    }
  }

  /**
   * Validate sort operation
   */
  private validateSortOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.field) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: 'Sort field is required',
        code: 'MISSING_SORT_FIELD'
      });
      return;
    }

    // Check if field exists
    const column = schema.columns.find(col => col.name === config.field);
    if (!column) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: `Column '${config.field}' does not exist in dataset`,
        code: 'COLUMN_NOT_FOUND'
      });
      return;
    }

    // Validate direction
    if (config.direction && !['asc', 'desc'].includes(config.direction)) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'direction',
        message: 'Sort direction must be "asc" or "desc"',
        code: 'INVALID_SORT_DIRECTION'
      });
    }

    // Performance warning for text sorting on large datasets
    if (schema.rowCount > 50000 && column.type === 'string') {
      warnings.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'performance',
        message: `Sorting text column on large dataset (${schema.rowCount} rows) may be slow`,
        code: 'PERFORMANCE_WARNING'
      });
    }
  }

  /**
   * Validate rename operation
   */
  private validateRenameOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.fromField) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'fromField',
        message: 'Source field name is required',
        code: 'MISSING_FROM_FIELD'
      });
      return;
    }

    if (!config.toField) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'toField',
        message: 'Target field name is required',
        code: 'MISSING_TO_FIELD'
      });
      return;
    }

    // Check if source field exists
    const sourceColumn = schema.columns.find(col => col.name === config.fromField);
    if (!sourceColumn) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'fromField',
        message: `Source column '${config.fromField}' does not exist`,
        code: 'COLUMN_NOT_FOUND'
      });
    }

    // Check if target field already exists
    const targetColumn = schema.columns.find(col => col.name === config.toField);
    if (targetColumn && targetColumn.name !== config.fromField) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'toField',
        message: `Target column '${config.toField}' already exists`,
        code: 'COLUMN_ALREADY_EXISTS'
      });
    }

    // Validate field name format
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(config.toField)) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'toField',
        message: 'Field name must start with letter or underscore and contain only letters, numbers, and underscores',
        code: 'INVALID_FIELD_NAME'
      });
    }
  }

  /**
   * Validate format operation
   */
  private validateFormatOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.field) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: 'Format field is required',
        code: 'MISSING_FORMAT_FIELD'
      });
      return;
    }

    // Check if field exists
    const column = schema.columns.find(col => col.name === config.field);
    if (!column) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'field',
        message: `Column '${config.field}' does not exist in dataset`,
        code: 'COLUMN_NOT_FOUND'
      });
      return;
    }

    // Validate format type
    const validFormats = this.getValidFormatsForType(column.type);
    if (!config.formatType || !validFormats.includes(config.formatType)) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'formatType',
        message: `Invalid format type '${config.formatType}' for ${column.type} field`,
        code: 'INVALID_FORMAT_TYPE'
      });
    }

    // Validate format pattern if provided
    if (config.pattern) {
      try {
        if (column.type === 'date') {
          // Validate date format pattern
          new Date().toLocaleDateString('en-US', { 
            year: config.pattern.includes('YYYY') ? 'numeric' : undefined,
            month: config.pattern.includes('MM') ? '2-digit' : undefined,
            day: config.pattern.includes('DD') ? '2-digit' : undefined
          });
        } else if (column.type === 'number' && config.pattern.includes('regex')) {
          // Validate regex pattern
          new RegExp(config.pattern);
        }
      } catch (error) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'pattern',
          message: `Invalid format pattern: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'INVALID_FORMAT_PATTERN'
        });
      }
    }
  }

  /**
   * Validate group operation
   */
  private validateGroupOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.groupBy || !Array.isArray(config.groupBy) || config.groupBy.length === 0) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'groupBy',
        message: 'Group by fields are required',
        code: 'MISSING_GROUP_FIELDS'
      });
      return;
    }

    // Validate each group field
    for (const field of config.groupBy) {
      const column = schema.columns.find(col => col.name === field);
      if (!column) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'groupBy',
          message: `Group by column '${field}' does not exist`,
          code: 'COLUMN_NOT_FOUND'
        });
      }
    }

    // Warning for high cardinality grouping
    if (config.groupBy.length > 3) {
      warnings.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'groupBy',
        message: `Grouping by ${config.groupBy.length} fields may create many groups`,
        code: 'HIGH_CARDINALITY_WARNING'
      });
    }
  }

  /**
   * Validate aggregate operation
   */
  private validateAggregateOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.aggregations || !Array.isArray(config.aggregations) || config.aggregations.length === 0) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'aggregations',
        message: 'Aggregation functions are required',
        code: 'MISSING_AGGREGATIONS'
      });
      return;
    }

    // Validate each aggregation
    for (const agg of config.aggregations) {
      if (!agg.field || !agg.function) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'aggregations',
          message: 'Aggregation field and function are required',
          code: 'INVALID_AGGREGATION'
        });
        continue;
      }

      const column = schema.columns.find(col => col.name === agg.field);
      if (!column) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'aggregations',
          message: `Aggregation column '${agg.field}' does not exist`,
          code: 'COLUMN_NOT_FOUND'
        });
        continue;
      }

      // Validate aggregation function for column type
      const validFunctions = this.getValidAggregationFunctions(column.type);
      if (!validFunctions.includes(agg.function)) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'aggregations',
          message: `Invalid aggregation function '${agg.function}' for ${column.type} field`,
          code: 'INVALID_AGGREGATION_FUNCTION'
        });
      }
    }
  }

  /**
   * Validate join operation
   */
  private validateJoinOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.joinType || !['inner', 'left', 'right', 'full'].includes(config.joinType)) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'joinType',
        message: 'Valid join type is required (inner, left, right, full)',
        code: 'INVALID_JOIN_TYPE'
      });
    }

    if (!config.leftKey || !config.rightKey) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'joinKeys',
        message: 'Both left and right join keys are required',
        code: 'MISSING_JOIN_KEYS'
      });
    }

    if (!config.rightDataset) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'rightDataset',
        message: 'Right dataset is required for join operation',
        code: 'MISSING_RIGHT_DATASET'
      });
    }

    // Validate left key exists
    if (config.leftKey) {
      const leftColumn = schema.columns.find(col => col.name === config.leftKey);
      if (!leftColumn) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'leftKey',
          message: `Left join key '${config.leftKey}' does not exist`,
          code: 'COLUMN_NOT_FOUND'
        });
      }
    }

    // Performance warning for large joins
    if (schema.rowCount > 100000) {
      warnings.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'performance',
        message: `Join operation on large dataset (${schema.rowCount} rows) may be slow`,
        code: 'PERFORMANCE_WARNING'
      });
    }
  }

  /**
   * Validate pivot operation
   */
  private validatePivotOperation(
    operation: TransformOperation,
    schema: DatasetSchema,
    errors: TransformValidationError[],
    warnings: TransformValidationWarning[]
  ): void {
    const config = operation.config;

    if (!config.pivotColumn) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'pivotColumn',
        message: 'Pivot column is required',
        code: 'MISSING_PIVOT_COLUMN'
      });
    }

    if (!config.valueColumn) {
      errors.push({
        operationId: operation.id,
        operationType: operation.type,
        field: 'valueColumn',
        message: 'Value column is required',
        code: 'MISSING_VALUE_COLUMN'
      });
    }

    // Validate columns exist
    if (config.pivotColumn) {
      const pivotCol = schema.columns.find(col => col.name === config.pivotColumn);
      if (!pivotCol) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'pivotColumn',
          message: `Pivot column '${config.pivotColumn}' does not exist`,
          code: 'COLUMN_NOT_FOUND'
        });
      }
    }

    if (config.valueColumn) {
      const valueCol = schema.columns.find(col => col.name === config.valueColumn);
      if (!valueCol) {
        errors.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'valueColumn',
          message: `Value column '${config.valueColumn}' does not exist`,
          code: 'COLUMN_NOT_FOUND'
        });
      } else if (valueCol.type !== 'number') {
        warnings.push({
          operationId: operation.id,
          operationType: operation.type,
          field: 'valueColumn',
          message: 'Pivot value column is not numeric, results may be unexpected',
          code: 'NON_NUMERIC_PIVOT_VALUE'
        });
      }
    }
  }

  /**
   * Get valid operators for a data type
   */
  private getValidOperatorsForType(type: string): string[] {
    switch (type) {
      case 'string':
        return ['equals', 'not_equals', 'contains', 'not_contains', 'starts_with', 'ends_with', 'regex'];
      case 'number':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between'];
      case 'boolean':
        return ['equals', 'not_equals'];
      case 'date':
        return ['equals', 'not_equals', 'greater_than', 'less_than', 'greater_equal', 'less_equal', 'between'];
      default:
        return ['equals', 'not_equals'];
    }
  }

  /**
   * Get valid formats for a data type
   */
  private getValidFormatsForType(type: string): string[] {
    switch (type) {
      case 'string':
        return ['uppercase', 'lowercase', 'title_case', 'trim', 'pad_left', 'pad_right'];
      case 'number':
        return ['decimal_places', 'thousands_separator', 'percentage', 'currency'];
      case 'date':
        return ['date_format', 'timezone_convert'];
      default:
        return [];
    }
  }

  /**
   * Get valid aggregation functions for a data type
   */
  private getValidAggregationFunctions(type: string): string[] {
    switch (type) {
      case 'string':
        return ['count', 'count_distinct', 'first', 'last', 'mode'];
      case 'number':
        return ['count', 'count_distinct', 'sum', 'avg', 'min', 'max', 'median', 'std_dev'];
      case 'boolean':
        return ['count', 'count_distinct', 'sum'];
      case 'date':
        return ['count', 'count_distinct', 'min', 'max', 'first', 'last'];
      default:
        return ['count', 'count_distinct'];
    }
  }

  /**
   * Validate value for a specific data type
   */
  private validateValueForType(value: any, type: string): { valid: boolean; message: string } {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, message: 'Value must be a string' };
        }
        break;
      case 'number':
        if (typeof value !== 'number' && isNaN(Number(value))) {
          return { valid: false, message: 'Value must be a number' };
        }
        break;
      case 'boolean':
        if (typeof value !== 'boolean' && !['true', 'false', '1', '0'].includes(String(value).toLowerCase())) {
          return { valid: false, message: 'Value must be a boolean' };
        }
        break;
      case 'date':
        if (isNaN(Date.parse(String(value)))) {
          return { valid: false, message: 'Value must be a valid date' };
        }
        break;
    }
    return { valid: true, message: '' };
  }

  /**
   * Update schema after applying an operation
   */
  private updateSchemaAfterOperation(schema: DatasetSchema, operation: TransformOperation): DatasetSchema {
    const newSchema = { ...schema, columns: [...schema.columns] };

    switch (operation.type) {
      case 'rename':
        const renameConfig = operation.config;
        const columnIndex = newSchema.columns.findIndex(col => col.name === renameConfig.fromField);
        if (columnIndex !== -1) {
          newSchema.columns[columnIndex] = {
            ...newSchema.columns[columnIndex],
            name: renameConfig.toField
          };
        }
        break;

      case 'group':
      case 'aggregate':
        // Group/aggregate operations typically reduce the number of columns
        // This is a simplified update - real implementation would be more complex
        newSchema.rowCount = Math.floor(newSchema.rowCount / 10); // Estimate
        break;

      case 'filter':
        // Filter operations reduce row count
        newSchema.rowCount = Math.floor(newSchema.rowCount * 0.7); // Estimate
        break;
    }

    return newSchema;
  }
}