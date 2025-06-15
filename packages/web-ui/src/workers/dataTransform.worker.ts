// Web Worker for performing data transformations without blocking the main thread

export interface TransformMessage {
  type: 'EXECUTE_TRANSFORM' | 'VALIDATE_TRANSFORM' | 'PREVIEW_TRANSFORM';
  payload: any;
}

export interface TransformResult {
  type: 'TRANSFORM_COMPLETE' | 'TRANSFORM_ERROR' | 'PROGRESS_UPDATE' | 'VALIDATION_COMPLETE' | 'PREVIEW_COMPLETE';
  payload: any;
}

// Transform operation types
export type TransformOperationType = 
  | 'filter'
  | 'map' 
  | 'aggregate'
  | 'rename'
  | 'drop'
  | 'mask'
  | 'join'
  | 'pivot';

export interface TransformOperation {
  id: string;
  type: TransformOperationType;
  field?: string;
  parameters: Record<string, any>;
}

// Helper function to mask PII data
const maskPII = (value: string, maskType: string): string => {
  switch (maskType) {
    case 'email':
      const emailParts = value.split('@');
      if (emailParts.length === 2) {
        const [local, domain] = emailParts;
        return local.substring(0, 2) + '***@' + domain;
      }
      return value;
      
    case 'phone':
      return value.replace(/\d{4}$/, '****');
      
    case 'ssn':
      return '***-**-' + value.slice(-4);
      
    case 'creditCard':
      return '****-****-****-' + value.slice(-4);
      
    default:
      return value.replace(/./g, '*');
  }
};

// Apply a single transform operation to a row
const applyTransformToRow = (
  row: Record<string, any>,
  operation: TransformOperation
): Record<string, any> | null => {
  const { type, field, parameters } = operation;
  
  switch (type) {
    case 'filter':
      // Filter based on condition
      if (field && parameters.condition) {
        const value = row[field];
        switch (parameters.condition) {
          case 'equals':
            return value === parameters.value ? row : null;
          case 'notEquals':
            return value !== parameters.value ? row : null;
          case 'contains':
            return String(value).includes(parameters.value) ? row : null;
          case 'notContains':
            return !String(value).includes(parameters.value) ? row : null;
          case 'greaterThan':
            return Number(value) > Number(parameters.value) ? row : null;
          case 'lessThan':
            return Number(value) < Number(parameters.value) ? row : null;
          case 'isEmpty':
            return !value || value === '' ? row : null;
          case 'isNotEmpty':
            return value && value !== '' ? row : null;
          default:
            return row;
        }
      }
      return row;
      
    case 'map':
      // Transform field value
      if (field && parameters.expression) {
        const newRow = { ...row };
        const value = row[field];
        
        switch (parameters.expression) {
          case 'toUpperCase':
            newRow[field] = String(value).toUpperCase();
            break;
          case 'toLowerCase':
            newRow[field] = String(value).toLowerCase();
            break;
          case 'trim':
            newRow[field] = String(value).trim();
            break;
          case 'toNumber':
            newRow[field] = Number(value);
            break;
          case 'toString':
            newRow[field] = String(value);
            break;
          case 'round':
            newRow[field] = Math.round(Number(value));
            break;
          case 'absolute':
            newRow[field] = Math.abs(Number(value));
            break;
          default:
            // Custom expression evaluation (simplified)
            try {
              // In a real implementation, use a safe expression evaluator
              newRow[field] = value;
            } catch (e) {
              // Keep original value on error
            }
        }
        return newRow;
      }
      return row;
      
    case 'rename':
      // Rename field
      if (field && parameters.newName) {
        const newRow = { ...row };
        newRow[parameters.newName] = newRow[field];
        delete newRow[field];
        return newRow;
      }
      return row;
      
    case 'drop':
      // Remove field
      if (field) {
        const newRow = { ...row };
        delete newRow[field];
        return newRow;
      }
      return row;
      
    case 'mask':
      // Mask PII data
      if (field && parameters.maskType) {
        const newRow = { ...row };
        newRow[field] = maskPII(String(row[field]), parameters.maskType);
        return newRow;
      }
      return row;
      
    default:
      return row;
  }
};

