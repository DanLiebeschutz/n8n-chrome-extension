// n8n Workflow Sidebar - Service Worker
// Handles API communication with n8n instances

'use strict';

// =============================================================================
// CONFIGURATION CONSTANTS
// =============================================================================

const CONFIG = Object.freeze({
  CACHE_TTL_MS: 5 * 60 * 1000,        // 5 minutes
  WORKFLOW_LIMIT: 250,                 // n8n API limit
  MAX_RETRIES: 3,                      // API retry attempts
  RETRY_BASE_DELAY_MS: 1000,           // Base delay for exponential backoff
  LOG_PREFIX: '[n8n-ext]',
  STORAGE_VERSION: 2,
});

// Error codes for consistent error handling
const ERROR_CODES = Object.freeze({
  INSTANCE_ID_REQUIRED: 'INSTANCE_ID_REQUIRED',
  INSTANCE_NOT_FOUND: 'INSTANCE_NOT_FOUND',
  INVALID_API_KEY: 'INVALID_API_KEY',
  API_NOT_FOUND: 'API_NOT_FOUND',
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_URL: 'INVALID_URL',
  STORAGE_ERROR: 'STORAGE_ERROR',
});

// =============================================================================
// LOGGING UTILITY
// =============================================================================

/**
 * Logging wrapper that can be disabled in production
 * @type {{log: Function, warn: Function, error: Function}}
 */
const logger = {
  _enabled: true, // Set to false to disable logging in production

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
    // Errors always logged
    console.error(CONFIG.LOG_PREFIX, ...args);
  },
};

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

/**
 * In-memory cache for workflows (per-instance)
 * @type {Object.<string, {data: Array, timestamp: number, ttl: number}>}
 */
let workflowCaches = {};

// =============================================================================
// URL UTILITIES
// =============================================================================

/**
 * Safely parse a URL and return its components
 * @param {string} urlString - URL to parse
 * @returns {{origin: string, isValid: boolean}} Parsed URL info
 */
function safeParseUrl(urlString) {
  try {
    const url = new URL(urlString);
    return { origin: url.origin, isValid: true };
  } catch {
    return { origin: '', isValid: false };
  }
}

/**
 * Build API base URL from instance URL
 * @param {string} instanceUrl - n8n instance URL
 * @returns {string} API base URL
 */
function getApiBase(instanceUrl) {
  const cleanUrl = instanceUrl.replace(/\/$/, '');
  return `${cleanUrl}/api/v1`;
}

// =============================================================================
// INSTANCE MANAGEMENT
// =============================================================================

/**
 * Get all instances from storage with error handling
 * @returns {Promise<Object>} Object of instances keyed by ID
 */
async function getAllInstances() {
  try {
    const { instances } = await chrome.storage.sync.get('instances');
    return instances || {};
  } catch (error) {
    logger.error('Failed to get instances from storage:', error.message);
    throw new Error(ERROR_CODES.STORAGE_ERROR);
  }
}

/**
 * Get instance by ID
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object|null>} Instance object or null
 */
async function getInstanceById(instanceId) {
  if (!instanceId || typeof instanceId !== 'string') {
    return null;
  }
  const instances = await getAllInstances();
  return instances[instanceId] || null;
}

/**
 * Get instance by origin URL with validation
 * @param {string} origin - Origin URL (e.g., https://n8n.company.com)
 * @returns {Promise<Object|null>} Instance object or null
 */
async function getInstanceByOrigin(origin) {
  if (!origin || typeof origin !== 'string') {
    return null;
  }

  const parsed = safeParseUrl(origin);
  if (!parsed.isValid) {
    logger.warn('Invalid origin URL:', origin);
    return null;
  }

  const instances = await getAllInstances();
  const normalizedOrigin = parsed.origin;

  // Find instances matching origin, sorted by lastUsed (most recent first)
  const matches = Object.values(instances)
    .filter(inst => {
      const instParsed = safeParseUrl(inst.url);
      return instParsed.isValid && instParsed.origin === normalizedOrigin;
    })
    .sort((a, b) => (b.lastUsed || 0) - (a.lastUsed || 0));

  return matches[0] || null;
}

