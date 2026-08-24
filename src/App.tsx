import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapView } from "./components/MapView";
import { Icon } from "./components/ui";
import { IconPickerModal } from "./components/IconPickerModal";
import { ExportPanel } from "./components/ExportPanel";
import { VECTOR_CIRCLE } from "./lib/kmlIcons";
import { autoMap, parseFile } from "./lib/fileParser";
import { computeSectors, computeSites, type ResolveConfig } from "./lib/render";
import { exportKmz } from "./lib/kml";
import { exportStandaloneHtml, type ProjectState } from "./lib/share";
import { DEFAULT_ICON, PALETTE, paletteColor } from "./lib/icons";
import { cn } from "./utils/cn";
import type {
  BaseLayerKey,
  ColorRange,
  DataRow,
  IconConfig,
  IconRange,
  Legends,
  Mapping,
  Visibility,
} from "./types";

type Tab = "upload" | "columns" | "style" | "filter";

const OP_LABELS: Record<string, string> = {
  ">=": "\u2265",
  ">": ">",
  "=": "=",
  "!=": "\u2260",
  "<=": "\u2264",
  "<": "<",
};

const EMPTY_MAPPING: Mapping = {
  SiteName: "",
  SectorName: "",
  Longitude: "",
  Latitude: "",
  Azimuth: "",
  ColorCode: "",
  BeamCategory: "",
  RadiusCategory: "",
  IconCategory: "",
  CellLabelCol: "",
  sitePopupCols: [],
  sectorPopupCols: [],
};

/* ----------------------------- small ui helpers ----------------------------- */

