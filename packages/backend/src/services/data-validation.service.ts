import { EventEmitter } from 'events';

export interface ValidationRule {
  field: string;
  type: 'required' | 'email' | 'url' | 'phone' | 'date' | 'number' | 'regex' | 'custom';
  message?: string;
  options?: any;
  transform?: (value: any) => any;
}

export interface ValidationSchema {
  name: string;
  description?: string;
  rules: ValidationRule[];
  strict?: boolean; // If true, fail on extra fields
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  transformedData?: any;
  stats: ValidationStats;
}

export interface ValidationError {
  field: string;
  value: any;
  rule: string;
  message: string;
  row?: number;
}

export interface ValidationWarning {
  field: string;
  message: string;
  count?: number;
}

export interface ValidationStats {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  fieldStats: Map<string, FieldValidationStats>;
}

export interface FieldValidationStats {
  field: string;
  totalValues: number;
  validValues: number;
  invalidValues: number;
  nullValues: number;
  uniqueValues: number;
  errorTypes: Map<string, number>;
}

export interface TransformOptions {
  trimStrings?: boolean;
  normalizeWhitespace?: boolean;
  toLowerCase?: boolean;
  toUpperCase?: boolean;
  removeHtml?: boolean;
  normalizeEmail?: boolean;
  normalizePhone?: boolean;
  parseNumbers?: boolean;
  parseDates?: boolean;
  defaultValues?: Record<string, any>;
}

export class DataValidationService extends EventEmitter {
  private schemas: Map<string, ValidationSchema> = new Map();
  private customValidators: Map<string, (value: any, options?: any) => boolean> = new Map();
  private customTransformers: Map<string, (value: any, options?: any) => any> = new Map();

  constructor() {
    super();
    this.registerBuiltInValidators();
    this.registerBuiltInTransformers();
  }

  /**
   * Register a validation schema
   */
  registerSchema(schema: ValidationSchema): void {
    this.schemas.set(schema.name, schema);
    this.emit('schema:registered', schema.name);
  }

  /**
   * Get a registered schema
   */
  getSchema(name: string): ValidationSchema | undefined {
    return this.schemas.get(name);
  }

  /**
   * Register a custom validator
   */
  registerValidator(name: string, validator: (value: any, options?: any) => boolean): void {
    this.customValidators.set(name, validator);
  }

  /**
   * Register a custom transformer
   */
  registerTransformer(name: string, transformer: (value: any, options?: any) => any): void {
    this.customTransformers.set(name, transformer);
  }

  /**
   * Get a custom transformer
   */
  getTransformer(name: string): ((value: any, options?: any) => any) | undefined {
    return this.customTransformers.get(name);
  }

  /**
   * Validate data against a schema
   */
  async validateData(
    data: any[],
    schemaName: string,
    options: {
      stopOnFirstError?: boolean;
      maxErrors?: number;
      transform?: boolean;
      transformOptions?: TransformOptions;
    } = {}
  ): Promise<ValidationResult> {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const stats = this.initializeStats();
    const transformedData: any[] = [];

    this.emit('validation:start', { schemaName, recordCount: data.length });

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const record = data[rowIndex];
      let transformedRecord: any = {};
      let recordValid = true;

      // Apply transformations if enabled
      const processedRecord = options.transform 
        ? await this.transformRecord(record, schema, options.transformOptions)
        : record;

      // If transforming, start with the processed record (which includes defaults)
      if (options.transform) {
        transformedRecord = { ...processedRecord };
      }

      // Validate each field according to schema rules
      for (const rule of schema.rules) {
        const fieldValue = processedRecord[rule.field];
        const validationResult = await this.validateField(
          fieldValue,
          rule,
          rowIndex
        );

        // Update field stats
        this.updateFieldStats(stats, rule.field, validationResult.isValid, fieldValue);

        if (!validationResult.isValid) {
          recordValid = false;
          errors.push({
            field: rule.field,
            value: fieldValue,
            rule: rule.type,
            message: validationResult.message || rule.message || `Invalid ${rule.type}`,
            row: rowIndex
          });

          if (options.stopOnFirstError) {
            return {
              isValid: false,
              errors,
              warnings,
              transformedData: options.transform ? transformedData : undefined,
              stats
            };
          }

          if (options.maxErrors && errors.length >= options.maxErrors) {
            warnings.push({
              field: 'validation',
              message: `Validation stopped after ${options.maxErrors} errors`
            });
            return {
              isValid: false,
              errors,
              warnings,
              transformedData: options.transform ? transformedData : undefined,
              stats
            };
          }
        }

        // Field transformation is already applied in transformRecord method
      }

      // Check for extra fields if strict mode
      if (schema.strict) {
        const schemaFields = new Set(schema.rules.map(r => r.field));
        const recordFields = Object.keys(processedRecord);
        const extraFields = recordFields.filter(f => !schemaFields.has(f));
        
        if (extraFields.length > 0) {
          warnings.push({
            field: 'schema',
            message: `Extra fields found: ${extraFields.join(', ')}`,
            count: extraFields.length
          });
        }
      }

      // Update stats
      stats.totalRecords++;
      if (recordValid) {
        stats.validRecords++;
      } else {
        stats.invalidRecords++;
      }

      if (options.transform) {
        transformedData.push(transformedRecord);
      }

      // Progress update
      if (rowIndex > 0 && rowIndex % 1000 === 0) {
        this.emit('validation:progress', {
          processed: rowIndex + 1,
          total: data.length,
          errors: errors.length
        });
      }
    }

