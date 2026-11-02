/**
 * CropGuard Market — Multilingual Localization Catalog (i18n)
 * Compliant with Ministry of Agriculture & UASD Dharwad multi-state guidelines.
 * Supports 8 major Indian agricultural languages (7 regional + English).
 */

const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    region: 'Pan-India & Wholesale Inter-State Trade',
    flag: '🌐',
    isRTL: false
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    region: 'North & Central India APMC Mandis',
    flag: '🇮🇳',
    isRTL: false
  },
  kn: {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'Kannada',
    region: 'Karnataka (UASD Dharwad, Hubballi, Belagavi)',
    flag: '🌾',
    isRTL: false
  },
  mr: {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    script: 'Devanagari',
    region: 'Maharashtra (Pune, Nashik, Solapur APMC)',
    flag: '🚜',
    isRTL: false
  },
  te: {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'Telugu',
    region: 'Andhra Pradesh & Telangana (Guntur, Warangal)',
    flag: '🌶️',
    isRTL: false
  },
  ta: {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'Tamil',
    region: 'Tamil Nadu (Koyambedu, Madurai, Erode)',
    flag: '🥥',
    isRTL: false
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    script: 'Gujarati',
    region: 'Gujarat (Unjha, Gondal, Rajkot APMC)',
    flag: '🥜',
    isRTL: false
  },
  pa: {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    script: 'Gurmukhi',
    region: 'Punjab & Haryana (Khanna, Karnal Grain Mandis)',
    flag: '🌾',
    isRTL: false
  }
};

