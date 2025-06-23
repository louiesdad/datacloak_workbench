import { Router } from 'express';
import { AutomationController } from '../controllers/automation.controller';
import { AutomationEngine } from '../services/automation-engine.service';
import { RuleEngine } from '../services/rule-engine.service';
import { ActionIntegrationService } from '../services/action-integration.service';
import { AutomationRulesSQLiteSchema } from '../database/schemas/automation-rules-sqlite.schema';
import { NotificationChannelsService } from '../services/notification-channels.service';
import { EventService } from '../services/event.service';
import { getSQLiteConnection } from '../database/sqlite-refactored';
import { asyncHandler } from '../middleware/validation.middleware';

const router = Router();

// Initialize services (in a real app, this would be done via dependency injection)
let automationController: AutomationController;

const initializeAutomationController = async () => {
  if (!automationController) {
    const db = await getSQLiteConnection();
    const schema = new AutomationRulesSQLiteSchema(db);
    
    const ruleEngine = new RuleEngine();
    const notificationService = new NotificationChannelsService();
    const eventService = new EventService();
    const actionService = new ActionIntegrationService(notificationService, eventService);
    const automationEngine = new AutomationEngine(ruleEngine, actionService, schema);
    
    automationController = new AutomationController(automationEngine, schema);
  }
  return automationController;
};

// Middleware to ensure controller is initialized
const ensureController = async (req: any, res: any, next: any) => {
  try {
    req.automationController = await initializeAutomationController();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to initialize automation service'
    });
  }
};

// Apply middleware to all routes
router.use(ensureController);

// Rule CRUD operations
router.post('/rules', asyncHandler(async (req, res) => {
  await req.automationController.createRule(req, res);
}));

router.get('/rules', asyncHandler(async (req, res) => {
  await req.automationController.getAllRules(req, res);
}));

router.get('/rules/:id', asyncHandler(async (req, res) => {
  await req.automationController.getRule(req, res);
}));

router.put('/rules/:id', asyncHandler(async (req, res) => {
  await req.automationController.updateRule(req, res);
}));

router.delete('/rules/:id', asyncHandler(async (req, res) => {
  await req.automationController.deleteRule(req, res);
}));

// Rule management operations
router.post('/rules/:id/activate', asyncHandler(async (req, res) => {
  await req.automationController.activateRule(req, res);
}));

router.post('/rules/:id/deactivate', asyncHandler(async (req, res) => {
  await req.automationController.deactivateRule(req, res);
}));

router.post('/rules/:id/test', asyncHandler(async (req, res) => {
  await req.automationController.testRule(req, res);
}));

// Rule monitoring and statistics
router.get('/rules/:id/statistics', asyncHandler(async (req, res) => {
  await req.automationController.getRuleStatistics(req, res);
}));

router.get('/rules/:id/executions', asyncHandler(async (req, res) => {
  await req.automationController.getRuleExecutions(req, res);
}));

// Evaluation endpoints
router.post('/evaluate', asyncHandler(async (req, res) => {
  await req.automationController.evaluateCustomer(req, res);
}));

// Health check for automation service
router.get('/health', asyncHandler(async (req, res) => {
  try {
    const controller = await initializeAutomationController();
    const activeRulesCount = await controller.automationEngine?.getActiveRulesCount() || 0;
    
    res.json({
      success: true,
      status: 'healthy',
      activeRules: activeRulesCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;