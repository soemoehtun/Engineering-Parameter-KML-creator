import { useEffect, useRef, useState } from "react";
import { ICON_GROUPS, VECTOR_CIRCLE, NO_ICON, iconName } from "../lib/kmlIcons";

function IconCell({
  url,
  selected,
  onClick,
  onDoubleClick,
}: {
  url: string;
  selected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div
      className={`ge-cell ${selected ? "sel" : ""}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title={iconName(url)}
    >
      <img src={url} alt="" loading="lazy" onError={() => setHidden(true)} />
    </div>
  );
}

export interface IconChoice {
  url: string;
  color: string;
  scale: number;
  opacity: number;
}

function Spinner({ onUp, onDown }: { onUp: () => void; onDown: () => void }) {
  return (
    <span className="ge-spin">
      <button type="button" onClick={onUp}>▲</button>
      <button type="button" onClick={onDown}>▼</button>
    </span>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (icon: IconChoice) => void;
  current: IconChoice;
  title?: string;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function IconPickerModal({ isOpen, onClose, onSelect, current, title }: Props) {
  const [url, setUrlRaw] = useState(current.url);
  const [color, setColor] = useState(current.color);

  const setUrl = (newUrl: string) => {
    const wasVector = url === VECTOR_CIRCLE;
    const isVector = newUrl === VECTOR_CIRCLE;
    setUrlRaw(newUrl);
    if (wasVector && !isVector) setColor("#ffffff");
    else if (!wasVector && isVector) setColor("#ff0000");
  };

  const [scale, setScale] = useState(current.scale);
  const [opacity, setOpacity] = useState(current.opacity);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setUrlRaw(current.url);
    setColor(current.color);
    setScale(current.scale);
    setOpacity(current.opacity);
  }, [isOpen, current]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      gridRef.current?.querySelector(".ge-cell.sel")?.scrollIntoView({ block: "center" });
    }, 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") ok();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!isOpen) return null;

  const ok = () => {
    onSelect({ url, color, scale, opacity });
    onClose();
  };

  const isVector = url === VECTOR_CIRCLE;
  const isNone = url === NO_ICON;

  return (
    <div className="ge-overlay" onClick={onClose}>
      <div className="ge-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ge-titlebar">
          <span>{title ?? "Icon"}</span>
          <button className="ge-x" onClick={onClose}>✕</button>
        </div>

        <div className="ge-top">
          <div className="ge-preview">
            <div className="ge-preview-inner" style={{ opacity }}>
              {isNone ? (
                <span className="ge-none-text">none</span>
              ) : isVector ? (
                <div
                  style={{
                    width: clamp(30 * scale, 6, 52),
                    height: clamp(30 * scale, 6, 52),
                    borderRadius: "50%",
                    background: color,
                  }}
                />
              ) : (
                <span
                  style={{
                    position: "relative",
                    display: "inline-flex",
                    transform: `scale(${clamp(scale, 0.4, 1.5)})`,
                  }}
                >
                  <img src={url} alt="" style={{ maxWidth: 46, maxHeight: 46, objectFit: "contain", display: "block" }} />
                  <span style={{ position: "absolute", inset: 0, background: color, mixBlendMode: "multiply", pointerEvents: "none" }} />
                </span>
              )}
            </div>
          </div>

          <div className="ge-fields">
            <div className="ge-field-row">
              <label title="KML colour tint applied by Google Earth — white icons become this colour">Color:</label>
              <input type="color" className="ge-color" value={color} onChange={(e) => setColor(e.target.value)} />

              <label>Scale:</label>
              <input className="ge-num" type="number" min={0.1} max={4} step={0.1} value={scale} onChange={(e) => setScale(clamp(parseFloat(e.target.value) || 0.1, 0.1, 4))} />
              <Spinner onUp={() => setScale((s) => clamp(+(s + 0.1).toFixed(1), 0.1, 4))} onDown={() => setScale((s) => clamp(+(s - 0.1).toFixed(1), 0.1, 4))} />

              <label>Opacity:</label>
              <input className="ge-num" type="number" min={0} max={100} step={5} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(clamp((parseInt(e.target.value) || 0) / 100, 0, 1))} />
              <Spinner onUp={() => setOpacity((o) => clamp(+(o + 0.05).toFixed(2), 0, 1))} onDown={() => setOpacity((o) => clamp(+(o - 0.05).toFixed(2), 0, 1))} />
            </div>

            <input className="ge-url" value={isVector || isNone ? iconName(url) : url} onChange={(e) => setUrl(e.target.value)} spellCheck={false} />
          </div>
        </div>

        <div className="ge-gridwrap">
          <div className="ge-grid" ref={gridRef}>
            <div className={`ge-cell ${isVector ? "sel" : ""}`} onClick={() => setUrl(VECTOR_CIRCLE)} onDoubleClick={ok} title="Vector circle">
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: color, display: "block" }} />
            </div>

            {ICON_GROUPS.flatMap((g) => [
              <div key={`hdr-${g.id}`} className="ge-group">{g.label}</div>,
              ...g.icons.map((u) => (
                <IconCell key={u} url={u} selected={url === u} onClick={() => setUrl(u)} onDoubleClick={ok} />
              )),
            ])}
          </div>
        </div>

        <div className="ge-foot">
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" onClick={ok}>OK</button>
        </div>
      </div>
    </div>
  );
}