/**
 * Validate instance data before saving
 * @param {Object} instanceData - Instance data to validate
 * @returns {{isValid: boolean, error: string|null}} Validation result
 */
function validateInstanceData(instanceData) {
  if (!instanceData) {
    return { isValid: false, error: 'Instance data is required' };
  }

  if (!instanceData.name || typeof instanceData.name !== 'string') {
    return { isValid: false, error: 'Instance name is required' };
  }

  if (instanceData.name.length > 100) {
    return { isValid: false, error: 'Instance name is too long (max 100 characters)' };
  }

  if (!instanceData.url || typeof instanceData.url !== 'string') {
    return { isValid: false, error: 'Instance URL is required' };
  }

  const parsed = safeParseUrl(instanceData.url);
  if (!parsed.isValid) {
    return { isValid: false, error: 'Invalid instance URL format' };
  }

  if (!instanceData.apiKey || typeof instanceData.apiKey !== 'string') {
    return { isValid: false, error: 'API key is required' };
  }

  // Basic API key format validation (n8n keys typically start with n8n_api_)
  if (instanceData.apiKey.length < 10) {
    return { isValid: false, error: 'API key appears to be invalid (too short)' };
  }

  return { isValid: true, error: null };
}

/**
 * Save or update an instance with validation
 * @param {Object} instanceData - Instance data
 * @returns {Promise<string>} Instance ID
 * @throws {Error} If validation fails
 */
async function saveInstance(instanceData) {
  const validation = validateInstanceData(instanceData);
  if (!validation.isValid) {
    throw new Error(validation.error);
  }

  try {
    const instances = await getAllInstances();
    const instanceId = instanceData.id || crypto.randomUUID();

    instances[instanceId] = {
      ...instanceData,
      id: instanceId,
      url: safeParseUrl(instanceData.url).origin, // Normalize URL to origin
      lastUsed: Date.now(),
      createdAt: instanceData.createdAt || Date.now(),
    };

    await chrome.storage.sync.set({ instances });
    logger.log('Instance saved:', instanceId);
    return instanceId;
  } catch (error) {
    logger.error('Failed to save instance:', error.message);
    throw new Error(ERROR_CODES.STORAGE_ERROR);
  }
}

/**
 * Delete an instance and its cached data
 * @param {string} instanceId - Instance ID to delete
 */
async function deleteInstance(instanceId) {
  if (!instanceId) {
    throw new Error(ERROR_CODES.INSTANCE_ID_REQUIRED);
  }

  try {
    const instances = await getAllInstances();

    if (!instances[instanceId]) {
      logger.warn('Instance not found for deletion:', instanceId);
      return;
    }

    delete instances[instanceId];
    await chrome.storage.sync.set({ instances });

    // Clear cache for this instance
    invalidateCache(instanceId);

    // Clear session storage cache
    const { workflowCaches: sessionCaches } = await chrome.storage.session.get('workflowCaches');
    if (sessionCaches?.[instanceId]) {
      delete sessionCaches[instanceId];
      await chrome.storage.session.set({ workflowCaches: sessionCaches });
    }

    logger.log('Instance deleted:', instanceId);
  } catch (error) {
    logger.error('Failed to delete instance:', error.message);
    throw new Error(ERROR_CODES.STORAGE_ERROR);
  }
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

/**
 * Message handler registry for cleaner message routing
 * @type {Object.<string, Function>}
 */
const messageHandlers = {
  async fetchWorkflows(message) {
    return handleFetchWorkflows(message.instanceId, message.options || {});
  },

  async refreshWorkflows(message) {
    invalidateCache(message.instanceId);
    return handleFetchWorkflows(message.instanceId, { forceRefresh: true });
  },

  async testConnection(message) {
    return testConnection(message.instanceId);
  },

  async getAllInstances() {
    const instances = await getAllInstances();
    return { success: true, instances };
  },

  async getInstanceById(message) {
    const instance = await getInstanceById(message.instanceId);
    return { success: !!instance, instance };
  },

  async getInstanceByOrigin(message) {
    const instance = await getInstanceByOrigin(message.origin);
    return { success: !!instance, instance };
  },

  async saveInstance(message) {
    const id = await saveInstance(message.instanceData);
    return { success: true, instanceId: id };
  },

  async deleteInstance(message) {
    await deleteInstance(message.instanceId);
    return { success: true };
  },
};

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.action];

  if (!handler) {
    logger.warn('Unknown message action:', message.action);
    sendResponse({ success: false, error: 'Unknown action' });
    return false;
  }

  handler(message)
    .then(sendResponse)
    .catch(error => {
      logger.error(`Error handling ${message.action}:`, error.message);
      sendResponse({ success: false, error: error.message });
    });

  return true; // Keep message channel open for async response
});

