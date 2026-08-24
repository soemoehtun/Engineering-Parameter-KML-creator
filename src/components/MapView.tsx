import { useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { BaseLayerKey, SectorShape, SiteMarker, Visibility } from "../types";
import { circleRadius } from "../lib/icons";

const LAYERS: Record<BaseLayerKey, L.TileLayerOptions & { url: string }> = {
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20,
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 20,
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri",
    maxZoom: 19,
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
    maxZoom: 19,
  },
};

const LAYER_META: { key: BaseLayerKey; label: string; bg: string; thumb: string }[] = [
  {
    key: "light",
    label: "Light",
    bg: "linear-gradient(135deg,#f8fafc,#e2e8f0)",
    thumb: "https://a.basemaps.cartocdn.com/light_all/12/3143/1852.png",
  },
  {
    key: "dark",
    label: "Dark",
    bg: "linear-gradient(135deg,#1e293b,#0f172a)",
    thumb: "https://a.basemaps.cartocdn.com/dark_all/12/3143/1852.png",
  },
  {
    key: "satellite",
    label: "Satellite",
    bg: "linear-gradient(135deg,#14532d,#0c4a6e)",
    thumb: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1852/3143",
  },
  {
    key: "osm",
    label: "OSM",
    bg: "linear-gradient(135deg,#dbeafe,#bbf7d0)",
    thumb: "https://tile.openstreetmap.org/12/3143/1852.png",
  },
];

const LABEL_LIMIT = 1500;

