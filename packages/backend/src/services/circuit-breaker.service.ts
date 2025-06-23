/**
 * Circuit Breaker Pattern Implementation
 * 
 * Provides fault tolerance for external service calls by:
 * - Preventing cascading failures
 * - Failing fast when services are down
 * - Automatically recovering when services are back
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests fail immediately
 * - HALF_OPEN: Testing if service has recovered
 */

import { AppError } from '../middleware/error.middleware';
import logger from '../config/logger';

export interface CircuitBreakerOptions {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes in half-open before closing
  timeout: number;               // Timeout for each request (ms)
  resetTimeout: number;          // Time to wait before half-open (ms)
  volumeThreshold: number;       // Minimum requests before calculating failure rate
  errorThresholdPercentage: number; // Error percentage to open circuit
  fallbackFunction?: () => Promise<any>; // Optional fallback when circuit is open
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export interface CircuitBreakerMetrics {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  lastSuccessTime?: Date;
  totalRequests: number;
  errorPercentage: number;
  nextAttempt?: Date;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime?: Date;
  private lastSuccessTime?: Date;
  private nextAttempt?: Date;
  private requestCount = 0;
  private errorCount = 0;
  private windowStart = Date.now();
  private readonly windowSize = 60000; // 1 minute rolling window

  constructor(
    private readonly name: string,
    private readonly options: CircuitBreakerOptions
  ) {
    // Set default options
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      successThreshold: options.successThreshold ?? 2,
      timeout: options.timeout ?? 3000,
      resetTimeout: options.resetTimeout ?? 60000,
      volumeThreshold: options.volumeThreshold ?? 10,
      errorThresholdPercentage: options.errorThresholdPercentage ?? 50
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.canAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        return this.handleOpenCircuit();
      }
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AppError('Circuit breaker timeout', 503, 'CIRCUIT_BREAKER_TIMEOUT'));
      }, this.options.timeout);

      fn()
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Record successful execution
   */
  private recordSuccess(): void {
    this.failures = 0;
    this.successes++;
    this.lastSuccessTime = new Date();
    this.updateMetrics(true);

    if (this.state === CircuitState.HALF_OPEN) {
      if (this.successes >= this.options.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Record failed execution
   */
  private recordFailure(): void {
    this.failures++;
    this.successes = 0;
    this.lastFailureTime = new Date();
    this.updateMetrics(false);

    if (this.state === CircuitState.HALF_OPEN || 
        (this.state === CircuitState.CLOSED && this.shouldOpen())) {
      this.transitionToOpen();
    }
  }

  /**
   * Update rolling window metrics
   */
  private updateMetrics(success: boolean): void {
    const now = Date.now();
    
    // Reset window if expired
    if (now - this.windowStart > this.windowSize) {
      this.windowStart = now;
      this.requestCount = 0;
      this.errorCount = 0;
    }

    this.requestCount++;
    if (!success) {
      this.errorCount++;
    }
  }

  /**
   * Check if circuit should open based on failure conditions
   */
  private shouldOpen(): boolean {
    // Check consecutive failures
    if (this.failures >= this.options.failureThreshold) {
      return true;
    }

    // Check error percentage in rolling window
    if (this.requestCount >= this.options.volumeThreshold) {
      const errorPercentage = (this.errorCount / this.requestCount) * 100;
      return errorPercentage >= this.options.errorThresholdPercentage;
    }

    return false;
  }

  /**
   * Check if we can attempt to reset the circuit
   */
  private canAttemptReset(): boolean {
    return this.nextAttempt !== undefined && Date.now() >= this.nextAttempt.getTime();
  }

  /**
   * Handle open circuit
   */
  private async handleOpenCircuit(): Promise<any> {
    const error = new AppError(
      `Circuit breaker is OPEN for ${this.name}`,
      503,
      'CIRCUIT_BREAKER_OPEN'
    );

    // Use fallback if available
    if (this.options.fallbackFunction) {
      logger.info(`Circuit breaker ${this.name} using fallback function`);
      return this.options.fallbackFunction();
    }

    throw error;
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = undefined;
    logger.info(`Circuit breaker ${this.name} transitioned to CLOSED`);
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = new Date(Date.now() + this.options.resetTimeout);
    logger.warn(`Circuit breaker ${this.name} transitioned to OPEN. Next attempt at ${this.nextAttempt}`);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successes = 0;
    this.failures = 0;
    logger.info(`Circuit breaker ${this.name} transitioned to HALF_OPEN`);
  }

  /**
   * Get current circuit breaker metrics
   */
  getMetrics(): CircuitBreakerMetrics {
    const errorPercentage = this.requestCount > 0 
      ? (this.errorCount / this.requestCount) * 100 
      : 0;

    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.requestCount,
      errorPercentage,
      nextAttempt: this.nextAttempt
    };
  }

  /**
   * Force circuit to open (for testing/manual intervention)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to close (for testing/manual intervention)
   */
  forceClose(): void {
    this.transitionToClosed();
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.requestCount = 0;
    this.errorCount = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    this.nextAttempt = undefined;
    this.windowStart = Date.now();
  }
}

/**
 * Circuit Breaker Manager - Manages multiple circuit breakers
 */
export class CircuitBreakerManager {
  private static instance: CircuitBreakerManager;
  private breakers = new Map<string, CircuitBreaker>();

  private constructor() {}

  static getInstance(): CircuitBreakerManager {
    if (!this.instance) {
      this.instance = new CircuitBreakerManager();
    }
    return this.instance;
  }

  /**
   * Get or create a circuit breaker
   */
  getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      const defaultOptions: CircuitBreakerOptions = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 3000,
        resetTimeout: 60000,
        volumeThreshold: 10,
        errorThresholdPercentage: 50,
        ...options
      };
      this.breakers.set(name, new CircuitBreaker(name, defaultOptions));
    }
    return this.breakers.get(name)!;
  }

  /**
   * Get all circuit breaker metrics
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }

  /**
   * Remove a circuit breaker
   */
  removeBreaker(name: string): void {
    this.breakers.delete(name);
  }
}

/**
 * Decorator for applying circuit breaker to class methods
 */
export function WithCircuitBreaker(
  name: string,
  options?: Partial<CircuitBreakerOptions>
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const manager = CircuitBreakerManager.getInstance();

    descriptor.value = async function (...args: any[]) {
      const breaker = manager.getBreaker(`${name}.${propertyKey}`, options);
      return breaker.execute(() => originalMethod.apply(this, args));
    };

    return descriptor;
  };
}

// Export singleton instance
export const circuitBreakerManager = CircuitBreakerManager.getInstance();