#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '..', 'docs');
const TASKS_DIR = path.join(DOCS_DIR, 'tasks');
const STATUS_FILE = path.join(DOCS_DIR, 'STATUS.md');

class TaskStatusMonitor {
  constructor(options = {}) {
    this.options = {
      terminal: options.terminal || null,
      verbose: options.verbose || false,
      format: options.format || 'table' // table, json, markdown
    };
    
    this.terminals = {
      'T0': 'Project Setup & Coordination',
      'T1': 'Frontend Development',
      'T2': 'Backend API',
      'T3': 'Data Science & ML',
      'T4': 'Security & Privacy',
      'T5': 'DevOps & QA'
    };
  }

  log(message, level = 'info') {
    if (this.options.verbose || level !== 'info') {
      const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
      console.log(`${prefix} ${message}`);
    }
  }

  parseTaskFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return { total: 0, completed: 0, tasks: [] };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    const tasks = [];
    let total = 0;
    let completed = 0;
    
    for (const line of lines) {
      // Match task patterns: - [x] or - [ ]
      const taskMatch = line.match(/^[\s]*-\s*\[([ x])\]\s*(.+)$/);
      if (taskMatch) {
        const isCompleted = taskMatch[1] === 'x';
        const taskText = taskMatch[2].trim();
        
        tasks.push({
          text: taskText,
          completed: isCompleted,
          line: line.trim()
        });
        
        total++;
        if (isCompleted) {
          completed++;
        }
      }
    }
    
