// File: src/pages/FarmNavigationPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Paper, Typography, Alert, CircularProgress } from '@mui/material';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import API from '../services/api';

const MAX_DISTANCE_M = 5000;

// Minimal raster basemap style (OpenStreetMap raster tiles).
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
    { id: 'background', type: 'background', paint: { 'background-color': '#e9eef6' } },
    { id: 'osm', type: 'raster', source: 'osm' },
  ],
};

function computeBbox(geojson) {
  // Returns [minLng, minLat, maxLng, maxLat]
  if (!geojson) return null;

  const points = [];
  const walk = (node) => {
    if (!node) return;
    if (
      Array.isArray(node) &&
      node.length >= 2 &&
      typeof node[0] === 'number' &&
      typeof node[1] === 'number'
    ) {
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

  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function haversineMeters(lng1, lat1, lng2, lat2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lng2 - lng1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function destinationPoint(lng, lat, bearingDeg, distanceM) {
  // Spherical Earth destination formula
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  const δ = distanceM / R;
  const θ = toRad(bearingDeg);

  const φ1 = toRad(lat);
  const λ1 = toRad(lng);

  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);

  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);

  const y = Math.sin(θ) * sinδ * cosφ1;
  const x = cosδ - sinφ1 * sinφ2;
  const λ2 = λ1 + Math.atan2(y, x);

  // normalize lon to [-180, 180]
  const lon = ((toDeg(λ2) + 540) % 360) - 180;
  const lat2 = toDeg(φ2);

  return [lon, lat2];
}

function circlePolygonCoords(lng, lat, radiusM, steps = 64) {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    const b = (i * 360) / steps;
    coords.push(destinationPoint(lng, lat, b, radiusM));
  }
  return coords;
}

// ---- Block color decoration (copied pattern from FarmMapPanel.withBlocks.jsx) ----
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => {
    const hex = Math.round(255 * x).toString(16).padStart(2, '0');
    return hex;
  };
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function colorDistanceHsl(a, b) {
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h)) / 180;
  const ds = Math.abs(a.s - b.s) / 100;
  const dl = Math.abs(a.l - b.l) / 100;
  return dh * 1.7 + ds * 0.7 + dl * 1.0;
}

function featureCentroidApprox(feature) {
  // bbox center is enough for adjacency + selection
  const bbox = computeBbox(feature);
  if (!bbox) return null;
  return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
}

function buildAdjacency(features, kNearest = 6) {
  const centers = features.map((f) => featureCentroidApprox(f));
  const neighbors = features.map(() => new Set());

  for (let i = 0; i < features.length; i++) {
    const ci = centers[i];
    if (!ci) continue;

    const dists = [];
    for (let j = 0; j < features.length; j++) {
      if (i === j) continue;
      const cj = centers[j];
      if (!cj) continue;
      const dx = ci[0] - cj[0];
      const dy = ci[1] - cj[1];
      const d2 = dx * dx + dy * dy;
      dists.push([d2, j]);
    }
    dists.sort((a, b) => a[0] - b[0]);
    for (const [, j] of dists.slice(0, kNearest)) {
      neighbors[i].add(j);
      neighbors[j].add(i);
    }
  }

  return neighbors;
}

function generateCandidates(n) {
  // fixed palette of HSL candidates, enough to avoid repeats
  const candidates = [];
  const hues = [];
  const golden = 137.508; // golden angle
  for (let i = 0; i < Math.max(n * 3, 80); i++) hues.push((i * golden) % 360);

  const sVals = [76, 82, 70];
  const lVals = [56, 50, 62];

  for (const h of hues) {
    for (const s of sVals) {
      for (const l of lVals) candidates.push({ h, s, l });
    }
  }
  return candidates;
}

