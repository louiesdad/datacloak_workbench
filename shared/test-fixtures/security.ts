/**
 * Shared Test Fixtures - Security & Privacy
 * 
 * Mock data and test fixtures for security testing across all packages
 */

import { SecurityAuditResult, SecurityFinding, SecurityRecommendation, ComplianceStatus } from '../contracts/api';

// =============================================================================
// Security Audit Fixtures
// =============================================================================

export const HIGH_RISK_AUDIT_RESULT: SecurityAuditResult = {
  datasetId: 'ds_security_001',
  auditLevel: 'comprehensive',
  overallScore: 25,
  riskLevel: 'critical',
  findings: [
    {
      id: 'finding_001',
      type: 'pii_exposure',
      severity: 'critical',
      field: 'ssn',
      description: 'Social Security Numbers detected in plaintext without masking',
      riskScore: 95,
      affectedRows: 150
    },
    {
      id: 'finding_002',
      type: 'pii_exposure',
      severity: 'high',
      field: 'credit_card',
      description: 'Credit card numbers detected with insufficient masking',
      riskScore: 85,
      affectedRows: 89
    },
    {
      id: 'finding_003',
      type: 'data_quality',
      severity: 'medium',
      field: 'phone',
      description: 'Inconsistent phone number formats detected',
      riskScore: 45,
      affectedRows: 234
    }
  ],
  recommendations: [
    {
      id: 'rec_001',
      priority: 'critical',
      category: 'masking',
      action: 'Immediately mask or encrypt all SSN fields using AES-256 encryption',
      estimatedEffort: 'low',
      compliance: ['gdpr', 'ccpa', 'hipaa']
    },
    {
      id: 'rec_002',
      priority: 'high',
      category: 'masking',
      action: 'Apply PCI-compliant masking to credit card numbers',
      estimatedEffort: 'low',
      compliance: ['pci']
    },
    {
      id: 'rec_003',
      priority: 'medium',
      category: 'access',
      action: 'Implement role-based access controls for PII fields',
      estimatedEffort: 'high',
      compliance: ['gdpr', 'ccpa']
    }
  ],
  compliance: {
    gdpr: 'non_compliant',
    ccpa: 'non_compliant',
    hipaa: 'non_compliant',
    pci: 'non_compliant',
    sox: 'partial'
  },
  summary: {
    totalFindings: 3,
    criticalFindings: 1,
    piiFieldsFound: 2,
    dataQualityIssues: 1,
    recommendedActions: 3,
    estimatedRemediationTime: 48
  }
};

export const LOW_RISK_AUDIT_RESULT: SecurityAuditResult = {
  datasetId: 'ds_security_002',
  auditLevel: 'basic',
  overallScore: 85,
  riskLevel: 'low',
  findings: [
    {
      id: 'finding_004',
      type: 'data_quality',
      severity: 'low',
      field: 'email',
      description: 'Some email addresses have inconsistent domain formats',
      riskScore: 15,
      affectedRows: 12
    }
  ],
  recommendations: [
    {
      id: 'rec_004',
      priority: 'low',
      category: 'monitoring',
      action: 'Implement data quality monitoring for email validation',
      estimatedEffort: 'medium',
      compliance: []
    }
  ],
  compliance: {
    gdpr: 'compliant',
    ccpa: 'compliant',
    hipaa: 'compliant',
    pci: 'compliant',
    sox: 'compliant'
  },
  summary: {
    totalFindings: 1,
    criticalFindings: 0,
    piiFieldsFound: 0,
    dataQualityIssues: 1,
    recommendedActions: 1,
    estimatedRemediationTime: 4
  }
};

export const MEDIUM_RISK_AUDIT_RESULT: SecurityAuditResult = {
  datasetId: 'ds_security_003',
  auditLevel: 'thorough',
  overallScore: 60,
  riskLevel: 'medium',
  findings: [
    {
      id: 'finding_005',
      type: 'pii_exposure',
      severity: 'medium',
      field: 'email',
      description: 'Email addresses detected without explicit user consent tracking',
      riskScore: 55,
      affectedRows: 500
    },
    {
      id: 'finding_006',
      type: 'access_control',
      severity: 'medium',
      field: null,
      description: 'No access logs found for data viewing operations',
      riskScore: 50,
      affectedRows: null
    }
  ],
  recommendations: [
    {
      id: 'rec_005',
      priority: 'medium',
      category: 'retention',
      action: 'Implement data retention policies for PII data',
      estimatedEffort: 'high',
      compliance: ['gdpr']
    },
    {
      id: 'rec_006',
      priority: 'medium',
      category: 'monitoring',
      action: 'Enable comprehensive access logging',
      estimatedEffort: 'medium',
      compliance: ['gdpr', 'sox']
    }
  ],
  compliance: {
    gdpr: 'partial',
    ccpa: 'compliant',
    hipaa: 'partial',
    pci: 'compliant',
    sox: 'partial'
  },
  summary: {
    totalFindings: 2,
    criticalFindings: 0,
    piiFieldsFound: 1,
    dataQualityIssues: 0,
    recommendedActions: 2,
    estimatedRemediationTime: 24
  }
};

