import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { getImageSource } from '../config/api';

/**
 * Renders produce/mandi images with Wikimedia-compliant User-Agent headers
 * and graceful fallback when a remote or ephemeral local upload fails.
 */
export default function CropImage({
  uri,
  fallbackUri = null,
  style,
  fallbackStyle,
  fallbackEmoji = '🌾',
  emojiSize = 42,
  resizeMode = 'cover'
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [uri, fallbackUri]);

  const activeUri = step === 0 ? uri : step === 1 ? fallbackUri : null;
  const source = activeUri ? getImageSource(activeUri) : null;

  if (!source) {
    return (
      <View
        style={[
          style,
          { backgroundColor: '#064e3b', justifyContent: 'center', alignItems: 'center' },
          fallbackStyle
        ]}
      >
        <Text style={{ fontSize: emojiSize }}>{fallbackEmoji}</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (step === 0 && fallbackUri && fallbackUri !== uri) {
          setStep(1);
        } else {
          setStep(2);
        }
      }}
    />
  );
}

