import { DataValidationService, ValidationSchema } from '../data-validation.service';

describe('DataValidationService', () => {
  let service: DataValidationService;

  beforeEach(() => {
    service = new DataValidationService();
  });

  describe('Schema Management', () => {
    test('should register and retrieve schemas', () => {
      const schema: ValidationSchema = {
        name: 'user',
        description: 'User validation schema',
        rules: [
          { field: 'email', type: 'email' },
          { field: 'name', type: 'required' }
        ]
      };

      service.registerSchema(schema);
      const retrieved = service.getSchema('user');

      expect(retrieved).toEqual(schema);
    });

    test('should emit event when schema is registered', (done) => {
      const schema: ValidationSchema = {
        name: 'test',
        rules: []
      };

      service.on('schema:registered', (name) => {
        expect(name).toBe('test');
        done();
      });

      service.registerSchema(schema);
    });
  });

  describe('Basic Validation', () => {
    beforeEach(() => {
      const schema: ValidationSchema = {
        name: 'user',
        rules: [
          { field: 'email', type: 'email', message: 'Invalid email address' },
          { field: 'name', type: 'required', message: 'Name is required' },
          { field: 'age', type: 'number', options: { min: 18, max: 100 } }
        ]
      };
      service.registerSchema(schema);
    });

    test('should validate valid data', async () => {
      const data = [
        { email: 'john@example.com', name: 'John Doe', age: 25 },
        { email: 'jane@example.com', name: 'Jane Smith', age: 30 }
      ];

      const result = await service.validateData(data, 'user');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(0);
    });

    test('should catch validation errors', async () => {
      const data = [
        { email: 'invalid-email', name: 'John Doe', age: 25 },
        { email: 'jane@example.com', name: '', age: 30 },
        { email: 'bob@example.com', name: 'Bob', age: 150 }
      ];

      const result = await service.validateData(data, 'user');

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.stats.validRecords).toBe(0);
      expect(result.stats.invalidRecords).toBe(3);
    });

    test('should stop on first error when specified', async () => {
      const data = [
        { email: 'invalid-email', name: 'John', age: 25 },
        { email: 'another-invalid', name: 'Jane', age: 30 }
      ];

      const result = await service.validateData(data, 'user', { stopOnFirstError: true });

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('email');
    });

    test('should respect max errors limit', async () => {
      const data = [];
      for (let i = 0; i < 10; i++) {
        data.push({ email: 'invalid', name: '', age: 200 });
      }

      const result = await service.validateData(data, 'user', { maxErrors: 5 });

      expect(result.errors).toHaveLength(5);
      expect(result.warnings.some(w => w.message.includes('stopped after 5 errors'))).toBe(true);
    });
  });

  describe('Field Type Validation', () => {
    test('should validate email fields', async () => {
      const schema: ValidationSchema = {
        name: 'email-test',
        rules: [{ field: 'email', type: 'email' }]
      };
      service.registerSchema(schema);

      const data = [
        { email: 'valid@example.com' },
        { email: 'also.valid+tag@example.co.uk' },
        { email: 'invalid.email' },
        { email: '@invalid.com' },
        { email: 'invalid@' }
      ];

      const result = await service.validateData(data, 'email-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(3);
    });

    test('should validate URL fields', async () => {
      const schema: ValidationSchema = {
        name: 'url-test',
        rules: [{ field: 'website', type: 'url' }]
      };
      service.registerSchema(schema);

      const data = [
        { website: 'https://example.com' },
        { website: 'http://subdomain.example.com/path' },
        { website: 'not-a-url' },
        { website: 'ftp://invalid-protocol.com' }
      ];

      const result = await service.validateData(data, 'url-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(2);
    });

    test('should validate phone fields', async () => {
      const schema: ValidationSchema = {
        name: 'phone-test',
        rules: [{ field: 'phone', type: 'phone' }]
      };
      service.registerSchema(schema);

      const data = [
        { phone: '123-456-7890' },
        { phone: '(123) 456-7890' },
        { phone: '+1 123 456 7890' },
        { phone: '123' },
        { phone: 'not-a-phone' }
      ];

      const result = await service.validateData(data, 'phone-test');

      expect(result.stats.validRecords).toBe(3);
      expect(result.stats.invalidRecords).toBe(2);
    });

    test('should validate date fields', async () => {
      const schema: ValidationSchema = {
        name: 'date-test',
        rules: [
          { field: 'birthdate', type: 'date', options: { min: '1900-01-01', max: '2010-12-31' } }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { birthdate: '1990-05-15' },
        { birthdate: new Date('2000-01-01') },
        { birthdate: '1899-12-31' }, // Too old
        { birthdate: '2011-01-01' }, // Too young
        { birthdate: 'not-a-date' }
      ];

      const result = await service.validateData(data, 'date-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(3);
    });

    test('should validate number fields', async () => {
      const schema: ValidationSchema = {
        name: 'number-test',
        rules: [
          { field: 'score', type: 'number', options: { min: 0, max: 100, integer: true } }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { score: 85 },
        { score: '90' }, // String number
        { score: 95.5 }, // Not integer
        { score: -10 }, // Below min
        { score: 150 }, // Above max
        { score: 'not-a-number' }
      ];

      const result = await service.validateData(data, 'number-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(4);
    });

    test('should validate regex patterns', async () => {
      const schema: ValidationSchema = {
        name: 'regex-test',
        rules: [
          { 
            field: 'code', 
            type: 'regex', 
            options: { pattern: '^[A-Z]{3}-\\d{4}$' },
            message: 'Code must match pattern XXX-0000'
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { code: 'ABC-1234' },
        { code: 'XYZ-9999' },
        { code: 'abc-1234' }, // Lowercase
        { code: 'AB-1234' }, // Too short
        { code: 'ABC-12345' } // Too long
      ];

      const result = await service.validateData(data, 'regex-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(3);
    });
  });

  describe('Data Transformation', () => {
    test('should apply global transformations', async () => {
      const schema: ValidationSchema = {
        name: 'transform-test',
        rules: [
          { field: 'email', type: 'email' },
          { field: 'name', type: 'required' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { email: '  JOHN@EXAMPLE.COM  ', name: '  John   Doe  ' },
        { email: 'jane@example.com', name: 'Jane\n\nSmith' }
      ];

      const result = await service.validateData(data, 'transform-test', {
        transform: true,
        transformOptions: {
          trimStrings: true,
          normalizeWhitespace: true,
          toLowerCase: true
        }
      });

      expect(result.transformedData).toBeDefined();
      expect(result.transformedData![0].email).toBe('john@example.com');
      expect(result.transformedData![0].name).toBe('john doe');
      expect(result.transformedData![1].name).toBe('jane smith');
    });

    test('should remove HTML from strings', async () => {
      const schema: ValidationSchema = {
        name: 'html-test',
        rules: [{ field: 'description', type: 'required' }]
      };
      service.registerSchema(schema);

      const data = [
        { description: '<p>Hello <b>World</b></p>' },
        { description: '<script>alert("XSS")</script>Safe text' }
      ];

      const result = await service.validateData(data, 'html-test', {
        transform: true,
        transformOptions: { removeHtml: true }
      });

      expect(result.transformedData![0].description).toBe('Hello World');
      expect(result.transformedData![1].description).toBe('Safe text');
    });

    test('should apply default values', async () => {
      const schema: ValidationSchema = {
        name: 'default-test',
        rules: [
          { field: 'status', type: 'required' },
          { field: 'priority', type: 'number' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { status: 'active' },
        { status: 'inactive', priority: null }
      ];

      const result = await service.validateData(data, 'default-test', {
        transform: true,
        transformOptions: {
          defaultValues: {
            priority: 5,
            category: 'general'
          }
        }
      });

      expect(result.transformedData![0].priority).toBe(5);
      expect(result.transformedData![0].category).toBe('general');
      expect(result.transformedData![1].priority).toBe(5);
    });

    test('should parse numbers and dates', async () => {
      const schema: ValidationSchema = {
        name: 'parse-test',
        rules: [
          { field: 'age', type: 'number' },
          { field: 'date', type: 'date' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { age: '25', date: '2023-01-15' },
        { age: '30.5', date: '2023-06-30T10:30:00Z' }
      ];

      const result = await service.validateData(data, 'parse-test', {
        transform: true,
        transformOptions: {
          parseNumbers: true,
          parseDates: true
        }
      });

      expect(typeof result.transformedData![0].age).toBe('number');
      expect(result.transformedData![0].age).toBe(25);
      expect(result.transformedData![1].date).toBeInstanceOf(Date);
    });
  });

  describe('Custom Validators and Transformers', () => {
    test('should use custom validators', async () => {
      // Register custom validator
      service.registerValidator('evenNumber', (value: any) => {
        return typeof value === 'number' && value % 2 === 0;
      });

      const schema: ValidationSchema = {
        name: 'custom-test',
        rules: [
          { 
            field: 'value', 
            type: 'custom', 
            options: { validator: 'evenNumber' },
            message: 'Value must be an even number'
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { value: 2 },
        { value: 4 },
        { value: 3 },
        { value: 5 }
      ];

      const result = await service.validateData(data, 'custom-test');

      expect(result.stats.validRecords).toBe(2);
      expect(result.stats.invalidRecords).toBe(2);
    });

    test('should use custom transformers', async () => {
      // Register custom transformer
      service.registerTransformer('reverse', (value: string) => {
        return value.split('').reverse().join('');
      });

      const schema: ValidationSchema = {
        name: 'transform-custom',
        rules: [
          { 
            field: 'text', 
            type: 'required',
            transform: (value) => {
              const transformer = service.getTransformer('reverse');
              return transformer ? transformer(value) : value;
            }
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { text: 'hello' },
        { text: 'world' }
      ];

      const result = await service.validateData(data, 'transform-custom', {
        transform: true
      });

      expect(result.transformedData![0].text).toBe('olleh');
      expect(result.transformedData![1].text).toBe('dlrow');
    });
  });

  describe('Built-in Validators', () => {
    test('should validate SSN', async () => {
      service.registerValidator('ssn', (value: string) => {
        const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
        return ssnRegex.test(value);
      });

      const schema: ValidationSchema = {
        name: 'ssn-test',
        rules: [
          { field: 'ssn', type: 'custom', options: { validator: 'ssn' } }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { ssn: '123-45-6789' },
        { ssn: '123456789' },
        { ssn: '123-45-678' }, // Too short
        { ssn: '123-45-67890' } // Too long
      ];

      const result = await service.validateData(data, 'ssn-test');

      expect(result.stats.validRecords).toBe(2);
    });

    test('should validate zip codes', async () => {
      service.registerValidator('zipCode', (value: string) => {
        const zipRegex = /^\d{5}(-\d{4})?$/;
        return zipRegex.test(value);
      });

      const schema: ValidationSchema = {
        name: 'zip-test',
        rules: [
          { field: 'zip', type: 'custom', options: { validator: 'zipCode' } }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { zip: '12345' },
        { zip: '12345-6789' },
        { zip: '1234' }, // Too short
        { zip: 'ABCDE' } // Letters
      ];

      const result = await service.validateData(data, 'zip-test');

      expect(result.stats.validRecords).toBe(2);
    });
  });

  describe('Strict Mode', () => {
    test('should warn about extra fields in strict mode', async () => {
      const schema: ValidationSchema = {
        name: 'strict-test',
        rules: [
          { field: 'name', type: 'required' },
          { field: 'email', type: 'email' }
        ],
        strict: true
      };
      service.registerSchema(schema);

      const data = [
        { name: 'John', email: 'john@example.com', extra: 'field' },
        { name: 'Jane', email: 'jane@example.com', another: 'extra', field: 'value' }
      ];

      const result = await service.validateData(data, 'strict-test');

      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0].message).toContain('Extra fields found');
    });
  });

  describe('Progress Events', () => {
    test('should emit progress events', async () => {
      const schema: ValidationSchema = {
        name: 'progress-test',
        rules: [{ field: 'value', type: 'number' }]
      };
      service.registerSchema(schema);

      const data = [];
      for (let i = 0; i < 2500; i++) {
        data.push({ value: i });
      }

      const progressEvents: any[] = [];
      service.on('validation:progress', (progress) => {
        progressEvents.push(progress);
      });

      let startEmitted = false;
      let completeEmitted = false;
      
      service.on('validation:start', () => {
        startEmitted = true;
      });
      
      service.on('validation:complete', () => {
        completeEmitted = true;
      });

      await service.validateData(data, 'progress-test');

      expect(startEmitted).toBe(true);
      expect(completeEmitted).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[0].processed).toBe(1001); // First progress at 1000
    });
  });

  describe('Validation Report', () => {
    test('should generate comprehensive validation report', async () => {
      const schema: ValidationSchema = {
        name: 'report-test',
        rules: [
          { field: 'email', type: 'email' },
          { field: 'age', type: 'number', options: { min: 0, max: 120 } }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { email: 'valid@example.com', age: 25 },
        { email: 'invalid-email', age: 30 },
        { email: 'another@example.com', age: 150 },
        { email: null, age: null }
      ];

      const result = await service.validateData(data, 'report-test');
      const report = service.generateValidationReport(result);

      expect(report).toContain('# Data Validation Report');
      expect(report).toContain('Total Records: 4');
      expect(report).toContain('Valid Records: 2');
      expect(report).toContain('Invalid Records: 2');
      expect(report).toContain('## Errors');
      expect(report).toContain('Field: email');
      expect(report).toContain('Field: age');
    });
  });

  describe('Schema Validation', () => {
    test('should create validation schema from rules', () => {
      const schema: ValidationSchema = {
        name: 'schema-test',
        rules: [
          { field: 'email', type: 'email' },
          { field: 'name', type: 'required' },
          { field: 'age', type: 'number', options: { min: 18 } }
        ]
      };
      service.registerSchema(schema);

      const validationSchema = service.createZodSchema('schema-test');
      
      // Test valid data
      const validData = { email: 'test@example.com', name: 'John', age: 25 };
      expect(() => validationSchema.parse(validData)).not.toThrow();

      // Test invalid data
      const invalidData = { email: 'invalid', name: '', age: 15 };
      expect(() => validationSchema.parse(invalidData)).toThrow();
    });
  });

  describe('Field Statistics', () => {
    test('should track detailed field statistics', async () => {
      const schema: ValidationSchema = {
        name: 'stats-test',
        rules: [
          { field: 'status', type: 'required' },
          { field: 'score', type: 'number' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { status: 'active', score: 85 },
        { status: 'inactive', score: null },
        { status: '', score: 'invalid' },
        { status: 'pending', score: 90 }
      ];

      const result = await service.validateData(data, 'stats-test');

      const statusStats = result.stats.fieldStats.get('status');
      expect(statusStats).toBeDefined();
      expect(statusStats!.totalValues).toBe(4);
      expect(statusStats!.validValues).toBe(3);
      expect(statusStats!.invalidValues).toBe(1);
      expect(statusStats!.nullValues).toBe(1);

      const scoreStats = result.stats.fieldStats.get('score');
      expect(scoreStats).toBeDefined();
      expect(scoreStats!.nullValues).toBe(1);
    });
  });

  describe('Advanced Validation Features', () => {
    test('should handle custom validator not found', async () => {
      const schema: ValidationSchema = {
        name: 'custom-error-test',
        rules: [
          { field: 'test', type: 'custom', options: { validator: 'nonExistentValidator' } }
        ]
      };
      service.registerSchema(schema);

      const data = [{ test: 'value' }];

      await expect(service.validateData(data, 'custom-error-test')).rejects.toThrow('Custom validator \'nonExistentValidator\' not found');
    });

    test('should handle validation with no schema', async () => {
      await expect(service.validateData([], 'nonExistentSchema')).rejects.toThrow('Schema \'nonExistentSchema\' not found');
    });

    test('should handle built-in transformers', async () => {
      const normalizeEmailTransformer = service.getTransformer('normalizeEmail');
      expect(normalizeEmailTransformer).toBeDefined();
      expect(normalizeEmailTransformer!('TEST@EXAMPLE.COM')).toBe('test@example.com');

      const normalizePhoneTransformer = service.getTransformer('normalizePhone');
      expect(normalizePhoneTransformer).toBeDefined();
      expect(normalizePhoneTransformer!('(555) 123-4567')).toBe('555-123-4567');

      const maskSensitiveTransformer = service.getTransformer('maskSensitive');
      expect(maskSensitiveTransformer).toBeDefined();
      expect(maskSensitiveTransformer!('123456789', { keepLast: 4 })).toBe('*****6789');
    });

    test('should handle built-in validators', async () => {
      // Test SSN validator
      service.registerValidator('testSSN', service['customValidators'].get('ssn')!);
      expect(service['customValidators'].get('testSSN')!('123-45-6789')).toBe(true);
      expect(service['customValidators'].get('testSSN')!('123456789')).toBe(true);
      expect(service['customValidators'].get('testSSN')!('123-45-678')).toBe(false);

      // Test credit card validator
      service.registerValidator('testCC', service['customValidators'].get('creditCard')!);
      expect(service['customValidators'].get('testCC')!('4111111111111111')).toBe(true); // Valid Visa
      expect(service['customValidators'].get('testCC')!('1234567890123456')).toBe(false); // Invalid

      // Test zip code validator
      service.registerValidator('testZip', service['customValidators'].get('zipCode')!);
      expect(service['customValidators'].get('testZip')!('12345')).toBe(true);
      expect(service['customValidators'].get('testZip')!('12345-6789')).toBe(true);
      expect(service['customValidators'].get('testZip')!('1234')).toBe(false);

      // Test strong password validator
      service.registerValidator('testPassword', service['customValidators'].get('strongPassword')!);
      expect(service['customValidators'].get('testPassword')!('StrongP@ss123')).toBe(true);
      expect(service['customValidators'].get('testPassword')!('weak')).toBe(false);
    });

    test('should handle phone validation edge cases', async () => {
      const schema: ValidationSchema = {
        name: 'phone-test',
        rules: [
          { field: 'phone', type: 'phone' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { phone: '+1 123 456 7890' },
        { phone: '1234567890123456' }, // Too long
        { phone: '123' }, // Too short
        { phone: 'abc-def-ghij' } // Letters
      ];

      const result = await service.validateData(data, 'phone-test');
      expect(result.stats.validRecords).toBeGreaterThanOrEqual(1); // At least the first should be valid
    });

    test('should handle date validation with range options', async () => {
      const schema: ValidationSchema = {
        name: 'date-range-test',
        rules: [
          { 
            field: 'birth_date', 
            type: 'date',
            options: { 
              min: '1900-01-01',
              max: '2010-12-31'
            }
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { birth_date: '1990-05-15' }, // Valid
        { birth_date: '1850-01-01' }, // Too old
        { birth_date: '2020-01-01' }, // Too new
        { birth_date: 'invalid-date' } // Invalid format
      ];

      const result = await service.validateData(data, 'date-range-test');
      expect(result.stats.validRecords).toBe(1);
    });

    test('should handle number validation with integer requirement', async () => {
      const schema: ValidationSchema = {
        name: 'integer-test',
        rules: [
          { 
            field: 'count', 
            type: 'number',
            options: { 
              integer: true,
              min: 0,
              max: 100
            }
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { count: 42 }, // Valid integer
        { count: 42.5 }, // Not integer
        { count: -5 }, // Below min
        { count: 150 } // Above max
      ];

      const result = await service.validateData(data, 'integer-test');
      expect(result.stats.validRecords).toBe(1);
    });

    test('should handle URL validation with protocol options', async () => {
      const schema: ValidationSchema = {
        name: 'url-test',
        rules: [
          { 
            field: 'website', 
            type: 'url',
            options: {
              protocols: ['https:']
            }
          }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { website: 'https://example.com' }, // Valid HTTPS
        { website: 'http://example.com' }, // Invalid protocol
        { website: 'not-a-url' } // Invalid URL
      ];

      const result = await service.validateData(data, 'url-test');
      expect(result.stats.validRecords).toBe(1);
    });

    test('should handle transformations with all options', async () => {
      const schema: ValidationSchema = {
        name: 'transform-all-test',
        rules: [
          { field: 'text', type: 'required' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { text: '  HELLO WORLD  ' },
        { text: '<script>alert("xss")</script>Test' },
        { text: '  Multiple    Spaces  ' }
      ];

      const result = await service.validateData(data, 'transform-all-test', {
        transform: true,
        transformOptions: {
          trimStrings: true,
          normalizeWhitespace: true,
          toLowerCase: true,
          toUpperCase: false, // Should be overridden by toLowerCase
          removeHtml: true,
          normalizeEmail: true,
          normalizePhone: true,
          parseNumbers: true,
          parseDates: true,
          defaultValues: {
            category: 'default'
          }
        }
      });

      expect(result.transformedData![0].text).toBe('hello world');
      expect(result.transformedData![1].text).toBe('test');
      expect(result.transformedData![2].text).toBe('multiple spaces');
      expect(result.transformedData![0].category).toBe('default');
    });

    test('should handle large dataset with warnings', async () => {
      const schema: ValidationSchema = {
        name: 'large-test',
        rules: [
          { field: 'id', type: 'number' }
        ]
      };
      service.registerSchema(schema);

      // Create dataset with warnings
      const data = Array.from({ length: 10 }, (_, i) => ({ id: i < 5 ? i : 'invalid' }));

      const result = await service.validateData(data, 'large-test', {
        maxErrors: 3
      });

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0].message).toContain('Validation stopped after 3 errors');
    });

    test('should generate report with field statistics', async () => {
      const schema: ValidationSchema = {
        name: 'field-stats-test',
        rules: [
          { field: 'status', type: 'required' },
          { field: 'score', type: 'number' }
        ]
      };
      service.registerSchema(schema);

      const data = [
        { status: 'active', score: 85 },
        { status: '', score: null },
        { status: 'pending', score: 90 }
      ];

      const result = await service.validateData(data, 'field-stats-test');
      const report = service.generateValidationReport(result);

      expect(report).toContain('## Field Statistics');
      expect(report).toContain('### status');
      expect(report).toContain('### score');
      expect(report).toContain('Validation Rate:');
    });
  });
});