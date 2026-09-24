'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/** [south, north, west, east] bounding box in decimal degrees. */
export type BoundingBox = [number, number, number, number];

export type PlaceSuggestion = {
  place_id: string;
  description: string;
  name?: string;
  displayName?: string;
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  country?: string;
  countryCode?: string;
  /** Raw OSM type: 'node' | 'way' | 'relation'. */
  osmType?: string;
  /** Geographic bounding box — present for regions/countries. */
  boundingBox?: BoundingBox;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  matched_substrings?: Array<{ length: number; offset: number }>;
};

export type PlaceDetails = PlaceSuggestion & {
  formatted_address?: string;
  latitude?: number;
  longitude?: number;
};

type DestinationSearchProps = {
  value: string;
  onPlaceSelect: (place: PlaceDetails | null) => void;
  placeholder?: string;
};

export function DestinationSearch({
  value,
  onPlaceSelect,
  placeholder = 'Search destination...',
}: DestinationSearchProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [open, setOpen] = useState(false);
  // Track whether the current query came from a user selection (not user typing).
  // When true, we suppress the search so selecting a place doesn't re-trigger a fetch.
  const suppressNextSearch = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync external value changes (e.g. parent resets the field).
  useEffect(() => {
    if (value !== query) {
      suppressNextSearch.current = true;
      setQuery(value);
      setSuggestions([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
    }
    // We intentionally only react to `value` changes, not `query`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close dropdown on outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search — fires 300 ms after the user stops typing.
  useEffect(() => {
    if (suppressNextSearch.current) {
      suppressNextSearch.current = false;
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false);
      setSearchError('');
      return;
    }

    const timer = window.setTimeout(async () => {
      // Cancel any in-flight request.
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setSearchError('');

      try {
        const response = await fetch(
          `/api/places/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setSearchError('Place search is temporarily unavailable.');
          setSuggestions([]);
          setOpen(true);
          return;
        }

        const data = (await response.json()) as { results?: PlaceSuggestion[]; error?: string };

        if (data.error) {
          setSearchError(data.error);
          setSuggestions([]);
        } else {
          setSuggestions(data.results ?? []);
          setSearchError('');
        }
        setOpen(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setSearchError('Place search is temporarily unavailable.');
        setSuggestions([]);
        setOpen(true);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  const handleSelect = useCallback(
    async (place: PlaceSuggestion) => {
      const label = place.displayName ?? place.description;

      // Suppress the next search triggered by setQuery so the dropdown
      // doesn't re-open immediately after selection.
      suppressNextSearch.current = true;
      setQuery(label);
      setSuggestions([]);
      setOpen(false);
      setSearchError('');

      // If the result already has coordinates, use them directly.
      if (
        place.latitude !== undefined &&
        place.longitude !== undefined &&
        Number.isFinite(place.latitude) &&
        Number.isFinite(place.longitude)
      ) {
        onPlaceSelect({ ...place, formatted_address: label });
        return;
      }

      // Otherwise fetch full details to get coordinates.
      try {
        const response = await fetch(
          `/api/places/details?place_id=${encodeURIComponent(place.place_id)}`,
        );

        if (!response.ok) {
          onPlaceSelect({ ...place, formatted_address: place.description });
          return;
        }

        const data = (await response.json()) as {
          result?: {
            formatted_address?: string;
            geometry?: { location?: { lat?: number; lng?: number } };
            city?: string;
            state?: string;
            country?: string;
          };
        };

        onPlaceSelect({
          ...place,
          formatted_address: data.result?.formatted_address ?? place.description,
          latitude: data.result?.geometry?.location?.lat,
          longitude: data.result?.geometry?.location?.lng,
          city: data.result?.city,
          state: data.result?.state,
          country: data.result?.country,
        });
      } catch {
        onPlaceSelect({ ...place, formatted_address: label });
      }
    },
    [onPlaceSelect],
  );

  const showDropdown =
    open && (isLoading || Boolean(searchError) || suggestions.length > 0 || query.trim().length >= 2);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        onChange={(event) => {
          const nextValue = event.target.value;
          setQuery(nextValue);
          // Clear the selection whenever the user edits manually.
          onPlaceSelect(null);
          if (!nextValue.trim()) {
            setSuggestions([]);
            setOpen(false);
          } else {
            setOpen(true);
          }
        }}
        onFocus={() => {
          // Re-open the dropdown if we already have suggestions for the current query.
          if (suggestions.length > 0) setOpen(true);
        }}
        className="form-input"
      />

      {isLoading && (
        <p className="mt-1 text-sm text-slate-500" aria-live="polite">
          Searching…
        </p>
      )}

      {showDropdown && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg overflow-hidden"
          aria-label="Destination suggestions"
        >
          {isLoading && (
            <li className="px-4 py-3 text-sm text-slate-500">Searching…</li>
          )}

          {!isLoading && searchError && (
            <li className="px-4 py-3 text-sm text-rose-600" role="alert">
              {searchError}
            </li>
          )}

          {!isLoading && !searchError && suggestions.length === 0 && query.trim().length >= 2 && (
            <li className="px-4 py-3 text-sm text-slate-500">
              No places found for &ldquo;{query}&rdquo;
            </li>
          )}

          {suggestions.map((place) => (
            <li key={place.place_id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => void handleSelect(place)}
                className="flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 last:border-b-0"
              >
                <span className="mt-1 flex-shrink-0 text-lg" aria-hidden>📍</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-slate-800">
                    {place.structured_formatting?.main_text ?? place.description}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {place.structured_formatting?.secondary_text ??
                      place.displayName ??
                      place.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
