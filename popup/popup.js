// n8n Workflow Sidebar - Popup Settings Script (Multi-Instance)

'use strict';

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = Object.freeze({
  LOG_PREFIX: '[n8n-ext-popup]',
  STATUS_TIMEOUT_MS: 5000,
  MAX_NAME_LENGTH: 100,
  MIN_API_KEY_LENGTH: 10,
  DRAFT_STORAGE_KEY: 'formDraft',
});

// =============================================================================
// LOGGING
// =============================================================================

const logger = {
  _enabled: true,

  log(...args) {
    if (this._enabled) {
      console.log(CONFIG.LOG_PREFIX, ...args);
    }
  },

  error(...args) {
    console.error(CONFIG.LOG_PREFIX, ...args);
  },
};

// =============================================================================
// STATE
// =============================================================================

/**
 * Application state
 * @type {{instances: Object, editingInstanceId: string|null}}
 */
const state = {
  instances: {},
  editingInstanceId: null,
};

// =============================================================================
// DOM ELEMENT REFERENCES
// =============================================================================

/**
 * Cache DOM element references for performance
 * Initialized in init()
 * @type {Object}
 */
let elements = {};

/**
 * Initialize DOM element references
 */
function initElements() {
  elements = {
    listView: document.getElementById('list-view'),
    formView: document.getElementById('form-view'),
    instancesList: document.getElementById('instances-list'),
    emptyState: document.getElementById('empty-state'),
    addInstanceBtn: document.getElementById('add-instance-btn'),
    instanceNameInput: document.getElementById('instance-name'),
    instanceUrlInput: document.getElementById('instance-url'),
    instanceApiKeyInput: document.getElementById('instance-api-key'),
    settingsLink: document.getElementById('open-api-settings'),
    formTitle: document.getElementById('form-title'),
    cancelBtn: document.getElementById('cancel-btn'),
    testInstanceBtn: document.getElementById('test-instance-btn'),
    saveInstanceBtn: document.getElementById('save-instance-btn'),
    statusMessage: document.getElementById('status-message'),
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Safely parse URL and return origin
 * @param {string} urlString - URL to parse
 * @returns {{origin: string, isValid: boolean}} Parse result
 */
function safeParseUrl(urlString) {
  try {
    // Auto-add https:// if no protocol specified
    let normalizedUrl = urlString;
    if (!normalizedUrl.match(/^https?:\/\//)) {
      normalizedUrl = 'https://' + normalizedUrl;
    }
    const url = new URL(normalizedUrl);
    return { origin: url.origin, hostname: url.hostname, isValid: true };
  } catch {
    return { origin: '', hostname: '', isValid: false };
  }
}

/**
 * Send message to service worker
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} Response
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      });
    } catch (error) {
      reject(error);
    }
  });
}

// =============================================================================
// DRAFT PERSISTENCE
// =============================================================================

/**
 * Save current form data as draft
 */
function saveDraft() {
  const draft = {
    name: elements.instanceNameInput.value,
    url: elements.instanceUrlInput.value,
    apiKey: elements.instanceApiKeyInput.value,
    editingInstanceId: state.editingInstanceId,
    timestamp: Date.now(),
  };
  chrome.storage.local.set({ [CONFIG.DRAFT_STORAGE_KEY]: draft });
  logger.log('Draft saved');
}

/**
 * Load draft from storage
 * @returns {Promise<Object|null>} Draft data or null
 */
async function loadDraft() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CONFIG.DRAFT_STORAGE_KEY], (result) => {
      resolve(result[CONFIG.DRAFT_STORAGE_KEY] || null);
    });
  });
}

/**
 * Clear saved draft
 */
function clearDraft() {
  chrome.storage.local.remove(CONFIG.DRAFT_STORAGE_KEY);
  logger.log('Draft cleared');
}

/**
 * Restore draft to form if available
 * @param {Object} draft - Draft data
 */
function restoreDraft(draft) {
  if (draft.name) elements.instanceNameInput.value = draft.name;
  if (draft.url) elements.instanceUrlInput.value = draft.url;
  if (draft.apiKey) elements.instanceApiKeyInput.value = draft.apiKey;
  if (draft.url) updateSettingsLink(draft.url);
  logger.log('Draft restored');
}

// =============================================================================
// TAB URL DETECTION
// =============================================================================

/**
 * Detect n8n URLs from open tabs
 * @returns {Promise<string|null>} First n8n URL found or null
 */
