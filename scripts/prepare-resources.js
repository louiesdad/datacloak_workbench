#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_RESOURCES_DIR = path.join(__dirname, '..', 'build-resources');
const BINARIES_DIR = path.join(__dirname, '..', 'binaries');

class ResourcePreparer {
  constructor() {
    this.log('Initializing resource preparation...');
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      this.log(`Created directory: ${dir}`);
    }
  }

  async generateIcons() {
    this.log('Generating application icons...');
    
    this.ensureDir(BUILD_RESOURCES_DIR);
    
    // Create a simple SVG icon as base
    const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="256" height="256" rx="32" fill="url(#grad1)"/>
  
  <!-- Shield icon for security -->
  <g transform="translate(64, 48)">
    <path d="M64 0 C96 16 96 48 64 80 C32 48 32 16 64 0 Z" fill="white" opacity="0.9"/>
    <path d="M64 16 C80 24 80 40 64 56 C48 40 48 24 64 16 Z" fill="#2563eb"/>
  </g>
  
  <!-- Chart icon for analytics -->
  <g transform="translate(48, 128)">
    <rect x="0" y="32" width="16" height="32" fill="white" opacity="0.8"/>
    <rect x="24" y="16" width="16" height="48" fill="white" opacity="0.8"/>
    <rect x="48" y="8" width="16" height="56" fill="white" opacity="0.8"/>
    <rect x="72" y="24" width="16" height="40" fill="white" opacity="0.8"/>
    <rect x="96" y="0" width="16" height="64" fill="white" opacity="0.8"/>
    <rect x="120" y="40" width="16" height="24" fill="white" opacity="0.8"/>
    <rect x="144" y="20" width="16" height="44" fill="white" opacity="0.8"/>
  </g>
  
  <!-- Text -->
  <text x="128" y="220" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold">
    DataCloak
  </text>
</svg>`;

    const svgPath = path.join(BUILD_RESOURCES_DIR, 'icon.svg');
    fs.writeFileSync(svgPath, svgIcon);

    // For now, just copy the SVG as PNG placeholder
    // In a real build, you'd use a tool like sharp or ImageMagick to convert
    try {
      // Try to use ImageMagick if available
      execSync(`convert "${svgPath}" -resize 512x512 "${path.join(BUILD_RESOURCES_DIR, 'icon.png')}"`, { stdio: 'pipe' });
      execSync(`convert "${svgPath}" -resize 256x256 "${path.join(BUILD_RESOURCES_DIR, 'icon.ico')}"`, { stdio: 'pipe' });
      execSync(`convert "${svgPath}" -resize 512x512 "${path.join(BUILD_RESOURCES_DIR, 'icon.icns')}"`, { stdio: 'pipe' });
      this.log('Generated icons using ImageMagick');
    } catch (error) {
      // Fallback: create placeholder files
      this.log('ImageMagick not available, creating placeholder icons', 'warn');
      
      const placeholderIcon = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
      
      fs.writeFileSync(path.join(BUILD_RESOURCES_DIR, 'icon.png'), placeholderIcon);
      fs.writeFileSync(path.join(BUILD_RESOURCES_DIR, 'icon.ico'), placeholderIcon);
      fs.writeFileSync(path.join(BUILD_RESOURCES_DIR, 'icon.icns'), placeholderIcon);
    }
  }

  async prepareBinaries() {
    this.log('Preparing binary dependencies...');
    
    this.ensureDir(BINARIES_DIR);
    
    // Create placeholder for DataCloak binary
    // In real implementation, this would download or copy the actual binary
    const platforms = ['win32', 'darwin', 'linux'];
    
    for (const platform of platforms) {
      const platformDir = path.join(BINARIES_DIR, platform);
      this.ensureDir(platformDir);
      
      const binaryName = platform === 'win32' ? 'datacloak.exe' : 'datacloak';
      const binaryPath = path.join(platformDir, binaryName);
      
      // Create a mock binary placeholder
      const mockBinary = `#!/bin/bash
# Mock DataCloak binary for ${platform}
# This is a placeholder - replace with actual DataCloak binary
echo "Mock DataCloak binary for ${platform}"
echo "Args: $@"
exit 0
`;
      
      fs.writeFileSync(binaryPath, mockBinary);
      
      // Make executable on Unix systems
      if (platform !== 'win32') {
        try {
          execSync(`chmod +x "${binaryPath}"`);
        } catch (error) {
          this.log(`Could not make binary executable: ${error.message}`, 'warn');
        }
      }
    }
    
    this.log('Binary placeholders created (replace with actual DataCloak binaries)');
  }

  async validatePackageBuilds() {
    this.log('Validating package builds...');
    
    const requiredBuilds = [
      'packages/web-ui/dist',
      'packages/backend/dist',
      'packages/electron-shell/dist'
    ];
    
    let allBuildsExist = true;
    
    for (const buildPath of requiredBuilds) {
      const fullPath = path.join(__dirname, '..', buildPath);
      if (fs.existsSync(fullPath)) {
        this.log(`✅ ${buildPath}`);
      } else {
        this.log(`❌ ${buildPath} - Missing build output`, 'error');
        allBuildsExist = false;
      }
    }
    
    if (!allBuildsExist) {
      throw new Error('Some package builds are missing. Run npm run build:all first.');
    }
    
    this.log('All required builds are present');
  }

  async createAppMetadata() {
    this.log('Creating application metadata...');
    
    // Read package.json for version info
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    const metadata = {
      name: packageJson.name,
      productName: 'DataCloak Sentiment Workbench',
      version: packageJson.version,
      description: packageJson.description,
      author: packageJson.author,
      buildTime: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version
    };
    
    const metadataPath = path.join(BUILD_RESOURCES_DIR, 'app-metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    
    this.log(`Application metadata written to: ${metadataPath}`);
  }

  async optimizeAssets() {
    this.log('Optimizing assets...');
    
    // In a real implementation, this would:
    // - Compress images
    // - Minify additional assets
    // - Remove development files
    // - Optimize bundle sizes
    
    this.log('Asset optimization completed (placeholder)');
  }

  async run() {
    try {
      await this.validatePackageBuilds();
      await this.generateIcons();
      await this.prepareBinaries();
      await this.createAppMetadata();
      await this.optimizeAssets();
      
      this.log('Resource preparation completed successfully! 🎉');
      return true;
    } catch (error) {
      this.log(`Resource preparation failed: ${error.message}`, 'error');
      return false;
    }
  }
}

async function main() {
  const preparer = new ResourcePreparer();
  const success = await preparer.run();
  process.exit(success ? 0 : 1);
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = ResourcePreparer;