#!/bin/bash
cd "$(dirname "$0")"
exec python3 gcode_generator.py
