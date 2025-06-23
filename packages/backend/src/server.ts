import './console-override'; // Must be first to override console.log

// Add global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
import { createApp } from './app';
import { config } from './config/env';
import { initializeDatabases } from './database';
import { websocketService } from './services/websocket.service';
import { realTimeSentimentFeedService } from './services/realtime-sentiment-feed.service';
import { analyticsService } from './services/analytics.service';
import { insightsService } from './services/insights.service';
import { connectionStatusService } from './services/connection-status.service';
import { analysisAuditService } from './services/analysis-audit.service';

const startServer = async () => {
  try {
    console.log('Starting server initialization...');
    
    // Initialize databases
    console.log('Initializing databases...');
    await initializeDatabases();
    console.log('Databases initialized successfully');

    // Create Express app
    console.log('Creating Express app...');
    const app = await createApp();
    console.log('Express app created successfully');

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
      
      // Initialize WebSocket server
      websocketService.initialize(server);
      console.log('WebSocket server initialized on /ws');
      
      // Initialize real-time sentiment feed
      realTimeSentimentFeedService.initialize();
      console.log('Real-time sentiment feed service initialized');
      
      // Initialize analytics services (async)
      Promise.all([
        analyticsService.initialize(),
        insightsService.initialize()
      ]).then(() => {
        console.log('Analytics and insights services initialized');
      }).catch(error => {
        console.error('Failed to initialize analytics services:', error);
      });
      
      // Initialize analysis audit service for transparency
      console.log('Analysis audit service initialized for decision transparency');
      
      // Initialize connection status service
      connectionStatusService.initialize();
      console.log('Connection status service initialized');
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('Received shutdown signal, closing server...');
      
      // Shutdown services
      connectionStatusService.shutdown();
      realTimeSentimentFeedService.shutdown();
      websocketService.shutdown();
      
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exit(1);
});