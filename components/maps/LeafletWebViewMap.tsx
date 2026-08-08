import { useMemo, useRef, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
import { XStack, YStack } from 'tamagui';
import { BIZLINK_COLORS, BIZLINK_FONTS } from '../../lib/theme';

// Batch 8 Maps extension (2026-08-04): Vince's direct instruction — "Kung
// magkaka-map ang mobile, gamitin ang Leaflet sa WebView (react-native-
// webview) na may PAREHONG tile URLs at pin colors para walang conflict at
// pareho ang itsura — HUWAG react-native-maps/Google Maps." Leaflet + tile
// layer are loaded from the CDN inside the WebView's local HTML string
// (mirrors OracleSalesApp-Web's Leaflet 1.9.4 setup, not vendored into this
// app) — never react-native-maps/Google Maps. The tile provider below is
// CARTO light (the web repo's default, no paid API key) — confirm exact
// tile URL / pin hex parity against a fresh `npm run web:status` before
// merge; `WEB_STATUS.md` was not present in this working tree to verify
// against directly.

export type MapTileType = 'light' | 'dark' | 'terrain';

const TILE_URLS: Record<MapTileType, string> = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
};

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
/** Metro Manila — same default center as the web app's map-constants.ts. */
const DEFAULT_CENTER: [number, number] = [14.55, 121.0];
const DEFAULT_ZOOM = 12;

export interface LeafletMapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Fill color — office pins use brand/orange (verified/unverified), meeting markers use navy. */
  colorHex: string;
  /** Marker radius in px — used to give office pins and meeting markers a distinct silhouette, not just color. */
  radius: number;
  /** Short popup label shown on tap, before navigation. */
  label: string;
}

interface LeafletWebViewMapProps {
  markers: LeafletMapMarker[];
  onMarkerPress: (id: string) => void;
  height?: number;
  tileType?: MapTileType;
  focusedMarkerId?: string | null;
}

interface LeafletWebViewMapWithControlsProps {
  markers: LeafletMapMarker[];
  selectedMarkerIds: string[];
  height: number;
  tileType: MapTileType;
  onTileTypeChange: (type: MapTileType) => void;
  onExpandPress?: () => void;
  expanded?: boolean;
}

function buildMapHtml(markers: LeafletMapMarker[], tileType: MapTileType, focusedMarkerId?: string | null): string {
  // `<` is escaped to `<` (valid inside a JS string literal, decodes to
  // the same character at runtime) so a company/location name containing a
  // literal `</script>` can never break out of the inline <script> block —
  // the HTML parser scans for that byte sequence independent of JS string
  // nesting. Marker labels are still rendered as `textContent` (never
  // innerHTML) below, so this is defense in depth, not the only guard.
  const markersJson = JSON.stringify(markers).replace(/</g, '\\u003c');
  const tileUrl = TILE_URLS[tileType];
  const focusedMarker = focusedMarkerId ? markers.find((m) => m.id === focusedMarkerId) : null;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>html,body,#map{height:100%;margin:0;padding:0;background:${BIZLINK_COLORS.canvas};}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var markers = ${markersJson};
    var focusedMarkerId = ${focusedMarker ? `"${focusedMarkerId}"` : 'null'};
    var map = L.map('map', { zoomControl: true, attributionControl: false });
    L.tileLayer('${tileUrl}', { attribution: '${CARTO_ATTRIBUTION}', maxZoom: 19 }).addTo(map);

    if (focusedMarkerId) {
      var focused = markers.find(function (m) { return m.id === focusedMarkerId; });
      if (focused) {
        map.setView([focused.lat, focused.lng], 16);
      }
    } else if (markers.length > 0) {
      var bounds = L.latLngBounds(markers.map(function (m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
    } else {
      map.setView([${DEFAULT_CENTER[0]}, ${DEFAULT_CENTER[1]}], ${DEFAULT_ZOOM});
    }

    markers.forEach(function (m) {
      var marker = L.circleMarker([m.lat, m.lng], {
        radius: m.radius,
        color: '#FFFFFF',
        weight: 2,
        fillColor: m.colorHex,
        fillOpacity: 1,
      }).addTo(map);
      // Set via textContent (never innerHTML/a raw string) so a company or
      // "Others" free-text location name can never be interpreted as HTML —
      // Leaflet's bindPopup(string) treats a plain string as HTML with no
      // auto-escaping.
      var popupEl = document.createElement('div');
      popupEl.textContent = m.label;
      marker.bindPopup(popupEl);
      marker.on('click', function () {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ id: m.id }));
        }
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Self-contained Leaflet map rendered inside a WebView, per Vince's
 * "Leaflet sa WebView" instruction (see module header). Markers are baked
 * directly into the generated HTML string (no postMessage round-trip needed
 * to seed them) — only marker taps flow back out, via
 * `window.ReactNativeWebView.postMessage`. Supports map type switching
 * (light/dark/terrain) and focused marker view (2026-08-05 redesign).
 */
export function LeafletWebViewMap({ markers, onMarkerPress, height = 300, tileType = 'light', focusedMarkerId = null }: LeafletWebViewMapProps) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(markers, tileType, focusedMarkerId), [markers, tileType, focusedMarkerId]);
  // The map's Leaflet lib/CSS + tile images load over the network from
  // unpkg.com/basemaps.cartocdn.com — this is the one part of the screen
  // that structurally cannot be offline-first, so it needs its own
  // load-failure state distinct from the screen-level `isLikelyOnline()`
  // offline banner (which only reflects device connectivity, not whether
  // this specific WebView load actually succeeded).
  const [loadFailed, setLoadFailed] = useState(false);

  // Reload WebView when tileType or focusedMarkerId changes
  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [tileType, focusedMarkerId]);

  function handleMessage(event: WebViewMessageEvent): void {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { id?: string };
      if (payload.id) onMarkerPress(payload.id);
    } catch {
      // Malformed bridge payload — ignore, never crash the screen over a tap.
    }
  }

  function handleRetry(): void {
    setLoadFailed(false);
    webViewRef.current?.reload();
  }

  return (
    <View style={[styles.wrapper, { height }]}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onMessage={handleMessage}
        onError={() => setLoadFailed(true)}
        onHttpError={() => setLoadFailed(true)}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
      />
      {loadFailed ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Hindi ma-load ang mapa. I-check ang internet connection.</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Subukan ulit</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: BIZLINK_COLORS.canvas,
  },
  webview: {
    flex: 1,
    backgroundColor: BIZLINK_COLORS.canvas,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    backgroundColor: BIZLINK_COLORS.canvas,
  },
  overlayText: {
    fontFamily: BIZLINK_FONTS.medium,
    fontSize: 13,
    color: BIZLINK_COLORS.muted,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: BIZLINK_COLORS.brand,
  },
  retryText: {
    fontFamily: BIZLINK_FONTS.semibold,
    fontSize: 13,
    color: '#FFFFFF',
  },
});