function MapSelect({
  label,
  value,
  onChange,
  headers,
  required,
  emptyLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  headers: string[];
  required?: boolean;
  emptyLabel?: string;
}) {
  return (
    <div className="mb-3">
      <label className="field-label">
        {label} {required && <span className="req">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field-control"
      >
        <option value="">{emptyLabel ?? "-- Select --"}</option>
        {headers.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn(value === o.value && "active")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SliderRow({
  label,
  min,
  max,
  step = 1,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <div className="range-slider">
      <div className="range-head">
        <label className="field-label">{label}</label>
        <span className="range-val">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  hint,
  first,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
  first?: boolean;
}) {
  return (
    <label className={cn("check-row", first && "first")}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

function OpSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Operator"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {OP_LABELS[o] ?? o}
        </option>
      ))}
    </select>
  );
}

interface RangeRowLike {
  opMin: string;
  min: string;
  opMax: string;
  max: string;
}

function RangeRows<R extends RangeRowLike>({
  ranges,
  onChange,
  onAdd,
  onRemove,
  render,
}: {
  ranges: R[];
  onChange: (i: number, patch: Partial<R>) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
  render: (p: { range: R; patch: (p: Partial<R>) => void }) => React.ReactNode;
}) {
  return (
    <div>
      {ranges.map((range, idx) => (
        <div key={idx} className="range-row2">
          <div className="rline">
            <OpSelect
              value={range.opMin}
              options={[">=", ">", "=", "!="]}
              onChange={(v) => onChange(idx, { opMin: v } as Partial<R>)}
            />
            <input
              value={range.min}
              placeholder="Val"
              onChange={(e) => onChange(idx, { min: e.target.value } as Partial<R>)}
            />
            <span className="amp">&amp;</span>
            <OpSelect
              value={range.opMax}
              options={["<=", "<", "=", "!=", ">=", ">"]}
              onChange={(v) => onChange(idx, { opMax: v } as Partial<R>)}
            />
            <input
              value={range.max}
              placeholder="Val"
              onChange={(e) => onChange(idx, { max: e.target.value } as Partial<R>)}
            />
            {render({ range, patch: (p) => onChange(idx, p) })}
            <button
              type="button"
              className="rm"
              disabled={ranges.length === 1}
              onClick={() => onRemove(idx)}
              title="Remove rule"
            >
              &times;
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="add-range" onClick={onAdd}>
        + Add range
      </button>
    </div>
  );
}

function SwatchRow({
  value,
  onChange,
}: {
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="swatch-row">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          className={cn("swatch", value.toLowerCase() === c.toLowerCase() && "active")}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="color-input mix"
        title="Custom colour"
      />
    </div>
  );
}


/* ============================== APP ============================== */

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<DataRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadStatus, setUploadStatus] = useState<{
    type: "idle" | "ok" | "error";
    msg: string;
  }>({ type: "idle", msg: "" });

  const [mapping, setMapping] = useState<Mapping>({ ...EMPTY_MAPPING });
  const [legends, setLegends] = useState<Legends>({ color: {}, beam: {}, radius: {}, icons: {} });
  const [colorRanges, setColorRanges] = useState<ColorRange[]>([
    { opMin: ">=", min: "", opMax: "<=", max: "", color: "#22c55e" },
  ]);
  const [iconRanges, setIconRanges] = useState<IconRange[]>([
    { opMin: ">=", min: "", opMax: "<=", max: "", iconConfig: { ...DEFAULT_ICON } },
  ]);
  const [colorMode, setColorMode] = useState<"category" | "range">("category");
  const [iconMode, setIconMode] = useState<"category" | "range">("category");

  const [defaultIcon, setDefaultIcon] = useState<IconConfig>({ ...DEFAULT_ICON });
  
  // Custom KMZ export icons (Point-File-Creator style)
  const [exportAppearance, setExportAppearance] = useState<"map" | "custom">("map");
  const [exportMode, setExportMode] = useState<"single" | "category">("single");
  const [exportIconUrl, setExportIconUrl] = useState<string>(VECTOR_CIRCLE);

  const [exportIconScale, setExportIconScale] = useState<number>(1);
  const [exportIconOpacity, setExportIconOpacity] = useState<number>(1);
  const [exportCategoryIcons, setExportCategoryIcons] = useState<Record<string, string>>({});
  const [exportIconColor, setExportIconColor] = useState<string>("");
  const [exportCategoryColors, setExportCategoryColors] = useState<Record<string, string>>({});
  
  // null = picker closed. "__single__" = editing the single icon. Otherwise a category value.
  const [pickerTarget, setPickerTarget] = useState<string | null>(null);

  const [defaultSectorColor, setDefaultSectorColor] = useState("#0ea5e9");
  const [defaultBeamwidth, setDefaultBeamwidth] = useState(65);
  const [defaultRadius, setDefaultRadius] = useState(280);
  const [opacity, setOpacity] = useState(55);
  const [globalIconScale, setGlobalIconScale] = useState(1);
  const [markerOpacity, setMarkerOpacity] = useState(100);

  const [visibility, setVisibility] = useState<Visibility>({
    beams: true,
    siteMarkers: true,
    siteLabels: false,
    cellLabels: false,
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [filterColumn, setFilterColumn] = useState("");
  const [filterValue, setFilterValue] = useState("");

  const [hasDrawn, setHasDrawn] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawProgress, setDrawProgress] = useState(0);
  const [baseLayer, setBaseLayer] = useState<BaseLayerKey>("satellite");
  const [dragOver, setDragOver] = useState(false);
  const [kmzModalOpen, setKmzModalOpen] = useState(false);
  const [zoomRectActive, setZoomRectActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- derived ---------- */
  const getUniqueValues = useCallback((col: string): string[] => {
    if (!col) return [];
    const set = new Set<string>();
    data.forEach((r) => {
      const v = r[col];
      if (v !== undefined && v !== null && String(v).trim() !== "") set.add(String(v));
    });
    return [...set].sort();
  }, [data]);

  const isColumnNumeric = useCallback(
    (col: string): boolean => {
      if (!col || !data.length) return false;
      let num = 0,
        total = 0;
      data.forEach((r) => {
        const v = r[col];
        if (v !== undefined && v !== null && String(v).trim() !== "") {
          total++;
          if (!isNaN(parseFloat(String(v))) && isFinite(Number(v))) num++;
        }
      });
      return total > 0 && num / total >= 0.8;
    },
    [data]
  );

  const uniqueFilterValues = useMemo(
    () => getUniqueValues(filterColumn),
    [filterColumn, getUniqueValues]
  );

  const validCoords = useMemo(() => {
    if (!mapping.Latitude || !mapping.Longitude) return 0;
    return data.filter((r) => {
      const lat = parseFloat(String(r[mapping.Latitude]));
      const lon = parseFloat(String(r[mapping.Longitude]));
      return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }).length;
  }, [data, mapping.Latitude, mapping.Longitude]);

  const filteredData = useMemo(() => {
    let rows = data;
    const t = searchTerm.trim().toLowerCase();
    if (t) {
      rows = rows.filter((r) =>
        Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(t))
      );
    }
    if (filterColumn && filterValue) {
      rows = rows.filter((r) => String(r[filterColumn] ?? "") === filterValue);
    }
    return rows;
  }, [data, searchTerm, filterColumn, filterValue]);

  const countUniqueSites = useCallback(
    (rows: DataRow[]) => {
      const key = mapping.SiteName;
      if (!key) return rows.length;
      const set = new Set<string>();
      rows.forEach((r) => {
        const v = String(r[key] ?? "").trim();
        if (v) set.add(v);
      });
      return set.size;
    },
    [mapping.SiteName]
  );

  const totalSites = useMemo(() => countUniqueSites(data), [data, countUniqueSites]);
  const filteredSites = useMemo(() => countUniqueSites(filteredData), [filteredData, countUniqueSites]);

  const resolveCfg = useMemo<ResolveConfig>(
    () => ({
      mapping,
      legends,
      colorRanges,
      iconRanges,
      colorMode,
      iconMode,
      defaultIcon,
      defaultSectorColor,
      defaultBeamwidth,
      defaultRadius,
      opacity,
      globalIconScale,
    }),
    [
      mapping,
      legends,
      colorRanges,
      iconRanges,
      colorMode,
      iconMode,
      defaultIcon,
      defaultSectorColor,
      defaultBeamwidth,
      defaultRadius,
      opacity,
      globalIconScale,
    ]
  );

  const drawnSites = useMemo(() => computeSites(filteredData, resolveCfg), [filteredData, resolveCfg]);
  const drawnSectors = useMemo(() => computeSectors(filteredData, resolveCfg), [filteredData, resolveCfg]);

  /* ---------- legend auto-population ---------- */
  useEffect(() => {
    if (mapping.ColorCode && !isColumnNumeric(mapping.ColorCode)) setColorMode("category");
  }, [mapping.ColorCode, isColumnNumeric]);
  useEffect(() => {
    if (mapping.IconCategory && !isColumnNumeric(mapping.IconCategory)) setIconMode("category");
  }, [mapping.IconCategory, isColumnNumeric]);

  useEffect(() => {
    if (!mapping.ColorCode) return;
    const unique = getUniqueValues(mapping.ColorCode);
    setLegends((prev) => {
      const next = { ...prev.color };
      unique.forEach((v, i) => {
        if (!(v in next)) next[v] = paletteColor(i);
      });
      return { ...prev, color: next };
    });
  }, [mapping.ColorCode, data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapping.IconCategory) return;
    const unique = getUniqueValues(mapping.IconCategory);
    setLegends((prev) => {
      const next = { ...prev.icons };
      unique.forEach((v, i) => {
        if (!(v in next)) next[v] = { ...DEFAULT_ICON, color: paletteColor(i) };
      });
      return { ...prev, icons: next };
    });
  }, [mapping.IconCategory, data]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapping.BeamCategory) return;
    const unique = getUniqueValues(mapping.BeamCategory);
    setLegends((prev) => {
      const next = { ...prev.beam };
      unique.forEach((v) => {
        if (!(v in next)) next[v] = String(defaultBeamwidth);
      });
      return { ...prev, beam: next };
    });
  }, [mapping.BeamCategory, data, defaultBeamwidth]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mapping.RadiusCategory) return;
    const unique = getUniqueValues(mapping.RadiusCategory);
    setLegends((prev) => {
      const next = { ...prev.radius };
      unique.forEach((v) => {
        if (!(v in next)) next[v] = String(defaultRadius);
      });
      return { ...prev, radius: next };
    });
  }, [mapping.RadiusCategory, data, defaultRadius]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateLegend = useCallback((type: keyof Legends, key: string, value: unknown) => {
    setLegends((prev) => ({
      ...prev,
      [type]: { ...(prev[type] as Record<string, unknown>), [key]: value },
    }));
  }, []);

  /* ---------- handlers ---------- */
  const ingest = (hs: string[], rows: DataRow[], name: string) => {
    setHeaders(hs);
    setData(rows);
    setFileName(name);
    const guess = autoMap(hs);
    setMapping({ ...EMPTY_MAPPING, ...guess, sitePopupCols: hs, sectorPopupCols: hs });
    setHasDrawn(false);
    setSearchTerm("");
    setFilterColumn("");
    setFilterValue("");
    setUploadStatus({ type: "ok", msg: `${rows.length.toLocaleString()} records loaded` });
    setActiveTab("columns");
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setUploadStatus({ type: "ok", msg: "Parsing file…" });
    try {
      const res = await parseFile(file);
      if (!res.headers.length || !res.data.length) {
        setUploadStatus({ type: "error", msg: "No data rows found in the file." });
        return;
      }
      ingest(res.headers, res.data, file.name);
    } catch {
      setUploadStatus({ type: "error", msg: "Failed to parse file. Please check the format." });
    }
  };

  const handleDraw = () => {
    if (!data.length) return;
    setIsDrawing(true);
    setDrawProgress(0);
    setHasDrawn(false);
    let p = 0;
    const iv = window.setInterval(() => {
      p += Math.random() * 24 + 10;
      if (p >= 100) {
        window.clearInterval(iv);
        setDrawProgress(100);
        window.setTimeout(() => {
          setHasDrawn(true);
          setIsDrawing(false);
        }, 160);

      } else {
        setDrawProgress(Math.round(p));
      }
    }, 70);
  };

  const handleExport = () => {
    if (!filteredData.length) {
      window.alert("No data to export. Draw the map first.");
      return;
    }
    setKmzModalOpen(true);
  };



  const snapshotProject = (): ProjectState => ({
    version: 1,
    fileName,
    headers,
    data,
    mapping,
    legends,
    colorRanges,
    iconRanges,
    colorMode,
    iconMode,
    defaultIcon,
    defaultSectorColor,
    defaultBeamwidth,
    defaultRadius,
    opacity,
    globalIconScale,
    markerOpacity,
    visibility,
    baseLayer,
    drawn: hasDrawn,
  });

  const restoreProject = (p: ProjectState) => {
    setHeaders(p.headers || []);
    setData(p.data || []);
    setFileName(p.fileName || "");
    setMapping({ ...EMPTY_MAPPING, ...p.mapping });
    setLegends(p.legends || { color: {}, beam: {}, radius: {}, icons: {} });
    setColorRanges(p.colorRanges || [{ opMin: ">=", min: "", opMax: "<=", max: "", color: "#22c55e" }]);
    setIconRanges(p.iconRanges || [{ opMin: ">=", min: "", opMax: "<=", max: "", iconConfig: { ...DEFAULT_ICON } }]);
    setColorMode(p.colorMode || "category");
    setIconMode(p.iconMode || "category");
    setDefaultIcon(p.defaultIcon || { ...DEFAULT_ICON });
    setDefaultSectorColor(p.defaultSectorColor || "#0ea5e9");
    setDefaultBeamwidth(p.defaultBeamwidth ?? 65);
    setDefaultRadius(p.defaultRadius ?? 280);
    setOpacity(p.opacity ?? 55);
    setGlobalIconScale(p.globalIconScale ?? 1);
    setMarkerOpacity(p.markerOpacity ?? 100);
    setVisibility(p.visibility || { beams: true, siteMarkers: true, siteLabels: false, cellLabels: false });
    setBaseLayer(p.baseLayer || "satellite");
    setHasDrawn(!!p.drawn);
    setSearchTerm("");
    setFilterColumn("");
    setFilterValue("");
    setUploadStatus({
      type: p.data?.length ? "ok" : "idle",
      msg: p.data?.length ? `${p.data.length.toLocaleString()} records loaded` : "",
    });
  };

  const handleHtmlExport = async () => {
    if (!data.length) return;
    await exportStandaloneHtml(snapshotProject());
  };

  useEffect(() => {
    if (window.__EP_PROJECT__?.data) restoreProject(window.__EP_PROJECT__);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClear = () => {
    if (!window.confirm("Are you sure you want to clear all data?")) return;
    setData([]);
    setHeaders([]);
    setFileName("");
    setMapping({ ...EMPTY_MAPPING });
    setLegends({ color: {}, beam: {}, radius: {}, icons: {} });
    setSearchTerm("");
    setFilterColumn("");
    setFilterValue("");
    setHasDrawn(false);
    setIsDrawing(false);
    setUploadStatus({ type: "idle", msg: "" });
    setActiveTab("upload");
  };

  const locFields: { label: string; key: "SiteName" | "SectorName" | "Longitude" | "Latitude" | "Azimuth" }[] = [
    { label: "Site Name", key: "SiteName" },
    { label: "Sector / Cell Name", key: "SectorName" },
    { label: "Longitude", key: "Longitude" },
    { label: "Latitude", key: "Latitude" },
    { label: "Azimuth", key: "Azimuth" },
  ];

  /* ===================== RENDER ===================== */
  return (
    <div className="app-shell flex flex-col">
      {/* ---------- header ---------- */}
      <header className="app-header">
        <div className="brand">
          <button
            className="mobile-menu"
            onClick={() => setSidebarCollapsed((p) => !p)}
            title="Toggle panel"
          >
            <Icon.Menu />
          </button>
          <span className="brand-name">CELL PARAMETER KMZ</span>
        </div>
      </header>

      {/* ---------- workspace ---------- */}
      <div className="workspace">
        {/* mobile backdrop */}
        {!sidebarCollapsed && (
          <div
            className="fixed inset-0 z-[1050] bg-black/25 md:hidden"
            onClick={() => setSidebarCollapsed(true)}
          />
        )}

        <aside className={cn("sidebar", sidebarCollapsed && "collapsed")}>
          {/* tabs */}
          <nav className="tabs">
            {(
              [
                { id: "upload", label: "Upload", Ic: Icon.Upload },
                { id: "columns", label: "Columns", Ic: Icon.Columns },
                { id: "style", label: "Style", Ic: Icon.Style },
                { id: "filter", label: "Export", Ic: Icon.Filter },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                className={cn(activeTab === t.id && "active")}
                onClick={() => setActiveTab(t.id)}
              >
                <t.Ic />
                {t.label}
              </button>
            ))}
          </nav>

          <div className="sidebar-scroll">
            {/* ===================== UPLOAD ===================== */}
            {activeTab === "upload" && (
              <section className="panel-enter" key="upload">
                <div className="intro-section">
                  <div className="section-kicker">Step 01</div>
                  <h1>Bring your network data.</h1>
                  <p>
                    Drop a CSV or Excel export of cell parameters. Everything is parsed in your
                    browser — nothing is uploaded.
                  </p>
                </div>

                <div className="sidebar-section border-top">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => {
                      handleFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <div
                    className={cn("dropzone", dragOver && "drag")}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFile(e.dataTransfer.files?.[0]);
                    }}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Icon.CloudUpload />
                    <p>Drop file to upload</p>
                    <span>CSV · XLSX · XLS · TXT</span>
                  </div>

                  {uploadStatus.type === "error" && (
                    <div className="note err">{uploadStatus.msg}</div>
                  )}

                  {data.length > 0 && (
                    <div className="file-chip">
                      <Icon.File />
                      <div>
                        <strong>{fileName}</strong>
                        <small>
                          {data.length.toLocaleString()} rows · {headers.length} columns
                        </small>
                      </div>
                      <button onClick={handleClear}>Remove</button>
                    </div>
                  )}

                  {data.length > 0 && headers.length > 0 && (
                    <div className="preview-wrap">
                      <table className="preview-table">
                        <thead>
                          <tr>
                            {headers.slice(0, 5).map((c) => (
                              <th key={c}>{c}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.slice(0, 12).map((r, i) => (
                            <tr key={i}>
                              {headers.slice(0, 5).map((c) => (
                                <td key={c}>{String(r[c] ?? "")}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ===================== COLUMNS ===================== */}
            {activeTab === "columns" && (
              <section className="panel-enter" key="columns">
                <div className="intro-section">
                  <div className="section-kicker">Step 02</div>
                  <h1>Map your columns.</h1>
                  <p>
                    Tell us which fields hold the site and sector data, then pick what shows inside
                    the popups.
                  </p>
                </div>

                <div className="sidebar-section border-top">
                  {!data.length && (
                    <div className="note warn">Upload a file first to map its columns.</div>
                  )}
                  {locFields.map((f) => (
                    <MapSelect
                      key={f.key}
                      label={f.label}
                      value={mapping[f.key]}
                      onChange={(v) => setMapping((m) => ({ ...m, [f.key]: v }))}
                      headers={headers}
                      required
                    />
                  ))}
                  {mapping.Latitude && mapping.Longitude && (
                    <div className="note ok">
                      {validCoords.toLocaleString()} valid coordinates detected
                      {data.length > validCoords &&
                        ` · ${(data.length - validCoords).toLocaleString()} skipped`}
                    </div>
                  )}
                </div>

                <div className="sidebar-section border-top">
                  <div className="side-head">Popup fields</div>

                  {(["site", "sector"] as const).map((kind) => (
                    <div key={kind} className="mb-4">
                      <label className="field-label">
                        {kind === "site" ? "Site" : "Sector"} popup ·{" "}
                        <small>
                          {(kind === "site" ? mapping.sitePopupCols.length : mapping.sectorPopupCols.length).toLocaleString()}
                          {" selected"}
                        </small>
                      </label>
                      <div className="bulk-actions">
                        <button
                          className="link-button"
                          onClick={() =>
                            setMapping((m) =>
                              kind === "site"
                                ? { ...m, sitePopupCols: [...headers] }
                                : { ...m, sectorPopupCols: [...headers] }
                            )
                          }
                        >
                          All
                        </button>
                        <button
                          className="link-button"
                          onClick={() =>
                            setMapping((m) =>
                              kind === "site"
                                ? { ...m, sitePopupCols: [] }
                                : { ...m, sectorPopupCols: [] }
                            )
                          }
                        >
                          Clear
                        </button>
                      </div>
                      <div className="check-list">
                        {headers.map((h) => {
                          const selected =
                            kind === "site" ? mapping.sitePopupCols : mapping.sectorPopupCols;
                          return (
                            <CheckRow
                              key={h}
                              first={h === headers[0]}
                              label={h}
                              checked={selected.includes(h)}
                              onChange={(chk) =>
                                setMapping((m) =>
                                  kind === "site"
                                    ? {
                                        ...m,
                                        sitePopupCols: chk
                                          ? [...m.sitePopupCols, h]
                                          : m.sitePopupCols.filter((c) => c !== h),
                                      }
                                    : {
                                        ...m,
                                        sectorPopupCols: chk
                                          ? [...m.sectorPopupCols, h]
                                          : m.sectorPopupCols.filter((c) => c !== h),
                                      }
                                )
                              }
                            />
                          );
                        })}
                        {!headers.length && <div className="counter">No columns yet.</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ===================== STYLE ===================== */}
            {activeTab === "style" && (
              <section className="panel-enter" key="style">
                <div className="intro-section">
                  <div className="section-kicker">Step 03</div>
                  <h1>Style the map.</h1>
                  <p>
                    Colour the beams and points, tune beamwidth and radius, or split them by a
                    column.
                  </p>
                </div>

                {/* -------- sector color -------- */}
                <div className="sidebar-section border-top">
                  <div className="side-head">Sector color</div>
                  <MapSelect
                    label="Color by column"
                    value={mapping.ColorCode}
                    onChange={(v) => setMapping((m) => ({ ...m, ColorCode: v }))}
                    headers={headers}
                    emptyLabel="-- Apply default color to all --"
                  />
                  {!mapping.ColorCode && (
                    <div className="mb-3">
                      <label className="field-label">Default sector colour</label>
                      <SwatchRow
                        value={defaultSectorColor}
                        onChange={setDefaultSectorColor}
                      />
                    </div>
                  )}

                  {mapping.ColorCode && isColumnNumeric(mapping.ColorCode) && (
                    <Segmented
                      options={[
                        { value: "category", label: "By Category" },
                        { value: "range", label: "By Range" },
                      ]}
                      value={colorMode}
                      onChange={(v) => setColorMode(v as "category" | "range")}
                    />
                  )}

                  {mapping.ColorCode && colorMode === "category" && (
                    <div className="mt-3">
                      {Object.keys(legends.color).map((cat) => (
                        <div key={cat} className="cat-row">
                          <span className="dot" style={{ background: legends.color[cat] }} />
                          <span>{cat}</span>
                          <input
                            type="color"
                            value={legends.color[cat]}
                            onChange={(e) => updateLegend("color", cat, e.target.value)}
                            className="color-input"
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {mapping.ColorCode && colorMode === "range" && (
                    <div className="mt-3">
                      <RangeRows
                        ranges={colorRanges}
                        onChange={(i, patch) =>
                          setColorRanges((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)))
                        }
                        onAdd={() =>
                          setColorRanges((rs) => [
                            ...rs,
                            {
                              opMin: ">=",
                              min: "",
                              opMax: "<=",
                              max: "",
                              color: paletteColor(rs.length),
                            },
                          ])
                        }
                        onRemove={(i) => setColorRanges((rs) => rs.filter((_, idx) => idx !== i))}
                        render={({ range, patch }) => (
                          <input
                            type="color"
                            value={range.color}
                            onChange={(e) => patch({ color: e.target.value })}
                                className="color-input range-color"
                            title="Assign color"
                          />
                        )}
                      />
                    </div>
                  )}
                </div>

                {/* -------- beam & radius -------- */}
                <div className="sidebar-section border-top">
                  <div className="side-head">Beam &amp; radius</div>
                  <MapSelect
                    label="Beamwidth column"
                    value={mapping.BeamCategory}
                    onChange={(v) => setMapping((m) => ({ ...m, BeamCategory: v }))}
                    headers={headers}
                    emptyLabel="-- Manual (global slider) --"
                  />
                  {!mapping.BeamCategory ? (
                    <SliderRow
                      label="Beamwidth (deg)"
                      min={1}
                      max={180}
                      value={defaultBeamwidth}
                      onChange={setDefaultBeamwidth}
                    />
                  ) : (
                    <div className="mb-3">
                      {Object.keys(legends.beam).map((cat) => (
                        <div key={cat} className="cat-row">
                          <span>{cat}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              value={legends.beam[cat]}
                              onChange={(e) => updateLegend("beam", cat, e.target.value)}
                              className="field-control"
                              style={{ width: 60, height: 26, textAlign: "right" }}
                            />
                            <span style={{ fontSize: 9, color: "#98a7a3" }}>°</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <MapSelect
                    label="Radius column"
                    value={mapping.RadiusCategory}
                    onChange={(v) => setMapping((m) => ({ ...m, RadiusCategory: v }))}
                    headers={headers}
                    emptyLabel="-- Manual (global slider) --"
                  />
                  {!mapping.RadiusCategory ? (
                    <SliderRow
                      label="Radius (m)"
                      min={10}
                      max={2000}
                      step={10}
                      value={defaultRadius}
                      onChange={setDefaultRadius}
                    />
                  ) : (
                    <div className="mb-3">
                      {Object.keys(legends.radius).map((cat) => (
                        <div key={cat} className="cat-row">
                          <span>{cat}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <input
                              value={legends.radius[cat]}
                              onChange={(e) => updateLegend("radius", cat, e.target.value)}
                              className="field-control"
                              style={{ width: 60, height: 26, textAlign: "right" }}
                            />
                            <span style={{ fontSize: 9, color: "#98a7a3" }}>m</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <SliderRow
                    label="Beam opacity"
                    min={0}
                    max={100}
                    value={opacity}
                    onChange={setOpacity}
                    format={(v) => `${v}%`}
                  />
                </div>

                {/* -------- site points -------- */}
                <div className="sidebar-section border-top">
                  <div className="side-head">Site points</div>
                  <Segmented
                    options={[
                      { value: "single", label: "Single Color" },
                      { value: "category", label: "Categorized" },
                    ]}
                    value={mapping.IconCategory ? "category" : "single"}
                    onChange={(v) =>
                      setMapping((m) => ({
                        ...m,
                        IconCategory:
                          v === "single"
                            ? ""
                            : m.IconCategory ||
                              headers.find((h) => /type|tech|band|cat|region|vendor/i.test(h)) ||
                              headers[0] ||
                              "",
                      }))
                    }
                  />

                  {!mapping.IconCategory ? (
                    <div>
                      <label className="field-label">Point colour</label>
                      <SwatchRow
                        value={defaultIcon.color}
                        onChange={(c) => setDefaultIcon((ic) => ({ ...ic, color: c }))}
                      />
                    </div>
                  ) : (
                    <div>
                      <MapSelect
                        label="Category column"
                        value={mapping.IconCategory}
                        onChange={(v) => setMapping((m) => ({ ...m, IconCategory: v }))}
                        headers={headers}
                        emptyLabel="-- Select column --"
                      />

                      {isColumnNumeric(mapping.IconCategory) && (
                        <Segmented
                          options={[
                            { value: "category", label: "By Category" },
                            { value: "range", label: "By Range" },
                          ]}
                          value={iconMode}
                          onChange={(v) => setIconMode(v as "category" | "range")}
                        />
                      )}

                      {iconMode === "category" && (
                        <div className="mt-2">
                          {Object.keys(legends.icons).map((cat) => (
                            <div key={cat} className="cat-row">
                              <span className="dot" style={{ background: legends.icons[cat].color }} />
                              <span>{cat}</span>
                              <input
                                type="color"
                                value={legends.icons[cat].color}
                                onChange={(e) =>
                                  updateLegend("icons", cat, {
                                    ...legends.icons[cat],
                                    color: e.target.value,
                                  })
                                }
                                className="color-input"
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {iconMode === "range" && (
                        <div className="mt-2">
                          <RangeRows
                            ranges={iconRanges}
                            onChange={(i, patch) =>
                              setIconRanges((rs) =>
                                rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r))
                              )
                            }
                            onAdd={() =>
                              setIconRanges((rs) => [
                                ...rs,
                                {
                                  opMin: ">=",
                                  min: "",
                                  opMax: "<=",
                                  max: "",
                                  iconConfig: { ...DEFAULT_ICON, color: paletteColor(rs.length) },
                                },
                              ])
                            }
                            onRemove={(i) => setIconRanges((rs) => rs.filter((_, idx) => idx !== i))}
                            render={({ range, patch }) => (
                              <input
                                type="color"
                                value={range.iconConfig.color}
                                onChange={(e) =>
                                  patch({
                                    iconConfig: { ...range.iconConfig, color: e.target.value },
                                  })
                                }
                                className="color-input range-color"
                                title="Assign color"
                              />
                            )}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-3">
                    <SliderRow
                      label="Marker scale"
                      min={0.1}
                      max={3}
                      step={0.1}
                      value={globalIconScale}
                      onChange={setGlobalIconScale}
                      format={(v) => `${v.toFixed(1)}×`}
                    />
                    <SliderRow
                      label="Marker opacity"
                      min={10}
                      max={100}
                      step={5}
                      value={markerOpacity}
                      onChange={setMarkerOpacity}
                      format={(v) => `${v}%`}
                    />
                  </div>
                </div>

                {/* -------- layers -------- */}
                <div className="sidebar-section border-top">
                  <div className="side-head">Layers</div>
                  <CheckRow
                    first
                    label="Sector beams"
                    hint="Coverage pies from azimuth, beamwidth and radius"
                    checked={visibility.beams}
                    onChange={(v) => setVisibility((p) => ({ ...p, beams: v }))}
                  />
                  <CheckRow
                    label="Site markers"
                    hint="Vector point for every site"
                    checked={visibility.siteMarkers}
                    onChange={(v) => setVisibility((p) => ({ ...p, siteMarkers: v }))}
                  />
                  <CheckRow
                    label="Site labels"
                    hint="Permanent names next to markers"
                    checked={visibility.siteLabels}
                    onChange={(v) => setVisibility((p) => ({ ...p, siteLabels: v }))}
                  />
                  <CheckRow
                    label="Cell labels"
                    hint="Permanent text over each beam"
                    checked={visibility.cellLabels}
                    onChange={(v) => setVisibility((p) => ({ ...p, cellLabels: v }))}
                  />
                  <div style={{ marginTop: 16 }}>
                    <MapSelect
                      label="Cell label field"
                      value={mapping.CellLabelCol}
                      onChange={(v) => setMapping((m) => ({ ...m, CellLabelCol: v }))}
                      headers={headers}
                      emptyLabel="-- Use Sector / Cell name --"
                    />
                  </div>
                </div>
              </section>
            )}

            {/* ===================== FILTER ===================== */}
            {activeTab === "filter" && (
              <section className="panel-enter" key="filter">
                <div className="intro-section">
                  <div className="section-kicker">Step 04</div>
                  <h1>Draw &amp; export.</h1>
                  <p>
                    Render the network on the map, then export a KMZ for Google Earth. Use the
                    search bar on the map to filter points live.
                  </p>
                </div>

                <div className="sidebar-section border-top">
                  <button
                    className="connect-button"
                    disabled={!data.length || isDrawing}
                    onClick={handleDraw}
                  >
                    {isDrawing ? (
                      <>
                        <span className="spin" />
                        Drawing… {drawProgress}%
                      </>
                    ) : (
                      <>
                        <Icon.Map />
                        Calculate &amp; Draw
                      </>
                    )}
                  </button>
                  <div className="mt-2.5">
                    <button
                      className="secondary-button btn-block"
                      disabled={!drawnSites.length && !drawnSectors.length}
                      onClick={handleExport}
                    >
                      <Icon.Download />
                      Export KMZ for Google Earth
                    </button>
                  </div>
                  <div className="mt-2.5">
                    <button
                      className="secondary-button btn-block"
                      disabled={!data.length}
                      onClick={handleHtmlExport}
                    >
                      <Icon.Html />
                      Download Standalone HTML
                    </button>
                  </div>

                </div>
              </section>
            )}
          </div>
        </aside>

        {/* ---------- map ---------- */}
        <main className="map-area">
          {/* Persistent map toolbar — Point-File-Creator style */}
          <div className="map-toolbar">
            <div className="map-search">
              <Icon.Search />
              <input
                placeholder="Search site name or any field…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button type="button" onClick={() => setSearchTerm("")} title="Clear search">
                  <Icon.X />
                </button>
              )}
            </div>
            <div className="toolbar-divider" />
            <div className="status-filter" style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <select
                value={filterColumn}
                onChange={(e) => {
                  setFilterColumn(e.target.value);
                  setFilterValue("");
                }}
                aria-label="Filter column"
              >
                <option value="">All columns</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            {filterColumn && (
              <>
                <div className="toolbar-divider" />
                <div className="status-filter value-filter">
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    aria-label={`Filter ${filterColumn} value`}
                  >
                    <option value="">All values</option>
                    {uniqueFilterValues.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <div className="toolbar-divider" />
            <button
              onClick={() => setZoomRectActive((prev) => !prev)}
              title={zoomRectActive ? "Cancel zoom" : "Zoom to rectangle — click and drag on the map"}
              aria-pressed={zoomRectActive}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: 0,
                cursor: "pointer",
                color: zoomRectActive ? "#13a38f" : "#738783",
                fontSize: 10,
                fontWeight: zoomRectActive ? 800 : 600,
                letterSpacing: "0.02em",
                padding: "0 10px",
                transition: "all 0.15s ease",
                height: "100%"
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
                <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/>
                <path d="M5 3a2 2 0 0 0-2 2"/>
                <path d="M19 3a2 2 0 0 1 2 2"/>
                <path d="M5 21a2 2 0 0 1-2-2"/>
                <path d="M9 3h1"/>
                <path d="M9 21h2"/>
                <path d="M14 3h1"/>
                <path d="M3 9v1"/>
                <path d="M21 9v2"/>
                <path d="M3 14v1"/>
              </svg>
              Zoom
            </button>
            <div className="toolbar-count" style={{ marginLeft: "auto" }}>
              <strong>{filteredSites.toLocaleString()}</strong>
              <span>/ {totalSites.toLocaleString()} sites</span>
              <span className="tc-sep">·</span>
              <strong>{filteredData.length.toLocaleString()}</strong>
              <span>/ {data.length.toLocaleString()} sectors</span>
            </div>
          </div>

          <MapView
            sites={hasDrawn ? drawnSites : []}
            sectors={hasDrawn ? drawnSectors : []}
            visibility={visibility}
            baseLayer={baseLayer}
            onBaseLayerChange={setBaseLayer}
            markerOpacity={markerOpacity}
            searchTerm={searchTerm}
            zoomRectActive={zoomRectActive}
            onZoomRectChange={setZoomRectActive}
          />
          <ExportPanel
            isOpen={kmzModalOpen}
            onClose={() => setKmzModalOpen(false)}
            onExport={(cfg) => {
              const ok = exportKmz({
                rows: filteredData,
                mapping,
                legends,
                colorRanges,
                iconRanges,
                colorMode,
                iconMode,
                defaultIcon,
                defaultSectorColor,
                defaultBeamwidth,
                defaultRadius,
                opacity,
                globalIconScale,
                markerOpacity,
                showSiteLabels: visibility.siteLabels,
                showCellLabels: visibility.cellLabels,
                exportAppearance: cfg.exportAppearance,
                exportMode: cfg.exportMode,
                exportIconUrl: cfg.exportIconUrl,
                exportIconColor,
                exportIconScale: cfg.exportIconScale,
                exportIconOpacity: cfg.exportIconOpacity,
                exportCategoryIcons: cfg.exportCategoryIcons,
                exportCategoryColors,
              });
              if (!ok) window.alert("No valid rows found to export.");
              else setKmzModalOpen(false);
            }}
            markerSize={globalIconScale}
            markerOpacity={markerOpacity}
            colorMode={iconMode}
            categoryCol={mapping.IconCategory}
            categories={Object.keys(legends.icons)}
            categoryColors={Object.fromEntries(
              Object.entries(legends.icons).map(([k, v]) => [
                k,
                exportCategoryColors[k] ?? v.color,
              ])
            )}
            singleColor={exportIconColor || defaultIcon.color}
            onPickIcon={(target) => {
              setPickerTarget(target === null ? "__single__" : target);
            }}
            appearance={exportAppearance}
            setAppearance={setExportAppearance}
            exportMode={exportMode}
            setExportMode={setExportMode}
            exportIconUrl={exportIconUrl}
            exportIconScale={exportIconScale}
            setExportIconScale={setExportIconScale}
            exportIconOpacity={exportIconOpacity}
            setExportIconOpacity={setExportIconOpacity}
            exportCategoryIcons={exportCategoryIcons}
          />
          <IconPickerModal
            isOpen={pickerTarget !== null}
            onClose={() => setPickerTarget(null)}
            title={
              pickerTarget && pickerTarget !== "__single__"
                ? `Icon — ${pickerTarget}`
                : "Icon — all points"
            }
            current={{
              url:
                pickerTarget && pickerTarget !== "__single__"
                  ? exportCategoryIcons[pickerTarget] ?? exportIconUrl
                  : exportIconUrl,
              // Default to the colour this legend uses on the map
              color:
                pickerTarget && pickerTarget !== "__single__"
                  ? exportCategoryColors[pickerTarget] ??
                    legends.icons[pickerTarget]?.color ??
                    defaultIcon.color
                  : exportIconColor || defaultIcon.color,
              scale: exportIconScale,
              opacity: exportIconOpacity,
            }}
            onSelect={(ic) => {
              if (pickerTarget === "__single__") {
                setExportIconUrl(ic.url);
                setExportIconColor(ic.color);
              } else if (pickerTarget) {
                setExportCategoryIcons((prev) => ({ ...prev, [pickerTarget]: ic.url }));
                setExportCategoryColors((prev) => ({ ...prev, [pickerTarget]: ic.color }));
              }
              setExportIconScale(ic.scale);
              setExportIconOpacity(ic.opacity);
            }}
          />
        </main>
      </div>
    </div>
  );
}



