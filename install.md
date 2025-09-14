# Installation Guide

## Quick Setup

1. **Download the Extension Files**
   - Ensure all files are in the same directory
   - Files needed:
     - `manifest.json`
     - `background.js`
     - `content.js`
     - `popup.html`
     - `popup.js`
     - `sqlite-handler.js`
     - `jszip.min.js`

2. **Load Extension in Chrome**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should appear in your extensions list

3. **Pin the Extension**
   - Click the puzzle piece icon in Chrome toolbar
   - Find "Browser Activity Monitor" and click the pin icon
   - The extension icon will now be visible in your toolbar

4. **Start Monitoring**
   - Click the extension icon
   - Click "Start Monitoring"
   - The status indicator should turn green

## Verification

To verify the extension is working:

1. Open a new tab and visit any website
2. Check the extension popup - you should see request count increasing
3. Click "Export JSON" to download captured data
4. Check the downloaded file to see captured request/response data

## Troubleshooting

- **Extension not loading**: Check that all files are present and manifest.json is valid
- **No data captured**: Ensure monitoring is started and permissions are granted
- **Export not working**: Check Chrome download settings and file permissions

## Security Note

This extension captures sensitive browsing data. Only use on trusted devices and ensure you understand the data being collected.