    this.emit('validation:complete', { 
      schemaName, 
      totalRecords: data.length,
      errors: errors.length 
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      transformedData: options.transform ? transformedData : undefined,
      stats
    };
  }

  /**
   * Validate a single field
   */
  private async validateField(
    value: any,
    rule: ValidationRule,
    rowIndex: number
  ): Promise<{ isValid: boolean; message?: string }> {
    // Handle null/undefined for required fields
    if (rule.type === 'required' && (value === null || value === undefined || value === '')) {
      return { isValid: false, message: `${rule.field} is required` };
    }

    // Skip validation for null/undefined values if not required
    if (value === null || value === undefined || value === '') {
      return { isValid: true };
    }

    switch (rule.type) {
      case 'email':
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return { 
          isValid: emailRegex.test(String(value)), 
          message: `Invalid email format` 
        };

      case 'url':
        try {
          const url = new URL(String(value));
          const validProtocols = rule.options?.protocols || ['http:', 'https:'];
          return { 
            isValid: validProtocols.includes(url.protocol), 
            message: `Invalid URL format` 
          };
        } catch {
          return { isValid: false, message: `Invalid URL format` };
        }

      case 'phone':
        return { 
          isValid: this.isValidPhone(String(value), rule.options), 
          message: `Invalid phone number format` 
        };

      case 'date':
        return { 
          isValid: this.isValidDate(value, rule.options), 
          message: `Invalid date format` 
        };

      case 'number':
        return { 
          isValid: this.isValidNumber(value, rule.options), 
          message: `Invalid number format` 
        };

      case 'regex':
        const regex = new RegExp(rule.options.pattern, rule.options.flags);
        return { 
          isValid: regex.test(String(value)), 
          message: `Value does not match pattern` 
        };

      case 'custom':
        const customValidator = this.customValidators.get(rule.options.validator);
        if (!customValidator) {
          throw new Error(`Custom validator '${rule.options.validator}' not found`);
        }
        return { 
          isValid: customValidator(value, rule.options), 
          message: rule.message 
        };

      default:
        return { isValid: true };
    }
  }

  /**
   * Transform a record according to schema and options
   */
  private async transformRecord(
    record: any,
    schema: ValidationSchema,
    options?: TransformOptions
  ): Promise<any> {
    const transformed: any = {};

    for (const [key, value] of Object.entries(record)) {
      let processedValue = value;

      // Apply global transformations
      if (options) {
        processedValue = this.applyGlobalTransforms(processedValue, options);
      }

      // Apply field-specific transformations from schema
      const rule = schema.rules.find(r => r.field === key);
      if (rule && rule.transform) {
        processedValue = rule.transform(processedValue);
      }

      transformed[key] = processedValue;
    }

    // Apply default values for all fields, not just existing ones
    if (options?.defaultValues) {
      for (const [field, defaultValue] of Object.entries(options.defaultValues)) {
        if (transformed[field] === null || transformed[field] === undefined || transformed[field] === '') {
          transformed[field] = defaultValue;
        }
      }
      // Also add default values for fields not in the record
      for (const [field, defaultValue] of Object.entries(options.defaultValues)) {
        if (!(field in transformed)) {
          transformed[field] = defaultValue;
        }
      }
    }

    return transformed;
  }

