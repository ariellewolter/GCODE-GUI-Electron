#!/bin/bash

# Fix "damaged" app error
# Usage: Drag the app onto this script, or run: ./FIX_DAMAGED_APP.sh "/path/to/GCode Generator.app"

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
    echo "Usage: $0 '/path/to/GCode Generator.app'"
    echo "Or drag the app onto this script in Terminal"
    exit 1
fi

echo "Fixing: $APP_PATH"

# Remove quarantine and extended attributes
xattr -cr "$APP_PATH" 2>/dev/null

# Remove com.apple.quarantine specifically
xattr -d com.apple.quarantine "$APP_PATH" 2>/dev/null

echo "Quarantine attributes removed."
echo ""
echo "Now try:"
echo "1. Right-click the app"
echo "2. Select 'Open'"
echo "3. Click 'Open' in the security dialog"
echo ""
echo "Or go to System Settings → Privacy & Security → Click 'Open Anyway'"
