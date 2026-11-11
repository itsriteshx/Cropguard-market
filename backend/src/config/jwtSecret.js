/**
 * Resolves the JWT secret with production enforcement.
 * Refuses to use development fallback or weak/insecure keys in production mode.
 */
const INSECURE_DEFAULTS = new Set([
  'cropguard_dev_secret_key_adypu_2026',
  'your_production_jwt_secret_min_32_characters_long',
  'your_secure_jwt_secret_min_32_chars',
  'cropguard_super_secret_jwt_key_2026'
]);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret.trim().length === 0) {
      throw new Error('FATAL: JWT_SECRET environment variable must be set in production mode.');
    }

    const trimmed = secret.trim();

    if (trimmed.length < 32) {
      throw new Error(
        `FATAL: JWT_SECRET must be at least 32 characters in production mode (current length: ${trimmed.length}).`
      );
    }

    if (INSECURE_DEFAULTS.has(trimmed)) {
      throw new Error(
        'FATAL: Insecure default or placeholder JWT_SECRET cannot be used in production mode.'
      );
    }

    return trimmed;
  }

  return (secret && secret.trim()) || 'cropguard_dev_secret_key_adypu_2026';
}

module.exports = { getJwtSecret };