async function detectN8nUrlFromTabs() {
  try {
    const tabs = await chrome.tabs.query({});

    // Look for tabs with n8n-like URLs (contains /workflow/ or hostname starts with n8n.)
    for (const tab of tabs) {
      if (!tab.url) continue;

      const parsed = safeParseUrl(tab.url);
      if (!parsed.isValid) continue;

      // Check for n8n URLs: /workflow/ path OR hostname starting with "n8n."
      const isN8nUrl = tab.url.includes('/workflow/') ||
                       parsed.hostname.startsWith('n8n.');

      if (isN8nUrl) {
        // Check if this origin is already configured
        const isAlreadyConfigured = Object.values(state.instances).some(
          (instance) => safeParseUrl(instance.url).origin === parsed.origin
        );
        if (!isAlreadyConfigured) {
          logger.log('Detected n8n URL from tab:', parsed.origin);
          return parsed.origin;
        }
      }
    }
    return null;
  } catch (error) {
    logger.error('Failed to detect n8n URLs from tabs:', error);
    return null;
  }
}

// =============================================================================
// INSTANCE NAME GENERATION
// =============================================================================

/**
 * Generate next available instance name
 * @returns {string} Generated name like "Instance 1", "Instance 2", etc.
 */
function generateInstanceName() {
  const existingNames = Object.values(state.instances).map((i) => i.name.toLowerCase());
  let counter = 1;

  while (existingNames.includes(`instance ${counter}`)) {
    counter++;
  }

  return `Instance ${counter}`;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

/**
 * Initialize the popup
 */
async function init() {
  try {
    initElements();

    // Ensure we start with the list view visible
    elements.listView.style.display = 'block';
    elements.formView.style.display = 'none';

    await loadInstances();
    renderInstanceList();

    // Attach event listeners
    attachEventListeners();

    // Check for saved draft and restore form if there was one
    const draft = await loadDraft();
    if (draft && (draft.name || draft.url || draft.apiKey)) {
      // Show form with restored draft
      state.editingInstanceId = draft.editingInstanceId || null;
      elements.formTitle.textContent = state.editingInstanceId ? 'Edit Instance' : 'Add Instance';
      restoreDraft(draft);
      elements.listView.style.display = 'none';
      elements.formView.style.display = 'block';
      logger.log('Restored draft from previous session');
    } else if (Object.keys(state.instances).length === 0) {
      // No instances configured - show add form directly
      logger.log('No instances configured, showing add form');
      showForm();
    }

    logger.log('Initialization complete');
  } catch (error) {
    logger.error('Initialization error:', error);
    showStatus('Failed to initialize: ' + error.message, 'error');
  }
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  elements.addInstanceBtn.addEventListener('click', () => {
    logger.log('Add instance button clicked');
    showForm();
  });

  elements.cancelBtn.addEventListener('click', hideForm);
  elements.saveInstanceBtn.addEventListener('click', handleSaveInstance);
  elements.testInstanceBtn.addEventListener('click', handleTestInstance);

  // Delegated events for instance items
  elements.instancesList.addEventListener('click', handleInstanceAction);

  // Form input validation
  elements.instanceUrlInput.addEventListener('blur', handleUrlBlur);

  // Save draft on input changes
  elements.instanceNameInput.addEventListener('input', saveDraft);
  elements.instanceUrlInput.addEventListener('input', saveDraft);
  elements.instanceApiKeyInput.addEventListener('input', saveDraft);
}

// =============================================================================
// INSTANCE MANAGEMENT
// =============================================================================

/**
 * Load instances from storage
 */
async function loadInstances() {
  try {
    const response = await sendMessage({ action: 'getAllInstances' });
    state.instances = response.success ? response.instances : {};
    logger.log('Loaded instances:', Object.keys(state.instances).length);
  } catch (error) {
    logger.error('Failed to load instances:', error);
    state.instances = {};
  }
}

/**
 * Render the instance list
 */
function renderInstanceList() {
  logger.log('Rendering instance list');
  elements.instancesList.innerHTML = '';

  const instanceArray = Object.values(state.instances);

  if (instanceArray.length === 0) {
    logger.log('No instances, showing empty state');
    elements.emptyState.style.display = 'block';
    elements.instancesList.style.display = 'none';
    return;
  }

  elements.emptyState.style.display = 'none';
  elements.instancesList.style.display = 'block';

  // Sort by last used (most recent first)
  const sortedInstances = instanceArray.sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

  // Use document fragment for better performance
  const fragment = document.createDocumentFragment();

  sortedInstances.forEach((instance) => {
    const li = createInstanceItem(instance);
    fragment.appendChild(li);
  });

  elements.instancesList.appendChild(fragment);
}

/**
 * Create an instance list item
 * @param {Object} instance - Instance data
 * @returns {HTMLLIElement} List item element
 */
function createInstanceItem(instance) {
  const li = document.createElement('li');
  li.className = 'instance-item';
  li.dataset.instanceId = instance.id;

  const parsed = safeParseUrl(instance.url);
  const displayHostname = parsed.isValid ? parsed.hostname : instance.url;

  li.innerHTML = `
    <div class="instance-info">
      <div class="instance-name">${escapeHtml(instance.name)}</div>
      <div class="instance-url">${escapeHtml(displayHostname)}</div>
    </div>
    <div class="instance-actions">
      <button class="btn-action btn-test" title="Test connection" data-action="test" aria-label="Test connection">&#8635;</button>
      <button class="btn-action btn-edit" title="Edit" data-action="edit" aria-label="Edit instance">&#9998;</button>
      <button class="btn-action btn-delete" title="Delete" data-action="delete" aria-label="Delete instance">&times;</button>
    </div>
  `;

  return li;
}

/**
 * Handle click actions on instance items
 * @param {Event} event - Click event
 */
function handleInstanceAction(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const instanceItem = button.closest('.instance-item');
  if (!instanceItem) return;

  const instanceId = instanceItem.dataset.instanceId;

  switch (action) {
    case 'edit':
      showForm(instanceId);
      break;
    case 'delete':
      handleDeleteInstance(instanceId);
      break;
    case 'test':
      handleTestInstanceById(instanceId, button);
      break;
  }
}

// =============================================================================
// FORM HANDLING
// =============================================================================

/**
 * Show the instance form
 * @param {string|null} instanceId - Instance ID for editing, null for new
 */
async function showForm(instanceId = null) {
  logger.log('Showing form for instanceId:', instanceId);
  state.editingInstanceId = instanceId;

  // Reset button states
  resetFormButtons();

  if (instanceId && state.instances[instanceId]) {
    const instance = state.instances[instanceId];
    elements.formTitle.textContent = 'Edit Instance';
    elements.instanceNameInput.value = instance.name;
    elements.instanceUrlInput.value = instance.url;
    elements.instanceApiKeyInput.value = instance.apiKey;
    updateSettingsLink(instance.url);
    // Clear any draft since we're editing an existing instance
    clearDraft();
    // For editing existing instance, show Save button directly (already tested)
    showSaveButton();
  } else {
    elements.formTitle.textContent = 'Add Instance';
    elements.instanceNameInput.value = '';
    elements.instanceUrlInput.value = '';
    elements.instanceApiKeyInput.value = '';
    elements.settingsLink.style.display = 'none';

    // Try to detect n8n URL from open tabs and prefill
    const detectedUrl = await detectN8nUrlFromTabs();
    if (detectedUrl) {
      elements.instanceUrlInput.value = detectedUrl;
      updateSettingsLink(detectedUrl);
      showStatus('URL detected from open tab', 'success');
    }
  }

  elements.listView.style.display = 'none';
  elements.formView.style.display = 'block';
  elements.instanceNameInput.focus();
}

/**
 * Reset form buttons to initial state (Test visible, Save hidden)
 */
function resetFormButtons() {
  elements.testInstanceBtn.style.display = 'inline-block';
  elements.testInstanceBtn.disabled = false;
  elements.testInstanceBtn.textContent = 'Test Connection';
  elements.saveInstanceBtn.style.display = 'none';
}

/**
 * Show Save button and hide Test button (after successful test)
 */
function showSaveButton() {
  elements.testInstanceBtn.style.display = 'none';
  elements.saveInstanceBtn.style.display = 'inline-block';
}

/**
 * Hide the form and return to list view
 * @param {boolean} clearSavedDraft - Whether to clear the saved draft (default: true)
 */
function hideForm(clearSavedDraft = true) {
  state.editingInstanceId = null;
  elements.listView.style.display = 'block';
  elements.formView.style.display = 'none';
  if (clearSavedDraft) {
    clearDraft();
  }
}

/**
 * Handle URL input blur event
 * Updates the settings link when URL changes
 */
function handleUrlBlur() {
  const url = elements.instanceUrlInput.value.trim();
  if (url) {
    updateSettingsLink(url);
  }
}

/**
 * Update the API settings link
 * @param {string} url - Instance URL
 */
function updateSettingsLink(url) {
  const parsed = safeParseUrl(url);
  if (parsed.isValid) {
    elements.settingsLink.href = `${parsed.origin}/settings/api`;
    elements.settingsLink.style.display = 'inline';
  } else {
    elements.settingsLink.style.display = 'none';
  }
}

// =============================================================================
// SAVE INSTANCE
// =============================================================================

/**
 * Handle save instance button click
 */
async function handleSaveInstance() {
  let name = elements.instanceNameInput.value.trim();
  const url = elements.instanceUrlInput.value.trim();
  const apiKey = elements.instanceApiKeyInput.value.trim();

  // Validate inputs
  const validation = validateInstanceInputs(name, url, apiKey);
  if (!validation.isValid) {
    showStatus(validation.error, 'error');
    return;
  }

  // Auto-generate name if empty
  if (!name) {
    name = generateInstanceName();
    logger.log('Auto-generated instance name:', name);
  }

  // Parse and normalize URL
  const parsed = safeParseUrl(url);
  if (!parsed.isValid) {
    showStatus('Invalid URL format', 'error');
    return;
  }

  // Request permission for this origin
  const permissionGranted = await requestOriginPermission(parsed.origin);
  if (!permissionGranted) {
    showStatus('Permission denied for this domain', 'error');
    return;
  }

  // Prepare instance data
  const instanceData = {
    id: state.editingInstanceId,
    name,
    url: parsed.origin,
    apiKey,
    createdAt: state.editingInstanceId
      ? state.instances[state.editingInstanceId]?.createdAt
      : Date.now(),
  };

  try {
    const response = await sendMessage({
      action: 'saveInstance',
      instanceData,
    });

    if (response.success) {
      // Clear draft on successful save
      clearDraft();
      showStatus('Instance saved!', 'success');
      await loadInstances();
      renderInstanceList();
      hideForm(false); // Don't clear draft again, already cleared

      // Notify any open tabs matching this instance URL to refresh/initialize
      await notifyMatchingTabs(parsed.origin);
    } else {
      showStatus(response.error || 'Failed to save instance', 'error');
    }
  } catch (error) {
    logger.error('Save instance error:', error);
    showStatus('Failed to save instance: ' + error.message, 'error');
  }
}

/**
 * Validate instance form inputs
 * @param {string} name - Instance name (optional, will be auto-generated if empty)
 * @param {string} url - Instance URL
 * @param {string} apiKey - API key
 * @returns {{isValid: boolean, error: string|null}}
 */
function validateInstanceInputs(name, url, apiKey) {
  // Name is optional - will be auto-generated if empty
  if (name && name.length > CONFIG.MAX_NAME_LENGTH) {
    return { isValid: false, error: `Name is too long (max ${CONFIG.MAX_NAME_LENGTH} characters)` };
  }

  if (!url) {
    return { isValid: false, error: 'Please enter an instance URL' };
  }

  if (!apiKey) {
    return { isValid: false, error: 'Please enter an API key' };
  }

  if (apiKey.length < CONFIG.MIN_API_KEY_LENGTH) {
    return { isValid: false, error: 'API key appears too short' };
  }

  return { isValid: true, error: null };
}

/**
 * Request permission for an origin
 * @param {string} origin - Origin URL
 * @returns {Promise<boolean>} Whether permission was granted
 */
async function requestOriginPermission(origin) {
  const permissionPattern = `${origin}/*`;

  try {
    // Check if we already have permission
    const hasPermission = await chrome.permissions.contains({
      origins: [permissionPattern],
    });

    if (hasPermission) {
      return true;
    }

    // Request permission
    const granted = await chrome.permissions.request({
      origins: [permissionPattern],
    });

    return granted;
  } catch (error) {
    logger.error('Permission request error:', error);
    return false;
  }
}

/**
 * Notify open tabs matching the instance origin to refresh/initialize sidebar
 * @param {string} origin - Instance origin URL
 */
async function notifyMatchingTabs(origin) {
  try {
    // Query all tabs and filter for ones matching this origin's workflow pages
    const allTabs = await chrome.tabs.query({});

    const matchingTabs = allTabs.filter((tab) => {
      if (!tab.url) return false;
      return tab.url.startsWith(origin) && tab.url.includes('/workflow/');
    });

    logger.log('Found', matchingTabs.length, 'matching tabs for', origin);

    // Send message to each matching tab
    for (const tab of matchingTabs) {
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'credentialsUpdated' });
        logger.log('Sent credentialsUpdated to tab', tab.id);
      } catch (err) {
        // Content script might not be loaded yet - try injecting it
        logger.log('Tab', tab.id, 'did not respond, attempting to reload');
        try {
          await chrome.tabs.reload(tab.id);
        } catch (reloadErr) {
          logger.error('Failed to reload tab:', reloadErr);
        }
      }
    }
  } catch (error) {
    logger.error('Failed to notify tabs:', error);
  }
}

