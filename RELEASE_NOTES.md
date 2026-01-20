# Release Notes

## v1.0.3 (January 21, 2025)

### New Features
- **SPA Navigation Support**: Sidebar now appears automatically when navigating from n8n's home page to a workflow via client-side routing (no page reload required)
- **Auto-show Add Instance Form**: When no instances are configured, the popup automatically shows the Add Instance form instead of requiring users to click "+"
- **Test → Save Flow**: New instances must pass a connection test before the Save button appears, ensuring valid credentials

### Improvements
- **Better Sidebar Detection**: Improved position validation to ensure the workflow list always appears in the correct location (left sidebar)
- **Duplicate Injection Guard**: Prevents content script from initializing multiple times during SPA navigation

### Removed
- **Folder Grouping**: Removed the Folders checkbox and folder grouping functionality (was not fully supported via public API)

### Technical Changes
- Added `scripting` and `webNavigation` permissions for SPA navigation support
- Added `chrome.webNavigation.onHistoryStateUpdated` listener in service worker
- Content script now uses `window.__n8nWorkflowSidebarLoaded` guard to prevent duplicate initialization

---

## v1.0.2 (January 20, 2025)

### Bug Fixes
- Removed unused `activeTab` permission for Chrome Web Store compliance
- Fixed duplicate `init()` call causing Chrome runtime message channel errors

### New Features
- Added automated test framework with Puppeteer

---

## v1.0.1 (January 15, 2025)

### New Features
- **Multi-instance Support**: Configure and manage multiple n8n instances
- Instances synced across devices via `chrome.storage.sync`
- Auto-detect which instance matches current page

### Improvements
- Comprehensive code quality improvements (see CHANGES.md)
- Added ARIA accessibility attributes throughout
- Improved error handling with user-friendly messages
- Centralized configuration constants

---

## v1.0.0 (January 12, 2025)

### Initial Release
- Workflow sidebar for n8n workflow pages
- Real-time search filtering
- Active/Inactive workflow filtering
- Sort by Updated, Name, or Created date
- Current workflow highlighting
- Refresh button with cache support
- Support for self-hosted n8n instances
