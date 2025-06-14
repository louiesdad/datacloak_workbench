import { describe, it, expect, vi } from 'vitest';
import { 
  ValidationRule,
  required,
  email,
  minLength,
  maxLength,
  pattern,
  numeric,
  range,
  fileSize,
  fileType,
  FormValidator,
  validateField,
  validateForm
} from '../validation';

describe('Validation Rules', () => {
  describe('required', () => {
    const requiredRule = required();

    it('should pass for non-empty values', () => {
      expect(requiredRule('hello')).toBe(true);
      expect(requiredRule('0')).toBe(true);
      expect(requiredRule(0)).toBe(true);
      expect(requiredRule(false)).toBe(true);
    });

    it('should fail for empty values', () => {
      expect(requiredRule('')).toBe('This field is required');
      expect(requiredRule(null)).toBe('This field is required');
      expect(requiredRule(undefined)).toBe('This field is required');
    });

    it('should use custom message', () => {
      const customRule = required('Please enter a value');
      expect(customRule('')).toBe('Please enter a value');
    });
  });

  describe('email', () => {
    const emailRule = email();

    it('should pass for valid emails', () => {
      expect(emailRule('test@example.com')).toBe(true);
      expect(emailRule('user.name+tag@domain.co.uk')).toBe(true);
      expect(emailRule('test123@test-domain.com')).toBe(true);
    });

    it('should fail for invalid emails', () => {
      expect(emailRule('invalid-email')).toBe('Please enter a valid email address');
      expect(emailRule('test@')).toBe('Please enter a valid email address');
      expect(emailRule('@domain.com')).toBe('Please enter a valid email address');
      expect(emailRule('test..test@domain.com')).toBe('Please enter a valid email address');
    });

    it('should pass for empty values when not required', () => {
      expect(emailRule('')).toBe(true);
      expect(emailRule(null)).toBe(true);
    });
  });

  describe('minLength', () => {
    const minLengthRule = minLength(5);

    it('should pass for strings meeting minimum length', () => {
      expect(minLengthRule('hello')).toBe(true);
      expect(minLengthRule('hello world')).toBe(true);
    });

    it('should fail for strings below minimum length', () => {
      expect(minLengthRule('hi')).toBe('Must be at least 5 characters long');
      expect(minLengthRule('')).toBe('Must be at least 5 characters long');
    });

    it('should handle non-string values', () => {
      expect(minLengthRule(null)).toBe(true);
      expect(minLengthRule(undefined)).toBe(true);
    });
  });

  describe('maxLength', () => {
    const maxLengthRule = maxLength(10);

    it('should pass for strings within maximum length', () => {
      expect(maxLengthRule('hello')).toBe(true);
      expect(maxLengthRule('1234567890')).toBe(true);
    });

    it('should fail for strings exceeding maximum length', () => {
      expect(maxLengthRule('this is too long')).toBe('Must be no more than 10 characters long');
    });

    it('should handle non-string values', () => {
      expect(maxLengthRule(null)).toBe(true);
      expect(maxLengthRule(undefined)).toBe(true);
    });
  });

  describe('pattern', () => {
    const phonePattern = pattern(/^\d{3}-\d{3}-\d{4}$/, 'Please enter a valid phone number (XXX-XXX-XXXX)');

    it('should pass for values matching pattern', () => {
      expect(phonePattern('123-456-7890')).toBe(true);
      expect(phonePattern('999-888-7777')).toBe(true);
    });

    it('should fail for values not matching pattern', () => {
      expect(phonePattern('123-45-6789')).toBe('Please enter a valid phone number (XXX-XXX-XXXX)');
      expect(phonePattern('abc-def-ghij')).toBe('Please enter a valid phone number (XXX-XXX-XXXX)');
    });

    it('should handle empty values', () => {
      expect(phonePattern('')).toBe(true);
      expect(phonePattern(null)).toBe(true);
    });
  });

  describe('numeric', () => {
    const numericRule = numeric();

    it('should pass for valid numbers', () => {
      expect(numericRule('123')).toBe(true);
      expect(numericRule('123.45')).toBe(true);
      expect(numericRule('-123')).toBe(true);
      expect(numericRule('0')).toBe(true);
    });

    it('should fail for non-numeric values', () => {
      expect(numericRule('abc')).toBe('Please enter a valid number');
      expect(numericRule('12.34.56')).toBe('Please enter a valid number');
      expect(numericRule('12a')).toBe('Please enter a valid number');
    });

    it('should handle empty values', () => {
      expect(numericRule('')).toBe(true);
      expect(numericRule(null)).toBe(true);
    });
  });

  describe('range', () => {
    const rangeRule = range(1, 100);

    it('should pass for values within range', () => {
      expect(rangeRule('50')).toBe(true);
      expect(rangeRule('1')).toBe(true);
      expect(rangeRule('100')).toBe(true);
    });

    it('should fail for values outside range', () => {
      expect(rangeRule('0')).toBe('Value must be between 1 and 100');
      expect(rangeRule('101')).toBe('Value must be between 1 and 100');
      expect(rangeRule('-5')).toBe('Value must be between 1 and 100');
    });

    it('should fail for non-numeric values', () => {
      expect(rangeRule('abc')).toBe('Value must be between 1 and 100');
    });
  });

  describe('fileSize', () => {
    const fileSizeRule = fileSize(1024 * 1024); // 1MB

    it('should pass for files within size limit', () => {
      const smallFile = new File(['content'], 'small.txt', { type: 'text/plain' });
      Object.defineProperty(smallFile, 'size', { value: 500 * 1024 }); // 500KB
      
      expect(fileSizeRule(smallFile)).toBe(true);
    });

    it('should fail for files exceeding size limit', () => {
      const largeFile = new File(['content'], 'large.txt', { type: 'text/plain' });
      Object.defineProperty(largeFile, 'size', { value: 2 * 1024 * 1024 }); // 2MB
      
      expect(fileSizeRule(largeFile)).toBe('File size must not exceed 1MB');
    });

    it('should handle non-file values', () => {
      expect(fileSizeRule('not a file')).toBe(true);
      expect(fileSizeRule(null)).toBe(true);
    });
  });

  describe('fileType', () => {
    const fileTypeRule = fileType(['.txt', '.csv']);

    it('should pass for allowed file types', () => {
      const txtFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      const csvFile = new File(['content'], 'test.csv', { type: 'text/csv' });
      
      expect(fileTypeRule(txtFile)).toBe(true);
      expect(fileTypeRule(csvFile)).toBe(true);
    });

    it('should fail for disallowed file types', () => {
      const pdfFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      
      expect(fileTypeRule(pdfFile)).toBe('File type must be one of: .txt, .csv');
    });

    it('should handle files without extensions', () => {
      const noExtFile = new File(['content'], 'test', { type: 'text/plain' });
      
      expect(fileTypeRule(noExtFile)).toBe('File type must be one of: .txt, .csv');
    });
  });
});

