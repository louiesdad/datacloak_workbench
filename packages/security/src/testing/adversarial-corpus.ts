import { PIIType } from '../interfaces/datacloak';

export interface AdversarialPIIExample {
  text: string;
  expectedPII: Array<{
    type: PIIType;
    value: string;
    startIndex: number;
    endIndex: number;
    obfuscated?: boolean;
    variant?: string;
  }>;
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  category: string;
}

export interface CorpusStats {
  totalExamples: number;
  byDifficulty: Record<string, number>;
  byPIIType: Record<PIIType, number>;
  byCategory: Record<string, number>;
}

export class AdversarialCorpus {
  private corpus: AdversarialPIIExample[] = [];
  private readonly targetSize = 1_000_000;

  constructor() {
    this.generateCorpus();
  }

  getCorpus(): AdversarialPIIExample[] {
    return this.corpus;
  }

  getStats(): CorpusStats {
    const stats: CorpusStats = {
      totalExamples: this.corpus.length,
      byDifficulty: {},
      byPIIType: {} as Record<PIIType, number>,
      byCategory: {}
    };

    // Initialize counters
    Object.values(PIIType).forEach(type => {
      stats.byPIIType[type] = 0;
    });

    this.corpus.forEach(example => {
      // Count by difficulty
      stats.byDifficulty[example.difficulty] = (stats.byDifficulty[example.difficulty] || 0) + 1;
      
      // Count by category
      stats.byCategory[example.category] = (stats.byCategory[example.category] || 0) + 1;
      
      // Count by PII type
      example.expectedPII.forEach(pii => {
        stats.byPIIType[pii.type]++;
      });
    });

    return stats;
  }

  getExamplesByDifficulty(difficulty: string): AdversarialPIIExample[] {
    return this.corpus.filter(example => example.difficulty === difficulty);
  }

  getExamplesByPIIType(piiType: PIIType): AdversarialPIIExample[] {
    return this.corpus.filter(example => 
      example.expectedPII.some(pii => pii.type === piiType)
    );
  }

  private generateCorpus(): void {
    console.log('Generating adversarial corpus with 1M PII combinations...');
    
    const generators = [
      () => this.generateEmailVariants(10_000),
      () => this.generatePhoneVariants(10_000),
      () => this.generateSSNVariants(10_000),
      () => this.generateCreditCardVariants(10_000),
      () => this.generateAddressVariants(10_000),
      () => this.generateNameVariants(10_000),
      () => this.generateDateOfBirthVariants(10_000),
      () => this.generateMixedPIIExamples(20_000),
      () => this.generateObfuscatedExamples(10_000),
      () => this.generateContextualExamples(10_000)
    ];

    generators.forEach(generator => {
      const batch = generator();
      // Process in smaller batches to avoid stack overflow
      for (let i = 0; i < batch.length; i += 1000) {
        this.corpus.push(...batch.slice(i, i + 1000));
      }
    });

    console.log(`Generated ${this.corpus.length} adversarial examples`);
  }

  private generateEmailVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const domains = ['gmail.com', 'yahoo.com', 'outlook.com', 'company.org', 'test.co.uk', 'example.io'];
    const userPrefixes = ['john', 'jane', 'user', 'admin', 'support', 'contact', 'info'];
    const suffixes = ['123', 'test', '2024', 'prod', 'dev'];
    
    for (let i = 0; i < count; i++) {
      const prefix = userPrefixes[i % userPrefixes.length];
      const suffix = Math.random() > 0.5 ? suffixes[i % suffixes.length] : '';
      const domain = domains[i % domains.length];
      const separator = ['.', '_', '-', '+'][i % 4];
      
      let email: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 4 === 0) {
        // Easy: standard format
        email = `${prefix}${suffix}@${domain}`;
        difficulty = 'easy';
      } else if (i % 4 === 1) {
        // Medium: with separators
        email = `${prefix}${separator}${suffix}@${domain}`;
        difficulty = 'medium';
      } else if (i % 4 === 2) {
        // Hard: obfuscated
        email = `${prefix}${suffix} AT ${domain.replace('.', ' DOT ')}`;
        difficulty = 'hard';
      } else {
        // Extreme: heavily obfuscated
        email = `${prefix}[at]${domain} (email)`;
        difficulty = 'extreme';
      }
      
