// n8n Workflow Sidebar - Service Worker
// Handles API communication with n8n instance

// In-memory cache for workflows (per-instance)
let workflowCaches = {}; // {instanceId: {data, timestamp, ttl}}

/**
 * Build API base URL from instance URL
 * @param {string} instanceUrl - n8n instance URL
 * @returns {string} API base URL
 */
function getApiBase(instanceUrl) {
  // Remove trailing slash if present
  const cleanUrl = instanceUrl.replace(/\/$/, '');
  return `${cleanUrl}/api/v1`;
}

/**
 * Get all instances from storage
 * @returns {Promise<Object>} Object of instances keyed by ID
 */
async function getAllInstances() {
  const {instances} = await chrome.storage.sync.get('instances');
  return instances || {};
}

/**
 * Get instance by ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object|null>} Instance object or null
 */
async function getInstanceById(instanceId) {
  const instances = await getAllInstances();
  return instances[instanceId] || null;
}

/**
 * Get instance by origin URL
 * @param {string} origin - Origin URL (e.g., https://n8n.company.com)
 * @returns {Promise<Object|null>} Instance object or null
 */
async function getInstanceByOrigin(origin) {
  const instances = await getAllInstances();
  const normalizedOrigin = new URL(origin).origin;

  // Find first instance matching origin, sorted by lastUsed
  const matches = Object.values(instances)
    .filter(inst => new URL(inst.url).origin === normalizedOrigin)
    .sort((a, b) => b.lastUsed - a.lastUsed);

  return matches[0] || null;
}

/**
 * Save or update an instance
 * @param {Object} instanceData - Instance data
 * @returns {Promise<string>} Instance ID
 */
async function saveInstance(instanceData) {
  const instances = await getAllInstances();
  const instanceId = instanceData.id || crypto.randomUUID();

  instances[instanceId] = {
    ...instanceData,
    id: instanceId,
    lastUsed: Date.now()
  };

  await chrome.storage.sync.set({instances});
  return instanceId;
}

/**
 * Delete an instance
 * @param {string} instanceId - Instance ID to delete
 */