// =============================================================================
// DELETE INSTANCE
// =============================================================================

/**
 * Handle delete instance
 * @param {string} instanceId - Instance ID to delete
 */
async function handleDeleteInstance(instanceId) {
  const instance = state.instances[instanceId];
  if (!instance) return;

  const confirmMessage = `Delete "${instance.name}"?`;
  if (!confirm(confirmMessage)) return;

  try {
    await sendMessage({
      action: 'deleteInstance',
      instanceId,
    });

    showStatus('Instance deleted', 'success');
    await loadInstances();
    renderInstanceList();
  } catch (error) {
    logger.error('Delete instance error:', error);
    showStatus('Failed to delete instance', 'error');
  }
}

// =============================================================================
// TEST CONNECTION
// =============================================================================

/**
 * Handle test instance button click (from form)
 */
async function handleTestInstance() {
  const url = elements.instanceUrlInput.value.trim();
  const apiKey = elements.instanceApiKeyInput.value.trim();

  if (!url || !apiKey) {
    showStatus('Enter URL and API key first', 'error');
    return;
  }

  // Disable button during test
  elements.testInstanceBtn.disabled = true;
  elements.testInstanceBtn.textContent = 'Testing...';

  try {
    // Create temporary instance for testing
    const tempId = crypto.randomUUID();
    const parsed = safeParseUrl(url);

    if (!parsed.isValid) {
      showStatus('Invalid URL format', 'error');
      return;
    }

    // Save temp instance
    await sendMessage({
      action: 'saveInstance',
      instanceData: {
        id: tempId,
        name: '_temp_test_',
        url: parsed.origin,
        apiKey,
        createdAt: Date.now(),
      },
    });

    // Test connection
    const response = await sendMessage({
      action: 'testConnection',
      instanceId: tempId,
    });

    // Clean up temp instance
    await sendMessage({
      action: 'deleteInstance',
      instanceId: tempId,
    });

    if (response.success) {
      showStatus(`Connected! Found ${response.count} workflows`, 'success');
      // Test successful - show Save button
      showSaveButton();
    } else {
      throw new Error(response.error || 'Connection failed');
    }
  } catch (error) {
    const errorMessage = getUserFriendlyError(error.message);
    showStatus(`Connection failed: ${errorMessage}`, 'error');
    // Re-enable Test button on failure so user can retry
    elements.testInstanceBtn.disabled = false;
    elements.testInstanceBtn.textContent = 'Test Connection';
  }
}

