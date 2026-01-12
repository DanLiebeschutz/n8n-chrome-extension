// n8n Workflow Sidebar - Popup Settings Script (Multi-Instance)

// State
let instances = {};
let editingInstanceId = null;

// DOM elements
const listView = document.getElementById('list-view');
const formView = document.getElementById('form-view');
const instancesList = document.getElementById('instances-list');
const emptyState = document.getElementById('empty-state');
const addInstanceBtn = document.getElementById('add-instance-btn');
const instanceNameInput = document.getElementById('instance-name');
const instanceUrlInput = document.getElementById('instance-url');
const instanceApiKeyInput = document.getElementById('instance-api-key');
const settingsLink = document.getElementById('open-api-settings');
const formTitle = document.getElementById('form-title');
const cancelBtn = document.getElementById('cancel-btn');
const testInstanceBtn = document.getElementById('test-instance-btn');
const saveInstanceBtn = document.getElementById('save-instance-btn');
const statusMessage = document.getElementById('status-message');

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

async function init() {
  try {
    // Ensure we start with the list view visible
    listView.style.display = 'block';
    formView.style.display = 'none';

    await loadInstances();
    renderInstanceList();

    // Event listeners
    addInstanceBtn.addEventListener('click', () => {
      console.log('[n8n-ext-popup] Add instance button clicked');
      showForm();
    });
    cancelBtn.addEventListener('click', hideForm);
    saveInstanceBtn.addEventListener('click', saveInstance);
    testInstanceBtn.addEventListener('click', testInstance);

    // Delegated events for instance items
    instancesList.addEventListener('click', handleInstanceAction);

    console.log('[n8n-ext-popup] Initialization complete');
  } catch (error) {
    console.error('[n8n-ext-popup] Initialization error:', error);
    showStatus('Failed to initialize: ' + error.message, 'error');
  }
}

async function loadInstances() {
  try {
    const response = await chrome.runtime.sendMessage({action: 'getAllInstances'});
    instances = response.success ? response.instances : {};
    console.log('[n8n-ext-popup] Loaded instances:', instances);
  } catch (error) {
    console.error('[n8n-ext-popup] Failed to load instances:', error);
    instances = {};
  }
}

function renderInstanceList() {
  console.log('[n8n-ext-popup] renderInstanceList called, instances:', instances);
  instancesList.innerHTML = '';

  const instanceArray = Object.values(instances);
  console.log('[n8n-ext-popup] Instance count:', instanceArray.length);

  if (instanceArray.length === 0) {
    console.log('[n8n-ext-popup] No instances, showing empty state');
    emptyState.style.display = 'block';
    instancesList.style.display = 'none';
    return;
  }

  console.log('[n8n-ext-popup] Rendering instance list');
  emptyState.style.display = 'none';
  instancesList.style.display = 'block';

  instanceArray
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .forEach(instance => {
      const li = document.createElement('li');
      li.className = 'instance-item';
      li.dataset.instanceId = instance.id;

      const hostname = new URL(instance.url).hostname;

      li.innerHTML = `
        <div class="instance-info">
          <div class="instance-name">${escapeHtml(instance.name)}</div>
          <div class="instance-url">${escapeHtml(hostname)}</div>
        </div>
        <div class="instance-actions">
          <button class="btn-action btn-test" title="Test connection" data-action="test">↻</button>
          <button class="btn-action btn-edit" title="Edit" data-action="edit">✎</button>
          <button class="btn-action btn-delete" title="Delete" data-action="delete">×</button>
        </div>
      `;

      instancesList.appendChild(li);
    });
}

function handleInstanceAction(e) {
  const button = e.target.closest('[data-action]');
  if (!button) return;

  const action = button.dataset.action;
  const instanceId = button.closest('.instance-item').dataset.instanceId;

  if (action === 'edit') {
    showForm(instanceId);
  } else if (action === 'delete') {
    deleteInstance(instanceId);
  } else if (action === 'test') {
    testInstanceById(instanceId);
  }
}

function showForm(instanceId = null) {
  console.log('[n8n-ext-popup] showForm called with instanceId:', instanceId);
  editingInstanceId = instanceId;

  if (instanceId && instances[instanceId]) {
    const instance = instances[instanceId];
    formTitle.textContent = 'Edit Instance';
    instanceNameInput.value = instance.name;
    instanceUrlInput.value = instance.url;
    instanceApiKeyInput.value = instance.apiKey;
    updateSettingsLink(instance.url);
  } else {
    formTitle.textContent = 'Add Instance';
    instanceNameInput.value = '';
    instanceUrlInput.value = '';
    instanceApiKeyInput.value = '';
    settingsLink.style.display = 'none';
  }

  console.log('[n8n-ext-popup] Switching to form view');
  listView.style.display = 'none';
  formView.style.display = 'block';
  instanceNameInput.focus();
}

