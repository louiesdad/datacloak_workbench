import express from 'express';
import { JobController } from '../controllers/job.controller';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware';
import * as jobSchemas from '../validation/job.schemas';

const router = express.Router();
const jobController = new JobController();

// Queue a new job
router.post('/', 
  validateBody(jobSchemas.createJob.body), 
  jobController.createJob.bind(jobController)
);

// Get job by ID
router.get('/:jobId', 
  validateParams(jobSchemas.getJob.params), 
  jobController.getJob.bind(jobController)
);

// Get detailed job progress
router.get('/:jobId/progress',
  validateParams(jobSchemas.getJob.params),
  jobController.getJobProgress.bind(jobController)
);

// Get job event timeline
router.get('/:jobId/events',
  validateParams(jobSchemas.getJob.params),
  jobController.getJobEvents.bind(jobController)
);

// Get all jobs with filtering
router.get('/', 
  validateQuery(jobSchemas.getJobs.query), 
  jobController.getJobs.bind(jobController)
);

// Cancel a job
router.delete('/:jobId', 
  validateParams(jobSchemas.cancelJob.params), 
  jobController.cancelJob.bind(jobController)
);

// Get queue statistics
router.get('/stats/summary', 
  jobController.getStats.bind(jobController)
);

// Wait for job completion (with timeout)
router.post('/:jobId/wait', 
  validateParams(jobSchemas.waitForJob.params),
  validateBody(jobSchemas.waitForJob.body),
  jobController.waitForJob.bind(jobController)
);

export default router;