// =============================================================================
// WORKFLOW FETCHING
// =============================================================================

/**
 * Handle workflow fetch requests with caching
 * @param {string} instanceId - Instance ID
 * @param {Object} options - Fetch options (forceRefresh, limit, etc.)
 * @returns {Promise<Object>} Response object with success status and data/error
 */
async function handleFetchWorkflows(instanceId, options = {}) {
  if (!instanceId) {
    return { success: false, error: ERROR_CODES.INSTANCE_ID_REQUIRED };
  }

  // Check cache first (unless force refresh)
  if (!options.forceRefresh && isCacheValid(instanceId)) {
    logger.log('Returning cached workflows for:', instanceId);
    return {
      success: true,
      data: workflowCaches[instanceId].data,
      cached: true
    };
  }

  // Get instance
  const instance = await getInstanceById(instanceId);
  if (!instance) {
    return { success: false, error: ERROR_CODES.INSTANCE_NOT_FOUND };
  }

  // Fetch from API
  logger.log('Fetching workflows from:', instance.name);

  try {
    const workflows = await fetchWorkflowsFromAPI(
      instance.url,
      instance.apiKey,
      options
    );

    // Update cache
    updateCache(instanceId, workflows);

    return { success: true, data: workflows, cached: false };
  } catch (error) {
    logger.error('Fetch workflows error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Update both in-memory and session storage cache
 * @param {string} instanceId - Instance ID
 * @param {Array} workflows - Workflow data
 */
async function updateCache(instanceId, workflows) {
  const cacheEntry = {
    data: workflows,
    timestamp: Date.now(),
    ttl: CONFIG.CACHE_TTL_MS,
  };

  // Update in-memory cache
  workflowCaches[instanceId] = cacheEntry;

  // Persist to session storage
  try {
    const { workflowCaches: sessionCaches = {} } = await chrome.storage.session.get('workflowCaches');
    sessionCaches[instanceId] = cacheEntry;
    await chrome.storage.session.set({ workflowCaches: sessionCaches });
  } catch (error) {
    logger.warn('Failed to persist cache to session storage:', error.message);
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
  const limit = options.limit || CONFIG.WORKFLOW_LIMIT;

  const params = new URLSearchParams({ limit: String(limit) });
  const url = `${apiBase}/workflows?${params}`;

  const response = await fetchWithRetry(
    url,
    {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json',
      },
    },
    CONFIG.MAX_RETRIES
  );

  if (!response.ok) {
    handleApiError(response);
  }

  const json = await response.json();

  // n8n API returns {data: [...]} format
  return json.data || [];
}

/**
 * Handle API error responses
 * @param {Response} response - Fetch response
 * @throws {Error} With appropriate error code
 */
function handleApiError(response) {
  if (response.status === 401 || response.status === 403) {
    throw new Error(ERROR_CODES.INVALID_API_KEY);
  }
  if (response.status === 404) {
    throw new Error(ERROR_CODES.API_NOT_FOUND);
  }
  throw new Error(`API error: ${response.status} ${response.statusText}`);
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
      logger.warn(`Fetch attempt ${attempt + 1} failed:`, error.message);

      // Don't retry on last attempt
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * CONFIG.RETRY_BASE_DELAY_MS;
        logger.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  throw new Error(ERROR_CODES.NETWORK_ERROR);
}

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// CACHE MANAGEMENT
// =============================================================================

/**
 * Check if cached data is still valid for an instance
 * @param {string} instanceId - Instance ID
 * @returns {boolean} True if cache is valid
 */
function isCacheValid(instanceId) {
  const cache = workflowCaches[instanceId];

  if (!cache || typeof cache !== 'object') {
    return false;
  }

  if (!Array.isArray(cache.data)) {
    logger.warn('Invalid cache structure for instance:', instanceId);
    delete workflowCaches[instanceId];
    return false;
  }

  if (!cache.timestamp || typeof cache.timestamp !== 'number') {
    return false;
  }

  const age = Date.now() - cache.timestamp;
  const ttl = cache.ttl || CONFIG.CACHE_TTL_MS;

  return age < ttl;
}

/**
 * Invalidate the cache for an instance (or all if no ID provided)
 * @param {string|null} instanceId - Instance ID or null for all
 */
function invalidateCache(instanceId = null) {
  if (instanceId) {
    delete workflowCaches[instanceId];
    logger.log('Cache invalidated for:', instanceId);
  } else {
    workflowCaches = {};
    logger.log('All caches invalidated');
  }
}

// =============================================================================
// CONNECTION TESTING
// =============================================================================

/**
 * Test connection to n8n API
 * @param {string} instanceId - Instance ID
 * @returns {Promise<Object>} Response with success status and workflow count
 */
async function testConnection(instanceId) {
  if (!instanceId) {
    return { success: false, error: ERROR_CODES.INSTANCE_ID_REQUIRED };
  }

  const instance = await getInstanceById(instanceId);
  if (!instance) {
    return { success: false, error: ERROR_CODES.INSTANCE_NOT_FOUND };
  }

  try {
    // Single API call to get workflows and count
    const workflows = await fetchWorkflowsFromAPI(
      instance.url,
      instance.apiKey,
      { limit: CONFIG.WORKFLOW_LIMIT }
    );

    return {
      success: true,
      count: workflows.length,
      message: 'Connected successfully',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      message: 'Connection failed',
    };
  }
}

// =============================================================================
// LIFECYCLE EVENTS
// =============================================================================

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    logger.log('Extension installed');
    await initializeStorage();
  } else if (details.reason === 'update') {
    logger.log('Extension updated');
    await migrateStorageV1ToV2();
    await cleanupCorruptedCache();
  }
});

