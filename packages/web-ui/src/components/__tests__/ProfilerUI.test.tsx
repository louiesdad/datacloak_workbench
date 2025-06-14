import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProfilerUI } from '../ProfilerUI';
import type { FileProfile, FieldProfile } from '../ProfilerUI';

const createMockFieldProfile = (overrides: Partial<FieldProfile> = {}): FieldProfile => ({
  name: 'test_field',
  type: 'string',
  samples: ['sample1', 'sample2', 'sample3'],
  nullCount: 0,
  totalCount: 100,
  uniqueCount: 95,
  piiDetection: { isPII: false, confidence: 0.1 },
  ...overrides
});

const createMockFileProfile = (overrides: Partial<FileProfile> = {}): FileProfile => ({
  file: {
    name: 'test.csv',
    path: '/path/to/test.csv',
    size: 1024 * 1024, // 1MB
    type: 'text/csv',
    lastModified: Date.now()
  },
  fields: [createMockFieldProfile()],
  rowCount: 100,
  processingTime: 1.5,
  errors: [],
  ...overrides
});

describe('ProfilerUI', () => {
  it('renders empty state when no file profiles provided', () => {
    render(<ProfilerUI fileProfiles={[]} />);
    
    expect(screen.getByText('No Data to Profile')).toBeInTheDocument();
    expect(screen.getByText('Select data files to see field analysis and PII detection.')).toBeInTheDocument();
  });

  it('renders file profile header correctly', () => {
    const fileProfile = createMockFileProfile();
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    expect(screen.getByText('Data Profile Analysis')).toBeInTheDocument();
    expect(screen.getByText('1 file analyzed')).toBeInTheDocument();
    expect(screen.getByText('test.csv')).toBeInTheDocument();
    expect(screen.getByText('1.0 MB')).toBeInTheDocument();
    expect(screen.getByText('100 rows')).toBeInTheDocument();
    expect(screen.getByText('1 fields')).toBeInTheDocument();
  });

  it('displays PII fields with badges', () => {
    const piiField = createMockFieldProfile({
      name: 'email',
      piiDetection: { isPII: true, piiType: 'email', confidence: 0.95 }
    });
    const fileProfile = createMockFileProfile({ fields: [piiField] });
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    expect(screen.getByText('🔒 1 PII')).toBeInTheDocument();
  });

  it('handles multiple files correctly', () => {
    const fileProfiles = [
      createMockFileProfile({ file: { ...createMockFileProfile().file, name: 'file1.csv' } }),
      createMockFileProfile({ file: { ...createMockFileProfile().file, name: 'file2.csv' } })
    ];
    
    render(<ProfilerUI fileProfiles={fileProfiles} />);
    
    expect(screen.getByText('2 files analyzed')).toBeInTheDocument();
    expect(screen.getByText('file1.csv')).toBeInTheDocument();
    expect(screen.getByText('file2.csv')).toBeInTheDocument();
  });

  it('displays field statistics correctly', () => {
    const field = createMockFieldProfile({
      name: 'customer_id',
      type: 'number',
      nullCount: 5,
      totalCount: 100,
      uniqueCount: 95
    });
    const fileProfile = createMockFileProfile({ fields: [field] });
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    // Click to expand the file
    const fileHeader = screen.getByText('test.csv').closest('.file-header');
    if (fileHeader) {
      fileHeader.click();
    }

    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByText('number')).toBeInTheDocument();
    expect(screen.getByText('100 rows, 5 null')).toBeInTheDocument();
    expect(screen.getByText('95 unique values')).toBeInTheDocument();
  });

  it('shows processing errors when present', () => {
    const fileProfile = createMockFileProfile({
      errors: ['Unable to parse row 50', 'Invalid date format in column 2']
    });
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    expect(screen.getByText('Processing Errors:')).toBeInTheDocument();
    expect(screen.getByText('Unable to parse row 50')).toBeInTheDocument();
    expect(screen.getByText('Invalid date format in column 2')).toBeInTheDocument();
  });

  it('renders field samples correctly', () => {
    const field = createMockFieldProfile({
      samples: ['value1', 'value2', 'value3', 'value4', 'value5']
    });
    const fileProfile = createMockFileProfile({ fields: [field] });
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    // Click to expand the file
    const fileHeader = screen.getByText('test.csv').closest('.file-header');
    if (fileHeader) {
      fileHeader.click();
    }

    expect(screen.getByText('value1')).toBeInTheDocument();
    expect(screen.getByText('value2')).toBeInTheDocument();
    expect(screen.getByText('value3')).toBeInTheDocument();
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });

  it('calculates completion rate correctly', () => {
    const field = createMockFieldProfile({
      nullCount: 25,
      totalCount: 100
    });
    const fileProfile = createMockFileProfile({ fields: [field] });
    
    render(<ProfilerUI fileProfiles={[fileProfile]} />);
    
    // Click to expand the file
    const fileHeader = screen.getByText('test.csv').closest('.file-header');
    if (fileHeader) {
      fileHeader.click();
    }

    expect(screen.getByText('75.0%')).toBeInTheDocument();
  });
});