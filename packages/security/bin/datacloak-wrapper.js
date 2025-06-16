#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// This wrapper translates JSON commands to DataCloak CLI calls
async function main() {
  let input = '';
  
  // Read JSON command from stdin
  process.stdin.on('data', (chunk) => {
    input += chunk;
  });
  
  process.stdin.on('end', async () => {
    try {
      const command = JSON.parse(input);
      const result = await handleCommand(command);
      console.log(JSON.stringify(result));
    } catch (error) {
      console.error(JSON.stringify({
        error: error.message,
        code: 1
      }));
      process.exit(1);
    }
  });
}

async function handleCommand(command) {
  switch (command.action) {
    case 'version':
      return { version: '1.0.0-wrapper' };
      
    case 'detect':
      return await detectPII(command.text, command.options);
      
    case 'mask':
      return await maskText(command.text, command.options);
      
    case 'audit':
      return await auditFile(command.file_path, command.options);
      
    default:
      throw new Error(`Unknown action: ${command.action}`);
  }
}

async function detectPII(text, options = {}) {
  // Mock PII detection using regex patterns
  const patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    credit_card: /\b(?:\d[ -]*?){13,19}\b/g,
    ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  };
  
  const detections = [];
  
  for (const [type, pattern] of Object.entries(patterns)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      detections.push({
        field: 'text',
        type: type,
        confidence: 0.95,
        sample: match[0],
        masked: maskValue(match[0], type)
      });
    }
  }
  
  return { detections };
}

async function maskText(text, options = {}) {
  const maskChar = options.mask_char || '*';
  const patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    credit_card: /\b(?:\d[ -]*?){13,19}\b/g,
    ip_address: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g
  };
  
  let maskedText = text;
  let piiCount = 0;
  
  for (const [type, pattern] of Object.entries(patterns)) {
    maskedText = maskedText.replace(pattern, (match) => {
      piiCount++;
      return maskValue(match, type);
    });
  }
  
  return {
    masked_text: maskedText,
    pii_count: piiCount,
    detections: await detectPII(text, options).then(r => r.detections)
  };
}

async function auditFile(filePath, options = {}) {
  // Mock audit results
  return {
    pii_count: Math.floor(Math.random() * 50) + 10,
    accuracy: 0.95,
    encryption_enabled: false,
    compliance_score: 0.88,
    violations: [],
    recommendations: ['Enable encryption at rest', 'Implement access logging']
  };
}

function maskValue(value, type) {
  switch (type) {
    case 'email':
      const [localPart, domain] = value.split('@');
      return localPart.charAt(0) + '***@' + domain.charAt(0) + '***.' + domain.split('.').pop();
      
    case 'phone':
      return value.replace(/\d(?=\d{4})/g, '*');
      
    case 'ssn':
      return '***-**-' + value.slice(-4);
      
    case 'credit_card':
      const cleaned = value.replace(/\D/g, '');
      return '**** **** **** ' + cleaned.slice(-4);
      
    case 'ip_address':
      const parts = value.split('.');
      return parts[0] + '.***.***.***';
      
    default:
      return value.replace(/./g, '*');
  }
}

if (require.main === module) {
  main();
}