// Override console.log to find where undefined is being printed
const originalLog = console.log;
console.log = function(...args) {
  if (args.length === 1 && args[0] === undefined) {
    console.trace('Found undefined log!');
  }
  originalLog.apply(console, args);
};

// Load the app
require('ts-node/register');
require('./src/server');