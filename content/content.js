// n8n Workflow Sidebar - Content Script
// Injects workflow list into n8n's left sidebar

'use strict';

// =============================================================================
// DUPLICATE INJECTION GUARD
// =============================================================================

// Prevent the script from running twice (can happen with SPA navigation + manifest injection)
if (window.__n8nWorkflowSidebarLoaded) {
  console.log('[n8n-ext] Content script already loaded, skipping duplicate initialization');
  // If already loaded but on a new workflow page, just trigger a refresh
  if (window.__n8nWorkflowSidebarInit) {
    window.__n8nWorkflowSidebarInit();
  }
} else {
  window.__n8nWorkflowSidebarLoaded = true;
}

// Only continue with initialization if this is the first load
if (!window.__n8nWorkflowSidebarInitialized) {
  window.__n8nWorkflowSidebarInitialized = true;

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

const CONFIG = Object.freeze({
  LOG_PREFIX: '[n8n-ext]',
  WORKFLOW_URL_PATTERN: /\/workflow\/([a-zA-Z0-9]+)/,
  INIT_DELAY_MS: 1000,
  SIDEBAR_TIMEOUT_MS: 10000,
  SEARCH_DEBOUNCE_MS: 300,
  REQUEST_TIMEOUT_MS: 30000,
  STATUS_TIMEOUT_MS: 5000,
  MAX_DOM_DEPTH: 10,
});

// Error message mappings for user-friendly display
const ERROR_MESSAGES = Object.freeze({
  NO_INSTANCE_URL: 'Please configure your n8n instance URL in settings',
  API_KEY_MISSING: 'Please configure your API key in extension settings',
  INVALID_API_KEY: 'Invalid API key. Please check settings.',
  API_NOT_FOUND: 'n8n API not found. Check your instance.',
  NETWORK_ERROR: 'Network error. Check your connection.',
  INSTANCE_NOT_FOUND: 'Instance not found. Please reconfigure.',
  INSTANCE_ID_REQUIRED: 'No instance configured for this page.',
  STORAGE_ERROR: 'Storage error. Please reload the page.',
});

// =============================================================================
// LOGGING UTILITY
// =============================================================================

const logger = {
  _enabled: true,

  log(...args) {
    if (this._enabled) {
      console.log(CONFIG.LOG_PREFIX, ...args);
    }
  },

  warn(...args) {
    if (this._enabled) {
      console.warn(CONFIG.LOG_PREFIX, ...args);
    }
  },

  error(...args) {
    console.error(CONFIG.LOG_PREFIX, ...args);
  },
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * Application state container
 * @type {{
 *   workflowsData: Array,
 *   currentWorkflowId: string|null,
 *   currentInstanceId: string|null,
 *   isInjected: boolean,
 *   urlObserver: MutationObserver|null
 * }}
 */
const state = {
  workflowsData: [],
  currentWorkflowId: null,
  currentInstanceId: null,
  isInjected: false,
  urlObserver: null,
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} unsafe - Unsafe string that may contain HTML
 * @returns {string} Escaped safe string
 */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Debounce function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Get user-friendly error message from error code
 * @param {string} errorCode - Error code or message
 * @returns {string} User-friendly message
 */
function getUserFriendlyError(errorCode) {
  return ERROR_MESSAGES[errorCode] || errorCode;
}

// =============================================================================
// CHROME RUNTIME COMMUNICATION
// =============================================================================

/**
 * Send message to service worker with timeout
 * @param {Object} message - Message to send
 * @returns {Promise<Object>} Response from service worker
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, CONFIG.REQUEST_TIMEOUT_MS);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

// =============================================================================
// DOM UTILITIES
// =============================================================================

/**
 * Find visible element by text content
 * @param {string} text - Text to search for
 * @param {string} selectors - CSS selectors to search within
 * @param {Element} container - Container to search within (defaults to document)
 * @returns {Element|null} Found element or null
 */
function findVisibleElementByText(text, selectors = 'a, button, div', container = document) {
  const elements = container.querySelectorAll(selectors);
  for (const el of elements) {
    if (el.textContent.trim() === text && el.offsetHeight > 0) {
      return el;
    }
  }
  return null;
}

/**
 * Find the sidebar menu by looking for specific n8n menu items
 * Uses content-based detection for robustness against DOM changes
 * @returns {Element|null} Sidebar container element
 */
function findSidebarByContent() {
  logger.log('Searching for sidebar using menu item anchors...');

  // Strategy 1: Find "Personal" menu item in the LEFT sidebar only
  // First, find all elements with "Personal" text
  const allPersonalElements = document.querySelectorAll('a, button, div, span');

  for (const el of allPersonalElements) {
    if (el.textContent.trim() === 'Personal' && el.offsetHeight > 0) {
      // Check if this element is on the left side of the screen
      const elRect = el.getBoundingClientRect();
      if (elRect.left < 250) {
        logger.log('Found "Personal" menu item on left side at x:', elRect.left);

        const container = findMenuContainer(el);
        if (container) {
          logger.log('Found menu container via Personal:', container.tagName, container.className);
          return container;
        }
      }
    }
  }

  // Strategy 2: Find "Overview" in the left sidebar
  for (const el of allPersonalElements) {
    if (el.textContent.trim() === 'Overview' && el.offsetHeight > 0) {
      const elRect = el.getBoundingClientRect();
      if (elRect.left < 250) {
        logger.log('Found "Overview" menu item on left side at x:', elRect.left);

        const container = findMenuContainer(el);
        if (container) {
          logger.log('Found menu container via Overview:', container.tagName, container.className);
          return container;
        }
      }
    }
  }

  logger.warn('Could not find sidebar container');
  return null;
}

/**
 * Walk up DOM tree to find menu container
 * Must be on the left side of the screen to be valid
 * @param {Element} startElement - Element to start from
 * @returns {Element|null} Menu container or null
 */
function findMenuContainer(startElement) {
  let container = startElement.parentElement;
  let depth = 0;

  while (container && depth < CONFIG.MAX_DOM_DEPTH) {
    const text = container.textContent || '';

    // Look for a container that has multiple menu items
    const hasRequiredItems =
      text.includes('Overview') &&
      text.includes('Personal') &&
      text.includes('Templates');

    if (hasRequiredItems) {
      // Verify this container is on the left side of the screen
      const rect = container.getBoundingClientRect();
      if (rect.left < 100 && rect.width < 400) {
        return container;
      }
      // If not on left side, this is probably the wrong container, keep searching
      logger.log('Found container with menu items but not in sidebar position, continuing search');
    }

    container = container.parentElement;
    depth++;
  }

  return null;
}

// =============================================================================
// INITIALIZATION
// =============================================================================

/**
 * Initialize the content script
 * Detects instance, checks if on workflow page, and injects sidebar
 */
async function init() {
  logger.log('Content script initializing');

  try {
    // Auto-detect which instance matches current page
    const currentOrigin = window.location.origin;

    const response = await sendMessage({
      action: 'getInstanceByOrigin',
      origin: currentOrigin,
    });

    if (!response?.success || !response?.instance) {
      logger.log('No instance configured for:', currentOrigin);
      return;
    }

    state.currentInstanceId = response.instance.id;
    logger.log('Detected instance:', response.instance.name);
  } catch (error) {
    logger.error('Init error:', error.message);
    return;
  }

  // Check if we're on a workflow page
  const match = window.location.pathname.match(CONFIG.WORKFLOW_URL_PATTERN);
  if (!match) {
    logger.log('Not a workflow page, skipping injection');
    return;
  }

  state.currentWorkflowId = match[1];
  logger.log('Current workflow ID:', state.currentWorkflowId);

  // Wait for sidebar to be ready
  const sidebar = await waitForSidebar();
  if (sidebar) {
    logger.log('Sidebar found, injecting workflow section');
    injectWorkflowSection();
    loadWorkflows();
  } else {
    logger.error('Sidebar not found after timeout');
  }

  // Handle SPA navigation
  observeUrlChanges();
}

/**
 * Wait for n8n sidebar to appear in DOM
 * @returns {Promise<Element|null>} Sidebar element or null if timeout
 */
function waitForSidebar() {
  // Try to find sidebar immediately
  const sidebar = findSidebarByContent();
  if (sidebar) {
    return Promise.resolve(sidebar);
  }

  // If not found, wait using MutationObserver
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const sidebar = findSidebarByContent();
      if (sidebar) {
        logger.log('Sidebar appeared in DOM');
        observer.disconnect();
        resolve(sidebar);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Timeout after configured duration
    setTimeout(() => {
      observer.disconnect();
      logger.error('Sidebar not found after timeout');
      resolve(null);
    }, CONFIG.SIDEBAR_TIMEOUT_MS);
  });
}

// =============================================================================
// UI INJECTION
// =============================================================================

/**
 * Inject workflow section into sidebar
 */
function injectWorkflowSection() {
  if (state.isInjected) {
    logger.log('Already injected, skipping');
    return;
  }

  const sidebar = findSidebarByContent();
  if (!sidebar) {
    logger.error('Sidebar not found for injection');
    return;
  }

  logger.log('Injecting into sidebar:', sidebar.tagName, sidebar.className);

  // Create workflow section
  const section = createWorkflowSection();

  // Insert section into DOM
  insertSection(sidebar, section);

  // Attach event listeners
  attachEventListeners();

  state.isInjected = true;
  logger.log('Workflow section injected successfully');

  // Log position for debugging
  const rect = section.getBoundingClientRect();
  logger.log('Section position:', {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    visible: rect.width > 0 && rect.height > 0,
  });
}

/**
 * Create the workflow section DOM element
 * @returns {HTMLDivElement} Workflow section element
 */
function createWorkflowSection() {
  const section = document.createElement('div');
  section.id = 'n8n-workflow-ext-section';
  section.className = 'n8n-workflow-ext-section';

  section.innerHTML = `
    <div class="n8n-wf-header">
      <h3>My Workflows</h3>
      <button id="n8n-wf-refresh" class="n8n-wf-refresh" title="Refresh workflows" aria-label="Refresh workflows">
        <span aria-hidden="true">&#8635;</span>
      </button>
    </div>
    <input
      type="search"
      id="n8n-wf-search"
      class="n8n-wf-search"
      placeholder="Search workflows..."
      aria-label="Search workflows"
    >
    <select id="n8n-wf-sort" class="n8n-wf-sort" title="Sort workflows" aria-label="Sort workflows">
      <option value="updatedAt">Updated (Recent)</option>
      <option value="name">Name (A-Z)</option>
      <option value="createdAt">Created (Recent)</option>
    </select>
    <div class="n8n-wf-filters" role="group" aria-label="Workflow filters">
      <label>
        <input type="checkbox" id="filter-active" checked> Active
      </label>
      <label>
        <input type="checkbox" id="filter-inactive" checked> Inactive
      </label>
    </div>
    <ul id="n8n-wf-list" class="n8n-wf-list" role="listbox" aria-label="Workflows">
      <li class="n8n-wf-loading" role="status">Loading workflows...</li>
    </ul>
    <div class="n8n-wf-stats" id="n8n-wf-stats" aria-live="polite"></div>
  `;

  return section;
}

/**
 * Insert section into sidebar at appropriate location
 * @param {Element} sidebar - Sidebar container
 * @param {Element} section - Section to insert
 */
function insertSection(sidebar, section) {
  // Try to insert after "Personal" menu item (search within sidebar only)
  const personalItem = findVisibleElementByText('Personal', 'a, button, div', sidebar);

  if (personalItem) {
    logger.log('Found "Personal" item, inserting workflow section after it');

    // Find the actual menu item element (might need to go up a level)
    let insertAfter = personalItem;
    if (personalItem.parentElement && personalItem.parentElement.tagName !== 'NAV') {
      insertAfter = personalItem.parentElement;
    }

    insertAfter.insertAdjacentElement('afterend', section);
    logger.log('Inserted after Personal menu item');
    return;
  }

  // Fallback: look for Templates and insert before it (search within sidebar only)
  const templatesItem = findVisibleElementByText('Templates', 'a, button, div', sidebar);

  if (templatesItem) {
    logger.log('Found "Templates" item, inserting workflow section before it');

    let insertBefore = templatesItem;
    if (templatesItem.parentElement && templatesItem.parentElement.tagName !== 'NAV') {
      insertBefore = templatesItem.parentElement;
    }

    insertBefore.insertAdjacentElement('beforebegin', section);
    logger.log('Inserted before Templates menu item');
    return;
  }

  // Last resort: append to sidebar
  logger.log('Could not find Personal or Templates, appending to sidebar');
  sidebar.appendChild(section);
}

// =============================================================================
// EVENT HANDLING
// =============================================================================

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Refresh button
  const refreshButton = document.getElementById('n8n-wf-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', handleRefresh);
  }

  // Search input with debounce
  const searchInput = document.getElementById('n8n-wf-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, CONFIG.SEARCH_DEBOUNCE_MS));
  }

  // Filter checkboxes
  const activeFilter = document.getElementById('filter-active');
  const inactiveFilter = document.getElementById('filter-inactive');

  if (activeFilter) {
    activeFilter.addEventListener('change', handleFilterChange);
  }

  if (inactiveFilter) {
    inactiveFilter.addEventListener('change', handleFilterChange);
  }

  // Sort dropdown
  const sortSelect = document.getElementById('n8n-wf-sort');
  if (sortSelect) {
    loadSortPreference(sortSelect);
    sortSelect.addEventListener('change', handleSortChange);
  }
}

