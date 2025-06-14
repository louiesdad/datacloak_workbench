import { createApp } from './app';
import { config } from './config/env';
import { initializeDatabases } from './database';

const startServer = async () => {
  try {
    // Initialize databases
    await initializeDatabases();

    // Create Express app
    const app = createApp();

    // Start server
    const server = app.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });

    // Graceful shutdown
    const gracefulShutdown = () => {
      console.log('Received shutdown signal, closing server...');
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

startServer();