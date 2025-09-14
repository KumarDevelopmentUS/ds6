#!/bin/bash

# Build the web version
npx expo export --platform web

# Copy custom favicon in multiple formats
cp assets/images/probability.png dist/favicon.ico
cp assets/images/probability.png dist/favicon.png
cp assets/images/probability.png dist/apple-touch-icon.png

# Update the title and favicon in index.html using Python
python3 fix-html.py

echo "Build completed successfully!"