  /**
   * Apply global transformations
   */
  private applyGlobalTransforms(value: any, options: TransformOptions): any {
    if (value === null || value === undefined) {
      return value;
    }

    let processed = value;

    if (typeof processed === 'string') {
      if (options.trimStrings) {
        processed = processed.trim();
      }

      if (options.normalizeWhitespace) {
        processed = processed.replace(/\s+/g, ' ');
      }

      if (options.toLowerCase) {
        processed = processed.toLowerCase();
      }

      if (options.toUpperCase) {
        processed = processed.toUpperCase();
      }

      if (options.removeHtml) {
        // Simple HTML tag removal including script tags
        processed = processed.replace(/<script[^>]*>.*?<\/script>/gi, '');
        processed = processed.replace(/<[^>]*>/g, '');
      }
    }

    if (options.parseNumbers && typeof processed === 'string') {
      const num = Number(processed);
      if (!isNaN(num)) {
        processed = num;
      }
    }

    if (options.parseDates && typeof processed === 'string') {
      const date = new Date(processed);
      if (!isNaN(date.getTime())) {
        processed = date;
      }
    }

    return processed;
  }

  /**
   * Initialize validation statistics
   */
  private initializeStats(): ValidationStats {
    return {
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0,
      fieldStats: new Map()
    };
  }

  /**
   * Update field statistics
   */
  private updateFieldStats(
    stats: ValidationStats,
    field: string,
    isValid: boolean,
    value: any
  ): void {
    if (!stats.fieldStats.has(field)) {
      stats.fieldStats.set(field, {
        field,
        totalValues: 0,
        validValues: 0,
        invalidValues: 0,
        nullValues: 0,
        uniqueValues: 0,
        errorTypes: new Map()
      });
    }

    const fieldStats = stats.fieldStats.get(field)!;
    fieldStats.totalValues++;

    if (value === null || value === undefined || value === '') {
      fieldStats.nullValues++;
    }

    if (isValid) {
      fieldStats.validValues++;
    } else {
      fieldStats.invalidValues++;
    }
  }

  /**
   * Built-in validators
   */
  private registerBuiltInValidators(): void {
    // US Social Security Number
    this.registerValidator('ssn', (value: string) => {
      const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
      return ssnRegex.test(value);
    });

    // Credit Card (Luhn algorithm)
    this.registerValidator('creditCard', (value: string) => {
      const cleaned = value.replace(/\s+/g, '');
      if (!/^\d{13,19}$/.test(cleaned)) return false;
      
      let sum = 0;
      let isEven = false;
      
      for (let i = cleaned.length - 1; i >= 0; i--) {
        let digit = parseInt(cleaned[i], 10);
        
        if (isEven) {
          digit *= 2;
          if (digit > 9) {
            digit -= 9;
          }
        }
        
        sum += digit;
        isEven = !isEven;
      }
      
      return sum % 10 === 0;
    });

    // US Zip Code
    this.registerValidator('zipCode', (value: string) => {
      const zipRegex = /^\d{5}(-\d{4})?$/;
      return zipRegex.test(value);
    });

    // Strong Password
    this.registerValidator('strongPassword', (value: string, options = {}) => {
      const config = {
        minLength: 8,
        minLowercase: 1,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1,
        ...options
      };
      
      if (value.length < config.minLength) return false;
      
      const lowercase = (value.match(/[a-z]/g) || []).length;
      const uppercase = (value.match(/[A-Z]/g) || []).length;
      const numbers = (value.match(/[0-9]/g) || []).length;
      const symbols = (value.match(/[^a-zA-Z0-9]/g) || []).length;
      
      return lowercase >= config.minLowercase &&
             uppercase >= config.minUppercase &&
             numbers >= config.minNumbers &&
             symbols >= config.minSymbols;
    });
  }

  /**
   * Built-in transformers
   */
  private registerBuiltInTransformers(): void {
    // Normalize email
    this.registerTransformer('normalizeEmail', (value: string) => {
      if (typeof value !== 'string') return value;
      // Simple email normalization
      return value.toLowerCase().trim();
    });

    // Normalize phone
    this.registerTransformer('normalizePhone', (value: string, options = { country: 'US' }) => {
      if (typeof value !== 'string') return value;
      // Simple normalization - remove all non-digits
      const digits = value.replace(/\D/g, '');
      if (options.country === 'US' && digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
      }
      return digits;
    });

    // Mask sensitive data
    this.registerTransformer('maskSensitive', (value: string, options = { keepLast: 4 }) => {
      if (typeof value !== 'string' || value.length <= options.keepLast) return value;
      const masked = '*'.repeat(value.length - options.keepLast);
      return masked + value.slice(-options.keepLast);
    });
  }

