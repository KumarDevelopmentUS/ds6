#!/bin/bash

# Build the web version
echo "Starting web export..."
npx expo export --platform web --clear

# Check if dist directory was created
if [ ! -d "dist" ]; then
    echo "Error: dist directory was not created"
    exit 1
fi

# Check if index.html exists
if [ ! -f "dist/index.html" ]; then
    echo "Error: dist/index.html was not created"
    exit 1
fi

# Copy custom favicon in multiple formats
echo "Copying favicon files..."
cp assets/images/favicon.ico dist/favicon.ico
cp assets/images/favicon.png dist/favicon.png
cp assets/images/favicon.png dist/apple-touch-icon.png

# Update the title and favicon in index.html using Python
echo "Updating HTML files..."
python3 fix-html.py

echo "Build completed successfully!"
