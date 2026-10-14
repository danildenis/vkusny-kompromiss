#!/bin/bash
# Рендер кадров каталога для всех десертов: 3d/render_cat.sh [id ...]
cd "$(dirname "$0")/.."
IDS=("$@"); [ ${#IDS[@]} -eq 0 ] && IDS=(mango pistachio blueberry coffee raspberry banana lemon gum popcorn)
for d in "${IDS[@]}"; do
  /Applications/Blender.app/Contents/MacOS/Blender -b -P 3d/dessert.py -- $d frames 3d/renders/cat/$d 600 36 28 > 3d/renders/cat_$d.log 2>&1 && echo "done $d" || echo "FAIL $d"
done
