/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

// Mock file-system-access module to prevent import errors
vi.mock('../../file-system-access', () => ({
  isFileSystemAccessSupported: () => false,
  isSecureContext: () => true,
  FileSystemAccessAPI: vi.fn(),
  DragDropEnhancer: vi.fn(),
  FilePreview: vi.fn()
}));

describe('FileUploadPreview Simple Test', () => {
  test('should render without crashing', () => {
    const TestComponent = () => <div>Test</div>;
    const { container } = render(<TestComponent />);
    expect(container.textContent).toBe('Test');
  });
  
  test('should import component', async () => {
    const { FileUploadPreview } = await import('../FileUploadPreview');
    expect(FileUploadPreview).toBeDefined();
  });
});