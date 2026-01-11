// Paste this into the browser console to inspect the workflow section

const section = document.getElementById('n8n-workflow-ext-section');
if (!section) {
  console.error('❌ Section not found in DOM');
} else {
  console.log('✓ Section found:', section);

  const rect = section.getBoundingClientRect();
  console.log('Section rect:', rect);
  console.log('Section styles:', {
    display: getComputedStyle(section).display,
    visibility: getComputedStyle(section).visibility,
    opacity: getComputedStyle(section).opacity,
    width: getComputedStyle(section).width,
    height: getComputedStyle(section).height,
    position: getComputedStyle(section).position
  });

  const list = document.getElementById('n8n-wf-list');
  if (list) {
    console.log('✓ List found:', list);
    console.log('List children count:', list.children.length);
    console.log('List rect:', list.getBoundingClientRect());
    console.log('List styles:', {
      display: getComputedStyle(list).display,
      visibility: getComputedStyle(list).visibility,
      opacity: getComputedStyle(list).opacity,
      maxHeight: getComputedStyle(list).maxHeight,
      overflow: getComputedStyle(list).overflow
    });

    // Show first 3 workflow items
    const items = list.querySelectorAll('.n8n-wf-item');
    console.log(`List has ${items.length} workflow items`);
    items.forEach((item, i) => {
      if (i < 3) {
        const itemRect = item.getBoundingClientRect();
        console.log(`Item ${i + 1}:`, {
          text: item.textContent.trim(),
          rect: itemRect,
          display: getComputedStyle(item).display,
          visibility: getComputedStyle(item).visibility
        });
      }
    });
  } else {
    console.error('❌ List element not found');
  }

  // Check if section is in viewport
  if (rect.top >= 0 && rect.bottom <= window.innerHeight) {
    console.log('✓ Section is in viewport');
  } else {
    console.warn('⚠️  Section is outside viewport');
    console.log('Try scrolling or running: document.getElementById("n8n-workflow-ext-section").scrollIntoView()');
  }

  // Show parent chain
  console.log('Parent chain:');
  let parent = section.parentElement;
  let depth = 0;
  while (parent && depth < 5) {
    console.log(`  ${depth}: ${parent.tagName}.${parent.className}`);
    parent = parent.parentElement;
    depth++;
  }
}
