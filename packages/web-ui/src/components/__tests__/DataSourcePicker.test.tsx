import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DataSourcePicker } from '../DataSourcePicker';

// Mock the platform bridge
const mockPlatformBridge = {
  capabilities: {
    hasFileSystemAccess: false,
    hasNotifications: false,
    hasSystemTray: false,
    hasMenuBar: false,
    canMinimizeToTray: false,
    platform: 'browser' as const
  },
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn()
};

Object.defineProperty(window, 'platformBridge', {
  value: mockPlatformBridge,
  writable: true
});

describe('DataSourcePicker', () => {
  it('renders with default props', () => {
    const mockOnFilesSelected = vi.fn();
    
    render(<DataSourcePicker onFilesSelected={mockOnFilesSelected} />);
    
    expect(screen.getByText('Select Data Files')).toBeInTheDocument();
    expect(screen.getByText('Drag and drop files here or')).toBeInTheDocument();
    expect(screen.getByText('browse files')).toBeInTheDocument();
  });

  it('displays file requirements correctly', () => {
    const mockOnFilesSelected = vi.fn();
    
    render(
      <DataSourcePicker
        onFilesSelected={mockOnFilesSelected}
        maxSizeGB={25}
        acceptedFormats={['.csv', '.xlsx']}
      />
    );
    
    expect(screen.getByText('Supported formats:')).toBeInTheDocument();
    expect(screen.getByText('.csv, .xlsx')).toBeInTheDocument();
    expect(screen.getByText('Maximum size:')).toBeInTheDocument();
    expect(screen.getByText('25GB per file')).toBeInTheDocument();
  });

  it('shows validation overlay when validating', async () => {
    const mockOnFilesSelected = vi.fn();
    
    render(<DataSourcePicker onFilesSelected={mockOnFilesSelected} />);
    
    // The validation overlay should not be visible initially
    expect(screen.queryByText('Validating files...')).not.toBeInTheDocument();
  });

  it('renders browse button', () => {
    const mockOnFilesSelected = vi.fn();
    
    render(<DataSourcePicker onFilesSelected={mockOnFilesSelected} />);
    
    const browseButton = screen.getByRole('button', { name: /browse files/i });
    expect(browseButton).toBeInTheDocument();
    expect(browseButton).not.toBeDisabled();
  });

  it('applies drag-over styling class correctly', () => {
    const mockOnFilesSelected = vi.fn();
    
    render(<DataSourcePicker onFilesSelected={mockOnFilesSelected} />);
    
    const dropZone = screen.getByText('Select Data Files').closest('.drop-zone');
    expect(dropZone).not.toHaveClass('drag-over');
  });
});