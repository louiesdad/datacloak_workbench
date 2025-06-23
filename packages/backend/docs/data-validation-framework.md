# Data Validation Framework

## Overview

The Data Validation Framework provides a comprehensive solution for validating, transforming, and sanitizing data in the backend. It supports various field types, custom validators, data transformations, and generates detailed validation reports.

## Features

- **Multiple Validation Types**: Email, URL, phone, date, number, regex, and custom validators
- **Data Transformation**: Trim, normalize, sanitize HTML, parse types, apply defaults
- **Flexible Schema Definition**: Define validation rules in a declarative way
- **Progress Tracking**: Real-time validation progress with event emissions
- **Detailed Reporting**: Comprehensive validation reports with statistics
- **Schema Export**: Export validation schemas for client-side validation
- **Performance Optimized**: Efficient validation of large datasets

## Usage

### Basic Example

```typescript
import { DataValidationService, ValidationSchema } from './services/data-validation.service';

// Initialize service
const validator = new DataValidationService();

// Define a validation schema
const userSchema: ValidationSchema = {
  name: 'user',
  description: 'User data validation',
  rules: [
    { field: 'email', type: 'email', message: 'Invalid email format' },
    { field: 'name', type: 'required', message: 'Name is required' },
    { field: 'age', type: 'number', options: { min: 18, max: 120 } },
    { field: 'phone', type: 'phone' },
    { field: 'website', type: 'url', options: { protocols: ['http', 'https'] } }
  ],
  strict: true // Warn about extra fields
};

// Register the schema
validator.registerSchema(userSchema);

// Validate data
const data = [
  { email: 'john@example.com', name: 'John Doe', age: 25, phone: '123-456-7890' },
  { email: 'invalid-email', name: '', age: 150, phone: '123' }
];

const result = await validator.validateData(data, 'user');

console.log(`Valid: ${result.isValid}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Valid Records: ${result.stats.validRecords}/${result.stats.totalRecords}`);
```

### Validation Types

#### Required Fields
```typescript
{ field: 'username', type: 'required', message: 'Username is required' }
```

#### Email Validation
```typescript
{ field: 'email', type: 'email', message: 'Please enter a valid email' }
```

#### URL Validation
```typescript
{ 
  field: 'website', 
  type: 'url', 
  options: { 
    protocols: ['http', 'https'],
    require_protocol: true 
  } 
}
```

#### Phone Validation
```typescript
{ field: 'phone', type: 'phone', options: { country: 'US' } }
```

#### Date Validation
```typescript
{ 
  field: 'birthdate', 
  type: 'date', 
  options: { 
    min: '1900-01-01', 
    max: new Date() 
  },
  message: 'Invalid date of birth'
}
```

#### Number Validation
```typescript
{ 
  field: 'score', 
  type: 'number', 
  options: { 
    min: 0, 
    max: 100, 
    integer: true 
  } 
}
```

#### Regex Pattern Validation
```typescript
{ 
  field: 'zipCode', 
  type: 'regex', 
  options: { 
    pattern: '^\\d{5}(-\\d{4})?$',
    flags: 'i'
  },
  message: 'Invalid ZIP code format'
}
```

#### Custom Validation
```typescript
// Register custom validator
validator.registerValidator('productCode', (value: string) => {
  // Custom validation logic
  return /^PROD-\d{4}-[A-Z]{2}$/.test(value);
});

// Use in schema
{ 
  field: 'code', 
  type: 'custom', 
  options: { validator: 'productCode' },
  message: 'Invalid product code format (PROD-0000-XX)'
}
```

### Data Transformation

Transform data during validation:

```typescript
const result = await validator.validateData(data, 'user', {
  transform: true,
  transformOptions: {
    trimStrings: true,           // Remove leading/trailing whitespace
    normalizeWhitespace: true,   // Replace multiple spaces with single space
    toLowerCase: true,           // Convert strings to lowercase
    toUpperCase: false,          // Convert strings to uppercase
    removeHtml: true,            // Remove HTML tags (sanitize)
    normalizeEmail: true,        // Normalize email format
    normalizePhone: true,        // Normalize phone format
    parseNumbers: true,          // Convert number strings to numbers
    parseDates: true,            // Convert date strings to Date objects
    defaultValues: {             // Apply default values for null/empty fields
      status: 'pending',
      priority: 5
    }
  }
});

// Access transformed data
console.log(result.transformedData);
```

