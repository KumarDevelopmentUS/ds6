#!/bin/bash

# Build the web version
npx expo export --platform web

# Copy custom favicon
cp assets/images/probability.png dist/favicon.ico

# Update the title in index.html
sed -i 's/<title data-rh="true"><\/title>/<title data-rh="true">Die Stats<\/title>/' dist/index.html

echo "Build completed successfully!"
