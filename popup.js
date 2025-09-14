// Popup script for Browser Activity Monitor
class PopupController {
  constructor() {
    this.isMonitoring = true; // Default to monitoring enabled
    this.stats = {
      totalRequests: 0,
      activeTabs: 0,
      dataSize: 0
    };
    this.disabledDomains = [];
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadInitialState();
    this.updateStats();
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => this.startMonitoring());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopMonitoring());
    document.getElementById('analyticsBtn').addEventListener('click', () => this.openAnalytics());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
    document.getElementById('sqliteBtn').addEventListener('click', () => this.exportSQLite());
    document.getElementById('zipBtn').addEventListener('click', () => this.createZip());
    document.getElementById('disableDomainBtn').addEventListener('click', () => this.disableDomain());
    document.getElementById('enableDomainBtn').addEventListener('click', () => this.enableDomain());
  }

  async loadInitialState() {
    try {
      // Check if monitoring is already active
      const result = await chrome.storage.local.get(['isMonitoring']);
      this.isMonitoring = result.isMonitoring !== false; // Default to true
      this.updateUI();
      await this.loadDisabledDomains();
    } catch (error) {
      console.error('Error loading initial state:', error);
    }
  }

  async loadDisabledDomains() {
    try {
      const response = await this.sendMessage({ action: 'getDisabledDomains' });
      if (response.success) {
        this.disabledDomains = response.domains || [];
        this.updateDisabledDomainsList();
      }
    } catch (error) {
      console.error('Error loading disabled domains:', error);
    }
  }

  async startMonitoring() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'startMonitoring' });
      
      if (response.success) {
        this.isMonitoring = true;
        await chrome.storage.local.set({ isMonitoring: true });
        this.updateUI();
        this.showMessage('Monitoring started successfully!', 'success');
      } else {
        this.showMessage('Failed to start monitoring', 'error');
      }
    } catch (error) {
      console.error('Error starting monitoring:', error);
      this.showMessage('Error starting monitoring', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async stopMonitoring() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'stopMonitoring' });
      
      if (response.success) {
        this.isMonitoring = false;
        await chrome.storage.local.set({ isMonitoring: false });
        this.updateUI();
        this.showMessage('Monitoring stopped successfully!', 'success');
      } else {
        this.showMessage('Failed to stop monitoring', 'error');
      }
    } catch (error) {
      console.error('Error stopping monitoring:', error);
      this.showMessage('Error stopping monitoring', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async exportData() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'exportData' });
      
      if (response.success && response.data) {
        // Create and download JSON file
        const dataStr = JSON.stringify(response.data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = url;
        a.download = `browser_activity_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage('Data exported successfully!', 'success');
      } else {
        this.showMessage('No data to export', 'error');
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      this.showMessage('Error exporting data', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async openAnalytics() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'openAnalytics' });
      
      if (response.success) {
        this.showMessage('Analytics page opened!', 'success');
      } else {
        this.showMessage('Failed to open analytics page', 'error');
      }
    } catch (error) {
      console.error('Error opening analytics:', error);
      this.showMessage('Error opening analytics page', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async exportSQLite() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'exportToSQLite' });
      
      if (response.success) {
        this.showMessage('SQLite database exported and downloaded!', 'success');
      } else {
        this.showMessage('Failed to export SQLite database', 'error');
      }
    } catch (error) {
      console.error('Error exporting SQLite:', error);
      this.showMessage('Error exporting SQLite database', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async createZip() {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'createZip' });
      
      if (response.success) {
        this.showMessage('ZIP archive created and downloaded!', 'success');
      } else {
        this.showMessage('Failed to create ZIP archive', 'error');
      }
    } catch (error) {
      console.error('Error creating ZIP:', error);
      this.showMessage('Error creating ZIP archive', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async disableDomain() {
    const domainInput = document.getElementById('domainInput');
    const domain = domainInput.value.trim();
    
    if (!domain) {
      this.showMessage('Please enter a domain', 'error');
      return;
    }

    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'disableDomain', domain: domain });
      
      if (response.success) {
        this.showMessage(`Domain ${domain} disabled from monitoring`, 'success');
        domainInput.value = '';
        await this.loadDisabledDomains();
      } else {
        this.showMessage('Failed to disable domain', 'error');
      }
    } catch (error) {
      console.error('Error disabling domain:', error);
      this.showMessage('Error disabling domain', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async enableDomain(domain) {
    try {
      this.showLoading(true);
      
      const response = await this.sendMessage({ action: 'enableDomain', domain: domain });
      
      if (response.success) {
        this.showMessage(`Domain ${domain} enabled for monitoring`, 'success');
        await this.loadDisabledDomains();
      } else {
        this.showMessage('Failed to enable domain', 'error');
      }
    } catch (error) {
      console.error('Error enabling domain:', error);
      this.showMessage('Error enabling domain', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  updateDisabledDomainsList() {
    const list = document.getElementById('disabledDomainsList');
    
    if (this.disabledDomains.length === 0) {
      list.innerHTML = '<div style="color: #666; font-size: 0.9em; text-align: center; padding: 10px;">No domains disabled</div>';
      return;
    }

    list.innerHTML = this.disabledDomains.map(domain => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 5px 10px; background: rgba(255,255,255,0.1); border-radius: 5px; margin-bottom: 5px; font-size: 0.9em;">
        <span>${domain}</span>
        <button onclick="popupController.enableDomain('${domain}')" style="background: #f44336; color: white; border: none; padding: 2px 8px; border-radius: 3px; cursor: pointer; font-size: 0.8em;">Enable</button>
      </div>
    `).join('');
  }

  async updateStats() {
    try {
      // Get current stats from storage
      const result = await chrome.storage.local.get(['stats']);
      if (result.stats) {
        this.stats = result.stats;
      }
      
      // Update UI
      document.getElementById('totalRequests').textContent = this.stats.totalRequests.toLocaleString();
      document.getElementById('activeTabs').textContent = this.stats.activeTabs;
      document.getElementById('dataSize').textContent = this.formatBytes(this.stats.dataSize);
      
      // Get active tabs count
      const tabs = await chrome.tabs.query({});
      this.stats.activeTabs = tabs.length;
      document.getElementById('activeTabs').textContent = this.stats.activeTabs;
      
    } catch (error) {
      console.error('Error updating stats:', error);
    }
  }

  updateUI() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    
    if (this.isMonitoring) {
      statusIndicator.classList.add('active');
      statusText.textContent = 'Monitoring Active';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusIndicator.classList.remove('active');
      statusText.textContent = 'Stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
  }

  showMessage(text, type) {
    const message = document.getElementById('message');
    message.textContent = text;
    message.className = `message ${type}`;
    message.style.display = 'block';
    
    // Hide message after 3 seconds
    setTimeout(() => {
      message.style.display = 'none';
    }, 3000);
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  sendMessage(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, (response) => {
        resolve(response || { success: false, error: 'No response' });
      });
    });
  }
}

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.popupController = new PopupController();
});

// Update stats every 5 seconds
setInterval(() => {
  if (window.popupController) {
    window.popupController.updateStats();
  }
}, 5000);