// Apply all transform operations to a dataset
const applyTransformPipeline = async (
  data: Record<string, any>[],
  operations: TransformOperation[],
  onProgress?: (progress: number) => void
) => {
  let transformedData = [...data];
  const totalSteps = operations.length * data.length;
  let currentStep = 0;
  
  for (const operation of operations) {
    const newData: Record<string, any>[] = [];
    
    for (let i = 0; i < transformedData.length; i++) {
      const row = transformedData[i];
      const result = applyTransformToRow(row, operation);
      
      // null result means the row was filtered out
      if (result !== null) {
        newData.push(result);
      }
      
      currentStep++;
      
      // Report progress
      if (onProgress && currentStep % 100 === 0) {
        const progress = Math.round((currentStep / totalSteps) * 100);
        onProgress(progress);
      }
      
      // Allow other tasks to run periodically
      if (i % 1000 === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    transformedData = newData;
  }
  
  return transformedData;
};

// Validate transform pipeline
const validateTransformPipeline = (operations: TransformOperation[], schema: any) => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const availableFields = new Set(schema?.fields?.map((f: any) => f.name) || []);
  
  operations.forEach((op, index) => {
    // Check if field exists
    if (op.field && !availableFields.has(op.field)) {
      errors.push(`Operation ${index + 1}: Field "${op.field}" does not exist in schema`);
    }
    
    // Validate operation-specific requirements
    switch (op.type) {
      case 'filter':
        if (!op.field) {
          errors.push(`Operation ${index + 1}: Filter requires a field`);
        }
        if (!op.parameters.condition) {
          errors.push(`Operation ${index + 1}: Filter requires a condition`);
        }
        break;
        
      case 'rename':
        if (!op.field || !op.parameters.newName) {
          errors.push(`Operation ${index + 1}: Rename requires both field and newName`);
        }
        if (availableFields.has(op.parameters.newName)) {
          warnings.push(`Operation ${index + 1}: Field "${op.parameters.newName}" already exists`);
        }
        break;
        
      case 'mask':
        if (!op.field || !op.parameters.maskType) {
          errors.push(`Operation ${index + 1}: Mask requires both field and maskType`);
        }
        break;
    }
    
    // Update available fields for subsequent operations
    if (op.type === 'rename' && op.field && op.parameters.newName) {
      availableFields.delete(op.field);
      availableFields.add(op.parameters.newName);
    } else if (op.type === 'drop' && op.field) {
      availableFields.delete(op.field);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    outputFields: Array.from(availableFields)
  };
};

// Worker message handler
self.onmessage = async (event: MessageEvent<TransformMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'EXECUTE_TRANSFORM': {
        const { data, operations } = payload;
        
        const result = await applyTransformPipeline(
          data,
          operations,
          (progress) => {
            postMessage({
              type: 'PROGRESS_UPDATE',
              payload: { progress }
            } as TransformResult);
          }
        );
        
        postMessage({
          type: 'TRANSFORM_COMPLETE',
          payload: {
            data: result,
            rowCount: result.length,
            operations: operations.length
          }
        } as TransformResult);
        break;
      }
      
      case 'VALIDATE_TRANSFORM': {
        const { operations, schema } = payload;
        const validation = validateTransformPipeline(operations, schema);
        
        postMessage({
          type: 'VALIDATION_COMPLETE',
          payload: validation
        } as TransformResult);
        break;
      }
      
      case 'PREVIEW_TRANSFORM': {
        const { data, operations, previewRows = 10 } = payload;
        
        // Only process first N rows for preview
        const previewData = data.slice(0, previewRows);
        const result = await applyTransformPipeline(previewData, operations);
        
        postMessage({
          type: 'PREVIEW_COMPLETE',
          payload: {
            preview: result,
            originalCount: data.length,
            previewCount: result.length
          }
        } as TransformResult);
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'TRANSFORM_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        type
      }
    } as TransformResult);
  }
};

export {};