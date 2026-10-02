'use client';

/**
 * StartingLocationInput
 *
 * Handles the starting-location field with two input modes:
 *   1. Manual text entry — user types any city/town/region.
 *   2. Browser geolocation — user clicks "Use my current location",
 *      browser GPS fires, result is reverse-geocoded via /api/places/reverse-geocode.
 *
 * CONTRACT:
 * - NEVER defaults to Bangalore or any hardcoded city.
 * - Geolocation is NEVER attempted automatically — only on explicit button click.
 * - On PERMISSION_DENIED the field stays fully editable (planner must not break).
 * - All four GeolocationPositionError codes get separate user-friendly messages.
 * - While detecting, duplicate requests are blocked (button disabled).
 */

import { useCallback, useId, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Geolocation detection lifecycle states. */
export type GeoStatus =
  | 'idle'                  // initial — no attempt made yet
  | 'detecting'             // waiting for browser permission / GPS fix / reverse geocode
  | 'detected'              // success — name + coords resolved
  | 'denied'                // GeolocationPositionError code 1: PERMISSION_DENIED
  | 'position_unavailable'  // GeolocationPositionError code 2: POSITION_UNAVAILABLE
  | 'timeout'               // GeolocationPositionError code 3: TIMEOUT
  | 'unavailable'           // browser unsupported or unexpected failure
  | 'manual';               // user typed / edited manually

/** The resolved starting location handed back to the parent. */
export type OriginLocation = {
  /** Human-readable name shown in the field and sent to the API as `origin`. */
  name: string;
  /** Present when resolved via browser GPS + reverse geocode. */
  latitude?: number;
  /** Present when resolved via browser GPS + reverse geocode. */
  longitude?: number;
  /**
   * 'browser-geolocation' → coordinates came from navigator.geolocation.
   * 'manual' → user typed the name; no coordinates resolved client-side.
   */
  source: 'browser-geolocation' | 'manual';
};

type StartingLocationInputProps = {
  /** Current resolved origin, controlled by the parent. */
  value: OriginLocation;
  /** Called whenever the user changes the field (type or geo-detect). */
  onChange: (next: OriginLocation) => void;
  /** Optional initial geo status (e.g. 'manual' when a prompt pre-filled the field). */
  initialGeoStatus?: GeoStatus;
};

// ─── Reverse-geocode helper ───────────────────────────────────────────────────

/** Calls the server-side Nominatim reverse-geocode endpoint. */
async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<{ name: string; city?: string; state?: string; country?: string } | null> {
  try {
    const res = await fetch(`/api/places/reverse-geocode?lat=${lat}&lng=${lng}`);
    if (!res.ok) return null;
    return (await res.json()) as {
      name: string;
      city?: string;
      state?: string;
      country?: string;
    };
  } catch {
    return null;
  }
}

/** Fallback to server-side IP geolocation when browser GPS is blocked, denied, or unavailable. */
async function fetchIpLocation(): Promise<{ name: string; latitude?: number; longitude?: number } | null> {
  try {
    const res = await fetch('/api/places/ip-location');
    if (!res.ok) return null;
    return (await res.json()) as { name: string; latitude?: number; longitude?: number };
  } catch {
    return null;
  }
}

// ─── Status message map ───────────────────────────────────────────────────────

type StatusDisplay = {
  icon: string;
  text: string;
  color: string;
  /** When true, the manual input should remain fully interactive. */
  keepInputEnabled: boolean;
};

function getStatusDisplay(status: GeoStatus): StatusDisplay | null {
  switch (status) {
    case 'detecting':
      return {
        icon: '⏳',
        text: 'Detecting your location…',
        color: '#2563eb',
        keepInputEnabled: false, // disable field while GPS fires
      };

    case 'detected':
      return {
        icon: '✓',
        text: 'Current location detected. You can edit it below if needed.',
        color: '#16a34a',
        keepInputEnabled: true,
      };

    case 'denied':
      return {
        icon: '⚠️',
        text: 'Location permission was denied. Enter your starting city manually, or allow location access in your browser settings.',
        color: '#dc2626',
        keepInputEnabled: true,
      };

    case 'position_unavailable':
      return {
        icon: '⚠️',
        text: 'Your location could not be determined. Please enter your starting city manually.',
        color: '#f59e0b',
        keepInputEnabled: true,
      };

    case 'timeout':
      return {
        icon: '⚠️',
        text: 'Location detection timed out. Please enter your starting city manually or try again.',
        color: '#f59e0b',
        keepInputEnabled: true,
      };

    case 'unavailable':
      return {
        icon: '⚠️',
        text: 'Location detection is not available in this browser. Please enter your starting city manually.',
        color: '#f59e0b',
        keepInputEnabled: true,
      };

    case 'idle':
    case 'manual':
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StartingLocationInput({
  value,
  onChange,
  initialGeoStatus = 'idle',
}: StartingLocationInputProps) {
  const [geoStatus, setGeoStatus] = useState<GeoStatus>(initialGeoStatus);
  const statusId = useId();
  // Prevent simultaneous detection requests.
  const detectingRef = useRef(false);

  // ── Geolocation handler ───────────────────────────────────────────────────

  const detectLocation = useCallback(async () => {
    // Block duplicate in-flight requests.
    if (detectingRef.current) return;
    if (typeof window === 'undefined') return;

    detectingRef.current = true;
    setGeoStatus('detecting');

    if (!navigator?.geolocation) {
      // Fallback to IP geolocation if navigator.geolocation is unsupported
      const ipResult = await fetchIpLocation();
      detectingRef.current = false;
      if (ipResult?.name) {
        onChange({
          name: ipResult.name,
          latitude: ipResult.latitude,
          longitude: ipResult.longitude,
          source: 'browser-geolocation',
        });
        setGeoStatus('detected');
      } else {
        setGeoStatus('unavailable');
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      // ── Success ─────────────────────────────────────────────────────────
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await reverseGeocode(latitude, longitude);

          if (result?.name) {
            onChange({
              name: result.name,
              latitude,
              longitude,
              source: 'browser-geolocation',
            });
            setGeoStatus('detected');
            detectingRef.current = false;
            return;
          }
        } catch {
          // fall through to IP fallback below
        }

        // If reverse-geocoding the GPS coordinates yielded no name, try IP location
        const ipResult = await fetchIpLocation();
        detectingRef.current = false;
        if (ipResult?.name) {
          onChange({
            name: ipResult.name,
            latitude: ipResult.latitude,
            longitude: ipResult.longitude,
            source: 'browser-geolocation',
          });
          setGeoStatus('detected');
        } else {
          setGeoStatus('position_unavailable');
        }
      },

      // ── Error ────────────────────────────────────────────────────────────
      async (err: GeolocationPositionError) => {
        // Fallback to IP-based location before displaying an error
        try {
          const ipResult = await fetchIpLocation();
          if (ipResult?.name) {
            onChange({
              name: ipResult.name,
              latitude: ipResult.latitude,
              longitude: ipResult.longitude,
              source: 'browser-geolocation',
            });
            setGeoStatus('detected');
            detectingRef.current = false;
            return;
          }
        } catch {
          // IP fallback failed, display appropriate error
        }

        detectingRef.current = false;

        switch (err.code) {
          case 1: // PERMISSION_DENIED
            setGeoStatus('denied');
            break;
          case 2: // POSITION_UNAVAILABLE
            setGeoStatus('position_unavailable');
            break;
          case 3: // TIMEOUT
            setGeoStatus('timeout');
            break;
          default:
            setGeoStatus('unavailable');
            break;
        }
      },

      { enableHighAccuracy: true, timeout: 8_000, maximumAge: 300_000 },
    );
  }, [onChange]);

  // ── Derived state ─────────────────────────────────────────────────────────

  const statusDisplay = getStatusDisplay(geoStatus);
  const isDetecting = geoStatus === 'detecting';
  // The input is disabled ONLY while detection is actively running.
  const inputDisabled = isDetecting;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="form-group">
      <label className="form-label" htmlFor="startingLocation">
        Starting location
      </label>

      {/* Text input */}
      <input
        id="startingLocation"
        type="text"
        className="form-input"
        placeholder={isDetecting ? 'Detecting current location…' : 'Enter your city or town'}
        value={value.name}
        disabled={inputDisabled}
        aria-describedby={statusDisplay ? statusId : undefined}
        onChange={(e) => {
          const name = e.target.value;
          onChange({ name, latitude: undefined, longitude: undefined, source: 'manual' });
          // Transition to manual so we don't show stale geo status.
          if (geoStatus !== 'idle') setGeoStatus('manual');
        }}
      />

      {/* Status message */}
      {statusDisplay && (
        <span
          id={statusId}
          className="input-help"
          role={statusDisplay.keepInputEnabled ? 'alert' : 'status'}
          aria-live={statusDisplay.keepInputEnabled ? 'assertive' : 'polite'}
          style={{
            color: statusDisplay.color,
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.35rem',
            marginTop: '0.35rem',
          }}
        >
          {statusDisplay.text}
        </span>
      )}

      {/* Default help text when no geo status is active */}
      {!statusDisplay && (
        <span className="input-help">Where will your journey start?</span>
      )}

      {/* "Use my current location" button — always visible, disabled only while detecting */}
      <button
        type="button"
        onClick={() => void detectLocation()}
        disabled={isDetecting}
        aria-label={isDetecting ? 'Detecting current location…' : 'Use my current location'}
        style={{
          marginTop: '0.5rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          color: isDetecting ? '#94a3b8' : '#2563eb',
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: isDetecting ? 'not-allowed' : 'pointer',
          textDecorationLine: isDetecting ? 'none' : 'underline',
          textDecorationColor: 'transparent',
          transition: 'color 0.15s, text-decoration-color 0.15s',
        }}
        onMouseEnter={(e) => {
          if (!isDetecting) {
            (e.currentTarget as HTMLButtonElement).style.textDecorationColor = '#2563eb';
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.textDecorationColor = 'transparent';
        }}
      >
        <span aria-hidden="true">📍</span>
        {isDetecting ? 'Detecting current location…' : 'Use my current location'}
      </button>
    </div>
  );
}
