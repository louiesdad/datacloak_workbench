import { Router, Request, Response } from 'express';
import { BusinessEventService } from '../services/business-event.service';

const router = Router();

// Define allowed event types and severities for validation
const ALLOWED_EVENT_TYPES = [
  'product_launch', 'system_outage', 'marketing_campaign',
  'policy_change', 'feature_rollout', 'data_migration',
  'security_incident', 'maintenance_window', 'external_event'
];

const ALLOWED_SEVERITIES = ['low', 'medium', 'high', 'critical', 'major'];

// Validation helper functions
function validateRequiredFields(data: any): { isValid: boolean; missingFields: string[] } {
  const requiredFields = ['name', 'type', 'startTime', 'severity'];
  const missingFields = requiredFields.filter(field => !data[field]);
  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}

function validateEventType(type: string): boolean {
  return ALLOWED_EVENT_TYPES.includes(type?.toLowerCase());
}

function validateSeverity(severity: string): boolean {
  return ALLOWED_SEVERITIES.includes(severity?.toLowerCase());
}

function validateDateRange(startTime: string, endTime?: string): { isValid: boolean; error?: string } {
  if (!startTime) {
    return { isValid: false, error: 'Start time is required' };
  }

  const start = new Date(startTime);
  if (isNaN(start.getTime())) {
    return { isValid: false, error: 'Invalid start time format' };
  }

  if (endTime) {
    const end = new Date(endTime);
    if (isNaN(end.getTime())) {
      return { isValid: false, error: 'Invalid end time format' };
    }
    
    if (end <= start) {
      return { isValid: false, error: 'End time must be after start time' };
    }
  }

  return { isValid: true };
}

function sanitizeInput(data: any): any {
  const sanitized = { ...data };
  
  // Trim whitespace from string fields
  if (sanitized.name) sanitized.name = sanitized.name.trim();
  if (sanitized.description) {
    // Basic XSS prevention - remove script tags
    sanitized.description = sanitized.description
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .trim();
  }
  
  // Normalize enum fields to lowercase
  if (sanitized.type) sanitized.type = sanitized.type.toLowerCase();
  if (sanitized.severity) sanitized.severity = sanitized.severity.toLowerCase();
  
  // Clean up arrays
  if (sanitized.affectedCustomerSegments) {
    sanitized.affectedCustomerSegments = sanitized.affectedCustomerSegments
      .map((segment: string) => segment?.trim()?.toLowerCase())
      .filter((segment: string) => segment && segment.length > 0);
  }
  
  // Clean up metadata
  if (sanitized.metadata) {
    const cleanedMetadata: any = {};
    for (const [key, value] of Object.entries(sanitized.metadata)) {
      if (value !== null && value !== undefined && value !== '') {
        cleanedMetadata[key] = value;
      }
    }
    sanitized.metadata = cleanedMetadata;
  }
  
  return sanitized;
}

function generateEventId(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = now.toISOString().slice(11, 19).replace(/:/g, '');
  const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `EVENT-${dateStr}-${timeStr}-${randomNum}`;
}

