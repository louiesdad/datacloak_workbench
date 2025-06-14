import { useState } from 'react'
import './App.css'
import { DataSourcePicker, ProfilerUI } from './components'
import type { FileProfile, FieldProfile } from './components'
import type { FileInfo } from './platform-bridge'

// Mock data for development/demonstration
const createMockFileProfile = (file: FileInfo): FileProfile => {
  const mockFields: FieldProfile[] = [
    {
      name: 'customer_id',
      type: 'number',
      samples: ['12345', '67890', '11111'],
      nullCount: 0,
      totalCount: 1000,
      uniqueCount: 1000,
      piiDetection: { isPII: false, confidence: 0.1 }
    },
    {
      name: 'email',
      type: 'string',
      samples: ['john.doe@example.com', 'jane.smith@company.com', 'user@domain.org'],
      nullCount: 5,
      totalCount: 1000,
      uniqueCount: 995,
      piiDetection: { isPII: true, piiType: 'email', confidence: 0.95 }
    },
    {
      name: 'phone_number',
      type: 'string',
      samples: ['(555) 123-4567', '555-987-6543', '+1-555-555-5555'],
      nullCount: 50,
      totalCount: 1000,
      uniqueCount: 950,
      piiDetection: { isPII: true, piiType: 'phone', confidence: 0.88 }
    },
    {
      name: 'purchase_amount',
      type: 'number',
      samples: ['29.99', '149.50', '75.25'],
      nullCount: 0,
      totalCount: 1000,
      uniqueCount: 847,
      piiDetection: { isPII: false, confidence: 0.05 },
      stats: { min: 5.99, max: 999.99, mean: 125.67, median: 89.50 }
    },
    {
      name: 'purchase_date',
      type: 'date',
      samples: ['2024-01-15', '2024-02-03', '2024-01-28'],
      nullCount: 2,
      totalCount: 1000,
      uniqueCount: 365,
      piiDetection: { isPII: false, confidence: 0.02 }
    },
    {
      name: 'full_name',
      type: 'string',
      samples: ['John Doe', 'Jane Smith', 'Robert Johnson'],
      nullCount: 1,
      totalCount: 1000,
      uniqueCount: 999,
      piiDetection: { isPII: true, piiType: 'name', confidence: 0.92 }
    }
  ];

  return {
    file,
    fields: mockFields,
    rowCount: 1000,
    processingTime: 2.5,
    errors: []
  };
};

function App() {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([])
  const [fileProfiles, setFileProfiles] = useState<FileProfile[]>([])
  const [selectedFields, setSelectedFields] = useState<Record<string, boolean>>({})
  const [piiMaskingSettings, setPiiMaskingSettings] = useState<Record<string, boolean>>({})

  const handleFilesSelected = (files: FileInfo[]) => {
    setSelectedFiles(files)
    // In a real app, this would trigger the profiling process
    const profiles = files.map(createMockFileProfile)
    setFileProfiles(profiles)
    
    // Auto-select all non-PII fields
    const autoSelected: Record<string, boolean> = {}
    const autoMasked: Record<string, boolean> = {}
    profiles.forEach((profile, fileIndex) => {
      profile.fields.forEach(field => {
        const fieldKey = `${fileIndex}:${field.name}`
        autoSelected[fieldKey] = !field.piiDetection.isPII
        if (field.piiDetection.isPII) {
          autoMasked[fieldKey] = true
        }
      })
    })
    setSelectedFields(autoSelected)
    setPiiMaskingSettings(autoMasked)
  }

  const handleFieldToggle = (fileIndex: number, fieldName: string, selected: boolean) => {
    const fieldKey = `${fileIndex}:${fieldName}`
    setSelectedFields(prev => ({
      ...prev,
      [fieldKey]: selected
    }))
  }

  const handlePIIToggle = (fileIndex: number, fieldName: string, maskPII: boolean) => {
    const fieldKey = `${fileIndex}:${fieldName}`
    setPiiMaskingSettings(prev => ({
      ...prev,
      [fieldKey]: maskPII
    }))
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>DataCloak Sentiment Workbench</h1>
        <p>Secure data processing with automatic PII detection and masking</p>
      </header>

      <main className="app-main">
        <section className="data-source-section">
          <h2>Step 1: Select Data Files</h2>
          <DataSourcePicker
            onFilesSelected={handleFilesSelected}
            maxSizeGB={50}
            acceptedFormats={['.csv', '.xlsx', '.xls', '.tsv']}
          />
        </section>

        {fileProfiles.length > 0 && (
          <section className="profiler-section">
            <h2>Step 2: Review Data Profile</h2>
            <ProfilerUI
              fileProfiles={fileProfiles}
              selectedFields={selectedFields}
              piiMaskingSettings={piiMaskingSettings}
              onFieldToggle={handleFieldToggle}
              onPIIToggle={handlePIIToggle}
            />
          </section>
        )}

        {Object.keys(selectedFields).filter(key => selectedFields[key]).length > 0 && (
          <section className="next-steps">
            <h2>Step 3: Configure Processing</h2>
            <div className="summary-card">
              <h3>Selected Configuration</h3>
              <div className="config-summary">
                <div className="stat">
                  <strong>{Object.keys(selectedFields).filter(key => selectedFields[key]).length}</strong> fields selected
                </div>
                <div className="stat">
                  <strong>{Object.keys(piiMaskingSettings).filter(key => piiMaskingSettings[key]).length}</strong> PII fields to be masked
                </div>
                <div className="stat">
                  <strong>{selectedFiles.length}</strong> file{selectedFiles.length > 1 ? 's' : ''} ready for processing
                </div>
              </div>
              <button className="primary-button" disabled>
                Configure Sentiment Analysis (Coming Soon)
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
