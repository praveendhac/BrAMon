// Content script for capturing additional browser data
class ContentScriptMonitor {
  constructor() {
    this.init();
  }

  init() {
    // Capture page load information
    this.capturePageInfo();
    
    // Monitor form submissions
    this.monitorFormSubmissions();
    
    // Monitor clicks and interactions
    this.monitorUserInteractions();
    
    // Monitor console logs
    this.monitorConsoleLogs();
    
    // Monitor page visibility changes
    this.monitorVisibilityChanges();
    
    // Monitor beforeunload events
    this.monitorPageUnload();
  }

  capturePageInfo() {
    const pageInfo = {
      url: window.location.href,
      title: document.title,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      screen: {
        width: screen.width,
        height: screen.height
      },
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine
    };

    // Send to background script with error handling
    this.sendMessage({
      action: 'pageInfo',
      data: pageInfo
    });
  }

  monitorFormSubmissions() {
    document.addEventListener('submit', (event) => {
      const formData = {
        action: event.target.action,
        method: event.target.method,
        timestamp: new Date().toISOString(),
        formId: event.target.id,
        formClass: event.target.className,
        formName: event.target.name
      };

      // Capture form field data
      const fields = {};
      const formElements = event.target.elements;
      for (let element of formElements) {
        if (element.name && element.type !== 'submit') {
          fields[element.name] = {
            type: element.type,
            value: element.value ? element.value.substring(0, 100) : '', // Limit value length
            required: element.required
          };
        }
      }
      formData.fields = fields;

      this.sendMessage({
        action: 'formSubmission',
        data: formData
      });
    });
  }

  monitorUserInteractions() {
    // Monitor clicks
    document.addEventListener('click', (event) => {
      const clickData = {
        type: 'click',
        target: {
          tagName: event.target.tagName,
          id: event.target.id,
          className: event.target.className,
          textContent: event.target.textContent ? event.target.textContent.substring(0, 100) : '',
          href: event.target.href || null
        },
        timestamp: new Date().toISOString(),
        coordinates: {
          x: event.clientX,
          y: event.clientY
        }
      };

      this.sendMessage({
        action: 'userInteraction',
        data: clickData
      });
    });

    // Monitor key presses
    document.addEventListener('keydown', (event) => {
      const keyData = {
        type: 'keydown',
        key: event.key,
        code: event.code,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        timestamp: new Date().toISOString()
      };

      this.sendMessage({
        action: 'userInteraction',
        data: keyData
      });
    });
  }

  monitorConsoleLogs() {
    // Override console methods to capture logs
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      this.captureConsoleMessage('log', args);
      originalLog.apply(console, args);
    };

    console.error = (...args) => {
      this.captureConsoleMessage('error', args);
      originalError.apply(console, args);
    };

    console.warn = (...args) => {
      this.captureConsoleMessage('warn', args);
      originalWarn.apply(console, args);
    };
  }

  captureConsoleMessage(level, args) {
    const message = {
      level: level,
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' '),
      timestamp: new Date().toISOString(),
      url: window.location.href
    };

    this.sendMessage({
      action: 'consoleMessage',
      data: message
    });
  }

  monitorVisibilityChanges() {
    document.addEventListener('visibilitychange', () => {
      this.sendMessage({
        action: 'visibilityChange',
        data: {
          hidden: document.hidden,
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      });
    });
  }

  monitorPageUnload() {
    window.addEventListener('beforeunload', () => {
      this.sendMessage({
        action: 'pageUnload',
        data: {
          timestamp: new Date().toISOString(),
          url: window.location.href
        }
      });
    });
  }

  // Safe message sending with error handling
  sendMessage(message) {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Message port error:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.warn('Error sending message:', error);
    }
  }
}

// Initialize the content script monitor
const contentMonitor = new ContentScriptMonitor();
