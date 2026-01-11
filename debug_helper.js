// Debug Helper - Paste this into the browser console on an n8n workflow page
// This will help identify the correct sidebar element to inject into

console.log('=== n8n DOM Structure Debug ===\n');

// Find all potential sidebar elements
const potentialSidebars = [
  ...document.querySelectorAll('nav'),
  ...document.querySelectorAll('aside'),
  ...document.querySelectorAll('[class*="sidebar"]'),
  ...document.querySelectorAll('[class*="menu"]'),
  ...document.querySelectorAll('[class*="navigation"]')
];

console.log(`Found ${potentialSidebars.length} potential sidebar elements\n`);

potentialSidebars.forEach((el, index) => {
  const rect = el.getBoundingClientRect();
  const isLeftSide = rect.left < window.innerWidth / 2;
  const isVisible = rect.width > 0 && rect.height > 0;
  const hasNavItems = el.querySelector('a, button, [role="menuitem"]');

  console.log(`${index + 1}. ${el.tagName}`);
  console.log(`   Classes: ${el.className}`);
  console.log(`   Position: x=${Math.round(rect.left)}, y=${Math.round(rect.top)}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)}`);
  console.log(`   Left side: ${isLeftSide}, Visible: ${isVisible}, Has nav items: ${!!hasNavItems}`);
  console.log(`   Parent: ${el.parentElement?.tagName}.${el.parentElement?.className}`);

  if (isLeftSide && isVisible && hasNavItems) {
    console.log(`   ✓ THIS LOOKS LIKE THE LEFT NAVIGATION SIDEBAR`);
  }
  console.log('');
});

// Check where the extension injected
const injected = document.getElementById('n8n-workflow-ext-section');
if (injected) {
  const parent = injected.parentElement;
  const rect = injected.getBoundingClientRect();

  console.log('=== Extension Injection Location ===');
  console.log(`Injected into: ${parent.tagName}.${parent.className}`);
  console.log(`Position: x=${Math.round(rect.left)}, y=${Math.round(rect.top)}, w=${Math.round(rect.width)}, h=${Math.round(rect.height)}`);
  console.log(`Visible: ${rect.width > 0 && rect.height > 0}`);
  console.log(`HTML preview:`, injected.innerHTML.substring(0, 200) + '...');
} else {
  console.log('Extension section not found in DOM');
}

console.log('\n=== End Debug ===');