// =============================================================================
// SPA NAVIGATION DETECTION
// =============================================================================

/**
 * Detect SPA navigations to workflow pages and inject content script
 * This handles the case where user navigates from n8n's home/personal page to a workflow
 */
chrome.webNavigation.onHistoryStateUpdated.addListener(async (details) => {
  // Only handle main frame navigations
  if (details.frameId !== 0) {
    return;
  }

  const url = details.url;

  // Check if this is a workflow page URL
  if (!url.includes('/workflow/')) {
    return;
  }

  logger.log('SPA navigation detected to workflow page:', url);

  try {
    // Check if this origin has a configured instance
    const origin = new URL(url).origin;
    const instance = await getInstanceByOrigin(origin);

    if (!instance) {
      logger.log('No instance configured for:', origin);
      return;
    }

    logger.log('Injecting content script for instance:', instance.name);

    // Inject the content script and CSS
    await chrome.scripting.insertCSS({
      target: { tabId: details.tabId },
      files: ['content/content.css'],
    });

    await chrome.scripting.executeScript({
      target: { tabId: details.tabId },
      files: ['content/content.js'],
    });

    logger.log('Content script injected successfully');
  } catch (error) {
    // Script might already be injected, or tab might be closed
    logger.log('Script injection skipped or failed:', error.message);
  }
});

chrome.runtime.onStartup.addListener(async () => {
  logger.log('Service worker started');
  await restoreCacheFromSession();
});

/**
 * Initialize storage for new installations
 */
async function initializeStorage() {
  try {
    await chrome.storage.sync.set({
      version: CONFIG.STORAGE_VERSION,
      instances: {},
      selectedInstanceId: null,
    });
    logger.log('Storage initialized');
  } catch (error) {
    logger.error('Failed to initialize storage:', error.message);
  }
}

/**
 * Restore cache from session storage on service worker restart
 */
