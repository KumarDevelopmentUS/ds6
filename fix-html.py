#!/usr/bin/env python3
import re
import sys

# Read the HTML file
with open('dist/index.html', 'r') as f:
    content = f.read()

# Update the title
content = re.sub(r'<title data-rh="true"></title>', '<title data-rh="true">Die Stats</title>', content)

# Update the favicon
content = re.sub(r'<link rel="icon" href="/favicon.ico" />', '<link rel="icon" type="image/png" href="/favicon.png" />', content)

# Write the updated content back
with open('dist/index.html', 'w') as f:
    f.write(content)

print("HTML updated successfully!")