/**
 * Handle refresh button click
 */
function handleRefresh() {
  logger.log('Refresh clicked');
  loadWorkflows(true);
}

/**
 * Handle search input
 * @param {Event} event - Input event
 */
function handleSearch(event) {
  logger.log('Search:', event.target.value);
  filterWorkflows(event.target.value);
}

/**
 * Handle filter checkbox change
 */
function handleFilterChange() {
  filterWorkflows();
}

/**
 * Handle sort dropdown change
 * @param {Event} event - Change event
 */
function handleSortChange(event) {
  const sortBy = event.target.value;
  logger.log('Sort by:', sortBy);

  // Save preference
  chrome.storage.local.set({ workflowSort: sortBy });

  // Re-filter and sort
  filterWorkflows();
}

/**
 * Load sort preference from storage
 * @param {HTMLSelectElement} sortSelect - Sort select element
 */
function loadSortPreference(sortSelect) {
  chrome.storage.local.get(['workflowSort'], (result) => {
    if (result.workflowSort) {
      sortSelect.value = result.workflowSort;
    }
  });
}

// =============================================================================
// WORKFLOW LOADING AND RENDERING
// =============================================================================

/**
 * Load workflows from service worker using API key authentication
 * @param {boolean} forceRefresh - Force reload from API
 */
