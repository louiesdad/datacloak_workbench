const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Create a copy of tests array
    const copyTests = [...tests];
    
    // Define test priority based on patterns
    const getPriority = (test) => {
      const path = test.path;
      
      // Unit tests first - they're usually faster and more isolated
      if (path.includes('__tests__') && !path.includes('integration') && !path.includes('e2e')) {
        return 1;
      }
      
      // Service tests
      if (path.includes('services') && path.includes('.test.')) {
        return 2;
      }
      
      // Database tests
      if (path.includes('database')) {
        return 3;
      }
      
      // Route tests
      if (path.includes('routes')) {
        return 4;
      }
      
      // Integration tests
      if (path.includes('integration')) {
        return 5;
      }
      
      // E2E tests last - they're usually slowest
      if (path.includes('e2e')) {
        return 6;
      }
      
      // Everything else
      return 3.5;
    };
    
    // Sort by priority, then by test path for deterministic order
    return copyTests.sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort by path for consistent ordering
      return a.path.localeCompare(b.path);
    });
  }
}

module.exports = CustomSequencer;