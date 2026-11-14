const MAX_BYTES = 5 * 1024 * 1024;

async function preparePhoto(asset, platform, imageManipulator) {
  if (!asset?.uri) throw new Error('The selected photo is unavailable.');
  if (platform === 'web') {
    const file = asset.file;
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !/\.(jpe?g|png|webp)$/i.test(file.name || '')) {
      throw new Error('Choose a JPG, PNG, or WebP photo.');
    }
    if (file.size > MAX_BYTES) throw new Error('Choose a photo smaller than 5 MB.');
    return asset;
  }
  // Re-encode native photos such as HEIC as JPEG, which the API accepts.
  const context = imageManipulator.ImageManipulator.manipulate(asset.uri);
  if (asset.width > 1600 || asset.height > 1600) {
    context.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ format: imageManipulator.SaveFormat.JPEG, compress: 0.8 });
  if (!result?.uri) throw new Error('Could not prepare this photo.');
  return { ...asset, uri: result.uri, fileName: 'produce.jpg', mimeType: 'image/jpeg' };
}
module.exports = { preparePhoto };
