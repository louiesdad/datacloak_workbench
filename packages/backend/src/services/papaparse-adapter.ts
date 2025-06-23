import * as Papa from 'papaparse';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface PapaParseOptions {
  previewSize?: number;
  onProgress?: (progress: number) => void;
}

export interface ParseResult {
  data: any[];
  headers: string[];
  delimiter: string;
  lineCount: number;
  errors: any[];
}

export class PapaParseAdapter {
  /**
   * Parse CSV/TSV file with automatic delimiter detection and robust error handling
   */
  static async parseFile(filePath: string, options: PapaParseOptions = {}): Promise<ParseResult> {
    return new Promise((resolve, reject) => {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const previewSize = options.previewSize || 100;
      
      let allData: any[] = [];
      let headers: string[] = [];
      let delimiter = '';
      let lineCount = 0;
      let errors: any[] = [];

      // First pass: detect delimiter and structure
      const preview = Papa.parse(fileContent, {
        preview: 5, // Just check first 5 rows
        delimiter: '', // Auto-detect
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });

      delimiter = preview.meta.delimiter || ',';
      console.log(`PapaParse detected delimiter: "${delimiter}" (${delimiter === '\t' ? 'tab' : delimiter === ',' ? 'comma' : 'other'})`);

      // Second pass: full parse with detected delimiter
      Papa.parse(fileContent, {
        delimiter: delimiter,
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true, // Automatically convert numbers
        transformHeader: (header) => header.trim(),
        transform: (value) => {
          // Clean up values
          if (typeof value === 'string') {
            value = value.trim();
            // Convert empty strings to null
            return value === '' ? null : value;
          }
          return value;
        },
        complete: (results) => {
          headers = results.meta.fields || [];
          allData = results.data;
          lineCount = results.data.length;
          
          // Collect any parsing errors
          if (results.errors && results.errors.length > 0) {
            errors = results.errors.map(err => ({
              type: err.type,
              code: err.code,
              message: err.message,
              row: err.row,
            }));
            console.log(`PapaParse found ${errors.length} parsing errors (will handle gracefully)`);
          }

          // Filter out completely empty rows
          allData = allData.filter(row => {
            return Object.values(row).some(val => val !== null && val !== '');
          });

          resolve({
            data: allData.slice(0, previewSize),
            headers,
            delimiter,
            lineCount: allData.length,
            errors,
          });
        },
        error: (error) => {
          reject(new Error(`PapaParse error: ${error.message}`));
        }
      });
    });
  }

  /**
   * Stream parse large files
   */
  static streamParseFile(
    filePath: string, 
    onChunk: (chunk: any[], rowCount: number) => void,
    onComplete: (totalRows: number) => void
  ): void {
    let totalRows = 0;
    let chunkData: any[] = [];
    const chunkSize = 1000;

    const fileStream = fs.createReadStream(filePath);
    
    Papa.parse(fileStream, {
      delimiter: '', // Auto-detect
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      step: (row) => {
        if (row.data && Object.values(row.data).some(val => val !== null && val !== '')) {
          chunkData.push(row.data);
          totalRows++;

          if (chunkData.length >= chunkSize) {
            onChunk(chunkData, totalRows);
            chunkData = [];
          }
        }
      },
      complete: () => {
        // Send remaining data
        if (chunkData.length > 0) {
          onChunk(chunkData, totalRows);
        }
        onComplete(totalRows);
      },
      error: (error) => {
        console.error('Stream parsing error:', error);
      }
    });
  }

  /**
   * Analyze field statistics from parsed data
   */
  static analyzeFields(data: any[], headers: string[]): any[] {
    return headers.map(fieldName => {
      const values = data.map(row => row[fieldName]);
      const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
      const uniqueValues = new Set(nonNullValues);
      
      // Determine field type
      let fieldType = 'string';
      if (nonNullValues.length > 0) {
        const allNumbers = nonNullValues.every(v => !isNaN(Number(v)));
        const allDates = nonNullValues.every(v => !isNaN(Date.parse(v)));
        
        if (allNumbers) fieldType = 'number';
        else if (allDates && nonNullValues.some(v => v.includes('/'))) fieldType = 'date';
      }

      return {
        name: fieldName,
        type: fieldType,
        totalCount: values.length,
        nullCount: values.length - nonNullValues.length,
        uniqueCount: uniqueValues.size,
        completeness: (nonNullValues.length / values.length) * 100,
        sampleValues: nonNullValues.slice(0, 5),
      };
    });
  }

  async parseFile(filePath: string, options: PapaParseOptions = {}): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      const fileStream = fs.createReadStream(filePath);
      
      Papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        step: (row) => {
          if (row.data && Object.values(row.data).some(val => val !== null && val !== '')) {
            results.push(row.data);
          }
        },
        complete: () => {
          resolve(results);
        },
        error: (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        }
      });
    });
  }
}