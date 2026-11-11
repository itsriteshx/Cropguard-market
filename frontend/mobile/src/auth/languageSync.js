/**
 * Language synchronization helper for AuthContext
 * Synchronizes selected language preference with the backend /auth/language endpoint.
 */
async function syncLanguagePreference(request, token, newLang) {
  if (!newLang || typeof newLang !== 'string') {
    return { success: false, synced: false, error: 'Valid language code is required' };
  }

  if (!token) {
    // Unauthenticated user: preference stored locally only
    return { success: true, synced: false, message: 'Saved locally; sign in to sync with your account' };
  }

  try {
    const res = await request(
      '/auth/language',
      {
        method: 'PATCH',
        body: JSON.stringify({ languagePreference: newLang })
      },
      token
    );

    // Explicitly verify response object and success property
    if (!res || res.success === false) {
      const errorMessage =
        (res && (res.message || res.error)) || 'Failed to sync language preference with backend';
      return {
        success: false,
        synced: false,
        error: errorMessage,
        status: res?.status || res?.httpStatus || 400
      };
    }

    return {
      success: true,
      synced: true,
      language: newLang,
      data: res
    };
  } catch (err) {
    return {
      success: false,
      synced: false,
      error: err.message || 'Network exception syncing language preference'
    };
  }
}

module.exports = { syncLanguagePreference };
