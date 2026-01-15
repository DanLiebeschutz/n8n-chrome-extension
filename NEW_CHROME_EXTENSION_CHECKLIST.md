# New Chrome Extension Checklist

A comprehensive checklist for creating and publishing a new Chrome extension.

## Phase 1: Planning & Naming

- [ ] **Choose a unique name** (max 45 characters)
  - Check availability on Chrome Web Store
  - Ensure it's descriptive and searchable
  - Avoid trademark conflicts

- [ ] **Write short description** (max 132 characters)
  - Used in Chrome Web Store search results
  - Should clearly explain what the extension does

- [ ] **Write detailed description** (no character limit)
  - Explain features and benefits
  - Include use cases and examples
  - Add any setup/configuration instructions

- [ ] **Define target audience**
  - Who will use this extension?
  - What problem does it solve?

## Phase 2: Technical Setup

- [ ] **Create manifest.json (Manifest V3)**
  - Set `manifest_version: 3`
  - Add `name`, `version`, `description`
  - Define `permissions` and `host_permissions`
  - Configure `content_scripts` if needed
  - Add `background.service_worker` if needed
  - Set up `action` (popup) if needed

- [ ] **Set up project structure**
  ```
  project/
  ├── manifest.json
  ├── icons/
  ├── background/ (if needed)
  ├── content/ (if needed)
  ├── popup/ (if needed)
  └── README.md
  ```

- [ ] **Configure permissions carefully**
  - Only request what's absolutely necessary
  - Be prepared to justify each permission in review

## Phase 3: Icons & Assets

- [ ] **Create store icon** (128x128 pixels PNG)
  - Saved as `icons/store-icon-128.png`
  - Used in Chrome Web Store listing
  - Should be clear and recognizable

- [ ] **Create extension icons**
  - `icons/icon-16.png` (16x16) - Favicon/toolbar
  - `icons/icon-48.png` (48x48) - Extensions management page
  - `icons/icon-128.png` (128x128) - Installation/permissions dialog

- [ ] **Create store screenshots** (1-5 images)
  - 1280x800 or 640x400 pixels
  - Show key features in action
  - First screenshot is most important

- [ ] **Create promotional images** (optional but recommended)
  - Small tile: 440x280 pixels
  - Marquee: 1400x560 pixels
  - Used for featuring/promotions

## Phase 4: Development

- [ ] **Implement core functionality**
  - Background/service worker logic
  - Content script injection
  - Popup UI (if applicable)

- [ ] **Handle API communication**
  - Use chrome.runtime.sendMessage for messaging
  - Implement proper error handling
  - Add retry logic for network requests

- [ ] **Add user settings/configuration**
  - Use chrome.storage.sync or chrome.storage.local
  - Create options page or popup for settings

- [ ] **Implement security best practices**
  - Escape user input to prevent XSS
  - Validate API responses
  - Use HTTPS for all external requests
  - Follow Content Security Policy

## Phase 5: Testing

- [ ] **Load extension unpacked in Chrome**
  - Navigate to chrome://extensions/
  - Enable Developer mode
  - Click "Load unpacked"

- [ ] **Test all features thoroughly**
  - Test on target websites
  - Test permissions and storage
  - Test across different Chrome versions

- [ ] **Test error scenarios**
  - Network failures
  - Invalid user input
  - Permission denials

- [ ] **Remove console.log statements**
  - Clean up debugging code
  - Use proper error reporting

- [ ] **Performance testing**
  - Check memory usage
  - Monitor CPU usage
  - Ensure fast load times

## Phase 6: Documentation

- [ ] **Create README.md**
  - Installation instructions
  - Usage guide
  - Configuration steps
  - Troubleshooting section

- [ ] **Add CLAUDE.md** (if working with Claude Code)
  - Document architecture
  - Explain key technical patterns
  - Include debugging tips
  - **IMPORTANT:** Update CLAUDE.md whenever you make significant architectural changes

- [ ] **Write privacy policy** (if collecting any data)
  - Required by Chrome Web Store
  - Must be hosted on accessible domain
  - Clearly explain data collection and usage

## Phase 7: Pre-Publishing

- [ ] **Create publishing scripts**
  - Pre-publish validation script
  - Build/package script
  - Version bump script

- [ ] **Version management**
  - Set initial version (e.g., 1.0.0)
  - Follow semantic versioning
  - Update manifest.json version

- [ ] **Create .zip package**
  - Include only necessary files
  - Exclude development files (.git, node_modules, etc.)
  - Name format: `extension-name-v1.0.0.zip`

- [ ] **Final checklist**
  - All console.log removed
  - All icons present and correct sizes
  - manifest.json validated
  - No hardcoded credentials
  - README is complete
  - CLAUDE.md is up-to-date and reflects current architecture

## Phase 8: Chrome Web Store Setup

- [ ] **Create developer account**
  - Go to https://chrome.google.com/webstore/developer/dashboard
  - Pay one-time $5 registration fee
  - Verify email address

- [ ] **Prepare store listing**
  - Upload extension package (.zip)
  - Upload store icon (128x128)
  - Upload screenshots (1-5 images)
  - Add promotional images (optional)

- [ ] **Fill out store listing details**
  - Short description (132 char max)
  - Detailed description
  - Category selection
  - Language support

- [ ] **Write all permission justifications**
  - Explain why each permission is needed (e.g., `storage`, `activeTab`, `host_permissions`)
  - Be specific about how each permission is used in your extension
  - Chrome reviewers will scrutinize broad permissions
  - Examples:
    - `storage`: "Store user API keys and workflow cache"
    - `activeTab`: "Inject sidebar into active workflow page"
    - `host_permissions`: "Access n8n API to fetch workflow data"

- [ ] **Set visibility settings**
  - Public (anyone can find and install)
  - Unlisted (only those with link)
  - Private (specific users/groups)

- [ ] **Add privacy policy URL** (if applicable)
  - Required if collecting user data
  - Must be publicly accessible

- [ ] **Submit for review**
  - Review can take a few hours to several days
  - Be prepared to answer questions from reviewers

## Phase 9: Post-Publishing

- [ ] **Monitor reviews and ratings**
  - Respond to user feedback
  - Address common issues

- [ ] **Track analytics** (optional)
  - Monitor active users
  - Track feature usage
  - Identify problem areas

- [ ] **Plan updates**
  - Fix bugs reported by users
  - Add requested features
  - Keep dependencies updated

- [ ] **Version updates**
  - Bump version in manifest.json
  - Create changelog
  - Re-submit to Chrome Web Store

## Additional Resources

- **Chrome Extension Documentation**: https://developer.chrome.com/docs/extensions/
- **Manifest V3 Migration**: https://developer.chrome.com/docs/extensions/migrating/
- **Chrome Web Store Developer Dashboard**: https://chrome.google.com/webstore/developer/dashboard
- **Best Practices**: https://developer.chrome.com/docs/extensions/mv3/quality_guidelines/

## Notes

- Chrome Web Store review typically takes 1-3 business days
- Extensions with broader permissions may face stricter review
- Keep extension focused on single, clear purpose
- Respond promptly to reviewer questions
- Update regularly to maintain good standing