/**
 * Handle test connection from instance list
 * @param {string} instanceId - Instance ID
 * @param {HTMLButtonElement} button - Test button element
 */
async function handleTestInstanceById(instanceId, button) {
  const originalContent = button.textContent;
  button.textContent = '...';
  button.disabled = true;

  try {
    const response = await sendMessage({
      action: 'testConnection',
      instanceId,
    });

    const instance = state.instances[instanceId];
    const instanceName = instance?.name || 'Instance';

    if (response.success) {
      showStatus(`${instanceName}: ${response.count} workflows found`, 'success');
    } else {
      const errorMessage = getUserFriendlyError(response.error);
      showStatus(`${instanceName}: ${errorMessage}`, 'error');
    }
  } catch (error) {
    showStatus('Test failed: ' + error.message, 'error');
  } finally {
    button.textContent = originalContent;
    button.disabled = false;
  }
}

/**
 * Get user-friendly error message
 * @param {string} errorCode - Error code or message
 * @returns {string} User-friendly message
 */
function getUserFriendlyError(errorCode) {
  const errorMessages = {
    INVALID_API_KEY: 'Invalid API key',
    API_NOT_FOUND: 'API not found at this URL',
    NETWORK_ERROR: 'Network error - check your connection',
    INSTANCE_NOT_FOUND: 'Instance configuration not found',
  };

  return errorMessages[errorCode] || errorCode;
}

// =============================================================================
// STATUS MESSAGES
// =============================================================================

/**
 * Show a status message
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showStatus(message, type) {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message ${type}`;
  elements.statusMessage.classList.remove('hidden');

  // Auto-hide after timeout
  setTimeout(() => {
    elements.statusMessage.classList.add('hidden');
  }, CONFIG.STATUS_TIMEOUT_MS);
}
