// n8n Workflow Sidebar - Service Worker
// Handles API communication with n8n instance

// In-memory cache for workflows
let workflowCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000 // 5 minutes in milliseconds
};

const API_BASE = 'https://n8n.srv854903.hstgr.cloud/api/v1';

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchWorkflows') {
    handleFetchWorkflows(message.options || {}).then(sendResponse);
    return true; // Keep message channel open for async response
  }

  if (message.action === 'refreshWorkflows') {
    invalidateCache();
    handleFetchWorkflows({forceRefresh: true}).then(sendResponse);
    return true;
  }

  if (message.action === 'testConnection') {
    testConnection().then(sendResponse);
    return true;
  }
});

/**
 * Handle workflow fetch requests with caching
 * @param {Object} options - Fetch options (forceRefresh, limit, etc.)
 * @returns {Promise<Object>} Response object with success status and data/error
 */
async function handleFetchWorkflows(options = {}) {
  try {
    // Check cache first (unless force refresh)
    if (!options.forceRefresh && isCacheValid()) {
      console.log('[n8n-ext] Returning cached workflows');
      return {success: true, data: workflowCache.data, cached: true};
    }

    // Get API key from storage
    const {apiKey} = await chrome.storage.sync.get('apiKey');
    if (!apiKey) {
      return {success: false, error: 'API_KEY_MISSING'};
    }

    // Fetch from API
    console.log('[n8n-ext] Fetching workflows from API');
    const workflows = await fetchWorkflowsFromAPI(apiKey, options);

    // Update in-memory cache
    workflowCache = {
      data: workflows,
      timestamp: Date.now(),
      ttl: workflowCache.ttl
    };

    // Persist to session storage (survives service worker restarts)
    await chrome.storage.session.set({workflowCache: workflows});

    return {success: true, data: workflows, cached: false};

  } catch (error) {
    console.error('[n8n-ext] Fetch workflows error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Fetch workflows from n8n API
 * @param {string} apiKey - n8n API key
 * @param {Object} options - Query options (limit, etc.)
 * @returns {Promise<Array>} Array of workflow objects
 */
async function fetchWorkflowsFromAPI(apiKey, options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 250
  });

  const url = `${API_BASE}/workflows?${params}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json'
      }
    },
    3 // max retries
  );

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error('INVALID_API_KEY');
    }
    if (response.status === 404) {
      throw new Error('API_NOT_FOUND');
    }
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  // n8n API returns {data: [...]} format
  return json.data || [];
}

/**
 * Fetch with exponential backoff retry logic
 * @param {string} url - Request URL
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithRetry(url, options, maxRetries) {
  let lastError;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`[n8n-ext] Fetch attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on last attempt
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[n8n-ext] Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if cached data is still valid
 * @returns {boolean} True if cache is valid
 */
function isCacheValid() {
  if (!workflowCache.data || !workflowCache.timestamp) {
    return false;
  }

  const age = Date.now() - workflowCache.timestamp;
  return age < workflowCache.ttl;
}

/**
 * Invalidate the cache
 */
function invalidateCache() {
  workflowCache = {
    data: null,
    timestamp: null,
    ttl: workflowCache.ttl
  };
}

/**
 * Test connection to n8n API
 * @returns {Promise<Object>} Response with success status and workflow count
 */
async function testConnection() {
  try {
    const {apiKey} = await chrome.storage.sync.get('apiKey');

    if (!apiKey) {
      return {success: false, error: 'No API key configured'};
    }

    // Fetch just 1 workflow to test connection
    const workflows = await fetchWorkflowsFromAPI(apiKey, {limit: 1});

    // Get total count
    const allWorkflows = await fetchWorkflowsFromAPI(apiKey, {limit: 250});

    return {
      success: true,
      count: allWorkflows.length,
      message: 'Connected successfully'
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Connection failed'
    };
  }
}

// Service worker lifecycle events
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[n8n-ext] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[n8n-ext] Extension updated');
  }
});

// Restore cache from session storage on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[n8n-ext] Service worker started');

  // Try to restore cache from session storage
  const {workflowCache: cachedData} = await chrome.storage.session.get('workflowCache');
  if (cachedData) {
    workflowCache.data = cachedData;
    workflowCache.timestamp = Date.now(); // Refresh timestamp
    console.log('[n8n-ext] Cache restored from session storage');
  }
});
