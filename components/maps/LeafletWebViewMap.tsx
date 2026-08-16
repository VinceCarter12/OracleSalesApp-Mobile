import { useMemo, useRef, useState, useEffect } from 'react';
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import WebView, { type WebViewMessageEvent } from 'react-native-webview';
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

/** OpenTopoMap only serves tiles up to z17 — capping past that showed blank/gray tiles. CARTO light/dark serve up to z20. */
const TILE_MAX_ZOOM: Record<MapTileType, number> = {
  light: 19,
  dark: 19,
  terrain: 17,
};

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
/** Metro Manila — same default center as the web app's map-constants.ts. */
const DEFAULT_CENTER: [number, number] = [14.55, 121.0];
const DEFAULT_ZOOM = 12;

// Batch (2026-08-16) clustering follow-up: overlapping/near-identical GPS
// office+meeting pins made the bigger letter-based pins alone useless once
// several pins sat on top of each other. `Leaflet.markercluster` is loaded
// from the CDN the same way Leaflet core already is above (Vince's
// established "no react-native-maps/Google Maps, CDN-in-WebView" pattern) —
// split into their own string constants (not the main buildMapHtml body) so
// that already-oversized function stays as small as possible.
/** `<link>` tags for the plugin's two stylesheets, loaded next to leaflet.css. */
const MARKERCLUSTER_CSS_LINKS = `<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />`;
/** `<script>` tag for the plugin itself, loaded right after leaflet.js. */
const MARKERCLUSTER_SCRIPT_TAG = '<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>';
/**
 * Cluster badge CSS — matches `.pin-marker`'s visual weight (white border,
 * drop shadow) but filled with Corporate Emerald brand green instead of the
 * plugin's default yellow/orange/red gradient, so it reads as an
 * intentional BizLink control, not an unstyled third-party widget.
 */
const CLUSTER_BADGE_STYLE = `.cluster-badge{width:40px;height:40px;border-radius:50%;background:#005B36;border:3px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;}`;

export interface LeafletMapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Fill color — office pins use brand/green, meeting markers use status colors. */
  colorHex: string;
  /** Marker radius in px — used to give office pins and meeting markers a distinct silhouette, not just color. */
  radius: number;
  /** Short popup label shown on tap, before navigation. */
  label: string;
  /**
   * `kind: 'user'` (Vince 2026-08-08): the "you are here" chip — profile
   * picture (avatar) or, when there's no avatar, the first letter of the
   * user's first name.
   * `kind: 'pin'` (Vince 2026-08-16): office/meeting markers were plain same-
   * size `circleMarker` dots that clumped together at close zoom, making it
   * impossible to tell how many pins/which one was where — same enlarged-
   * letter treatment as the user chip, colored per `colorHex` (status/office
   * color system is unchanged, only the shape).
   */
  icon?: { kind: 'user'; imageUrl: string | null; text: string } | { kind: 'pin'; text: string };
}

interface LeafletWebViewMapProps {
  markers: LeafletMapMarker[];
  onMarkerPress: (id: string) => void;
  height?: number;
  tileType?: MapTileType;
  focusedMarkerId?: string | null;
  /** Optional single pin editor. This is deliberately separate from meeting markers. */
  editablePin?: { lat: number; lng: number; label: string } | null;
  onPinDragEnd?: (position: { lat: number; lng: number }) => void;
  /** Animate the map to a newly selected coordinate without rebuilding the WebView. */
  focusCoordinate?: { lat: number; lng: number } | null;
}

interface LeafletWebViewMapWithControlsProps {
  markers: LeafletMapMarker[];
  selectedMarkerIds: string[];
  height: number;
  tileType: MapTileType;
  onTileTypeChange: (type: MapTileType) => void;
  onExpandPress?: () => void;
  expanded?: boolean;
  onMarkerPress?: (id: string) => void;
}