const TRANSLATIONS = {
  en: {
    common: {
      success: 'Operation completed successfully',
      failed: 'Operation failed',
      unauthorized: 'Not authorized to access this resource',
      serverError: 'Internal server error occurred',
      validationError: 'Validation error in request payload'
    },
    auth: {
      registered: 'User account registered successfully',
      loginSuccess: 'Login successful. Welcome back!',
      invalidCreds: 'Invalid mobile number or password',
      langUpdated: 'Language preference updated to English'
    },
    listings: {
      created: 'Produce listing published on CropGuard Market',
      notFound: 'Produce listing not found',
      invalidPrice: 'Price per unit must be a positive number',
      belowMandiWarning: 'Warning: Offered price is below APMC modal rate corridor'
    },
    negotiations: {
      started: 'Price negotiation channel initiated',
      counterSent: 'Counter-offer dispatched in real-time',
      dealLocked: 'Deal locked and accepted into digital contract',
      dealRejected: 'Negotiation session was closed without deal'
    },
    orders: {
      placed: 'Bulk purchase order placed successfully',
      escrowLocked: 'Buyer payment securely locked in Escrow',
      dispatched: 'Produce marked as dispatched by farmer',
      delivered: 'Produce delivery confirmed by buyer',
      settled: 'Escrow settlement released directly to farmer account'
    },
    receipt: {
      title: 'Certified Direct Market Access Invoice',
      declaration: 'Certified 100% direct farmer transaction under UASD Dharwad & Ministry of Agriculture guidelines. Zero intermediary commission deducted.'
    }
  },
  hi: {
    common: {
      success: 'कार्य सफलतापूर्वक पूरा हुआ',
      failed: 'कार्य पूरा करने में विफलता',
      unauthorized: 'इस संसाधन तक पहुंचने की अनुमति नहीं है',
      serverError: 'सर्वर में आंतरिक त्रुटि हुई',
      validationError: 'अनुरोध डेटा में अमान्य जानकारी'
    },
    auth: {
      registered: 'उपयोगकर्ता खाता सफलतापूर्वक बनाया गया',
      loginSuccess: 'लॉग-इन सफल। आपका स्वागत है!',
      invalidCreds: 'अमान्य मोबाइल नंबर या पासवर्ड',
      langUpdated: 'भाषा प्राथमिकता बदलकर हिन्दी कर दी गई है'
    },
    listings: {
      created: 'फ़सल सफलतापूर्वक बाज़ार में सूचीबद्ध हो गई है',
      notFound: 'फ़सल लिस्टिंग नहीं मिली',
      invalidPrice: 'भाव उचित धनात्मक संख्या होना चाहिए',
      belowMandiWarning: 'चेतावनी: प्रस्तावित भाव मंडी के औसत न्यूनतम भाव से कम है'
    },
    negotiations: {
      started: 'दाम मोलभाव का सत्र शुरू हुआ',
      counterSent: 'नया भाव (काउंटर ऑफर) तुरंत भेजा गया',
      dealLocked: 'सौदा पक्का हो गया और अनुबंध दर्ज हुआ',
      dealRejected: 'मोलभाव सत्र बिना सौदे के बंद हुआ'
    },
    orders: {
      placed: 'बिक्री ऑर्डर सफलतापूर्वक दर्ज हुआ',
      escrowLocked: 'खरीददार का भुगतान एस्क्रो में सुरक्षित लॉक हुआ',
      dispatched: 'किसान द्वारा फ़सल रवाना कर दी गई है',
      delivered: 'खरीददार द्वारा फ़सल प्राप्ति की पुष्टि की गई',
      settled: 'एस्क्रो से भुगतान सीधे किसान के खाते में भेज दिया गया'
    },
    receipt: {
      title: 'प्रमाणित प्रत्यक्ष किसान बाज़ार रसीद',
      declaration: 'कृषि मंत्रालय एवं धारवाड़ विश्वविद्यालय दिशानिर्देशों के तहत 100% सीधा किसान लेनदेन। शून्य बिचौलिया दलाली।'
    }
  },
  kn: {
    common: {
      success: 'ಕಾರ್ಯ ಯಶಸ್ವಿಯಾಗಿ ಪೂರ್ಣಗೊಂಡಿದೆ',
      failed: 'ಕಾರ್ಯ ನಿರ್ವಹಣೆ ವಿಫಲವಾಗಿದೆ',
      unauthorized: 'ಈ ಸಂಪನ್ಮೂಲವನ್ನು ಪ್ರವೇಶಿಸಲು ಅಧಿಕಾರವಿಲ್ಲ',
      serverError: 'ಸರ್ವರ್ ಆಂತರಿಕ ದೋಷ ಸಂಭವಿಸಿದೆ',
      validationError: 'ವಿನಂತಿ ಡೇಟಾದಲ್ಲಿ ದೋಷವಿದೆ'
    },
    auth: {
      registered: 'ಬಳಕೆದಾರರ ಖಾತೆಯನ್ನು ಯಶಸ್ವಿಯಾಗಿ ರಚಿಸಲಾಗಿದೆ',
      loginSuccess: 'ಲಾಗಿನ್ ಯಶಸ್ವಿಯಾಗಿದೆ. ಸುಸ್ವಾಗತ!',
      invalidCreds: 'ಅಮಾನ್ಯ ಮೊಬೈಲ್ ಸಂಖ್ಯೆ ಅಥವಾ ಪಾಸ್‌ವರ್ಡ್',
      langUpdated: 'ಭಾಷೆಯ ಆದ್ಯತೆಯನ್ನು ಕನ್ನಡಕ್ಕೆ ಬದಲಾಯಿಸಲಾಗಿದೆ'
    },
    listings: {
      created: 'ಬೆಳೆ ಉತ್ಪನ್ನವನ್ನು ಯಶಸ್ವಿಯಾಗಿ ಪಟ್ಟಿ ಮಾಡಲಾಗಿದೆ',
      notFound: 'ಬೆಳೆ ಪಟ್ಟಿ ಕಂಡುಬಂದಿಲ್ಲ',
      invalidPrice: 'ದರವು ಮಾನ್ಯವಾದ ಧನಾತ್ಮಕ ಸಂಖ್ಯೆಯಾಗಿರಬೇಕು',
      belowMandiWarning: 'ಎಚ್ಚರಿಕೆ: ಪ್ರಸ್ತಾಪಿತ ಬೆಲೆಯು ಎಪಿಎಂಸಿ ಮಾರುಕಟ್ಟೆ ಕನಿಷ್ಠ ದರಕ್ಕಿಂತ ಕಡಿಮೆಯಿದೆ'
    },
    negotiations: {
      started: 'ಬೆಲೆ ಚೌಕಾಶಿ ಆರಂಭವಾಗಿದೆ',
      counterSent: 'ಪ್ರತಿ ಆಫರ್ ತಕ್ಷಣವೇ ಕಳುಹಿಸಲಾಗಿದೆ',
      dealLocked: 'ವ್ಯಾಪಾರ ದರ ಖಚಿತವಾಗಿದೆ ಮತ್ತು ಒಪ್ಪಂದ ಸಿದ್ಧವಾಗಿದೆ',
      dealRejected: 'ಚೌಕಾಶಿ ಅಧಿವೇಶನವನ್ನು ಮುಕ್ತಾಯಗೊಳಿಸಲಾಗಿದೆ'
    },
    orders: {
      placed: 'ಖರೀದಿ ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ಸಲ್ಲಿಕೆಯಾಗಿದೆ',
      escrowLocked: 'ಖರೀದಿದಾರರ ಹಣವನ್ನು ಎಸ್ಕ್ರೋದಲ್ಲಿ ಸುರಕ್ಷಿತವಾಗಿ ಇರಿಸಲಾಗಿದೆ',
      dispatched: 'ರೈತರಿಂದ ಉತ್ಪನ್ನವನ್ನು ಸಾಗಣೆಗೆ ಕಳುಹಿಸಲಾಗಿದೆ',
      delivered: 'ಖರೀದಿದಾರರಿಂದ ಉತ್ಪನ್ನ ತಲುಪಿದೆ ಎಂದು ದೃಢೀಕರಿಸಲಾಗಿದೆ',
      settled: 'ಎಸ್ಕ್ರೋದಿಂದ ನೇರವಾಗಿ ರೈತರ ಬ್ಯಾಂಕ್ ಖಾತೆಗೆ ಹಣ ಜಮೆಯಾಗಿದೆ'
    },
    receipt: {
      title: 'ಪ್ರಮಾಣೀಕೃತ ನೇರ ಮಾರುಕಟ್ಟೆ ರಶೀದಿ',
      declaration: 'ಕೃಷಿ ಸಚಿವಾಲಯ ಮತ್ತು UASD ಧಾರವಾಡ ಮಾರ್ಗಸೂಚಿಗಳ ಅಡಿಯಲ್ಲಿ 100% ನೇರ ಮಾರಾಟ. ಮಧ್ಯವರ್ತಿಗಳ ಶುಲ್ಕ ರಹಿತ.'
    }
  },
  mr: {
    common: {
      success: 'काम यशस्वीरित्या पूर्ण झाले',
      failed: 'प्रक्रिया अयशस्वी झाली',
      unauthorized: 'प्रवेश नाकारला',
      serverError: 'सर्व्हर त्रुटी आढळली',
      validationError: 'अवैध माहिती पाठवली आहे'
    },
    auth: {
      registered: 'खाते यशस्वीरित्या तयार झाले',
      loginSuccess: 'लॉगिन यशस्वी झाले. स्वागत आहे!',
      invalidCreds: 'अवैध मोबाईल क्रमांक किंवा पासवर्ड',
      langUpdated: 'भाषा प्राधान्य मराठी म्हणून निवडले गेले'
    },
    listings: {
      created: 'शेतमाल बाजारात यशस्वीरित्या जोडला गेला',
      notFound: 'शेतमाल सूची सापडली नाही',
      invalidPrice: 'दर वैध असणे आवश्यक आहे',
      belowMandiWarning: 'सूचना: प्रस्तावित दर बाजार समितीच्या किमान दरापेक्षा कमी आहे'
    },
    negotiations: {
      started: 'दर वाटाघाटी सुरू झाली',
      counterSent: 'नवीन दर त्वरित पाठवला गेला',
      dealLocked: 'सौदा पक्का झाला आणि करार पूर्ण झाला',
      dealRejected: 'वाटाघाटी बंद करण्यात आली'
    },
    orders: {
      placed: 'खरेदी आदेश नोंदवला गेला',
      escrowLocked: 'पैसे एस्क्रो खात्यात सुरक्षित जमा झाले',
      dispatched: 'शेतकऱ्याने माल पाठवला आहे',
      delivered: 'माल मिळाल्याची खरेदीदाराने पुष्टी केली',
      settled: 'पैसे थेट शेतकऱ्याच्या खात्यात जमा झाले'
    },
    receipt: {
      title: 'प्रमाणित थेट शेतकरी बाजार पावती',
      declaration: 'कृषी मंत्रालय आणि धारवाड विद्यापीठ मार्गदर्शक तत्त्वांनुसार १००% थेट शेतकरी व्यवहार. शून्य दलाली.'
    }
  },
  te: {
    common: {
      success: 'పని విజయవంతంగా పూర్తయింది',
      failed: 'ఆపరేషన్ విఫలమైంది',
      unauthorized: 'అనుమతి లేదు',
      serverError: 'సర్వర్ లోపం సంభవించింది',
      validationError: 'చెల్లని సమాచారం'
    },
    auth: {
      registered: 'వినియోగదారు ఖాతా విజయవంతంగా నమోదు చేయబడింది',
      loginSuccess: 'లాగిన్ విజయవంతమైంది. స్వాగతం!',
      invalidCreds: 'చెల్లని మొబైల్ నంబర్ లేదా పాస్‌వర్డ్',
      langUpdated: 'భాష ప్రాధాన్యత తెలుగుగా మార్చబడింది'
    },
    listings: {
      created: 'పంటను మార్కెట్‌లో విజయవంతంగా నమోదు చేసారు',
      notFound: 'పంట జాబితా కనుగొనబడలేదు',
      invalidPrice: 'ధర సరైన సంఖ్యగా ఉండాలి',
      belowMandiWarning: 'హెచ్చరిక: ఆఫర్ ధర మార్కెట్ కనీస ధర కంటే తక్కువగా ఉంది'
    },
    negotiations: {
      started: 'ధర బేరసారాలు ప్రారంభమయ్యాయి',
      counterSent: 'కౌంటర్ ఆఫర్ విజయవంతంగా పంపబడింది',
      dealLocked: 'వ్యాపారం ఖరారైంది మరియు ఒప్పందం కుదిరింది',
      dealRejected: 'చర్చలు ముగిసాయి'
    },
    orders: {
      placed: 'ఆర్డర్ విజయవంతంగా నమోదు చేయబడింది',
      escrowLocked: 'ఖరీదుదారుని చెల్లింపు ఎస్క్రోలో భద్రపరచబడింది',
      dispatched: 'రైతు సరుకును రవాణా చేసారు',
      delivered: 'సరుకు అందినట్లు కొనుగోలుదారు ధృవీకరించారు',
      settled: 'డబ్బులు నేరుగా రైతు ఖాతాకు జమ చేయబడ్డాయి'
    },
    receipt: {
      title: 'ధృవీకరించబడిన ప్రత్యక్ష రైతు మార్కెట్ రసీదు',
      declaration: 'వ్యవసాయ మంత్రిత్వ శాఖ నిబంధనల ప్రకారం 100% ప్రత్యక్ష రైతు లావాదేవీ. మధ్యవర్తుల కమీషన్ రహితం.'
    }
  },
  ta: {
    common: {
      success: 'செயல்பாடு வெற்றிகரமாக முடிந்தது',
      failed: 'செயல்பாடு தோல்வியடைந்தது',
      unauthorized: 'அனுமதி மறுக்கப்பட்டது',
      serverError: 'சேவையக பிழை ஏற்பட்டுள்ளது',
      validationError: 'தவறான உள்ளீடு'
    },
    auth: {
      registered: 'பயனர் கணக்கு வெற்றிகரமாக உருவாக்கப்பட்டது',
      loginSuccess: 'உள்நுழைவு வெற்றி. நல்வரவு!',
      invalidCreds: 'தவறான தொலைபேசி எண் அல்லது கடவுச்சொல்',
      langUpdated: 'மொழி விருப்பம் தமிழாக மாற்றப்பட்டது'
    },
    listings: {
      created: 'விளைபொருள் சந்தையில் பட்டியலிடப்பட்டது',
      notFound: 'பொருள் பட்டியல் கிடைக்கவில்லை',
      invalidPrice: 'சரியான விலையை உள்ளிடவும்',
      belowMandiWarning: 'எச்சரிக்கை: பரிந்துரைக்கப்பட்ட விலை மண்டி விலையை விட குறைவு'
    },
    negotiations: {
      started: 'விலை பேரம் தொடங்கியது',
      counterSent: 'மறு விலை உடனடியாக அனுப்பப்பட்டது',
      dealLocked: 'வியாபாரம் உறுதியானது மற்றும் ஒப்பந்தம் முடிந்தது',
      dealRejected: 'பேரம் முடிவுக்கு வந்தது'
    },
    orders: {
      placed: 'ஆர்டர் வெற்றிகரமாக பதிவு செய்யப்பட்டது',
      escrowLocked: 'தொகை எஸ்க்ரோவில் பாதுகாப்பாக வைக்கப்பட்டுள்ளது',
      dispatched: 'விவசாயி பொருளை அனுப்பி வைத்துள்ளார்',
      delivered: 'பொருள் வந்து சேர்ந்தது உறுதி செய்யப்பட்டது',
      settled: 'தொகை நேரடியாக விவசாயியின் வங்கி கணக்கில் செலுத்தப்பட்டது'
    },
    receipt: {
      title: 'சான்றளிக்கப்பட்ட நேரடி உழவர் சந்தை ரசீது',
      declaration: 'வேளாண்மை அமைச்சக வழிகாட்டுதலின்படி 100% நேரடி விவசாய பரிவர்த்தனை. இடைத்தரகர் தரகு இல்லை.'
    }
  },
  gu: {
    common: {
      success: 'કામગીરી સફળતાપૂર્વક પૂર્ણ થઈ',
      failed: 'પ્રક્રિયા નિષ્ફળ રહી',
      unauthorized: 'પ્રવેશ અનધિકૃત છે',
      serverError: 'સર્વર આંતરિક ભૂલ આવી',
      validationError: 'અમાન્ય વિગતો'
    },
    auth: {
      registered: 'ખાતું સફળતાપૂર્વક બનાવવામાં આવ્યું',
      loginSuccess: 'લૉગિન સફળ થયું. સ્વાગત છે!',
      invalidCreds: 'અમાન્ય મોબાઇલ નંબર અથવા પાસવર્ડ',
      langUpdated: 'ભાષા પ્રાથમિકતા ગુજરાતી તરીકે અપડેટ કરવામાં આવી'
    },
    listings: {
      created: 'ઉત્પાદન બજારમાં સફળતાપૂર્વક ઉમેરાયું',
      notFound: 'ઉત્પાદન યાદી મળી નથી',
      invalidPrice: 'ભાવ યોગ્ય સંખ્યા હોવો જોઈએ',
      belowMandiWarning: 'ચેતવણી: આ ભાવ માર્કેટ યાર્ડના લઘુત્તમ ભાવ કરતાં ઓછો છે'
    },
    negotiations: {
      started: 'ભાવની વાટાઘાટો શરૂ થઈ',
      counterSent: 'સામેનો ભાવ તરત જ મોકલવામાં આવ્યો',
      dealLocked: 'સોદો પાકો થયો અને કરાર થયો',
      dealRejected: 'વાટાઘાટો બંધ કરવામાં આવી'
    },
    orders: {
      placed: 'ઓર્ડર સફળતાપૂર્વક નોંધાયો',
      escrowLocked: 'રકમ એસ્ક્રો ખાતામાં સુરક્ષિત છે',
      dispatched: 'ખેડૂતે માલ રવાના કર્યો છે',
      delivered: 'માલ મળ્યાની પુષ્ટિ ખરીદદારે કરી',
      settled: 'નાણાં સીધા ખેડૂતના ખાતામાં જમા થયા'
    },
    receipt: {
      title: 'પ્રમાણિત સીધી ખેડૂત બજાર પાવતી',
      declaration: 'કૃષિ મંત્રાલય માર્ગદર્શિકા મુજબ ૧૦૦% સીધો ખેડૂત વ્યવહાર. કોઈ દલાલી કપાત વિના.'
    }
  },
  pa: {
    common: {
      success: 'ਕੰਮ ਸਫਲਤਾਪੂਰਵਕ ਮੁਕੰਮਲ ਹੋਇਆ',
      failed: 'ਕਾਰਵਾਈ ਅਸਫਲ ਰਹੀ',
      unauthorized: 'ਅਣਅਧਿਕਾਰਤ ਪਹੁੰਚ',
      serverError: 'ਸਰਵਰ ਵਿੱਚ ਅੰਦਰੂਨੀ ਗਲਤੀ ਆਈ',
      validationError: 'ਗਲਤ ਵੇਰਵੇ ਦਰਜ ਕੀਤੇ ਗਏ'
    },
    auth: {
      registered: 'ਯੂਜ਼ਰ ਖਾਤਾ ਸਫਲਤਾਪੂਰਵਕ ਬਣ ਗਿਆ',
      loginSuccess: 'ਲਾਗਇਨ ਸਫਲ ਰਿਹਾ। ਜੀ ਆਇਆਂ ਨੂੰ!',
      invalidCreds: 'ਗਲਤ ਮੋਬਾਈਲ ਨੰਬਰ ਜਾਂ ਪਾਸਵਰਡ',
      langUpdated: 'ਭਾਸ਼ਾ ਤਰਜੀਹ ਪੰਜਾਬੀ ਵਜੋਂ ਅੱਪਡੇਟ ਕੀਤੀ ਗਈ'
    },
    listings: {
      created: 'ਫ਼ਸਲ ਮੰਡੀ ਵਿੱਚ ਸਫਲਤਾਪੂਰਵਕ ਸ਼ਾਮਲ ਕੀਤੀ ਗਈ',
      notFound: 'ਫ਼ਸਲ ਦੀ ਸੂਚੀ ਨਹੀਂ ਮਿਲੀ',
      invalidPrice: 'ਭਾਅ ਸਹੀ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ',
      belowMandiWarning: 'ਚੇਤਾਵਨੀ: ਪੇਸ਼ਕਸ਼ ਕੀਤੀ ਕੀਮਤ ਮੰਡੀ ਦੇ ਘੱਟੋ-ਘੱਟ ਭਾਅ ਤੋਂ ਘੱਟ ਹੈ'
    },
    negotiations: {
      started: 'ਭਾਅ ਤੈਅ ਕਰਨ ਦੀ ਗੱਲਬਾਤ ਸ਼ੁਰੂ ਹੋਈ',
      counterSent: 'ਨਵਾਂ ਭਾਅ ਤੁਰੰਤ ਭੇਜਿਆ ਗਿਆ',
      dealLocked: 'ਸੌਦਾ ਪੱਕਾ ਹੋ ਗਿਆ ਅਤੇ ਇਕਰਾਰਨਾਮਾ ਬਣ ਗਿਆ',
      dealRejected: 'ਗੱਲਬਾਤ ਬਿਨਾਂ ਸੌਦੇ ਤੋਂ ਬੰਦ ਹੋ ਗਈ'
    },
    orders: {
      placed: 'ਆਰਡਰ ਸਫਲਤਾਪੂਰਵਕ ਦਰਜ ਹੋ ਗਿਆ',
      escrowLocked: 'ਖਰੀਦਦਾਰ ਦਾ ਭੁਗਤਾਨ ਐਸਕਰੋ ਵਿੱਚ ਸੁਰੱਖਿਅਤ ਹੈ',
      dispatched: 'ਕਿਸਾਨ ਵੱਲੋਂ ਫ਼ਸਲ ਰਵਾਨਾ ਕਰ ਦਿੱਤੀ ਗਈ ਹੈ',
      delivered: 'ਖਰੀਦਦਾਰ ਵੱਲੋਂ ਮਾਲ ਪ੍ਰਾਪਤ ਹੋਣ ਦੀ ਪੁਸ਼ਟੀ ਕੀਤੀ ਗਈ',
      settled: 'ਰਕਮ ਸਿੱਧੀ ਕਿਸਾਨ ਦੇ ਬੈਂਕ ਖਾਤੇ ਵਿੱਚ ਭੇਜ ਦਿੱਤੀ ਗਈ'
    },
    receipt: {
      title: 'ਪ੍ਰਮਾਣਿਤ ਸਿੱਧੀ ਕਿਸਾਨ ਮੰਡੀ ਰਸੀਦ',
      declaration: 'ਖੇਤੀਬਾੜੀ ਮੰਤਰਾਲੇ ਦੀਆਂ ਹਦਾਇਤਾਂ ਅਨੁਸਾਰ 100% ਸਿੱਧਾ ਕਿਸਾਨ ਲੈਣ-ਦੇਣ। ਕੋਈ ਆੜ੍ਹਤ/ਦਲਾਲੀ ਫੀਸ ਨਹੀਂ।'
    }
  }
};

/**
 * Resolve a dot-notated key in translation catalog with fallback
 */
const translate = (lang, key, params = {}) => {
  const selectedLang = SUPPORTED_LANGUAGES[lang] ? lang : 'en';
  const parts = key.split('.');

  let node = TRANSLATIONS[selectedLang];
  for (const part of parts) {
    if (node && node[part] !== undefined) {
      node = node[part];
    } else {
      // Fallback to English
      node = null;
      break;
    }
  }

  // If missing in selected language, check English
  if (!node && selectedLang !== 'en') {
    let fallbackNode = TRANSLATIONS.en;
    for (const part of parts) {
      if (fallbackNode && fallbackNode[part] !== undefined) {
        fallbackNode = fallbackNode[part];
      } else {
        fallbackNode = null;
        break;
      }
    }
    node = fallbackNode;
  }

  let text = typeof node === 'string' ? node : key;

  // Replace interpolation params: {paramName}
  Object.keys(params).forEach((paramKey) => {
    text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), params[paramKey]);
  });

  return text;
};

module.exports = {
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  translate
};
