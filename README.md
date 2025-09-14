# Browser Activity Monitor Chrome Extension

A comprehensive Chrome extension that monitors browser activity across all windows and tabs, logging detailed request/response information to an SQLite database.

## Features

- **Auto-Start Monitoring**: Plugin starts monitoring by default when installed
- **Domain-Specific Controls**: Disable monitoring for specific domains while keeping it active for others
- **Network Monitoring**: Captures all HTTP/HTTPS requests and responses
- **Comprehensive Data Logging**: Records method, protocol, port, URL, headers, response codes, and more
- **Cross-Window/Tab Monitoring**: Monitors activity across all Chrome windows and tabs
- **Persistent Storage**: Stores data in IndexedDB with SQLite export capability
- **Advanced Analytics**: Beautiful analytics dashboard with charts and statistics
- **Multiple Export Formats**: Export data as JSON, SQLite database, or ZIP archives
- **User Activity Tracking**: Monitors clicks, form submissions, and console logs
- **Real-time Statistics**: View monitoring statistics in the popup interface

## Data Captured

### Request Information
- HTTP Method (GET, POST, etc.)
- Protocol/Scheme (http, https)
- Port number
- Full URL
- Filename (extracted from URL)
- User-Agent
- Referer
- Origin
- Cookies
- Vary header
- X-Forwarded-For header
- Content-Type
- Request headers

### Response Information
- Response code (200, 404, etc.)
- Response message
- Date header
- Server header
- Content-Length
- Location header
- Response headers
- First 16 characters of response body
- SHA-256 checksum of response body

### Additional Data
- Tab ID and Window ID
- Timestamps
- User interactions (clicks, key presses)
- Form submissions
- Console messages
- Page visibility changes

## Installation

1. **Download the Extension**
   - Clone or download this repository
   - Extract the files to a local directory

2. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" in the top right corner
   - Click "Load unpacked" and select the extension directory
   - The extension should now appear in your extensions list

3. **Grant Permissions**
   - Click on the extension icon in the toolbar
   - Grant necessary permissions when prompted

## Usage

### Monitoring Status
- **Auto-Start**: The extension starts monitoring automatically when installed
- **Status Indicator**: Green indicates monitoring is active, red indicates stopped
- **Manual Control**: Use Start/Stop buttons to control monitoring manually

### Viewing Statistics
- The popup displays real-time statistics:
  - Total requests captured
  - Number of active tabs
  - Data size

### Viewing Analytics
- **View Analytics**: Opens a comprehensive analytics dashboard in a new tab
- **Interactive Charts**: Visualize HTTP methods, status codes, content types, and protocols
- **Data Tables**: Browse recent network requests with detailed information
- **Real-time Statistics**: View total requests, unique domains, data transferred, and more

### Domain Management
- **Disable Domains**: Enter a domain (e.g., google.com) to exclude it from monitoring
- **Enable Domains**: Re-enable monitoring for previously disabled domains
- **Domain List**: View all currently disabled domains in the popup
- **Selective Monitoring**: Monitor only specific domains while excluding others

### Exporting Data
- **Export JSON**: Downloads raw data as JSON file
- **Export SQLite**: Downloads data as SQLite database file for external analysis
- **Create ZIP**: Creates a comprehensive archive with:
  - Network requests in JSON format
  - Network requests in CSV format
  - Summary statistics

### Stopping Monitoring
- Click "Stop Monitoring" to halt data collection
- Data remains stored in the database

## File Structure

```
ChromePlugin_BUASMD/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content script for page monitoring
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── analytics.html        # Analytics dashboard page
├── analytics.js          # Analytics functionality
├── test.html             # Test page for extension
├── install.md            # Installation guide
├── package.json          # Project configuration
└── README.md             # This file
```

## Database Schema

The extension uses IndexedDB to store data in a `network_requests` object store with the following fields:

- `id` - Primary key
- `timestamp` - Request timestamp
- `method` - HTTP method
- `protocol` - Protocol (http/https)
- `port` - Port number
- `url` - Full URL
- `filename` - Extracted filename
- `user_agent` - User agent string
- `referer` - Referer header
- `origin` - Origin header
- `cookie` - Cookie header
- `vary` - Vary header
- `x_forwarded_for` - X-Forwarded-For header
- `content_type` - Content-Type header
- `response_code` - HTTP response code
- `response_message` - Response status message
- `date` - Date header
- `server` - Server header
- `content_length` - Content-Length header
- `location` - Location header
- `response_preview` - First 16 characters of response
- `response_checksum` - SHA-256 checksum of response
- `tab_id` - Chrome tab ID
- `window_id` - Chrome window ID
- `request_headers` - All request headers (JSON)
- `response_headers` - All response headers (JSON)

## Permissions

The extension requires the following permissions:

- `webRequest` - Monitor network requests
- `webRequestBlocking` - Access request/response data
- `storage` - Store data locally
- `activeTab` - Access current tab information
- `tabs` - Monitor all tabs
- `background` - Run background processes
- `unlimitedStorage` - Store large amounts of data
- `downloads` - Download exported files
- `management` - Access extension management
- `<all_urls>` - Monitor all websites

## Security Considerations

- All data is stored locally on your device
- No data is transmitted to external servers
- The extension only captures data when monitoring is active
- Response body data is limited to first 16 characters for privacy
- Form field values are truncated to 100 characters

## Troubleshooting

### Extension Not Loading
- Ensure all files are in the same directory
- Check that manifest.json is valid
- Verify Chrome developer mode is enabled

### No Data Being Captured
- Check that monitoring is started (green indicator)
- Verify permissions are granted
- Check browser console for errors

### Export Issues
- Ensure you have data to export
- Check that downloads are allowed in Chrome
- Verify file permissions

## Development

To modify or extend the extension:

1. Make changes to the source files
2. Reload the extension in `chrome://extensions/`
3. Test functionality in a new tab
4. Check console for any errors

## License

This project is for educational and research purposes. Please ensure compliance with local laws and website terms of service when using this extension.

## Disclaimer

This extension is designed for legitimate monitoring purposes such as:
- Security analysis
- Performance monitoring
- Research and development
- Personal browsing analysis

Users are responsible for ensuring their use complies with applicable laws and website terms of service.
