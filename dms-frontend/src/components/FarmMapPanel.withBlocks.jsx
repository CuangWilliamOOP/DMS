// File: src/components/FarmMapPanel.jsx
// NOTE: This version adds support for estate *block* polygons via GET /api/maps/<estate_code>/blocks/

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Typography,
  Autocomplete,
  TextField,
  Paper,
  Divider,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
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

// --- Helpers to compute adjacency and pick high-contrast colors ---
function ringsFromGeometry(geom) {
  if (!geom) return [];
  if (geom.type === 'Polygon') return geom.coordinates || [];
  if (geom.type === 'MultiPolygon') {
    return (geom.coordinates || []).flatMap((poly) => poly || []);
  }
  return [];
}

function vertexKey([lng, lat], precision = 6) {
  return `${Number(lng).toFixed(precision)},${Number(lat).toFixed(precision)}`;
}

function vertexSet(feature, precision = 6) {
  const set = new Set();
  const rings = ringsFromGeometry(feature?.geometry);
  for (const ring of rings) {
    for (const coord of ring || []) {
      if (Array.isArray(coord) && coord.length >= 2) {
        set.add(vertexKey(coord, precision));
      }
    }
  }
  return set;
}

function setsIntersect(a, b) {
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const k of small) if (big.has(k)) return true;
  return false;
}

function buildAdjacency(features, precision = 6) {
  const n = features.length;
  const sets = features.map((f) => vertexSet(f, precision));
  const neighbors = Array.from({ length: n }, () => new Set());

  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (setsIntersect(sets[i], sets[j])) {
        neighbors[i].add(j);
        neighbors[j].add(i);
      }
    }
  }
  return neighbors;
}

function colorDistanceHsl(a, b) {
  const dhRaw = Math.abs(a.h - b.h);
  const dh = Math.min(dhRaw, 360 - dhRaw) / 180; // 0..1
  const ds = Math.abs(a.s - b.s) / 100;
  const dl = Math.abs(a.l - b.l) / 100;
  return dh * 0.78 + dl * 0.20 + ds * 0.02;
}

function generateCandidates(countHint) {
  const GOLDEN_ANGLE = 137.50776405003785;

  const hues = [];
  const baseN = Math.max(24, countHint);
  for (let i = 0; i < baseN; i += 1) {
    hues.push((i * GOLDEN_ANGLE) % 360);
  }

  const sats = [82, 70];
  const lights = [42, 56, 70];

  const candidates = [];
  for (const h of hues) {
    for (const s of sats) {
      for (const l of lights) {
        candidates.push({ h, s, l });
      }
    }
  }
  return candidates;
}