/**
 * Enhanced map component with integrated controls (Dark/Light/Terrain selector)
 * inside the map surface, and expand button for full-screen view.
 */
export function LeafletWebViewMapWithControls({
  markers,
  selectedMarkerIds,
  height,
  tileType,
  onTileTypeChange,
  onExpandPress,
  expanded = false,
}: LeafletWebViewMapWithControlsProps) {
  const [loadFailed, setLoadFailed] = useState(false);
  const webViewRef = useRef<WebView>(null);
  
  // Filter markers to show only selected ones if any are selected
  const displayMarkers = selectedMarkerIds.length > 0
    ? markers.filter((m) => selectedMarkerIds.includes(m.id))
    : markers;
  
  const focusedMarkerId = selectedMarkerIds.length > 0 ? selectedMarkerIds[0] : null;
  const html = useMemo(
    () => buildMapHtml(displayMarkers, tileType, focusedMarkerId),
    [displayMarkers, tileType, focusedMarkerId]
  );

  useEffect(() => {
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  }, [tileType, focusedMarkerId]);

  function handleRetry(): void {
    setLoadFailed(false);
    webViewRef.current?.reload();
  }

  const containerStyle = expanded
    ? { flex: 1 }
    : [styles.wrapper, { height }];

  return (
    <View style={containerStyle}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        onError={() => setLoadFailed(true)}
        onHttpError={() => setLoadFailed(true)}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
      />
      
      {/* Map Type Selector Overlay - Inside Map */}
      <View style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        flexDirection: 'row',
        backgroundColor: BIZLINK_COLORS.card,
        borderRadius: 999,
        padding: 4,
        gap: 4,
      }}>
        <Pressable
          onPress={() => onTileTypeChange('dark')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: tileType === 'dark' ? BIZLINK_COLORS.brand : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontFamily: BIZLINK_FONTS.semibold,
            color: tileType === 'dark' ? '#FFFFFF' : BIZLINK_COLORS.text,
          }}>
            Dark
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onTileTypeChange('light')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: tileType === 'light' ? BIZLINK_COLORS.brand : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontFamily: BIZLINK_FONTS.semibold,
            color: tileType === 'light' ? '#FFFFFF' : BIZLINK_COLORS.text,
          }}>
            Light
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onTileTypeChange('terrain')}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            backgroundColor: tileType === 'terrain' ? BIZLINK_COLORS.brand : 'transparent',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontFamily: BIZLINK_FONTS.semibold,
            color: tileType === 'terrain' ? '#FFFFFF' : BIZLINK_COLORS.text,
          }}>
            Terrain
          </Text>
        </Pressable>
      </View>

      {/* Expand Button - Only show when not expanded */}
      {!expanded && onExpandPress && (
        <Pressable
          onPress={onExpandPress}
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 40,
            height: 40,
            backgroundColor: BIZLINK_COLORS.card,
            borderRadius: 20,
            justifyContent: 'center',
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <Text style={{
            fontSize: 20,
            fontFamily: BIZLINK_FONTS.semibold,
            color: BIZLINK_COLORS.text,
          }}>
            ⛶
          </Text>
        </Pressable>
      )}

      {loadFailed ? (
        <View style={styles.overlay}>
          <Text style={styles.overlayText}>Hindi ma-load ang mapa. I-check ang internet connection.</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Subukan ulit</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