async function deleteInstance(instanceId) {
  const instances = await getAllInstances();
  delete instances[instanceId];
  await chrome.storage.sync.set({instances});

  // Clear cache for this instance
  invalidateCache(instanceId);
  const {workflowCaches: sessionCaches} = await chrome.storage.session.get('workflowCaches');
  if (sessionCaches?.[instanceId]) {
    delete sessionCaches[instanceId];
    await chrome.storage.session.set({workflowCaches: sessionCaches});
  }
}

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchWorkflows') {
    handleFetchWorkflows(message.instanceId, message.options || {})
      .then(sendResponse)
      .catch(error => sendResponse({success: false, error: error.message}));
    return true; // Keep message channel open for async response
  }

  if (message.action === 'refreshWorkflows') {
    invalidateCache(message.instanceId);
    handleFetchWorkflows(message.instanceId, {forceRefresh: true})
      .then(sendResponse)
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'testConnection') {
    testConnection(message.instanceId)
      .then(sendResponse)
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'getAllInstances') {
    getAllInstances()
      .then(instances => sendResponse({success: true, instances}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'getInstanceById') {
    getInstanceById(message.instanceId)
      .then(instance => sendResponse({success: !!instance, instance}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'getInstanceByOrigin') {
    getInstanceByOrigin(message.origin)
      .then(instance => sendResponse({success: !!instance, instance}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'saveInstance') {
    saveInstance(message.instanceData)
      .then(id => sendResponse({success: true, instanceId: id}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }

  if (message.action === 'deleteInstance') {
    deleteInstance(message.instanceId)
      .then(() => sendResponse({success: true}))
      .catch(error => sendResponse({success: false, error: error.message}));
    return true;
  }
});

/**
 * Handle workflow fetch requests with caching
 * @param {string} instanceId - Instance ID
 * @param {Object} options - Fetch options (forceRefresh, limit, etc.)
 * @returns {Promise<Object>} Response object with success status and data/error
 */
async function handleFetchWorkflows(instanceId, options = {}) {
  try {
    if (!instanceId) {
      return {success: false, error: 'INSTANCE_ID_REQUIRED'};
    }

    // Check cache first (unless force refresh)
    if (!options.forceRefresh && isCacheValid(instanceId)) {
      console.log('[n8n-ext] Returning cached workflows for:', instanceId);
      return {success: true, data: workflowCaches[instanceId].data, cached: true};
    }

    // Get instance
    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return {success: false, error: 'INSTANCE_NOT_FOUND'};
    }

    // Fetch from API
    console.log('[n8n-ext] Fetching workflows from:', instance.name);
    const workflows = await fetchWorkflowsFromAPI(instance.url, instance.apiKey, options);

    // Update cache
    workflowCaches[instanceId] = {
      data: workflows,
      timestamp: Date.now(),
      ttl: 5 * 60 * 1000
    };

    // Persist to session storage
    const {workflowCaches: sessionCaches = {}} = await chrome.storage.session.get('workflowCaches');
    sessionCaches[instanceId] = workflowCaches[instanceId];
    await chrome.storage.session.set({workflowCaches: sessionCaches});

    return {success: true, data: workflows, cached: false};

  } catch (error) {
    console.error('[n8n-ext] Fetch workflows error:', error);
    return {success: false, error: error.message};
  }
}

/**
 * Fetch workflows from n8n API
 * @param {string} instanceUrl - n8n instance URL
 * @param {string} apiKey - n8n API key
 * @param {Object} options - Query options (limit, etc.)
 * @returns {Promise<Array>} Array of workflow objects
 */
async function fetchWorkflowsFromAPI(instanceUrl, apiKey, options = {}) {
  const apiBase = getApiBase(instanceUrl);

  const params = new URLSearchParams({
    limit: options.limit || 250
  });

  const url = `${apiBase}/workflows?${params}`;

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
 * Check if cached data is still valid for an instance
 * @param {string} instanceId - Instance ID
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(instanceId) {
  const cache = workflowCaches[instanceId];

  // Check if cache exists and has the right structure
  if (!cache || typeof cache !== 'object') {
    return false;
  }

  // Ensure cache has data array
  if (!Array.isArray(cache.data)) {
    console.warn('[n8n-ext] Invalid cache structure for instance:', instanceId);
    delete workflowCaches[instanceId];
    return false;
  }

  // Check timestamp
  if (!cache.timestamp || typeof cache.timestamp !== 'number') {
    return false;
  }

  const age = Date.now() - cache.timestamp;
  return age < (cache.ttl || 5 * 60 * 1000);
}

/**
 * Invalidate the cache for an instance (or all if no ID provided)
 * @param {string|null} instanceId - Instance ID or null for all
 */
function invalidateCache(instanceId = null) {
  if (instanceId) {
    delete workflowCaches[instanceId];
  } else {
    workflowCaches = {};
  }
}

/**
 * Test connection to n8n API
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Response with success status and workflow count
 */
async function testConnection(instanceId) {
  try {
    if (!instanceId) {
      return {success: false, error: 'INSTANCE_ID_REQUIRED'};
    }

    const instance = await getInstanceById(instanceId);
    if (!instance) {
      return {success: false, error: 'INSTANCE_NOT_FOUND'};
    }

    // Fetch just 1 workflow to test connection
    await fetchWorkflowsFromAPI(instance.url, instance.apiKey, {limit: 1});

    // Get total count
    const allWorkflows = await fetchWorkflowsFromAPI(instance.url, instance.apiKey, {limit: 250});

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
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    console.log('[n8n-ext] Extension installed');
    await chrome.storage.sync.set({version: 2, instances: {}, selectedInstanceId: null});
  } else if (details.reason === 'update') {
    console.log('[n8n-ext] Extension updated');
    await migrateStorageV1ToV2();

    // Clean up any corrupted session cache
    const {workflowCaches: sessionCaches} = await chrome.storage.session.get('workflowCaches');
    if (sessionCaches) {
      let needsCleanup = false;
      for (const [instanceId, cache] of Object.entries(sessionCaches)) {
        if (!cache || typeof cache !== 'object' || !Array.isArray(cache.data)) {
          console.log('[n8n-ext] Detected corrupted cache, clearing session storage');
          needsCleanup = true;
          break;
        }
      }
      if (needsCleanup) {
        await chrome.storage.session.remove('workflowCaches');
        console.log('[n8n-ext] Cleared corrupted cache');
      }
    }
  }
});

// Restore cache from session storage on service worker startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('[n8n-ext] Service worker started');

  // Try to restore caches from session storage
  const {workflowCaches: sessionCaches} = await chrome.storage.session.get('workflowCaches');
  if (sessionCaches && typeof sessionCaches === 'object') {
    // Validate cache structure before restoring
    const validCaches = {};
    for (const [instanceId, cache] of Object.entries(sessionCaches)) {
      if (cache && typeof cache === 'object' && Array.isArray(cache.data)) {
        validCaches[instanceId] = cache;
      } else {
        console.warn('[n8n-ext] Skipping invalid cache for instance:', instanceId);
      }
    }
    workflowCaches = validCaches;
    console.log('[n8n-ext] Restored caches for', Object.keys(workflowCaches).length, 'instances');
  }
});

/**
 * Migrate storage from v1 (single instance) to v2 (multiple instances)
 */
async function migrateStorageV1ToV2() {
  const {apiKey, instanceUrl, version} = await chrome.storage.sync.get(['apiKey', 'instanceUrl', 'version']);

  // Already migrated or no data
  if (version === 2) {
    console.log('[n8n-ext] Storage already v2');
    return;
  }

  if (!apiKey && !instanceUrl) {
    console.log('[n8n-ext] No existing data to migrate');
    await chrome.storage.sync.set({version: 2, instances: {}, selectedInstanceId: null});
    return;
  }

  // Create instance from v1 data
  console.log('[n8n-ext] Migrating v1 → v2');
  const instanceId = crypto.randomUUID();
  const instances = {
    [instanceId]: {
      id: instanceId,
      name: "My n8n Instance",
      url: instanceUrl,
      apiKey: apiKey,
      createdAt: Date.now(),
      lastUsed: Date.now()
    }
  };

  await chrome.storage.sync.set({instances, selectedInstanceId: instanceId, version: 2});
  await chrome.storage.sync.remove(['apiKey', 'instanceUrl']);

  // Migrate cache (convert from old format to new format)
  const {workflowCache} = await chrome.storage.session.get('workflowCache');
  if (workflowCache) {
    // Old format was just the data array, new format is {data, timestamp, ttl}
    const cacheObject = Array.isArray(workflowCache)
      ? {data: workflowCache, timestamp: Date.now(), ttl: 5 * 60 * 1000}
      : workflowCache;

    await chrome.storage.session.set({
      workflowCaches: {[instanceId]: cacheObject}
    });
    await chrome.storage.session.remove('workflowCache');
    console.log('[n8n-ext] Migrated cache for instance:', instanceId);
  }

  console.log('[n8n-ext] Migration complete:', instanceId);
}