function buildMapHtml(markers: LeafletMapMarker[], tileType: MapTileType, focusedMarkerId?: string | null, editablePin?: { lat: number; lng: number; label: string } | null): string {
  // `<` is escaped to `<` (valid inside a JS string literal, decodes to
  // the same character at runtime) so a company/location name containing a
  // literal `</script>` can never break out of the inline <script> block —
  // the HTML parser scans for that byte sequence independent of JS string
  // nesting. Marker labels are still rendered as `textContent` (never
  // innerHTML) below, so this is defense in depth, not the only guard.
  const markersJson = JSON.stringify(markers).replace(/</g, '\\u003c');
  const focusedMarker = focusedMarkerId ? markers.find((marker) => marker.id === focusedMarkerId) : null;
  const focusedMarkerIdJson = JSON.stringify(focusedMarker ? focusedMarkerId : null).replace(/</g, '\\u003c');
  const tileUrl = TILE_URLS[tileType];
  const tileMaxZoom = TILE_MAX_ZOOM[tileType];
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  ${MARKERCLUSTER_CSS_LINKS}
  <style>html,body,#map{height:100%;margin:0;padding:0;background:${BIZLINK_COLORS.canvas};}
    .user-marker{width:40px;height:40px;border-radius:50%;background:#0B2545;border:3px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.35);overflow:hidden;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:16px;}
    .user-avatar{width:100%;height:100%;object-fit:cover;display:block;}
    .pin-marker{width:34px;height:34px;border-radius:50%;border:2.5px solid #FFFFFF;box-shadow:0 2px 5px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:15px;}
    ${CLUSTER_BADGE_STYLE}</style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  ${MARKERCLUSTER_SCRIPT_TAG}
  <script>
    var markers = ${markersJson};
    var focusedMarkerId = ${focusedMarkerIdJson};
    var map = L.map('map', { zoomControl: true, attributionControl: false, maxZoom: ${tileMaxZoom} });
    L.tileLayer('${tileUrl}', { attribution: '${CARTO_ATTRIBUTION}', maxZoom: ${tileMaxZoom} }).addTo(map);

    // Office/meeting pins (and plain fallback dots) cluster together when
    // close - the "you are here" user marker and the single draggable
    // editablePin below are deliberately never added to this group, they
    // are added straight to map instead.
    var clusterGroup = L.markerClusterGroup({
      iconCreateFunction: function (cluster) {
        var chip = document.createElement('div');
        chip.className = 'cluster-badge';
        chip.textContent = String(cluster.getChildCount());
        return L.divIcon({ className: '', html: chip, iconSize: [40, 40], iconAnchor: [20, 20] });
      },
    });
    map.addLayer(clusterGroup);

    // JSON.stringify(undefined) returns undefined (not a string), which made
    // the controls-only map crash while constructing its memoized HTML.
    // Normalize the optional pin to JSON null before applying HTML escaping.
    var editablePin = ${JSON.stringify(editablePin ?? null).replace(/</g, '\\u003c')};
    if (editablePin) {
      map.setView([editablePin.lat, editablePin.lng], 16);
    } else if (focusedMarkerId) {
      var focused = markers.find(function (m) { return m.id === focusedMarkerId; });
      if (focused) {
        map.setView([focused.lat, focused.lng], 16);
      }
    } else if (markers.length > 0) {
      var pinMarkers = markers.filter(function (m) { return !(m.icon && m.icon.kind === 'user'); });
      if (pinMarkers.length > 0) {
        var bounds = L.latLngBounds(pinMarkers.map(function (m) { return [m.lat, m.lng]; }));
        map.fitBounds(bounds, { padding: [32, 32], maxZoom: 16 });
      } else {
        map.setView([markers[0].lat, markers[0].lng], ${DEFAULT_ZOOM});
      }
    } else {
      map.setView([${DEFAULT_CENTER[0]}, ${DEFAULT_CENTER[1]}], ${DEFAULT_ZOOM});
    }

    markers.forEach(function (m) {
      var marker;
      if (m.icon && m.icon.kind === 'user') {
        // "You are here" marker — profile picture (avatar) or the first
        // letter of the user's first name when there's no avatar. Built as a
        // divIcon so a real image/letter is shown instead of a plain dot.
        var chip = document.createElement('div');
        chip.className = 'user-marker';
        if (m.icon.imageUrl) {
          var img = document.createElement('img');
          img.className = 'user-avatar';
          img.alt = '';
          img.src = m.icon.imageUrl;
          img.onerror = function () {
            chip.textContent = m.icon.text;
          };
          chip.appendChild(img);
        } else {
          chip.textContent = m.icon.text;
        }
        marker = L.marker([m.lat, m.lng], {
          icon: L.divIcon({ className: '', html: chip, iconSize: [40, 40], iconAnchor: [20, 20] }),
        }).addTo(map);
        // Never clustered — there's only ever one, and it must stay
        // independently visible/tappable at every zoom level.
      } else if (m.icon && m.icon.kind === 'pin') {
        // Office/meeting marker (Vince 2026-08-16): enlarged letter chip
        // instead of a tiny same-size dot, same divIcon pattern as the user
        // marker above -- color still comes from m.colorHex (status/office
        // color system unchanged), only the shape/size changed.
        var pinChip = document.createElement('div');
        pinChip.className = 'pin-marker';
        pinChip.style.background = m.colorHex;
        pinChip.textContent = m.icon.text;
        marker = L.marker([m.lat, m.lng], {
          icon: L.divIcon({ className: '', html: pinChip, iconSize: [34, 34], iconAnchor: [17, 17] }),
        });
        clusterGroup.addLayer(marker);
      } else {
        marker = L.circleMarker([m.lat, m.lng], {
          radius: m.radius,
          color: '#FFFFFF',
          weight: 2,
          fillColor: m.colorHex,
          fillOpacity: 1,
        });
        clusterGroup.addLayer(marker);
      }
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
    if (editablePin) {
      var editorMarker = L.marker([editablePin.lat, editablePin.lng], { draggable: true }).addTo(map);
      var editorPopup = document.createElement('div');
      editorPopup.textContent = editablePin.label;
      editorMarker.bindPopup(editorPopup).openPopup();
      editorMarker.on('dragend', function () {
        var point = editorMarker.getLatLng();
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pin-drag-end', lat: point.lat, lng: point.lng }));
        }
      });
    }
    function handleNativeMapMessage(event) {
      try {
        var target = JSON.parse(event.data);
        if (target && Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
          map.flyTo([target.lat, target.lng], target.zoom || 16, { animate: true, duration: 0.8 });
        }
      } catch (_) {
        // Ignore malformed native bridge messages.
      }
    }
    window.addEventListener('message', handleNativeMapMessage);
    document.addEventListener('message', handleNativeMapMessage);
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
export function LeafletWebViewMap({ markers, onMarkerPress, height = 300, tileType = 'light', focusedMarkerId = null, editablePin = null, onPinDragEnd, focusCoordinate = null }: LeafletWebViewMapProps) {
  const webViewRef = useRef<WebView>(null);
  const html = useMemo(() => buildMapHtml(markers, tileType, focusedMarkerId, editablePin), [markers, tileType, focusedMarkerId, editablePin]);
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

  useEffect(() => {
    if (!focusCoordinate || !webViewRef.current) return;
    webViewRef.current.postMessage(JSON.stringify({ ...focusCoordinate, zoom: 16 }));
  }, [focusCoordinate]);

  function handleMessage(event: WebViewMessageEvent): void {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { id?: string; type?: string; lat?: number; lng?: number };
      if (payload.type === 'pin-drag-end' && Number.isFinite(payload.lat) && Number.isFinite(payload.lng)) {
        onPinDragEnd?.({ lat: payload.lat!, lng: payload.lng! });
        return;
      }
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
          <Text style={styles.overlayText}>The map couldn't be loaded. Check your internet connection.</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
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
  onMarkerPress,
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

  function handleMessage(event: WebViewMessageEvent): void {
    if (!onMarkerPress) return;
    try {
      const payload = JSON.parse(event.nativeEvent.data) as { id?: string };
      if (payload.id) onMarkerPress(payload.id);
    } catch {
      // Ignore malformed WebView bridge payloads.
    }
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
        onMessage={handleMessage}
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
          <Text style={styles.overlayText}>The map couldn't be loaded. Check your internet connection.</Text>
          <TouchableOpacity onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}
