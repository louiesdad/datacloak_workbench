const { version } = require('./package.json');

module.exports = {
  appId: 'com.datacloak.sentiment-workbench',
  productName: 'DataCloak Sentiment Workbench',
  copyright: `Copyright © ${new Date().getFullYear()} DataCloak`,
  
  directories: {
    buildResources: 'build-resources',
    output: 'dist'
  },

  files: [
    'packages/electron-shell/dist/**/*',
    'packages/web-ui/dist/**/*',
    'packages/backend/dist/**/*',
    'node_modules/**/*',
    '!node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
    '!node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
    '!node_modules/*.d.ts',
    '!node_modules/.bin',
    '!**/*.{iml,o,hprof,orig,pyc,pyo,rbc,swp,csproj,sln,xproj}',
    '!.editorconfig',
    '!**/._*',
    '!**/{.DS_Store,.git,.hg,.svn,CVS,RCS,SCCS,.gitignore,.gitattributes}',
    '!**/{__pycache__,thumbs.db,.flowconfig,.idea,.vs,.nyc_output}',
    '!**/{appveyor.yml,.travis.yml,circle.yml}',
    '!**/{npm-debug.log,yarn.lock,.yarn-integrity,.yarn-metadata.json}'
  ],

  extraResources: [
    {
      from: 'binaries/',
      to: 'binaries/',
      filter: ['**/*']
    }
  ],

  // Auto-updater configuration
  publish: {
    provider: 'github',
    owner: 'datacloak',
    repo: 'sentiment-workbench'
  },

  // macOS configuration
  mac: {
    category: 'public.app-category.business',
    icon: 'build-resources/icon.icns',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build-resources/entitlements.mac.plist',
    entitlementsInherit: 'build-resources/entitlements.mac.plist',
    notarize: {
      teamId: process.env.APPLE_TEAM_ID
    },
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64']
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64']
      }
    ]
  },

  dmg: {
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },

  // Windows configuration
  win: {
    icon: 'build-resources/icon.ico',
    publisherName: 'DataCloak Inc.',
    verifyUpdateCodeSignature: true,
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'ia32']
      },
      {
        target: 'portable',
        arch: ['x64']
      }
    ]
  },

  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'DataCloak Sentiment Workbench'
  },

  // Linux configuration
  linux: {
    icon: 'build-resources/icon.png',
    category: 'Office',
    desktop: {
      StartupNotify: 'true',
      Encoding: 'UTF-8',
      MimeType: 'text/csv;application/vnd.ms-excel'
    },
    target: [
      {
        target: 'AppImage',
        arch: ['x64']
      },
      {
        target: 'deb',
        arch: ['x64']
      },
      {
        target: 'rpm',
        arch: ['x64']
      }
    ]
  },

  // Security configuration
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,
  npmRebuild: false,

  // Performance optimization
  compression: 'maximum',
  
  // Signing configuration will be handled by environment variables
  // CSC_LINK, CSC_KEY_PASSWORD for Windows
  // APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID for macOS

  beforeBuild: async (context) => {
    console.log('Running pre-build checks...');
    
    // Verify all required packages are built
    const fs = require('fs');
    const path = require('path');
    
    const requiredDirs = [
      'packages/web-ui/dist',
      'packages/backend/dist',
      'packages/electron-shell/dist'
    ];
    
    for (const dir of requiredDirs) {
      if (!fs.existsSync(path.join(context.projectDir, dir))) {
        throw new Error(`Required build directory missing: ${dir}`);
      }
    }
    
    console.log('Pre-build checks passed');
  },

  afterPack: async (context) => {
    console.log('Post-pack processing...');
    
    // Add any post-pack processing here
    // e.g., copying additional files, setting permissions
    
    console.log('Post-pack processing completed');
  }
};