describe('FormValidator', () => {
  const validator = new FormValidator({
    email: [required(), email()],
    password: [required(), minLength(8)],
    age: [numeric(), range(18, 100)]
  });

  it('should validate individual fields', () => {
    expect(validator.validateField('email', 'test@example.com')).toEqual({
      isValid: true,
      errors: []
    });

    expect(validator.validateField('email', 'invalid')).toEqual({
      isValid: false,
      errors: ['Please enter a valid email address']
    });
  });

  it('should validate entire form', async () => {
    const validData = {
      email: 'test@example.com',
      password: 'password123',
      age: '25'
    };

    const result = await validator.validateForm(validData);
    expect(result).toEqual({
      isValid: true,
      errors: {},
      fieldErrors: {}
    });

    const invalidData = {
      email: 'invalid',
      password: '123',
      age: '15'
    };

    const invalidResult = await validator.validateForm(invalidData);
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.errors.email).toContain('Please enter a valid email address');
    expect(invalidResult.errors.password).toContain('Must be at least 8 characters long');
    expect(invalidResult.errors.age).toContain('Value must be between 18 and 100');
  });

  it('should stop on first error when configured', () => {
    const strictValidator = new FormValidator({
      email: [required(), email()],
      password: [required(), minLength(8)]
    }, { stopOnFirstError: true });

    const result = strictValidator.validateField('email', '');
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toBe('This field is required');
  });

  it('should validate optional fields correctly', () => {
    const validatorWithOptional = new FormValidator({
      email: [required(), email()],
      phone: [pattern(/^\d{3}-\d{3}-\d{4}$/)] // optional
    });

    expect(validatorWithOptional.validateField('phone', '')).toEqual({
      isValid: true,
      errors: []
    });

    expect(validatorWithOptional.validateField('phone', '123-456-7890')).toEqual({
      isValid: true,
      errors: []
    });
  });

  it('should handle missing fields in form validation', async () => {
    const result = await validator.validateForm({
      email: 'test@example.com'
      // missing password and age
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.password).toContain('This field is required');
  });
});

