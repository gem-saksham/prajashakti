/**
 * PhotoGallery (mobile) — grid thumbnail strip with full-screen viewer.
 *
 * Full-screen viewer supports:
 *   - Horizontal paging between photos
 *   - Pinch-to-zoom via iOS ScrollView (native)
 *   - Double-tap to toggle 2× zoom (both platforms)
 *   - Long-press → share/save photo via expo-sharing
 *   - GPS verified badge overlay when photo has GPS EXIF data
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { COLORS, FONTS } from '../../theme';
import { getDevHost, API_URL } from '../../utils/config';

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) {
    const m = url.match(/^http:\/\/(?:localhost|127\.0\.0\.1):4566\/[^/?]+\/([^?]+)/);
    if (m) {
      const host = getDevHost();
      if (host && host !== 'localhost') {
        return `http://${host}:3000/api/v1/media/${m[1]}`;
      }
    }
    return url;
  }
  return `${API_URL}/media/${url.replace(/^\//, '')}`;
}

function hasGps(photo) {
  if (!photo) return false;
  if (photo.exifGps?.lat != null) return true;
  if (photo.gpsLat != null && photo.gpsLng != null) return true;
  if (photo.isVerified || photo.isVerifiedLocation) return true;
  return false;
}

async function savePhoto(url) {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) return;
    const ext = (url.match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i)?.[1] || 'jpg').toLowerCase();
    const local = `${FileSystem.cacheDirectory}photo-${Date.now()}.${ext}`;
    const { uri } = await FileSystem.downloadAsync(url, local);
    await Sharing.shareAsync(uri, {
      dialogTitle: 'Save or share photo',
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
    });
  } catch {
    // user cancelled or network failure — silent
  }
}

function ZoomableImage({ uri, width, height, onLongPress }) {
  const scrollRef = useRef(null);
  const scale = useRef(new Animated.Value(1)).current;
  const lastTap = useRef(0);

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      // toggle between 1x and 2x
      Animated.spring(scale, {
        toValue: scale._value > 1 ? 1 : 2,
        useNativeDriver: true,
        friction: 7,
      }).start();
      // Reset iOS native ScrollView zoom if we're on iOS
      if (Platform.OS === 'ios') {
        scrollRef.current?.scrollResponderZoomTo?.({
          x: 0,
          y: 0,
          width,
          height,
          animated: true,
        });
      }
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }, [scale, width, height]);

  return (
    <ScrollView
      ref={scrollRef}
      maximumZoomScale={3}
      minimumZoomScale={1}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      style={{ width, height }}
      bouncesZoom
    >
      <TouchableWithoutFeedback
        onPress={handleDoubleTap}
        onLongPress={onLongPress}
        delayLongPress={450}
      >
        <Animated.View style={{ width, height, transform: [{ scale }] }}>
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        </Animated.View>
      </TouchableWithoutFeedback>
    </ScrollView>
  );
}

export default function PhotoGallery({ photos }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  if (!photos?.length) return null;

  const openAt = (i) => {
    Haptics.selectionAsync().catch(() => {});
    setIndex(i);
    setOpen(true);
  };
  const width = Dimensions.get('window').width;
  const height = Dimensions.get('window').height;

  const visible = photos.slice(0, 3);
  const cols = photos.length === 1 ? 1 : photos.length === 2 ? 2 : 3;

  const onPageScroll = (e) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View>
      <View style={[styles.grid, { gap: 4 }]}>
        {visible.map((photo, i) => {
          const isLast = i === 2 && photos.length > 3;
          const w = (width - 32 - (cols - 1) * 4) / cols;
          const h = cols === 1 ? (w * 9) / 16 : w;
          const gps = hasGps(photo);
          return (
            <TouchableOpacity
              key={i}
              activeOpacity={0.9}
              onPress={() => openAt(i)}
              style={{ width: w, height: h, borderRadius: 8, overflow: 'hidden' }}
            >
              <Image
                source={{ uri: resolveUrl(photo.url) }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              {gps ? (
                <View style={styles.gpsBadge}>
                  <Text style={styles.gpsBadgeText}>📍 GPS</Text>
                </View>
              ) : null}
              {isLast ? (
                <View style={styles.overlay}>
                  <Text style={styles.overlayText}>+{photos.length - 3}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalWrap}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setOpen(false)}
            style={styles.closeBtn}
            accessibilityLabel="Close photo viewer"
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            pagingEnabled
            contentOffset={{ x: index * width, y: 0 }}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onPageScroll}
          >
            {photos.map((p, i) => {
              const uri = resolveUrl(p.url);
              const gps = hasGps(p);
              return (
                <View key={i} style={{ width, height }}>
                  <ZoomableImage
                    uri={uri}
                    width={width}
                    height={height}
                    onLongPress={() => savePhoto(uri)}
                  />
                  {gps ? (
                    <View style={styles.gpsBadgeLarge}>
                      <Text style={styles.gpsBadgeLargeText}>📍 GPS Verified</Text>
                    </View>
                  ) : null}
                  {p.caption ? (
                    <Text style={styles.caption} numberOfLines={2}>
                      {p.caption}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.counter}>
              {index + 1} / {photos.length}
            </Text>
            <Text style={styles.hint}>Double-tap to zoom · Long-press to save</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayText: { color: '#fff', fontSize: 18, fontWeight: FONTS.weight.heavy },

  gpsBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(20,137,122,0.92)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gpsBadgeText: { color: '#fff', fontSize: 9, fontWeight: FONTS.weight.bold },

  gpsBadgeLarge: {
    position: 'absolute',
    top: 60,
    left: 20,
    backgroundColor: 'rgba(20,137,122,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  gpsBadgeLargeText: { color: '#fff', fontSize: 11, fontWeight: FONTS.weight.bold },

  modalWrap: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 2,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 18 },
  caption: {
    color: '#fff',
    fontSize: 13,
    padding: 12,
    position: 'absolute',
    bottom: 64,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  counter: { color: '#fff', fontSize: 13, fontWeight: FONTS.weight.semibold },
  hint: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
});
