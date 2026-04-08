import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polygon, Text as SvgText } from 'react-native-svg';
import { COLORS, FONTS } from '../theme';

/**
 * PrajaShakti logo — matches the web SVG exactly.
 *
 * Web reference (LoginPage.jsx):
 *   <polygon points="28,47 3,5 53,5" fill="rgba(220,20,60,0.08)" stroke="#DC143C" strokeWidth="3" />
 *   Inverted triangle: base at top (y=5), apex at bottom (y=47).
 *
 * @param {{
 *   size?:        number,   // SVG width (default 80)
 *   showName?:    boolean,  // show "प्रजाशक्ति" text (default true)
 *   showTagline?: boolean,  // show "Power of the Citizens" (default true)
 *   nameColor?:   string,   // color for the name text
 *   taglineColor?:string,
 * }}
 */
export default function Logo({
  size = 80,
  showName = true,
  showTagline = true,
  nameColor = COLORS.deepTeal,
  taglineColor = COLORS.textMuted,
}) {
  const svgHeight = size * 0.88; // maintain web's aspect ratio (56w × 50h → 0.88)

  return (
    <View style={styles.wrap}>
      {/* SVG inverted triangle — identical polygon to web */}
      <Svg width={size} height={svgHeight} viewBox="0 0 56 50" fill="none">
        <Polygon
          points="28,47 3,5 53,5"
          fill="rgba(220,20,60,0.08)"
          stroke="#DC143C"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <SvgText
          x="28"
          y="30"
          textAnchor="middle"
          fontSize="11"
          fontWeight="800"
          fill="#DC143C"
          fontFamily="System"
        >
          प्र
        </SvgText>
      </Svg>

      {showName ? <Text style={[styles.name, { color: nameColor }]}>प्रजाशक्ति</Text> : null}

      {showTagline ? (
        <Text style={[styles.tagline, { color: taglineColor }]}>POWER OF THE CITIZENS</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
});