// =============================================================================
// PII Detection Test Cases
// =============================================================================

export const PII_TEST_DATA = {
  socialSecurityNumbers: [
    '123-45-6789',
    '987-65-4321',
    '555-00-1234',
    '123456789',
    '987654321'
  ],
  creditCardNumbers: [
    '4532-1234-5678-9012',
    '4532123456789012',
    '5555-5555-5555-4444',
    '5105105105105100',
    '3782-822463-10005',
    '371449635398431'
  ],
  phoneNumbers: [
    '(555) 123-4567',
    '555-123-4567',
    '5551234567',
    '+1-555-123-4567',
    '+1 (555) 123-4567'
  ],
  emailAddresses: [
    'user@example.com',
    'test.email+tag@domain.co.uk',
    'user123@test-domain.org',
    'firstname.lastname@company.com'
  ],
  ipAddresses: [
    '192.168.1.1',
    '10.0.0.1',
    '172.16.254.1',
    '203.0.113.42',
    '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
    '::1'
  ],
  macAddresses: [
    '00:1B:44:11:3A:B7',
    '00-1B-44-11-3A-B7',
    '001B.4411.3AB7'
  ],
  uuids: [
    '550e8400-e29b-41d4-a716-446655440000',
    '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    '6ba7b811-9dad-11d1-80b4-00c04fd430c8'
  ],
  names: [
    'John Smith',
    'Mary Jane Watson',
    'Dr. William Johnson',
    'Ms. Sarah Connor'
  ],
  addresses: [
    '123 Main Street, Anytown, ST 12345',
    '456 Oak Avenue, Suite 100, City, State 67890',
    'P.O. Box 789, Rural Route 1, Town, ST 54321'
  ]
};

// =============================================================================
// Compliance Test Scenarios
// =============================================================================

export const COMPLIANCE_SCENARIOS = {
  gdpr: {
    name: 'GDPR Compliance Test',
    requirements: [
      'Data minimization',
      'Consent tracking',
      'Right to be forgotten',
      'Data portability',
      'Privacy by design'
    ],
    testData: {
      personalData: ['name', 'email', 'phone', 'address'],
      consentRequired: true,
      retentionPeriod: 730, // 2 years in days
      dataSubjectRights: ['access', 'rectification', 'erasure', 'portability']
    }
  },
  ccpa: {
    name: 'CCPA Compliance Test',
    requirements: [
      'Consumer right to know',
      'Right to delete',
      'Right to opt-out',
      'Non-discrimination'
    ],
    testData: {
      personalInformation: ['name', 'email', 'phone', 'ip_address'],
      saleOptOut: true,
      disclosureTracking: true,
      consumerRights: ['know', 'delete', 'opt-out']
    }
  },
  hipaa: {
    name: 'HIPAA Compliance Test',
    requirements: [
      'PHI protection',
      'Minimum necessary standard',
      'Administrative safeguards',
      'Physical safeguards',
      'Technical safeguards'
    ],
    testData: {
      phi: ['medical_record_number', 'health_plan_id', 'account_number', 'ssn'],
      minimumNecessary: true,
      encryptionRequired: true,
      accessControls: ['authentication', 'authorization', 'audit']
    }
  },
  pci: {
    name: 'PCI DSS Compliance Test',
    requirements: [
      'Cardholder data protection',
      'Strong access controls',
      'Network monitoring',
      'Vulnerability management'
    ],
    testData: {
      cardholderData: ['primary_account_number', 'cardholder_name', 'expiration_date', 'service_code'],
      sensitiveData: ['full_magnetic_stripe', 'cav2_cvc2_cid', 'pin_pin_block'],
      encryptionRequired: true,
      keyManagement: true
    }
  }
};

// =============================================================================
// Encryption Test Data
// =============================================================================

