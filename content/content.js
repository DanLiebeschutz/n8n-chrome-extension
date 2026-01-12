// n8n Workflow Sidebar - Content Script
// Injects workflow list into n8n's left sidebar

console.log('[n8n-ext] Content script file loaded at:', window.location.href);

// Constants
const WORKFLOW_URL_PATTERN = /\/workflow\/([a-zA-Z0-9]+)/;

// Find the sidebar menu by looking for specific n8n menu items
function findSidebarByContent() {
  console.log('[n8n-ext] Searching for sidebar using menu item anchors...');

  // Strategy 1: Find "Personal" menu item and get its parent container
  const personalLink = Array.from(document.querySelectorAll('a, button, div')).find(el => {
    return el.textContent.trim() === 'Personal' && el.offsetHeight > 0;
  });

  if (personalLink) {
    console.log('[n8n-ext] Found "Personal" menu item:', personalLink);

    // Walk up the DOM to find the menu container
    let container = personalLink.parentElement;
    let depth = 0;

    while (container && depth < 10) {
      const rect = container.getBoundingClientRect();
      const text = container.textContent || '';

      // Look for a container that has multiple menu items
      const hasOverview = text.includes('Overview');
      const hasPersonal = text.includes('Personal');
      const hasTemplates = text.includes('Templates');

      if (hasOverview && hasPersonal && hasTemplates) {
        console.log('[n8n-ext] ✓ Found menu container:', container.tagName, container.className);
        return container;
      }

      container = container.parentElement;
      depth++;
    }
  }

  // Strategy 2: Find "Overview" and look for its parent
  const overviewLink = Array.from(document.querySelectorAll('a, button, div')).find(el => {
    return el.textContent.trim() === 'Overview' && el.offsetHeight > 0;
  });

  if (overviewLink) {
    console.log('[n8n-ext] Found "Overview" menu item:', overviewLink);
    let container = overviewLink.parentElement;
    let depth = 0;

    while (container && depth < 10) {
      const text = container.textContent || '';
      if (text.includes('Overview') && text.includes('Personal') && text.includes('Templates')) {
        console.log('[n8n-ext] ✓ Found menu container via Overview:', container.tagName, container.className);
        return container;
      }
      container = container.parentElement;
      depth++;
    }
  }

  console.warn('[n8n-ext] Could not find sidebar container');
  return null;
}

// State
let workflowsData = [];
let currentWorkflowId = null;
let currentInstanceId = null;
let isInjected = false;

// Initialize with a delay to let n8n load
setTimeout(init, 1000); // Wait 1 second for n8n to initialize

async function init() {
  console.log('[n8n-ext] Content script loaded');

  try {
    // Auto-detect which instance matches current page
    const currentOrigin = window.location.origin;

    const response = await chrome.runtime.sendMessage({
      action: 'getInstanceByOrigin',
      origin: currentOrigin
    });

    if (chrome.runtime.lastError) {
      console.error('[n8n-ext] Runtime error:', chrome.runtime.lastError.message);
      return;
    }

    if (!response || !response.success || !response.instance) {
      console.log('[n8n-ext] No instance configured for:', currentOrigin);
      return;
    }

    currentInstanceId = response.instance.id;
    console.log('[n8n-ext] Detected instance:', response.instance.name, currentInstanceId);
  } catch (error) {
    console.error('[n8n-ext] Init error:', error);
    return;
  }

  // Check if we're on a workflow page
  const match = window.location.pathname.match(WORKFLOW_URL_PATTERN);
  if (!match) {
    console.log('[n8n-ext] Not a workflow page, skipping injection');
    return;
  }

  currentWorkflowId = match[1];
  console.log('[n8n-ext] Current workflow ID:', currentWorkflowId);

  // Wait for sidebar to be ready
  waitForSidebar().then((sidebar) => {
    if (sidebar) {
      console.log('[n8n-ext] Sidebar found, injecting workflow section');
      injectWorkflowSection();
      loadWorkflows();
    } else {
      console.error('[n8n-ext] Sidebar not found after timeout');
    }
  });

  // Handle SPA navigation
  observeUrlChanges();
}

/**
 * Wait for n8n sidebar to appear in DOM
 * @returns {Promise<Element|null>} Sidebar element or null if timeout
 */
async function waitForSidebar() {
  // Try to find sidebar immediately by content
  let sidebar = findSidebarByContent();
  if (sidebar) {
    return sidebar;
  }

  // If not found, wait using MutationObserver
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const sidebar = findSidebarByContent();
      if (sidebar) {
        console.log('[n8n-ext] Sidebar appeared in DOM');
        observer.disconnect();
        resolve(sidebar);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      observer.disconnect();
      console.error('[n8n-ext] Sidebar not found after timeout');
      resolve(null);
    }, 10000);
  });
}

