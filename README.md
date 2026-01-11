# n8n Workflow Sidebar - Chrome Extension

A Chrome extension that displays all your n8n workflows in a convenient sidebar panel within the workflow editor, enabling quick workflow switching without leaving the current page.

## Features

- **Quick Workflow Access**: View all workflows directly in the left sidebar
- **Smart Search**: Instantly filter workflows by name
- **Status Filters**: Toggle between active and inactive workflows
- **Current Workflow Highlight**: Easily see which workflow you're editing
- **API Caching**: 5-minute cache reduces API load and improves performance
- **n8n Design Integration**: Styles match n8n's interface seamlessly

## Prerequisites

- Google Chrome browser (or Chromium-based browser like Edge)
- n8n instance at: `https://n8n.srv854903.hstgr.cloud`
- n8n API key (see setup instructions below)

## Installation

### 1. Get the Extension Files

Clone or download this repository to your local machine:

```bash
cd /Users/danliebeschutz/Documents/Projects/Dev/n8n-chrome-extension
```

### 2. Create Extension Icons

Before loading the extension, you need to add icons. You can:

**Option A: Create simple placeholder icons**

Use any image editor or online tool to create three PNG files:
- `icons/icon16.png` (16x16 pixels)
- `icons/icon48.png` (48x48 pixels)
- `icons/icon128.png` (128x128 pixels)

**Option B: Use ImageMagick to create quick placeholders**

```bash
# Install ImageMagick if needed: brew install imagemagick

# Create simple colored icons
convert -size 16x16 xc:#4a9eff icons/icon16.png
convert -size 48x48 xc:#4a9eff icons/icon48.png
convert -size 128x128 xc:#4a9eff icons/icon128.png
```

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

1. Log in to your n8n instance: https://n8n.srv854903.hstgr.cloud
2. Navigate to **Settings → n8n API**
3. Click **Create an API key**
4. Choose a label (e.g., "Chrome Extension")
5. Set expiration time (or leave as "Never")
6. Click **Create** and copy the generated API key

### Configure the Extension

1. Click the extension icon in Chrome's toolbar
2. Paste your API key in the "API Key" field
3. Click **Test Connection** to verify it works
4. Click **Save Settings**
5. You should see a success message and workflow count

## Usage

### Basic Usage

1. Navigate to any workflow in n8n:
   - `https://n8n.srv854903.hstgr.cloud/workflow/<workflow-id>`

2. The extension will automatically inject a "My Workflows" section in the left sidebar

3. Features available:
   - **Search**: Type to filter workflows by name
   - **Filters**: Toggle "Active" and "Inactive" checkboxes
   - **Click workflow**: Navigate to that workflow
   - **Refresh button**: Reload workflows from API (bypasses cache)
   - **Current workflow**: Highlighted in blue

### Keyboard Shortcuts

- Focus search: Click the search box
- Navigate: Click any workflow name

## Troubleshooting

### Extension doesn't appear on workflow pages

- Check that you're on a workflow page (URL contains `/workflow/`)
- Hard refresh the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
- Check browser console for errors: Right-click → Inspect → Console

### "Please configure your API key" error

- Click the extension icon
- Verify your API key is saved
- Click "Test Connection" to verify it's valid
- If test fails, regenerate a new API key in n8n settings

### Workflows not loading

1. Check your internet connection
2. Verify n8n instance is accessible: https://n8n.srv854903.hstgr.cloud
3. Click the refresh button in the sidebar
4. Check service worker logs:
   - Go to `chrome://extensions/`
   - Find "n8n Workflow Sidebar"
   - Click "Inspect views: service worker"
   - Check Console tab for errors

### Sidebar not visible

- The sidebar is injected below existing n8n sections (Overview, Personal)
- Scroll down in the left sidebar if necessary
- Check that n8n's sidebar is expanded (not collapsed)

### Styles look broken

- Hard refresh the page: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+F5` (Windows)
- Reload the extension:
  - Go to `chrome://extensions/`
  - Click reload icon on the extension card

## Development

### Project Structure

```
n8n-chrome-extension/
├── manifest.json              # Extension configuration
├── background/
│   └── service-worker.js     # API communication layer
├── content/
│   ├── content.js            # UI injection script
│   └── content.css           # Sidebar styles
├── popup/
│   ├── popup.html            # Settings UI
│   ├── popup.js              # Settings logic
│   └── popup.css             # Popup styles
├── icons/                    # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
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
- View console logs and network requests

**Content Script (UI)**:
- Open a workflow page
- Right-click → Inspect
- Check Console tab (filter for `[n8n-ext]`)

**Storage**:
- In DevTools → Application tab
- Expand "Storage" → "Extension Storage"
- View/modify stored data

## Technical Details

### API Communication

- Uses n8n REST API: `GET /api/v1/workflows`
- Authentication: `X-N8N-API-KEY` header
- Cache TTL: 5 minutes
- Retry logic: 3 attempts with exponential backoff

### Storage

- **chrome.storage.sync**: API key (encrypted by Chrome, synced across devices)
- **chrome.storage.session**: Workflow cache (volatile, cleared on restart)
- **In-memory**: Active cache in service worker

### Browser Compatibility

- Chrome (latest)
- Edge (Chromium-based)
- Other Chromium browsers

## Security Notes

- API keys are stored in `chrome.storage.sync` (encrypted by Chrome)
- Keys are never logged to console
- HTTPS-only communication with n8n instance
- No external dependencies or third-party services

## Limitations

- Only works with the configured n8n instance
- Requires valid API key
- Cache refresh every 5 minutes (configurable in code)
- Maximum 250 workflows per fetch (n8n API limit)

## Future Enhancements

Potential features for future versions:

- Multi-instance support (switch between different n8n instances)
- Workflow tags and folders
- Last execution status indicators
- Quick workflow actions (activate/deactivate)
- Keyboard shortcuts for search
- Workflow favorites/pins
- Dark mode detection and support

## Support

For issues or questions:

1. Check the Troubleshooting section above
2. Check browser console for error messages
3. Verify n8n instance and API key are valid
4. Review n8n API documentation: https://docs.n8n.io/api/

## License

MIT License - feel free to modify and distribute

## Credits

Built for n8n (https://n8n.io) - Workflow automation platform

---

**Version**: 1.0.0
**Last Updated**: January 2026
**n8n Instance**: https://n8n.srv854903.hstgr.cloud