describe('Standalone Validation Functions', () => {
  describe('validateField', () => {
    it('should validate field with single rule', () => {
      const result = validateField('test@example.com', [email()]);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate field with multiple rules', () => {
      const result = validateField('', [required(), email()]);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('This field is required');
    });

    it('should stop on first error when configured', () => {
      const result = validateField('', [required(), email()], { stopOnFirstError: true });
      
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toBe('This field is required');
    });
  });

  describe('validateForm', () => {
    const schema = {
      username: [required(), minLength(3)],
      email: [required(), email()]
    };

    it('should validate form data', async () => {
      const data = {
        username: 'john',
        email: 'john@example.com'
      };

      const result = await validateForm(data, schema);
      
      expect(result.isValid).toBe(true);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should return field-specific errors', async () => {
      const data = {
        username: 'jo',
        email: 'invalid-email'
      };

      const result = await validateForm(data, schema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.username).toContain('Must be at least 3 characters long');
      expect(result.errors.email).toContain('Please enter a valid email address');
    });

    it('should handle async validation', async () => {
      const asyncRule: ValidationRule = async (value) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return value === 'taken' ? 'Username is already taken' : true;
      };

      const asyncSchema = {
        username: [required(), asyncRule]
      };

      const result = await validateForm({ username: 'taken' }, asyncSchema);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.username).toContain('Username is already taken');
    });
  });
});

describe('Custom Validation Rules', () => {
  it('should support custom validation functions', () => {
    const customRule: ValidationRule = (value) => {
      if (typeof value === 'string' && value.includes('forbidden')) {
        return 'Value contains forbidden word';
      }
      return true;
    };

    expect(customRule('hello world')).toBe(true);
    expect(customRule('forbidden word')).toBe('Value contains forbidden word');
  });

  it('should support async validation functions', async () => {
    const asyncRule: ValidationRule = async (value) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 10));
      return value === 'existing' ? 'Value already exists' : true;
    };

    expect(await asyncRule('new')).toBe(true);
    expect(await asyncRule('existing')).toBe('Value already exists');
  });
});

describe('Edge Cases', () => {
  it('should handle null and undefined values', () => {
    expect(email()(null)).toBe(true);
    expect(email()(undefined)).toBe(true);
    expect(minLength(5)(null)).toBe(true);
    expect(numeric()(undefined)).toBe(true);
  });

  it('should handle empty arrays in file type validation', () => {
    const rule = fileType([]);
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    expect(rule(file)).toBe(true); // No restrictions means all types allowed
  });

  it('should handle zero values correctly', () => {
    expect(required()(0)).toBe(true);
    expect(numeric()('0')).toBe(true);
    expect(range(0, 10)('0')).toBe(true);
  });

  it('should handle boolean values', () => {
    expect(required()(false)).toBe(true);
    expect(required()(true)).toBe(true);
  });
});