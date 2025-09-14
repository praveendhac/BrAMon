// Analytics page JavaScript
class AnalyticsPage {
  constructor() {
    this.data = [];
    this.summary = {};
    this.isLoading = false;
    this.init();
  }

  async init() {
    try {
      // Add a small delay to ensure the page is fully loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      await this.loadAnalytics();
    } catch (error) {
      console.error('Error in analytics init:', error);
      this.showError('Failed to initialize analytics page');
    }
  }

  async loadAnalytics() {
    // Prevent multiple simultaneous calls
    if (this.isLoading) {
      console.log('Analytics already loading, skipping...');
      return;
    }
    
    try {
      this.isLoading = true;
      this.showLoading(true);
      this.hideError();
      this.hideNoData();

      // Check if extension is available
      if (!this.isExtensionAvailable()) {
        this.showError('Extension not available. Please ensure the Browser Activity Monitor extension is installed and enabled.');
        return;
      }

      // First, get debug info to understand the state
      console.log('Loading analytics...');
      const debugResponse = await this.sendMessage({ action: 'debugInfo' });
      if (debugResponse.success) {
        console.log('Debug info:', debugResponse.info);
      }

      // Get data from background script with retry
      const response = await this.sendMessageWithRetry({ action: 'exportData' });
      console.log('Export data response:', response);
      
      if (response.success && response.data && response.data.length > 0) {
        this.data = response.data;
        this.saveToLocalStorage(this.data); // Save to localStorage as backup
        this.summary = this.generateSummary();
        this.renderAnalytics();
        this.showContent();
      } else {
        // Try to load from localStorage as fallback
        const fallbackData = this.loadFromLocalStorage();
        if (fallbackData && fallbackData.length > 0) {
          this.data = fallbackData;
          this.summary = this.generateSummary();
          this.renderAnalytics();
          this.showContent();
        } else {
          this.showNoData();
        }
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
      this.showError();
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  generateSummary() {
    if (this.data.length === 0) {
      return {
        total_requests: 0,
        unique_domains: 0,
        methods: {},
        status_codes: {},
        content_types: {},
        protocols: {},
        total_size: 0,
        avg_response_time: 0
      };
    }

    const summary = {
      total_requests: this.data.length,
      unique_domains: new Set(this.data.map(r => {
        try {
          return new URL(r.url).hostname;
        } catch {
          return 'unknown';
        }
      })).size,
      methods: {},
      status_codes: {},
      content_types: {},
      protocols: {},
      total_size: 0,
      avg_response_time: 0
    };

    this.data.forEach(request => {
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
      
      // Calculate total size
      summary.total_size += request.content_length || 0;
    });

    return summary;
  }

  renderAnalytics() {
    this.renderStats();
    this.renderMethodsChart();
    this.renderStatusChart();
    this.renderContentTypesChart();
    this.renderProtocolsChart();
    this.renderRequestsTable();
  }

  renderStats() {
    const statsGrid = document.getElementById('statsGrid');
    const stats = [
      {
        number: this.summary.total_requests.toLocaleString(),
        label: 'Total Requests'
      },
      {
        number: this.summary.unique_domains.toLocaleString(),
        label: 'Unique Domains'
      },
      {
        number: this.formatBytes(this.summary.total_size),
        label: 'Total Data Transferred'
      },
      {
        number: Object.keys(this.summary.methods).length,
        label: 'HTTP Methods Used'
      }
    ];

    statsGrid.innerHTML = stats.map(stat => `
      <div class="stat-card">
        <div class="stat-number">${stat.number}</div>
        <div class="stat-label">${stat.label}</div>
      </div>
    `).join('');
  }

  renderMethodsChart() {
    const chart = document.getElementById('methodsChart');
    const methods = this.summary.methods;
    const maxCount = Math.max(...Object.values(methods));

    chart.innerHTML = Object.entries(methods)
      .sort(([,a], [,b]) => b - a)
      .map(([method, count]) => {
        const percentage = (count / maxCount) * 100;
        return `
          <div class="bar-item">
            <div class="bar-label">${method}</div>
            <div class="bar-fill" style="width: ${percentage}%">
              <div class="bar-value">${count}</div>
            </div>
          </div>
        `;
      }).join('');
  }

  renderStatusChart() {
    const chart = document.getElementById('statusChart');
    const statusCodes = this.summary.status_codes;
    const maxCount = Math.max(...Object.values(statusCodes));

    chart.innerHTML = Object.entries(statusCodes)
      .sort(([,a], [,b]) => b - a)
      .map(([code, count]) => {
        const percentage = (count / maxCount) * 100;
        const color = this.getStatusColor(code);
        return `
          <div class="bar-item">
            <div class="bar-label">${code}</div>
            <div class="bar-fill" style="width: ${percentage}%; background: ${color}">
              <div class="bar-value">${count}</div>
            </div>
          </div>
        `;
      }).join('');
  }

  renderContentTypesChart() {
    const chart = document.getElementById('contentTypesChart');
    const contentTypes = this.summary.content_types;
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c', '#4facfe', '#00f2fe'];

    chart.innerHTML = Object.entries(contentTypes)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6) // Show top 6
      .map(([type, count], index) => {
        const color = colors[index % colors.length];
        return `
          <div class="pie-item">
            <div class="pie-color" style="background: ${color}"></div>
            <div class="pie-label">${type} (${count})</div>
          </div>
        `;
      }).join('');
  }

  renderProtocolsChart() {
    const chart = document.getElementById('protocolsChart');
    const protocols = this.summary.protocols;
    const colors = ['#667eea', '#764ba2', '#f093fb', '#f5576c'];

    chart.innerHTML = Object.entries(protocols)
      .map(([protocol, count], index) => {
        const color = colors[index % colors.length];
        return `
          <div class="pie-item">
            <div class="pie-color" style="background: ${color}"></div>
            <div class="pie-label">${protocol} (${count})</div>
          </div>
        `;
      }).join('');
  }

  renderRequestsTable() {
    const tbody = document.getElementById('requestsTableBody');
    const recentRequests = this.data
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50); // Show last 50 requests

    tbody.innerHTML = recentRequests.map(request => `
      <tr>
        <td>${this.formatTime(request.timestamp)}</td>
        <td><span style="color: ${this.getMethodColor(request.method)}; font-weight: bold;">${request.method}</span></td>
        <td title="${request.url}">${this.truncateUrl(request.url)}</td>
        <td><span style="color: ${this.getStatusColor(request.response_code)}; font-weight: bold;">${request.response_code}</span></td>
        <td>${this.formatBytes(request.content_length || 0)}</td>
        <td>${this.getContentTypeIcon(request.content_type)}</td>
      </tr>
    `).join('');
  }

  getStatusColor(code) {
    if (code >= 200 && code < 300) return '#4caf50';
    if (code >= 300 && code < 400) return '#ff9800';
    if (code >= 400 && code < 500) return '#f44336';
    if (code >= 500) return '#9c27b0';
    return '#666';
  }

  getMethodColor(method) {
    const colors = {
      'GET': '#4caf50',
      'POST': '#2196f3',
      'PUT': '#ff9800',
      'DELETE': '#f44336',
      'PATCH': '#9c27b0'
    };
    return colors[method] || '#666';
  }

  getContentTypeIcon(contentType) {
    if (!contentType) return '❓';
    
    const type = contentType.split(';')[0].toLowerCase();
    if (type.includes('html')) return '🌐';
    if (type.includes('json')) return '📄';
    if (type.includes('javascript')) return '⚡';
    if (type.includes('css')) return '🎨';
    if (type.includes('image')) return '🖼️';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('pdf')) return '📕';
    return '📄';
  }

