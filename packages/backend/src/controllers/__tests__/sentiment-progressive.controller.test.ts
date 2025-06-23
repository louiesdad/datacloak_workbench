import { Request, Response } from 'express';
import { SentimentController } from '../sentiment.controller';

// Mock the services
jest.mock('../../services/sentiment.service');
jest.mock('../../services/cost-estimation.service');

describe('SentimentController - Progressive Methods', () => {
  let controller: SentimentController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    controller = new SentimentController();
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    
    mockRequest = {
      body: {},
      params: {}
    };
    
    mockResponse = {
      json: jsonMock,
      status: statusMock
    };
  });

  describe('analyzePreview', () => {
    test('should process preview within 5 minutes', async () => {
      mockRequest.body = {
        texts: ['Sample text 1', 'Sample text 2'],
        fields: ['feedback']
      };

      await controller.analyzePreview(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            preview: true,
            rowsAnalyzed: 2,
            results: expect.any(Array),
            timeElapsed: expect.any(Number)
          })
        })
      );
      
      const responseData = jsonMock.mock.calls[0][0].data;
      expect(responseData.timeElapsed).toBeLessThan(300000); // 5 minutes
    });
  });

  describe('getAnalysisProgress', () => {
    test('should return job progress information', async () => {
      // First create a job via preview
      mockRequest.body = {
        texts: ['Sample text 1', 'Sample text 2'],
        fields: ['feedback']
      };

      await controller.analyzePreview(mockRequest as Request, mockResponse as Response);

      // Get the jobId from the response
      const previewResponse = jsonMock.mock.calls[0][0];
      const jobId = previewResponse.data.jobId;

      // Now test progress endpoint
      mockRequest.params = { jobId };
      jest.clearAllMocks();

      await controller.getAnalysisProgress(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            jobId,
            status: expect.any(String),
            progress: expect.any(Number),
            rowsProcessed: expect.any(Number),
            totalRows: expect.any(Number)
          })
        })
      );
    });
  });

  describe('analyzeSample', () => {
    test('should analyze statistical sample', async () => {
      mockRequest.body = {
        texts: Array(100).fill('Sample text'),
        fields: ['feedback', 'comments'],
        sampleSize: 10000
      };

      await controller.analyzeSample(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sample: true,
            sampleSize: expect.any(Number),
            confidence: expect.any(Number),
            results: expect.any(Array),
            timeElapsed: expect.any(Number)
          })
        })
      );
      
      const responseData = jsonMock.mock.calls[0][0].data;
      expect(responseData.timeElapsed).toBeLessThan(1800000); // 30 minutes
    });
  });
});