async function loadWorkflows(forceRefresh = false) {
  const listElement = document.getElementById('n8n-wf-list');
  if (!listElement) return;

  // Show loading state
  listElement.innerHTML = '<li class="n8n-wf-loading" role="status">Loading workflows...</li>';

  if (!state.currentInstanceId) {
    showError('No instance configured for this page');
    return;
  }

  try {
    const response = await sendMessage({
      action: forceRefresh ? 'refreshWorkflows' : 'fetchWorkflows',
      instanceId: state.currentInstanceId,
      options: {},
    });

    logger.log('Service worker response received');

    if (!response?.success) {
      throw new Error(response?.error || 'No response from service worker');
    }

    state.workflowsData = response.data || [];
    filterWorkflows();
    updateStats(state.workflowsData, response.cached);
  } catch (error) {
    logger.error('Load workflows error:', error.message);
    showError(error.message);
  }
}

/**
 * Render workflows in the list
 * @param {Array} workflows - Array of workflow objects
 */
function renderWorkflows(workflows) {
  const listElement = document.getElementById('n8n-wf-list');
  if (!listElement) {
    logger.error('List element not found');
    return;
  }

  if (!workflows || workflows.length === 0) {
    listElement.innerHTML = '<li class="n8n-wf-empty" role="status">No workflows found</li>';
    return;
  }

  // Clear existing content
  listElement.innerHTML = '';

  // Create document fragment for better performance
  const fragment = document.createDocumentFragment();

  workflows.forEach((workflow) => {
    const li = createWorkflowItem(workflow);
    fragment.appendChild(li);
  });

  listElement.appendChild(fragment);
  logger.log('Rendered', workflows.length, 'workflows');
}

