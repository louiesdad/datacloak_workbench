export interface StreamProgress {
  percentComplete: number;
  processedBytes: number;
  totalBytes: number;
}

export interface FileChunkResult {
  processedRows: number;
  data: any[];
}

export class FileStreamService {
  streamProcessFile = jest.fn().mockResolvedValue({
    totalRows: 0,
    processedRows: 0,
    processingTime: 0,
    errors: []
  });

  readFileInChunks = jest.fn();
  processCSVStream = jest.fn();
  processExcelFile = jest.fn();
  getFileStats = jest.fn();
}