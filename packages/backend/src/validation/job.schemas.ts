import Joi from 'joi';

export const createJob = {
  body: Joi.object({
    type: Joi.string()
      .valid('sentiment_analysis_batch', 'file_processing', 'security_scan', 'data_export')
      .required()
      .messages({
        'any.only': 'Job type must be one of: sentiment_analysis_batch, file_processing, security_scan, data_export',
        'any.required': 'Job type is required'
      }),
    
    data: Joi.object().required().messages({
      'any.required': 'Job data is required'
    }),
    
    priority: Joi.string()
      .valid('low', 'medium', 'high', 'critical')
      .default('medium')
      .messages({
        'any.only': 'Priority must be one of: low, medium, high, critical'
      })
  }).required()
};

export const getJob = {
  params: Joi.object({
    jobId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Job ID must be a valid UUID',
        'any.required': 'Job ID is required'
      })
  }).required()
};

export const getJobs = {
  query: Joi.object({
    status: Joi.string()
      .valid('pending', 'running', 'completed', 'failed', 'cancelled')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, running, completed, failed, cancelled'
      }),
    
    type: Joi.string()
      .valid('sentiment_analysis_batch', 'file_processing', 'security_scan', 'data_export')
      .optional()
      .messages({
        'any.only': 'Type must be one of: sentiment_analysis_batch, file_processing, security_scan, data_export'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(50)
      .optional()
      .messages({
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 100'
      })
  }).optional()
};

export const cancelJob = {
  params: Joi.object({
    jobId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Job ID must be a valid UUID',
        'any.required': 'Job ID is required'
      })
  }).required()
};

export const waitForJob = {
  params: Joi.object({
    jobId: Joi.string()
      .uuid()
      .required()
      .messages({
        'string.uuid': 'Job ID must be a valid UUID',
        'any.required': 'Job ID is required'
      })
  }).required(),
  
  body: Joi.object({
    timeout: Joi.number()
      .integer()
      .min(1000)
      .max(300000) // 5 minutes max
      .default(30000)
      .optional()
      .messages({
        'number.integer': 'Timeout must be an integer',
        'number.min': 'Timeout must be at least 1000ms (1 second)',
        'number.max': 'Timeout cannot exceed 300000ms (5 minutes)'
      })
  }).optional()
};