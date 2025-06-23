import { describe, it, expect } from '@jest/globals';
import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

describe('TypeScript Compilation Checks', () => {
  it.skip('should compile all TypeScript files without errors', () => {
    const configPath = path.join(__dirname, '../../tsconfig.json');
    const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
    
    if (configFile.error) {
      throw new Error(`Failed to read tsconfig.json: ${configFile.error.messageText}`);
    }

    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      path.dirname(configPath)
    );

    // Create a program to check for compilation errors
    const program = ts.createProgram(
      parsedConfig.fileNames,
      parsedConfig.options
    );

    const diagnostics = ts.getPreEmitDiagnostics(program);
    const errors = diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error);

    if (errors.length > 0) {
      const errorMessages = errors.map(diagnostic => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        if (diagnostic.file) {
          const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
          return `${diagnostic.file.fileName}(${line + 1},${character + 1}): ${message}`;
        }
        return message;
      });

      fail(`TypeScript compilation errors found:\n${errorMessages.join('\n')}`);
    }

    expect(errors.length).toBe(0);
  });

  it('should not have any unresolved imports', () => {
    const srcDir = path.join(__dirname, '..');
    const files = getAllTypeScriptFiles(srcDir);
    
    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
      
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        
        // Skip external modules
        if (!importPath.startsWith('.') && !importPath.startsWith('..')) {
          continue;
        }
        
        // Resolve the import path
        const resolvedPath = resolveImportPath(path.dirname(file), importPath);
        
        // Check if the file exists
        if (!fs.existsSync(resolvedPath)) {
          fail(`Unresolved import in ${file}: ${importPath}`);
        }
      }
    });
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

function resolveImportPath(fromDir: string, importPath: string): string {
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  // Try with each extension
  for (const ext of extensions) {
    const fullPath = path.resolve(fromDir, importPath + ext);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // Try as directory with index file
  for (const ext of extensions) {
    const indexPath = path.resolve(fromDir, importPath, `index${ext}`);
    if (fs.existsSync(indexPath)) {
      return indexPath;
    }
  }
  
  // Return the original path if not found
  return path.resolve(fromDir, importPath);
}