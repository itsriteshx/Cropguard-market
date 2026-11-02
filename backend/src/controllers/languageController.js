const { SUPPORTED_LANGUAGES, TRANSLATIONS } = require('../i18n/locales');

/**
 * 25+ Major Indian Agricultural Commodities Lexicon
 * Multi-lingual translations across all 8 supported agricultural languages
 */
const CROP_LEXICON = [
  {
    id: 'onion',
    category: 'Vegetables',
    scientificName: 'Allium cepa',
    translations: {
      en: 'Onion',
      hi: 'प्याज',
      kn: 'ಈರುಳ್ಳಿ',
      mr: 'कांदा',
      te: 'ఉల్లిపాయ',
      ta: 'வெங்காயம்',
      gu: 'ડુંગળી',
      pa: 'ਪਿਆਜ਼'
    }
  },
  {
    id: 'tomato',
    category: 'Vegetables',
    scientificName: 'Solanum lycopersicum',
    translations: {
      en: 'Tomato',
      hi: 'टमाटर',
      kn: 'ಟೊಮೇಟೊ',
      mr: 'टोमॅटो',
      te: 'టమోటా',
      ta: 'தக்காளி',
      gu: 'ટમેટા',
      pa: 'ਟਮਾਟਰ'
    }
  },
  {
    id: 'potato',
    category: 'Vegetables',
    scientificName: 'Solanum tuberosum',
    translations: {
      en: 'Potato',
      hi: 'आलू',
      kn: 'ಆಲೂಗಡ್ಡೆ',
      mr: 'बटाटा',
      te: 'బంగాళాదుంప',
      ta: 'உருளைக்கிழங்கு',
      gu: 'બટાકા',
      pa: 'ਆਲੂ'
    }
  },
  {
    id: 'wheat',
    category: 'Cereals',
    scientificName: 'Triticum aestivum',
    translations: {
      en: 'Wheat (Sharbati)',
      hi: 'गेहूं (शरबती)',
      kn: 'ಗೋಧಿ',
      mr: 'गहू',
      te: 'గోధుమలు',
      ta: 'கோதுமை',
      gu: 'ઘઉં',
      pa: 'ਕਣਕ'
    }
  },
  {
    id: 'rice_paddy',
    category: 'Cereals',
    scientificName: 'Oryza sativa',
    translations: {
      en: 'Paddy / Rice',
      hi: 'धान / चावल',
      kn: 'ಭತ್ತ / ಅಕ್ಕಿ',
      mr: 'भात / तांदूळ',
      te: 'వరి / బియ్యం',
      ta: 'நெல் / அரிசி',
      gu: 'ડાંગર / ચોખા',
      pa: 'ਝੋਨਾ / ਚੌਲ'
    }
  },
  {
    id: 'soybean',
    category: 'Oilseeds',
    scientificName: 'Glycine max',
    translations: {
      en: 'Soybean',
      hi: 'सोयाबीन',
      kn: 'ಸೋಯಾಬೀನ್',
      mr: 'सोयाबीन',
      te: 'సోయాబీన్',
      ta: 'சோயாபீன்',
      gu: 'સોયાબીન',
      pa: 'ਸੋਇਆਬੀਨ'
    }
  },
  {
    id: 'chilli_byadagi',
    category: 'Spices',
    scientificName: 'Capsicum annuum',
    translations: {
      en: 'Byadagi Red Chilli (GI)',
      hi: 'ब्याडगी लाल मिर्च',
      kn: 'ಬ್ಯಾಡಗಿ ಕೆಂಪು ಮೆಣಸಿನಕಾಯಿ',
      mr: 'ब्याडगी लाल मिरची',
      te: 'బ్యాడగి ఎర్ర మిరపకాయ',
      ta: 'பியாடகி மிளகாய்',
      gu: 'બ્યાડગી લાલ મરચું',
      pa: 'ਲਾਲ ਮਿਰਚ'
    }
  },
  {
    id: 'cotton',
    category: 'Fibre',
    scientificName: 'Gossypium hirsutum',
    translations: {
      en: 'Cotton (Kapas)',
      hi: 'कपास / कपास',
      kn: 'ಹತ್ತಿ',
      mr: 'कापूस',
      te: 'పత్తి',
      ta: 'பருத்தி',
      gu: 'કપાસ',
      pa: 'ਕਪਾਹ'
    }
  },
  {
    id: 'maize',
    category: 'Cereals',
    scientificName: 'Zea mays',
    translations: {
      en: 'Maize / Corn',
      hi: 'मक्का',
      kn: 'ಮೆಕ್ಕೆಜೋಳ',
      mr: 'मका',
      te: 'మొక్కజొన్న',
      ta: 'மக்காச்சோளம்',
      gu: 'મકાઈ',
      pa: 'ਮੱਕੀ'
    }
  },
  {
    id: 'turmeric',
    category: 'Spices',
    scientificName: 'Curcuma longa',
    translations: {
      en: 'Turmeric',
      hi: 'हल्दी',
      kn: 'ಅರಿಶಿನ',
      mr: 'हळद',
      te: 'పసుపు',
      ta: 'மஞ்சள்',
      gu: 'હળદર',
      pa: 'ਹਲਦੀ'
    }
  },
  {
    id: 'ginger',
    category: 'Spices',
    scientificName: 'Zingiber officinale',
    translations: {
      en: 'Ginger',
      hi: 'अदरक',
      kn: 'ಶುಂಠಿ',
      mr: 'आले',
      te: 'అల్లం',
      ta: 'இஞ்சி',
      gu: 'આદું',
      pa: 'ਅਦਰਕ'
    }
  },
  {
    id: 'garlic',
    category: 'Spices',
    scientificName: 'Allium sativum',
    translations: {
      en: 'Garlic',
      hi: 'लहसुन',
      kn: 'ಬೆಳ್ಳುಳ್ಳಿ',
      mr: 'लसूण',
      te: 'వెల్లుల్లి',
      ta: 'பூண்டு',
      gu: 'લસણ',
      pa: 'ਲਸਣ'
    }
  },
  {
    id: 'chana_gram',
    category: 'Pulses',
    scientificName: 'Cicer arietinum',
    translations: {
      en: 'Bengal Gram (Chana)',
      hi: 'चना',
      kn: 'ಕಡಲೆ',
      mr: 'हरभरा',
      te: 'శనగలు',
      ta: 'கொண்டைக்கடலை',
      gu: 'ચણા',
      pa: 'ਛੋਲੇ'
    }
  },
  {
    id: 'toor_dal',
    category: 'Pulses',
    scientificName: 'Cajanus cajan',
    translations: {
      en: 'Red Gram (Toor / Arhar)',
      hi: 'अरहर / तूर दाल',
      kn: 'ತೊಗರಿ ಬೇಳೆ',
      mr: 'तूर डाळ',
      te: 'కందిపప్పు',
      ta: 'துவரம் பருப்பு',
      gu: 'તુવેર',
      pa: 'ਤੂਰ ਦਾਲ'
    }
  },
  {
    id: 'groundnut',
    category: 'Oilseeds',
    scientificName: 'Arachis hypogaea',
    translations: {
      en: 'Groundnut / Peanut',
      hi: 'मूंगफली',
      kn: 'ಕಡಲೆಕಾಯಿ',
      mr: 'भुईमूग',
      te: 'వేరుశనగ',
      ta: 'வேர்க்கடலை',
      gu: 'મગફળી',
      pa: 'ਮੂੰਗਫਲੀ'
    }
  },
  {
    id: 'sugarcane',
    category: 'Cash Crops',
    scientificName: 'Saccharum officinarum',
    translations: {
      en: 'Sugarcane',
      hi: 'गन्ना',
      kn: 'ಕಬ್ಬು',
      mr: 'ऊस',
      te: 'చెరకు',
      ta: 'கரும்பு',
      gu: 'શેરડી',
      pa: 'ਗੰਨਾ'
    }
  },
  {
    id: 'mustard',
    category: 'Oilseeds',
    scientificName: 'Brassica nigra',
    translations: {
      en: 'Mustard Seeds',
      hi: 'सरसों',
      kn: 'ಸಾಸಿವೆ',
      mr: 'मोहरी',
      te: 'ఆవాలు',
      ta: 'கடுகு',
      gu: 'રાય',
      pa: 'ਸਰ੍ਹੋਂ'
    }
  },
  {
    id: 'green_gram',
    category: 'Pulses',
    scientificName: 'Vigna radiata',
    translations: {
      en: 'Green Gram (Moong)',
      hi: 'मूंग दाल',
      kn: 'ಹೆಸರು ಕಾಳು',
      mr: 'मूग',
      te: 'పెసలు',
      ta: 'பாசிப்பயறு',
      gu: 'મગ',
      pa: 'ਮੂੰਗੀ'
    }
  },
  {
    id: 'pomegranate',
    category: 'Fruits',
    scientificName: 'Punica granatum',
    translations: {
      en: 'Pomegranate (Bhagwa)',
      hi: 'अनार (भगवा)',
      kn: 'ದಾಳಿಂಬೆ',
      mr: 'डाळिंब',
      te: 'దానిమ్మ',
      ta: 'மாதுளை',
      gu: 'દાડમ',
      pa: 'ਅਨਾਰ'
    }
  },
  {
    id: 'banana',
    category: 'Fruits',
    scientificName: 'Musa acuminata',
    translations: {
      en: 'Banana (G9 / Yelakki)',
      hi: 'केला (जी9 / इलायची)',
      kn: 'ಬಾಳೆಹಣ್ಣು (ಏಲಕ್ಕಿ)',
      mr: 'केळी',
      te: 'అరటిపండు',
      ta: 'வாழைப்பழம்',
      gu: 'કેળા',
      pa: 'ਕੇਲਾ'
    }
  }
];

