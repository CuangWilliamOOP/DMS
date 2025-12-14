// File: src/components/FarmMapPanel.jsx
// NOTE: This version adds support for estate *block* polygons via GET /api/maps/<estate_code>/blocks/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import API from '../services/api';

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
    Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90;

  for (const [lng0, lat0] of points) {
    if (typeof lng0 !== 'number' || typeof lat0 !== 'number') continue;

    let lng = lng0;
    let lat = lat0;

    // Safety: sometimes data arrives swapped.
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

function hslToHex(h, s, l) {
  // h: 0..360, s/l: 0..100
  const _h = (((h % 360) + 360) % 360) / 60;
  const _s = Math.max(0, Math.min(1, s / 100));
  const _l = Math.max(0, Math.min(1, l / 100));

  const c = (1 - Math.abs(2 * _l - 1)) * _s;
  const x = c * (1 - Math.abs((_h % 2) - 1));
  const m = _l - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (_h >= 0 && _h < 1) {
    r1 = c;
    g1 = x;
  } else if (_h >= 1 && _h < 2) {
    r1 = x;
    g1 = c;
  } else if (_h >= 2 && _h < 3) {
    g1 = c;
    b1 = x;
  } else if (_h >= 3 && _h < 4) {
    g1 = x;
    b1 = c;
  } else if (_h >= 4 && _h < 5) {
    r1 = x;
    b1 = c;
  } else {
    r1 = c;
    b1 = x;
  }

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);

  const toHex = (v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getBlockNameFromFeature(feature) {
  const props = feature?.properties || {};
  return String(props.block ?? props.blockName ?? props.name ?? props.id ?? 'Block');
}

function decorateBlocksWithUniqueColors(geojson) {
  // Adds/overwrites properties.fillColor + properties.blockName.
  // Goal: every block gets a unique color (no repeats).
  if (!geojson || geojson.type !== 'FeatureCollection') return geojson;

  const features = geojson.features || [];

  // Build a stable, deterministic list of unique block names.
  const names = Array.from(new Set(features.map(getBlockNameFromFeature))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );

  // Generate distinct colors.
  // Golden-angle hue spacing tends to look good even when N is not known upfront.
  const GOLDEN_ANGLE = 137.50776405003785;
  const used = new Set();
  const colorByName = new Map();

  const sat = 72;
  const light = 55;

  for (let i = 0; i < names.length; i += 1) {
    const name = names[i];

    let hue = (i * GOLDEN_ANGLE) % 360;
    let color = hslToHex(hue, sat, light);

    // Extremely defensive: if hex collides (rare), shift hue until unique.
    let tries = 0;
    while (used.has(color) && tries < 360) {
      hue = (hue + 1) % 360;
      color = hslToHex(hue, sat, light);
      tries += 1;
    }

    used.add(color);
    colorByName.set(name, color);
  }

  return {
    ...geojson,
    features: features.map((f) => {
      const props = f?.properties || {};
      const blockName = getBlockNameFromFeature(f);
      const fillColor = colorByName.get(blockName) || '#9e9e9e';

      return {
        ...f,
        properties: {
          ...props,
          blockName,
          fillColor,
        },
      };
    }),
  };
}

export default function FarmMapPanel({ estateCode = 'bunut1' }) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const [outline, setOutline] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const colors = useMemo(() => {
    const dark = theme.palette.mode === 'dark';
    return {
      // Outline should be black.
      line: '#000000',

      // Blocks (fills only; each block gets a unique color via properties.fillColor)
      blockFallback: dark ? '#6e6e6e' : '#9e9e9e',
      blockFillOpacity: dark ? 0.52 : 0.42,

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
      minLng < -180 ||
      maxLng > 180 ||
      minLat < -90 ||
      maxLat > 90;

    if (bad) {
      console.error('Invalid bbox from outline:', bbox);
      setError('Koordinat peta tidak valid (pastikan GeoJSON memakai derajat lon/lat).');
      return;
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 800 }
    );
  }, [outline]);

  const ensureBlocksLayers = useCallback(
    (map, geojson) => {
      if (!map || !geojson) return;

      const decorated = decorateBlocksWithUniqueColors(geojson);

      // Upsert source.
      const src = map.getSource('estate-blocks');
      if (src) {
        try {
          src.setData(decorated);
        } catch (e) {
          console.warn('Failed to update blocks source data:', e);
        }
        return;
      }

      // Add source + layers.
      map.addSource('estate-blocks', {
        type: 'geojson',
        data: decorated,
      });

      // Blocks (fill only) *below* the estate outer border.
      map.addLayer(
        {
          id: 'blocks-fill',
          type: 'fill',
          source: 'estate-blocks',
          paint: {
            'fill-color': ['coalesce', ['get', 'fillColor'], colors.blockFallback],
            'fill-opacity': colors.blockFillOpacity,
          },
        },
        'estate-line'
      );

      // Interaction: cursor + click popup
      map.on('mouseenter', 'blocks-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'blocks-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('click', 'blocks-fill', (e) => {
        const feature = e?.features?.[0];
        const block = feature?.properties?.blockName || feature?.properties?.block || feature?.properties?.name || 'Block';

        if (popupRef.current) {
          try {
            popupRef.current.remove();
          } catch (_) {
            // ignore
          }
          popupRef.current = null;
        }

        popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
          .setLngLat(e.lngLat)
          .setHTML(`<div style="font-weight:700">${String(block)}</div>`)
          .addTo(map);
      });
    },
    [colors.blockFallback, colors.blockFillOpacity]
  );

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

  // Fetch block GeoJSON (non-blocking: map can render without it).
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await API.get(`/maps/${estateCode}/blocks/`);
        if (!alive) return;
        setBlocks(res.data);
      } catch (e) {
        // It's OK if blocks are not ready yet.
        console.warn('Blocks not available (yet):', e?.response?.status || e);
        if (!alive) return;
        setBlocks(null);
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
      try {
        mapRef.current.remove();
      } catch (_) {
        // ignore
      }
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

    // Log MapLibre errors to diagnose cancellations/render issues.
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

      // Outer border (no fill).
      map.addLayer({
        id: 'estate-line',
        type: 'line',
        source: 'estate-outline',
        paint: {
          'line-color': colors.line,
          'line-width': 2.5,
        },
      });

      // If blocks are already loaded, add them now.
      if (blocks) {
        try {
          ensureBlocksLayers(map, blocks);
        } catch (e) {
          console.warn('Failed to add blocks layers:', e);
        }
      }

      fitToOutline();
      // Force resizes to stabilize canvas after layer additions.
      try { map.resize(); } catch {}
      try { requestAnimationFrame(() => map.resize()); } catch {}
      try { setTimeout(() => map.resize(), 150); } catch {}
    });

    return () => {
      if (popupRef.current) {
        try {
          popupRef.current.remove();
        } catch (_) {
          // ignore
        }
        popupRef.current = null;
      }

      try {
        map.remove();
      } catch (_) {
        // ignore
      }
      mapRef.current = null;
    };
  }, [outline, blocks, colors.line, ensureBlocksLayers, fitToOutline]);

  // If blocks load AFTER the map is already created/loaded, add them (or update them) without rebuilding the map.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !blocks) return;

    const apply = () => {
      try {
        ensureBlocksLayers(map, blocks);
      } catch (e) {
        console.warn('Failed to apply blocks:', e);
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [blocks, ensureBlocksLayers]);

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
        <Button size="small" variant="contained" onClick={fitToOutline} disabled={loading || !outline}>
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
        <div style={{ fontWeight: 700 }}>{estateCode === 'bunut1' ? 'Bunut 1' : estateCode}</div>
        <div style={{ opacity: 0.9 }}>Scroll: zoom • Right-drag: rotate</div>
      </Box>
    </Box>
  );
}