/**
 * Create a workflow list item
 * @param {Object} workflow - Workflow object
 * @returns {HTMLLIElement} List item element
 */
function createWorkflowItem(workflow) {
  const li = document.createElement('li');
  li.className = 'n8n-wf-item';
  li.role = 'option';
  li.tabIndex = 0;

  // Highlight current workflow
  if (workflow.id === state.currentWorkflowId) {
    li.classList.add('n8n-wf-active');
    li.setAttribute('aria-selected', 'true');
  }

  li.dataset.workflowId = workflow.id;

  const statusClass = workflow.active ? 'active' : 'inactive';
  const statusLabel = workflow.active ? 'Active workflow' : 'Inactive workflow';

  li.innerHTML = `
    <span class="n8n-wf-status ${statusClass}" aria-label="${statusLabel}"></span>
    <span class="n8n-wf-name">${escapeHtml(workflow.name)}</span>
  `;

  // Click handler
  li.addEventListener('click', () => navigateToWorkflow(workflow.id));

  // Keyboard handler for accessibility
  li.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      navigateToWorkflow(workflow.id);
    }
  });

  return li;
}

// =============================================================================
// FILTERING AND SORTING
// =============================================================================

/**
 * Filter workflows based on search and checkboxes
 * @param {string|null} searchQuery - Search query (optional)
 */
