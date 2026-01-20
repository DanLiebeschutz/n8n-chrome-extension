# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Chrome extension (Manifest V3) that adds a workflow sidebar to the n8n workflow automation platform. It supports **multiple n8n instances** and displays all workflows in a collapsible sidebar within the n8n web interface for quick navigation.

Users configure their own n8n instance(s) via the popup, and the extension automatically detects which instance matches the current page.

## Architecture

The extension follows Chrome's Manifest V3 architecture with three main components:

### 1. Service Worker (`background/service-worker.js`)
- **Purpose**: Acts as the API communication layer between content scripts and the n8n REST API, managing multiple n8n instances
- **Key Responsibilities**:
  - Manages multiple n8n instances with unique IDs, each containing: `{id, name, url, apiKey, createdAt, lastUsed}`
  - Dynamically builds API endpoints from user-configured instance URLs using `getApiBase(instanceUrl)`
  - Handles all n8n API requests using the `X-N8N-API-KEY` authentication header
  - Implements per-instance two-tier caching: in-memory cache (5-minute TTL) + session storage fallback
  - Provides retry logic with exponential backoff (3 attempts: 1s, 2s, 4s delays)
  - Restores cache from session storage on service worker restart
  - Includes migration logic from v1 (single instance) to v2 (multi-instance)
- **Message Actions**: `fetchWorkflows`, `refreshWorkflows`, `testConnection`, `getAllInstances`, `getInstanceById`, `getInstanceByOrigin`, `saveInstance`, `deleteInstance`
- **Storage**:
  - `chrome.storage.sync`: `instances` object (keyed by instance ID), `selectedInstanceId`, `version`
  - `chrome.storage.session`: `workflowCaches` object (per-instance caches)

### 2. Content Script (`content/content.js` + `content/content.css`)
- **Purpose**: Injects the workflow sidebar UI into n8n workflow pages
- **Instance Detection**:
  - Auto-detects which instance matches the current page origin using `getInstanceByOrigin`
  - Stores `currentInstanceId` and uses it for all API calls
  - Only injects sidebar if a configured instance matches the current page
- **Injection Strategy**:
  - Waits for n8n's sidebar to load using content-based detection (searches for "Personal" and "Overview" menu items)
  - Uses MutationObserver with 10-second timeout if sidebar isn't immediately available
  - Inserts custom section after the "Personal" menu item or before "Templates" as fallback
- **Key Features**:
  - Real-time search filtering with 300ms debounce
  - Active/inactive workflow filtering via checkboxes
  - Current workflow highlighting based on URL pattern matching (`/workflow/[id]`)
  - SPA navigation handling via `chrome.webNavigation.onHistoryStateUpdated` (programmatic script injection)
  - XSS protection via HTML escaping on workflow names
  - Dynamic workflow navigation: retrieves instance URL from storage and builds workflow URLs
- **URL Pattern**: Activates on `https://*/workflow/*` or `http://*/workflow/*` (matches any n8n instance)
- **SPA Navigation Support**: Uses `webNavigation` API to detect client-side routing and inject content script dynamically

