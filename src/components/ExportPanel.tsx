
import { Icon } from "./ui";
import { VECTOR_CIRCLE, iconName } from "../lib/kmlIcons";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExport: (cfg: {
    exportAppearance: "map" | "custom";
    exportMode: "single" | "category";
    exportIconUrl: string;
    exportIconColor: string;
    exportIconScale: number;
    exportIconOpacity: number;
    exportCategoryIcons: Record<string, string>;
  }) => void;
  // Fallbacks/defaults
  markerSize: number;
  markerOpacity: number;
  colorMode: "category" | "range";
  categoryCol: string;
  categories: string[];
  /** Real colour per category value (from Style tab) */
  categoryColors: Record<string, string>;
  /** Colour used when no category mapping is active */
  singleColor: string;
  onPickIcon: (target: string | null) => void;
  // Current custom values from parent
  appearance: "map" | "custom";
  setAppearance: (v: "map" | "custom") => void;
  exportMode: "single" | "category";
  setExportMode: (v: "single" | "category") => void;
  exportIconUrl: string;
  exportIconScale: number;
  setExportIconScale: (v: number) => void;
  exportIconOpacity: number;
  setExportIconOpacity: (v: number) => void;
  exportCategoryIcons: Record<string, string>;
}

export function ExportPanel({
  isOpen,
  onClose,
  onExport,
  markerSize,
  markerOpacity,
  colorMode,
  categoryCol,
  categories,
  categoryColors,
  singleColor,
  onPickIcon,
  appearance,
  setAppearance,
  exportMode,
  setExportMode,
  exportIconUrl,
  exportIconScale,
  setExportIconScale,
  exportIconOpacity,
  setExportIconOpacity,
  exportCategoryIcons,
}: Props) {
  if (!isOpen) return null;

  return (
    <div className="kmz-modal-overlay" onClick={onClose}>
      <div className="kmz-modal" onClick={(e) => e.stopPropagation()}>
        <div className="kmz-modal-head">
          <span className="kmz-modal-title">Export to Google Earth</span>
          <button className="kmz-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="kmz-modal-body">
          <p className="field-help" style={{ margin: "0 0 14px", fontSize: "11px", color: "#526b68" }}>
            Choose how your points should look inside the KMZ file.
          </p>
          <label className="field-label">Map Appearance</label>
          <div className="segmented mb-3">
            <button
              type="button"
              className={appearance === "map" ? "active" : ""}
              onClick={() => setAppearance("map")}
            >
              Match map
            </button>
            <button
              type="button"
              className={appearance === "custom" ? "active" : ""}
              onClick={() => setAppearance("custom")}
            >
              Custom icons
            </button>
          </div>

          {appearance === "map" ? (
            <div className="kmz-preview">
              <span
                className="kmz-preview-dot"
                style={{
                  background: singleColor,
                  width: Math.max(8, 12 * markerSize),
                  height: Math.max(8, 12 * markerSize),
                  opacity: markerOpacity / 100,
                }}
              />
              <div className="kmz-preview-info">
                <strong>
                  {colorMode === "category" && categoryCol
                    ? "Vector points · category colours"
                    : "Vector points · single colour"}
                </strong>
                <small>
                  {colorMode === "category" && categoryCol && `Grouped by ${categoryCol} · `}
                  Scale {markerSize.toFixed(1)}× · Opacity {markerOpacity}% — exactly as shown on the map.
                  Site names and popup fields are included.
                </small>
              </div>
            </div>
          ) : (
            <>
              <label className="field-label">Icon mode</label>
              <div className="segmented mb-3">
                <button
                  type="button"
                  className={exportMode === "single" ? "active" : ""}
                  onClick={() => setExportMode("single")}
                >
                  Single icon
                </button>
                <button
                  type="button"
                  className={exportMode === "category" ? "active" : ""}
                  onClick={() => setExportMode("category")}
                >
                  Per category
                </button>
              </div>

              {exportMode === "single" && (
                <div
                  className="cat-row cursor-pointer hover:bg-slate-50 mb-3"
                  onClick={() => onPickIcon(null)}
                >
                  <span>Icon for all points</span>
                  <span
                    style={{
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "#849692",
                        maxWidth: 100,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={iconName(exportIconUrl)}
                    >
                      {iconName(exportIconUrl)}
                    </span>
                    {exportIconUrl === VECTOR_CIRCLE ? (
                      <span
                        className="kmz-preview-dot"
                        style={{ width: 16, height: 16, background: singleColor, flex: "none" }}
                      />
                    ) : (
                      <img
                        src={exportIconUrl}
                        alt=""
                        style={{ width: 22, height: 22, objectFit: "contain", flex: "none" }}
                      />
                    )}
                  </span>
                </div>
              )}

              {exportMode === "category" && (
                <div className="mb-3">
                  {!categoryCol ? (
                    <div className="note warn">Select a category column in Style first.</div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] font-bold text-slate-600">Icon per value</span>
                        <span className="text-[9px] font-bold text-slate-400">{categories.length} groups</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto border border-slate-200 bg-slate-50 p-1.5 rounded">
                        {categories.map((val) => {
                          const url = exportCategoryIcons[val] ?? exportIconUrl;
                          const col = categoryColors[val] ?? singleColor;
                          return (
                            <div
                              key={val}
                              className="cat-row cursor-pointer hover:bg-white"
                              onClick={() => onPickIcon(val)}
                            >
                              {/* legend name — left */}
                              <span>{val}</span>

                              {/* icon control — right */}
                              <span
                                style={{
                                  flex: "none",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    color: "#849692",
                                    maxWidth: 90,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                  title={iconName(url)}
                                >
                                  {iconName(url)}
                                </span>
                                {url === VECTOR_CIRCLE ? (
                                  <span
                                    className="kmz-preview-dot"
                                    style={{ width: 14, height: 14, background: col, flex: "none" }}
                                  />
                                ) : (
                                  <img
                                    src={url}
                                    alt=""
                                    style={{ width: 18, height: 18, objectFit: "contain", flex: "none" }}
                                  />
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="range-slider">
                <div className="range-head">
                  <label className="field-label">Icon scale</label>
                  <span className="range-val">{exportIconScale.toFixed(1)}×</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={4}
                  step={0.1}
                  value={exportIconScale}
                  onChange={(e) => setExportIconScale(parseFloat(e.target.value))}
                />
              </div>

              <div className="range-slider">
                <div className="range-head">
                  <label className="field-label">Icon opacity</label>
                  <span className="range-val">{Math.round(exportIconOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={exportIconOpacity}
                  onChange={(e) => setExportIconOpacity(parseFloat(e.target.value))}
                />
              </div>
            </>
          )}

          <div className="kmz-modal-actions mt-5">
            <button className="secondary-button btn-block" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button btn-block"
              onClick={() => {
                onExport({
                  exportAppearance: appearance,
                  exportMode,
                  exportIconUrl,
                  exportIconColor: "", // Inherit from map style
                  exportIconScale,
                  exportIconOpacity,
                  exportCategoryIcons,
                });
              }}
            >
              <Icon.Download />
              Export KMZ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
