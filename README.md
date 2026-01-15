# n8n Workflow Sidebar - Chrome Extension

A Chrome extension that displays all your n8n workflows in a convenient sidebar panel within the workflow editor, enabling quick workflow switching without leaving the current page.

## Features

- **Multi-Instance Support**: Manage and switch between multiple n8n instances
- **Auto-Detection**: Automatically detects which instance to use based on the current page URL
- **Quick Workflow Access**: View all workflows directly in the left sidebar
- **Smart Search**: Instantly filter workflows by name
- **Status Filters**: Toggle between active and inactive workflows
- **Current Workflow Highlight**: Easily see which workflow you're editing
- **API Caching**: 5-minute cache per instance reduces API load and improves performance
- **n8n Design Integration**: Styles match n8n's interface seamlessly

## Prerequisites

- Google Chrome browser (or Chromium-based browser like Edge)
- One or more n8n instances (cloud or self-hosted)
- n8n API key for each instance (see setup instructions below)

## Installation

### 1. Get the Extension Files

Clone or download this repository to your local machine:

```bash
git clone <repository-url>
cd n8n-chrome-extension
```

### 2. Create Extension Icons (if needed)

The extension includes a pre-built store icon. If you need to regenerate icons:

```bash
# Run the icon check script (auto-generates if missing)
python3 scripts/check-store-icon.py
```

Or create manually using any image editor:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)
- `icons/store-icon-128.png` (128x128 pixels for Chrome Web Store)

### 3. Load Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `n8n-chrome-extension` folder
5. The extension should now appear in your extensions list

### 4. Pin the Extension (Optional)

1. Click the puzzle icon in Chrome's toolbar
2. Find "n8n Workflow Sidebar"
3. Click the pin icon to keep it visible

## Configuration

### Get Your n8n API Key

For each n8n instance you want to use:

1. Log in to your n8n instance
2. Navigate to **Settings → n8n API**
3. Click **Create an API key**
4. Choose a label (e.g., "Chrome Extension")
5. Set expiration time (or leave as "Never")
6. Click **Create** and copy the generated API key

### Add an Instance

1. Click the extension icon in Chrome's toolbar
2. Click the **+** button to add a new instance
3. Fill in the form:
   - **Name**: A friendly name (e.g., "Production", "Staging")
   - **Instance URL**: Your n8n instance URL (e.g., `https://n8n.company.com`)
   - **API Key**: Paste the API key you generated
4. Click **Test** to verify the connection (optional)
5. Click **Save**

The extension will request permission to access your n8n instance domain. Click "Allow" to grant permission.

### Manage Instances

From the extension popup, you can:
- **Add** new instances with the + button
- **Edit** existing instances with the ✎ button
- **Test** connection with the ↻ button
- **Delete** instances with the × button

## Usage

### Basic Usage

1. Navigate to any workflow in any of your configured n8n instances:
   - Example: `https://your-instance.com/workflow/<workflow-id>`

2. The extension will automatically:
   - Detect which instance you're viewing
   - Inject a "My Workflows" section in the left sidebar
   - Display workflows from that specific instance

3. Features available:
   - **Search**: Type to filter workflows by name
   - **Filters**: Toggle "Active" and "Inactive" checkboxes
   - **Click workflow**: Navigate to that workflow
   - **Refresh button**: Reload workflows from API (bypasses cache)
   - **Current workflow**: Highlighted in blue

### Multi-Instance Workflow

1. Configure multiple n8n instances (Production, Staging, Development, etc.)
2. Navigate to any workflow page on any instance
3. The sidebar automatically shows workflows from the matching instance
4. Switch between instances by navigating to different domains
5. Each instance maintains its own workflow cache

## Troubleshooting

### Extension doesn't appear on workflow pages

- Check that you're on a workflow page (URL contains `/workflow/`)
- Verify you have an instance configured for that domain (check extension popup)
- Hard refresh the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
- Check browser console for errors: Right-click → Inspect → Console

### "No instance configured for this page" error

- Click the extension icon
- Add an instance for the domain you're trying to use
- Make sure the instance URL matches the origin (protocol + domain)
- Reload the n8n page after adding the instance

### "Please configure your API key" error

- Click the extension icon
- Edit the instance and verify your API key is correct
- Click "Test" to verify it's valid
- If test fails, regenerate a new API key in n8n settings

### Workflows not loading

1. Check your internet connection
2. Verify the n8n instance is accessible in a regular browser tab
3. Click the refresh button in the sidebar
4. Test the connection from the extension popup
5. Check service worker logs:
   - Go to `chrome://extensions/`
   - Find "n8n Workflow Sidebar"
   - Click "Inspect views: service worker"
   - Check Console tab for errors

### Sidebar not visible

