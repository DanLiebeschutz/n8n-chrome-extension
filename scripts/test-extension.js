#!/usr/bin/env node
/**
 * Extension Test Script
 *
 * Runs automated tests for the n8n Workflow Sidebar Chrome extension.
 * Uses Puppeteer to interact with the extension popup.
 *
 * Usage: npm test
 */

import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EXTENSION_PATH = path.resolve(__dirname, '..');
const RESULTS_FILE = path.join(EXTENSION_PATH, 'test-results.txt');

// Test results storage
const results = [];

function logResult(testId, description, passed, error = null) {
    const symbol = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
    console.log(`${symbol} ${testId}: ${description}`);
    if (error) {
        console.log(`       Error: ${error}`);
    }
    results.push({ testId, description, passed, error });
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
}

function generateReport() {
    const timestamp = getTimestamp();
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    let report = `\n${'='.repeat(60)}\n`;
    report += `Test Run: ${timestamp}\n`;
    report += `${'='.repeat(60)}\n\n`;

    results.forEach(r => {
        const status = r.passed ? '[PASS]' : '[FAIL]';
        report += `${status} ${r.testId}: ${r.description}\n`;
        if (r.error) {
            report += `       Error: ${r.error}\n`;
        }
    });

    report += `\nSummary: ${total} tests | Passed: ${passed} | Failed: ${failed}\n`;

    return report;
}

function saveResultsToFile() {
    const report = generateReport();

    // Append to file (creates if doesn't exist)
    fs.appendFileSync(RESULTS_FILE, report);
    console.log(`\n📄 Results saved to: ${RESULTS_FILE}`);
}

function printSummary() {
    console.log('\n=== Test Results ===');
    results.forEach(r => {
        const symbol = r.passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
        console.log(`${symbol} ${r.testId}: ${r.description}`);
    });

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;

    console.log(`\nTotal: ${total} tests | Passed: ${passed} | Failed: ${failed}`);

    // Save to file
    saveResultsToFile();

    return failed === 0;
}

async function getExtensionId(browser) {
    // Get the extension ID by checking the service worker target
    const targets = await browser.targets();
    const extensionTarget = targets.find(
        target => target.type() === 'service_worker' && target.url().includes('chrome-extension://')
    );

    if (extensionTarget) {
        const url = extensionTarget.url();
        const match = url.match(/chrome-extension:\/\/([^/]+)/);
        if (match) {
            return match[1];
        }
    }

    // Fallback: wait a bit and try again
    await new Promise(resolve => setTimeout(resolve, 2000));
    const retryTargets = await browser.targets();
    for (const target of retryTargets) {
        const url = target.url();
        if (url.includes('chrome-extension://') && url.includes(EXTENSION_PATH.split('/').pop())) {
            const match = url.match(/chrome-extension:\/\/([^/]+)/);
            if (match) {
                return match[1];
            }
        }
    }

    return null;
}

async function runTests() {
    console.log('🧪 n8n Workflow Sidebar Extension Tests\n');

    // Verify extension files exist
    const manifestPath = path.join(EXTENSION_PATH, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
        console.error('❌ Error: manifest.json not found at:', manifestPath);
        process.exit(1);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    console.log(`📦 Testing: ${manifest.name} v${manifest.version}`);
    console.log(`📂 Extension path: ${EXTENSION_PATH}\n`);

    let browser;
    let page;

    try {
        // Launch browser with extension
        console.log('🚀 Launching Chrome with extension...\n');
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            args: [
                '--start-maximized',
                '--no-first-run',
                '--no-default-browser-check',
                `--disable-extensions-except=${EXTENSION_PATH}`,
                `--load-extension=${EXTENSION_PATH}`,
            ],
        });

        // Wait for extension to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get extension ID
        const extensionId = await getExtensionId(browser);
        if (!extensionId) {
            console.error('❌ Could not find extension ID');
            process.exit(1);
        }
        console.log(`🔑 Extension ID: ${extensionId}\n`);

        // Create a new page for testing
        page = await browser.newPage();

        // =====================
        // TC-001: Open Extension Popup
        // =====================
        console.log('Running tests...\n');

        try {
            const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
            await page.goto(popupUrl, { waitUntil: 'networkidle0', timeout: 10000 });

            const header = await page.$eval('h1', el => el.textContent);
            const passed = header === 'n8n Workflow Sidebar';
            logResult('TC-001', 'Open Extension Popup', passed, passed ? null : `Expected "n8n Workflow Sidebar", got "${header}"`);
        } catch (error) {
            logResult('TC-001', 'Open Extension Popup', false, error.message);
        }

        // =====================
        // TC-002: Click Add Instance Button
        // =====================
        try {
            await page.click('#add-instance-btn');
            await new Promise(resolve => setTimeout(resolve, 500));

            const formVisible = await page.$eval('#form-view', el => el.style.display !== 'none');
            const formTitle = await page.$eval('#form-title', el => el.textContent);
            const passed = formVisible && formTitle === 'Add Instance';
            logResult('TC-002', 'Click Add Instance Button', passed, passed ? null : `Form visible: ${formVisible}, Title: "${formTitle}"`);
        } catch (error) {
            logResult('TC-002', 'Click Add Instance Button', false, error.message);
        }

        // =====================
        // TC-003: Fill Instance Form
        // =====================
        try {
            await page.type('#instance-name', 'Dan');
            await page.type('#instance-url', 'https://n8n.srv853078.hstgr.cloud');

            const nameValue = await page.$eval('#instance-name', el => el.value);
            const urlValue = await page.$eval('#instance-url', el => el.value);

            const passed = nameValue === 'Dan' && urlValue === 'https://n8n.srv853078.hstgr.cloud';
            logResult('TC-003', 'Fill Instance Form', passed, passed ? null : `Name: "${nameValue}", URL: "${urlValue}"`);
        } catch (error) {
            logResult('TC-003', 'Fill Instance Form', false, error.message);
        }

        // Print summary
        console.log('');
        const allPassed = printSummary();

        // Pause for user to input API key
        console.log('\n📋 Manual Steps Required:');
        console.log('   1. Enter your n8n API key in the API Key field');
        console.log('   2. Click "Test" to verify connection');
        console.log('   3. Click "Save" to save the instance');
        console.log('\n   Press Ctrl+C when done to close Chrome and exit.\n');

        // Keep browser open for manual interaction
        browser.on('disconnected', () => {
            console.log('\n👋 Browser closed. Goodbye!');
            process.exit(allPassed ? 0 : 1);
        });

        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down...');
            await browser.close();
            process.exit(allPassed ? 0 : 1);
        });

    } catch (error) {
        console.error('❌ Test execution error:', error.message);
        if (browser) {
            await browser.close();
        }
        process.exit(1);
    }
}

// Run tests
runTests();
