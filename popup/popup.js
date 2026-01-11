// n8n Workflow Sidebar - Popup Settings Script

// DOM elements
const apiKeyInput = document.getElementById('api-key');
const testButton = document.getElementById('test-connection');
const saveButton = document.getElementById('save-settings');
const statusMessage = document.getElementById('status-message');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const workflowCount = document.getElementById('workflow-count');

// Initialize on load
init();

async function init() {
  // Load saved API key
  const {apiKey} = await chrome.storage.sync.get('apiKey');
  if (apiKey) {
    apiKeyInput.value = apiKey;
    // Auto-test connection on load if API key exists
    setTimeout(testConnection, 100);
  }
}

// Save settings button handler
saveButton.addEventListener('click', async () => {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  try {
    // Save to chrome.storage.sync
    await chrome.storage.sync.set({apiKey});
    showStatus('Settings saved successfully', 'success');

    // Test connection after save
    setTimeout(testConnection, 500);

  } catch (error) {
    showStatus(`Save failed: ${error.message}`, 'error');
  }
});

// Test connection button handler
testButton.addEventListener('click', testConnection);

async function testConnection() {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus('Please enter an API key first', 'error');
    return;
  }

  // Show loading state
  testButton.disabled = true;
  testButton.textContent = 'Testing...';
  updateConnectionStatus('connecting', 'Testing connection...');
  workflowCount.textContent = '';

  try {
    // Send test request to service worker
    const response = await chrome.runtime.sendMessage({
      action: 'testConnection'
    });

    if (response.success) {
      showStatus('Connection successful!', 'success');
      updateConnectionStatus('connected', 'Connected');

      // Display workflow count
      workflowCount.textContent = `${response.count} workflow${response.count !== 1 ? 's' : ''} found`;

    } else {
      throw new Error(response.error);
    }

  } catch (error) {
    let errorMessage = error.message;

    // User-friendly error messages
    if (errorMessage === 'INVALID_API_KEY') {
      errorMessage = 'Invalid API key. Please check your key and try again.';
    } else if (errorMessage === 'API_NOT_FOUND') {
      errorMessage = 'n8n API not found. Check your instance URL.';
    } else if (errorMessage.includes('Failed to fetch')) {
      errorMessage = 'Connection failed. Check your internet connection.';
    }

    showStatus(`Connection failed: ${errorMessage}`, 'error');
    updateConnectionStatus('error', 'Connection failed');

  } finally {
    testButton.disabled = false;
    testButton.textContent = 'Test Connection';
  }
}

/**
 * Show status message with auto-hide
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');

  // Auto-hide after 5 seconds
  setTimeout(() => {
    statusMessage.classList.add('hidden');
  }, 5000);
}

/**
 * Update connection status indicator
 * @param {string} status - 'connected', 'error', or 'connecting'
 * @param {string} text - Status text to display
 */
function updateConnectionStatus(status, text) {
  statusIndicator.className = `status-dot ${status}`;
  statusText.textContent = text;
}

// Handle Enter key in API key input
apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    saveButton.click();
  }
});
