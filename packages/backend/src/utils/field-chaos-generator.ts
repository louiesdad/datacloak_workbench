import seedrandom from 'seedrandom';

export interface FieldChaosDataset {
  metadata: {
    recordCount: number;
    uniqueFieldCombinations: number;
    filename: string;
    seed: number;
    generatedAt: string;
    description: string;
  };
  headers: string[];
  records: Record<string, any>[];
}

export class FieldChaosGenerator {
  private rng: seedrandom.PRNG;
  private seed: number;
  private baseDate = new Date('2024-06-23T00:00:00.000Z');

  // Problematic field names with various issues
  private problematicFieldNames = [
    // Spaces and special characters
    'Customer Name', 'Email Address', 'Phone Number', 'Date of Birth',
    'Product Review', 'Customer Comment', 'Support Ticket ID',
    
    // Mixed case and inconsistent naming
    'customerId', 'CustomerID', 'customer_id', 'Customer-ID', 'customer.id',
    'userFeedback', 'user_feedback', 'User Feedback', 'USER_FEEDBACK',
    
    // Confusing similar names
    'comments', 'comment', 'Comments', 'user_comments', 'customer_comments',
    'feedback', 'user_feedback', 'customer_feedback', 'product_feedback',
    
    // Special characters and edge cases
    'field(with)parens', 'field-with-dashes', 'field.with.dots', 'field/with/slashes',
    'field with spaces and (parens)', 'field"with"quotes', "field'with'apostrophes",
    
    // Numbers and technical names
    'field_123', 'field123', '123_field', 'field_v2', 'field_2.0',
    'API_Response', 'JSON_Data', 'XML_Content', 'CSV_Export',
    
    // Long and complex names
    'very_long_field_name_that_exceeds_normal_length_expectations',
    'AnotherVeryLongFieldNameInCamelCaseFormat',
    'Yet Another Field With Many Spaces And Words',
    
    // Duplicate-like fields
    'address', 'Address', 'billing_address', 'shipping_address', 'home_address',
    'date', 'Date', 'created_date', 'updated_date', 'birth_date', 'order_date'
  ];

  private chaosContentTypes = [
    'empty_string',
    'very_long_text',
    'special_characters',
    'mixed_languages',
    'json_like',
    'xml_like',
    'csv_like',
    'code_snippet',
    'url_content',
    'email_content',
    'phone_content',
    'mixed_content'
  ];

  constructor(seed: number = Date.now()) {
    this.seed = seed;
    this.rng = seedrandom(seed.toString());
  }

  generateFieldChaosDataset(): FieldChaosDataset {
    const recordCount = 2000;
    
    // Generate a chaotic set of field names
    const allPossibleFields = this.generateChaoticFieldSet();
    
    // Generate records with varying field combinations
    const records: Record<string, any>[] = [];
    const fieldCombinations = new Set<string>();
    
    for (let i = 0; i < recordCount; i++) {
      const record = this.generateChaoticRecord(allPossibleFields, i);
      records.push(record);
      
      // Track unique field combinations
      const recordFieldSignature = Object.keys(record)
        .filter(k => record[k] !== null && record[k] !== undefined)
        .sort()
        .join('|');
      fieldCombinations.add(recordFieldSignature);
    }

    return {
      metadata: {
        recordCount: records.length,
        uniqueFieldCombinations: fieldCombinations.size,
        filename: 'test_field_chaos_2k.csv',
        seed: this.seed,
        generatedAt: this.baseDate.toISOString(),
        description: 'Chaotic dataset with problematic field structures for multi-field analysis testing'
      },
      headers: allPossibleFields,
      records
    };
  }

  private generateChaoticFieldSet(): string[] {
    // Start with core problematic fields
    const coreFields = [...this.problematicFieldNames];
    
    // Add some completely random fields
    for (let i = 0; i < 10; i++) {
      coreFields.push(this.generateRandomFieldName());
    }
    
    // Shuffle for chaos
    return this.shuffleArray(coreFields);
  }

  private generateRandomFieldName(): string {
    const patterns = [
      () => `random_${Math.floor(this.rng() * 1000)}`,
      () => `Field${Math.floor(this.rng() * 100)}`,
      () => `data ${Math.floor(this.rng() * 50)}`,
      () => `item-${Math.floor(this.rng() * 200)}`,
      () => `column.${Math.floor(this.rng() * 75)}`,
      () => `attr(${Math.floor(this.rng() * 25)})`,
      () => `val_${String.fromCharCode(97 + Math.floor(this.rng() * 26))}_${Math.floor(this.rng() * 10)}`
    ];
    
    const pattern = patterns[Math.floor(this.rng() * patterns.length)];
    return pattern();
  }

  private generateChaoticRecord(allFields: string[], recordIndex: number): Record<string, any> {
    const record: Record<string, any> = {};
    
    // Each record gets a random subset of fields (30-80% of all fields)
    const fieldCount = Math.floor(allFields.length * (0.3 + this.rng() * 0.5));
    const selectedFields = this.shuffleArray([...allFields]).slice(0, fieldCount);
    
    // Initialize all fields as null first
    allFields.forEach(field => {
      record[field] = null;
    });
    
    // Fill selected fields with chaotic content
    selectedFields.forEach(field => {
      record[field] = this.generateChaoticContent(field, recordIndex);
    });
    
    return record;
  }