// POST /api/events/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const businessEventService = new BusinessEventService();
    
    // Validate required fields
    const { isValid, missingFields } = validateRequiredFields(req.body);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Missing required fields',
          details: {
            missing_fields: missingFields,
            provided_fields: Object.keys(req.body)
          }
        }
      });
    }

    // Validate event type
    if (!validateEventType(req.body.type)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid event type',
          details: {
            provided_type: req.body.type,
            allowed_types: ALLOWED_EVENT_TYPES
          }
        }
      });
    }

    // Validate severity
    if (!validateSeverity(req.body.severity)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid severity level',
          details: {
            provided_severity: req.body.severity,
            allowed_severities: ALLOWED_SEVERITIES
          }
        }
      });
    }

    // Validate date range
    const dateValidation = validateDateRange(req.body.startTime, req.body.endTime);
    if (!dateValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid date range',
          details: {
            issue: dateValidation.error,
            start_time: req.body.startTime,
            end_time: req.body.endTime
          }
        }
      });
    }

    // Sanitize input
    const sanitizedData = sanitizeInput(req.body);
    
    // Generate ID if not provided
    if (!sanitizedData.id) {
      sanitizedData.id = generateEventId();
    }

    // Create event
    const createdEvent = await businessEventService.createEvent(sanitizedData);

    res.status(201).json({
      success: true,
      data: {
        event: createdEvent,
        eventId: createdEvent.id
      },
      message: 'Event registered successfully'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to register event',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

// PUT /api/events/:eventId/update
router.put('/:eventId/update', async (req: Request, res: Response) => {
  try {
    const businessEventService = new BusinessEventService();
    const { eventId } = req.params;

    // Validate update data (similar to registration but optional fields)
    if (req.body.type && !validateEventType(req.body.type)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid event type',
          details: {
            provided_type: req.body.type,
            allowed_types: ALLOWED_EVENT_TYPES
          }
        }
      });
    }

    if (req.body.severity && !validateSeverity(req.body.severity)) {
      return res.status(400).json({
        success: false,
        error: {
          type: 'validation_error',
          message: 'Invalid severity level',
          details: {
            provided_severity: req.body.severity,
            allowed_severities: ALLOWED_SEVERITIES
          }
        }
      });
    }

    if (req.body.startTime || req.body.endTime) {
      const dateValidation = validateDateRange(req.body.startTime, req.body.endTime);
      if (!dateValidation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            type: 'validation_error',
            message: 'Invalid date range',
            details: {
              issue: dateValidation.error,
              start_time: req.body.startTime,
              end_time: req.body.endTime
            }
          }
        });
      }
    }

    // Sanitize input
    const sanitizedData = sanitizeInput(req.body);

    // Update event
    const updatedEvent = await businessEventService.updateEvent(eventId, sanitizedData);

    res.status(200).json({
      success: true,
      data: {
        event: updatedEvent
      },
      message: 'Event updated successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: req.params.eventId
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to update event',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    }
  }
});

// DELETE /api/events/:eventId
router.delete('/:eventId', async (req: Request, res: Response) => {
  try {
    const businessEventService = new BusinessEventService();
    const { eventId } = req.params;

    const result = await businessEventService.deleteEvent(eventId);

    res.status(200).json({
      success: true,
      data: {
        deleted: true,
        eventId
      },
      message: 'Event deleted successfully'
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: req.params.eventId
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to delete event',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    }
  }
});

// GET /api/events/:eventId
router.get('/:eventId', async (req: Request, res: Response) => {
  try {
    const businessEventService = new BusinessEventService();
    const { eventId } = req.params;

    const event = await businessEventService.getEvent(eventId);

    res.status(200).json({
      success: true,
      data: {
        event
      }
    });

  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        error: {
          type: 'not_found',
          message: 'Event not found',
          details: {
            event_id: req.params.eventId
          }
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          type: 'internal_error',
          message: 'Failed to retrieve event',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }
      });
    }
  }
});

// GET /api/events
router.get('/', async (req: Request, res: Response) => {
  try {
    const businessEventService = new BusinessEventService();
    const { type, startDate, endDate, page = 1, limit = 50 } = req.query;

    let events: any[];

    if (type) {
      events = await businessEventService.getEventsByType(type as string);
    } else if (startDate && endDate) {
      events = await businessEventService.getEventsByTimeRange(
        new Date(startDate as string),
        new Date(endDate as string)
      );
    } else {
      events = await businessEventService.getAllEvents();
    }

    // Simple pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const total = events.length;
    const hasNext = pageNum * limitNum < total;
    const hasPrev = pageNum > 1;

    res.status(200).json({
      success: true,
      data: {
        events,
        count: events.length,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          hasNext,
          hasPrev
        }
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        type: 'internal_error',
        message: 'Failed to retrieve events',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    });
  }
});

export { router as eventRegistrationRouter };