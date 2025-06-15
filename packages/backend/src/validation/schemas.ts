import Joi from 'joi';

export const sentimentAnalysisSchema = Joi.object({
  text: Joi.string().trim().min(1).max(10000).required().messages({
    'string.empty': 'Text cannot be empty',
    'string.min': 'Text must be at least 1 character long',
    'string.max': 'Text cannot exceed 10,000 characters',
    'any.required': 'Text is required',
  }),
});

export const batchSentimentAnalysisSchema = Joi.object({
  texts: Joi.array()
    .items(Joi.string().trim().min(1).max(10000))
    .min(1)
    .max(1000)
    .required()
    .messages({
      'array.min': 'At least one text is required',
      'array.max': 'Cannot process more than 1000 texts in a single batch',
      'any.required': 'Texts array is required',
    }),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
});

export const exportDataSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'xlsx').required().messages({
    'any.only': 'Format must be one of: csv, json, xlsx',
    'any.required': 'Format is required',
  }),
  datasetId: Joi.string().uuid().optional(),
  dateRange: Joi.object({
    start: Joi.date().iso().optional(),
    end: Joi.date().iso().min(Joi.ref('start')).optional(),
  }).optional(),
  sentimentFilter: Joi.string().valid('positive', 'negative', 'neutral').optional(),
});

export const datasetIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid dataset ID format',
    'any.required': 'Dataset ID is required',
  }),
});

// Security validation schemas
export const securitySchemas = {
  detectPII: Joi.object({
    text: Joi.string().trim().min(1).max(50000).required().messages({
      'string.empty': 'Text cannot be empty',
      'string.min': 'Text must be at least 1 character long',
      'string.max': 'Text cannot exceed 50,000 characters',
      'any.required': 'Text is required for PII detection',
    }),
  }),

  maskText: Joi.object({
    text: Joi.string().trim().min(1).max(50000).required().messages({
      'string.empty': 'Text cannot be empty',
      'string.min': 'Text must be at least 1 character long',
      'string.max': 'Text cannot exceed 50,000 characters',
      'any.required': 'Text is required for masking',
    }),
    options: Joi.object({
      preserveFormat: Joi.boolean().default(true),
      maskChar: Joi.string().length(1).default('*'),
      partialMasking: Joi.boolean().default(true),
    }).optional(),
  }),

  auditFile: Joi.object({
    filePath: Joi.string().trim().min(1).max(1000).required().messages({
      'string.empty': 'File path cannot be empty',
      'string.min': 'File path must be at least 1 character long',
      'string.max': 'File path cannot exceed 1000 characters',
      'any.required': 'File path is required for audit',
    }),
  }),

  scanDataset: Joi.object({
    datasetId: Joi.string().uuid().required().messages({
      'string.guid': 'Invalid dataset ID format',
      'any.required': 'Dataset ID is required',
    }),
    filePath: Joi.string().trim().min(1).max(1000).required().messages({
      'string.empty': 'File path cannot be empty',
      'string.min': 'File path must be at least 1 character long', 
      'string.max': 'File path cannot exceed 1000 characters',
      'any.required': 'File path is required for dataset scan',
    }),
  }),
};