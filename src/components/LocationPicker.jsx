// src/components/LocationPicker.jsx
// Pin the place of loss on a map → address fields fill automatically.
//
// Map provider:
//   • Google Maps  – used when VITE_GOOGLE_MAPS_API_KEY is set (.env.local / Vercel env).
//                    Needs "Maps JavaScript API" + "Geocoding API" enabled on the key.
//   • OpenStreetMap – free fallback (Leaflet + Nominatim) when no key is set.
// Nothing to npm-install: both are loaded from their CDNs only when this component opens.
//
// Props:
//   value    { lat, lng }                       – current pin (optional)
//   onChange ({ lat, lng, place, city, pincode, state }) – called after every pin move
//   height   map height in px (default 240)

import { useEffect, useRef, useState } from "react";
import { MapPin, LocateFixed, Search, Loader2, AlertTriangle } from "lucide-react";

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const PROVIDER = GOOGLE_KEY ? "google" : "osm";
const DEFAULT_CENTER = { lat: 13.0827, lng: 80.2707 }; // Chennai
const LEAFLET = "https://unpkg.com/leaflet@1.9.4/dist/";

/* ---------------- loaders (run once per page) ---------------- */
let providerPromise = null;

function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Script failed to load"));
    document.head.appendChild(s);
  });
}

function loadProvider() {
  if (providerPromise) return providerPromise;
  if (PROVIDER === "google") {
    providerPromise = window.google?.maps
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          window.__smartClaimsMapsReady = () => resolve();
          window.gm_authFailure = () => reject(new Error("Google Maps rejected the API key"));
          addScript(
            `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_KEY)}&v=weekly&callback=__smartClaimsMapsReady`
          ).catch(reject);
        });
  } else {
    providerPromise = (async () => {
      // Wait for the stylesheet too – without it Leaflet places the pin and tiles wrongly
      const css = document.getElementById("leaflet-css")
        ? Promise.resolve()
        : new Promise((resolve, reject) => {
            const l = document.createElement("link");
            l.id = "leaflet-css";
            l.rel = "stylesheet";
            l.href = `${LEAFLET}leaflet.css`;
            l.onload = resolve;
            l.onerror = () => reject(new Error("Map styles failed to load"));
            document.head.appendChild(l);
          });
      await Promise.all([css, window.L ? Promise.resolve() : addScript(`${LEAFLET}leaflet.js`)]);
      window.L.Icon.Default.imagePath = `${LEAFLET}images/`;
    })();
  }
  providerPromise.catch(() => {
    providerPromise = null; // allow retry
  });
  return providerPromise;
}

