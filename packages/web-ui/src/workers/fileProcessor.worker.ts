// Web Worker for processing large files without blocking the main thread

export interface FileProcessingMessage {
  type: 'PROCESS_FILE' | 'VALIDATE_FILE' | 'PARSE_CSV' | 'PROGRESS_UPDATE';
  payload: any;
}

export interface FileProcessingResult {
  type: 'PROCESSING_COMPLETE' | 'PROCESSING_ERROR' | 'PROGRESS_UPDATE' | 'VALIDATION_COMPLETE';
  payload: any;
}

// Mock CSV parser for large files
const parseCSVChunk = (text: string, startRow = 0, chunkSize = 1000) => {
  const lines = text.split('\n');
  const headers = lines[0]?.split(',') || [];
  const rows: Record<string, string>[] = [];
  
  const endRow = Math.min(startRow + chunkSize, lines.length - 1);
  
  for (let i = Math.max(1, startRow); i <= endRow; i++) {
    if (lines[i]?.trim()) {
      const values = lines[i].split(',');
      const row: Record<string, string> = {};
      
      headers.forEach((header, index) => {
        row[header.trim()] = values[index]?.trim() || '';
      });
      
      rows.push(row);
    }
  }
  
  return {
    headers,
    rows,
    totalLines: lines.length - 1, // Exclude header
    processedLines: endRow,
    hasMore: endRow < lines.length - 1
  };
};

// Simulate field type detection
const detectFieldType = (samples: string[]): 'string' | 'number' | 'date' | 'boolean' => {
  const nonEmptySamples = samples.filter(s => s && s.trim());
  if (nonEmptySamples.length === 0) return 'string';
  
  // Check if all samples are numbers
  const numberSamples = nonEmptySamples.filter(s => !isNaN(Number(s)));
  if (numberSamples.length === nonEmptySamples.length) {
    return 'number';
  }
  
  // Check if all samples are booleans
  const boolSamples = nonEmptySamples.filter(s => 
    s.toLowerCase() === 'true' || s.toLowerCase() === 'false' || 
    s === '1' || s === '0'
  );
  if (boolSamples.length === nonEmptySamples.length) {
    return 'boolean';
  }
  
  // Check if samples look like dates
  const dateSamples = nonEmptySamples.filter(s => {
    const date = new Date(s);
    return !isNaN(date.getTime()) && s.includes('/') || s.includes('-');
  });
  if (dateSamples.length / nonEmptySamples.length > 0.7) {
    return 'date';
  }
  
  return 'string';
};

// PII detection patterns
const piiPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[\+]?[1-9][\d]{0,15}$/,
  ssn: /^\d{3}-\d{2}-\d{4}$/,
  creditCard: /^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/
};

const detectPII = (samples: string[]) => {
  const nonEmptySamples = samples.filter(s => s && s.trim());
  if (nonEmptySamples.length === 0) {
    return { isPII: false, confidence: 0 };
  }
  
  for (const [type, pattern] of Object.entries(piiPatterns)) {
    const matches = nonEmptySamples.filter(s => pattern.test(s.trim()));
    const confidence = matches.length / nonEmptySamples.length;
    
    if (confidence > 0.7) {
      return {
        isPII: true,
        piiType: type,
        confidence
      };
    }
  }
  
  return { isPII: false, confidence: 0 };
};

// Process file in chunks to avoid blocking
const processFileInChunks = async (fileContent: string, fileName: string) => {
  const chunkSize = 1000; // Process 1000 rows at a time
  let currentRow = 0;
  let headers: string[] = [];
  const fieldProfiles: Record<string, {
    samples: string[];
    nullCount: number;
    totalCount: number;
    uniqueValues: Set<string>;
  }> = {};
  
  let hasMore = true;
  let totalRows = 0;
  
  while (hasMore) {
    // Parse chunk
    const chunk = parseCSVChunk(fileContent, currentRow, chunkSize);
    headers = chunk.headers;
    totalRows = chunk.totalLines;
    hasMore = chunk.hasMore;
    
    // Initialize field profiles on first chunk
    if (currentRow === 0) {
      headers.forEach(header => {
        fieldProfiles[header] = {
          samples: [],
          nullCount: 0,
          totalCount: 0,
          uniqueValues: new Set()
        };
      });
    }
    
    // Process rows in current chunk
    chunk.rows.forEach(row => {
      headers.forEach(header => {
        const profile = fieldProfiles[header];
        const value = row[header];
        
        profile.totalCount++;
        
        if (!value || value.trim() === '') {
          profile.nullCount++;
        } else {
          // Add to samples (keep first 10)
          if (profile.samples.length < 10) {
            profile.samples.push(value);
          }
          profile.uniqueValues.add(value);
        }
      });
    });
    
    currentRow = chunk.processedLines;
    
    // Send progress update
    const progress = Math.round((currentRow / totalRows) * 100);
    postMessage({
      type: 'PROGRESS_UPDATE',
      payload: { progress, processedRows: currentRow, totalRows }
    } as FileProcessingResult);
    
    // Allow other tasks to run
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  // Generate final field profiles
  const fields = headers.map(header => {
    const profile = fieldProfiles[header];
    const samples = Array.from(profile.samples);
    const type = detectFieldType(samples);
    const piiDetection = detectPII(samples);
    
    return {
      name: header,
      type,
      samples,
      nullCount: profile.nullCount,
      totalCount: profile.totalCount,
      uniqueCount: profile.uniqueValues.size,
      piiDetection
    };
  });
  
  return {
    file: { name: fileName, size: fileContent.length },
    fields,
    rowCount: totalRows,
    processingTime: 0, // Would be calculated in real implementation
    errors: []
  };
};

// Worker message handler
self.onmessage = async (event: MessageEvent<FileProcessingMessage>) => {
  const { type, payload } = event.data;
  
  try {
    switch (type) {
      case 'PROCESS_FILE': {
        const { fileContent, fileName } = payload;
        const result = await processFileInChunks(fileContent, fileName);
        
        postMessage({
          type: 'PROCESSING_COMPLETE',
          payload: result
        } as FileProcessingResult);
        break;
      }
      
      case 'VALIDATE_FILE': {
        const { fileName, fileSize, maxSizeGB } = payload;
        
        // Basic validation
        const errors: string[] = [];
        const extension = fileName.toLowerCase().split('.').pop();
        const validExtensions = ['csv', 'xlsx', 'xls', 'tsv'];
        
        if (!validExtensions.includes(extension || '')) {
          errors.push(`Invalid file format: ${extension}. Supported: ${validExtensions.join(', ')}`);
        }
        
        const sizeInGB = fileSize / (1024 * 1024 * 1024);
        if (sizeInGB > maxSizeGB) {
          errors.push(`File too large: ${sizeInGB.toFixed(2)}GB (max: ${maxSizeGB}GB)`);
        }
        
        postMessage({
          type: 'VALIDATION_COMPLETE',
          payload: {
            valid: errors.length === 0,
            errors,
            fileName
          }
        } as FileProcessingResult);
        break;
      }
      
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    postMessage({
      type: 'PROCESSING_ERROR',
      payload: {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: payload?.fileName
      }
    } as FileProcessingResult);
  }
};

export {};