import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Console.log Checks', () => {
  it('should not have any undefined console.log statements', () => {
    const srcDir = path.join(__dirname, '..');
    const files = getAllTypeScriptFiles(srcDir);
    const issues: string[] = [];
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Check for console.log with potential undefined variables
        const consoleLogRegex = /console\.log\s*\(\s*([^'")`][^)]*)\s*\)/g;
        let match;
        
        while ((match = consoleLogRegex.exec(line)) !== null) {
          const logContent = match[1].trim();
          
          // Skip if it's a string literal or template literal
          if (logContent.startsWith('"') || logContent.startsWith("'") || logContent.startsWith('`')) {
            continue;
          }
          
          // Skip if it's a clear expression (contains operators, function calls, etc.)
          if (logContent.includes('+') || logContent.includes('?') || logContent.includes(':') || 
              logContent.includes('(') || logContent.includes('.') || logContent.includes(',')) {
            continue;
          }
          
          // Flag potential bare variable console.logs
          if (logContent && !logContent.includes(' ') && logContent !== 'error' && logContent !== 'result') {
            issues.push(`${file}:${index + 1} - Potential undefined console.log: console.log(${logContent})`);
          }
        }
      });
    });
    
    if (issues.length > 0) {
      fail(`Found potential undefined console.log statements:\n${issues.join('\n')}`);
    }
    
    expect(issues.length).toBe(0);
  });

  it('should have console override in place', () => {
    const consoleOverridePath = path.join(__dirname, '../console-override.ts');
    expect(fs.existsSync(consoleOverridePath)).toBe(true);
    
    const serverPath = path.join(__dirname, '../server.ts');
    const serverContent = fs.readFileSync(serverPath, 'utf-8');
    
    // Check that console-override is imported at the top
    const lines = serverContent.split('\n');
    const firstImport = lines.findIndex(line => line.includes('import'));
    const consoleOverrideImport = lines.findIndex(line => line.includes('./console-override'));
    
    expect(consoleOverrideImport).toBeGreaterThanOrEqual(0);
    expect(consoleOverrideImport).toBeLessThanOrEqual(firstImport + 1);
  });
});

function getAllTypeScriptFiles(dir: string): string[] {
  const files: string[] = [];
  
  function walk(currentDir: string) {
    const entries = fs.readdirSync(currentDir);
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !entry.includes('node_modules') && !entry.includes('.test')) {
        walk(fullPath);
      } else if (stat.isFile() && entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  walk(dir);
  return files;
}