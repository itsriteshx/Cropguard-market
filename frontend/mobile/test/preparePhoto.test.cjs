const { test } = require('node:test');
const assert = require('node:assert/strict');
const { preparePhoto } = require('../src/utils/preparePhoto');

test('native HEIC selection is resized and saved as JPEG for upload', async () => {
  let resize, saveOptions;
  const manipulator = { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({ resize: (options) => { resize = options; }, renderAsync: async () => ({ saveAsync: async (options) => { saveOptions = options; return { uri: 'file:///converted.jpg' }; } }) }) } };
  const result = await preparePhoto({ uri: 'file:///photo.heic', mimeType: 'image/heic', width: 3000, height: 2000 }, 'ios', manipulator);
  assert.deepEqual(resize, { width: 1600 });
  assert.equal(saveOptions.format, 'jpeg');
  assert.equal(result.mimeType, 'image/jpeg');
  assert.equal(result.fileName, 'produce.jpg');
  assert.equal(result.uri, 'file:///converted.jpg');
});

test('browser rejects unsupported or oversized photos without fabricating an upload', async () => {
  await assert.rejects(preparePhoto({ uri: 'blob:x', file: { name: 'photo.heic', type: 'image/heic', size: 1 } }, 'web'), /JPG, PNG, or WebP/);
  await assert.rejects(preparePhoto({ uri: 'blob:x', file: { name: 'photo.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 } }, 'web'), /smaller than 5 MB/);
});