- The sidebar is injected below existing n8n sections (Overview, Personal)
- Scroll down in the left sidebar if necessary
- Check that n8n's sidebar is expanded (not collapsed)
- Verify you have workflows in that instance

### Styles look broken

- Hard refresh the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
- Reload the extension:
  - Go to `chrome://extensions/`
  - Click reload icon on the extension card

### Permission issues

- When adding an instance, Chrome will request permission for that domain
- You must grant permission for the extension to work with that instance
- To revoke permissions: `chrome://extensions/` → Extension details → Permissions

## Development

### Project Structure

```
n8n-chrome-extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # API communication & instance management
├── content/
│   ├── content.js            # UI injection script
│   └── content.css           # Sidebar styles
├── popup/
│   ├── popup.html            # Instance management UI
│   ├── popup.js              # Instance CRUD logic
│   └── popup.css             # Popup styles
├── scripts/
│   ├── check-store-icon.py   # Store icon generator
│   ├── pre-publish.sh        # Pre-publish validation
│   ├── convert-screenshot.py # Screenshot converter
│   └── README.md             # Scripts documentation
├── icons/                    # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── store-icon-128.png
└── README.md
```

### Making Changes

1. Edit the source files
2. Go to `chrome://extensions/`
3. Click the reload icon on the extension card
4. Hard refresh any n8n pages you have open

### Debugging

**Service Worker (API layer)**:
- Go to `chrome://extensions/`
- Click "Inspect views: service worker"
- View console logs (filter for `[n8n-ext]`) and network requests

**Content Script (UI)**:
- Open a workflow page
- Right-click → Inspect
- Check Console tab (filter for `[n8n-ext]`)

**Storage**:
- In DevTools → Application tab
- Expand "Storage" → "Extension Storage"
- View stored instances and cache data

### Pre-Publish Workflow

Before publishing updates, run the validation script:

```bash
./scripts/pre-publish.sh
```

This checks:
- Store icon exists and is correct size
- manifest.json is valid JSON
- All required files are present
- No console.log statements in production code

## Technical Details

### Architecture

**Multi-Instance Storage Schema (v2)**:
```javascript
{
  version: 2,
  instances: {
    "uuid-1": {
      id: "uuid-1",
      name: "Production",
      url: "https://n8n.company.com",
      apiKey: "n8n_api_xxx",
      createdAt: 1234567890,
      lastUsed: 1234567890
    },
    "uuid-2": { /* ... */ }
  },
  selectedInstanceId: "uuid-1"
}
```

**Migration from v1**: The extension automatically migrates single-instance installations to the new multi-instance format on update.

### API Communication

- Uses n8n REST API: `GET /api/v1/workflows`
- Authentication: `X-N8N-API-KEY` header
- Per-instance cache with 5-minute TTL
- Retry logic: 3 attempts with exponential backoff
- Automatic instance detection by URL origin

### Storage

- **chrome.storage.sync**: Instance configurations and API keys (encrypted by Chrome, synced across devices)
- **chrome.storage.session**: Per-instance workflow caches (volatile, cleared on restart)
- **chrome.storage.local**: UI preferences (sidebar width)
- **In-memory**: Active cache in service worker

### Browser Compatibility

- Chrome (latest)
- Edge (Chromium-based)
- Other Chromium browsers

## Security Notes

- API keys are stored in `chrome.storage.sync` (encrypted by Chrome)
- Keys are never logged to console
- HTTPS-only communication with n8n instances
- No external dependencies or third-party services
- Permission requests are per-instance (not all HTTPS sites)
- Dynamic permission system - only requests access to configured domains

## Limitations

- Requires valid API key for each instance
- Cache refresh every 5 minutes per instance (configurable in code)
- Maximum 250 workflows per fetch (n8n API limit)
- Chrome storage sync limit: ~100KB (approximately 50-500 instances depending on configuration)

## Future Enhancements

Potential features for future versions:

- Workflow tags and folders
- Last execution status indicators
- Quick workflow actions (activate/deactivate)
- Keyboard shortcuts for search
- Workflow favorites/pins
- Dark mode detection and support
- Bulk instance import/export
- Custom cache TTL per instance

## Publishing

### Chrome Web Store

1. Run pre-publish checks: `./scripts/pre-publish.sh`
2. Create package: `@publish-extension` (in Claude Code)
3. Upload to: https://chrome.google.com/webstore/developer/dashboard

## Support

For issues or questions:

1. Check the Troubleshooting section above
2. Check browser console for error messages
3. Verify n8n instance and API key are valid
4. Test connection from extension popup
5. Review n8n API documentation: https://docs.n8n.io/api/

## License

MIT License - feel free to modify and distribute

## Credits

Built for n8n (https://n8n.io) - Workflow automation platform

---

**Version**: 1.0.1
**Last Updated**: January 2026
**Manifest**: V3 (Chrome Extension)
