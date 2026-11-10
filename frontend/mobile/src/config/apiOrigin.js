// Explicit configuration always wins, including a custom localhost port.
function selectApiOrigin(explicitOrigin, platform, scriptURL) {
  const configured = typeof explicitOrigin === 'string' ? explicitOrigin.trim() : '';
  if (configured) return configured.replace(/\/+$/, '');
  try {
    const host = new URL(scriptURL).hostname;
    // Metro tunnel hosts do not forward the backend port; only infer a LAN host.
    const isLan = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    if (isLan) return `http://${host}:5001`;
  } catch (_) {}
  return platform === 'android' ? 'http://10.0.2.2:5001' : 'http://localhost:5001';
}
module.exports = { selectApiOrigin };
