import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, FONTS } from '../theme';
import { getDevHost } from '../utils/config';

// In dev, LocalStack runs on port 4566 which physical devices can't reach
// (host firewall blocks LAN access to that port).
// Rewrite LocalStack media URLs to go through the API media proxy on port 3000,
// which is already reachable from the device.
//
// http://localhost:4566/prajashakti-media-dev/avatars/uid/file.jpg?t=123
//   → http://192.168.x.x:3000/api/v1/media/avatars/uid/file.jpg
function resolveUri(uri) {
  if (!__DEV__ || !uri) return uri;

  // Match LocalStack URLs: http://(localhost|127.0.0.1):4566/{bucket}/{key}
  const match = uri.match(/^http:\/\/(?:localhost|127\.0\.0\.1):4566\/[^/?]+\/([^?]+)/);
  if (match) {
    const devHost = getDevHost();
    if (!devHost || devHost === 'localhost') return uri;
    return `http://${devHost}:3000/api/v1/media/${match[1]}`;
  }

  return uri;
}

/**
 * Avatar component. Shows image if `uri` provided, else initials derived from `name`.
 * Optionally shows a verified badge (✓) overlay.
 * Wraps in TouchableOpacity if `onPress` provided.
 *
 * @param {{
 *   uri?:       string,
 *   name?:      string,
 *   size?:      number,
 *   verified?:  boolean,
 *   onPress?:   () => void,
 *   style?:     object,
 * }} props
 */
export default function Avatar({ uri, name = '', size = 40, verified = false, onPress, style }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  const fontSize = Math.round(size * 0.36);
  const badgeSize = Math.round(size * 0.32);

  const inner = (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {uri ? (
        <Image
          source={{ uri: resolveUri(uri) }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.initials, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.initialsText, { fontSize }]}>{initials || '?'}</Text>
        </View>
      )}

      {verified && (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        >
          <Text style={{ color: '#fff', fontSize: badgeSize * 0.6, lineHeight: badgeSize }}>✓</Text>
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {inner}
      </TouchableOpacity>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  ring: {
    overflow: 'hidden',
  },
  initials: {
    backgroundColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialsText: {
    color: '#fff',
    fontWeight: FONTS.weight.bold,
  },
  badge: {
    position: 'absolute',
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
});
