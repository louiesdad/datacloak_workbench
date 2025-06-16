// Browser File System Access API implementation
// Provides modern file access for Chrome/Edge with fallbacks for other browsers

import { FileInfo, FileFilter, FileSystemAPI } from './platform-bridge';

// Check if File System Access API is available
export const isFileSystemAccessSupported = (): boolean => {
  return 'showOpenFilePicker' in window && 
         'showSaveFilePicker' in window && 
         'showDirectoryPicker' in window;
};

// Check if we're in a secure context (required for File System Access API)
export const isSecureContext = (): boolean => {
  return window.isSecureContext === true;
};

// Convert file extensions to MIME types
const getMimeTypes = (extensions: string[]): string[] => {
  const mimeMap: Record<string, string> = {
    'csv': 'text/csv',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'xls': 'application/vnd.ms-excel',
    'tsv': 'text/tab-separated-values',
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    'parquet': 'application/octet-stream'
  };
  
  return extensions.map(ext => mimeMap[ext.toLowerCase()] || 'application/octet-stream');
};

// Convert FileFilter to File System Access API accept option
const convertFilters = (filters?: FileFilter[]): any[] => {
  if (!filters || filters.length === 0) {
    return [{
      description: 'All Files',
      accept: { '*/*': ['*'] }
    }];
  }

  return filters.map(filter => ({
    description: filter.name,
    accept: {
      [getMimeTypes(filter.extensions)[0] || 'application/octet-stream']: 
        filter.extensions.map(ext => `.${ext}`)
    }
  }));
};

// Modern File System Access API implementation
export class FileSystemAccessAPI implements FileSystemAPI {
  private fileHandles: Map<string, FileSystemFileHandle> = new Map();
  private directoryHandles: Map<string, FileSystemDirectoryHandle> = new Map();

  async readFile(path: string): Promise<string> {
    // Try to get file handle from cache
    const handle = this.fileHandles.get(path);
    if (handle) {
      const file = await handle.getFile();
      return file.text();
    }

    // For File System Access API, we need to use file picker
    throw new Error('File not found. Please select the file using selectFile()');
  }