/**
 * Inject workflow section into sidebar
 */
function injectWorkflowSection() {
  if (isInjected) {
    console.log('[n8n-ext] Already injected, skipping');
    return;
  }

  const sidebar = findSidebar();
  if (!sidebar) {
    console.error('[n8n-ext] Sidebar not found for injection');
    return;
  }

  console.log('[n8n-ext] Injecting into sidebar:', sidebar.tagName, sidebar.className);

  // Check if this looks like the correct sidebar (should contain navigation items)
  const hasNavItems = sidebar.querySelector('a, button, [role="menuitem"]');
  if (!hasNavItems) {
    console.warn('[n8n-ext] Sidebar element may not be the navigation menu');
  }

  // Create workflow section container
  const section = document.createElement('div');
  section.id = 'n8n-workflow-ext-section';
  section.className = 'n8n-workflow-ext-section';

  section.innerHTML = `
    <div class="n8n-wf-header">
      <h3>My Workflows</h3>
      <button id="n8n-wf-refresh" class="n8n-wf-refresh" title="Refresh workflows">
        ↻
      </button>
    </div>
    <input
      type="search"
      id="n8n-wf-search"
      class="n8n-wf-search"
      placeholder="Search workflows..."
    >
    <select id="n8n-wf-sort" class="n8n-wf-sort" title="Sort workflows">
      <option value="updatedAt">Updated (Recent)</option>
      <option value="name">Name (A-Z)</option>
      <option value="createdAt">Created (Recent)</option>
    </select>
    <div class="n8n-wf-filters">
      <label>
        <input type="checkbox" id="filter-active" checked> Active
      </label>
      <label>
        <input type="checkbox" id="filter-inactive" checked> Inactive
      </label>
    </div>
    <ul id="n8n-wf-list" class="n8n-wf-list">
      <li class="n8n-wf-loading">Loading workflows...</li>
    </ul>
    <div class="n8n-wf-stats" id="n8n-wf-stats"></div>
  `;

  // Insert AFTER the "Personal" menu item
  const personalItem = Array.from(sidebar.querySelectorAll('a, button, div')).find(el => {
    return el.textContent.trim() === 'Personal' && el.offsetHeight > 0;
  });

  if (personalItem) {
    console.log('[n8n-ext] Found "Personal" item, inserting workflow section after it');

    // Find the actual menu item element (might need to go up a level or two)
    let insertAfter = personalItem;

    // If Personal is a link inside a div/li, use the parent
    if (personalItem.parentElement && personalItem.parentElement.tagName !== 'NAV') {
      insertAfter = personalItem.parentElement;
    }

    // Insert after the Personal item
    insertAfter.insertAdjacentElement('afterend', section);
    console.log('[n8n-ext] Inserted after Personal menu item');
  } else {
    // Fallback: look for Templates and insert before it
    const templatesItem = Array.from(sidebar.querySelectorAll('a, button, div')).find(el => {
      return el.textContent.trim() === 'Templates' && el.offsetHeight > 0;
    });

    if (templatesItem) {
      console.log('[n8n-ext] Found "Templates" item, inserting workflow section before it');
      let insertBefore = templatesItem;

      if (templatesItem.parentElement && templatesItem.parentElement.tagName !== 'NAV') {
        insertBefore = templatesItem.parentElement;
      }

      insertBefore.insertAdjacentElement('beforebegin', section);
      console.log('[n8n-ext] Inserted before Templates menu item');
    } else {
      // Last resort: append to sidebar
      console.log('[n8n-ext] Could not find Personal or Templates, appending to sidebar');
      sidebar.appendChild(section);
    }
  }

  // Attach event listeners
  attachEventListeners();

  isInjected = true;
  console.log('[n8n-ext] Workflow section injected successfully');

  // Verify it's visible
  const rect = section.getBoundingClientRect();
  console.log('[n8n-ext] Section position:', { x: rect.x, y: rect.y, width: rect.width, height: rect.height, visible: rect.width > 0 && rect.height > 0 });

  // Check parent container
  console.log('[n8n-ext] Parent element:', sidebar.tagName, sidebar.className);
  console.log('[n8n-ext] Parent dimensions:', { width: sidebar.offsetWidth, height: sidebar.offsetHeight });
}

