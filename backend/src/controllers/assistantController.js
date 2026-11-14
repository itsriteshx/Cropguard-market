const mongoose = require('mongoose');
const MandiRate = require('../models/MandiRate');
const {
  fetchAgmarknetMandiRates,
  fetchDistrictWeather,
  toTitleCase
} = require('../services/externalApiService');

const CROP_ALIASES = [
  { test: /(onion|pyaz|pyaaz|kanda|eerulli|ullipaya|vengayam|dungli|ganda|प्याज|कांदा|ಈರುಳ್ಳಿ|ఉల్లిపాయ|வெங்காயம்|ડુંગળી|ਪਿਆਜ਼)/i, commodity: 'Onion' },
  { test: /(potato|aloo|alu|batata|alugadde|आलू|बटाटा)/i, commodity: 'Potato' },
  { test: /(tomato|tamatar|thakkali|टमाटर)/i, commodity: 'Tomato' },
  { test: /(wheat|gehu|gehun|kanak|gahu|godhi|godhumai|गेहूं|गहू)/i, commodity: 'Wheat' },
  { test: /(rice|paddy|chawal|dhan|akki|tandul|bhatta|biyyam|arisi|चावल|धान)/i, commodity: 'Rice' },
  { test: /(garlic|lehsun|lahsun|lasun|bellulli|vellulli|poondu|लहसुन)/i, commodity: 'Garlic' },
  { test: /(ginger|adrak|shunti|allam|inchi|अदरक)/i, commodity: 'Ginger' },
  { test: /(turmeric|haldi|arishina|pasupu|manjal|halad|हल्दी)/i, commodity: 'Turmeric' },
  { test: /(pineapple|pine apple|ananas)/i, commodity: 'Pine Apple' },
  { test: /(apple|seb|सेब)/i, commodity: 'Apple' },
  { test: /(mango|aam|mavina|amba|mamidi|आम)/i, commodity: 'Mango' },
  { test: /(banana|kela|balehannu|arati|vazhai|केला)/i, commodity: 'Banana' },
  { test: /(chilli|chili|mirch|mirchi|menasinakayi|मिर्च)/i, commodity: 'Green Chilli' },
  { test: /(cotton|kapas|hatti|कपास)/i, commodity: 'Cotton' },
  { test: /(soyabean|soybean|soya|सोयाबीन)/i, commodity: 'Soyabean' },
  { test: /(maize|corn|makka|jola|मक्का)/i, commodity: 'Maize' },
  { test: /(bengal gram|chana|kadale|चना)/i, commodity: 'Bengal Gram(Gram)(Whole)' },
  { test: /(green gram|moong|mung|hesaru|मूंग)/i, commodity: 'Green Gram(Moong)(Whole)' },
  { test: /(cumin|cummin|jeera|jeerige|जीरा)/i, commodity: 'Cummin Seed(Jeera)' },
  { test: /(mustard|sarson|sasuve|rai|सरसों)/i, commodity: 'Mustard' },
  { test: /(groundnut|peanut|moongfali|shenga|verkadalai|मूंगफली)/i, commodity: 'Groundnut' },
  { test: /(carrot|gajar|गाजर)/i, commodity: 'Carrot' },
  { test: /(cabbage|patta gobhi|kosu)/i, commodity: 'Cabbage' },
  { test: /(cauliflower|phool gobhi|gobhi)/i, commodity: 'Cauliflower' },
  { test: /(brinjal|baingan|eggplant|badanekayi|vankaya)/i, commodity: 'Brinjal' }
];