  truncateUrl(url, maxLength = 50) {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength) + '...';
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  showError(customMessage = null) {
    const errorElement = document.getElementById('error');
    if (customMessage) {
      errorElement.innerHTML = `
        <h3>Error Loading Data</h3>
        <p>${customMessage}</p>
        <button class="refresh-btn" onclick="loadAnalytics()">Retry</button>
      `;
    }
    errorElement.style.display = 'block';
    document.getElementById('content').style.display = 'none';
    document.getElementById('noData').style.display = 'none';
  }

  hideError() {
    document.getElementById('error').style.display = 'none';
  }

  showNoData() {
    document.getElementById('noData').style.display = 'block';
    document.getElementById('content').style.display = 'none';
  }

  hideNoData() {
    document.getElementById('noData').style.display = 'none';
  }

  showContent() {
    document.getElementById('content').style.display = 'block';
  }

  isExtensionAvailable() {
    try {
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             chrome.runtime.sendMessage;
    } catch (error) {
      return false;
    }
  }

  loadFromLocalStorage() {
    try {
      const data = localStorage.getItem('browserActivityData');
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('Error loading data from localStorage:', error);
      return [];
    }
  }

  saveToLocalStorage(data) {
    try {
      localStorage.setItem('browserActivityData', JSON.stringify(data));
      console.log('Data saved to localStorage');
    } catch (error) {
      console.warn('Error saving data to localStorage:', error);
    }
  }

