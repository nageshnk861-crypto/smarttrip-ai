'use client';

import { useState, useCallback } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlaceResult {
  id: string;
  name: string;
  category: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  source: 'geojson' | 'overpass';
}

interface SearchResponse {
  success: boolean;
  category: string;
  count: number;
  overpassUsed: boolean;
  places: PlaceResult[];
  error?: string;
}

const CATEGORIES = ['temple', 'beach', 'attraction', 'viewpoint', 'cafe', 'hotel', 'museum'] as const;

const CATEGORY_ICONS: Record<string, string> = {
  temple: '🛕',
  beach: '🏖️',
  attraction: '🏛️',
  viewpoint: '🌄',
  cafe: '☕',
  hotel: '🏨',
  museum: '🏛️',
};

const POPULAR_COORDS = [
  { label: 'Bengaluru', lat: 12.9716, lng: 77.5946 },
  { label: 'Mumbai', lat: 19.076, lng: 72.8777 },
  { label: 'Delhi', lat: 28.6139, lng: 77.209 },
  { label: 'Chennai', lat: 13.0827, lng: 80.2707 },
  { label: 'Goa', lat: 15.2993, lng: 74.124 },
  { label: 'Jaipur', lat: 26.9124, lng: 75.7873 },
  { label: 'Kolkata', lat: 22.5726, lng: 88.3639 },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlacesExplorerPage() {
  const [latitude, setLatitude] = useState('12.9716');
  const [longitude, setLongitude] = useState('77.5946');
  const [category, setCategory] = useState<string>('temple');
  const [radius, setRadius] = useState('10000');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        category,
        latitude,
        longitude,
        radius,
      });

      const res = await fetch(`/api/attractions/search?${params.toString()}`);
      const data: SearchResponse = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? `Server error (${res.status})`);
      } else {
        setResult(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error – is the backend running?');
    } finally {
      setLoading(false);
    }
  }, [category, latitude, longitude, radius]);

  const applyPreset = (lat: number, lng: number) => {
    setLatitude(String(lat));
    setLongitude(String(lng));
  };

  return (
    <div style={styles.page}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <h1 style={styles.title}>🗺️ SmartTrip Places Explorer</h1>
          <p style={styles.subtitle}>
            Phase 2 · GeoJSON + Overpass API Test UI
          </p>
        </div>
      </div>

      <div style={styles.body}>
        {/* ── Search Panel ─────────────────────────────────────────────── */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Search Places</h2>

          {/* City presets */}
          <div style={styles.presetRow}>
            {POPULAR_COORDS.map((c) => (
              <button
                key={c.label}
                style={styles.presetBtn}
                onClick={() => applyPreset(c.lat, c.lng)}
                title={`Set coords to ${c.label}`}
              >
                📍 {c.label}
              </button>
            ))}
          </div>

          {/* Form grid */}
          <div style={styles.formGrid}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Latitude</label>
              <input
                id="places-latitude"
                type="number"
                step="0.0001"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                style={styles.input}
                placeholder="e.g. 12.9716"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Longitude</label>
              <input
                id="places-longitude"
                type="number"
                step="0.0001"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                style={styles.input}
                placeholder="e.g. 77.5946"
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Category</label>
              <select
                id="places-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={styles.select}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_ICONS[c]} {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Radius (metres)</label>
              <input
                id="places-radius"
                type="number"
                step="500"
                min="500"
                max="100000"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                style={styles.input}
                placeholder="e.g. 10000"
              />
            </div>
          </div>

          <button
            id="places-search-btn"
            onClick={handleSearch}
            disabled={loading}
            style={{ ...styles.searchBtn, ...(loading ? styles.searchBtnDisabled : {}) }}
          >
            {loading ? '⏳ Searching…' : '🔍 Search Places'}
          </button>
        </div>

        {/* ── Error ────────────────────────────────────────────────────── */}
        {error && (
          <div style={styles.errorBox}>
            <strong>❌ Error:</strong> {error}
          </div>
        )}

        {/* ── Results ──────────────────────────────────────────────────── */}
        {result && (
          <div style={styles.card}>
            {/* Summary bar */}
            <div style={styles.resultHeader}>
              <div>
                <span style={styles.countBadge}>{result.count}</span>
                <span style={styles.resultLabel}>
                  {CATEGORY_ICONS[result.category]} {result.category}s found
                </span>
              </div>
              <div style={styles.sourceBadges}>
                <span style={styles.geoJsonBadge}>📁 GeoJSON</span>
                {result.overpassUsed && (
                  <span style={styles.overpassBadge}>🌐 Overpass</span>
                )}
                {!result.overpassUsed && (
                  <span style={styles.fallbackBadge}>⚠️ GeoJSON fallback</span>
                )}
              </div>
            </div>

            {result.places.length === 0 ? (
              <p style={styles.noResults}>No places found for the given coordinates and radius.</p>
            ) : (
              <div style={styles.tableWrapper}>
                <table style={styles.table}>
                  <thead>
                    <tr style={styles.thead}>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>City</th>
                      <th style={styles.th}>State</th>
                      <th style={styles.th}>Distance</th>
                      <th style={styles.th}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.places.map((place, idx) => (
                      <tr
                        key={place.id}
                        style={{
                          ...styles.tr,
                          backgroundColor: idx % 2 === 0 ? '#0f172a' : '#0a0f1e',
                        }}
                      >
                        <td style={{ ...styles.td, ...styles.tdNum }}>{idx + 1}</td>
                        <td style={{ ...styles.td, ...styles.tdName }}>
                          <span style={styles.placeIcon}>{CATEGORY_ICONS[place.category]}</span>
                          {place.name}
                        </td>
                        <td style={styles.td}>{place.city || '—'}</td>
                        <td style={styles.td}>{place.state || '—'}</td>
                        <td style={{ ...styles.td, ...styles.tdDist }}>
                          {place.distanceKm != null ? `${place.distanceKm} km` : '—'}
                        </td>
                        <td style={styles.td}>
                          <span
                            style={
                              place.source === 'overpass'
                                ? styles.overpassTag
                                : styles.geojsonTag
                            }
                          >
                            {place.source === 'overpass' ? '🌐 Overpass' : '📁 GeoJSON'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline styles (no Tailwind needed for a test page) ────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    backgroundColor: '#030712',
    color: '#e2e8f0',
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
  },
  header: {
    background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 50%, #064e3b 100%)',
    borderBottom: '1px solid rgba(99,102,241,0.3)',
    padding: '32px 24px',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    margin: 0,
    background: 'linear-gradient(90deg, #a5b4fc, #6ee7b7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#94a3b8',
  },
  body: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '32px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  card: {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(99,102,241,0.2)',
    borderRadius: 16,
    padding: 28,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 600,
    marginTop: 0,
    marginBottom: 20,
    color: '#c7d2fe',
  },
  presetRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 8,
    marginBottom: 20,
  },
  presetBtn: {
    padding: '6px 14px',
    borderRadius: 9999,
    border: '1px solid rgba(99,102,241,0.3)',
    backgroundColor: 'rgba(99,102,241,0.1)',
    color: '#a5b4fc',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 24,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#94a3b8',
  },
  input: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(99,102,241,0.3)',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
  },
  select: {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid rgba(99,102,241,0.3)',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    cursor: 'pointer',
  },
  searchBtn: {
    padding: '12px 32px',
    borderRadius: 12,
    border: 'none',
    background: 'linear-gradient(135deg, #6366f1, #10b981)',
    color: '#fff',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s',
    width: '100%',
  },
  searchBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: 12,
    padding: '16px 20px',
    color: '#fca5a5',
    fontSize: 14,
  },
  resultHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  countBadge: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #6366f1, #10b981)',
    borderRadius: 9999,
    padding: '2px 12px',
    fontSize: 14,
    fontWeight: 700,
    marginRight: 10,
  },
  resultLabel: {
    fontSize: 16,
    fontWeight: 600,
    color: '#c7d2fe',
  },
  sourceBadges: {
    display: 'flex',
    gap: 8,
  },
  geoJsonBadge: {
    padding: '4px 12px',
    borderRadius: 9999,
    backgroundColor: 'rgba(34,197,94,0.15)',
    border: '1px solid rgba(34,197,94,0.3)',
    color: '#86efac',
    fontSize: 12,
  },
  overpassBadge: {
    padding: '4px 12px',
    borderRadius: 9999,
    backgroundColor: 'rgba(99,102,241,0.15)',
    border: '1px solid rgba(99,102,241,0.3)',
    color: '#a5b4fc',
    fontSize: 12,
  },
  fallbackBadge: {
    padding: '4px 12px',
    borderRadius: 9999,
    backgroundColor: 'rgba(245,158,11,0.15)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#fcd34d',
    fontSize: 12,
  },
  noResults: {
    color: '#64748b',
    textAlign: 'center' as const,
    padding: 32,
  },
  tableWrapper: {
    overflowX: 'auto' as const,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: 14,
  },
  thead: {
    backgroundColor: '#1e293b',
  },
  th: {
    padding: '12px 14px',
    textAlign: 'left' as const,
    fontSize: 12,
    fontWeight: 600,
    color: '#94a3b8',
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    borderBottom: '1px solid rgba(99,102,241,0.2)',
  },
  tr: {
    borderBottom: '1px solid rgba(255,255,255,0.04)',
  },
  td: {
    padding: '11px 14px',
    color: '#cbd5e1',
    verticalAlign: 'middle' as const,
  },
  tdNum: {
    color: '#64748b',
    width: 40,
  },
  tdName: {
    fontWeight: 500,
    color: '#e2e8f0',
  },
  tdDist: {
    color: '#6ee7b7',
    fontWeight: 600,
  },
  placeIcon: {
    marginRight: 8,
  },
  overpassTag: {
    padding: '3px 10px',
    borderRadius: 9999,
    backgroundColor: 'rgba(99,102,241,0.15)',
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: 500,
  },
  geojsonTag: {
    padding: '3px 10px',
    borderRadius: 9999,
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#86efac',
    fontSize: 12,
    fontWeight: 500,
  },
};