export function MapView({
  sites,
  sectors,
  visibility,
  baseLayer,
  onBaseLayerChange,
  markerOpacity = 100,
  searchTerm = "",
  zoomRectActive = false,
  onZoomRectChange,
}: {
  sites: SiteMarker[];
  sectors: SectorShape[];
  visibility: Visibility;
  baseLayer: BaseLayerKey;
  onBaseLayerChange: (l: BaseLayerKey) => void;
  markerOpacity?: number;
  searchTerm?: string;
  /** Whether zoom-to-rectangle draw mode is active (controlled from parent) */
  zoomRectActive?: boolean;
  onZoomRectChange?: (active: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileRef = useRef<L.TileLayer | null>(null);
  const siteLayerRef = useRef<L.LayerGroup | null>(null);
  const labelLayerRef = useRef<L.LayerGroup | null>(null);
  const sectorLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const prevSelRef = useRef<string | null>(null);
  const fitSigRef = useRef<string>("");
  const prevSitesKeyRef = useRef<string>("");

  const rectDragRef = useRef<{
    startX: number; startY: number;
    el: HTMLDivElement;
  } | null>(null);

  // ── mount map once ──
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const renderer = L.canvas({ padding: 0.5 });
    const map = L.map(containerRef.current, {
      center: [16.8661, 96.1951],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
      renderer,
      preferCanvas: true,
      zoomAnimation: true,
      markerZoomAnimation: false,
      worldCopyJump: true,
    });
    mapRef.current = map;

    const cfg = LAYERS[baseLayer || "satellite"];
    tileRef.current = L.tileLayer(cfg.url, cfg).addTo(map);
    tileRef.current.setZIndex(0);

    siteLayerRef.current = L.layerGroup().addTo(map);
    labelLayerRef.current = L.layerGroup().addTo(map);
    sectorLayerRef.current = L.layerGroup().addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    setTimeout(() => map.invalidateSize(), 200);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── swap basemap ──
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !baseLayer) return;
    if (tileRef.current) map.removeLayer(tileRef.current);
    const c = LAYERS[baseLayer];
    tileRef.current = L.tileLayer(c.url, c).addTo(map);
    tileRef.current.setZIndex(0);
  }, [baseLayer]);

  /* ── draw sites (canvas CircleMarkers) ── */
  useEffect(() => {
    const group = siteLayerRef.current;
    const map = mapRef.current;
    if (!group || !map) return;

    group.clearLayers();
    markersRef.current.clear();
    prevSelRef.current = null;

    if (!sites.length) {
      fitSigRef.current = "";
      prevSitesKeyRef.current = "";
      return;
    }

    const heavy = sites.length > LABEL_LIMIT;
    const fillOp = Math.max(0, Math.min(1, markerOpacity / 100));
    const buf: L.CircleMarker[] = [];

    for (const s of sites) {
      if (!isFinite(s.lat) || !isFinite(s.lon)) continue;
      const r = circleRadius(s.icon, 1);
      const op = (s.icon.opacity ?? 1) * fillOp;

      // Point-File-Creator style: stroke uses the point colour, weight 1
      const m = L.circleMarker([s.lat, s.lon], {
        radius: r,
        color: s.icon.color,
        weight: 1,
        fillColor: s.icon.color,
        fillOpacity: op,
        interactive: true,
        bubblingMouseEvents: false,
      });

      if (heavy) {
        m.on("click", () => {
          if (!m.getPopup()) {
            m.bindPopup(s.popupHtml, {
              className: "pg-popup",
              maxWidth: 280,
              minWidth: 170,
              autoPan: true,
              autoPanPadding: [24, 24],
              closeButton: true,
            });
          }
          m.openPopup();
        });
      } else {
        m.bindPopup(s.popupHtml, {
          className: "pg-popup",
          maxWidth: 280,
          minWidth: 170,
          autoPan: true,
          autoPanPadding: [24, 24],
          closeButton: true,
        });
      }

      if (!heavy && s.label) {
        m.bindTooltip(s.label, {
          direction: "top",
          className: "site-hover-label",
          opacity: 1,
          offset: [0, -r - 3],
        });
      }

      buf.push(m);
    }

    L.layerGroup(buf).addTo(group);

    for (const m of buf) {
      const lat = m.getLatLng().lat;
      const lon = m.getLatLng().lng;
      const site = sites.find((s) => s.lat === lat && s.lon === lon);
      if (site) markersRef.current.set(site.site, m);
    }

    // auto zoom to filtered sites — works for search
    const sitesKey = sites.map((s) => s.site).join("|");
    const isSearchActive = searchTerm.trim().length > 0;
    const shouldZoom =
      sitesKey !== prevSitesKeyRef.current ||
      (isSearchActive && sites.length > 0 && sites.length <= 20);

    if (shouldZoom) {
      prevSitesKeyRef.current = sitesKey;
      const sig = sitesKey;
      if (fitSigRef.current !== sig || isSearchActive) {
        fitSigRef.current = sig;
        const first = fitSigRef.current === "" || prevSitesKeyRef.current === "";
        try {
          if (sites.length === 1) {
            map.flyTo([sites[0].lat, sites[0].lon], Math.max(map.getZoom(), 14), {
              duration: first ? 0 : 0.6,
            });
          } else {
            let minLat = 90,
              maxLat = -90,
              minLon = 180,
              maxLon = -180;
            for (const s of sites) {
              if (s.lat < minLat) minLat = s.lat;
              if (s.lat > maxLat) maxLat = s.lat;
              if (s.lon < minLon) minLon = s.lon;
              if (s.lon > maxLon) maxLon = s.lon;
            }
            map.flyToBounds(
              L.latLngBounds([minLat, minLon], [maxLat, maxLon]),
              { padding: [60, 60], maxZoom: 15, duration: isSearchActive ? 0.6 : first ? 0 : 0.5 }
            );
          }
        } catch {
          /* ignore */
        }
      }
    }
  }, [sites, markerOpacity, searchTerm]);

  /* ── draw sector polygons ── */
  useEffect(() => {
    const layer = sectorLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    if (!visibility.beams) return;

    const buf: L.Polygon[] = [];
    for (const sec of sectors) {
      if (!sec.polygon.length) continue;
      const poly = L.polygon(sec.polygon, {
        color: sec.color,
        weight: 1,
        fillColor: sec.color,
        fillOpacity: sec.opacity,
        opacity: Math.max(0.2, sec.opacity),
      });
      poly.bindPopup(sec.popupHtml, {
        className: "pg-popup",
        maxWidth: 280,
        minWidth: 170,
        autoPan: true,
        autoPanPadding: [24, 24],
        closeButton: true,
      });
      if (visibility.cellLabels) {
        poly.bindTooltip(sec.label, {
          permanent: true,
          direction: "center",
          className: "beam-label",
        });
      }
      buf.push(poly);
    }
    if (buf.length) L.layerGroup(buf).addTo(layer);
  }, [sectors, visibility.beams, visibility.cellLabels]);

  /* ── permanent site labels ── */
  useEffect(() => {
    const lg = labelLayerRef.current;
    const map = mapRef.current;
    if (!lg || !map) return;
    lg.clearLayers();

    if (!visibility.siteLabels || !sites.length || sites.length > LABEL_LIMIT) return;

    const buf: L.Marker[] = [];
    for (const s of sites) {
      if (!s.label) continue;
      const r = circleRadius(s.icon, 1);
      const m = L.marker([s.lat, s.lon], {
        icon: L.divIcon({ className: "site-label-wrap", html: "", iconSize: [0, 0] }),
        interactive: false,
        keyboard: false,
      });
      m.bindTooltip(s.label, {
        permanent: true,
        direction: "top",
        offset: [0, -r - 4],
        className: "site-label",
      });
      buf.push(m);
    }
    if (buf.length) L.layerGroup(buf).addTo(lg);
  }, [sites, visibility.siteLabels]);

  /* ── click-to-select highlight ── */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const prev = prevSelRef.current;
    if (prev !== null && prev !== undefined) {
      const pm = markersRef.current.get(prev);
      if (pm)
        pm.setStyle({
          color: pm.options.fillColor,
          weight: 1,
          radius: circleRadius(
            sites.find((s) => s.site === prev)?.icon ?? { color: "#000", scale: 1, opacity: 1 },
            1
          ),
        });
    }
    prevSelRef.current = undefined as never;
  }, [sites]);

  // ── Zoom-to-Rectangle handlers ──
  const deactivateZoomRect = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    onZoomRectChange?.(false);
    map.dragging.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    // clean up any dangling rubber-band
    if (rectDragRef.current) {
      rectDragRef.current.el.remove();
      rectDragRef.current = null;
    }
  }, [onZoomRectChange]);

  // Sync map interaction locks whenever zoomRectActive prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (zoomRectActive) {
      map.dragging.disable();
      map.doubleClickZoom.disable();
      map.boxZoom.disable();
    } else {
      map.dragging.enable();
      map.doubleClickZoom.enable();
      map.boxZoom.enable();
      if (rectDragRef.current) {
        rectDragRef.current.el.remove();
        rectDragRef.current = null;
      }
    }
  }, [zoomRectActive]);

  const handleRectMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomRectActive) return;
    if (e.button !== 0) { deactivateZoomRect(); return; }
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    // Create rubber-band overlay div
    const el = document.createElement("div");
    el.style.cssText = [
      "position:absolute",
      `left:${startX}px`,
      `top:${startY}px`,
      "width:0",
      "height:0",
      "border:2px dashed #13a38f",
      "background:rgba(19,163,143,0.12)",
      "pointer-events:none",
      "z-index:2000",
      "box-sizing:border-box",
    ].join(";");
    container.appendChild(el);
    rectDragRef.current = { startX, startY, el };
  }, [zoomRectActive, deactivateZoomRect]);

  const handleRectMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomRectActive || !rectDragRef.current) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const { startX, startY, el } = rectDragRef.current;
    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;
    const x = Math.min(startX, curX);
    const y = Math.min(startY, curY);
    const w = Math.abs(curX - startX);
    const h = Math.abs(curY - startY);
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
  }, [zoomRectActive]);

  const handleRectMouseUp = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomRectActive || !rectDragRef.current) return;
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const { startX, startY, el } = rectDragRef.current;
    el.remove();
    rectDragRef.current = null;

    const bcrect = container.getBoundingClientRect();
    const endX = e.clientX - bcrect.left;
    const endY = e.clientY - bcrect.top;

    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    const minY = Math.min(startY, endY);
    const maxY = Math.max(startY, endY);

    // Only zoom if the rectangle is large enough (>10px)
    if (maxX - minX > 10 && maxY - minY > 10) {
      const sw = map.containerPointToLatLng(L.point(minX, maxY));
      const ne = map.containerPointToLatLng(L.point(maxX, minY));
      map.flyToBounds(L.latLngBounds(sw, ne), { padding: [4, 4], duration: 0.45 });
    }

    deactivateZoomRect();
  }, [zoomRectActive, deactivateZoomRect]);


  // Cancel on Escape key
  useEffect(() => {
    if (!zoomRectActive) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") deactivateZoomRect(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomRectActive, deactivateZoomRect]);

  return (
    <div className="map-container">
      <div
        ref={containerRef}
        className="absolute inset-0 z-0"
        style={{ cursor: zoomRectActive ? "crosshair" : undefined }}
        onMouseDown={handleRectMouseDown}
        onMouseMove={handleRectMouseMove}
        onMouseUp={handleRectMouseUp}
        onContextMenu={zoomRectActive ? (e) => { e.preventDefault(); deactivateZoomRect(); } : undefined}
      />

      {/* Active mode indicator */}
      {zoomRectActive && (
        <div
          style={{
            position: "absolute",
            bottom: 52,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1000,
            background: "rgba(19,163,143,0.92)",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            padding: "5px 14px",
            borderRadius: 20,
            pointerEvents: "none",
            letterSpacing: "0.02em",
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
          }}
        >
          🔍 Draw a rectangle to zoom · Esc to cancel
        </div>
      )}

      {/* Layer switcher */}
      <div className="absolute right-3 top-3 z-[1000]">
        <LayerSwitcher active={baseLayer} onChange={onBaseLayerChange} />
      </div>
    </div>
  );
}

/* ===================== Layer Switcher ===================== */

function LayerSwitcher({
  active,
  onChange,
}: {
  active: BaseLayerKey;
  onChange: (k: BaseLayerKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = LAYER_META.find((l) => l.key === active);
  if (!open)
    return (
      <button
        onClick={() => setOpen(true)}
        className="h-11 w-11 overflow-hidden rounded-md border-2 border-white shadow-lg transition hover:shadow-xl"
        style={{ background: current?.bg }}
        title="Basemap"
      >
        <Thumb src={current?.thumb} className="h-11 w-11" />
      </button>
    );
  return (
    <div
      className="flex gap-2 bg-white p-2 shadow-xl ring-1 ring-black/10"
      style={{ borderRadius: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      {LAYER_META.map((l) => (
        <button
          key={l.key}
          onClick={() => {
            onChange(l.key);
            setOpen(false);
          }}
          className="group w-[60px] p-0.5 text-center transition hover:bg-[#f3f7f5]"
        >
          <span
            className="relative block h-[44px] w-full overflow-hidden border-2"
            style={{
              background: l.bg,
              borderColor: active === l.key ? "#13a38f" : "transparent",
            }}
          >
            <Thumb src={l.thumb} className="h-full w-full" />
          </span>
          <span
            className="mt-1 block text-[10px] font-semibold"
            style={{ color: active === l.key ? "#0f9382" : "#6b7f7c" }}
          >
            {l.label}
          </span>
        </button>
      ))}
    </div>
  );
}

function Thumb({ src, className }: { src?: string; className: string }) {
  const [ok, setOk] = useState(true);
  if (!src || !ok) return null;
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={className}
      style={{ objectFit: "cover", display: "block", pointerEvents: "none" }}
      onError={() => setOk(false)}
    />
  );
}