### Field-Specific Transformations

```typescript
const schema: ValidationSchema = {
  name: 'transform-example',
  rules: [
    { 
      field: 'email', 
      type: 'email',
      transform: (value) => value.toLowerCase().trim()
    },
    {
      field: 'phone',
      type: 'phone',
      transform: (value) => value.replace(/\D/g, '') // Remove non-digits
    }
  ]
};
```

### Custom Transformers

```typescript
// Register custom transformer
validator.registerTransformer('maskSSN', (value: string) => {
  if (value.length !== 9) return value;
  return `***-**-${value.slice(-4)}`;
});

// Use in schema
{
  field: 'ssn',
  type: 'custom',
  options: { validator: 'ssn' },
  transform: (value) => {
    // Apply custom transformer
    const transformer = validator['customTransformers'].get('maskSSN');
    return transformer ? transformer(value) : value;
  }
}
```

### Progress Tracking

Monitor validation progress for large datasets:

```typescript
validator.on('validation:start', ({ schemaName, recordCount }) => {
  console.log(`Starting validation of ${recordCount} records with schema: ${schemaName}`);
});

validator.on('validation:progress', ({ processed, total, errors }) => {
  const percent = ((processed / total) * 100).toFixed(2);
  console.log(`Progress: ${percent}% (${processed}/${total}) - Errors: ${errors}`);
});

validator.on('validation:complete', ({ totalRecords, errors }) => {
  console.log(`Validation complete. Total: ${totalRecords}, Errors: ${errors}`);
});
```

### Validation Options

```typescript
const result = await validator.validateData(data, 'schemaName', {
  stopOnFirstError: false,    // Continue validation after first error
  maxErrors: 100,            // Stop after N errors
  transform: true,           // Enable data transformation
  transformOptions: { ... }  // Transformation options
});
```

### Validation Reports

Generate detailed validation reports:

```typescript
const result = await validator.validateData(data, 'user');
const report = validator.generateValidationReport(result);

console.log(report);
// Output:
// # Data Validation Report
// Generated: 2024-01-15T10:30:00.000Z
// 
// ## Summary
// - Total Records: 1000
// - Valid Records: 950
// - Invalid Records: 50
// - Validation Rate: 95.00%
// 
// ## Errors
// Total Errors: 75
// 
// ### Field: email
// - Error Count: 25
//   - Row 5: Invalid email format (value: "not-an-email")
//   - Row 12: Invalid email format (value: "@example.com")
//   ...
// 
// ## Field Statistics
// ### email
// - Total Values: 1000
// - Valid Values: 975
// - Invalid Values: 25
// - Null Values: 10
// - Validation Rate: 97.50%
```

### Schema Export

Export validation schemas for use in other systems:

```typescript
// Create validation schema object
const schemaObject = validator.createZodSchema('user');

// Use for validation
try {
  const validatedData = schemaObject.parse(userData);
  console.log('Data is valid:', validatedData);
} catch (error) {
  console.error('Validation errors:', error.errors);
}
```

### Built-in Validators

The framework includes several built-in validators:

- **SSN**: US Social Security Number (XXX-XX-XXXX)
- **Credit Card**: Valid credit card number
- **ZIP Code**: US ZIP code (XXXXX or XXXXX-XXXX)
- **Strong Password**: Configurable password strength

```typescript
// Use built-in validators
const schema: ValidationSchema = {
  name: 'secure-form',
  rules: [
    { 
      field: 'ssn', 
      type: 'custom', 
      options: { validator: 'ssn' } 
    },
    { 
      field: 'creditCard', 
      type: 'custom', 
      options: { validator: 'creditCard' } 
    },
    { 
      field: 'password', 
      type: 'custom', 
      options: { 
        validator: 'strongPassword',
        minLength: 12,
        minUppercase: 2,
        minSymbols: 2
      } 
    }
  ]
};
```

### Performance Considerations

