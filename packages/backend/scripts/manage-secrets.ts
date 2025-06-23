#!/usr/bin/env node

import { program } from 'commander';
import * as inquirer from 'inquirer';
import { SecretManagerService } from '../src/services/secret-manager.service';
import { SecretValidator, secretUtils } from '../src/config/secrets';
import { ConfigService } from '../src/services/config.service';
import * as fs from 'fs';
import * as path from 'path';

// Initialize services
process.env.NODE_ENV = process.env.NODE_ENV || 'development';
const secretManager = SecretManagerService.getInstance();
const configService = ConfigService.getInstance();

// CLI commands
program
  .name('manage-secrets')
  .description('DataCloak secret management CLI')
  .version('1.0.0');

// List secrets
program
  .command('list')
  .description('List all available secrets')
  .option('-p, --provider <provider>', 'Secret provider', 'env')
  .action(async (options) => {
    try {
      console.log('📋 Available Secrets:\n');
      
      const secretKeys = Object.keys(process.env)
        .filter(key => secretUtils.isSecretKey(key))
        .sort();
      
      if (secretKeys.length === 0) {
        console.log('No secrets found.');
        return;
      }
      
      for (const key of secretKeys) {
        const policy = secretUtils.getSecretPolicy(key);
        const exists = process.env[key] !== undefined;
        
        console.log(`• ${key}`);
        console.log(`  - Exists: ${exists ? '✅' : '❌'}`);
        if (policy) {
          console.log(`  - Min Length: ${policy.minLength}`);
          if (policy.rotationInterval) {
            const days = Math.floor(policy.rotationInterval / (24 * 60 * 60 * 1000));
            console.log(`  - Rotation: Every ${days} days`);
          }
        }
        console.log('');
      }
      
      console.log(`Total: ${secretKeys.length} secrets`);
    } catch (error) {
      console.error('❌ Error listing secrets:', error.message);
      process.exit(1);
    }
  });

// Validate secrets
program
  .command('validate')
  .description('Validate all secrets against their policies')
  .action(async () => {
    try {
      console.log('🔍 Validating Secrets:\n');
      
      const secretKeys = Object.keys(process.env)
        .filter(key => secretUtils.isSecretKey(key));
      
      let validCount = 0;
      let invalidCount = 0;
      
      for (const key of secretKeys) {
        const value = process.env[key];
        if (!value) {
          console.log(`❌ ${key}: Not set`);
          invalidCount++;
          continue;
        }
        
        const validation = SecretValidator.validateSecret(key, value);
        if (validation.valid) {
          console.log(`✅ ${key}: Valid`);
          validCount++;
        } else {
          console.log(`❌ ${key}: Invalid`);
          validation.errors?.forEach(error => {
            console.log(`   - ${error}`);
          });
          invalidCount++;
        }
      }
      
      console.log(`\nSummary: ${validCount} valid, ${invalidCount} invalid`);
      
      if (invalidCount > 0) {
        process.exit(1);
      }
    } catch (error) {
      console.error('❌ Error validating secrets:', error.message);
      process.exit(1);
    }
  });

// Generate secret
program
  .command('generate <key>')
  .description('Generate a secure secret value')
  .option('-s, --save', 'Save to .env file')
  .action(async (key, options) => {
    try {
      console.log(`🔐 Generating secret for: ${key}\n`);
      
      const value = SecretValidator.generateSecureSecret(key);
      const validation = SecretValidator.validateSecret(key, value);
      
      console.log(`Generated: ${value}`);
      console.log(`Length: ${value.length} characters`);
      console.log(`Valid: ${validation.valid ? '✅' : '❌'}`);
      
      if (options.save) {
        const envPath = path.resolve('.env');
        const envContent = fs.existsSync(envPath) 
          ? fs.readFileSync(envPath, 'utf8')
          : '';
        
        // Check if key already exists
        const keyRegex = new RegExp(`^${key}=.*$`, 'm');
        if (keyRegex.test(envContent)) {
          const { overwrite } = await inquirer.prompt([{
            type: 'confirm',
            name: 'overwrite',
            message: `${key} already exists in .env. Overwrite?`,
            default: false
          }]);
          
          if (!overwrite) {
            console.log('❌ Cancelled');
            return;
          }
          
          // Replace existing value
          const newContent = envContent.replace(keyRegex, `${key}=${value}`);
          fs.writeFileSync(envPath, newContent);
        } else {
          // Append new value
          const newContent = envContent + (envContent.endsWith('\n') ? '' : '\n') + `${key}=${value}\n`;
          fs.writeFileSync(envPath, newContent);
        }
        
        console.log(`\n✅ Saved to .env file`);
      }
    } catch (error) {
      console.error('❌ Error generating secret:', error.message);
      process.exit(1);
    }
  });