function decorateBlocksWithContrastingColors(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection') return geojson;
  const features = geojson.features || [];
  if (features.length === 0) return geojson;

  const names = features.map((f, idx) => {
    const p = f?.properties || {};
    const blockName = String(p.block ?? p.blockName ?? p.name ?? p.id ?? f.id ?? `Block-${idx + 1}`);
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
      return {
        ...f,
        properties: {
          ...props,
          blockName,
          fillColor: hslToHex(c.h, c.s, c.l),
        },
      };
    }),
  };
}

export default function FarmNavigationPage() {
  const { estateCode } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);

  const [outline, setOutline] = useState(null);
  const [blocks, setBlocks] = useState(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [mapError, setMapError] = useState('');

  const [selectedBlockCode, setSelectedBlockCode] = useState('');
  const [userPos, setUserPos] = useState(null);
  const [geoError, setGeoError] = useState('');
  const [distanceM, setDistanceM] = useState(null);
  const [tooFar, setTooFar] = useState(false);
  const [hasAutoCentered, setHasAutoCentered] = useState(false);

  const initialBlockParam = useMemo(() => {
    const sp = new URLSearchParams(location.search || '');
    const b = (sp.get('block') || '').trim().toUpperCase();
    return b || '';
  }, [location.search]);

  // lock body scroll while this fullscreen page is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Require auth token (optional but recommended)
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) navigate('/login');
  }, [navigate]);

  const estateCenter = useMemo(() => {
    const bbox = computeBbox(outline);
    if (!bbox) return null;
    return [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2];
  }, [outline]);

  const fitToOutline = useCallback(() => {
    const map = mapRef.current;
    if (!map || !outline) return;
    const bbox = computeBbox(outline);
    if (!bbox) return;
    map.fitBounds(
      [
        [bbox[0], bbox[1]],
        [bbox[2], bbox[3]],
      ],
      { padding: 60, duration: 800 }
    );
  }, [outline]);

  const ensureBlocksLayers = useCallback((map, geojson) => {
    if (!map || !geojson) return;

    const decorated = decorateBlocksWithContrastingColors(geojson);

    const src = map.getSource('estate-blocks');
    if (src) {
      src.setData(decorated);
      return;
    }

    map.addSource('estate-blocks', { type: 'geojson', data: decorated });

    map.addLayer(
      {
        id: 'blocks-fill',
        type: 'fill',
        source: 'estate-blocks',
        paint: {
          'fill-color': ['coalesce', ['get', 'fillColor'], '#9e9e9e'],
          'fill-opacity': 0.45,
        },
      },
      'estate-line'
    );

    // Selected halo (red)
    map.addLayer({
      id: 'blocks-selected-halo',
      type: 'line',
      source: 'estate-blocks',
      filter: ['==', ['get', 'blockName'], ''],
      paint: { 'line-color': '#d32f2f', 'line-width': 4, 'line-opacity': 0.95 },
    });

    map.on('mouseenter', 'blocks-fill', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'blocks-fill', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('click', 'blocks-fill', (e) => {
      const feature = e?.features?.[0];
      const block = feature?.properties?.blockName || feature?.properties?.block || feature?.properties?.name || 'Blok';

      // popup label
      if (popupRef.current) {
        try { popupRef.current.remove(); } catch {}
        popupRef.current = null;
      }
      popupRef.current = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
        .setLngLat(e.lngLat)
        .setHTML(`<div style="font-weight:700">${String(block)}</div>`)
        .addTo(map);

      setSelectedBlockCode(String(block || '').trim().toUpperCase());
    });
  }, []);

  const selectBlockAndZoom = useCallback(
    (code) => {
      const map = mapRef.current;
      if (!map || !blocks?.features || !code) return;

      const normalized = String(code).trim().toUpperCase();
      setSelectedBlockCode(normalized);

      const feature = blocks.features.find((f) => {
        const k = String(f?.properties?.blockName || f?.properties?.block || f?.properties?.name || '')
          .trim()
          .toUpperCase();
        return k === normalized;
      });

      const bbox = feature ? computeBbox(feature) : null;
      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 120, duration: 900 }
        );
      }
    },
    [blocks]
  );

  // Fetch outline + blocks
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoadingMap(true);
        setMapError('');

        const [o, b] = await Promise.all([
          API.get(`/maps/${estateCode}/outline/`),
          API.get(`/maps/${estateCode}/blocks/`).catch(() => ({ data: null })),
        ]);

        if (!alive) return;

        setOutline(o.data);
        setBlocks(b.data);
      } catch (e) {
        console.error('[FarmNavigationPage] failed to load map:', e);
        if (!alive) return;
        setMapError('Gagal memuat peta kebun.');
      } finally {
        if (!alive) return;
        setLoadingMap(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [estateCode]);

  // Build map
  useEffect(() => {
    if (!containerRef.current || !outline) return;

    if (mapRef.current) {
      try { mapRef.current.remove(); } catch {}
      mapRef.current = null;
    }

    const bbox = computeBbox(outline);
    const center = bbox ? [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2] : [102.216, 0.27];

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OSM_RASTER_STYLE,
      center,
      zoom: 13,
      pitch: 0,
      bearing: 0,
      antialias: true,
    });
    mapRef.current = map;

    map.on('error', (e) => console.error('[MapLibre error]', e?.error || e));
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');

    map.on('load', () => {
      map.addSource('estate-outline', { type: 'geojson', data: outline });

      map.addLayer({
        id: 'estate-line',
        type: 'line',
        source: 'estate-outline',
        paint: { 'line-color': '#000', 'line-width': 2.5 },
      });

      // user sources (empty first)
      map.addSource('user-point', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      map.addSource('user-accuracy', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });

      map.addLayer({
        id: 'user-accuracy-fill',
        type: 'fill',
        source: 'user-accuracy',
        paint: { 'fill-color': '#1976d2', 'fill-opacity': 0.12 },
      });

      map.addLayer({
        id: 'user-dot',
        type: 'circle',
        source: 'user-point',
        paint: {
          'circle-radius': 7,
          'circle-color': '#1976d2',
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 2,
        },
      });

      if (blocks) {
        try { ensureBlocksLayers(map, blocks); } catch (e) { console.warn('blocks add failed', e); }
      }

      // start at estate
      if (bbox) {
        map.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding: 60, duration: 0 }
        );
      }
      try { map.resize(); } catch {}
    });

    return () => {
      if (popupRef.current) {
        try { popupRef.current.remove(); } catch {}
        popupRef.current = null;
      }
      try { map.remove(); } catch {}
      mapRef.current = null;
    };
  }, [outline, blocks, ensureBlocksLayers]);

  // Apply blocks if loaded after map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !blocks) return;
    const apply = () => {
      try { ensureBlocksLayers(map, blocks); } catch {}
    };
    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [blocks, ensureBlocksLayers]);

  // Update selected halo filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.getLayer('blocks-selected-halo')) return;
    map.setFilter('blocks-selected-halo', ['==', ['get', 'blockName'], (selectedBlockCode || '').trim()]);
  }, [selectedBlockCode]);

  // If we came here with ?block=AA2, auto-zoom to it once blocks are available
  useEffect(() => {
    if (!initialBlockParam) return;
    if (!blocks) return;
    // only run once
    setSelectedBlockCode((prev) => prev || initialBlockParam);
    selectBlockAndZoom(initialBlockParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBlockParam, blocks]);

  // Geolocation watch (Option A)
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoError('Perangkat/browser tidak mendukung Geolocation.');
      return;
    }

    let watchId = null;

    const ok = (pos) => {
      setGeoError('');
      setUserPos({
        lng: pos.coords.longitude,
        lat: pos.coords.latitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    };

    const err = (e) => {
      // e.code: 1 permission denied, 2 unavailable, 3 timeout
      setGeoError(e?.message || 'Gagal membaca lokasi.');
    };

    watchId = navigator.geolocation.watchPosition(ok, err, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 12000,
    });

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, []);

  // Push user marker + accuracy circle into the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;

    const apply = () => {
      const pt = {
        type: 'FeatureCollection',
        features: [
          { type: 'Feature', geometry: { type: 'Point', coordinates: [userPos.lng, userPos.lat] }, properties: {} },
        ],
      };

      const ptSrc = map.getSource('user-point');
      if (ptSrc) ptSrc.setData(pt);

      const acc = Number(userPos.accuracy);
      const accSrc = map.getSource('user-accuracy');
      if (accSrc) {
        if (Number.isFinite(acc) && acc > 0) {
          const radius = Math.min(acc, 600); // cap for sanity
          const coords = circlePolygonCoords(userPos.lng, userPos.lat, radius, 64);
          accSrc.setData({
            type: 'FeatureCollection',
            features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] }, properties: { radius } }],
          });
        } else {
          accSrc.setData({ type: 'FeatureCollection', features: [] });
        }
      }
    };

    if (map.isStyleLoaded()) apply();
    else map.once('load', apply);
  }, [userPos]);

  // Compute distance to estate center -> show "too far"
  useEffect(() => {
    if (!userPos || !estateCenter) return;
    const d = haversineMeters(userPos.lng, userPos.lat, estateCenter[0], estateCenter[1]);
    setDistanceM(d);
    setTooFar(d > MAX_DISTANCE_M);
  }, [userPos, estateCenter]);

  // Auto-center to user once (only if within radius)
  useEffect(() => {
    if (!userPos || !estateCenter || hasAutoCentered) return;
    if (tooFar) return;

    const map = mapRef.current;
    if (!map) return;

    try {
      map.easeTo({ center: [userPos.lng, userPos.lat], zoom: 16, duration: 900 });
      setHasAutoCentered(true);
    } catch {}
  }, [userPos, estateCenter, tooFar, hasAutoCentered]);

  const centerOnUser = useCallback(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    map.easeTo({ center: [userPos.lng, userPos.lat], zoom: 16, duration: 800 });
  }, [userPos]);

  // Resize on viewport changes
  useEffect(() => {
    const onResize = () => {
      try { mapRef.current?.resize(); } catch {}
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <Box sx={{ position: 'fixed', inset: 0, background: '#000' }}>
      <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />

      {/* Top-left controls */}
      <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" variant="contained" onClick={() => navigate(-1)}>
          Kembali
        </Button>
        <Button size="small" variant="outlined" onClick={fitToOutline} disabled={!outline}>
          Ke kebun
        </Button>
        <Button size="small" variant="outlined" onClick={centerOnUser} disabled={!userPos}>
          Ke saya
        </Button>
      </Box>

      {/* Bottom info */}
      <Paper
        elevation={3}
        sx={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          zIndex: 10,
          p: 1.25,
          borderRadius: 2,
          maxWidth: 760,
          mx: 'auto',
          backgroundColor: 'rgba(255,255,255,0.86)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Navigasi — {String(estateCode || '').toUpperCase()}
          {selectedBlockCode ? ` • Target: ${selectedBlockCode}` : ''}
        </Typography>

        {loadingMap && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <CircularProgress size={18} />
            <Typography variant="body2">Memuat peta…</Typography>
          </Box>
        )}

        {!!mapError && <Alert severity="error" sx={{ mt: 1 }}>{mapError}</Alert>}
        {!!geoError && <Alert severity="warning" sx={{ mt: 1 }}>{geoError}</Alert>}

        {distanceM != null && (
          <Typography variant="body2" sx={{ mt: 0.75 }}>
            Jarak ke kebun: <b>{(distanceM / 1000).toFixed(2)} km</b>
          </Typography>
        )}

        {tooFar && (
          <Alert severity="error" sx={{ mt: 1 }}>
            Anda berada di luar radius 5 km dari kebun. Navigasi hanya tersedia jika Anda lebih dekat.
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