/**
 * Find sidebar element
 * @returns {Element|null} Sidebar element or null
 */
function findSidebar() {
  return findSidebarByContent();
}

/**
 * Attach event listeners to UI elements
 */
function attachEventListeners() {
  // Refresh button
  const refreshButton = document.getElementById('n8n-wf-refresh');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      console.log('[n8n-ext] Refresh clicked');
      loadWorkflows(true);
    });
  }

  // Search input
  const searchInput = document.getElementById('n8n-wf-search');
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      console.log('[n8n-ext] Search:', e.target.value);
      filterWorkflows(e.target.value);
    }, 300));
  }

  // Filter checkboxes
  const activeFilter = document.getElementById('filter-active');
  const inactiveFilter = document.getElementById('filter-inactive');

  if (activeFilter) {
    activeFilter.addEventListener('change', () => {
      console.log('[n8n-ext] Active filter:', activeFilter.checked);
      filterWorkflows();
    });
  }

  if (inactiveFilter) {
    inactiveFilter.addEventListener('change', () => {
      console.log('[n8n-ext] Inactive filter:', inactiveFilter.checked);
      filterWorkflows();
    });
  }

  // Sort dropdown
  const sortSelect = document.getElementById('n8n-wf-sort');
  if (sortSelect) {
    // Load saved sort preference
    chrome.storage.local.get(['workflowSort'], (result) => {
      if (result.workflowSort) {
        sortSelect.value = result.workflowSort;
      }
    });

    sortSelect.addEventListener('change', (e) => {
      const sortBy = e.target.value;
      console.log('[n8n-ext] Sort by:', sortBy);

      // Save preference
      chrome.storage.local.set({workflowSort: sortBy});

      // Re-filter and sort
      filterWorkflows();
    });
  }
}

/**
 * Load workflows from service worker
 * @param {boolean} forceRefresh - Force reload from API
 */
async function loadWorkflows(forceRefresh = false) {
  const listElement = document.getElementById('n8n-wf-list');
  if (!listElement) return;

  // Show loading state
  listElement.innerHTML = '<li class="n8n-wf-loading">Loading workflows...</li>';

  if (!currentInstanceId) {
    showError('No instance configured for this page');
    return;
  }

  try {
    // Request workflows from service worker with timeout
    const response = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, 30000); // 30 second timeout

      chrome.runtime.sendMessage({
        action: forceRefresh ? 'refreshWorkflows' : 'fetchWorkflows',
        instanceId: currentInstanceId,
        options: {}
      }, (response) => {
        clearTimeout(timeout);

        // Check for Chrome runtime errors
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    });

    console.log('[n8n-ext] Workflow response:', response);

    if (!response || !response.success) {
      throw new Error(response?.error || 'No response from service worker');
    }

    workflowsData = response.data || [];
    renderWorkflows(workflowsData);
    updateStats(workflowsData, response.cached);

  } catch (error) {
    console.error('[n8n-ext] Load workflows error:', error);
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
    console.error('[n8n-ext] List element not found!');
    return;
  }

  if (workflows.length === 0) {
    listElement.innerHTML = '<li class="n8n-wf-empty">No workflows found</li>';
    return;
  }

  listElement.innerHTML = '';

  workflows.forEach((workflow, index) => {
    const li = document.createElement('li');
    li.className = 'n8n-wf-item';

    // Highlight current workflow
    if (workflow.id === currentWorkflowId) {
      li.classList.add('n8n-wf-active');
    }

    li.dataset.workflowId = workflow.id;

    li.innerHTML = `
      <span class="n8n-wf-status ${workflow.active ? 'active' : 'inactive'}"></span>
      <span class="n8n-wf-name">${escapeHtml(workflow.name)}</span>
    `;

    li.addEventListener('click', () => {
      navigateToWorkflow(workflow.id);
    });

    listElement.appendChild(li);

    // Debug first few items
    if (index < 3) {
      console.log(`[n8n-ext] Rendered workflow ${index + 1}:`, workflow.name, 'ID:', workflow.id);
    }
  });

  console.log('[n8n-ext] Rendered', workflows.length, 'workflows');

  // Check if list is actually visible
  const listRect = listElement.getBoundingClientRect();
  console.log('[n8n-ext] List position:', { x: listRect.x, y: listRect.y, width: listRect.width, height: listRect.height });
  console.log('[n8n-ext] List has', listElement.children.length, 'child elements');
}

/**
 * Filter workflows based on search and checkboxes
 * @param {string} searchQuery - Search query (optional)
 */