// Rotate secret
program
  .command('rotate <key>')
  .description('Rotate a secret to a new value')
  .option('-f, --force', 'Skip confirmation')
  .action(async (key, options) => {
    try {
      if (!options.force) {
        const { confirm } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to rotate ${key}?`,
          default: false
        }]);
        
        if (!confirm) {
          console.log('❌ Cancelled');
          return;
        }
      }
      
      console.log(`🔄 Rotating secret: ${key}\n`);
      
      const newValue = await secretManager.rotateSecret(key, 'cli');
      console.log(`✅ Secret rotated successfully`);
      console.log(`New length: ${newValue.length} characters`);
      
      // Update .env file if it exists
      const envPath = path.resolve('.env');
      if (fs.existsSync(envPath)) {
        const envContent = fs.readFileSync(envPath, 'utf8');
        const keyRegex = new RegExp(`^${key}=.*$`, 'm');
        
        if (keyRegex.test(envContent)) {
          const newContent = envContent.replace(keyRegex, `${key}=${newValue}`);
          fs.writeFileSync(envPath, newContent);
          console.log(`✅ Updated .env file`);
        }
      }
    } catch (error) {
      console.error('❌ Error rotating secret:', error.message);
      process.exit(1);
    }
  });

// Check rotation status
program
  .command('rotation-status')
  .description('Check rotation status for all secrets')
  .action(async () => {
    try {
      console.log('🔄 Secret Rotation Status:\n');
      
      const secretKeys = Object.keys(process.env)
        .filter(key => secretUtils.isSecretKey(key));
      
      for (const key of secretKeys) {
        const policy = secretUtils.getSecretPolicy(key);
        if (!policy?.rotationInterval) {
          continue;
        }
        
        const days = Math.floor(policy.rotationInterval / (24 * 60 * 60 * 1000));
        console.log(`• ${key}`);
        console.log(`  - Rotation interval: ${days} days`);
        // TODO: Get actual last rotation date from metadata
        console.log(`  - Last rotated: Unknown`);
        console.log(`  - Next rotation: Unknown`);
        console.log('');
      }
    } catch (error) {
      console.error('❌ Error checking rotation status:', error.message);
      process.exit(1);
    }
  });

// Export audit log
program
  .command('export-audit')
  .description('Export secret access audit log')
  .option('-o, --output <file>', 'Output file', 'secret-audit.json')
  .action(async (options) => {
    try {
      console.log('📊 Exporting audit log...\n');
      
      const auditLog = await secretManager.exportAccessLog();
      const outputPath = path.resolve(options.output);
      
      fs.writeFileSync(outputPath, auditLog);
      console.log(`✅ Audit log exported to: ${outputPath}`);
      
      const entries = JSON.parse(auditLog);
      console.log(`Total entries: ${entries.length}`);
    } catch (error) {
      console.error('❌ Error exporting audit log:', error.message);
      process.exit(1);
    }
  });

// Initialize secrets
program
  .command('init')
  .description('Initialize all required secrets with secure values')
  .option('-e, --environment <env>', 'Target environment', 'development')
  .action(async (options) => {
    try {
      console.log(`🚀 Initializing secrets for ${options.environment} environment\n`);
      
      const requiredSecrets = [
        'JWT_SECRET',
        'SESSION_SECRET',
        'CONFIG_ENCRYPTION_KEY',
        'ADMIN_PASSWORD'
      ];
      
      if (options.environment === 'production') {
        requiredSecrets.push('REDIS_PASSWORD');
      }
      
      const generatedSecrets: Record<string, string> = {};
      
      for (const key of requiredSecrets) {
        if (process.env[key]) {
          console.log(`⏭️  ${key}: Already set`);
          continue;
        }
        
        const value = SecretValidator.generateSecureSecret(key);
        generatedSecrets[key] = value;
        console.log(`✅ ${key}: Generated`);
      }
      
      if (Object.keys(generatedSecrets).length > 0) {
        const { save } = await inquirer.prompt([{
          type: 'confirm',
          name: 'save',
          message: 'Save generated secrets to .env file?',
          default: true
        }]);
        
        if (save) {
          const envPath = path.resolve('.env');
          let envContent = fs.existsSync(envPath) 
            ? fs.readFileSync(envPath, 'utf8')
            : '';
          
          // Add comment header if file is new
          if (!envContent) {
            envContent = `# DataCloak Environment Configuration\n# Generated: ${new Date().toISOString()}\n\n`;
          }
          
          // Append new secrets
          for (const [key, value] of Object.entries(generatedSecrets)) {
            envContent += `${key}=${value}\n`;
          }
          
          fs.writeFileSync(envPath, envContent);
          console.log(`\n✅ Saved to .env file`);
        }
      }
      
      console.log('\n✨ Initialization complete!');
    } catch (error) {
      console.error('❌ Error initializing secrets:', error.message);
      process.exit(1);
    }
  });

