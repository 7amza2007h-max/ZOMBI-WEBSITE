'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dashboard = fs.readFileSync(path.join(root, 'site', 'dashboard.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');

function quotedKeys(block) {
  return new Set([...block.matchAll(/^\s*['"]?([\w-]+)['"]?\s*:/gm)].map(m => m[1]));
}

test('every dashboard navigation item has a page definition', () => {
  const defsStart = dashboard.indexOf('const pageDefs = {');
  const defsEnd = dashboard.indexOf('\n  };', defsStart);
  assert.ok(defsStart >= 0 && defsEnd > defsStart, 'pageDefs block exists');
  const defs = quotedKeys(dashboard.slice(defsStart, defsEnd));

  const groupsStart = dashboard.indexOf('const groups = [');
  const groupsEnd = dashboard.indexOf('\n  ];', groupsStart);
  assert.ok(groupsStart >= 0 && groupsEnd > groupsStart, 'groups block exists');
  const groups = dashboard.slice(groupsStart, groupsEnd);
  const navIds = new Set();
  for (const match of groups.matchAll(/\[['"][^\]]*?\[['"]([\w-]+)['"]/g)) navIds.add(match[1]);
  // Capture all IDs inside each group's second array, excluding the Arabic group label.
  for (const match of groups.matchAll(/\[['"][^\]]*?,\s*\[([^\]]*)\]\s*\]/g)) {
    for (const id of match[1].matchAll(/['"]([\w-]+)['"]/g)) navIds.add(id[1]);
  }
  assert.ok(navIds.size > 0, 'navigation contains sections');
  assert.deepEqual([...navIds].filter(id => !defs.has(id)).sort(), []);
});

test('standalone dashboard panels have navigable sections', () => {
  const defsStart = dashboard.indexOf('const pageDefs = {');
  const defsEnd = dashboard.indexOf('\n  };', defsStart);
  const defs = quotedKeys(dashboard.slice(defsStart, defsEnd));
  const groupsStart = dashboard.indexOf('const groups = [');
  const groupsEnd = dashboard.indexOf('\n  ];', groupsStart);
  const groups = dashboard.slice(groupsStart, groupsEnd);
  const navIds = new Set();
  for (const match of groups.matchAll(/\[['"][^\]]*?,\s*\[([^\]]*)\]\s*\]/g)) {
    for (const id of match[1].matchAll(/['"]([\w-]+)['"]/g)) navIds.add(id[1]);
  }
  const standalone = new Set([...server.matchAll(/data-z-page=[\\"']([^\\"']+)/g)].map(m => m[1]));
  for (const id of standalone) {
    assert.ok(defs.has(id), `page definition exists for ${id}`);
    assert.ok(navIds.has(id), `navigation entry exists for ${id}`);
  }
});