const DISTRICT_ALIASES = [
  { test: /(dharwad|धारवाड़|ಧಾರವಾಡ|தார்வாட்)/i, name: 'Dharwad' },
  { test: /(hubballi|hubli)/i, name: 'Hubballi' },
  { test: /(pune|पुणे|पुणें|పుణె)/i, name: 'Pune' },
  { test: /(nashik|नासिक)/i, name: 'Nashik' },
  { test: /(nagpur|नागपुर)/i, name: 'Nagpur' },
  { test: /(bengaluru|bangalore|बेंगलुरु)/i, name: 'Bengaluru' },
  { test: /(belagavi|belgaum)/i, name: 'Belagavi' },
  { test: /(indore|इंदौर)/i, name: 'Indore' },
  { test: /(ludhiana|लुधियाना|ਲੁਧਿਆਣਾ)/i, name: 'Ludhiana' },
  { test: /(agra|आगरा)/i, name: 'Agra' },
  { test: /(jaipur|जयपुर)/i, name: 'Jaipur' },
  { test: /(surat|सूरत|સુરત)/i, name: 'Surat' },
  { test: /(rajkot|राजकोट)/i, name: 'Rajkot' },
  { test: /(haveri)/i, name: 'Haveri' },
  { test: /(gadag)/i, name: 'Gadag' },
  { test: /(kolkata|कोलकाता)/i, name: 'Kolkata' },
  { test: /(patna|पटना)/i, name: 'Patna' },
  { test: /(coimbatore|कोयंबटूर|கோவை)/i, name: 'Coimbatore' },
  { test: /(hyderabad|हैदराबाद|హైదరాబాద్)/i, name: 'Hyderabad' },
  { test: /(guntur|गुंटूर)/i, name: 'Guntur' },
  { test: /(mumbai|मुंबई)/i, name: 'Mumbai' },
  { test: /(delhi|दिल्ली)/i, name: 'Delhi' }
];

const SUPPORTED_LANGS = ['en', 'hi', 'kn', 'mr', 'te', 'ta', 'gu', 'pa'];

const getHumidityVal = (w) => {
  const h = w?.humidityPercent ?? w?.humidityPct;
  return h != null ? `${h}%` : 'N/A';
};

const getHighLowEn = (w) =>
  w?.todayMaxC != null && w?.todayMinC != null
    ? ` (Today High ${w.todayMaxC}°C / Low ${w.todayMinC}°C)`
    : '';