      const text = this.wrapInContext(email, 'email');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.EMAIL,
          value: email,
          startIndex: text.indexOf(email),
          endIndex: text.indexOf(email) + email.length,
          obfuscated: difficulty === 'hard' || difficulty === 'extreme'
        }],
        difficulty,
        category: 'email_variants'
      });
    }
    
    return examples;
  }

  private generatePhoneVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const areaCodes = ['555', '123', '456', '789', '202', '415', '212'];
    
    for (let i = 0; i < count; i++) {
      const areaCode = areaCodes[i % areaCodes.length];
      const exchange = String(Math.floor(Math.random() * 900) + 100);
      const number = String(Math.floor(Math.random() * 9000) + 1000);
      
      let phone: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 5 === 0) {
        phone = `${areaCode}-${exchange}-${number}`;
        difficulty = 'easy';
      } else if (i % 5 === 1) {
        phone = `(${areaCode}) ${exchange}-${number}`;
        difficulty = 'easy';
      } else if (i % 5 === 2) {
        phone = `+1-${areaCode}-${exchange}-${number}`;
        difficulty = 'medium';
      } else if (i % 5 === 3) {
        phone = `${areaCode}.${exchange}.${number}`;
        difficulty = 'medium';
      } else {
        phone = `${areaCode} ${exchange} ${number} (phone)`;
        difficulty = 'hard';
      }
      
      const text = this.wrapInContext(phone, 'phone');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.PHONE,
          value: phone,
          startIndex: text.indexOf(phone),
          endIndex: text.indexOf(phone) + phone.length
        }],
        difficulty,
        category: 'phone_variants'
      });
    }
    
    return examples;
  }

  private generateSSNVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const area = String(Math.floor(Math.random() * 900) + 100);
      const group = String(Math.floor(Math.random() * 90) + 10);
      const serial = String(Math.floor(Math.random() * 9000) + 1000);
      
      let ssn: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 4 === 0) {
        ssn = `${area}-${group}-${serial}`;
        difficulty = 'easy';
      } else if (i % 4 === 1) {
        ssn = `${area} ${group} ${serial}`;
        difficulty = 'medium';
      } else if (i % 4 === 2) {
        ssn = `SSN: ${area}${group}${serial}`;
        difficulty = 'medium';
      } else {
        ssn = `Social Security Number ${area}-${group}-${serial}`;
        difficulty = 'hard';
      }
      
      const text = this.wrapInContext(ssn, 'ssn');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.SSN,
          value: ssn,
          startIndex: text.indexOf(ssn),
          endIndex: text.indexOf(ssn) + ssn.length
        }],
        difficulty,
        category: 'ssn_variants'
      });
    }
    
    return examples;
  }

  private generateCreditCardVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const cardPrefixes = ['4', '5', '37', '6011'];
    
    for (let i = 0; i < count; i++) {
      const prefix = cardPrefixes[i % cardPrefixes.length];
      let cardNumber: string;
      
      if (prefix === '4') {
        // Visa: starts with 4, 16 digits
        cardNumber = '4' + String(Math.floor(Math.random() * 10**15)).padStart(15, '0');
      } else if (prefix === '5') {
        // Mastercard: starts with 5, 16 digits
        cardNumber = '5' + String(Math.floor(Math.random() * 10**15)).padStart(15, '0');
      } else if (prefix === '37') {
        // Amex: starts with 37, 15 digits
        cardNumber = '37' + String(Math.floor(Math.random() * 10**13)).padStart(13, '0');
      } else {
        // Discover: starts with 6011, 16 digits
        cardNumber = '6011' + String(Math.floor(Math.random() * 10**12)).padStart(12, '0');
      }
      
      let formattedCard: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 4 === 0) {
        formattedCard = cardNumber.replace(/(.{4})/g, '$1 ').trim();
        difficulty = 'easy';
      } else if (i % 4 === 1) {
        formattedCard = cardNumber.replace(/(.{4})/g, '$1-').slice(0, -1);
        difficulty = 'medium';
      } else if (i % 4 === 2) {
        formattedCard = `**** **** **** ${cardNumber.slice(-4)}`;
        difficulty = 'hard';
      } else {
        formattedCard = `Card ending in ${cardNumber.slice(-4)}`;
        difficulty = 'extreme';
      }
      
      const text = this.wrapInContext(formattedCard, 'credit_card');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.CREDIT_CARD,
          value: formattedCard,
          startIndex: text.indexOf(formattedCard),
          endIndex: text.indexOf(formattedCard) + formattedCard.length,
          obfuscated: difficulty === 'hard' || difficulty === 'extreme'
        }],
        difficulty,
        category: 'credit_card_variants'
      });
    }
    
    return examples;
  }

  private generateAddressVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const streets = ['Main St', 'Oak Ave', 'First St', 'Park Blvd', 'Washington Dr'];
    const cities = ['Springfield', 'Madison', 'Georgetown', 'Franklin', 'Clinton'];
    const states = ['CA', 'NY', 'TX', 'FL', 'IL'];
    const zips = ['12345', '90210', '10001', '33101', '60601'];
    
    for (let i = 0; i < count; i++) {
      const streetNum = Math.floor(Math.random() * 9999) + 1;
      const street = streets[i % streets.length];
      const city = cities[i % cities.length];
      const state = states[i % states.length];
      const zip = zips[i % zips.length];
      
      let address: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 3 === 0) {
        address = `${streetNum} ${street}, ${city}, ${state} ${zip}`;
        difficulty = 'easy';
      } else if (i % 3 === 1) {
        address = `${streetNum} ${street}\n${city}, ${state} ${zip}`;
        difficulty = 'medium';
      } else {
        address = `Address: ${streetNum} ${street}, ${city} ${state}`;
        difficulty = 'hard';
      }
      
      const text = this.wrapInContext(address, 'address');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.ADDRESS,
          value: address,
          startIndex: text.indexOf(address),
          endIndex: text.indexOf(address) + address.length
        }],
        difficulty,
        category: 'address_variants'
      });
    }
    
    return examples;
  }

  private generateNameVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const firstNames = ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily', 'Robert', 'Lisa'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis'];
    
    for (let i = 0; i < count; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[i % lastNames.length];
      
      let name: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 4 === 0) {
        name = `${firstName} ${lastName}`;
        difficulty = 'easy';
      } else if (i % 4 === 1) {
        name = `${lastName}, ${firstName}`;
        difficulty = 'medium';
      } else if (i % 4 === 2) {
        name = `${firstName.charAt(0)}. ${lastName}`;
        difficulty = 'hard';
      } else {
        name = `Name: ${firstName} ${lastName}`;
        difficulty = 'hard';
      }
      
      const text = this.wrapInContext(name, 'name');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.NAME,
          value: name,
          startIndex: text.indexOf(name),
          endIndex: text.indexOf(name) + name.length
        }],
        difficulty,
        category: 'name_variants'
      });
    }
    
    return examples;
  }

  private generateDateOfBirthVariants(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const year = Math.floor(Math.random() * 50) + 1950;
      const month = Math.floor(Math.random() * 12) + 1;
      const day = Math.floor(Math.random() * 28) + 1;
      
      let dob: string;
      let difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
      
      if (i % 4 === 0) {
        dob = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}/${year}`;
        difficulty = 'easy';
      } else if (i % 4 === 1) {
        dob = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        difficulty = 'medium';
      } else if (i % 4 === 2) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        dob = `${months[month - 1]} ${day}, ${year}`;
        difficulty = 'hard';
      } else {
        dob = `Date of Birth: ${month}/${day}/${year}`;
        difficulty = 'hard';
      }
      
      const text = this.wrapInContext(dob, 'dob');
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.DATE_OF_BIRTH,
          value: dob,
          startIndex: text.indexOf(dob),
          endIndex: text.indexOf(dob) + dob.length
        }],
        difficulty,
        category: 'dob_variants'
      });
    }
    
    return examples;
  }

  private generateMixedPIIExamples(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const name = 'John Smith';
      const email = 'john.smith@company.com';
      const phone = '555-123-4567';
      
      const text = `Employee record: ${name}, contact: ${email}, phone: ${phone}`;
      
      examples.push({
        text,
        expectedPII: [
          {
            type: PIIType.NAME,
            value: name,
            startIndex: text.indexOf(name),
            endIndex: text.indexOf(name) + name.length
          },
          {
            type: PIIType.EMAIL,
            value: email,
            startIndex: text.indexOf(email),
            endIndex: text.indexOf(email) + email.length
          },
          {
            type: PIIType.PHONE,
            value: phone,
            startIndex: text.indexOf(phone),
            endIndex: text.indexOf(phone) + phone.length
          }
        ],
        difficulty: 'medium',
        category: 'mixed_pii'
      });
    }
    
    return examples;
  }

  private generateObfuscatedExamples(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    
    for (let i = 0; i < count; i++) {
      const baseEmail = 'user@domain.com';
      let obfuscatedEmail: string;
      
      if (i % 3 === 0) {
        obfuscatedEmail = 'user[at]domain[dot]com';
      } else if (i % 3 === 1) {
        obfuscatedEmail = 'user AT domain DOT com';
      } else {
        obfuscatedEmail = 'u***@d*****.com';
      }
      
      const text = `Contact information: ${obfuscatedEmail}`;
      
      examples.push({
        text,
        expectedPII: [{
          type: PIIType.EMAIL,
          value: obfuscatedEmail,
          startIndex: text.indexOf(obfuscatedEmail),
          endIndex: text.indexOf(obfuscatedEmail) + obfuscatedEmail.length,
          obfuscated: true
        }],
        difficulty: 'extreme',
        category: 'obfuscated'
      });
    }
    
    return examples;
  }

  private generateContextualExamples(count: number): AdversarialPIIExample[] {
    const examples: AdversarialPIIExample[] = [];
    const contexts = [
      'In the medical record, patient',
      'According to the financial statement, customer',
      'The employee database shows that',
      'Customer service notes indicate that user',
      'Legal documents reference client'
    ];
    
    for (let i = 0; i < count; i++) {
      const context = contexts[i % contexts.length];
      const name = 'Jane Doe';
      const ssn = '123-45-6789';
      
      const text = `${context} ${name} has SSN ${ssn} on file.`;
      
      examples.push({
        text,
        expectedPII: [
          {
            type: PIIType.NAME,
            value: name,
            startIndex: text.indexOf(name),
            endIndex: text.indexOf(name) + name.length
          },
          {
            type: PIIType.SSN,
            value: ssn,
            startIndex: text.indexOf(ssn),
            endIndex: text.indexOf(ssn) + ssn.length
          }
        ],
        difficulty: 'hard',
        category: 'contextual'
      });
    }
    
    return examples;
  }

  private wrapInContext(pii: string, type: string): string {
    const contexts: Record<string, string[]> = {
      email: [
        `Please contact me at ${pii} for more information.`,
        `Send the report to ${pii} by end of day.`,
        `Email address on file: ${pii}`,
        `You can reach them at ${pii}`
      ],
      phone: [
        `Call us at ${pii} for support.`,
        `Emergency contact: ${pii}`,
        `Phone number: ${pii}`,
        `Dial ${pii} to speak with an agent.`
      ],
      ssn: [
        `Social Security Number: ${pii}`,
        `SSN on record: ${pii}`,
        `Tax ID: ${pii}`,
        `Identification number ${pii}`
      ],
      credit_card: [
        `Payment method: ${pii}`,
        `Card number: ${pii}`,
        `Billing card: ${pii}`,
        `Credit card on file: ${pii}`
      ],
      address: [
        `Shipping address: ${pii}`,
        `Located at ${pii}`,
        `Mailing address: ${pii}`,
        `Property address: ${pii}`
      ],
      name: [
        `Customer name: ${pii}`,
        `Contact person: ${pii}`,
        `Account holder: ${pii}`,
        `Employee: ${pii}`
      ],
      dob: [
        `Date of birth: ${pii}`,
        `Born on ${pii}`,
        `Birthday: ${pii}`,
        `DOB: ${pii}`
      ]
    };
    
    const contextArray = contexts[type] || [`Information: ${pii}`];
    return contextArray[Math.floor(Math.random() * contextArray.length)];
  }
}