function filterWorkflows(searchQuery = null) {
  const search = searchQuery !== null
    ? searchQuery
    : (document.getElementById('n8n-wf-search')?.value || '');

  const showActive = document.getElementById('filter-active')?.checked ?? true;
  const showInactive = document.getElementById('filter-inactive')?.checked ?? true;

  const filtered = state.workflowsData.filter((wf) => {
    // Status filter
    if (wf.active && !showActive) return false;
    if (!wf.active && !showInactive) return false;

    // Search filter (case-insensitive)
    if (search) {
      const searchLower = search.toLowerCase();
      const nameLower = (wf.name || '').toLowerCase();
      if (!nameLower.includes(searchLower)) {
        return false;
      }
    }

    return true;
  });

  // Apply sorting
  const sortBy = document.getElementById('n8n-wf-sort')?.value || 'updatedAt';
  const sorted = sortWorkflows(filtered, sortBy);

  renderWorkflows(sorted);
}

/**
 * Sort workflows by given criteria
 * @param {Array} workflows - Workflows to sort
 * @param {string} sortBy - Sort criteria ('updatedAt', 'createdAt', 'name')
 * @returns {Array} Sorted workflows (new array)
 */
function sortWorkflows(workflows, sortBy) {
  return [...workflows].sort((a, b) => {
    switch (sortBy) {
      case 'updatedAt':
      case 'createdAt': {
        // Sort by timestamp (descending - most recent first)
        const timeA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
        const timeB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
        return timeB - timeA;
      }
      case 'name': {
        // Sort alphabetically (A-Z)
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      }
      default:
        return 0;
    }
  });
}

// =============================================================================
// NAVIGATION
// =============================================================================

/**
 * Navigate to a workflow
 * @param {string} workflowId - Workflow ID
 */
async function navigateToWorkflow(workflowId) {
  if (!state.currentInstanceId) {
    showError('No instance configured');
    return;
  }

  try {
    const response = await sendMessage({
      action: 'getInstanceById',
      instanceId: state.currentInstanceId,
    });

    if (!response?.success || !response?.instance) {
      showError('Instance not found');
      return;
    }

    const targetUrl = `${response.instance.url}/workflow/${workflowId}`;
    logger.log('Navigating to workflow:', targetUrl);
    window.location.href = targetUrl;
  } catch (error) {
    logger.error('Navigation error:', error.message);
    showError('Failed to navigate');
  }
}