function filterWorkflows(searchQuery = null) {
  const search = searchQuery !== null ? searchQuery : (document.getElementById('n8n-wf-search')?.value || '');
  const showActive = document.getElementById('filter-active')?.checked ?? true;
  const showInactive = document.getElementById('filter-inactive')?.checked ?? true;

  const filtered = workflowsData.filter(wf => {
    // Status filter
    if (wf.active && !showActive) return false;
    if (!wf.active && !showInactive) return false;

    // Search filter
    if (search && !wf.name.toLowerCase().includes(search.toLowerCase())) {
      return false;
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
 * @returns {Array} Sorted workflows
 */
function sortWorkflows(workflows, sortBy) {
  return workflows.slice().sort((a, b) => {
    if (sortBy === 'updatedAt' || sortBy === 'createdAt') {
      // Sort by timestamp (descending - most recent first)
      const timeA = a[sortBy] ? new Date(a[sortBy]).getTime() : 0;
      const timeB = b[sortBy] ? new Date(b[sortBy]).getTime() : 0;
      return timeB - timeA; // Descending
    } else if (sortBy === 'name') {
      // Sort alphabetically (A-Z)
      return a.name.localeCompare(b.name);
    }
    return 0;
  });
}

/**
 * Navigate to a workflow
 * @param {string} workflowId - Workflow ID
 */
async function navigateToWorkflow(workflowId) {
  if (!currentInstanceId) {
    showError('No instance configured');
    return;
  }

  const response = await chrome.runtime.sendMessage({
    action: 'getInstanceById',
    instanceId: currentInstanceId
  });

  if (!response.success || !response.instance) {
    showError('Instance not found');
    return;
  }

  const targetUrl = `${response.instance.url}/workflow/${workflowId}`;

  console.log('[n8n-ext] Navigating to workflow:', targetUrl);
  window.location.href = targetUrl;
}

/**
 * Update stats footer
 * @param {Array} workflows - Array of workflows
 * @param {boolean} cached - Whether data was from cache
 */
function updateStats(workflows, cached = false) {
  const statsElement = document.getElementById('n8n-wf-stats');
  if (!statsElement) return;

  const activeCount = workflows.filter(wf => wf.active).length;
  const now = new Date().toLocaleTimeString();
  const cacheIndicator = cached ? '(cached)' : '';

  statsElement.innerHTML = `
    <small>${workflows.length} workflow${workflows.length !== 1 ? 's' : ''} (${activeCount} active) | Updated: ${now} ${cacheIndicator}</small>
  `;
}

/**
 * Show error message in list
 * @param {string} message - Error message
 */
function showError(message) {
  const listElement = document.getElementById('n8n-wf-list');
  if (!listElement) return;

  let displayMessage = message;

  // User-friendly error messages
  if (message === 'NO_INSTANCE_URL') {
    displayMessage = 'Please configure your n8n instance URL in settings';
  } else if (message === 'API_KEY_MISSING') {
    displayMessage = 'Please configure your API key in extension settings';
  } else if (message === 'INVALID_API_KEY') {
    displayMessage = 'Invalid API key. Please check settings.';
  } else if (message === 'API_NOT_FOUND') {
    displayMessage = 'n8n API not found. Check your instance.';
  }

  listElement.innerHTML = `
    <li class="n8n-wf-error">
      <span class="error-icon">⚠️</span>
      <span>${escapeHtml(displayMessage)}</span>
      <button class="n8n-wf-settings-link" id="open-settings">Open Settings</button>
    </li>
  `;

  // Add click handler for settings link
  const settingsButton = document.getElementById('open-settings');
  if (settingsButton) {
    settingsButton.addEventListener('click', () => {
      chrome.runtime.openOptionsPage?.() || alert('Please click the extension icon to open settings');
    });
  }
}

/**
 * Observe URL changes for SPA navigation
 */
function observeUrlChanges() {
  let lastUrl = window.location.href;

  new MutationObserver(() => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      const match = window.location.pathname.match(WORKFLOW_URL_PATTERN);
      if (match) {
        currentWorkflowId = match[1];
        console.log('[n8n-ext] URL changed, new workflow ID:', currentWorkflowId);

        // Re-highlight active workflow
        document.querySelectorAll('.n8n-wf-item').forEach(item => {
          item.classList.toggle('n8n-wf-active',
            item.dataset.workflowId === currentWorkflowId
          );
        });
      }
    }
  }).observe(document, {subtree: true, childList: true});
}

// Utilities

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
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} unsafe - Unsafe string
 * @returns {string} Escaped string
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initialize the extension
init();