/**
 * @desc    Get all supported agricultural languages metadata
 * @route   GET /api/languages
 * @access  Public
 */
const getAllLanguages = async (req, res, next) => {
  try {
    const languages = Object.values(SUPPORTED_LANGUAGES);

    return res.status(200).json({
      success: true,
      count: languages.length,
      currentLanguage: req.language,
      currentLocale: req.locale,
      languages
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get multi-lingual crop commodity translation lexicon
 * @route   GET /api/languages/crops
 * @access  Public
 */
const getCropLexicon = async (req, res, next) => {
  try {
    const { category, search, lang } = req.query;
    const targetLang = lang && SUPPORTED_LANGUAGES[lang.toLowerCase()] ? lang.toLowerCase() : req.language;

    let filtered = CROP_LEXICON;

    if (category) {
      filtered = filtered.filter(
        (c) => c.category.toLowerCase() === category.toLowerCase()
      );
    }

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((c) => {
        const matchesEn = c.translations.en.toLowerCase().includes(q);
        const matchesTarget = c.translations[targetLang]?.toLowerCase().includes(q);
        const matchesSci = c.scientificName.toLowerCase().includes(q);
        return matchesEn || matchesTarget || matchesSci;
      });
    }

    // Map each crop with current localized title
    const mapped = filtered.map((item) => ({
      ...item,
      localizedName: item.translations[targetLang] || item.translations.en,
      activeLanguage: targetLang
    }));

    return res.status(200).json({
      success: true,
      count: mapped.length,
      targetLanguage: targetLang,
      crops: mapped
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get UI translations bundle for a specific language
 * @route   GET /api/languages/translations/:lang
 * @access  Public
 */
const getLanguageBundle = async (req, res, next) => {
  try {
    const langCode = req.params.lang?.toLowerCase();

    if (!SUPPORTED_LANGUAGES[langCode]) {
      return res.status(400).json({
        success: false,
        message: `Unsupported language code '${langCode}'. Supported: ${Object.keys(SUPPORTED_LANGUAGES).join(', ')}`
      });
    }

    return res.status(200).json({
      success: true,
      language: SUPPORTED_LANGUAGES[langCode],
      translations: TRANSLATIONS[langCode] || TRANSLATIONS.en
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllLanguages,
  getCropLexicon,
  getLanguageBundle,
  CROP_LEXICON
};