// =============================================================================
// UI UPDATES
// =============================================================================

/**
 * Update stats footer
 * @param {Array} workflows - Array of workflows
 * @param {boolean} cached - Whether data was from cache
 */
function updateStats(workflows, cached = false) {
  const statsElement = document.getElementById('n8n-wf-stats');
  if (!statsElement) return;

  const totalCount = workflows.length;
  const activeCount = workflows.filter((wf) => wf.active).length;
  const now = new Date().toLocaleTimeString();
  const cacheIndicator = cached ? ' (cached)' : '';
  const workflowLabel = totalCount === 1 ? 'workflow' : 'workflows';

  statsElement.innerHTML = `
    <small>${totalCount} ${workflowLabel} (${activeCount} active) | Updated: ${now}${cacheIndicator}</small>
  `;
}

/**
 * Show error message in list
 * @param {string} message - Error message or error code
 */
function showError(message) {
  const listElement = document.getElementById('n8n-wf-list');
  if (!listElement) return;

  const displayMessage = getUserFriendlyError(message);

  listElement.innerHTML = `
    <li class="n8n-wf-error" role="alert">
      <span class="error-icon" aria-hidden="true">&#9888;</span>
      <span>${escapeHtml(displayMessage)}</span>
      <button class="n8n-wf-settings-link" id="open-settings">Open Settings</button>
    </li>
  `;

  // Add click handler for settings link
  const settingsButton = document.getElementById('open-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage();
      } else {
        alert('Please click the extension icon to open settings');
      }
    });
  }
}

// =============================================================================
// SPA NAVIGATION HANDLING
// =============================================================================

/**
 * Observe URL changes for SPA navigation
 * Uses throttled MutationObserver to detect URL changes
 */
function observeUrlChanges() {
  // Disconnect existing observer if any
  if (state.urlObserver) {
    state.urlObserver.disconnect();
  }

  let lastUrl = window.location.href;
  let throttleTimeout = null;

  state.urlObserver = new MutationObserver(() => {
    // Throttle checks to avoid excessive processing
    if (throttleTimeout) return;

    throttleTimeout = setTimeout(() => {
      throttleTimeout = null;

      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        handleUrlChange();
      }
    }, 100);
  });

  state.urlObserver.observe(document, {
    subtree: true,
    childList: true,
  });
}

/**
 * Handle URL change in SPA
 */
function handleUrlChange() {
  const match = window.location.pathname.match(CONFIG.WORKFLOW_URL_PATTERN);

  if (match) {
    state.currentWorkflowId = match[1];
    logger.log('URL changed, new workflow ID:', state.currentWorkflowId);

    // Re-highlight active workflow
    updateActiveWorkflowHighlight();
  }
}

/**
 * Update active workflow highlighting
 */
function updateActiveWorkflowHighlight() {
  const items = document.querySelectorAll('.n8n-wf-item');

  items.forEach((item) => {
    const isActive = item.dataset.workflowId === state.currentWorkflowId;
    item.classList.toggle('n8n-wf-active', isActive);
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// =============================================================================
// MESSAGE LISTENER
// =============================================================================

/**
 * Listen for messages from popup (e.g., when credentials are updated)
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'credentialsUpdated') {
    logger.log('Received credentialsUpdated message');

    // If sidebar not yet injected and on a workflow page, try to initialize
    if (!state.isInjected) {
      init();
    } else {
      // Already injected, just refresh workflows
      loadWorkflows(true);
    }

    sendResponse({ success: true });
  }
  return true; // Keep channel open for async response
});

// =============================================================================
// INITIALIZATION ENTRY POINT
// =============================================================================

// Expose init function globally for re-injection scenarios
window.__n8nWorkflowSidebarInit = init;

// Initialize with a delay to let n8n load
// Note: init() is called once via setTimeout - do NOT add additional calls
setTimeout(init, CONFIG.INIT_DELAY_MS);

logger.log('Content script file loaded at:', window.location.href);

} // End of duplicate injection guard