  async writeFile(path: string, content: string): Promise<void> {
    try {
      // Try to get existing handle
      let handle = this.fileHandles.get(path);
      
      if (!handle && isFileSystemAccessSupported()) {
        // Show save file picker
        handle = await (window as any).showSaveFilePicker({
          suggestedName: path.split('/').pop() || 'file.txt',
          types: [{
            description: 'Text Files',
            accept: { 'text/plain': ['.txt', '.csv', '.json'] }
          }]
        });
        this.fileHandles.set(path, handle);
      }

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
      } else {
        throw new Error('File System Access API not supported');
      }
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        throw new Error('File save cancelled');
      }
      throw error;
    }
  }

  async selectDirectory(): Promise<string | null> {
    if (!isFileSystemAccessSupported()) {
      // Fallback: Use input element
      return this.selectDirectoryFallback();
    }

    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'read'
      });
      
      // Store handle for later use
      const path = dirHandle.name;
      this.directoryHandles.set(path, dirHandle);
      
      return path;
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  async selectFile(filters?: FileFilter[]): Promise<string | null> {
    if (!isFileSystemAccessSupported()) {
      // Fallback: Use input element
      return this.selectFileFallback(filters);
    }

    try {
      const [fileHandle] = await (window as any).showOpenFilePicker({
        types: convertFilters(filters),
        multiple: false
      });
      
      // Store handle for later use
      const path = fileHandle.name;
      this.fileHandles.set(path, fileHandle);
      
      return path;
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        return null;
      }
      throw error;
    }
  }

  async selectFiles(filters?: FileFilter[]): Promise<string[]> {
    if (!isFileSystemAccessSupported()) {
      // Fallback: Use input element
      return this.selectFilesFallback(filters);
    }

    try {
      const fileHandles = await (window as any).showOpenFilePicker({
        types: convertFilters(filters),
        multiple: true
      });
      
      const paths: string[] = [];
      for (const handle of fileHandles) {
        const path = handle.name;
        this.fileHandles.set(path, handle);
        paths.push(path);
      }
      
      return paths;
    } catch (error) {
      if ((error as any).name === 'AbortError') {
        return [];
      }
      throw error;
    }
  }

  async getFileInfo(path: string): Promise<FileInfo> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error('File not found. Please select the file first.');
    }

    const file = await handle.getFile();
    return {
      name: file.name,
      path: path,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };
  }

  async *readFileStream(path: string, chunkSize: number = 1024 * 1024): AsyncIterableIterator<Uint8Array> {
    const handle = this.fileHandles.get(path);
    if (!handle) {
      throw new Error('File not found. Please select the file first.');
    }

    const file = await handle.getFile();
    const reader = file.stream().getReader();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        yield value;
      }
    } finally {
      reader.releaseLock();
    }
  }

  async validateFile(path: string, maxSizeGB: number = 50): Promise<{ valid: boolean; error?: string }> {
    try {
      const handle = this.fileHandles.get(path);
      if (!handle) {
        return { valid: false, error: 'File not found' };
      }

      const file = await handle.getFile();
      const maxSizeBytes = maxSizeGB * 1024 * 1024 * 1024;
      
      if (file.size > maxSizeBytes) {
        return { 
          valid: false, 
          error: `File size (${(file.size / 1024 / 1024 / 1024).toFixed(2)}GB) exceeds maximum (${maxSizeGB}GB)` 
        };
      }

      // Check file extension
      const validExtensions = ['csv', 'xlsx', 'xls', 'tsv', 'txt', 'json'];
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !validExtensions.includes(extension)) {
        return { 
          valid: false, 
          error: `Invalid file type. Supported types: ${validExtensions.join(', ')}` 
        };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: String(error) };
    }
  }

  // Fallback methods for browsers without File System Access API
  private selectFileFallback(filters?: FileFilter[]): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      
      if (filters && filters.length > 0) {
        const extensions = filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
        input.accept = extensions.join(',');
      }

      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
          // Store file reference for later use
          this.storeFileReference(file.name, file);
          resolve(file.name);
        } else {
          resolve(null);
        }
      };

      input.click();
    });
  }

  private selectFilesFallback(filters?: FileFilter[]): Promise<string[]> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      
      if (filters && filters.length > 0) {
        const extensions = filters.flatMap(f => f.extensions.map(ext => `.${ext}`));
        input.accept = extensions.join(',');
      }

      input.onchange = (event) => {
        const files = Array.from((event.target as HTMLInputElement).files || []);
        const paths = files.map(file => {
          this.storeFileReference(file.name, file);
          return file.name;
        });
        resolve(paths);
      };

      input.click();
    });
  }

  private selectDirectoryFallback(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      (input as any).webkitdirectory = true;
      (input as any).directory = true;

      input.onchange = (event) => {
        const files = (event.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          // Get directory name from first file path
          const firstFile = files[0];
          const pathParts = (firstFile as any).webkitRelativePath?.split('/') || [];
          const dirName = pathParts[0] || 'selected-directory';
          
          // Store all files from directory
          Array.from(files).forEach(file => {
            const relativePath = (file as any).webkitRelativePath || file.name;
            this.storeFileReference(relativePath, file);
          });
          
          resolve(dirName);
        } else {
          resolve(null);
        }
      };

      input.click();
    });
  }

  // Store File objects for fallback mode
  private fileReferences: Map<string, File> = new Map();

  private storeFileReference(path: string, file: File) {
    this.fileReferences.set(path, file);
  }

  // Enhanced readFile for fallback mode
  async readFileFallback(path: string): Promise<string> {
    const file = this.fileReferences.get(path);
    if (file) {
      return file.text();
    }
    throw new Error('File not found');
  }

  // Get file handle or reference
  async getFileHandle(path: string): Promise<File | null> {
    // First check if we have a FileSystemFileHandle
    const handle = this.fileHandles.get(path);
    if (handle) {
      return handle.getFile();
    }
    
    // Then check if we have a File reference (fallback mode)
    const file = this.fileReferences.get(path);
    if (file) {
      return file;
    }
    
    return null;
  }
}

// Drag and drop enhancement
export class DragDropEnhancer {
  private dropZone: HTMLElement;
  private onFilesDropped: (files: FileInfo[]) => void;
  private fileSystemAPI: FileSystemAccessAPI;

  constructor(
    dropZone: HTMLElement, 
    onFilesDropped: (files: FileInfo[]) => void,
    fileSystemAPI: FileSystemAccessAPI
  ) {
    this.dropZone = dropZone;
    this.onFilesDropped = onFilesDropped;
    this.fileSystemAPI = fileSystemAPI;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.dropZone.addEventListener('dragover', this.handleDragOver);
    this.dropZone.addEventListener('drop', this.handleDrop);
    this.dropZone.addEventListener('dragleave', this.handleDragLeave);
    this.dropZone.addEventListener('dragenter', this.handleDragEnter);
  }