function hideForm() {
  editingInstanceId = null;
  listView.style.display = 'block';
  formView.style.display = 'none';
}

async function saveInstance() {
  const name = instanceNameInput.value.trim();
  const url = instanceUrlInput.value.trim();
  const apiKey = instanceApiKeyInput.value.trim();

  if (!name) {
    showStatus('Please enter an instance name', 'error');
    return;
  }

  if (!url) {
    showStatus('Please enter an instance URL', 'error');
    return;
  }

  if (!apiKey) {
    showStatus('Please enter an API key', 'error');
    return;
  }

  // Validate and normalize URL
  let parsedUrl;
  try {
    let urlToValidate = url;
    if (!urlToValidate.match(/^https?:\/\//)) {
      urlToValidate = 'https://' + urlToValidate;
    }
    parsedUrl = new URL(urlToValidate);
  } catch (error) {
    showStatus('Invalid URL format', 'error');
    return;
  }

  // Request permission
  const origin = `${parsedUrl.protocol}//${parsedUrl.host}/*`;
  const hasPermission = await chrome.permissions.contains({origins: [origin]});

  if (!hasPermission) {
    const granted = await chrome.permissions.request({origins: [origin]});
    if (!granted) {
      showStatus('Permission denied', 'error');
      return;
    }
  }

  // Save instance
  const instanceData = {
    id: editingInstanceId,
    name,
    url: parsedUrl.origin,
    apiKey,
    createdAt: editingInstanceId ? instances[editingInstanceId]?.createdAt : Date.now()
  };

  const response = await chrome.runtime.sendMessage({
    action: 'saveInstance',
    instanceData
  });

  if (response.success) {
    showStatus('Instance saved! Reload n8n pages to see the sidebar.', 'success');
    await loadInstances();
    renderInstanceList();
    hideForm();
  } else {
    showStatus('Failed to save instance', 'error');
  }
}

async function deleteInstance(instanceId) {
  const instance = instances[instanceId];
  if (!confirm(`Delete "${instance.name}"?`)) return;

  await chrome.runtime.sendMessage({
    action: 'deleteInstance',
    instanceId
  });

  showStatus('Instance deleted', 'success');
  await loadInstances();
  renderInstanceList();
}

async function testInstance() {
  const url = instanceUrlInput.value.trim();
  const apiKey = instanceApiKeyInput.value.trim();

  if (!url || !apiKey) {
    showStatus('Enter URL and API key first', 'error');
    return;
  }

  testInstanceBtn.disabled = true;
  testInstanceBtn.textContent = 'Testing...';

  try {
    // Create temporary instance for testing
    const tempId = crypto.randomUUID();
    let parsedUrl = url;
    if (!url.match(/^https?:\/\//)) {
      parsedUrl = 'https://' + url;
    }

    await chrome.runtime.sendMessage({
      action: 'saveInstance',
      instanceData: {
        id: tempId,
        name: 'temp',
        url: new URL(parsedUrl).origin,
        apiKey,
        createdAt: Date.now()
      }
    });

    const response = await chrome.runtime.sendMessage({
      action: 'testConnection',
      instanceId: tempId
    });

    // Clean up temp instance
    await chrome.runtime.sendMessage({
      action: 'deleteInstance',
      instanceId: tempId
    });

    if (response.success) {
      showStatus(`✓ Connected! Found ${response.count} workflows`, 'success');
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    showStatus(`Connection failed: ${error.message}`, 'error');
  } finally {
    testInstanceBtn.disabled = false;
    testInstanceBtn.textContent = 'Test';
  }
}

async function testInstanceById(instanceId) {
  const button = document.querySelector(`[data-instance-id="${instanceId}"] .btn-test`);
  if (button) button.textContent = '...';

  const response = await chrome.runtime.sendMessage({
    action: 'testConnection',
    instanceId
  });

  if (button) button.textContent = '↻';

  if (response.success) {
    showStatus(`✓ ${instances[instanceId].name}: ${response.count} workflows`, 'success');
  } else {
    showStatus(`✗ ${instances[instanceId].name}: ${response.error}`, 'error');
  }
}

function updateSettingsLink(url) {
  settingsLink.href = `${url}/settings/api`;
  settingsLink.style.display = 'inline';
}

function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.classList.remove('hidden');
  setTimeout(() => statusMessage.classList.add('hidden'), 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
