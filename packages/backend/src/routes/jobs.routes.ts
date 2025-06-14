import express from 'express';
import { JobController } from '../controllers/job.controller';
import { validateRequest } from '../middleware/validation.middleware';
import * as jobSchemas from '../validation/job.schemas';

const router = express.Router();
const jobController = new JobController();

// Queue a new job
router.post('/', 
  validateRequest(jobSchemas.createJob), 
  jobController.createJob.bind(jobController)
);

// Get job by ID
router.get('/:jobId', 
  validateRequest(jobSchemas.getJob), 
  jobController.getJob.bind(jobController)
);

// Get all jobs with filtering
router.get('/', 
  validateRequest(jobSchemas.getJobs), 
  jobController.getJobs.bind(jobController)
);

// Cancel a job
router.delete('/:jobId', 
  validateRequest(jobSchemas.cancelJob), 
  jobController.cancelJob.bind(jobController)
);

// Get queue statistics
router.get('/stats/summary', 
  jobController.getStats.bind(jobController)
);

// Wait for job completion (with timeout)
router.post('/:jobId/wait', 
  validateRequest(jobSchemas.waitForJob), 
  jobController.waitForJob.bind(jobController)
);

export default router;