// Background script for monitoring network requests
class BrowserActivityMonitor {
  constructor() {
    this.db = null;
    this.isMonitoring = true; // Start monitoring by default
    this.disabledDomains = new Set(); // Domains to exclude from monitoring
    this.init();
  }

  async init() {
    try {
      await this.initDatabase();
      await this.loadDisabledDomains();
      this.setupEventListeners();
      console.log('Browser Activity Monitor initialized - Monitoring enabled by default');
    } catch (error) {
      console.error('Failed to initialize monitor:', error);
    }
  }

  async initDatabase() {
    // Initialize IndexedDB database
    this.db = await this.createIndexedDB();
    await this.createTables();
  }

  async createIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('BrowserActivityDB', 1);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('network_requests')) {
          const store = db.createObjectStore('network_requests', { keyPath: 'id', autoIncrement: true });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('url', 'url', { unique: false });
          store.createIndex('method', 'method', { unique: false });
        }
      };
    });
  }

  async createTables() {
    // Tables are created via IndexedDB object stores
    console.log('Database tables created');
  }

  setupEventListeners() {
    // Monitor all HTTP requests
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => this.handleRequest(details),
      { urls: ["<all_urls>"] },
      ["requestBody"]
    );

    chrome.webRequest.onHeadersReceived.addListener(
      (details) => this.handleResponse(details),
      { urls: ["<all_urls>"] },
      ["responseHeaders"]
    );

    chrome.webRequest.onCompleted.addListener(
      (details) => this.handleCompleted(details),
      { urls: ["<all_urls>"] }
    );

    // Listen for tab and window events
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete') {
        this.logTabActivity(tabId, tab);
      }
    });

    chrome.windows.onCreated.addListener((window) => {
      this.logWindowActivity(window);
    });
  }

  async handleRequest(details) {
    if (!this.isMonitoring) return;

    try {
      // Check if domain is disabled
      const domain = this.extractDomain(details.url);
      if (this.disabledDomains.has(domain)) {
        return; // Skip monitoring for disabled domains
      }

      const requestData = {
        method: details.method || 'UNKNOWN',
        protocol: this.extractProtocol(details.url),
        port: this.extractPort(details.url),
        url: details.url || '',
        filename: this.extractFilename(details.url),
        domain: domain,
        tab_id: details.tabId || -1,
        window_id: details.frameId === 0 ? await this.getWindowId(details.tabId) : null,
        request_headers: JSON.stringify(details.requestHeaders || []),
        timestamp: new Date().toISOString()
      };

      // Store request data temporarily
      await this.storeRequestData(details.requestId, requestData);
    } catch (error) {
      console.error('Error handling request:', error);
    }
  }

  async handleResponse(details) {
    if (!this.isMonitoring) return;

    try {
      const responseHeaders = details.responseHeaders || [];
      const responseData = {
        response_code: details.statusCode || 0,
        response_message: details.statusLine || '',
        content_type: this.getHeaderValue(responseHeaders, 'content-type'),
        content_length: parseInt(this.getHeaderValue(responseHeaders, 'content-length')) || 0,
        server: this.getHeaderValue(responseHeaders, 'server'),
        date: this.getHeaderValue(responseHeaders, 'date'),
        location: this.getHeaderValue(responseHeaders, 'location'),
        vary: this.getHeaderValue(responseHeaders, 'vary'),
        response_headers: JSON.stringify(responseHeaders)
      };

      // Update stored request data with response info
      await this.updateRequestData(details.requestId, responseData);
    } catch (error) {
      console.error('Error handling response:', error);
    }
  }

  async handleCompleted(details) {
    if (!this.isMonitoring) return;

    try {
      // Get the complete request data
      const requestData = await this.getRequestData(details.requestId);
      if (requestData) {
        // Add additional headers from the original request
        const requestHeaders = details.requestHeaders || [];
        const additionalHeaders = {
          user_agent: this.getHeaderValue(requestHeaders, 'user-agent'),
          referer: this.getHeaderValue(requestHeaders, 'referer'),
          origin: this.getHeaderValue(requestHeaders, 'origin'),
          cookie: this.getHeaderValue(requestHeaders, 'cookie'),
          x_forwarded_for: this.getHeaderValue(requestHeaders, 'x-forwarded-for')
        };

        // Merge all data
        const completeData = { ...requestData, ...additionalHeaders };

        // Get response body preview and checksum
        try {
          const responseBody = await this.getResponseBody(details.requestId);
          if (responseBody) {
            completeData.response_preview = responseBody.substring(0, 16);
            completeData.response_checksum = await this.calculateChecksum(responseBody);
          }
        } catch (error) {
          console.warn('Could not get response body:', error);
        }

        // Store in database
        await this.storeCompleteRequest(completeData);
      }

      // Clean up temporary data
      await this.cleanupRequestData(details.requestId);
    } catch (error) {
      console.error('Error handling completed request:', error);
    }
  }

  async storeCompleteRequest(data) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction(['network_requests'], 'readwrite');
        const store = transaction.objectStore('network_requests');
        
        const requestData = {
          method: data.method,
          protocol: data.protocol,
          port: data.port,
          url: data.url,
          filename: data.filename,
          domain: data.domain,
          user_agent: data.user_agent,
          referer: data.referer,
          origin: data.origin,
          cookie: data.cookie,
          vary: data.vary,
          x_forwarded_for: data.x_forwarded_for,
          content_type: data.content_type,
          response_code: data.response_code,
          response_message: data.response_message,
          date: data.date,
          server: data.server,
          content_length: data.content_length,
          location: data.location,
          response_preview: data.response_preview,
          response_checksum: data.response_checksum,
          tab_id: data.tab_id,
          window_id: data.window_id,
          request_headers: data.request_headers,
          response_headers: data.response_headers,
          timestamp: data.timestamp
        };

        const request = store.add(requestData);
        
        request.onsuccess = () => {
          console.log('Request stored successfully:', requestData.url);
          // Also save to localStorage as backup
          this.saveToLocalStorageBackup(requestData);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error('Error storing request:', request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Error in storeCompleteRequest:', error);
        reject(error);
      }
    });
  }

  // Helper methods
  extractProtocol(url) {
    try {
      return new URL(url).protocol.replace(':', '');
    } catch {
      return 'unknown';
    }
  }

  extractPort(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.port ? parseInt(urlObj.port) : (urlObj.protocol === 'https:' ? 443 : 80);
    } catch {
      return null;
    }
  }

  extractFilename(url) {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split('/').pop() || '';
    } catch {
      return '';
    }
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return 'unknown';
    }
  }

  getHeaderValue(headers, name) {
    if (!headers || !Array.isArray(headers)) {
      return '';
    }
    const header = headers.find(h => h && h.name && h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
  }

  async getWindowId(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      return tab.windowId;
    } catch {
      return null;
    }
  }

  async getResponseBody(requestId) {
    // This is a simplified version - in reality, getting response body
    // requires additional permissions and handling
    return null;
  }

  async calculateChecksum(data) {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Temporary storage for request data
  async storeRequestData(requestId, data) {
    await chrome.storage.local.set({ [`req_${requestId}`]: data });
  }

  async getRequestData(requestId) {
    const result = await chrome.storage.local.get([`req_${requestId}`]);
    return result[`req_${requestId}`];
  }

  async updateRequestData(requestId, data) {
    const existing = await this.getRequestData(requestId);
    if (existing) {
      const updated = { ...existing, ...data };
      await chrome.storage.local.set({ [`req_${requestId}`]: updated });
    }
  }

  async cleanupRequestData(requestId) {
    await chrome.storage.local.remove([`req_${requestId}`]);
  }

  async logTabActivity(tabId, tab) {
    // Log tab activity if needed
    console.log('Tab activity:', tabId, tab.url);
  }

  async logWindowActivity(window) {
    // Log window activity if needed
    console.log('Window activity:', window.id);
  }

  // Content script data handlers
  handlePageInfo(data, tab) {
    if (!this.isMonitoring) return;
    console.log('Page info received:', data);
    // Store page info in a separate table or add to existing request data
  }

  handleFormSubmission(data, tab) {
    if (!this.isMonitoring) return;
    console.log('Form submission:', data);
    // Log form submission data
  }

  handleUserInteraction(data, tab) {
    if (!this.isMonitoring) return;
    console.log('User interaction:', data);
    // Log user interaction data
  }

  handleConsoleMessage(data, tab) {
    if (!this.isMonitoring) return;
    console.log('Console message:', data);
    // Log console messages
  }

  handleVisibilityChange(data, tab) {
    if (!this.isMonitoring) return;
    console.log('Visibility change:', data);
    // Log page visibility changes
  }

  handlePageUnload(data, tab) {
    if (!this.isMonitoring) return;
    console.log('Page unload:', data);
    // Log page unload events
  }

  // Public methods for popup control
  startMonitoring() {
    this.isMonitoring = true;
    console.log('Monitoring started');
  }

  stopMonitoring() {
    this.isMonitoring = false;
    console.log('Monitoring stopped');
  }

  async exportData() {
    try {
      console.log('Exporting data...');
      const data = await this.getAllData();
      console.log('Exported data count:', data.length);
      return data;
    } catch (error) {
      console.error('Error exporting data:', error);
      return [];
    }
  }

  async getAllData() {
    return new Promise((resolve, reject) => {
      try {
        if (!this.db) {
          console.error('Database not initialized');
          reject(new Error('Database not initialized'));
          return;
        }
        
        const transaction = this.db.transaction(['network_requests'], 'readonly');
        const store = transaction.objectStore('network_requests');
        const request = store.getAll();
        
        request.onsuccess = () => {
          console.log('Retrieved data count:', request.result.length);
          resolve(request.result);
        };
        
        request.onerror = () => {
          console.error('Error retrieving data:', request.error);
          reject(request.error);
        };
        
        transaction.onerror = () => {
          console.error('Transaction error:', transaction.error);
          reject(transaction.error);
        };
      } catch (error) {
        console.error('Error in getAllData:', error);
        reject(error);
      }
    });
  }

  async createZipArchive() {
    try {
      const data = await this.exportData();
      
      // Create a simple text-based archive since JSZip is not available
      const archiveContent = this.createTextArchive(data);
      const blob = new Blob([archiveContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: `browser_activity_${Date.now()}.txt`
      });
      
      return true;
    } catch (error) {
      console.error('Error creating archive:', error);
      return false;
    }
  }

  createTextArchive(data) {
    const timestamp = new Date().toISOString();
    let content = `Browser Activity Monitor - Data Export\n`;
    content += `Generated: ${timestamp}\n`;
    content += `Total Records: ${data.length}\n`;
    content += `========================================\n\n`;
    
    // Add JSON data
    content += `=== NETWORK_REQUESTS.JSON ===\n`;
    content += JSON.stringify(data, null, 2);
    content += `\n\n`;
    
    // Add CSV data
    content += `=== NETWORK_REQUESTS.CSV ===\n`;
    content += this.convertToCSV(data);
    content += `\n\n`;
    
    // Add summary
    content += `=== SUMMARY ===\n`;
    const summary = this.generateSummary(data);
    content += JSON.stringify(summary, null, 2);
    
    return content;
  }

  generateSummary(data) {
    const summary = {
      total_requests: data.length,
      unique_domains: new Set(data.map(r => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return 'unknown';
        }
      })).size,
      methods: {},
      status_codes: {},
      content_types: {},
      protocols: {}
    };
    
    data.forEach(request => {
      // Count methods
      summary.methods[request.method] = (summary.methods[request.method] || 0) + 1;
      
      // Count status codes
      summary.status_codes[request.response_code] = (summary.status_codes[request.response_code] || 0) + 1;
      
      // Count content types
      if (request.content_type) {
        const type = request.content_type.split(';')[0];
        summary.content_types[type] = (summary.content_types[type] || 0) + 1;
      }
      
      // Count protocols
      summary.protocols[request.protocol] = (summary.protocols[request.protocol] || 0) + 1;
    });
    
    return summary;
  }

  convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    return csvContent;
  }

  async openAnalytics() {
    try {
      const url = chrome.runtime.getURL('analytics.html');
      await chrome.tabs.create({ url: url });
      return true;
    } catch (error) {
      console.error('Error opening analytics:', error);
      return false;
    }
  }

  async getDebugInfo() {
    try {
      const data = await this.getAllData();
      return {
        isMonitoring: this.isMonitoring,
        disabledDomains: Array.from(this.disabledDomains),
        dataCount: data.length,
        dbInitialized: !!this.db,
        lastRequestTime: data.length > 0 ? data[data.length - 1].timestamp : null
      };
    } catch (error) {
      return {
        isMonitoring: this.isMonitoring,
        disabledDomains: Array.from(this.disabledDomains),
        dataCount: 0,
        dbInitialized: !!this.db,
        error: error.message
      };
    }
  }

  saveToLocalStorageBackup(data) {
    try {
      // Get existing data from localStorage
      const existingData = JSON.parse(localStorage.getItem('browserActivityData') || '[]');
      existingData.push(data);
      
      // Keep only last 1000 records to avoid localStorage size limits
      if (existingData.length > 1000) {
        existingData.splice(0, existingData.length - 1000);
      }
      
      localStorage.setItem('browserActivityData', JSON.stringify(existingData));
    } catch (error) {
      console.warn('Error saving to localStorage backup:', error);
    }
  }

  // Domain management functions
  async loadDisabledDomains() {
    try {
      const result = await chrome.storage.local.get(['disabledDomains']);
      if (result.disabledDomains) {
        this.disabledDomains = new Set(result.disabledDomains);
      }
    } catch (error) {
      console.error('Error loading disabled domains:', error);
    }
  }

  async saveDisabledDomains() {
    try {
      await chrome.storage.local.set({ 
        disabledDomains: Array.from(this.disabledDomains) 
      });
    } catch (error) {
      console.error('Error saving disabled domains:', error);
    }
  }

  async disableDomain(domain) {
    this.disabledDomains.add(domain);
    await this.saveDisabledDomains();
    console.log(`Domain disabled: ${domain}`);
  }

  async enableDomain(domain) {
    this.disabledDomains.delete(domain);
    await this.saveDisabledDomains();
    console.log(`Domain enabled: ${domain}`);
  }

  getDisabledDomains() {
    return Array.from(this.disabledDomains);
  }

  isDomainDisabled(domain) {
    return this.disabledDomains.has(domain);
  }

  // SQLite database functions for persistent storage
  async exportToSQLite() {
    try {
      const data = await this.getAllData();
      const csvContent = this.convertToCSV(data);
      
      // Create SQLite database content
      const sqliteContent = this.createSQLiteDatabase(data);
      
      // Download as .db file
      const blob = new Blob([sqliteContent], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      
      chrome.downloads.download({
        url: url,
        filename: `browser_activity_${Date.now()}.db`
      });
      
      return true;
    } catch (error) {
      console.error('Error exporting to SQLite:', error);
      return false;
    }
  }

  createSQLiteDatabase(data) {
    // Create a simple SQLite database structure
    let sqliteContent = '';
    
    // SQLite header
    sqliteContent += 'SQLite format 3\x00';
    
    // Create table SQL
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS network_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        method TEXT,
        protocol TEXT,
        port INTEGER,
        url TEXT,
        filename TEXT,
        domain TEXT,
        user_agent TEXT,
        referer TEXT,
        origin TEXT,
        cookie TEXT,
        vary TEXT,
        x_forwarded_for TEXT,
        content_type TEXT,
        response_code INTEGER,
        response_message TEXT,
        date TEXT,
        server TEXT,
        content_length INTEGER,
        location TEXT,
        response_preview TEXT,
        response_checksum TEXT,
        tab_id INTEGER,
        window_id INTEGER,
        request_headers TEXT,
        response_headers TEXT
      );
    `;
    
    // For simplicity, we'll create a text-based database
    // In a real implementation, you'd use a proper SQLite library
    sqliteContent += createTableSQL;
    
    // Add data as INSERT statements
    data.forEach(record => {
      const insertSQL = `
        INSERT INTO network_requests (
          timestamp, method, protocol, port, url, filename, domain,
          user_agent, referer, origin, cookie, vary, x_forwarded_for,
          content_type, response_code, response_message, date, server,
          content_length, location, response_preview, response_checksum,
          tab_id, window_id, request_headers, response_headers
        ) VALUES (
          '${record.timestamp}', '${record.method}', '${record.protocol}', ${record.port || 'NULL'},
          '${record.url}', '${record.filename}', '${record.domain}',
          '${record.user_agent || ''}', '${record.referer || ''}', '${record.origin || ''}',
          '${record.cookie || ''}', '${record.vary || ''}', '${record.x_forwarded_for || ''}',
          '${record.content_type || ''}', ${record.response_code || 'NULL'}, '${record.response_message || ''}',
          '${record.date || ''}', '${record.server || ''}', ${record.content_length || 'NULL'},
          '${record.location || ''}', '${record.response_preview || ''}', '${record.response_checksum || ''}',
          ${record.tab_id || 'NULL'}, ${record.window_id || 'NULL'},
          '${record.request_headers || ''}', '${record.response_headers || ''}'
        );
      `;
      sqliteContent += insertSQL;
    });
    
    return sqliteContent;
  }
}

// Initialize the monitor
const monitor = new BrowserActivityMonitor();

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'startMonitoring':
      monitor.startMonitoring();
      sendResponse({ success: true });
      break;
    case 'stopMonitoring':
      monitor.stopMonitoring();
      sendResponse({ success: true });
      break;
    case 'exportData':
      monitor.exportData().then(data => {
        sendResponse({ success: true, data });
      });
      break;
    case 'createZip':
      monitor.createZipArchive().then(success => {
        sendResponse({ success });
      });
      break;
    case 'openAnalytics':
      monitor.openAnalytics().then(success => {
        sendResponse({ success });
      });
      break;
    case 'disableDomain':
      monitor.disableDomain(request.domain).then(() => {
        sendResponse({ success: true });
      });
      break;
    case 'enableDomain':
      monitor.enableDomain(request.domain).then(() => {
        sendResponse({ success: true });
      });
      break;
    case 'getDisabledDomains':
      sendResponse({ success: true, domains: monitor.getDisabledDomains() });
      break;
    case 'exportToSQLite':
      monitor.exportToSQLite().then(success => {
        sendResponse({ success });
      });
      break;
    case 'debugInfo':
      monitor.getDebugInfo().then(info => {
        sendResponse({ success: true, info });
      });
      break;
    case 'pageInfo':
      monitor.handlePageInfo(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    case 'formSubmission':
      monitor.handleFormSubmission(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    case 'userInteraction':
      monitor.handleUserInteraction(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    case 'consoleMessage':
      monitor.handleConsoleMessage(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    case 'visibilityChange':
      monitor.handleVisibilityChange(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    case 'pageUnload':
      monitor.handlePageUnload(request.data, sender.tab);
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false, error: 'Unknown action' });
  }
});