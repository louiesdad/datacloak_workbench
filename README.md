# Datacloak Sentiment Workbench

A comprehensive sentiment analysis workbench for processing and analyzing text data with privacy in mind.

## Project Structure

```
datacloak-sentiment-workbench/
├── docs/                   # Documentation
│   ├── prd/               # Product Requirements
│   ├── tasks/             # Task tracking
│   ├── api-contracts/     # API specifications
│   └── daily/             # Daily standups/updates
├── packages/              # Main code packages
│   ├── frontend/         # Frontend application
│   ├── backend/          # Backend services
│   ├── datascience/      # Data science models and processing
│   └── security/         # Security-related code
├── shared/               # Shared resources
│   ├── contracts/        # Shared TypeScript interfaces/types
│   └── test-fixtures/    # Test data and fixtures
└── .github/workflows/    # GitHub Actions workflows
```

## Getting Started

### Prerequisites

- Node.js (v16+)
- Python (3.8+)
- Docker (for containerized development)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/louiesdad/datacloak_workbench.git
   cd datacloak_workbench
   ```

2. Install dependencies:
   ```bash
   # Install root dependencies
   npm install
   
   # Install package dependencies
   cd packages/frontend && npm install
   cd ../backend && npm install
   # ... repeat for other packages
   ```

## Development

### Running the Application

1. Start the backend:
   ```bash
   cd packages/backend
   npm run dev
   ```

2. Start the frontend:
   ```bash
   cd packages/frontend
   npm run dev
   ```

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
