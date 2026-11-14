import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { apiRequest } from '../config/api';
import { SUPPORTED_LANGUAGES, useAuth } from '../context/AuthContext';

let Speech = null;
try {
  Speech = require('expo-speech');
} catch (_) {
  Speech = null;
}

const VOICE_LOCALES = {
  en: 'en-IN',
  hi: 'hi-IN',
  kn: 'kn-IN',
  mr: 'mr-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  gu: 'gu-IN',
  pa: 'pa-IN'
};

const QUICK_PROMPTS = {
  en: ['What is Onion price?', 'Check Dharwad weather', 'Open Sell Produce', 'Open Mandi'],
  hi: ['प्याज का भाव क्या है?', 'पुणे का मौसम बताओ', 'Open Sell Produce', 'Open Mandi'],
  kn: ['ಈರುಳ್ಳಿ ದರ ಎಷ್ಟು?', 'ಧಾರವಾಡ ಹವಾಮಾನ ಹೇಗಿದೆ?', 'Open Sell Produce', 'Open Mandi'],
  mr: ['कांदा भाव काय आहे?', 'पुणे हवामान सांगा', 'Open Sell Produce', 'Open Mandi'],
  te: ['ఉల్లిపాయ ధర ఎంత?', 'హైదరాబాద్ వాతావరణం', 'Open Sell Produce', 'Open Mandi'],
  ta: ['வெங்காயம் விலை என்ன?', 'கோவை வானிலை', 'Open Sell Produce', 'Open Mandi'],
  gu: ['ડુંગળીનો ભાવ શું છે?', 'સુરત હવામાન જણાવો', 'Open Sell Produce', 'Open Mandi'],
  pa: ['ਪਿਆਜ਼ ਦਾ ਭਾਅ ਕੀ ਹੈ?', 'ਲੁਧਿਆਣਾ ਮੌਸਮ ਦੱਸੋ', 'Open Sell Produce', 'Open Mandi']
};

const INITIAL_GREETING = {
  en: 'Hi! Ask me in any of 8 languages: "What is Onion price?", "Check Dharwad weather", or "Open Sell Produce".',
  hi: 'नमस्ते! किसी भी भाषा में पूछें: "प्याज का भाव क्या है?", "पुणे का मौसम बताओ", या "Open Sell Produce"।',
  kn: 'ನಮಸ್ಕಾರ! ಕೇಳಿ: "ಈರುಳ್ಳಿ ದರ ಎಷ್ಟು?", "ಧಾರವಾಡ ಹವಾಮಾನ", ಅಥವಾ "Open Sell Produce".',
  mr: 'नमस्कार! विचारा: "कांदा भाव काय आहे?", "पुणे हवामान", किंवा "Open Sell Produce".',
  te: 'నమస్కారం! అడగండి: "ఉల్లిపాయ ధర ఎంత?", "పుణె వాతావరణం", లేదా "Open Sell Produce".',
  ta: 'வணக்கம்! கேளுங்கள்: "வெங்காயம் விலை என்ன?", "தார்வாட் வானிலை", அல்லது "Open Sell Produce".',
  gu: 'નમસ્તે! પૂછો: "ડુંગળીનો ભાવ શું છે?", "સુરત હવામાન", અથવા "Open Sell Produce".',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਪੁੱਛੋ: "ਪਿਆਜ਼ ਦਾ ਭਾਅ ਕੀ ਹੈ?", "ਲੁਧਿਆਣਾ ਮੌਸਮ", ਜਾਂ "Open Sell Produce".'
};

const TAB_MAP = {
  marketplace: 'MARKET',
  mandi: 'MANDI',
  sell: 'SELL',
  negotiations: 'NEGOTIATIONS',
  orders: 'ORDERS',
  compliance: 'LEDGER'
};

