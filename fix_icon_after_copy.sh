#!/bin/bash
# Run this script on the destination Mac after copying from OneDrive
# It will restore the app icon

APP_PATH="$1"

if [ -z "$APP_PATH" ]; then
    echo "Usage: $0 /path/to/GCode Generator.app"
    exit 1
fi

echo "Fixing icon for: $APP_PATH"

# Touch the app to refresh Finder
touch "$APP_PATH"

# Clear icon cache
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -kill -r -domain local -domain system -domain user 2>/dev/null

# Refresh the specific app
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_PATH" 2>/dev/null

echo "Icon cache refreshed. The app icon should appear correctly now."
echo "You may need to log out and back in, or restart Finder."