    return { total, completed, tasks };
  }

  parseStatusFile() {
    if (!fs.existsSync(STATUS_FILE)) {
      this.log('STATUS.md file not found', 'warn');
      return {};
    }

    const content = fs.readFileSync(STATUS_FILE, 'utf8');
    const terminalStatus = {};
    
    const lines = content.split('\n');
    let currentTerminal = null;
    
    for (const line of lines) {
      // Match terminal headers: ### Terminal X: Name [TAGS]
      const terminalMatch = line.match(/^### Terminal (\d+): (.+?) \[(.+?)\]/);
      if (terminalMatch) {
        currentTerminal = `T${terminalMatch[1]}`;
        terminalStatus[currentTerminal] = {
          name: terminalMatch[2],
          tags: terminalMatch[3],
          progress: 0,
          tasks: '',
          blockers: ''
        };
      }
      
      // Match progress lines
      const progressMatch = line.match(/^- \*\*Progress\*\*: (\d+)%/);
      if (progressMatch && currentTerminal) {
        terminalStatus[currentTerminal].progress = parseInt(progressMatch[1]);
      }
      
      // Match current tasks
      const tasksMatch = line.match(/^- \*\*Current Tasks\*\*: (.+)/);
      if (tasksMatch && currentTerminal) {
        terminalStatus[currentTerminal].tasks = tasksMatch[1];
      }
      
      // Match blockers
      const blockersMatch = line.match(/^- \*\*Blockers\*\*: (.+)/);
      if (blockersMatch && currentTerminal) {
        terminalStatus[currentTerminal].blockers = blockersMatch[1];
      }
    }
    
    return terminalStatus;
  }

  generateTaskReport() {
    const statusData = this.parseStatusFile();
    const report = {
      timestamp: new Date().toISOString(),
      terminals: {},
      summary: {
        totalProgress: 0,
        completedTerminals: 0,
        blockedTerminals: 0
      }
    };

    // Process each terminal
    for (const [terminalId, terminalName] of Object.entries(this.terminals)) {
      const taskFile = path.join(TASKS_DIR, `${terminalId}_TASKS.md`);
      const taskData = this.parseTaskFile(taskFile);
      const statusInfo = statusData[terminalId] || {};
      
      const terminalReport = {
        id: terminalId,
        name: terminalName,
        progress: statusInfo.progress || 0,
        tasks: {
          total: taskData.total,
          completed: taskData.completed,
          percentage: taskData.total > 0 ? Math.round((taskData.completed / taskData.total) * 100) : 0
        },
        status: statusInfo.tasks || 'Not started',
        blockers: statusInfo.blockers || 'None',
        tags: statusInfo.tags || '',
        recentTasks: taskData.tasks.slice(-5) // Last 5 tasks
      };
      
      report.terminals[terminalId] = terminalReport;
      
      // Update summary
      report.summary.totalProgress += terminalReport.progress;
      if (terminalReport.progress >= 100) {
        report.summary.completedTerminals++;
      }
      if (terminalReport.blockers !== 'None') {
        report.summary.blockedTerminals++;
      }
    }
    
    report.summary.averageProgress = Math.round(report.summary.totalProgress / Object.keys(this.terminals).length);
    
    return report;
  }

  formatTableOutput(report) {
    const lines = [
      '='.repeat(120),
      'TASK STATUS REPORT',
      '='.repeat(120),
      `Generated: ${new Date(report.timestamp).toLocaleString()}`,
      `Overall Progress: ${report.summary.averageProgress}% | Completed: ${report.summary.completedTerminals}/6 | Blocked: ${report.summary.blockedTerminals}`,
      '',
      'Terminal'.padEnd(25) + 'Progress'.padEnd(10) + 'Tasks'.padEnd(15) + 'Status'.padEnd(50) + 'Blockers',
      '-'.repeat(120)
    ];

    for (const [terminalId, data] of Object.entries(report.terminals)) {
      const terminal = `${terminalId} ${data.name}`.padEnd(25);
      const progress = `${data.progress}%`.padEnd(10);
      const tasks = `${data.tasks.completed}/${data.tasks.total}`.padEnd(15);
      const status = data.status.length > 45 ? data.status.substring(0, 42) + '...' : data.status.padEnd(50);
      const blockers = data.blockers === 'None' ? '✅' : '⚠️  ' + data.blockers;
      
      lines.push(terminal + progress + tasks + status + blockers);
    }

    lines.push('', '='.repeat(120));
    
    return lines.join('\n');
  }

  formatMarkdownOutput(report) {
    const lines = [
      '# Task Status Report',
      `*Generated: ${new Date(report.timestamp).toLocaleString()}*`,
      '',
      `## Summary`,
      `- **Overall Progress**: ${report.summary.averageProgress}%`,
      `- **Completed Terminals**: ${report.summary.completedTerminals}/6`,
      `- **Blocked Terminals**: ${report.summary.blockedTerminals}`,
      '',
      '## Terminal Status',
      '',
      '| Terminal | Progress | Tasks | Status | Blockers |',
      '|----------|----------|-------|--------|----------|'
    ];

    for (const [terminalId, data] of Object.entries(report.terminals)) {
      const terminal = `${terminalId} ${data.name}`;
      const progress = `${data.progress}%`;
      const tasks = `${data.tasks.completed}/${data.tasks.total}`;
      const status = data.status.length > 40 ? data.status.substring(0, 37) + '...' : data.status;
      const blockers = data.blockers === 'None' ? '✅ None' : `⚠️ ${data.blockers}`;
      
      lines.push(`| ${terminal} | ${progress} | ${tasks} | ${status} | ${blockers} |`);
    }

    return lines.join('\n');
  }

  async generateReport() {
    const report = this.generateTaskReport();
    
    // Filter by terminal if specified
    if (this.options.terminal) {
      const terminalData = report.terminals[this.options.terminal];
      if (!terminalData) {
        this.log(`Terminal ${this.options.terminal} not found`, 'error');
        return null;
      }
      
      report.terminals = { [this.options.terminal]: terminalData };
    }

    // Format output
    let output;
    switch (this.options.format) {
      case 'json':
        output = JSON.stringify(report, null, 2);
        break;
      case 'markdown':
        output = this.formatMarkdownOutput(report);
        break;
      case 'table':
      default:
        output = this.formatTableOutput(report);
        break;
    }

    console.log(output);
    
    // Save report
    const reportsDir = path.join(__dirname, '..', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const reportFile = path.join(reportsDir, `task-status-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`Report saved to: ${reportFile}`);
    
    return report;
  }
}

// CLI interface
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--terminal':
        options.terminal = args[++i];
        break;
      case '--format':
        options.format = args[++i];
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--all':
        // Default behavior, show all terminals
        break;
      case '--help':
        console.log(`
Task Status Monitor - Track progress across all terminals

Usage: node task-status.js [options]

Options:
  --terminal T1      Show status for specific terminal (T0-T5)
  --format FORMAT    Output format: table, json, markdown (default: table)
  --verbose          Show detailed output
  --all              Show all terminals (default)
  --help             Show this help message

Examples:
  node task-status.js --all
  node task-status.js --terminal T1
  node task-status.js --format json
  node task-status.js --terminal T2 --format markdown
        `);
        process.exit(0);
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  const monitor = new TaskStatusMonitor(options);
  
  try {
    await monitor.generateReport();
  } catch (error) {
    console.error('❌ Task status monitoring failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = TaskStatusMonitor;