const LOCALE_TEMPLATES = {
  en: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `For ${crop}, asking price is ₹${ask} and current offer is ₹${current}. A balanced split midpoint counter-offer is ₹${midpoint}.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `Current offer on ${crop} is ₹${rate}.${bench} Adjusting in 2–5% steps helps close faster.`,
    benchSuffix: ({ market, modal }) => ` Live APMC modal rate at ${market} is ₹${modal} per quintal.`,
    weatherOk: (w) =>
      `Live weather in ${w.district} (${w.state || 'India'}) is ${w.temperatureC}°C${getHighLowEn(w)} with ${w.condition} and ${getHumidityVal(w)} humidity. Advisory: ${w.advisory}`,
    weatherErr: (d) => `Could not fetch live weather for ${d} right now.`,
    nav: (label) => `Opening ${label} for you.`,
    mandiHit: (t) =>
      `${t.commodity} is trading at a modal rate of ₹${Number(t.modalPrice).toLocaleString('en-IN')} per quintal in ${t.marketCenter} (${t.district}, ${t.state}), Min ₹${Number(t.minPrice).toLocaleString('en-IN')} and Max ₹${Number(t.maxPrice).toLocaleString('en-IN')}.`,
    mandiMiss: (c) => `No live Agmarknet rows found for ${c} right now. You can search in APMC Mandi Intelligence.`,
    help:
      'Hello! I am CropGuard AI Voice Assistant. Ask me: "What is Onion price?", "Check Dharwad weather", "Open Sell Produce", or counter-offer advice.'
  },
  hi: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} के लिए मांग ₹${ask} और अभी का ऑफर ₹${current} है। दोनों के बीच ₹${midpoint} का काउंटर-ऑफर सही रहेगा।${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} पर अभी का रेट ₹${rate} है।${bench} 2 से 5 प्रतिशत के बदलाव से डील जल्दी तय हो सकती है।`,
    benchSuffix: ({ market, modal }) => ` ${market} मंडी में लाइव मॉडल भाव ₹${modal} प्रति क्विंटल है।`,
    weatherOk: (w) =>
      `${w.district} में अभी तापमान ${w.temperatureC}°C${w.todayMaxC != null ? ` (अधिकतम ${w.todayMaxC}°C / न्यूनतम ${w.todayMinC}°C)` : ''} और ${w.condition} है, नमी ${getHumidityVal(w)} है। सलाह: ${w.advisory}`,
    weatherErr: (d) => `${d} का लाइव मौसम अभी उपलब्ध नहीं है।`,
    nav: (label) => `${label} पेज खोल रहा हूँ।`,
    mandiHit: (t) =>
      `${t.commodity} का लाइव मंडी मॉडल भाव ${t.marketCenter} (${t.district}, ${t.state}) में ₹${Number(t.modalPrice).toLocaleString('en-IN')} प्रति क्विंटल है — न्यूनतम ₹${Number(t.minPrice).toLocaleString('en-IN')} और अधिकतम ₹${Number(t.maxPrice).toLocaleString('en-IN')}।`,
    mandiMiss: (c) => `${c} का आज का लाइव मंडी डेटा अभी नहीं मिला। APMC Mandi पेज पर सर्च करें।`,
    help:
      'नमस्ते! मैं क्रॉपगार्ड वॉयस असिस्टेंट हूँ। पूछिए: "प्याज का भाव क्या है?", "पुणे का मौसम बताओ", या "सेल प्रोड्यूस खोलो"।'
  },
  kn: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} ಗೆ ಮೂಲ ಬೆಲೆ ₹${ask} ಮತ್ತು ಪ್ರಸ್ತುತ ಆಫರ್ ₹${current} ಇದೆ. ಮಧ್ಯದ ₹${midpoint} ಕೌಂಟರ್ ಆಫರ್ ಸೂಕ್ತವಾಗಿದೆ.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} ಪ್ರಸ್ತುತ ಬೆಲೆ ₹${rate}.${bench} 2 ರಿಂದ 5 ಶೇಕಡಾ ಬದಲಾವಣೆ ಉತ್ತಮ.`,
    benchSuffix: ({ market, modal }) => ` ${market} ಮಂಡಿಯಲ್ಲಿ ಲೈವ್ ಮಾದರಿ ದರ ₹${modal} ಪ್ರತಿ ಕ್ವಿಂಟಲ್ ಇದೆ.`,
    weatherOk: (w) =>
      `${w.district} ಹವಾಮಾನ ${w.temperatureC}°C${w.todayMaxC != null ? ` (ಗರಿಷ್ಠ ${w.todayMaxC}°C / ಕನಿಷ್ಠ ${w.todayMinC}°C)` : ''}, ${w.condition} ಮತ್ತು ತೇವಾಂಶ ${getHumidityVal(w)} ಇದೆ.`,
    weatherErr: (d) => `${d} ಹವಾಮಾನ ಮಾಹಿತಿ ಸದ್ಯ ಲಭ್ಯವಿಲ್ಲ.`,
    nav: (label) => `${label} ಪುಟವನ್ನು ತೆರೆಯಲಾಗುತ್ತಿದೆ.`,
    mandiHit: (t) =>
      `${t.commodity} ${t.marketCenter} (${t.district}) ಮಂಡಿಯಲ್ಲಿ ಮಾದರಿ ದರ ₹${Number(t.modalPrice).toLocaleString('en-IN')} ಪ್ರತಿ ಕ್ವಿಂಟಲ್ ಇದೆ (ಕನಿಷ್ಠ ₹${Number(t.minPrice).toLocaleString('en-IN')}, ಗರಿಷ್ಠ ₹${Number(t.maxPrice).toLocaleString('en-IN')}).`,
    mandiMiss: (c) => `${c} ಗೆ ಇಂದಿನ ಲೈವ್ ಮಂಡಿ ದರ ಸದ್ಯ ಸಿಗಲಿಲ್ಲ.`,
    help:
      'ನಮಸ್ಕಾರ! "ಈರುಳ್ಳಿ ದರ ಎಷ್ಟು?", "ಧಾರವಾಡ ಹವಾಮಾನ ಹೇಗಿದೆ?", ಅಥವಾ "Open Sell Produce" ಎಂದು ಕೇಳಿ.'
  },
  mr: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} साठी मूळ किंमत ₹${ask} आणि सध्याची ऑफर ₹${current} आहे. ₹${midpoint} चा काउंटर-ऑफर योग्य ठरेल.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} ची सध्याची किंमत ₹${rate} आहे.${bench} 2–5% दराने पुढे बोलणी करा.`,
    benchSuffix: ({ market, modal }) => ` ${market} बाजार समितीत सरासरी भाव ₹${modal} प्रति क्विंटल आहे.`,
    weatherOk: (w) =>
      `${w.district} मध्ये तापमान ${w.temperatureC}°C${w.todayMaxC != null ? ` (कमाल ${w.todayMaxC}°C / किमान ${w.todayMinC}°C)` : ''}, हवामान ${w.condition} आणि आर्द्रता ${getHumidityVal(w)} आहे.`,
    weatherErr: (d) => `${d} चे हवामान सध्या उपलब्ध नाही.`,
    nav: (label) => `${label} पान उघडत आहे.`,
    mandiHit: (t) =>
      `${t.commodity} चा आजचा भाव ${t.marketCenter} (${t.district}) येथे ₹${Number(t.modalPrice).toLocaleString('en-IN')} प्रति क्विंटल आहे (किमान ₹${Number(t.minPrice).toLocaleString('en-IN')}, कमाल ₹${Number(t.maxPrice).toLocaleString('en-IN')}).`,
    mandiMiss: (c) => `${c} साठी आजचा बाजार भाव सापडला नाही.`,
    help:
      'नमस्कार! विचारा: "कांदा भाव काय आहे?", "पुणे हवामान सांगा", किंवा "Open Sell Produce".'
  },
  te: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} కోసం అడిగిన ధర ₹${ask}, ప్రస్తుత ఆఫర్ ₹${current}. ₹${midpoint} కౌంటర్ ఆఫర్ పంపడం మంచిది.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} ప్రస్తుత ధర ₹${rate}.${bench} 2–5% మార్పుతో చర్చించండి.`,
    benchSuffix: ({ market, modal }) => ` ${market} మార్కెట్లో మోడల్ ధర క్వింటాల్‌కు ₹${modal} ఉంది.`,
    weatherOk: (w) =>
      `${w.district} వాతావరణం ${w.temperatureC}°C${w.todayMaxC != null ? ` (గరిష్టం ${w.todayMaxC}°C / కనిష్టం ${w.todayMinC}°C)` : ''}, ${w.condition}, తేమ ${getHumidityVal(w)} ఉంది.`,
    weatherErr: (d) => `${d} వాతావరణ సమాచారం ప్రస్తుతం అందుబాటులో లేదు.`,
    nav: (label) => `${label} పేజీ తెరుస్తున్నాను.`,
    mandiHit: (t) =>
      `${t.commodity} ${t.marketCenter} (${t.district}) మార్కెట్లో మోడల్ ధర ₹${Number(t.modalPrice).toLocaleString('en-IN')} / క్వింటాల్ (కనిష్టం ₹${Number(t.minPrice).toLocaleString('en-IN')}, గరిష్టం ₹${Number(t.maxPrice).toLocaleString('en-IN')}).`,
    mandiMiss: (c) => `${c} కు నేటి లైవ్ మార్కెట్ ధర దొరకలేదు.`,
    help:
      'నమస్కారం! "ఉల్లిపాయ ధర ఎంత?", "హైదరాబాద్ వాతావరణం", లేదా "Open Sell Produce" అని అడగండి.'
  },
  ta: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} கேட்ட விலை ₹${ask}, தற்போதைய விலை ₹${current}. நடுநிலை ₹${midpoint} பதில் சலுகை பொருத்தமாக இருக்கும்.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} தற்போதைய விலை ₹${rate}.${bench} 2–5% அளவில் விலை மாற்றவும்.`,
    benchSuffix: ({ market, modal }) => ` ${market} சந்தையில் நேரடி சராசரி விலை குவிண்டாலுக்கு ₹${modal}.`,
    weatherOk: (w) =>
      `${w.district} வானிலை ${w.temperatureC}°C${w.todayMaxC != null ? ` (அதிகம் ${w.todayMaxC}°C / குறைவு ${w.todayMinC}°C)` : ''}, ${w.condition}, ஈரப்பதம் ${getHumidityVal(w)} உள்ளது.`,
    weatherErr: (d) => `${d} வானிலை தகவல் தற்போது கிடைக்கவில்லை.`,
    nav: (label) => `${label} பக்கம் திறக்கப்படுகிறது.`,
    mandiHit: (t) =>
      `${t.commodity} ${t.marketCenter} (${t.district}) சந்தையில் சராசரி விலை ₹${Number(t.modalPrice).toLocaleString('en-IN')} / குவிண்டால் (குறைந்தபட்சம் ₹${Number(t.minPrice).toLocaleString('en-IN')}, அதிகபட்சம் ₹${Number(t.maxPrice).toLocaleString('en-IN')}).`,
    mandiMiss: (c) => `${c} இன்றைய நேரடி சந்தை விலை கிடைக்கவில்லை.`,
    help:
      'வணக்கம்! "வெங்காயம் விலை என்ன?", "கோவை வானிலை", அல்லது "Open Sell Produce" என்று கேளுங்கள்.'
  },
  gu: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} માટે મૂળ ભાવ ₹${ask} અને હાલની ઓફર ₹${current} છે. ₹${midpoint} નો વચગાળાનો ભાવ યોગ્ય રહેશે.${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} નો હાલનો ભાવ ₹${rate} છે.${bench} 2 થી 5% ના ફેરફારથી વાત આગળ વધારો.`,
    benchSuffix: ({ market, modal }) => ` ${market} યાર્ડમાં લાઈવ મોડલ ભાવ ₹${modal} પ્રતિ ક્વિન્ટલ છે.`,
    weatherOk: (w) =>
      `${w.district} માં તાપમાન ${w.temperatureC}°C${w.todayMaxC != null ? ` (વધુ ${w.todayMaxC}°C / ઓછું ${w.todayMinC}°C)` : ''}, હવામાન ${w.condition} અને ભેજ ${getHumidityVal(w)} છે.`,
    weatherErr: (d) => `${d} નું હવામાન હાલ ઉપલબ્ધ નથી.`,
    nav: (label) => `${label} પેજ ખોલી રહ્યો છું.`,
    mandiHit: (t) =>
      `${t.commodity} નો ${t.marketCenter} (${t.district}) યાર્ડમાં મોડલ ભાવ ₹${Number(t.modalPrice).toLocaleString('en-IN')} પ્રતિ ક્વિન્ટલ છે (લઘુત્તમ ₹${Number(t.minPrice).toLocaleString('en-IN')}, મહત્તમ ₹${Number(t.maxPrice).toLocaleString('en-IN')}).`,
    mandiMiss: (c) => `${c} માટે આજનો લાઈવ યાર્ડ ભાવ મળ્યો નથી.`,
    help:
      'નમસ્તે! પૂછો: "ડુંગળીનો ભાવ શું છે?", "સુરત હવામાન જણાવો", અથવા "Open Sell Produce".'
  },
  pa: {
    midpoint: ({ crop, ask, current, midpoint, bench }) =>
      `${crop} ਲਈ ਮੰਗੀ ਕੀਮਤ ₹${ask} ਅਤੇ ਮੌਜੂਦਾ ਪੇਸ਼ਕਸ਼ ₹${current} ਹੈ। ₹${midpoint} ਦੀ ਵਿਚਕਾਰਲੀ ਕੀਮਤ ਠੀਕ ਰਹੇਗੀ।${bench}`,
    stepHint: ({ crop, rate, bench }) =>
      `${crop} ਦੀ ਮੌਜੂਦਾ ਕੀਮਤ ₹${rate} ਹੈ।${bench} 2–5% ਦੇ ਫਰਕ ਨਾਲ ਗੱਲ ਅੱਗੇ ਵਧਾਓ।`,
    benchSuffix: ({ market, modal }) => ` ${market} ਮੰਡੀ ਵਿੱਚ ਲਾਈਵ ਮਾਡਲ ਭਾਅ ₹${modal} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਹੈ।`,
    weatherOk: (w) =>
      `${w.district} ਦਾ ਮੌਸਮ ${w.temperatureC}°C${w.todayMaxC != null ? ` (ਵੱਧ ${w.todayMaxC}°C / ਘੱਟ ${w.todayMinC}°C)` : ''}, ${w.condition} ਅਤੇ ਨਮੀ ${getHumidityVal(w)} ਹੈ।`,
    weatherErr: (d) => `${d} ਦਾ ਲਾਈਵ ਮੌਸਮ ਇਸ ਸਮੇਂ ਉਪਲਬਧ ਨਹੀਂ ਹੈ।`,
    nav: (label) => `${label} ਪੰਨਾ ਖੋਲ੍ਹ ਰਿਹਾ ਹਾਂ।`,
    mandiHit: (t) =>
      `${t.commodity} ਦਾ ${t.marketCenter} (${t.district}) ਮੰਡੀ ਵਿੱਚ ਮਾਡਲ ਭਾਅ ₹${Number(t.modalPrice).toLocaleString('en-IN')} ਪ੍ਰਤੀ ਕੁਇੰਟਲ ਹੈ (ਘੱਟੋ-ਘੱਟ ₹${Number(t.minPrice).toLocaleString('en-IN')}, ਵੱਧ ਤੋਂ ਵੱਧ ₹${Number(t.maxPrice).toLocaleString('en-IN')})।`,
    mandiMiss: (c) => `${c} ਲਈ ਅੱਜ ਦਾ ਲਾਈਵ ਮੰਡੀ ਭਾਅ ਨਹੀਂ ਮਿਲਿਆ।`,
    help:
      'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਪੁੱਛੋ: "ਪਿਆਜ਼ ਦਾ ਭਾਅ ਕੀ ਹੈ?", "ਲੁਧਿਆਣਾ ਮੌਸਮ ਦੱਸੋ", ਜਾਂ "Open Sell Produce"।'
  }
};

function extractCropName(text = '') {
  const matched = CROP_ALIASES.find((a) => a.test.test(text));
  if (matched) return matched.commodity;

  const rateMatch = text.match(/([a-zA-Z]{3,})\s+(?:ka\s+|ki\s+|ke\s+)?(?:rate|price|bhav|mandi)/i);
  if (rateMatch && !['today', 'live', 'mandi', 'crop', 'current', 'kya', 'aaj'].includes(rateMatch[1].toLowerCase())) {
    return toTitleCase(rateMatch[1]);
  }
  return null;
}

function extractDistrict(text = '', fallback = 'Dharwad') {
  const known = DISTRICT_ALIASES.find((d) => d.test.test(text));
  if (known) return known.name;

  const stop = new Set(['check', 'tell', 'show', 'live', 'today', 'aaj', 'kaisa', 'batao', 'the', 'india']);
  const m1 = text.match(/(?:weather|mausam|climate)\s+(?:in|of|at|for)?\s*([a-zA-Z]{3,})/i);
  if (m1 && !stop.has(m1[1].toLowerCase())) return toTitleCase(m1[1]);

  const m2 = text.match(/([a-zA-Z]{3,})\s+(?:ka\s+|ki\s+)?(?:weather|mausam|climate)/i);
  if (m2 && !stop.has(m2[1].toLowerCase())) return toTitleCase(m2[1]);

  return fallback;
}

function detectNavigationTarget(text = '') {
  if (/(sell\s*produce|list\s*crop|fasal\s*bech|new\s*listing|sell\s*page)/i.test(text)) {
    return { tab: 'sell', label: 'Sell Produce' };
  }
  if (/(negotiation|bargain|chat\s*room|mol\s*bhav|offer\s*page)/i.test(text)) {
    return { tab: 'negotiations', label: 'Price Negotiations' };
  }
  if (/(order|escrow|receipt|dispatch|delivery)/i.test(text)) {
    return { tab: 'orders', label: 'Bulk Orders & Escrow' };
  }
  if (/(audit|ledger|fair\s*trade|hisab|khata)/i.test(text)) {
    return { tab: 'compliance', label: 'Audit & Fair-Trade' };
  }
  if (/(marketplace|buy\s*crop|farm\s*lot|kharid|browse\s*crop)/i.test(text)) {
    return { tab: 'marketplace', label: 'Wholesale Marketplace' };
  }
  if (/(open\s*mandi|go\s*to\s*mandi|mandi\s*analytics|mandi\s*intelligence|mandi\s*page)/i.test(text)) {
    return { tab: 'mandi', label: 'APMC Mandi Intelligence' };
  }
  return null;
}

async function lookupLiveCommodityRates(commodity) {
  let rates = [];
  if (mongoose.connection.readyState === 1) {
    try {
      const cleanToken = commodity.split('(')[0].trim();
      rates = await MandiRate.find({
        commodity: { $regex: cleanToken, $options: 'i' }
      })
        .sort('-priceDate')
        .limit(5)
        .lean();
    } catch {
      rates = [];
    }
  }

  if (rates.length === 0) {
    try {
      const live = await fetchAgmarknetMandiRates({ commodity, maxRecords: 5 });
      if (Array.isArray(live.records)) {
        rates = live.records.slice(0, 5);
      }
    } catch {
      // Gracefully return empty if throttled
    }
  }
  return rates;
}

const WEATHER_REGEX =
  /(weather|mausam|barish|rain|temp|climate|hawa|मौसम|बारिश|हवामान|ಹವಾಮಾನ|వాతావరణం|வானிலை|હવામાન|ਮੌਸਮ)/i;
const RATE_REGEX =
  /(rate|price|bhav|mandi|भाव|दाम|दर|ಬೆಲೆ|ದರ|ధర|விலை|ભાવ|ਭਾਅ)/i;

/**
 * @desc    Natural-language multilingual voice/text assistant across 8 Indian languages
 * @route   POST /api/assistant/query
 * @access  Private
 */
const processAssistantQuery = async (req, res, next) => {
  try {
    const queryText = String(req.body?.query || '').trim();
    const rawLang = String(req.body?.lang || 'en').toLowerCase().slice(0, 2);
    const lang = SUPPORTED_LANGS.includes(rawLang) ? rawLang : 'en';
    const tpl = LOCALE_TEMPLATES[lang] || LOCALE_TEMPLATES.en;
    const context = req.body?.context || {};

    if (!queryText) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a question or voice command'
      });
    }

    // 1. Bargaining / Counter-offer advice inside active negotiation
    if (/(counter|negotiate|bargain|kitna\s*bol|fair\s*price|suggest|madad|price\s*tip)/i.test(queryText) && (context.currentOffer || context.askingPrice)) {
      const ask = Number(context.askingPrice) || 0;
      const current = Number(context.currentOffer) || 0;
      const crop = context.cropName || 'Crop';
      const midpoint = ask > 0 && current > 0 ? Math.round((ask + current) / 2) : null;

      let bench = '';
      let matchedRates = [];
      if (context.cropName) {
        matchedRates = await lookupLiveCommodityRates(extractCropName(context.cropName) || context.cropName);
        if (matchedRates[0]) {
          bench = tpl.benchSuffix({
            market: matchedRates[0].marketCenter,
            modal: matchedRates[0].modalPrice
          });
        }
      }

      const reply = midpoint !== null
        ? tpl.midpoint({ crop, ask, current, midpoint, bench })
        : tpl.stepHint({ crop, rate: current || ask, bench });

      return res.status(200).json({
        success: true,
        lang,
        intent: 'NEGOTIATION_ADVICE',
        reply,
        suggestedPrice: midpoint,
        rates: matchedRates.slice(0, 3)
      });
    }

    // 2. Weather intent
    if (WEATHER_REGEX.test(queryText)) {
      const district = extractDistrict(queryText, req.user?.location?.district || 'Dharwad');
      try {
        const w = await fetchDistrictWeather({ district });
        return res.status(200).json({
          success: true,
          lang,
          intent: 'WEATHER',
          reply: tpl.weatherOk(w),
          weather: w,
          action: { navigateTo: 'mandi', label: 'View Weather & Mandis' }
        });
      } catch {
        return res.status(200).json({
          success: true,
          lang,
          intent: 'WEATHER',
          reply: tpl.weatherErr(district)
        });
      }
    }

    // 3. Explicit screen navigation commands
    const navTarget = detectNavigationTarget(queryText);
    if (navTarget && !RATE_REGEX.test(queryText)) {
      return res.status(200).json({
        success: true,
        lang,
        intent: 'NAVIGATE',
        reply: tpl.nav(navTarget.label),
        action: { navigateTo: navTarget.tab, label: `Open ${navTarget.label}` }
      });
    }

    // 4. Live Mandi crop price query
    const requestedCrop = extractCropName(queryText);
    if (requestedCrop || RATE_REGEX.test(queryText)) {
      const targetCrop = requestedCrop || 'Onion';
      const rates = await lookupLiveCommodityRates(targetCrop);
      if (rates.length > 0) {
        return res.status(200).json({
          success: true,
          lang,
          intent: 'MANDI_PRICE',
          reply: tpl.mandiHit(rates[0]),
          rates: rates.slice(0, 3),
          action: { navigateTo: 'mandi', label: `Compare ${rates[0].commodity} Mandis` }
        });
      }

      return res.status(200).json({
        success: true,
        lang,
        intent: 'MANDI_PRICE',
        reply: tpl.mandiMiss(targetCrop),
        action: { navigateTo: 'mandi', label: 'Open APMC Mandi Explorer' }
      });
    }

    // 5. Helpful greeting / capability guide
    return res.status(200).json({
      success: true,
      lang,
      intent: 'HELP',
      reply: tpl.help
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  processAssistantQuery,
  extractCropName,
  extractDistrict,
  detectNavigationTarget,
  SUPPORTED_LANGS
};
