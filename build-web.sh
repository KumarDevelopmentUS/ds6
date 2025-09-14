#!/bin/bash

# Build the web version
npx expo export --platform web

# Copy custom favicon in multiple formats
cp assets/images/probability.png dist/favicon.ico
cp assets/images/probability.png dist/favicon.png
cp assets/images/probability.png dist/apple-touch-icon.png

# Update the title in index.html
sed -i 's/<title data-rh="true"><\/title>/<title data-rh="true">Die Stats<\/title>/' dist/index.html

# Add proper favicon links to index.html
sed -i 's|<link rel="icon" href="/favicon.ico" />|<link rel="icon" type="image/png" href="/favicon.png" />\n<link rel="apple-touch-icon" href="/apple-touch-icon.png" />|' dist/index.html

echo "Build completed successfully!"
