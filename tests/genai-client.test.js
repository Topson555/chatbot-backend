import test from 'node:test';
import assert from 'node:assert/strict';

process.env.GEMINI_API_KEY = '';

await test('modules should not initialize GoogleGenAI at import time', async () => {
  const mod = await import('../utils/generateTitle.js');
  assert.ok(mod);
  assert.equal(typeof mod.generateSessionTitle, 'function');
});