  private handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  };

  private handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');
  };

  private handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.add('drag-over');
  };

  private handleDrop = async (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    this.dropZone.classList.remove('drag-over');

    const items = Array.from(e.dataTransfer?.items || []);
    const fileInfos: FileInfo[] = [];

    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry?.();
        
        if (entry) {
          if (entry.isFile) {
            const file = item.getAsFile();
            if (file) {
              // Store file reference
              (this.fileSystemAPI as any).storeFileReference(file.name, file);
              
              fileInfos.push({
                name: file.name,
                path: file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
              });
            }
          } else if (entry.isDirectory) {
            // Handle directory drop
            const files = await this.readDirectory(entry as any);
            fileInfos.push(...files);
          }
        } else {
          // Fallback for regular file drop
          const file = item.getAsFile();
          if (file) {
            (this.fileSystemAPI as any).storeFileReference(file.name, file);
            
            fileInfos.push({
              name: file.name,
              path: file.name,
              size: file.size,
              type: file.type,
              lastModified: file.lastModified
            });
          }
        }
      }
    }

    if (fileInfos.length > 0) {
      this.onFilesDropped(fileInfos);
    }
  };

  private async readDirectory(dirEntry: any): Promise<FileInfo[]> {
    const files: FileInfo[] = [];
    const reader = dirEntry.createReader();
    
    return new Promise((resolve) => {
      const readEntries = () => {
        reader.readEntries(async (entries: any[]) => {
          if (entries.length === 0) {
            resolve(files);
            return;
          }

          for (const entry of entries) {
            if (entry.isFile) {
              const file = await new Promise<File>((resolve) => {
                entry.file((file: File) => resolve(file));
              });
              
              const relativePath = entry.fullPath;
              (this.fileSystemAPI as any).storeFileReference(relativePath, file);
              
              files.push({
                name: file.name,
                path: relativePath,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
              });
            } else if (entry.isDirectory) {
              const subFiles = await this.readDirectory(entry);
              files.push(...subFiles);
            }
          }

          readEntries(); // Continue reading
        });
      };

      readEntries();
    });
  }

  destroy() {
    this.dropZone.removeEventListener('dragover', this.handleDragOver);
    this.dropZone.removeEventListener('drop', this.handleDrop);
    this.dropZone.removeEventListener('dragleave', this.handleDragLeave);
    this.dropZone.removeEventListener('dragenter', this.handleDragEnter);
  }
}

// File preview functionality
export class FilePreview {
  static async generatePreview(file: File, maxRows: number = 10): Promise<{
    headers?: string[];
    rows?: any[];
    totalRows?: number;
    error?: string;
  }> {
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'csv' || extension === 'tsv') {
        return this.previewCSV(file, maxRows, extension === 'tsv' ? '\t' : ',');
      } else if (extension === 'json') {
        return this.previewJSON(file, maxRows);
      } else if (extension === 'xlsx' || extension === 'xls') {
        return { error: 'Excel preview requires server-side processing' };
      } else {
        return this.previewText(file, maxRows);
      }
    } catch (error) {
      return { error: String(error) };
    }
  }

  private static async previewCSV(
    file: File, 
    maxRows: number, 
    delimiter: string = ','
  ): Promise<any> {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      return { error: 'Empty file' };
    }

    const headers = lines[0].split(delimiter).map(h => h.trim());
    const rows = lines.slice(1, maxRows + 1).map(line => {
      const values = line.split(delimiter);
      const row: any = {};
      headers.forEach((header, index) => {
        row[header] = values[index]?.trim() || '';
      });
      return row;
    });

    return {
      headers,
      rows,
      totalRows: lines.length - 1
    };
  }

  private static async previewJSON(file: File, maxRows: number): Promise<any> {
    const text = await file.text();
    const data = JSON.parse(text);
    
    if (Array.isArray(data)) {
      const rows = data.slice(0, maxRows);
      const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
      return {
        headers,
        rows,
        totalRows: data.length
      };
    } else {
      return {
        headers: ['Key', 'Value'],
        rows: Object.entries(data).slice(0, maxRows).map(([key, value]) => ({
          Key: key,
          Value: JSON.stringify(value)
        })),
        totalRows: Object.keys(data).length
      };
    }
  }

  private static async previewText(file: File, maxRows: number): Promise<any> {
    const text = await file.text();
    const lines = text.split('\n').slice(0, maxRows);
    
    return {
      headers: ['Line'],
      rows: lines.map((line, index) => ({ Line: line })),
      totalRows: text.split('\n').length
    };
  }
}