async function restoreCacheFromSession() {
  try {
    const { workflowCaches: sessionCaches } = await chrome.storage.session.get('workflowCaches');

    if (!sessionCaches || typeof sessionCaches !== 'object') {
      return;
    }

    // Validate cache structure before restoring
    const validCaches = {};
    for (const [instanceId, cache] of Object.entries(sessionCaches)) {
      if (isValidCacheEntry(cache)) {
        validCaches[instanceId] = cache;
      } else {
        logger.warn('Skipping invalid cache for instance:', instanceId);
      }
    }

    workflowCaches = validCaches;
    logger.log('Restored caches for', Object.keys(workflowCaches).length, 'instances');
  } catch (error) {
    logger.error('Failed to restore cache from session:', error.message);
  }
}

/**
 * Validate a cache entry structure
 * @param {Object} cache - Cache entry to validate
 * @returns {boolean} True if valid
 */
function isValidCacheEntry(cache) {
  return (
    cache &&
    typeof cache === 'object' &&
    Array.isArray(cache.data) &&
    typeof cache.timestamp === 'number'
  );
}

/**
 * Clean up corrupted session cache
 */
async function cleanupCorruptedCache() {
  try {
    const { workflowCaches: sessionCaches } = await chrome.storage.session.get('workflowCaches');

    if (!sessionCaches) {
      return;
    }

    let needsCleanup = false;
    for (const [instanceId, cache] of Object.entries(sessionCaches)) {
      if (!isValidCacheEntry(cache)) {
        logger.log('Detected corrupted cache for:', instanceId);
        needsCleanup = true;
        break;
      }
    }

    if (needsCleanup) {
      await chrome.storage.session.remove('workflowCaches');
      logger.log('Cleared corrupted cache');
    }
  } catch (error) {
    logger.error('Failed to cleanup cache:', error.message);
  }
}

/**
 * Migrate storage from v1 (single instance) to v2 (multiple instances)
 */
async function migrateStorageV1ToV2() {
  try {
    const { apiKey, instanceUrl, version } = await chrome.storage.sync.get([
      'apiKey',
      'instanceUrl',
      'version',
    ]);

    // Already migrated or no data
    if (version === CONFIG.STORAGE_VERSION) {
      logger.log('Storage already v2');
      return;
    }

    if (!apiKey && !instanceUrl) {
      logger.log('No existing data to migrate');
      await chrome.storage.sync.set({
        version: CONFIG.STORAGE_VERSION,
        instances: {},
        selectedInstanceId: null,
      });
      return;
    }

    // Create instance from v1 data
    logger.log('Migrating v1 -> v2');
    const instanceId = crypto.randomUUID();
    const instances = {
      [instanceId]: {
        id: instanceId,
        name: 'My n8n Instance',
        url: instanceUrl,
        apiKey: apiKey,
        createdAt: Date.now(),
        lastUsed: Date.now(),
      },
    };

    await chrome.storage.sync.set({
      instances,
      selectedInstanceId: instanceId,
      version: CONFIG.STORAGE_VERSION,
    });
    await chrome.storage.sync.remove(['apiKey', 'instanceUrl']);

    // Migrate cache
    await migrateCacheV1ToV2(instanceId);

    logger.log('Migration complete:', instanceId);
  } catch (error) {
    logger.error('Migration failed:', error.message);
  }
}

/**
 * Migrate cache from v1 to v2 format
 * @param {string} instanceId - New instance ID
 */
async function migrateCacheV1ToV2(instanceId) {
  try {
    const { workflowCache } = await chrome.storage.session.get('workflowCache');

    if (!workflowCache) {
      return;
    }

    // Old format was just the data array, new format is {data, timestamp, ttl}
    const cacheObject = Array.isArray(workflowCache)
      ? { data: workflowCache, timestamp: Date.now(), ttl: CONFIG.CACHE_TTL_MS }
      : workflowCache;

    await chrome.storage.session.set({
      workflowCaches: { [instanceId]: cacheObject },
    });
    await chrome.storage.session.remove('workflowCache');

    logger.log('Migrated cache for instance:', instanceId);
  } catch (error) {
    logger.warn('Cache migration failed:', error.message);
  }
}