1. **Batch Processing**: The validator processes records in batches and emits progress events every 1000 records
2. **Early Termination**: Use `stopOnFirstError` or `maxErrors` to limit validation time
3. **Memory Efficiency**: Transformed data is only stored when `transform: true`
4. **Event Throttling**: Progress events are throttled to avoid overwhelming listeners

### Best Practices

1. **Schema Reuse**: Register schemas once and reuse them
2. **Custom Validators**: Create reusable custom validators for domain-specific rules
3. **Error Messages**: Provide clear, actionable error messages
4. **Transformation Pipeline**: Chain transformations for complex data cleaning
5. **Validation Reports**: Generate reports for data quality audits
6. **Progressive Enhancement**: Start with basic validation, add complexity as needed

### Example: Complete User Registration Validation

```typescript
// Define comprehensive user registration schema
const registrationSchema: ValidationSchema = {
  name: 'user-registration',
  description: 'Complete user registration validation',
  rules: [
    // Personal Information
    { 
      field: 'email', 
      type: 'email', 
      message: 'Please provide a valid email address',
      transform: (value) => value.toLowerCase().trim()
    },
    { 
      field: 'username', 
      type: 'regex',
      options: { pattern: '^[a-zA-Z0-9_]{3,20}$' },
      message: 'Username must be 3-20 characters, alphanumeric and underscore only'
    },
    { 
      field: 'password', 
      type: 'custom',
      options: { 
        validator: 'strongPassword',
        minLength: 8,
        minUppercase: 1,
        minNumbers: 1,
        minSymbols: 1
      },
      message: 'Password must be at least 8 characters with uppercase, number, and symbol'
    },
    
    // Profile Information
    { field: 'firstName', type: 'required', message: 'First name is required' },
    { field: 'lastName', type: 'required', message: 'Last name is required' },
    { 
      field: 'birthdate', 
      type: 'date',
      options: { 
        min: new Date('1900-01-01'),
        max: new Date(Date.now() - 18 * 365 * 24 * 60 * 60 * 1000) // 18 years ago
      },
      message: 'You must be at least 18 years old'
    },
    
    // Contact Information
    { 
      field: 'phone', 
      type: 'phone',
      transform: (value) => value.replace(/\D/g, '')
    },
    { 
      field: 'zipCode', 
      type: 'custom',
      options: { validator: 'zipCode' },
      message: 'Please provide a valid US ZIP code'
    },
    
    // Terms and Marketing
    { 
      field: 'acceptTerms', 
      type: 'custom',
      options: { validator: (value) => value === true },
      message: 'You must accept the terms and conditions'
    }
  ],
  strict: true
};

// Register and use
validator.registerSchema(registrationSchema);

// Validate with transformation
const validationResult = await validator.validateData(
  registrationData, 
  'user-registration',
  {
    transform: true,
    transformOptions: {
      trimStrings: true,
      normalizeWhitespace: true,
      normalizeEmail: true,
      normalizePhone: true,
      defaultValues: {
        newsletter: false,
        language: 'en'
      }
    }
  }
);

// Process results
if (validationResult.isValid) {
  // Save transformed data
  await saveUser(validationResult.transformedData[0]);
} else {
  // Return validation errors to client
  return {
    success: false,
    errors: validationResult.errors.map(e => ({
      field: e.field,
      message: e.message
    }))
  };
}
```

## API Reference

### DataValidationService

#### Methods

- `registerSchema(schema: ValidationSchema): void` - Register a validation schema
- `getSchema(name: string): ValidationSchema | undefined` - Get a registered schema
- `registerValidator(name: string, validator: Function): void` - Register custom validator
- `registerTransformer(name: string, transformer: Function): void` - Register custom transformer
- `validateData(data: any[], schemaName: string, options?: ValidationOptions): Promise<ValidationResult>` - Validate data
- `createZodSchema(schemaName: string): any` - Create validation schema object from rules
- `generateValidationReport(result: ValidationResult): string` - Generate validation report

#### Events

- `schema:registered` - Emitted when a schema is registered
- `validation:start` - Emitted when validation starts
- `validation:progress` - Emitted during validation progress
- `validation:complete` - Emitted when validation completes

### Types

See the TypeScript definitions in `data-validation.service.ts` for complete type information.