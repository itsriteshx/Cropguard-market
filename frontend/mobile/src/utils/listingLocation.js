/**
 * Builds and validates a produce listing location from farmer input and profile defaults
 * without injecting hardcoded geographic coordinates or district names.
 */
function buildListingLocation({ village, taluk, district, state, pincode } = {}, userLocation = null) {
  const cleanDistrict = String(district ?? userLocation?.district ?? '').trim();
  const cleanState = String(state ?? userLocation?.state ?? '').trim();
  const cleanVillage = String(village ?? userLocation?.village ?? '').trim();
  const cleanTaluk = String(taluk ?? userLocation?.taluk ?? '').trim();
  const cleanPincode = String(pincode ?? userLocation?.pincode ?? '').replace(/\D/g, '').slice(0, 6);

  if (!cleanDistrict || !cleanState) {
    return {
      valid: false,
      message: 'Enter your farm district and state (or a 6-digit pincode) before publishing.'
    };
  }

  if (cleanPincode && !/^\d{6}$/.test(cleanPincode)) {
    return {
      valid: false,
      message: 'Enter a valid 6-digit pincode or leave it blank.'
    };
  }

  const userDistrict = String(userLocation?.district || '').trim().toLowerCase();
  const sameDistrictAsProfile = userDistrict && userDistrict === cleanDistrict.toLowerCase();
  const rawCoords = sameDistrictAsProfile ? userLocation?.coordinates : null;
  const hasValidCoords =
    Array.isArray(rawCoords) &&
    rawCoords.length >= 2 &&
    Number.isFinite(Number(rawCoords[0])) &&
    Number.isFinite(Number(rawCoords[1])) &&
    (Number(rawCoords[0]) !== 0 || Number(rawCoords[1]) !== 0);

  return {
    valid: true,
    location: {
      type: 'Point',
      coordinates: hasValidCoords ? [Number(rawCoords[0]), Number(rawCoords[1])] : [0, 0],
      village: cleanVillage,
      taluk: cleanTaluk,
      district: cleanDistrict,
      state: cleanState,
      pincode: cleanPincode
    }
  };
}

module.exports = { buildListingLocation };