export default function AssistantModal({ visible, onClose, activeTab, onNavigateTab }) {
  const { token, language, role, setLanguage } = useAuth();
  const [assistantLang, setAssistantLang] = useState(language || 'en');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [inputText, setInputText] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: INITIAL_GREETING[language] || INITIAL_GREETING.en }
  ]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (language) setAssistantLang(language);
  }, [language]);

  useEffect(() => {
    if (visible) {
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } else if (Speech?.stop) {
      try { Speech.stop(); } catch (_) {}
    }
  }, [messages, visible]);

  useEffect(() => {
    return () => {
      if (Speech?.stop) {
        try { Speech.stop(); } catch (_) {}
      }
    };
  }, []);

  const speakText = (text, langCode = assistantLang) => {
    if (!Speech?.speak || !text) return;
    try {
      Speech.stop?.();
      Speech.speak(String(text), {
        language: VOICE_LOCALES[langCode] || 'en-IN',
        rate: 1.0
      });
    } catch (_) {}
  };

  const handleClearChat = () => {
    try { Speech?.stop?.(); } catch (_) {}
    setMessages([
      { role: 'assistant', text: INITIAL_GREETING[assistantLang] || INITIAL_GREETING.en }
    ]);
  };

  const handleLanguagePick = (code) => {
    setAssistantLang(code);
    setLanguage?.(code);
    const greet = INITIAL_GREETING[code] || INITIAL_GREETING.en;
    setMessages((prev) => [...prev, { role: 'assistant', text: greet }]);
    if (autoSpeak) speakText(greet, code);
  };

  const navigateIfAllowed = (webTab) => {
    const mobileTab = TAB_MAP[webTab];
    if (!mobileTab || !onNavigateTab) return;
    if (mobileTab === 'SELL' && role !== 'FARMER') return;
    onNavigateTab(mobileTab);
    onClose();
  };

  const runQuery = async (rawQuery) => {
    const clean = String(rawQuery || '').trim();
    if (!clean || busy) return;

    setMessages((prev) => [...prev, { role: 'user', text: clean }]);
    setInputText('');
    setBusy(true);

    const res = await apiRequest(
      '/assistant/query',
      {
        method: 'POST',
        timeoutMs: 25000,
        body: JSON.stringify({
          query: clean,
          lang: assistantLang,
          context: { activeTab }
        })
      },
      token
    );

    setBusy(false);

    if (res?.success) {
      const replyText = res.reply || 'Done.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          rates: Array.isArray(res.rates) ? res.rates : [],
          weather: res.weather || null,
          action: res.action || null
        }
      ]);

      if (autoSpeak) speakText(replyText, assistantLang);

      if (res.intent === 'NAVIGATE' && res.action?.navigateTo) {
        navigateIfAllowed(res.action.navigateTo);
      }
    } else {
      const errText = res?.message || 'Unable to reach AI assistant right now. Check connection & try again.';
      setMessages((prev) => [...prev, { role: 'assistant', text: errText }]);
    }
  };

  const quickPrompts = QUICK_PROMPTS[assistantLang] || QUICK_PROMPTS.en;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.sheet}>
          {/* Header (Matches Web VoiceAssistantWidget) */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.botBadge}>
                <Text style={styles.botBadgeIcon}>🤖</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>AI Voice Assistant ✨</Text>
                <Text style={styles.subtitle}>8 Languages • Mandis • Weather</Text>
              </View>
            </View>

            <View style={styles.headerControls}>
              <TouchableOpacity
                onPress={handleClearChat}
                style={styles.iconBtn}
                accessibilityLabel="Clear assistant chat"
              >
                <Text style={styles.iconBtnText}>🗑</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) {
                    try { Speech?.stop?.(); } catch (_) {}
                  }
                }}
                style={styles.iconBtn}
                accessibilityLabel={autoSpeak ? 'Mute voice reply' : 'Enable voice reply'}
              >
                <Text style={styles.iconBtnText}>{autoSpeak ? '🔊' : '🔇'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onClose}
                style={styles.iconBtn}
                accessibilityLabel="Close voice assistant"
              >
                <Text style={styles.iconBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Visible 8-Language Switcher Bar */}
          <View style={styles.langBar}>
            <Text style={styles.langBarLabel}>SELECT CHAT &amp; VOICE LANGUAGE:</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.langRow}
            >
              {SUPPORTED_LANGUAGES.map((l) => {
                const active = assistantLang === l.code;
                return (
                  <TouchableOpacity
                    key={l.code}
                    onPress={() => handleLanguagePick(l.code)}
                    style={[styles.langChip, active && styles.langChipActive]}
                  >
                    <Text style={[styles.langChipText, active && styles.langChipTextActive]}>
                      {l.flag} {l.native}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Conversation Stream */}
          <ScrollView
            ref={scrollRef}
            style={styles.chatArea}
            contentContainerStyle={{ gap: 12, paddingVertical: 12 }}
          >
            {messages.map((m, idx) => (
              <View
                key={idx}
                style={[styles.msgWrap, m.role === 'user' ? styles.msgEnd : styles.msgStart]}
              >
                <View
                  style={[styles.bubble, m.role === 'user' ? styles.userBubble : styles.botBubble]}
                >
                  <Text style={styles.bubbleText}>{m.text}</Text>
                  {m.role === 'assistant' && !!Speech?.speak && (
                    <TouchableOpacity
                      onPress={() => speakText(m.text, assistantLang)}
                      style={styles.readAloudBtn}
                    >
                      <Text style={styles.readAloudText}>🔊 Read aloud</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {m.weather && (
                  <View style={styles.weatherCard}>
                    <Text style={styles.weatherTitle}>
                      🌤️ {m.weather.district} ({m.weather.state || 'India'})
                    </Text>
                    <Text style={styles.weatherStats}>
                      {m.weather.temperatureC ?? '--'}°C • {m.weather.condition} • {m.weather.humidityPercent ?? m.weather.humidityPct ?? '--'}% RH
                    </Text>
                    {m.weather.todayMaxC != null && m.weather.todayMinC != null && (
                      <Text style={styles.weatherSub}>
                        Today High {m.weather.todayMaxC}°C / Low {m.weather.todayMinC}°C
                      </Text>
                    )}
                  </View>
                )}

                {Array.isArray(m.rates) && m.rates.length > 0 && (
                  <View style={styles.ratesList}>
                    {m.rates.map((r, rIdx) => (
                      <View key={rIdx} style={styles.rateTag}>
                        <Text style={styles.rateLeft} numberOfLines={1}>
                          {r.commodity} • {r.marketCenter}
                        </Text>
                        <Text style={styles.ratePrice}>
                          ₹{Number(r.modalPrice || 0).toLocaleString('en-IN')}/qtl
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {m.action?.navigateTo && TAB_MAP[m.action.navigateTo] && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => navigateIfAllowed(m.action.navigateTo)}
                  >
                    <Text style={styles.actionBtnText}>{m.action.label || 'Open Screen'} →</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {busy && (
              <View style={[styles.bubble, styles.botBubble, { flexDirection: 'row', gap: 8, alignItems: 'center' }]}>
                <ActivityIndicator size="small" color="#10B981" />
                <Text style={styles.loadingText}>Checking live CropGuard data...</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick Prompt Chips */}
          <View style={styles.promptBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.horizontalScroll}
              contentContainerStyle={styles.promptRow}
            >
              {quickPrompts.map((p) => (
                <TouchableOpacity key={p} style={styles.promptChip} onPress={() => runQuery(p)}>
                  <Text style={styles.promptText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Input Bar */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={`Ask (${VOICE_LOCALES[assistantLang] || 'en-IN'}) crop rate, weather...`}
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => runQuery(inputText)}
              returnKeyType="send"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!inputText.trim() || busy) && { opacity: 0.45 }]}
              onPress={() => runQuery(inputText)}
              disabled={!inputText.trim() || busy}
            >
              <Text style={styles.sendBtnText}>Send</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'flex-end'
  },
  sheet: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.45)',
    height: '86%',
    overflow: 'hidden'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#064E3B',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B'
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  botBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center'
  },
  botBadgeIcon: { fontSize: 18 },
  title: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  subtitle: { color: '#6EE7B7', fontSize: 10, marginTop: 1 },
  headerControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconBtnText: { color: '#E2E8F0', fontSize: 14, fontWeight: '700' },
  langBar: {
    backgroundColor: '#0F172A',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6
  },
  langBarLabel: { color: '#94A3B8', fontSize: 9, fontWeight: '800', letterSpacing: 0.6, marginBottom: 6 },
  horizontalScroll: { flexGrow: 0, flexShrink: 0 },
  langRow: { gap: 6, paddingBottom: 2, alignItems: 'center' },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 6
  },
  langChipActive: { backgroundColor: '#059669', borderColor: '#34D399' },
  langChipText: { color: '#CBD5E1', fontSize: 11, fontWeight: '700' },
  langChipTextActive: { color: '#FFFFFF' },
  chatArea: { flex: 1, paddingHorizontal: 14, backgroundColor: '#020617' },
  msgWrap: { gap: 6 },
  msgEnd: { alignItems: 'flex-end' },
  msgStart: { alignItems: 'flex-start' },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '88%' },
  userBubble: {
    backgroundColor: '#059669',
    borderBottomRightRadius: 4
  },
  botBubble: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderBottomLeftRadius: 4
  },
  bubbleText: { color: '#F8FAFC', fontSize: 13, lineHeight: 19 },
  readAloudBtn: { marginTop: 6, alignSelf: 'flex-start' },
  readAloudText: { color: '#34D399', fontSize: 11, fontWeight: '700' },
  loadingText: { color: '#34D399', fontSize: 12, fontWeight: '600' },
  weatherCard: {
    width: '88%',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 2
  },
  weatherTitle: { color: '#FCD34D', fontSize: 12, fontWeight: '800' },
  weatherStats: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  weatherSub: { color: '#94A3B8', fontSize: 11 },
  ratesList: { width: '88%', gap: 6 },
  rateTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10
  },
  rateLeft: { color: '#CBD5E1', fontSize: 11, flex: 1 },
  ratePrice: { color: '#34D399', fontSize: 12, fontWeight: '800' },
  actionBtn: {
    backgroundColor: '#0284C7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: 'flex-start'
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  promptBar: {
    height: 48,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    justifyContent: 'center'
  },
  promptRow: {
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6
  },
  promptChip: {
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    marginRight: 6,
    alignSelf: 'center'
  },
  promptText: { color: '#CBD5E1', fontSize: 11, fontWeight: '600' },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B'
  },
  input: {
    flex: 1,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#F8FAFC',
    fontSize: 13
  },
  sendBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendBtnText: { color: '#0F172A', fontWeight: '900', fontSize: 13 }
});
