#!/bin/bash

# Get the directory where this script is located
cd "$(dirname "$0")"

# Change to the script directory
cd /Users/ariellewolter/Desktop/GCODE_GUI

# Launch the GUI
python3 gcode_generator.py

# Keep terminal open if there's an error
if [ $? -ne 0 ]; then
    echo ""
    echo "Press any key to close..."
    read -n 1
fi