function decorateBlocksWithContrastingColors(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection') return geojson;

  const features = geojson.features || [];
  if (!features.length) return geojson;

  const names = features.map((f, idx) => {
    const p = f?.properties || {};
    const blockName = String(
      p.block ?? p.blockName ?? p.name ?? p.id ?? f.id ?? `Block-${idx + 1}`
    );
    return blockName;
  });

  const neighbors = buildAdjacency(features, 6);

  const order = [...features.keys()].sort((i, j) => {
    const di = neighbors[i].size;
    const dj = neighbors[j].size;
    if (dj !== di) return dj - di;
    return names[i].localeCompare(names[j], undefined, { numeric: true, sensitivity: 'base' });
  });

  const candidates = generateCandidates(features.length);
  const assigned = new Array(features.length).fill(null);
  const usedHex = new Set();

  for (const i of order) {
    let best = null;
    let bestScore = -Infinity;

    for (const cand of candidates) {
      const hex = hslToHex(cand.h, cand.s, cand.l);
      if (usedHex.has(hex)) continue;

      let hasNeighborColor = false;
      let minNeighborDist = Infinity;

      for (const nb of neighbors[i]) {
        const nbColor = assigned[nb];
        if (!nbColor) continue;
        hasNeighborColor = true;
        const d = colorDistanceHsl(cand, nbColor);
        if (d < minNeighborDist) minNeighborDist = d;
      }

      const score = hasNeighborColor ? minNeighborDist : 999;
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }

    if (!best) best = { h: (i * 47) % 360, s: 78, l: 55 };

    assigned[i] = best;
    usedHex.add(hslToHex(best.h, best.s, best.l));
  }

  return {
    ...geojson,
    features: features.map((f, idx) => {
      const props = f?.properties || {};
      const blockName = names[idx];
      const c = assigned[idx];
      const fillColor = hslToHex(c.h, c.s, c.l);

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
  const [blocksMeta, setBlocksMeta] = useState(null); // { AA2: {...}, ... }
  const [selectedBlockCode, setSelectedBlockCode] = useState(null);
  const [metaFilter, setMetaFilter] = useState('Semua');
  

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

      const decorated = decorateBlocksWithContrastingColors(geojson);

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

      // Selected halo (outline only for selected block)
      map.addLayer({
        id: 'blocks-selected-halo',
        type: 'line',
        source: 'estate-blocks',
        filter: ['==', ['get', 'blockName'], ''], // show nothing initially
        paint: {
          'line-color': '#d32f2f',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

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

        const code = String(block || '').trim().toUpperCase();
        setSelectedBlockCode(code);
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

  // Fetch blocks metadata once per estate
  useEffect(() => {
    let cancelled = false;
    setBlocksMeta(null);

    API.get(`/maps/${estateCode}/blocks-meta/`)
      .then((res) => {
        if (!cancelled) setBlocksMeta(res.data || {});
      })
      .catch((err) => {
        console.warn('[FarmMapPanel] blocks-meta fetch failed:', err);
        if (!cancelled) setBlocksMeta({});
      });

    return () => {
      cancelled = true;
    };
  }, [estateCode]);

  // Reset meta filter when selected block changes
  useEffect(() => {
    setMetaFilter('Semua');
  }, [selectedBlockCode]);

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

  // Update selected halo filter when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer('blocks-selected-halo')) return;
    const code = (selectedBlockCode || '').trim();
    map.setFilter('blocks-selected-halo', ['==', ['get', 'blockName'], code]);
  }, [selectedBlockCode]);

  // Build picker options from blocks
  const blockOptions = useMemo(() => {
    const feats = blocks?.features || [];
    return feats
      .map((f) => String(f?.properties?.blockName || f?.properties?.block || f?.properties?.name || '').trim())
      .filter(Boolean)
      .map((s) => s.toUpperCase())
      .sort();
  }, [blocks]);

  // Helpers for metadata rendering below the map
  const isNilLike = (v) => {
    if (v === null || v === undefined) return true;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return s === '' || s === 'null' || s === '-';
    }
    return false;
  };

  const normalizeKey = (k) => String(k || '').trim();

  const isNoKey = (k) => {
    const ku = normalizeKey(k).toUpperCase();
    return ku === 'NO' || ku === 'NO.' || ku === 'NOMOR';
  };

  const META_FILTER_ORDER = ['Semua', 'Ringkasan', 'Luas', 'Pokok', 'Infrastruktur', 'Lainnya'];

  const metaCategoryForKey = (k) => {
    const K = normalizeKey(k).toUpperCase();

    if (K.includes('TAHUN')) return 'Ringkasan';
    if (K.includes('POKOK') || K.includes('SPH')) return 'Pokok';
    if (K.includes('JALAN') || K.includes('JEMBATAN')) return 'Infrastruktur';
    if (K.includes('LUAS') || K.includes('HA')) return 'Luas';

    return 'Lainnya';
  };

  const normalizeYear = (v) => {
    if (v === null || v === undefined) return '';

    // Case A: numeric 2016 shown as "2.016" due to locale grouping
    if (typeof v === 'number' && Number.isFinite(v)) {
      // Case B: Excel sometimes ends up as 2.016 (meaning 2016)
      if (v > 0 && v < 10) {
        const candidate = Math.round(v * 1000);
        if (candidate >= 1900 && candidate <= 2100) return String(candidate);
      }

      const candidate = Math.round(v);
      if (candidate >= 1900 && candidate <= 2100) return String(candidate);
    }

    if (typeof v === 'string') {
      const s = v.trim();

      // "2.016" (as text) -> "2016"
      if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
        const noDots = s.replace(/\./g, '');
        if (/^\d{4}$/.test(noDots)) return noDots;
      }

      if (/^\d{4}$/.test(s)) return s;
      return s;
    }

    return String(v).trim();
  };

  const formatValue = (key, v) => {
    if (v === null || v === undefined) return '';

    const keyU = normalizeKey(key).toUpperCase();
    const isYearField = keyU.includes('TAHUN');

    if (isYearField) return normalizeYear(v);

    if (typeof v === 'number') {
      // keep decimals reasonable (area/jalan often has decimals)
      return v.toLocaleString('id-ID', { maximumFractionDigits: 2 });
    }

    if (typeof v === 'string') return v.trim();

    if (Array.isArray(v)) return v.filter((x) => !isNilLike(x)).join(', ');

    if (typeof v === 'object') return JSON.stringify(v);

    return String(v);
  };

  const selectedMeta =
    blocksMeta && selectedBlockCode ? blocksMeta[String(selectedBlockCode).toUpperCase()] : null;

  const selectedMetaEntries = useMemo(() => {
    if (!selectedMeta) return [];
    return Object.entries(selectedMeta).filter(([k, v]) => !isNilLike(v) && !isNoKey(k));
  }, [selectedMeta]);

  const availableMetaFilters = useMemo(() => {
    const cats = new Set();
    for (const [k] of selectedMetaEntries) cats.add(metaCategoryForKey(k));
    return META_FILTER_ORDER.filter((f) => f === 'Semua' || cats.has(f));
  }, [selectedMetaEntries]);

  const filteredMetaEntries = useMemo(() => {
    if (metaFilter === 'Semua') return selectedMetaEntries;
    return selectedMetaEntries.filter(([k]) => metaCategoryForKey(k) === metaFilter);
  }, [selectedMetaEntries, metaFilter]);

  const metaRowsForTable = useMemo(() => {
    // If filtered, just show rows (no category headers)
    if (metaFilter !== 'Semua') {
      return filteredMetaEntries.map(([k, v]) => ({ type: 'row', k, v }));
    }

    // Otherwise group by category with header rows
    const byCat = new Map();
    for (const [k, v] of selectedMetaEntries) {
      const cat = metaCategoryForKey(k);
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push([k, v]);
    }

    const rows = [];
    for (const cat of META_FILTER_ORDER.filter((x) => x !== 'Semua')) {
      const entries = byCat.get(cat);
      if (!entries || entries.length === 0) continue;

      entries.sort((a, b) =>
        String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true, sensitivity: 'base' })
      );

      rows.push({ type: 'header', label: cat });
      for (const [k, v] of entries) rows.push({ type: 'row', k, v });
    }

    return rows;
  }, [selectedMetaEntries, filteredMetaEntries, metaFilter]);

  const selectBlock = useCallback((code) => {
    if (!code) return;
    const normalized = String(code).trim().toUpperCase();
    setSelectedBlockCode(normalized);

    const map = mapRef.current;
    if (!map || !blocks?.features) return;
    const feature = blocks.features.find((f) => {
      const k = String(f?.properties?.blockName || f?.properties?.block || f?.properties?.name || '').trim().toUpperCase();
      return k === normalized;
    });
    const bbox = feature ? computeBbox(feature) : null;
    if (bbox) {
      map.fitBounds(
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[3]],
        ],
        { padding: 60, duration: 900 }
      );
    }
  }, [blocks]);

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
    <>
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

      {/* Controls row below the map */}
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 1 }}>
        <Autocomplete
          size="small"
          options={blockOptions}
          value={selectedBlockCode || null}
          onChange={(e, value) => {
            const code = value ? String(value).trim().toUpperCase() : null;
            setSelectedBlockCode(code);
          }}
          sx={{ minWidth: 240, flex: 1, maxWidth: 420 }}
          renderInput={(params) => <TextField {...params} label="Blok" placeholder="AA2" />}
        />

        <Button
          variant="contained"
          onClick={() => selectBlock(selectedBlockCode)}
          disabled={!selectedBlockCode}
        >
          Cari blok
        </Button>
      </Box>

      {/* Block meta info below controls */}
      <Paper
        variant="outlined"
        sx={{ mt: 1, p: 2, borderRadius: 2, maxHeight: 320, overflow: 'auto' }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {selectedBlockCode ? `Blok ${selectedBlockCode}` : 'Pilih blok'}
        </Typography>

        <Divider sx={{ my: 1 }} />

        {blocksMeta === null ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Memuat data blok…
          </Typography>
        ) : !selectedBlockCode ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Klik blok di peta atau gunakan “Cari blok”.
          </Typography>
        ) : !selectedMeta ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Data komposisi untuk blok ini tidak ditemukan.
          </Typography>
        ) : selectedMetaEntries.length === 0 ? (
          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Tidak ada data yang bisa ditampilkan.
          </Typography>
        ) : (
          <>
            {/* Filter chips */}
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
              {availableMetaFilters.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  size="small"
                  clickable
                  onClick={() => setMetaFilter(f)}
                  color={metaFilter === f ? 'primary' : 'default'}
                  variant={metaFilter === f ? 'filled' : 'outlined'}
                />
              ))}
            </Box>

            {/* Organized table */}
            <TableContainer>
              <Table size="small" aria-label="blok-meta">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Atribut</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Nilai</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {metaRowsForTable.map((item, idx) => {
                    if (item.type === 'header') {
                      return (
                        <TableRow key={`h-${item.label}-${idx}`}>
                          <TableCell
                            colSpan={2}
                            sx={{
                              fontWeight: 800,
                              opacity: 0.9,
                              bgcolor:
                                theme.palette.mode === 'dark'
                                  ? 'rgba(255,255,255,0.06)'
                                  : 'rgba(0,0,0,0.04)',
                            }}
                          >
                            {item.label}
                          </TableCell>
                        </TableRow>
                      );
                    }

                    return (
                      <TableRow key={`${item.k}-${idx}`} hover>
                        <TableCell
                          sx={{
                            width: '60%',
                            fontSize: 12,
                            color: 'text.secondary',
                            verticalAlign: 'top',
                            pr: 2,
                          }}
                        >
                          {item.k}
                        </TableCell>
                        <TableCell sx={{ width: '40%', fontSize: 13, verticalAlign: 'top' }}>
                          {formatValue(item.k, item.v)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>
    </>
  );
}
