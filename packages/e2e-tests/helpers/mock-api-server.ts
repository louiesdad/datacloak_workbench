import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

// Mock data generators
const generateFieldInference = (fields: string[]) => {
  return fields.map((field, index) => ({
    name: field,
    type: field.includes('email') ? 'email' : 
          field.includes('phone') ? 'phone' :
          field.includes('id') ? 'integer' :
          field.includes('date') ? 'date' :
          field.includes('amount') || field.includes('price') ? 'currency' :
          'text',
    confidence: 0.85 + Math.random() * 0.15,
    isPII: field.includes('email') || field.includes('phone') || field.includes('name') || field.includes('address'),
    sampleValues: [`Sample ${field} 1`, `Sample ${field} 2`, `Sample ${field} 3`],
    nullCount: Math.floor(Math.random() * 10),
    uniqueCount: 95 + Math.floor(Math.random() * 5)
  }));
};

const generateSentimentResults = (rowCount: number) => {
  const results = [];
  for (let i = 0; i < rowCount; i++) {
    results.push({
      id: i + 1,
      sentiment: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
      confidence: 0.7 + Math.random() * 0.3,
      processedAt: new Date().toISOString()
    });
  }
  return results;
};

// Mock handlers
export const backendHandlers = [
  // Health check
  http.get('http://localhost:3001/health', () => {
    return HttpResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'test'
    });
  }),

  // File upload
  http.post('http://localhost:3001/api/upload', async ({ request }) => {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return HttpResponse.json(
        { error: { message: 'No file provided', code: 'MISSING_FILE' } },
        { status: 400 }
      );
    }

    const fileId = `file_${Date.now()}`;
    const fileName = file.name;
    const fileSize = file.size;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return HttpResponse.json({
      success: true,
      data: {
        fileId,
        fileName,
        fileSize,
        uploadedAt: new Date().toISOString(),
        status: 'uploaded'
      }
    });
  }),

  // File profiling
  http.post('http://localhost:3001/api/profile', async ({ request }) => {
    const body = await request.json() as any;
    const { fileId } = body;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock field inference based on common CSV structure
    const mockFields = ['id', 'name', 'email', 'phone', 'address', 'comment', 'created_date', 'amount'];
    const fields = generateFieldInference(mockFields);

    return HttpResponse.json({
      success: true,
      data: {
        fileId,
        fields,
        rowCount: 100,
        columnCount: mockFields.length,
        profiledAt: new Date().toISOString(),
        dataQuality: {
          completeness: 0.95,
          consistency: 0.88,
          validity: 0.92
        }
      }
    });
  }),

  // Data transformation
  http.post('http://localhost:3001/api/transform', async ({ request }) => {
    const body = await request.json() as any;
    const { fileId, transformations } = body;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    return HttpResponse.json({
      success: true,
      data: {
        fileId,
        transformedFileId: `transformed_${fileId}`,
        transformations: transformations,
        rowsProcessed: 100,
        transformedAt: new Date().toISOString()
      }
    });
  }),

  // Sentiment analysis job creation
  http.post('http://localhost:3001/api/sentiment/analyze', async ({ request }) => {
    const body = await request.json() as any;
    const { fileId, textField, options } = body;

    const jobId = `job_${Date.now()}`;

    return HttpResponse.json({
      success: true,
      data: {
        jobId,
        fileId,
        textField,
        options,
        status: 'queued',
        estimatedCost: 2.50,
        estimatedDuration: 30,
        createdAt: new Date().toISOString()
      }
    });
  }),

  // Job status
  http.get('http://localhost:3001/api/jobs/:jobId', ({ params }) => {
    const { jobId } = params;
    
    // Simulate different job states
    const states = ['queued', 'processing', 'completed'];
    const currentState = states[Math.min(2, Math.floor(Date.now() / 1000) % 3)];

    const baseResponse = {
      jobId,
      status: currentState,
      progress: currentState === 'completed' ? 100 : Math.floor(Math.random() * 80) + 10,
      updatedAt: new Date().toISOString()
    };

    if (currentState === 'completed') {
      return HttpResponse.json({
        success: true,
        data: {
          ...baseResponse,
          results: generateSentimentResults(100),
          completedAt: new Date().toISOString()
        }
      });
    }

    return HttpResponse.json({
      success: true,
      data: baseResponse
    });
  }),

  // Results export
  http.post('http://localhost:3001/api/export', async ({ request }) => {
    const body = await request.json() as any;
    const { jobId, format } = body;

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return HttpResponse.json({
      success: true,
      data: {
        exportId: `export_${Date.now()}`,
        jobId,
        format,
        downloadUrl: `/api/download/export_${Date.now()}.${format}`,
        expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
      }
    });
  }),

  // Security/DataCloak endpoints
  http.post('http://localhost:3001/api/security/scan', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      success: true,
      data: {
        scanId: `scan_${Date.now()}`,
        piiDetected: ['email', 'phone', 'name'],
        riskLevel: 'medium',
        compliance: {
          gdpr: 0.95,
          ccpa: 0.88,
          hipaa: 0.75
        }
      }
    });
  }),

  http.post('http://localhost:3001/api/security/mask', async ({ request }) => {
    const body = await request.json() as any;

    return HttpResponse.json({
      success: true,
      data: {
        maskedFileId: `masked_${body.fileId}`,
        fieldsProcessed: body.fields?.length || 0,
        maskedAt: new Date().toISOString()
      }
    });
  }),

  // Error simulation endpoints
  http.post('http://localhost:3001/api/simulate-error', () => {
    return HttpResponse.json(
      { error: { message: 'Simulated server error', code: 'INTERNAL_ERROR' } },
      { status: 500 }
    );
  })
];

export const createBackendMockServer = () => {
  return setupServer(...backendHandlers);
};