/* ---------------- geocoding ---------------- */
async function reverseGeocode(lat, lng) {
  if (PROVIDER === "google") {
    const { results } = await new window.google.maps.Geocoder().geocode({ location: { lat, lng } });
    return fromGoogle(results?.[0]);
  }
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${lat}&lon=${lng}`, {
    headers: { "Accept-Language": "en" },
  });
  return fromOsm(await r.json());
}

async function forwardGeocode(q) {
  if (PROVIDER === "google") {
    const { results } = await new window.google.maps.Geocoder().geocode({ address: q, componentRestrictions: { country: "IN" } });
    const g = results?.[0];
    if (!g) return null;
    const loc = g.geometry.location;
    return { lat: loc.lat(), lng: loc.lng(), ...fromGoogle(g) };
  }
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&countrycodes=in&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { "Accept-Language": "en" } }
  );
  const [hit] = await r.json();
  if (!hit) return null;
  return { lat: Number(hit.lat), lng: Number(hit.lon), ...fromOsm(hit) };
}

function fromGoogle(g) {
  if (!g) return {};
  const part = (type) => g.address_components.find((c) => c.types.includes(type))?.long_name || "";
  return {
    place: g.formatted_address.replace(/, India$/, ""),
    city: part("locality") || part("administrative_area_level_3") || part("administrative_area_level_2"),
    pincode: part("postal_code"),
    state: part("administrative_area_level_1"),
  };
}

function fromOsm(o) {
  const a = o?.address || {};
  const road = [a.house_number, a.road].filter(Boolean).join(" ");
  const area = a.suburb || a.neighbourhood || a.quarter || a.village || "";
  const city = a.city || a.town || a.municipality || a.county || a.state_district || "";
  return {
    place: [road, area].filter(Boolean).join(", ") || (o?.display_name || "").split(",").slice(0, 3).join(","),
    city,
    pincode: a.postcode || "",
    state: a.state || "",
  };
}

/* ---------------- component ---------------- */
export default function LocationPicker({ value, onChange, height = 240 }) {
  const box = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const changeRef = useRef(onChange);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    changeRef.current = onChange;
  }, [onChange]);

  // Move the pin, then look up the address and report it
  // zoom: pass 16 to zoom in (search / current location); leave empty to keep the zoom
  async function pin(lat, lng, known, zoom) {
    const pos = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    if (PROVIDER === "google") {
      marker.current.setPosition(pos);
      if (zoom) map.current.setZoom(zoom);
      map.current.panTo(pos);
    } else {
      marker.current.setLatLng([pos.lat, pos.lng]);
      map.current.setView([pos.lat, pos.lng], zoom || map.current.getZoom());
    }
    setBusy(true);
    setError("");
    try {
      const addr = known || (await reverseGeocode(pos.lat, pos.lng));
      changeRef.current?.({ ...pos, ...addr });
    } catch {
      changeRef.current?.(pos);
      setError("Pinned, but the address lookup failed – type the place manually.");
    } finally {
      setBusy(false);
    }
  }
  const pinRef = useRef(pin);
  pinRef.current = pin;

  // Load the map once
  useEffect(() => {
    let alive = true;
    loadProvider()
      .then(() => {
        if (!alive || !box.current || map.current) return;
        const start = value?.lat ? { lat: value.lat, lng: value.lng } : DEFAULT_CENTER;
        if (PROVIDER === "google") {
          const g = window.google.maps;
          map.current = new g.Map(box.current, {
            center: start,
            zoom: value?.lat ? 16 : 12,
            gestureHandling: "cooperative", // page scrolls normally; Ctrl + wheel zooms the map
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
          });
          marker.current = new g.Marker({ position: start, map: map.current, draggable: true });
          map.current.addListener("click", (e) => pinRef.current(e.latLng.lat(), e.latLng.lng()));
          marker.current.addListener("dragend", (e) => pinRef.current(e.latLng.lat(), e.latLng.lng()));
        } else {
          const L = window.L;
          map.current = L.map(box.current, { zoomControl: true, scrollWheelZoom: false }).setView([start.lat, start.lng], value?.lat ? 16 : 12);
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(map.current);
          marker.current = L.marker([start.lat, start.lng], { draggable: true }).addTo(map.current);
          map.current.on("click", (e) => pinRef.current(e.latlng.lat, e.latlng.lng));
          marker.current.on("dragend", () => {
            const p = marker.current.getLatLng();
            pinRef.current(p.lat, p.lng);
          });
          // Mouse wheel scrolls the page; Ctrl + wheel zooms the map (like Google Maps embeds)
          box.current.addEventListener(
            "wheel",
            (e) => {
              if (!e.ctrlKey || !map.current) return;
              e.preventDefault();
              map.current.setZoom(map.current.getZoom() + (e.deltaY < 0 ? 1 : -1));
            },
            { passive: false }
          );
          setTimeout(() => map.current?.invalidateSize(), 0);
        }
        setStatus("ready");
      })
      .catch((e) => {
        if (!alive) return;
        setStatus("error");
        setError(
          PROVIDER === "google"
            ? `Google Maps could not load (${e.message}). Check the API key, billing and allowed websites – or enter the place manually.`
            : "Map could not load (no internet or the map service is blocked). Enter the place manually below."
        );
      });
    return () => {
      alive = false;
      if (map.current && PROVIDER === "osm") map.current.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function search(e) {
    e.preventDefault();
    if (!q.trim() || status !== "ready") return;
    setBusy(true);
    setError("");
    try {
      const hit = await forwardGeocode(q.trim());
      if (!hit) {
        setError("No match found – try a landmark, area or pincode, or click on the map.");
        setBusy(false);
        return;
      }
      const { lat, lng, ...addr } = hit;
      await pin(lat, lng, addr, 16);
    } catch {
      setError("Search failed – click on the map instead.");
      setBusy(false);
    }
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setError("This browser cannot share location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        pin(p.coords.latitude, p.coords.longitude, null, 16);
      },
      () => {
        setBusy(false);
        setError("Location permission was denied – search or click on the map.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-2">
      <form onSubmit={search} className="flex flex-wrap gap-2">
        <span className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search landmark, area or pincode – or click on the map"
            aria-label="Search location on map"
            disabled={status !== "ready"}
            className="h-9 w-full rounded-md border border-slate-300 bg-white pl-8 pr-2.5 text-[13px] focus:border-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-700/15 disabled:bg-slate-100"
          />
        </span>
        <button
          type="submit"
          disabled={status !== "ready" || busy}
          className="h-9 rounded-md bg-teal-700 px-3 text-[13px] font-semibold text-white hover:bg-teal-800 disabled:opacity-40"
        >
          Find
        </button>
        <button
          type="button"
          onClick={useMyLocation}
          disabled={status !== "ready" || busy}
          className="flex h-9 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          Use current location
        </button>
      </form>

      <div className="relative overflow-hidden rounded-md border border-slate-200 bg-slate-100" style={{ height }}>
        <div ref={box} className="absolute inset-0" role="application" aria-label="Map – click to pin the place of loss" />
        {status === "loading" && (
          <div className="absolute inset-0 grid place-items-center text-[12.5px] text-slate-500">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading map…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 grid place-items-center px-6 text-center text-[12.5px] text-slate-600">
            <span className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
              {error}
            </span>
          </div>
        )}
        {busy && status === "ready" && (
          <div className="absolute right-2 top-2 z-[500] flex items-center gap-1.5 rounded bg-white/95 px-2 py-1 text-[11.5px] text-slate-700 shadow">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Finding address…
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-slate-600">
          <MapPin className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
          {value?.lat ? (
            <span className="tabular-nums">
              Pinned at {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
            </span>
          ) : (
            "Click on the map or drag the pin · Ctrl + scroll to zoom"
          )}
        </span>
        <span className="text-slate-400">{PROVIDER === "google" ? "Google Maps" : "OpenStreetMap"}</span>
      </div>
      {error && status === "ready" && <p className="text-[11.5px] text-amber-800">{error}</p>}
    </div>
  );
}