// Interactive mode
program
  .command('interactive')
  .description('Interactive secret management')
  .action(async () => {
    try {
      const actions = [
        'List secrets',
        'Validate secrets',
        'Generate secret',
        'Rotate secret',
        'Check rotation status',
        'Export audit log',
        'Exit'
      ];
      
      while (true) {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: 'What would you like to do?',
          choices: actions
        }]);
        
        switch (action) {
          case 'List secrets':
            await program.commands.find(c => c.name() === 'list')?.parseAsync([], { from: 'user' });
            break;
            
          case 'Validate secrets':
            await program.commands.find(c => c.name() === 'validate')?.parseAsync([], { from: 'user' });
            break;
            
          case 'Generate secret': {
            const { key } = await inquirer.prompt([{
              type: 'input',
              name: 'key',
              message: 'Secret key:',
              validate: (input) => /^[A-Z0-9_]+$/.test(input) || 'Invalid key format'
            }]);
            await program.commands.find(c => c.name() === 'generate')?.parseAsync([key], { from: 'user' });
            break;
          }
          
          case 'Rotate secret': {
            const secretKeys = Object.keys(process.env)
              .filter(key => secretUtils.isSecretKey(key) && process.env[key]);
            
            if (secretKeys.length === 0) {
              console.log('No secrets available to rotate.');
              break;
            }
            
            const { key } = await inquirer.prompt([{
              type: 'list',
              name: 'key',
              message: 'Select secret to rotate:',
              choices: secretKeys
            }]);
            await program.commands.find(c => c.name() === 'rotate')?.parseAsync([key], { from: 'user' });
            break;
          }
          
          case 'Check rotation status':
            await program.commands.find(c => c.name() === 'rotation-status')?.parseAsync([], { from: 'user' });
            break;
            
          case 'Export audit log':
            await program.commands.find(c => c.name() === 'export-audit')?.parseAsync([], { from: 'user' });
            break;
            
          case 'Exit':
            console.log('👋 Goodbye!');
            process.exit(0);
        }
        
        console.log('\n'); // Add spacing between actions
      }
    } catch (error) {
      console.error('❌ Error in interactive mode:', error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}