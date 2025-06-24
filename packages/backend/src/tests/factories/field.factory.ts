/**
 * Field Data Factory
 * 
 * Generates test data for field-related testing including PII detection,
 * multi-field processing, and field discovery scenarios.
 */

import { AbstractFactory, FactoryTraits, TestDataUtils, testRandom } from './base.factory';
import { FieldInput, FieldMaskingResult, DiscoveredField } from '../../services/datacloak/types';

export interface TestFieldData {
  fieldName: string;
  text: string;
  metadata?: Record<string, any>;
  expectedPIITypes?: string[];
  confidenceScore?: number;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}

export class FieldDataFactory extends AbstractFactory<TestFieldData> {
  build(overrides?: Partial<TestFieldData>): TestFieldData {
    const fieldTypes = [
      'user_email', 'customer_phone', 'contact_info', 'personal_data',
      'feedback_text', 'comment', 'description', 'notes', 'message'
    ];

    const fieldName = testRandom.choice(fieldTypes);
    const hasPII = testRandom.boolean();
    
    let text: string;
    let expectedPIITypes: string[] = [];
    
    if (hasPII && fieldName.includes('email')) {
      const pii = TestDataUtils.generatePII();
      text = `Please contact me at ${pii.email} for more information.`;
      expectedPIITypes = ['email'];
    } else if (hasPII && fieldName.includes('phone')) {
      const pii = TestDataUtils.generatePII();
      text = `You can reach me at ${pii.phone} during business hours.`;
      expectedPIITypes = ['phone'];
    } else if (hasPII && fieldName.includes('personal')) {
      const pii = TestDataUtils.generatePII();
      text = `My name is ${pii.name} and I live at ${pii.address}.`;
      expectedPIITypes = ['name', 'address'];
    } else if (hasPII && fieldName.includes('contact')) {
      const pii = TestDataUtils.generatePII();
      text = `Contact: ${pii.name} - Email: ${pii.email} - Phone: ${pii.phone}`;
      expectedPIITypes = ['name', 'email', 'phone'];
    } else {
      // Generate non-PII text
      const sentiment = testRandom.choice(['positive', 'negative', 'neutral', 'mixed']);
      text = TestDataUtils.generateText(sentiment, testRandom.integer(50, 200));
    }

    const confidenceScore = expectedPIITypes.length > 0 
      ? testRandom.float(0.7, 0.95) 
      : testRandom.float(0.0, 0.3);

    const riskLevel = confidenceScore >= 0.9 ? 'high' 
      : confidenceScore >= 0.7 ? 'medium' 
      : 'low';

    const base: TestFieldData = {
      fieldName: `${fieldName}_${this.sequence()}`,
      text,
      metadata: {
        source: 'test_factory',
        timestamp: this.generateTimestamp(),
        category: fieldName.split('_')[0]
      },
      expectedPIITypes,
      confidenceScore,
      riskLevel
    };

    return this.merge(base, overrides);
  }

  /**
   * Create a field with specific PII type
   */
  createWithPII(piiType: 'email' | 'phone' | 'ssn' | 'credit_card' | 'name' | 'address', overrides?: Partial<TestFieldData>): TestFieldData {
    const pii = TestDataUtils.generatePII();
    let text: string;
    let fieldName: string;

    switch (piiType) {
      case 'email':
        text = `Please email me at ${pii.email} for updates.`;
        fieldName = 'contact_email';
        break;
      case 'phone':
        text = `Call me at ${pii.phone} for assistance.`;
        fieldName = 'contact_phone';
        break;
      case 'ssn':
        text = `My SSN is ${pii.ssn} for verification.`;
        fieldName = 'personal_id';
        break;
      case 'credit_card':
        text = `Payment card number: ${pii.creditCard}`;
        fieldName = 'payment_info';
        break;
      case 'name':
        text = `Hi, my name is ${pii.name} and I need help.`;
        fieldName = 'customer_name';
        break;
      case 'address':
        text = `Please send the package to ${pii.address}.`;
        fieldName = 'shipping_address';
        break;
    }

    return this.create({
      fieldName,
      text,
      expectedPIITypes: [piiType],
      confidenceScore: testRandom.float(0.85, 0.95),
      riskLevel: 'high',
      ...overrides
    });
  }

  /**
   * Create fields without PII
   */
  createWithoutPII(overrides?: Partial<TestFieldData>): TestFieldData {
    const sentiment = testRandom.choice(['positive', 'negative', 'neutral', 'mixed']);
    const text = TestDataUtils.generateText(sentiment, testRandom.integer(50, 150));
    
    return this.create({
      fieldName: `clean_text_${this.sequence()}`,
      text,
      expectedPIITypes: [],
      confidenceScore: 0,
      riskLevel: 'low',
      ...overrides
    });
  }

  /**
   * Create a multi-field dataset for testing
   */
  createDataset(size: number, piiPercent: number = 0.3): TestFieldData[] {
    const fields: TestFieldData[] = [];
    const piiCount = Math.floor(size * piiPercent);
    const cleanCount = size - piiCount;

    // Create fields with PII
    for (let i = 0; i < piiCount; i++) {
      const piiType = testRandom.choice(['email', 'phone', 'ssn', 'credit_card', 'name', 'address'] as const);
      fields.push(this.createWithPII(piiType));
    }

    // Create fields without PII
    for (let i = 0; i < cleanCount; i++) {
      fields.push(this.createWithoutPII());
    }

    // Shuffle the array for realistic distribution
    for (let i = fields.length - 1; i > 0; i--) {
      const j = Math.floor(this.random.next() * (i + 1));
      [fields[i], fields[j]] = [fields[j], fields[i]];
    }

    return fields;
  }

  /**
   * Convert TestFieldData to FieldInput format
   */
  toFieldInput(data: TestFieldData): FieldInput {
    return {
      fieldName: data.fieldName,
      text: data.text,
      metadata: data.metadata
    };
  }

  /**
   * Convert TestFieldData to FieldMaskingResult format (for mocking)
   */
  toFieldMaskingResult(data: TestFieldData): FieldMaskingResult {
    const maskedText = data.expectedPIITypes && data.expectedPIITypes.length > 0
      ? data.text.replace(/\S+@\S+\.\S+/g, '****@******.***')
               .replace(/\d{3}-\d{3}-\d{4}/g, '***-***-****')
               .replace(/\d{3}-\d{2}-\d{4}/g, '***-**-****')
               .replace(/\d{4}-\d{4}-\d{4}-\d{4}/g, '****-****-****-****')
      : data.text;

    return {
      fieldName: data.fieldName,
      originalText: data.text,
      maskedText,
      piiItemsFound: data.expectedPIITypes?.length || 0,
      metadata: data.metadata,
      success: true
    };
  }

  /**
   * Convert TestFieldData to DiscoveredField format (for field discovery testing)
   */
  toDiscoveredField(data: TestFieldData): DiscoveredField {
    const samples = (data.expectedPIITypes || []).map(piiType => {
      const pii = TestDataUtils.generatePII();
      return {
        piiType,
        sample: pii.email, // Simplified - would extract actual detected text
        masked: '****@******.***',
        confidence: data.confidenceScore || 0.8
      };
    });

    return {
      fieldName: data.fieldName,
      piiTypes: data.expectedPIITypes || [],
      confidenceScore: data.confidenceScore || 0,
      riskLevel: data.riskLevel || 'low',
      samples
    };
  }
}

// Export factory instance
export const fieldDataFactory = new FieldDataFactory();

// Register in factory registry
import { FactoryRegistry } from './base.factory';
FactoryRegistry.register('fieldData', fieldDataFactory);