export const ENCRYPTION_TEST_DATA = {
  plaintextData: [
    'Sensitive information that needs protection',
    '123-45-6789',
    'user@example.com',
    'Credit card: 4532-1234-5678-9012'
  ],
  encryptionMethods: [
    'AES-256-CBC',
    'AES-256-GCM',
    'RSA-2048',
    'RSA-4096'
  ],
  hashingMethods: [
    'SHA-256',
    'SHA-512',
    'bcrypt',
    'scrypt',
    'argon2'
  ],
  mockEncryptedData: {
    'AES-256-CBC': {
      data: 'U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K14=',
      iv: '00112233445566778899aabbccddeeff',
      key: 'password123'
    },
    'SHA-256': {
      hash: 'ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f',
      salt: 'randomsalt123'
    }
  }
};

// =============================================================================
// Security Attack Simulation Data
// =============================================================================

export const ATTACK_SIMULATION_DATA = {
  sqlInjection: [
    "'; DROP TABLE users; --",
    "' OR '1'='1",
    "'; UPDATE users SET password='hacked' WHERE id=1; --",
    "' UNION SELECT password FROM users WHERE username='admin'--"
  ],
  xssPayloads: [
    '<script>alert("XSS")</script>',
    '"><script>alert("XSS")</script>',
    'javascript:alert("XSS")',
    '<img src="x" onerror="alert(\'XSS\')">'
  ],
  csvInjection: [
    '=cmd|"/c calc"!A0',
    '+cmd|"/c calc"!A0',
    '-cmd|"/c calc"!A0',
    '@SUM(1+1)*cmd|"/c calc"!A0'
  ],
  pathTraversal: [
    '../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '....//....//....//etc/passwd',
    '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
  ]
};

// =============================================================================
// Data Masking Test Cases
// =============================================================================

export const MASKING_TEST_CASES = {
  partial: {
    ssn: '***-**-6789',
    creditCard: '****-****-****-9012',
    email: 'us***@example.com',
    phone: '(***) ***-4567'
  },
  full: {
    ssn: '*********',
    creditCard: '****************',
    email: '***@***.***',
    phone: '(***)***-****'
  },
  tokenization: {
    ssn: 'TOK_SSN_001',
    creditCard: 'TOK_CC_002',
    email: 'TOK_EMAIL_003',
    phone: 'TOK_PHONE_004'
  },
  format_preserving: {
    ssn: '999-99-9999',
    creditCard: '9999-9999-9999-9999',
    email: 'fake@domain.com',
    phone: '(999) 999-9999'
  }
};

// =============================================================================
// Security Configuration Test Data
// =============================================================================

export const SECURITY_CONFIG_TESTS = {
  weak: {
    passwordPolicy: {
      minLength: 6,
      requireUppercase: false,
      requireLowercase: false,
      requireNumbers: false,
      requireSpecialChars: false
    },
    sessionTimeout: 86400000, // 24 hours
    encryptionStrength: 'AES-128',
    auditLogging: false
  },
  strong: {
    passwordPolicy: {
      minLength: 12,
      requireUppercase: true,
      requireLowercase: true,
      requireNumbers: true,
      requireSpecialChars: true
    },
    sessionTimeout: 900000, // 15 minutes
    encryptionStrength: 'AES-256',
    auditLogging: true
  }
};

// =============================================================================
// Export Collections
// =============================================================================

export const ALL_AUDIT_RESULTS = [
  HIGH_RISK_AUDIT_RESULT,
  LOW_RISK_AUDIT_RESULT,
  MEDIUM_RISK_AUDIT_RESULT
];

export const ALL_PII_SAMPLES = Object.values(PII_TEST_DATA).flat();

export const SECURITY_TEST_SCENARIOS = {
  piiDetection: {
    data: PII_TEST_DATA,
    expectedResults: {
      ssn: { detected: true, confidence: 0.95 },
      creditCard: { detected: true, confidence: 0.90 },
      email: { detected: true, confidence: 0.98 }
    }
  },
  compliance: {
    scenarios: COMPLIANCE_SCENARIOS,
    testData: ALL_AUDIT_RESULTS
  },
  encryption: {
    data: ENCRYPTION_TEST_DATA,
    expectedStrength: 'AES-256'
  },
  attackResistance: {
    attacks: ATTACK_SIMULATION_DATA,
    shouldBlock: true
  },
  masking: {
    testCases: MASKING_TEST_CASES,
    preserveFormat: true
  }
};