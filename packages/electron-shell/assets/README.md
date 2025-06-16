# Electron Shell Assets

This directory contains assets for the Electron shell application.

## Tray Icon

The tray icon should be placed here as `tray-icon.png`. Requirements:
- Format: PNG with transparency
- Size: 16x16 pixels (Windows/Linux) or 22x22 pixels (macOS)
- High DPI: Provide @2x and @3x versions for retina displays

Example files:
- `tray-icon.png` - Standard resolution
- `tray-icon@2x.png` - 2x resolution for retina
- `tray-icon@3x.png` - 3x resolution for high DPI

The application will create a programmatic icon if the file is not found.