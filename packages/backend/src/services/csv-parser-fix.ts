import * as fs from 'fs';
import * as readline from 'readline';

export async function detectDelimiter(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // Check if file exists first
    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    let resolved = false;
    
    const stream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    let firstLine: string | null = null;

    stream.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        rl.close();
        reject(error);
      }
    });

    rl.on('line', (line) => {
      if (!firstLine && line.trim()) {
        firstLine = line;
        rl.close();
      }
    });

    rl.on('close', () => {
      if (!resolved) {
        resolved = true;
        
        if (!firstLine) {
          resolve(','); // Default to comma
          return;
        }

        // Count occurrences of common delimiters
        const delimiters = [
          { char: '\t', count: (firstLine.match(/\t/g) || []).length },
          { char: ',', count: (firstLine.match(/,/g) || []).length },
          { char: ';', count: (firstLine.match(/;/g) || []).length },
          { char: '|', count: (firstLine.match(/\|/g) || []).length }
        ];

        // Choose delimiter with highest count
        const bestDelimiter = delimiters.reduce((prev, curr) => 
          curr.count > prev.count ? curr : prev
        );

        resolve(bestDelimiter.count > 0 ? bestDelimiter.char : ',');
      }
    });
  });
}

export function createFlexibleCsvParser(delimiter: string = ',') {
  const csv = require('csv-parser');
  return csv({
    separator: delimiter,
    strict: false, // Don't enforce column count
    skipLinesWithError: false,
    relaxColumnCount: true // Allow variable column counts
  });
}