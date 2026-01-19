# n8n Chrome Extension Test Checklist

This document contains test cases for the n8n Workflow Sidebar Chrome extension.

## Automated Tests

Run the automated test suite with:

```bash
npm test
```

## Test Cases

### TC-001: Open Extension Popup

| Field | Value |
|-------|-------|
| **ID** | TC-001 |
| **Description** | Open the extension popup by navigating to its URL |
| **Steps** | 1. Launch Chrome with extension loaded<br>2. Navigate to `chrome-extension://{id}/popup/popup.html` |
| **Expected** | Popup page loads successfully with "n8n Workflow Sidebar" header visible |
| **Pass Criteria** | Header element with text "n8n Workflow Sidebar" is present |

### TC-002: Click Add Instance Button

| Field | Value |
|-------|-------|
| **ID** | TC-002 |
| **Description** | Click the "+" button to show the add instance form |
| **Steps** | 1. Open extension popup (TC-001)<br>2. Click the `#add-instance-btn` button |
| **Expected** | Form view becomes visible with "Add Instance" title |
| **Pass Criteria** | `#form-view` element is visible and contains "Add Instance" text |

### TC-003: Fill Instance Form

| Field | Value |
|-------|-------|
| **ID** | TC-003 |
| **Description** | Fill in the instance name and URL fields |
| **Steps** | 1. Complete TC-002<br>2. Enter "Dan" in `#instance-name`<br>3. Enter "https://n8n.srv853078.hstgr.cloud" in `#instance-url` |
| **Expected** | Both fields contain the entered values |
| **Pass Criteria** | Input values match expected strings |
| **Notes** | API key field is left blank for manual input by user |

## Manual Steps

After automated tests complete, the script will pause for manual intervention:

1. **Enter API Key**: User must manually enter their n8n API key in the `#instance-api-key` field
2. **Click Test**: Optionally click "Test" button to verify connection
3. **Click Save**: Click "Save" button to save the instance

## Test Summary Format

The test script outputs results in the following format:

```
=== Test Results ===
[PASS] TC-001: Open Extension Popup
[PASS] TC-002: Click Add Instance Button
[PASS] TC-003: Fill Instance Form

Total: 3 tests | Passed: 3 | Failed: 0
```

## Adding New Tests

To add a new test case:

1. Add documentation to this file following the table format above
2. Add the test function to `scripts/test-extension.js`
3. Include the test in the `runTests()` array