  async sendMessageWithRetry(message, maxRetries = 3) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Attempt ${attempt} of ${maxRetries} for message:`, message.action);
        const response = await this.sendMessage(message);
        
        if (response.success) {
          console.log(`Success on attempt ${attempt}`);
          return response;
        }
        
        lastError = response.error || 'Unknown error';
        console.warn(`Attempt ${attempt} failed:`, lastError);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 5000); // Cap at 5 seconds
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error.message;
        console.warn(`Attempt ${attempt} threw error:`, error.message);
        
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * attempt, 5000);
          console.log(`Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    console.error(`All ${maxRetries} attempts failed. Last error:`, lastError);
    return { success: false, error: lastError || 'Max retries exceeded' };
  }

  sendMessage(message, timeout = 10000) {
    return new Promise((resolve) => {
      try {
        // Check if we're in the right context
        if (!chrome.runtime || !chrome.runtime.sendMessage) {
          console.warn('Chrome runtime not available');
          resolve({ success: false, error: 'Chrome runtime not available' });
          return;
        }

        // Set up timeout
        const timeoutId = setTimeout(() => {
          console.warn('Message timeout after', timeout, 'ms for action:', message.action);
          resolve({ success: false, error: 'Request timeout' });
        }, timeout);

        console.log('Sending message:', message.action);
        chrome.runtime.sendMessage(message, (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.warn('Message port error for', message.action, ':', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else if (response) {
            console.log('Received response for', message.action, ':', response.success ? 'success' : 'failed');
            resolve(response);
          } else {
            console.warn('No response received for', message.action);
            resolve({ success: false, error: 'No response received' });
          }
        });
      } catch (error) {
        console.warn('Error sending message for', message.action, ':', error.message);
        resolve({ success: false, error: error.message });
      }
    });
  }
}

// Global function for refresh button
function loadAnalytics() {
  try {
    if (window.analyticsPage && !window.analyticsPage.isLoading) {
      console.log('Refreshing analytics...');
      window.analyticsPage.loadAnalytics();
    } else if (window.analyticsPage && window.analyticsPage.isLoading) {
      console.log('Analytics already loading, please wait...');
    } else {
      console.error('Analytics page not initialized');
    }
  } catch (error) {
    console.error('Error in loadAnalytics:', error);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    if (!window.analyticsPage) {
      console.log('Initializing analytics page...');
      window.analyticsPage = new AnalyticsPage();
    } else {
      console.log('Analytics page already initialized');
    }
  } catch (error) {
    console.error('Error initializing analytics page:', error);
  }
});
