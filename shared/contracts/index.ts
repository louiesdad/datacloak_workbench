/**
 * Shared Contracts - Entry Point
 * 
 * Re-exports all contract types and interfaces for easy importing
 */

// API Contracts
export * from './api';

// Event Contracts (for IPC between Electron main/renderer)
export * from './events';

// Platform Contracts (for platform-bridge abstraction)
export * from './platform';