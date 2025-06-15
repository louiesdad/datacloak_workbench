import { useState, useCallback, useRef } from 'react';
import { useNotifications } from '../components/NotificationToast';
import { useApiErrorHandler, type ApiError } from './useApiErrorHandler';

interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
  stage: 'preparing' | 'uploading' | 'processing' | 'complete' | 'error';
}

interface UploadOptions {
  chunkSize?: number;
  maxFileSize?: number;
  allowedTypes?: string[];
  timeout?: number;
  retries?: number;
  onProgress?: (progress: UploadProgress) => void;
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void;
  validateContent?: boolean;
}

interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName: string;
  fileSize: number;
  uploadTime: number;
  error?: ApiError;
}

interface ChunkInfo {
  chunk: Blob;
  index: number;
  size: number;
  checksum?: string;
}

const DEFAULT_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB
const DEFAULT_MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const DEFAULT_RETRIES = 3;

export function useLargeFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [uploadedChunks, setUploadedChunks] = useState<Set<number>>(new Set());
  const { addNotification } = useNotifications();
  const { handleApiError } = useApiErrorHandler();
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);
  const uploadedBytesRef = useRef<number>(0);

  const validateFile = (file: File, options: UploadOptions): { valid: boolean; error?: string } => {
    const maxSize = options.maxFileSize || DEFAULT_MAX_FILE_SIZE;
    const allowedTypes = options.allowedTypes || [];

    if (file.size > maxSize) {
      return {
        valid: false,
        error: `File size (${formatFileSize(file.size)}) exceeds maximum allowed size (${formatFileSize(maxSize)})`
      };
    }

    if (allowedTypes.length > 0) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      const mimeType = file.type;
      
      const typeMatches = allowedTypes.some(type => {
        if (type.startsWith('.')) {
          return fileExtension === type.slice(1);
        }
        return mimeType.includes(type);
      });

      if (!typeMatches) {
        return {
          valid: false,
          error: `File type not allowed. Supported types: ${allowedTypes.join(', ')}`
        };
      }
    }

    return { valid: true };
  };

  const calculateChecksum = async (chunk: Blob): Promise<string> => {
    const buffer = await chunk.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const createChunks = async (file: File, chunkSize: number): Promise<ChunkInfo[]> => {
    const chunks: ChunkInfo[] = [];
    const totalChunks = Math.ceil(file.size / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunk = file.slice(start, end);
      
      chunks.push({
        chunk,
        index: i,
        size: chunk.size,
        checksum: await calculateChecksum(chunk)
      });
    }

    return chunks;
  };

  const uploadChunk = async (
    chunkInfo: ChunkInfo,
    file: File,
    uploadId: string,
    options: UploadOptions
  ): Promise<boolean> => {
    const timeout = options.timeout || DEFAULT_TIMEOUT;
    const maxRetries = options.retries || DEFAULT_RETRIES;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append('file', chunkInfo.chunk);
        formData.append('chunkIndex', chunkInfo.index.toString());
        formData.append('chunkSize', chunkInfo.size.toString());
        formData.append('fileName', file.name);
        formData.append('uploadId', uploadId);
        formData.append('checksum', chunkInfo.checksum || '');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch('/api/upload/chunk', {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`Chunk upload failed: ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.verified !== true) {
          throw new Error('Chunk verification failed');
        }

        return true;

      } catch (error: any) {
        if (error.name === 'AbortError') {
          throw handleApiError(error, {
            operation: 'upload chunk',
            component: 'useLargeFileUpload',
            userMessage: 'Upload timed out'
          });
        }

        if (attempt === maxRetries - 1) {
          throw handleApiError(error, {
            operation: 'upload chunk',
            component: 'useLargeFileUpload',
            userMessage: `Failed to upload chunk ${chunkInfo.index + 1}`
          });
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    return false;
  };

  const updateProgress = (
    stage: UploadProgress['stage'],
    loaded: number,
    total: number,
    speed?: number
  ) => {
    const percentage = total > 0 ? (loaded / total) * 100 : 0;
    const remainingBytes = total - loaded;
    const remainingTime = speed && speed > 0 ? remainingBytes / speed : 0;

    const progressUpdate: UploadProgress = {
      loaded,
      total,
      percentage,
      speed: speed || 0,
      remainingTime,
      stage
    };

    setProgress(progressUpdate);
  };

  const uploadFile = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    if (isUploading) {
      throw new Error('Upload already in progress');
    }

    // Validate file
    const validation = validateFile(file, options);
    if (!validation.valid) {
      const error = handleApiError(new Error(validation.error), {
        operation: 'file validation',
        component: 'useLargeFileUpload',
        userMessage: validation.error!
      });
      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        uploadTime: 0,
        error
      };
    }

    setIsUploading(true);
    setUploadedChunks(new Set());
    startTimeRef.current = Date.now();
    uploadedBytesRef.current = 0;

    // Create abort controller
    abortControllerRef.current = new AbortController();

    try {
      updateProgress('preparing', 0, file.size);

      // Initialize upload session
      const uploadSession = await fetch('/api/upload/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          chunkSize: options.chunkSize || DEFAULT_CHUNK_SIZE
        }),
        signal: abortControllerRef.current.signal
      });

      if (!uploadSession.ok) {
        throw new Error('Failed to initialize upload session');
      }

      const { uploadId } = await uploadSession.json();

      // Create chunks
      updateProgress('preparing', 0, file.size);
      const chunks = await createChunks(file, options.chunkSize || DEFAULT_CHUNK_SIZE);
      
      updateProgress('uploading', 0, file.size);

      // Upload chunks in parallel (with concurrency limit)
      const concurrency = 3; // Maximum 3 chunks at once
      const uploadPromises: Promise<void>[] = [];
      
      for (let i = 0; i < chunks.length; i += concurrency) {
        const batch = chunks.slice(i, i + concurrency);
        
        const batchPromises = batch.map(async (chunkInfo) => {
          const success = await uploadChunk(chunkInfo, file, uploadId, options);
          
          if (success) {
            setUploadedChunks(prev => new Set([...prev, chunkInfo.index]));
            uploadedBytesRef.current += chunkInfo.size;
            
            // Calculate upload speed
            const elapsed = (Date.now() - startTimeRef.current) / 1000;
            const speed = uploadedBytesRef.current / elapsed;
            
            updateProgress('uploading', uploadedBytesRef.current, file.size, speed);
            
            if (options.onChunkComplete) {
              options.onChunkComplete(chunkInfo.index, chunks.length);
            }
          }
        });

        await Promise.all(batchPromises);
      }

      // Finalize upload
      updateProgress('processing', file.size, file.size);
      
      const finalizeResponse = await fetch('/api/upload/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadId,
          totalChunks: chunks.length,
          validateContent: options.validateContent
        }),
        signal: abortControllerRef.current.signal
      });

      if (!finalizeResponse.ok) {
        throw new Error('Failed to finalize upload');
      }

      const finalResult = await finalizeResponse.json();
      
      updateProgress('complete', file.size, file.size);
      
      const uploadTime = (Date.now() - startTimeRef.current) / 1000;

      addNotification({
        type: 'success',
        message: `File uploaded successfully: ${file.name} (${formatFileSize(file.size)})`,
        duration: 5000
      });

      return {
        success: true,
        fileId: finalResult.fileId,
        fileName: file.name,
        fileSize: file.size,
        uploadTime
      };

    } catch (error: any) {
      const apiError = handleApiError(error, {
        operation: 'file upload',
        component: 'useLargeFileUpload',
        userMessage: 'Upload failed'
      });

      updateProgress('error', uploadedBytesRef.current, file.size);

      return {
        success: false,
        fileName: file.name,
        fileSize: file.size,
        uploadTime: (Date.now() - startTimeRef.current) / 1000,
        error: apiError
      };

    } finally {
      setIsUploading(false);
      abortControllerRef.current = null;
    }
  }, [isUploading, handleApiError, addNotification]);

  const cancelUpload = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsUploading(false);
      setProgress(null);
      setUploadedChunks(new Set());
      
      addNotification({
        type: 'info',
        message: 'Upload cancelled',
        duration: 3000
      });
    }
  }, [addNotification]);

  const resumeUpload = useCallback(async (
    file: File,
    uploadId: string,
    options: UploadOptions = {}
  ): Promise<UploadResult> => {
    // Get upload status
    const statusResponse = await fetch(`/api/upload/status/${uploadId}`);
    if (!statusResponse.ok) {
      throw new Error('Failed to get upload status');
    }

    const { completedChunks, totalChunks } = await statusResponse.json();
    const chunks = await createChunks(file, options.chunkSize || DEFAULT_CHUNK_SIZE);
    
    // Filter out completed chunks
    const remainingChunks = chunks.filter(chunk => !completedChunks.includes(chunk.index));
    
    if (remainingChunks.length === 0) {
      // Upload already complete
      return {
        success: true,
        fileName: file.name,
        fileSize: file.size,
        uploadTime: 0
      };
    }

    // Resume upload with remaining chunks
    setUploadedChunks(new Set(completedChunks));
    uploadedBytesRef.current = completedChunks.length * (options.chunkSize || DEFAULT_CHUNK_SIZE);
    
    // Continue with normal upload process for remaining chunks
    return uploadFile(file, options);
  }, [uploadFile]);

  return {
    uploadFile,
    cancelUpload,
    resumeUpload,
    isUploading,
    progress,
    uploadedChunks: Array.from(uploadedChunks)
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export type { UploadProgress, UploadOptions, UploadResult };