# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Chrome extension (Manifest V3) that adds a workflow sidebar to the n8n workflow automation platform. It displays all workflows in a collapsible sidebar within the n8n web interface for quick navigation.

## Architecture

The extension follows Chrome's Manifest V3 architecture with three main components:

### 1. Service Worker (`background/service-worker.js`)
- **Purpose**: Acts as the API communication layer between content scripts and the n8n REST API
- **Key Responsibilities**:
  - Handles all n8n API requests using the `X-N8N-API-KEY` authentication header
  - Implements two-tier caching: in-memory cache (5-minute TTL) + session storage fallback
  - Provides retry logic with exponential backoff (3 attempts: 1s, 2s, 4s delays)
  - Restores cache from session storage on service worker restart
- **Message Actions**: `fetchWorkflows`, `refreshWorkflows`, `testConnection`
- **Storage**: API key in `chrome.storage.sync`, workflow cache in `chrome.storage.session`

### 2. Content Script (`content/content.js` + `content/content.css`)
- **Purpose**: Injects the workflow sidebar UI into n8n workflow pages
- **Injection Strategy**:
  - Waits for n8n's sidebar to load using content-based detection (searches for "Personal" and "Overview" menu items)
  - Uses MutationObserver with 10-second timeout if sidebar isn't immediately available
  - Inserts custom section after the "Personal" menu item or before "Templates" as fallback
- **Key Features**:
  - Real-time search filtering with 300ms debounce
  - Active/inactive workflow filtering via checkboxes
  - Current workflow highlighting based on URL pattern matching (`/workflow/[id]`)
  - SPA navigation handling via MutationObserver on document
  - Resizable sidebar with width persistence in `chrome.storage.local`
  - XSS protection via HTML escaping on workflow names
- **URL Pattern**: Only activates on `https://n8n.srv854903.hstgr.cloud/workflow/*`

### 3. Popup (`popup/popup.html` + `popup.js` + `popup.css`)
- **Purpose**: Extension settings UI for API key configuration
- **Features**:
  - API key storage in `chrome.storage.sync` (synced across devices)
  - Connection testing with workflow count display
  - Auto-test on popup open if API key exists
  - User-friendly error messages for common issues

## Development Workflow

### Loading the Extension

1. **Create icons** (if not present):
   ```bash
   python create_simple_icons.py
   ```

2. **Load in Chrome**:
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project directory

3. **Reload after changes**:
   - Click the reload icon on the extension card at `chrome://extensions/`
   - Hard refresh any n8n pages: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)

### Debugging

**Service Worker**:
- `chrome://extensions/` → Click "Inspect views: service worker"
- All logs prefixed with `[n8n-ext]`

**Content Script**:
- Right-click on n8n page → Inspect → Console
- Filter console for `[n8n-ext]`

**Storage Inspection**:
- DevTools → Application tab → Storage → Extension Storage

## Configuration & Hardcoded Values

The extension is currently hardcoded to work with a specific n8n instance:

- **n8n Instance URL**: `https://n8n.srv854903.hstgr.cloud`
- **API Endpoint**: `https://n8n.srv854903.hstgr.cloud/api/v1/workflows`
- **Workflow Limit**: 250 workflows per API call (n8n API limit)
- **Cache TTL**: 5 minutes (300,000ms)
- **Content Script Timeout**: 1 second wait before initialization, 10 seconds for sidebar detection

To modify for a different n8n instance, update:
1. `manifest.json`: `host_permissions` and `content_scripts.matches`
2. `background/service-worker.js`: `API_BASE` constant
3. `content/content.js`: `navigateToWorkflow()` function's `baseUrl`

## Key Technical Patterns

### Cache Strategy
The service worker uses a dual-layer cache to survive restarts:
1. In-memory `workflowCache` object with timestamp validation
2. `chrome.storage.session` persistence (restored on `chrome.runtime.onStartup`)

### DOM Injection Strategy
Content script uses content-based detection instead of CSS selectors because n8n's DOM structure may vary:
1. Search for known menu items ("Personal", "Overview", "Templates")
2. Walk up DOM tree to find menu container
3. Validate by checking for multiple expected menu items
4. Insert custom section relative to found elements

### Error Handling
Service worker returns structured responses:
```javascript
{success: boolean, data?: any, error?: string, cached?: boolean}
```

Content script maps technical errors to user-friendly messages:
- `API_KEY_MISSING` → "Please configure your API key"
- `INVALID_API_KEY` → "Invalid API key. Please check settings."
- `API_NOT_FOUND` → "n8n API not found. Check your instance."

## Chrome API Usage

- `chrome.storage.sync`: API key (encrypted, synced across devices)
- `chrome.storage.session`: Workflow cache (volatile, survives service worker restart)
- `chrome.storage.local`: Sidebar width preference (device-specific)
- `chrome.runtime.sendMessage`: Communication between content script and service worker
- `chrome.runtime.onMessage`: Service worker message handler

## Utility Scripts

- `create_icons.py`: Creates branded extension icons (requires PIL/Pillow)
- `create_simple_icons.py`: Creates simple placeholder icons
- `debug_helper.js`: Development debugging utilities
- `inspect_section.js`: DOM inspection helper for sidebar detection
