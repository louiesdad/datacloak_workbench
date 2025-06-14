// Validation utilities for form fields and data input

export type ValidationResult = string | true;
export type ValidationRule = (value: any) => ValidationResult | Promise<ValidationResult>;

export interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface FormValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
  fieldErrors: Record<string, string[]>;
}

export interface ValidationOptions {
  stopOnFirstError?: boolean;
}

// Basic validation rules
export const required = (message = 'This field is required'): ValidationRule => {
  return (value: any) => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    return true;
  };
};

export const email = (message = 'Please enter a valid email address'): ValidationRule => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    if (typeof value !== 'string') return message;
    
    // More strict email validation
    if (!emailRegex.test(value) || 
        value.includes('..') || 
        value.startsWith('.') || 
        value.endsWith('.')) {
      return message;
    }
    
    return true;
  };
};

export const minLength = (min: number, message?: string): ValidationRule => {
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    if (typeof value !== 'string') return true;
    
    if (value.length < min) {
      return message || `Must be at least ${min} characters long`;
    }
    return true;
  };
};

export const maxLength = (max: number, message?: string): ValidationRule => {
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    if (typeof value !== 'string') return true;
    
    if (value.length > max) {
      return message || `Must be no more than ${max} characters long`;
    }
    return true;
  };
};

export const pattern = (regex: RegExp, message = 'Invalid format'): ValidationRule => {
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    if (typeof value !== 'string') return message;
    
    if (!regex.test(value)) {
      return message;
    }
    return true;
  };
};

export const numeric = (message = 'Please enter a valid number'): ValidationRule => {
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    if (typeof value !== 'string') return message;
    
    if (isNaN(Number(value)) || value.trim() === '') {
      return message;
    }
    return true;
  };
};

export const range = (min: number, max: number, message?: string): ValidationRule => {
  return (value: any) => {
    if (!value) return true; // Allow empty for optional fields
    
    const num = Number(value);
    if (isNaN(num)) {
      return message || `Value must be between ${min} and ${max}`;
    }
    
    if (num < min || num > max) {
      return message || `Value must be between ${min} and ${max}`;
    }
    return true;
  };
};

export const fileSize = (maxSizeBytes: number, message?: string): ValidationRule => {
  return (value: any) => {
    if (!value || !(value instanceof File)) return true;
    
    if (value.size > maxSizeBytes) {
      const maxSizeMB = Math.round(maxSizeBytes / (1024 * 1024));
      return message || `File size must not exceed ${maxSizeMB}MB`;
    }
    return true;
  };
};

export const fileType = (allowedTypes: string[], message?: string): ValidationRule => {
  return (value: any) => {
    if (!value || !(value instanceof File)) return true;
    if (allowedTypes.length === 0) return true; // No restrictions
    
    const fileName = value.name.toLowerCase();
    const hasValidExtension = allowedTypes.some(type => 
      fileName.endsWith(type.toLowerCase())
    );
    
    if (!hasValidExtension) {
      return message || `File type must be one of: ${allowedTypes.join(', ')}`;
    }
    return true;
  };
};

// Form validator class
export class FormValidator {
  private schema: Record<string, ValidationRule[]>;
  private options: ValidationOptions;

  constructor(schema: Record<string, ValidationRule[]>, options: ValidationOptions = {}) {
    this.schema = schema;
    this.options = options;
  }

  validateField(fieldName: string, value: any): FieldValidationResult {
    const rules = this.schema[fieldName] || [];
    return validateField(value, rules, this.options);
  }

  async validateForm(data: Record<string, any>): Promise<FormValidationResult> {
    return validateForm(data, this.schema, this.options);
  }
}

// Standalone validation functions
export const validateField = (
  value: any, 
  rules: ValidationRule[], 
  options: ValidationOptions = {}
): FieldValidationResult => {
  const errors: string[] = [];
  
  for (const rule of rules) {
    const result = rule(value);
    
    if (result !== true) {
      errors.push(result);
      
      if (options.stopOnFirstError) {
        break;
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const validateForm = async (
  data: Record<string, any>, 
  schema: Record<string, ValidationRule[]>,
  options: ValidationOptions = {}
): Promise<FormValidationResult> => {
  const errors: Record<string, string[]> = {};
  const fieldErrors: Record<string, string[]> = {};
  
  // Validate each field in the schema
  for (const [fieldName, rules] of Object.entries(schema)) {
    const value = data[fieldName];
    const fieldResult = validateField(value, rules, options);
    
    if (!fieldResult.isValid) {
      errors[fieldName] = fieldResult.errors;
      fieldErrors[fieldName] = fieldResult.errors;
    }
  }
  
  // Handle async validation
  const asyncValidations = Object.entries(schema).map(async ([fieldName, rules]) => {
    const value = data[fieldName];
    const asyncErrors: string[] = [];
    
    for (const rule of rules) {
      try {
        const result = await rule(value);
        if (result !== true) {
          asyncErrors.push(result);
          
          if (options.stopOnFirstError) {
            break;
          }
        }
      } catch (error) {
        asyncErrors.push('Validation error occurred');
      }
    }
    
    if (asyncErrors.length > 0) {
      if (!errors[fieldName]) {
        errors[fieldName] = [];
        fieldErrors[fieldName] = [];
      }
      errors[fieldName].push(...asyncErrors);
      fieldErrors[fieldName].push(...asyncErrors);
    }
  });
  
  await Promise.all(asyncValidations);
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    fieldErrors
  };
};

// Utility functions for common validation patterns
export const isValidEmail = (email: string): boolean => {
  const result = validateField(email, [email()]);
  return result.isValid;
};

export const isValidPhoneNumber = (phone: string): boolean => {
  const phonePattern = /^[\+]?[1-9][\d]{0,15}$/;
  const result = validateField(phone, [pattern(phonePattern)]);
  return result.isValid;
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidPassword = (password: string): boolean => {
  const result = validateField(password, [
    required(),
    minLength(8),
    pattern(/(?=.*[a-z])/, 'Must contain at least one lowercase letter'),
    pattern(/(?=.*[A-Z])/, 'Must contain at least one uppercase letter'),
    pattern(/(?=.*\d)/, 'Must contain at least one number')
  ]);
  return result.isValid;
};

// Custom validation rule builders
export const oneOf = (values: any[], message?: string): ValidationRule => {
  return (value: any) => {
    if (!value) return true;
    
    if (!values.includes(value)) {
      return message || `Value must be one of: ${values.join(', ')}`;
    }
    return true;
  };
};

export const custom = (
  validator: (value: any) => boolean, 
  message = 'Invalid value'
): ValidationRule => {
  return (value: any) => {
    if (!value) return true;
    
    if (!validator(value)) {
      return message;
    }
    return true;
  };
};

export const asyncValidation = (
  asyncValidator: (value: any) => Promise<boolean>,
  message = 'Validation failed'
): ValidationRule => {
  return async (value: any) => {
    if (!value) return true;
    
    try {
      const isValid = await asyncValidator(value);
      return isValid ? true : message;
    } catch {
      return message;
    }
  };
};