  private generateChaoticContent(fieldName: string, recordIndex: number): any {
    const contentType = this.chaosContentTypes[Math.floor(this.rng() * this.chaosContentTypes.length)];
    
    switch (contentType) {
      case 'empty_string':
        return '';
        
      case 'very_long_text':
        return this.generateVeryLongText();
        
      case 'special_characters':
        return this.generateSpecialCharacterText();
        
      case 'mixed_languages':
        return this.generateMixedLanguageText();
        
      case 'json_like':
        return this.generateJsonLikeText();
        
      case 'xml_like':
        return this.generateXmlLikeText();
        
      case 'csv_like':
        return this.generateCsvLikeText();
        
      case 'code_snippet':
        return this.generateCodeSnippet();
        
      case 'url_content':
        return this.generateUrlContent();
        
      case 'email_content':
        return this.generateEmailContent();
        
      case 'phone_content':
        return this.generatePhoneContent();
        
      default:
        return this.generateMixedContent(fieldName, recordIndex);
    }
  }

  private generateVeryLongText(): string {
    const phrases = [
      'This is an extremely long piece of text that might cause issues with field processing',
      'Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt',
      'The quick brown fox jumps over the lazy dog again and again and again',
      'Supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopicsilicovolcanoconiosiss'
    ];
    
    let longText = '';
    for (let i = 0; i < 20; i++) {
      longText += phrases[Math.floor(this.rng() * phrases.length)] + ' ';
    }
    
    return longText.trim();
  }

  private generateSpecialCharacterText(): string {
    const specialChars = ['<', '>', '{', '}', '[', ']', '\\', '/', '|', '@', '#', '$', '%', '^', '&', '*'];
    const baseText = 'Text with special characters';
    
    let result = baseText;
    for (let i = 0; i < 5; i++) {
      const char = specialChars[Math.floor(this.rng() * specialChars.length)];
      const pos = Math.floor(this.rng() * result.length);
      result = result.slice(0, pos) + char + result.slice(pos);
    }
    
    return result;
  }

  private generateMixedLanguageText(): string {
    const texts = [
      'Hello мир world français español',
      'Testing 测试 тест prueba',
      'Data données datos данные',
      'Mixed 混合 смешанный mezclado'
    ];
    
    return texts[Math.floor(this.rng() * texts.length)];
  }

  private generateJsonLikeText(): string {
    return `{"key": "value", "number": ${Math.floor(this.rng() * 100)}, "nested": {"inner": "data"}}`;
  }

  private generateXmlLikeText(): string {
    return `<root><item id="${Math.floor(this.rng() * 1000)}">Some XML-like content</item></root>`;
  }

  private generateCsvLikeText(): string {
    return `"value1","value2","value with, comma","value with ""quotes"""`;
  }

  private generateCodeSnippet(): string {
    const snippets = [
      'function test() { return "hello"; }',
      'SELECT * FROM table WHERE id = 123;',
      'if (condition) { doSomething(); }',
      'for (let i = 0; i < 10; i++) { console.log(i); }'
    ];
    
    return snippets[Math.floor(this.rng() * snippets.length)];
  }

  private generateUrlContent(): string {
    return `https://example.com/path?param=${Math.floor(this.rng() * 1000)}&other=value`;
  }

  private generateEmailContent(): string {
    return `user${Math.floor(this.rng() * 1000)}@example.com`;
  }

  private generatePhoneContent(): string {
    return `+1-${Math.floor(this.rng() * 900 + 100)}-${Math.floor(this.rng() * 900 + 100)}-${Math.floor(this.rng() * 9000 + 1000)}`;
  }

  private generateMixedContent(fieldName: string, recordIndex: number): string {
    // Generate contextual content based on field name
    if (fieldName.toLowerCase().includes('comment') || fieldName.toLowerCase().includes('feedback')) {
      return this.generateCommentLikeContent();
    } else if (fieldName.toLowerCase().includes('id')) {
      return `ID-${recordIndex}-${Math.floor(this.rng() * 10000)}`;
    } else if (fieldName.toLowerCase().includes('name')) {
      return this.generateNameLikeContent();
    } else if (fieldName.toLowerCase().includes('date')) {
      return this.generateDateLikeContent();
    } else {
      return `Mixed content for ${fieldName} record ${recordIndex}`;
    }
  }

  private generateCommentLikeContent(): string {
    const comments = [
      'Great product, very satisfied!',
      'Could be better, needs improvement',
      'Average experience, nothing special',
      'Excellent service, highly recommend',
      'Poor quality, disappointed',
      'Mixed feelings about this item'
    ];
    
    return comments[Math.floor(this.rng() * comments.length)];
  }

  private generateNameLikeContent(): string {
    const names = [
      'John Doe', 'Jane Smith', 'Bob Johnson', 'Alice Brown',
      'Mike Wilson', 'Sarah Davis', 'Tom Anderson', 'Lisa Garcia'
    ];
    
    return names[Math.floor(this.rng() * names.length)];
  }

  private generateDateLikeContent(): string {
    const formats = [
      () => `2024-${String(Math.floor(this.rng() * 12) + 1).padStart(2, '0')}-${String(Math.floor(this.rng() * 28) + 1).padStart(2, '0')}`,
      () => `${Math.floor(this.rng() * 12) + 1}/${Math.floor(this.rng() * 28) + 1}/2024`,
      () => `${Math.floor(this.rng() * 28) + 1}-${Math.floor(this.rng() * 12) + 1}-2024`,
      () => new Date(2024, Math.floor(this.rng() * 12), Math.floor(this.rng() * 28) + 1).toISOString()
    ];
    
    const format = formats[Math.floor(this.rng() * formats.length)];
    return format();
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}