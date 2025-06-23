// Temporary override to find and suppress undefined console.log
const originalLog = console.log;
const originalError = console.error;

console.log = function(...args: any[]) {
  // Skip logging if the only argument is undefined
  if (args.length === 1 && args[0] === undefined) {
    // Don't log anything - just suppress the undefined
    return;
  }
  originalLog.apply(console, args);
};