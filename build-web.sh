#!/bin/bash

# Build the web version
npx expo export --platform web

# Copy custom favicon in multiple formats
cp assets/images/favicon.ico dist/favicon.ico
cp assets/images/favicon.png dist/favicon.png
cp assets/images/favicon.png dist/apple-touch-icon.png

# Update the title and favicon in index.html using Python
python3 fix-html.py

echo "Build completed successfully!"