### 3. Popup (`popup/popup.html` + `popup.js` + `popup.css`)
- **Purpose**: Multi-instance management UI for configuring n8n instances
- **Features**:
  - Add/edit/delete multiple n8n instances
  - Each instance requires: name, URL, and API key
  - Instance list sorted by last used (most recent first)
  - Connection testing per instance with workflow count display
  - Dynamic permission requests: uses `chrome.permissions.request()` to request access to each instance's origin
  - Validates and normalizes URLs (auto-adds https:// if missing)
  - Instance storage in `chrome.storage.sync` (synced across devices)
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

## Multi-Instance Architecture

The extension is designed to work with **any self-hosted n8n instance**:

### Instance Configuration
- Users configure instances via the popup UI (click extension icon)
- Each instance is stored with: `{id, name, url, apiKey, createdAt, lastUsed}`
- Instances are stored in `chrome.storage.sync` and synced across devices
- Users can manage multiple n8n instances simultaneously

### Dynamic Permissions
- Extension requests broad host permissions (`https://*/*`, `http://*/*`) in manifest
- When users add an instance, the popup requests permission for that specific origin using `chrome.permissions.request()`
- This allows the extension to work with any n8n domain without requiring manifest updates

### Instance Detection
- Content script auto-detects which instance matches the current page origin
- Uses `getInstanceByOrigin()` to find matching instance by URL
- If no instance matches, sidebar is not injected

### Configuration Constants
- **Workflow Limit**: 250 workflows per API call (n8n API limit)
- **Cache TTL**: 5 minutes (300,000ms)
- **Content Script Initialization**: 1 second delay before init
- **Sidebar Detection Timeout**: 10 seconds using MutationObserver
- **API Retry Logic**: 3 attempts with exponential backoff (1s, 2s, 4s delays)

## Key Technical Patterns

### Cache Strategy
The service worker uses a dual-layer per-instance cache to survive restarts:
1. In-memory `workflowCaches` object (keyed by instance ID) with timestamp validation
2. `chrome.storage.session` persistence (restored on `chrome.runtime.onStartup`)
3. Each cache entry contains: `{data: Array, timestamp: number, ttl: number}`
4. Cache is invalidated per instance or globally

### Content Script Initialization
The content script uses a **single delayed initialization** pattern to avoid race conditions:
- `init()` is called once via `setTimeout(init, 1000)` to allow n8n to load
- **Important**: Do NOT add additional `init()` calls - this causes Chrome runtime message channel errors
- The 1-second delay ensures n8n's sidebar is ready before injection attempts

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

- `chrome.storage.sync`: Instances object (keyed by instance ID), version number (synced across devices)
- `chrome.storage.session`: Per-instance workflow caches (volatile, survives service worker restart)
- `chrome.storage.local`: Sort preference (device-specific)
- `chrome.runtime.sendMessage`: Communication between content script/popup and service worker
- `chrome.runtime.onMessage`: Service worker message handler
- `chrome.permissions.request()`: Dynamic permission requests for instance origins
- `chrome.permissions.contains()`: Check if permission already granted for an origin
- `chrome.webNavigation.onHistoryStateUpdated`: Detect SPA navigations to inject content script
- `chrome.scripting.executeScript`: Programmatically inject content script on SPA navigation
- `chrome.scripting.insertCSS`: Programmatically inject CSS on SPA navigation
- `chrome.tabs.query`: Query tabs for credential update notifications
- `chrome.tabs.sendMessage`: Send messages to content scripts in specific tabs

## Utility Scripts

**Root-level scripts:**
- `create_icons.py`: Creates branded extension icons (requires PIL/Pillow)
- `create_simple_icons.py`: Creates simple placeholder icons
- `debug_helper.js`: Development debugging utilities
- `inspect_section.js`: DOM inspection helper for sidebar detection
- `process_screenshot.py`: Processes screenshots for Chrome Web Store listing

## Publishing Workflow

### Pre-Publish Checklist

Before publishing to the Chrome Web Store, run the pre-publish validation script:

```bash
./scripts/pre-publish.sh
```

This script automatically:
- ✓ Checks for store icon (128x128) - creates if missing
- ✓ Validates manifest.json
- ✓ Verifies all required files exist
- ⚠ Warns about console.log statements in production code

### Publishing Steps

1. **Run pre-publish checks:**
   ```bash
   ./scripts/pre-publish.sh
   ```

2. **Publish using Claude Code:**
   ```
   @publish-extension
   ```
   
   Or use the extension-publisher agent:
   ```
   publish the extension
   ```

   This will:
   - Commit all changes to git
   - Push to remote repository
   - Create a Chrome Web Store package (.zip file)

3. **Upload to Chrome Web Store:**
   - Go to https://chrome.google.com/webstore/developer/dashboard
   - Upload the generated `n8n-extension-v{version}.zip`
   - Update store listing if needed
   - Submit for review

### Store Assets

The extension includes store assets:

- **Store Icon** (`icons/n8n-chrome-extension-store-icon.png`): 128x128 icon for Chrome Web Store
  - Features n8n branding with workflow visualization
  - Shows sidebar + multi-instance indicators
- **Store Screenshot** (`n8n_store_screenshot.jpg`): Screenshot for Chrome Web Store listing

### Publishing Scripts

Located in `scripts/`:

- **`pre-publish.sh`**: Complete pre-publish validation
- **`check-store-icon.py`**: Store icon checker/generator
- **`convert-screenshot.py`**: Screenshot format converter for store listing

See `scripts/README.md` for detailed documentation.

### Release Notes

**IMPORTANT**: When publishing a new version, always update `RELEASE_NOTES.md`:

1. Add a new section at the top with the version number and date
2. Organize changes into categories:
   - **New Features**: New functionality added
   - **Improvements**: Enhancements to existing features
   - **Bug Fixes**: Issues that were resolved
   - **Removed**: Features or functionality removed
   - **Technical Changes**: Internal changes (permissions, APIs, architecture)
3. Keep descriptions concise but informative
4. Commit the updated release notes with the version bump

## Known Issues & Solutions

### Workflow List Appearing in Wrong Location

**Problem**: The workflow list/sidebar appears in the main content area instead of the left navigation panel.

**Root Cause**: The `findSidebarByContent()` and `findMenuContainer()` functions in `content/content.js` use text-based detection to find n8n's sidebar. They search for elements containing "Personal", "Overview", and "Templates" text. However, this text can appear in multiple places on the page (e.g., breadcrumbs, main content area), causing the wrong container to be selected.

**How It Was Fixed**:
1. **Position validation at element level**: Before processing any "Personal" or "Overview" text match, verify the element itself is on the left side of the screen (`elRect.left < 250`). This prevents matching breadcrumbs or other occurrences of these words in the main content area.

2. **Position validation at container level**: The `findMenuContainer()` function validates that the found container is on the left side using `getBoundingClientRect()`:
   - `rect.left < 100` - Container must be near the left edge
   - `rect.width < 400` - Container must be narrow (sidebar width)

3. **Removed unreliable CSS class detection**: Originally tried `[class*="sidebar"]` but this matched wrong elements. Pure content-based detection with position validation is more reliable.

4. **Reject false positives**: If an element or container has the right text but wrong position, the search continues instead of using it.

**How to Avoid in Future Sessions**:
1. **Always validate sidebar position**: When modifying sidebar detection logic, ensure any found container is validated for:
   - Left-side screen position (`rect.left < 100`)
   - Narrow width typical of sidebars (`rect.width < 400`)

2. **Test on workflow editor page**: The n8n workflow editor page has a different DOM structure than the home page. Always test sidebar injection on both:
   - Direct navigation to `/workflow/xxx`
   - SPA navigation from home page to workflow page

3. **Check console logs**: The content script logs sidebar detection attempts with `[n8n-ext]` prefix. Look for:
   - `"Found sidebar by class:"` - Good, found via CSS class
   - `"Found menu container via Personal:"` - Using text detection
   - `"Found container with menu items but not in sidebar position"` - Container rejected due to wrong position

**Relevant Code** (`content/content.js`):
- `findSidebarByContent()` - Main sidebar detection function
- `findMenuContainer()` - Walks up DOM tree with position validation
- `insertSection()` - Inserts the workflow section into found sidebar

