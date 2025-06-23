/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileUploadPreview } from '../FileUploadPreview';

// Mock file-system-access module to prevent import errors
vi.mock('../../file-system-access', () => ({
  isFileSystemAccessSupported: () => false,
  isSecureContext: () => true,
  FileSystemAccessAPI: vi.fn(),
  DragDropEnhancer: vi.fn(),
  FilePreview: vi.fn()
}));

// RED: Write failing test for time estimation feature
describe('FileUploadPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File Upload Component', () => {
    test('should display time estimates based on file size', () => {
      // Arrange
      const onUploadComplete = vi.fn();
      const mockFile = new File(['test content'], 'test-file.csv', { 
        type: 'text/csv',
        lastModified: Date.now()
      });
      
      // Make the file 25GB (25 * 1024 * 1024 * 1024 bytes)
      Object.defineProperty(mockFile, 'size', {
        value: 25 * 1024 * 1024 * 1024,
        writable: false
      });

      // Act
      const { container } = render(
        <FileUploadPreview 
          onUploadComplete={onUploadComplete}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeTruthy();
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      fireEvent.change(fileInput);

      // Assert - This should FAIL because component doesn't exist yet
      expect(screen.getByText(/Quick Preview: ~5 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/Statistical Sample: ~30 minutes/)).toBeInTheDocument();
      expect(screen.getByText(/Full Analysis: ~14 hours/)).toBeInTheDocument();
    });
    
    test('should show quick preview option for large files', () => {
      // Arrange
      const onStartPreview = vi.fn();
      const mockLargeFile = new File(['large content'], 'large-file.csv', { 
        type: 'text/csv'
      });
      
      Object.defineProperty(mockLargeFile, 'size', {
        value: 5 * 1024 * 1024 * 1024, // 5GB
        writable: false
      });

      // Act
      const { container } = render(
        <FileUploadPreview 
          onStartPreview={onStartPreview}
        />
      );

      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [mockLargeFile],
        writable: false
      });
      
      fireEvent.change(fileInput);

      // Assert
      const quickPreviewButton = screen.getByRole('button', { 
        name: /Start Quick Preview/i 
      });
      expect(quickPreviewButton).toBeInTheDocument();
      
      const fullProcessButton = screen.getByRole('button', { 
        name: /Process Full File/i 
      });
      expect(fullProcessButton).toBeInTheDocument();
    });
    
    test('should trigger preview API on button click', () => {
      // Arrange
      const onStartPreview = vi.fn();
      const mockFile = new File(['content'], 'test.csv', { type: 'text/csv' });
      
      Object.defineProperty(mockFile, 'size', {
        value: 10 * 1024 * 1024 * 1024, // 10GB
        writable: false
      });

      const { container } = render(
        <FileUploadPreview 
          onStartPreview={onStartPreview}
        />
      );

      // Act
      const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
      
      // Simulate file selection
      Object.defineProperty(fileInput, 'files', {
        value: [mockFile],
        writable: false
      });
      
      fireEvent.change(fileInput);
      
      const quickPreviewButton = screen.getByRole('button', { 
        name: /Start Quick Preview/i 
      });
      fireEvent.click(quickPreviewButton);

      // Assert
      expect(onStartPreview).toHaveBeenCalledWith(mockFile, {
        mode: 'preview',
        rows: 1000
      });
    });
  });
});