  /**
   * Helper validators
   */
  private isValidPhone(value: string, options?: any): boolean {
    // Basic phone validation - can be customized per country
    // More flexible regex to handle various formats
    const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{4,6}$/;
    // Also accept formats like +1 123 456 7890
    const flexiblePhoneRegex = /^[\+]?[0-9\s\-\.\(\)]{10,}$/;
    return phoneRegex.test(value) || flexiblePhoneRegex.test(value);
  }

  private isValidDate(value: any, options?: any): boolean {
    if (value instanceof Date) {
      return !isNaN(value.getTime());
    }
    
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return false;
    }

    // Check date range if specified
    if (options?.min && date < new Date(options.min)) {
      return false;
    }
    if (options?.max && date > new Date(options.max)) {
      return false;
    }

    return true;
  }

  private isValidNumber(value: any, options?: any): boolean {
    const num = Number(value);
    if (isNaN(num)) {
      return false;
    }

    // Check number range if specified
    if (options?.min !== undefined && num < options.min) {
      return false;
    }
    if (options?.max !== undefined && num > options.max) {
      return false;
    }

    // Check if integer required
    if (options?.integer && !Number.isInteger(num)) {
      return false;
    }

    return true;
  }

  /**
   * Create a Zod schema from validation rules
   */
  createZodSchema(schemaName: string): any {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }

    // Return a simple schema object that can be used for validation
    const schemaObject: any = {
      _schema: schema,
      parse: (data: any) => {
        const errors: any[] = [];
        const result: any = {};
        
        for (const rule of schema.rules) {
          const value = data[rule.field];
          
          if (rule.type === 'required' && (!value || value === '')) {
            errors.push({ field: rule.field, message: rule.message || 'Required' });
          }
          
          result[rule.field] = value;
        }
        
        if (errors.length > 0) {
          throw { errors };
        }
        
        return result;
      }
    };
    
    return schemaObject;
  }

  /**
   * Export validation report
   */
  generateValidationReport(result: ValidationResult): string {
    const report: string[] = [];
    
    report.push('# Data Validation Report');
    report.push(`Generated: ${new Date().toISOString()}`);
    report.push('');
    
    report.push('## Summary');
    report.push(`- Total Records: ${result.stats.totalRecords}`);
    report.push(`- Valid Records: ${result.stats.validRecords}`);
    report.push(`- Invalid Records: ${result.stats.invalidRecords}`);
    report.push(`- Validation Rate: ${((result.stats.validRecords / result.stats.totalRecords) * 100).toFixed(2)}%`);
    report.push('');
    
    if (result.errors.length > 0) {
      report.push('## Errors');
      report.push(`Total Errors: ${result.errors.length}`);
      report.push('');
      
      // Group errors by field
      const errorsByField = new Map<string, ValidationError[]>();
      for (const error of result.errors) {
        if (!errorsByField.has(error.field)) {
          errorsByField.set(error.field, []);
        }
        errorsByField.get(error.field)!.push(error);
      }
      
      for (const [field, errors] of errorsByField) {
        report.push(`### Field: ${field}`);
        report.push(`- Error Count: ${errors.length}`);
        
        // Sample errors
        const sampleErrors = errors.slice(0, 5);
        for (const error of sampleErrors) {
          report.push(`  - Row ${error.row}: ${error.message} (value: ${JSON.stringify(error.value)})`);
        }
        if (errors.length > 5) {
          report.push(`  - ... and ${errors.length - 5} more errors`);
        }
        report.push('');
      }
    }
    
    if (result.warnings.length > 0) {
      report.push('## Warnings');
      for (const warning of result.warnings) {
        report.push(`- ${warning.message}`);
      }
      report.push('');
    }
    
    report.push('## Field Statistics');
    for (const [field, stats] of result.stats.fieldStats) {
      report.push(`### ${field}`);
      report.push(`- Total Values: ${stats.totalValues}`);
      report.push(`- Valid Values: ${stats.validValues}`);
      report.push(`- Invalid Values: ${stats.invalidValues}`);
      report.push(`- Null Values: ${stats.nullValues}`);
      report.push(`- Validation Rate: ${((stats.validValues / stats.totalValues) * 100).toFixed(2)}%`);
      report.push('');
    }
    
    return report.join('\n');
  }
}