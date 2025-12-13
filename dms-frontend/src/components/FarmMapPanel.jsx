// File: src/components/FarmMapPanel.jsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import API from '../services/api';

// Toggle to reduce cancellations while debugging tile loads.
const DEBUG_NO_ANIM = false;

// Minimal raster basemap style (OpenStreetMap raster tiles).
// NOTE: for production/high traffic, consider hosting tiles or using a commercial provider.
const OSM_RASTER_STYLE = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': '#e9eef6' },
    },
    {
      id: 'osm',
      type: 'raster',
      source: 'osm',
    },
  ],
};

function computeBbox(geojson) {
  // Returns [minLng, minLat, maxLng, maxLat]
  if (!geojson) return null;

  const points = [];
  const walk = (node) => {
    if (!node) return;
    if (Array.isArray(node) && node.length >= 2 && typeof node[0] === 'number' && typeof node[1] === 'number') {
      points.push(node);
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
  };

  if (geojson.type === 'FeatureCollection') {
    (geojson.features || []).forEach((f) => walk(f?.geometry?.coordinates));
  } else if (geojson.type === 'Feature') {
    walk(geojson?.geometry?.coordinates);
  } else {
    walk(geojson?.coordinates);
  }

  if (points.length === 0) return null;

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  const isValidLngLat = (lng, lat) =>
    Number.isFinite(lng) &&
    Number.isFinite(lat) &&
    Math.abs(lng) <= 180 &&
    Math.abs(lat) <= 90;

  for (const [lng0, lat0] of points) {
    if (typeof lng0 !== 'number' || typeof lat0 !== 'number') continue;

    let lng = lng0;
    let lat = lat0;

    if (!isValidLngLat(lng, lat) && isValidLngLat(lat, lng)) {
      [lng, lat] = [lat, lng];
    }

    if (!isValidLngLat(lng, lat)) continue;

    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }

  if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

export default function FarmMapPanel({ estateCode = 'bunut1' }) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  const [outline, setOutline] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const colors = useMemo(() => {
    // Slightly different opacity for dark mode so it remains visible.
    const dark = theme.palette.mode === 'dark';
    return {
      line: dark ? '#ff6b6b' : '#e53935',
      fill: dark ? 'rgba(255, 107, 107, 0.18)' : 'rgba(229, 57, 53, 0.14)',
      extrusion: dark ? 'rgba(255, 107, 107, 0.55)' : 'rgba(229, 57, 53, 0.45)',
      overlayBg: dark ? 'rgba(10, 12, 18, 0.65)' : 'rgba(255, 255, 255, 0.72)',
    };
  }, [theme.palette.mode]);

  const fitToOutline = useCallback(() => {
    const map = mapRef.current;
    if (!map || !outline) return;
    const bbox = computeBbox(outline);
    if (!bbox) return;

    const [minLng, minLat, maxLng, maxLat] = bbox;
    const bad =
      ![minLng, minLat, maxLng, maxLat].every(Number.isFinite) ||
      minLng < -180 || maxLng > 180 ||
      minLat < -90  || maxLat > 90;

    if (bad) {
      console.error("Invalid bbox from outline:", bbox);
      setError("Koordinat peta tidak valid (lat/long tertukar atau bukan derajat).");
      return;
    }

    map.fitBounds(
      [[minLng, minLat], [maxLng, maxLat]],
      { padding: 60, duration: DEBUG_NO_ANIM ? 0 : 800 }
    );
  }, [outline]);

  // Fetch outline GeoJSON from Django.
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await API.get(`/maps/${estateCode}/outline/`);
        if (!alive) return;
        setOutline(res.data);
      } catch (e) {
        console.error('Failed to load estate outline:', e);
        if (!alive) return;
        setError('Gagal memuat peta kebun.');
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [estateCode]);

  // Create the map once the outline is available (so we can fit bounds immediately).
  useEffect(() => {
    if (!containerRef.current || !outline) return;

    // If re-mounting or switching estates, cleanly remove the old map.
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const bbox = computeBbox(outline);
    const center = bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] : [102.216, 0.27];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_RASTER_STYLE,
      center,
      zoom: 13,
      pitch: 55,
      bearing: -15,
      antialias: true,
    });

    mapRef.current = map;

    // Quick instrumentation to detect re-inits/cancellations.
    console.count('[FarmMapPanel] map init');
    map.on('load', () => console.log('[MapLibre] load'));
    map.on('idle', () => console.log('[MapLibre] idle (all tiles loaded for current view)'));
    map.on('error', (e) => {
      console.error('[MapLibre error]', e?.error || e);
    });

    // Standard controls (zoom + compass + pitch).
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

    map.on('load', () => {
      // Outline source.
      map.addSource('estate-outline', {
        type: 'geojson',
        data: outline,
      });

      // Fill first.
      map.addLayer({
        id: 'estate-fill',
        type: 'fill',
        source: 'estate-outline',
        paint: {
          'fill-color': colors.fill,
          'fill-opacity': 1,
        },
      });

      // 2.5D / pseudo-3D extrusion (small height, just to give depth when pitched).
      map.addLayer({
        id: 'estate-extrusion',
        type: 'fill-extrusion',
        source: 'estate-outline',
        paint: {
          'fill-extrusion-color': colors.extrusion,
          'fill-extrusion-height': 60,
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 0.35,
        },
      });

      // Border on top.
      map.addLayer({
        id: 'estate-line',
        type: 'line',
        source: 'estate-outline',
        paint: {
          'line-color': colors.line,
          'line-width': 2.5,
        },
      });

      fitToOutline();
      // Force multiple resizes to avoid layout timing issues.
      try { map.resize(); } catch {}
      try { requestAnimationFrame(() => map.resize()); } catch {}
      try { setTimeout(() => map.resize(), 150); } catch {}
    });

    return () => {
      console.count('[FarmMapPanel] map destroy');
      map.remove();
      mapRef.current = null;
    };
  }, [outline, colors, fitToOutline]);

  // Resize map when the container changes size (important when switching tabs / responsive layout).
  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map) return;

    const ro = new ResizeObserver(() => {
      try {
        map.resize();
      } catch (e) {
        // ignore
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [outline]);

  return (
    <Box
      sx={{
        position: 'relative',
        height: { xs: '60vh', md: '70vh' },
        borderRadius: 3,
        overflow: 'hidden',
        border: theme.palette.mode === 'dark' ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <Box
        ref={containerRef}
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Loading / error overlays */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
            background: colors.overlayBg,
            zIndex: 3,
          }}
        >
          <CircularProgress size={22} />
          <Typography variant="body2">Memuat peta…</Typography>
        </Box>
      )}

      {!!error && !loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            background: colors.overlayBg,
            zIndex: 3,
            px: 2,
            textAlign: 'center',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {error}
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => {
              // brute-force refetch by resetting outline
              setOutline(null);
              setLoading(true);
              setError('');
              API.get(`/maps/${estateCode}/outline/`)
                .then((res) => setOutline(res.data))
                .catch(() => setError('Gagal memuat peta kebun.'))
                .finally(() => setLoading(false));
            }}
          >
            Coba lagi
          </Button>
        </Box>
      )}

      {/* Controls */}
      <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 1, zIndex: 4 }}>
        <Button
          size="small"
          variant="contained"
          onClick={fitToOutline}
          disabled={loading || !outline}
        >
          Reset view
        </Button>
      </Box>

      {/* Small label */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          zIndex: 4,
          px: 1.2,
          py: 0.6,
          borderRadius: 2,
          backgroundColor: theme.palette.mode === 'dark' ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0.45)',
          color: '#fff',
          fontSize: 12,
          lineHeight: 1.2,
        }}
      >
        <div style={{ fontWeight: 700 }}>Bunut 1</div>
        <div style={{ opacity: 0.9 }}>Scroll: zoom • Right-drag: rotate</div>
      </Box>
    </Box>
  );
}
