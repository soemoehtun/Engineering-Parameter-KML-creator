import type {
  BaseLayerKey,
  ColorRange,
  DataRow,
  IconConfig,
  IconRange,
  Legends,
  Mapping,
  Visibility,
} from "../types";

export interface ProjectState {
  version: 1;
  fileName: string;
  headers: string[];
  data: DataRow[];
  mapping: Mapping;
  legends: Legends;
  colorRanges: ColorRange[];
  iconRanges: IconRange[];
  colorMode: "category" | "range";
  iconMode: "category" | "range";
  defaultIcon: IconConfig;
  defaultSectorColor: string;
  defaultBeamwidth: number;
  defaultRadius: number;
  opacity: number;
  globalIconScale: number;
  markerOpacity: number;
  visibility: Visibility;
  baseLayer: BaseLayerKey;
  drawn: boolean;
}

declare global {
  interface Window {
    __EP_PROJECT__?: ProjectState;
  }
}

function downloadBlob(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string)
  );
}

/**
 * Generate a fully interactive, self-contained standalone HTML file.
 * The recipient gets the whole app: editable Parameters tab (column mapping,
 * colours, beam/radius, opacity, layers, basemap), Data preview tab, live
 * search/filter toolbar, and the Leaflet map — all with the dataset embedded.
 */
export function exportStandaloneHtml(state: ProjectState): Promise<void> {
  const filename = `${(state.fileName || "network").replace(/\.[^.]+$/, "") || "project"}.html`;
  const projectJson = JSON.stringify(state).replace(/</g, "\\u003c");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escHtml(state.fileName || "Network Export")} — Cell Parameter Viewer</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; background: #f7f9f8; }
  #app { display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden; }
  header { height: 48px; flex: none; display: flex; align-items: center; gap: 11px; padding: 0 16px; background: #fffffff5; border-bottom: 1px solid #dfe6e3; z-index: 1200; }
  header .menu-btn { background: transparent; border: 0; color: #111; width: 34px; height: 34px; display: grid; place-items: center; cursor: pointer; flex: none; }
  header .menu-btn:hover { background: #f2f2f2; }
  header .brand { font-size: 14px; font-weight: 850; letter-spacing: 0.14em; color: #102f32; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  header .meta { margin-left: auto; font-size: 11px; color: #849692; font-weight: 650; white-space: nowrap; }

  .workspace { flex: 1; min-height: 0; display: flex; position: relative; }

  /* --- sidebar (matches main tool: 382px, teal tab underline) --- */
  .sidebar { width: 382px; flex: 0 0 382px; background: #fff; border-right: 1px solid #dce5e2; display: flex; flex-direction: column; transition: flex-basis .25s ease, width .25s ease, opacity .2s ease; }
  .sidebar.collapsed { flex-basis: 0; width: 0; border-right: 0; opacity: 0; overflow: hidden; pointer-events: none; }
  .tabs { height: 52px; flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 8px 12px 7px; border-bottom: 1px solid #e6ecea; }
  .tabs button { border: 0; background: transparent; color: #738783; font-size: 10px; font-weight: 700; letter-spacing: .02em; cursor: pointer; position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; }
  .tabs button svg { width: 14px; height: 14px; flex: none; }
  .tabs button:after { content: ""; position: absolute; left: 20%; right: 20%; bottom: -7px; height: 2px; background: #13a38f; transform: scaleX(0); transition: transform .2s; }
  .tabs button.active { color: #143b3d; }
  .tabs button.active:after { transform: scaleX(1); }
  .side-scroll { flex: 1; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: #ccd7d4 transparent; }

  /* intro headers per tab (Step 01..04) */
  .intro-sec { padding: 25px 20px 22px; }
  .kicker { color: #0f9382; letter-spacing: .17em; margin-bottom: 9px; font-size: 9px; font-weight: 850; text-transform: uppercase; }
  .intro-sec h1 { color: #122f31; letter-spacing: -.025em; max-width: 310px; margin: 0; font-size: 20px; font-weight: 760; line-height: 1.25; }
  .intro-sec p { color: #6b7f7c; margin: 9px 0 0; font-size: 11.5px; line-height: 1.65; }

  .side-sec { padding: 20px; border-top: 1px solid #e6ecea; }
  .side-head { font-size: 10.5px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #143b3d; margin-bottom: 12px; }
  .param-field { margin-bottom: 12px; }
  .param-field:last-child { margin-bottom: 0; }
  .param-field label { display: block; font-size: 10px; font-weight: 750; color: #395652; margin-bottom: 6px; line-height: 14px; }
  .psel, .pnum { width: 100%; height: 38px; border: 1px solid #d1dcda; border-radius: 0; background: #fff; color: #284744; font-size: 11px; padding: 0 10px; outline: 0; }
  .psel { cursor: pointer; appearance: none;
    background-image: linear-gradient(45deg, transparent 50%, #70827f 50%), linear-gradient(135deg, #70827f 50%, transparent 50%);
    background-position: calc(100% - 15px) 16px, calc(100% - 11px) 16px; background-repeat: no-repeat; background-size: 4px 4px; padding-right: 25px; }
  .psel:focus, .pnum:focus { border-color: #139483; box-shadow: 0 0 0 3px rgba(19,148,131,.08); }
  .prange { -webkit-appearance: none; appearance: none; width: 100%; height: 3px; background: #d1dcda; outline: none; cursor: pointer; }
  .prange::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 2px; background: #0d3437; border: 2px solid #fff; box-shadow: 0 1px 3px rgba(19,52,55,.35); cursor: pointer; }
  .prow2 { display: flex; align-items: center; gap: 8px; }
  .prow2 .pnum { width: 70px; height: 30px; text-align: right; }
  .pval { font-size: 9.5px; color: #34514e; font-weight: 800; white-space: nowrap; background: #eef3f1; border: 1px solid #e0e8e5; padding: 1px 6px; }
  .pcolor { width: 26px; height: 26px; padding: 1px; border: 1px solid #cfdad7; background: #fff; flex: none; cursor: pointer; }
  .pcheck { display: flex; align-items: flex-start; gap: 9px; margin-top: 12px; font-size: 10.5px; font-weight: 750; color: #34514e; cursor: pointer; user-select: none; }
  .pcheck input { width: 14px; height: 14px; accent-color: #143b3d; cursor: pointer; margin-top: 1px; flex: none; }
  .bulk-links { display: flex; gap: 12px; margin-bottom: 8px; }
  .bulk-links button { background: 0 0; border: 0; color: #0f9382; font-size: 10px; font-weight: 750; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 2px; }
  .check-list { border: 1px solid #e2eae7; background: #fbfdfc; max-height: 180px; overflow-y: auto; padding: 8px 10px; }
  .check-list .pcheck { margin-top: 6px; }
  .check-list .pcheck:first-child { margin-top: 0; }
  .file-chip { display: flex; align-items: center; gap: 9px; border: 1px solid #d8e2df; background: #fff; padding: 9px 10px; margin-bottom: 12px; }
  .file-chip strong { display: block; color: #1c3d3b; font-size: 10.5px; font-weight: 750; }
  .file-chip small { color: #849692; font-size: 9.5px; }
  .seg { display: flex; gap: 3px; background: #eef3f1; padding: 3px; border: 1px solid #e0e8e5; margin-bottom: 12px; }
  .seg button { flex: 1; height: 26px; font-size: 10px; font-weight: 750; color: #738783; background: transparent; border: 1px solid transparent; cursor: pointer; }
  .seg button.on { background: #fff; color: #143b3d; border-color: #d1dcda; box-shadow: 0 1px 2px rgba(19,52,55,.08); }
  .cat-line { display: flex; align-items: center; gap: 8px; border: 1px solid #e2eae7; background: #fbfdfc; padding: 6px 9px; margin-bottom: 5px; }
  .cat-line span { flex: 1; min-width: 0; font-size: 10.5px; font-weight: 650; color: #34514e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* cat-row: matches main tool exactly */
  .cat-row { display: flex; align-items: center; gap: 8px; border: 1px solid #e2eae7; background: #fbfdfc; padding: 6px 9px; margin-bottom: 5px; }
  .cat-row .dot { width: 11px; height: 11px; border-radius: 50%; flex: none; border: 1px solid rgba(255,255,255,.8); box-shadow: 0 0 0 1px rgba(19,52,55,.12); }
  .cat-row > span { flex: 1; min-width: 0; font-size: 10.5px; font-weight: 650; color: #34514e; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* color-input: matches tool's color picker (solid colour swatch, no conic gradient here) */
  .color-input { width: 24px; height: 24px; flex: none; padding: 0; border: 1px solid #cfdad7; background: #fff; cursor: pointer; border-radius: 0; }
  .color-input::-webkit-color-swatch-wrapper { padding: 2px; }
  .color-input::-webkit-color-swatch { border: none; }
  .color-input::-moz-color-swatch { border: none; }
  .range-row2 { border: 1px solid #e2eae7; background: #fbfdfc; padding: 7px 9px; margin-bottom: 6px; }
  .range-row2 .rline { display: flex; align-items: center; gap: 5px; width: 100%; }
  .range-row2 select { background: transparent; border: 0; outline: 0; font-size: 10.5px; font-weight: 800; color: #526b68; cursor: pointer; width: 30px; }
  .range-row2 input.pnum { width: 52px; height: 26px; border: 1px solid #d1dcda; background: #fff; font-size: 10.5px; color: #284744; padding: 0 6px; outline: 0; text-align: left; }
  .range-row2 .amp { font-size: 9px; font-weight: 800; color: #98a7a3; }
  .range-row2 .range-color { margin-left: auto; width: 24px; height: 24px; padding: 0; flex: none; border: 1px solid #cfdad7; cursor: pointer; }
  .range-row2 .rm { background: transparent; border: 0; color: #c2574b; font-size: 15px; line-height: 1; cursor: pointer; padding: 2px 4px; flex: none; }
  .swrow { display: flex; flex-wrap: nowrap; align-items: center; gap: 3px; width: 100%; }
  .sw { flex: 1 1 0%; min-width: 0; height: 24px; border: 1px solid rgba(0,0,0,.15); cursor: pointer; padding: 0; }
  .sw.on { border: 2px solid #102f32; box-shadow: 0 0 0 1.5px #fff inset; }
  /* custom colour picker in swatch row — rainbow conic-gradient like the tool */
  .swrow .pcolor {
    width: 24px; height: 24px; flex: none; padding: 0; border: 1px solid #cfdad7; cursor: pointer; border-radius: 0;
    background: conic-gradient(from 90deg, #ef4444, #f97316, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444);
  }
  .swrow .pcolor::-webkit-color-swatch-wrapper { padding: 0; }
  .swrow .pcolor::-webkit-color-swatch { border: none; opacity: 0; }
  .swrow .pcolor::-moz-color-swatch { border: none; opacity: 0; }
  .slide-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
  .slide-head label { margin: 0 !important; }
  .btn-dark { width: 100%; height: 38px; border: 0; background: #0d3437; color: #fff; font-size: 11px; font-weight: 750; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px; }
  .btn-dark:hover { background: #165055; }
  .btn-line { width: 100%; height: 36px; border: 1px solid #d8e2df; background: #fff; color: #274542; font-size: 11px; font-weight: 750; cursor: pointer; margin-top: 10px; }
  .btn-line:hover { background: #f3f7f5; }
  .swatch-line { display: flex; align-items: center; gap: 7px; padding: 4px 0; font-size: 10px; border-bottom: 1px solid #f2f6f5; }
  .swatch-line:last-child { border-bottom: 0; }
  .swatch-line i { width: 11px; height: 11px; border-radius: 50%; flex: none; display: block; }
  .swatch-line span { color: #284744; font-weight: 650; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0; }
  .prev-wrap { max-height: 260px; overflow: auto; border: 1px solid #e2eae7; }
  table.prev { border-collapse: collapse; width: 100%; font-size: 9.5px; }
  table.prev th { position: sticky; top: 0; background: #f2f6f5; color: #526b68; font-size: 8.5px; font-weight: 800; letter-spacing: .05em; text-transform: uppercase; text-align: left; padding: 5px 7px; border-bottom: 1px solid #e2eae7; white-space: nowrap; }
  table.prev td { color: #2c4a47; padding: 4px 7px; border-bottom: 1px solid #f2f6f5; white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }

  /* --- map + toolbar --- */
  #map { flex: 1; min-width: 0; position: relative; background: #fff; display: flex; flex-direction: column; }
  .map-toolbar { flex: none; display: flex; align-items: center; height: 36px; background: #fff; border-bottom: 1px solid #dce5e2; z-index: 100; }
  .map-search { display: flex; align-items: center; min-width: 140px; flex: 0 1 280px; height: 100%; padding: 0 6px 0 10px; }
  .map-search svg { width: 13px; height: 13px; color: #78908c; flex: none; }
  .map-search input { border: 0; outline: 0; background: transparent; color: #183c3e; font-size: 11px; height: 100%; min-width: 0; flex: 1; padding: 0 8px; }
  .map-search input::placeholder { color: #a5b3b0; }
  .map-search button { background: 0 0; border: 0; color: #8fa19d; cursor: pointer; height: 100%; padding: 0 8px; display: grid; place-items: center; flex: none; }
  .map-search button:hover { color: #2c4a47; }
  .tb-div { width: 1px; height: 22px; background: #e2eae7; flex: none; }
  .status-filter { height: 100%; display: flex; align-items: center; flex: none; padding: 0 4px; }
  .status-filter select { appearance: none; border: 0; outline: 0; background: transparent; color: #284744; font-size: 11px; font-weight: 650; height: 100%; padding: 0 28px 0 12px; cursor: pointer; max-width: 170px;
    background-image: linear-gradient(45deg, transparent 50%, #70827f 50%), linear-gradient(135deg, #70827f 50%, transparent 50%);
    background-position: calc(100% - 14px) 16px, calc(100% - 10px) 16px; background-repeat: no-repeat; background-size: 4px 4px; }
  .zoom-rect-btn { display:flex; align-items:center; gap:5px; background:none; border:0; cursor:pointer; color:#738783; font-size:10px; font-weight:600; letter-spacing:.02em; padding:0 10px; height:100%; flex:none; transition:all .15s ease; white-space:nowrap; }
  .zoom-rect-btn.active { color:#13a38f; font-weight: 800; }
  .zoom-rect-btn svg { flex:none; }
  .zoom-rect-btn:hover { color:#143b3d; }
  .zoom-rect-overlay { position:absolute; border:2px dashed #13a38f; background:rgba(19,163,143,0.10); pointer-events:none; z-index:2000; box-sizing:border-box; display:none; }
  .toolbar-count { height: 100%; display: flex; align-items: center; gap: 3px; padding: 0 14px; color: #849692; font-size: 10.5px; font-weight: 650; white-space: nowrap; flex: none; }
  .toolbar-count strong { color: #143b3d; font-weight: 800; }
  .toolbar-count .sep { color: #c3d1cd; margin: 0 6px; }
  #mapc { flex: 1; min-height: 0; position: relative; }
  .leaflet-control-zoom { border: none !important; box-shadow: 0 2px 8px rgba(19,52,55,.12) !important; border-radius: 0 !important; }
  .leaflet-control-zoom a { width: 30px !important; height: 30px !important; line-height: 30px !important; font-size: 14px !important; color: #34514e !important; border-color: #dfe6e3 !important; border-radius: 0 !important; }

  /* basemap switcher — same as tool map: top-right 12px */
  .layers { position: absolute; top: 12px; right: 12px; z-index: 1000; }
  .layers .lbtn { width: 44px; height: 44px; border: 2px solid #fff; box-shadow: 0 2px 10px rgba(0,0,0,.25); cursor: pointer; overflow: hidden; background-size: cover; background-position: center; padding: 0; display: block; }
  .layers .lpanel { display: none; gap: 8px; background: #fff; padding: 8px; box-shadow: 0 4px 20px rgba(15,23,42,.2); }
  .layers.open .lpanel { display: flex; }
  .layers.open .lbtn { display: none; }
  .layers .ltile { width: 60px; text-align: center; cursor: pointer; padding: 2px; }
  .layers .ltile:hover { background: #f3f7f5; }
  .layers .lthumb { width: 56px; height: 40px; background-size: cover; background-position: center; border: 2px solid transparent; margin: 0 auto; }
  .layers .ltile.active .lthumb { border-color: #13a38f; }
  .layers .llabel { font-size: 10px; font-weight: 600; color: #6b7f7c; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .layers .ltile.active .llabel { color: #0f9382; }


  .pg-pop { background: #fff; font-family: inherit; }
  .pg-pop-head { display: flex; align-items: center; gap: 7px; background: #f2f6f5; border-bottom: 1px solid #e2eae7; padding: 6px 10px; }
  .pg-pop-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; box-shadow: 0 0 0 1px rgba(19,52,55,.15); }
  .pg-pop-title { font-size: 10.5px; font-weight: 750; color: #143b3d; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pg-pop-body { padding: 2px 0; }
  .pg-pop-row { display: flex; gap: 12px; padding: 3px 10px; font-size: 9px; border-bottom: 1px solid #eef3f1; }
  .pg-pop-row:last-child { border-bottom: 0; }
  .pg-pop-k { color: #6b7f7c; font-weight: 650; flex: 0 0 42%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pg-pop-v { color: #183c3e; font-weight: 650; flex: 1; word-break: break-word; }
  .leaflet-popup-content-wrapper { border-radius: 0; padding: 0; overflow: hidden; box-shadow: 0 3px 14px rgba(0,0,0,.2); }
  .leaflet-popup-content { margin: 0; min-width: 170px; }
  .site-label { background: transparent!important; border: none!important; box-shadow: none!important; color: #102f32; font-size: 11px; font-weight: 800; text-shadow: -1.5px -1.5px 0 #fff,1.5px -1.5px 0 #fff,-1.5px 1.5px 0 #fff,1.5px 1.5px 0 #fff; }
  .site-label::before { display: none!important; }
  .beam-label { background: transparent!important; border: none!important; box-shadow: none!important; color: #102f32; font-size: 10px; font-weight: 800; text-shadow: -1px -1px 0 #fff,1px -1px 0 #fff,-1px 1px 0 #fff,1px 1px 0 #fff; }
  .beam-label::before { display: none!important; }
  .credit { position: absolute; bottom: 8px; right: 10px; z-index: 850; font-size: 9px; color: #a9b6b3; background: #ffffffcc; padding: 2px 6px; }
</style>
</head>
<body>
<div id="app">
  <header>
    <button class="menu-btn" id="menu-btn" title="Toggle panel">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
    </button>
    <span class="brand">CELL PARAMETER KMZ</span>
  </header>

  <div class="workspace">
    <aside class="sidebar" id="sidebar">
      <nav class="tabs">
        <button id="tab-upload" class="active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5V15"/><path d="M12 15V4"/><path d="M7.5 8.5 12 4l4.5 4.5"/></svg>
          Upload
        </button>
        <button id="tab-columns">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.5h17"/><path d="M10 9.5V20"/></svg>
          Columns
        </button>
        <button id="tab-style">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/></svg>
          Style
        </button>
        <button id="tab-filter">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16l-6 7.2V19l-4-2v-4.8L4 5z"/></svg>
          Export
        </button>
      </nav>
      <div class="side-scroll">
        <div id="panel-upload"></div>
        <div id="panel-columns" style="display:none"></div>
        <div id="panel-style" style="display:none"></div>
        <div id="panel-filter" style="display:none"></div>
      </div>
    </aside>

    <div id="map">
      <div class="map-toolbar">
        <div class="map-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input id="search" placeholder="Search site name or any field…" />
          <button id="search-clear" title="Clear search" style="display:none">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="tb-div"></div>
        <div class="status-filter">
          <select id="colfilter" aria-label="Filter column"><option value="">All columns</option></select>
        </div>
        <div class="tb-div" id="valfilter-div" style="display:none"></div>
        <div class="status-filter value-filter" id="valfilter-container" style="display:none">
          <select id="valfilter" aria-label="Filter value"><option value="">All values</option></select>
        </div>
        <div class="tb-div"></div>
        <button id="zoom-rect-btn" class="zoom-rect-btn" title="Zoom to rectangle — click and drag on the map">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z"/>
            <path d="M5 3a2 2 0 0 0-2 2"/><path d="M19 3a2 2 0 0 1 2 2"/><path d="M5 21a2 2 0 0 1-2-2"/>
            <path d="M9 3h1"/><path d="M9 21h2"/><path d="M14 3h1"/>
            <path d="M3 9v1"/><path d="M21 9v2"/><path d="M3 14v1"/>
          </svg>
          Zoom
        </button>
        <div class="toolbar-count" id="count-badge" style="margin-left:auto"></div>
      </div>
      <div id="mapc">
        <div class="layers" id="layers"></div>
      </div>
    </div>
  </div>
</div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
window.__EP_PROJECT__ = ${projectJson};
(function () {
  var P = window.__EP_PROJECT__;
  var data = P.data, headers = P.headers;

  /* ---------- editable working state (initialized from exported project) ---------- */
  var S = {
    mapping: JSON.parse(JSON.stringify(P.mapping)),
    colorMode: P.colorMode || "category",
    iconMode: P.iconMode || "category",
    defaultSectorColor: P.defaultSectorColor || "#0ea5e9",
    defaultBeamwidth: P.defaultBeamwidth || 65,
    defaultRadius: P.defaultRadius || 280,
    opacity: P.opacity != null ? P.opacity : 55,
    globalIconScale: P.globalIconScale || 1,
    markerOpacity: P.markerOpacity != null ? P.markerOpacity : 100,
    pointColor: (P.defaultIcon && P.defaultIcon.color) || "#ef4444",
    visibility: {
      beams: P.visibility ? P.visibility.beams !== false : true,
      siteMarkers: P.visibility ? P.visibility.siteMarkers !== false : true,
      siteLabels: P.visibility ? !!P.visibility.siteLabels : false,
      cellLabels: P.visibility ? !!P.visibility.cellLabels : false
    },
    baseLayer: P.baseLayer || "satellite",
    legends: JSON.parse(JSON.stringify(P.legends || {})),
    colorRanges: JSON.parse(JSON.stringify(P.colorRanges || [])),
    iconRanges: JSON.parse(JSON.stringify(P.iconRanges || []))
  };
  if (!S.legends.color) S.legends.color = {};
  if (!S.legends.beam) S.legends.beam = {};
  if (!S.legends.radius) S.legends.radius = {};
  if (!S.legends.icons) S.legends.icons = {};

  var PALETTE = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#6366f1", "#0ea5e9"];

  /* ---------- geo helpers ---------- */
  var METERS_PER_DEG_LAT = 111320;
  function calcSectorPolygon(lat, lon, azimuth, beamwidth, radius) {
    var points = [], steps = Math.max(10, Math.ceil(beamwidth / 2));
    var startAngle = azimuth - beamwidth / 2, endAngle = azimuth + beamwidth / 2;
    var latRad = (lat * Math.PI) / 180, r = Math.max(0, radius || 0);
    points.push([lat, lon]);
    for (var i = 0; i <= steps; i++) {
      var angle = ((startAngle + (endAngle - startAngle) * (i / steps)) * Math.PI) / 180;
      var dLat = (r * Math.cos(angle)) / METERS_PER_DEG_LAT;
      var dLon = (r * Math.sin(angle)) / (METERS_PER_DEG_LAT * Math.cos(latRad));
      points.push([lat + dLat, lon + dLon]);
    }
    points.push([lat, lon]);
    return points;
  }
  function evalRange(value, range) {
    var minOk = true, maxOk = true;
    if (range.min !== "" && range.min != null && !isNaN(parseFloat(range.min))) {
      var mn = parseFloat(range.min);
      if (range.opMin === ">=") minOk = value >= mn;
      else if (range.opMin === ">") minOk = value > mn;
      else if (range.opMin === "=") minOk = value === mn;
      else if (range.opMin === "!=") minOk = value !== mn;
    }
    if (range.max !== "" && range.max != null && !isNaN(parseFloat(range.max))) {
      var mx = parseFloat(range.max);
      if (range.opMax === "<=") maxOk = value <= mx;
      else if (range.opMax === "<") maxOk = value < mx;
      else if (range.opMax === "=") maxOk = value === mx;
      else if (range.opMax === "!=") maxOk = value !== mx;
      else if (range.opMax === ">=") maxOk = value >= mx;
      else if (range.opMax === ">") maxOk = value > mx;
    }
    return minOk && maxOk;
  }
  function resolveStyle(row) {
    var m = S.mapping;
    var icon = { color: S.pointColor, scale: 1, opacity: 1 };
    var color = S.defaultSectorColor, beamwidth = S.defaultBeamwidth, radius = S.defaultRadius;
    if (m.IconCategory) {
      if (S.iconMode === "range") {
        var n = parseFloat(row[m.IconCategory]);
        if (!isNaN(n)) for (var i = 0; i < S.iconRanges.length; i++) if (evalRange(n, S.iconRanges[i])) { icon = S.iconRanges[i].iconConfig; break; }
      } else if (S.legends.icons[row[m.IconCategory]]) icon = S.legends.icons[row[m.IconCategory]];
    }
    if (m.ColorCode) {
      if (S.colorMode === "range") {
        var n2 = parseFloat(row[m.ColorCode]);
        if (!isNaN(n2)) for (var j = 0; j < S.colorRanges.length; j++) if (evalRange(n2, S.colorRanges[j])) { color = S.colorRanges[j].color; break; }
      } else if (S.legends.color[row[m.ColorCode]]) color = S.legends.color[row[m.ColorCode]];
    }
    if (m.BeamCategory) { var bv = parseFloat(S.legends.beam[row[m.BeamCategory]]); if (!isNaN(bv)) beamwidth = bv; }
    if (m.RadiusCategory) { var rv = parseFloat(S.legends.radius[row[m.RadiusCategory]]); if (!isNaN(rv)) radius = rv; }
    return { icon: icon, color: color, beamwidth: beamwidth, radius: radius };
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function buildPopup(row, cols, name, accent) {
    var shown = (cols || []).filter(Boolean), body = "";
    for (var i = 0; i < shown.length; i++) {
      var c = shown[i], val = row[c] == null ? "" : String(row[c]).trim();
      body += '<div class="pg-pop-row"><span class="pg-pop-k">' + esc(c) + '</span><span class="pg-pop-v">' + (val ? esc(val) : "—") + "</span></div>";
    }
    if (!body) body = '<div class="pg-pop-row"><span class="pg-pop-k">No popup columns selected.</span></div>';
    var dot = accent ? '<span class="pg-pop-dot" style="background:' + esc(accent) + '"></span>' : "";
    return '<div class="pg-pop"><div class="pg-pop-head">' + dot + '<span class="pg-pop-title">' + esc(name || "Point") + '</span></div><div class="pg-pop-body">' + body + "</div></div>";
  }
  function circleRadius(icon) { return Math.max(2, 5 * (icon.scale || 1) * (S.globalIconScale || 1)); }

  /* ---------- map ---------- */
  var BASEMAPS = {
    light: { label: "Light", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", sub: "abcd", thumb: "https://a.basemaps.cartocdn.com/light_all/12/3143/1852.png" },
    dark: { label: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", sub: "abcd", thumb: "https://a.basemaps.cartocdn.com/dark_all/12/3143/1852.png" },
    satellite: { label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", sub: "", thumb: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1852/3143" },
    osm: { label: "OSM", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", sub: "abc", thumb: "https://tile.openstreetmap.org/12/3143/1852.png" }
  };
  var map = L.map("mapc", { zoomControl: false, attributionControl: true, center: [16.8661, 96.1951], zoom: 6 });
  var tileLayer = null;
  var currentBase = S.baseLayer || "satellite";
  function setBase(key) {
    var cfg = BASEMAPS[key] || BASEMAPS.satellite;
    if (tileLayer) map.removeLayer(tileLayer);
    tileLayer = L.tileLayer(cfg.url, { subdomains: cfg.sub, maxZoom: 19 }).addTo(map);
    tileLayer.setZIndex(0);
    currentBase = key;
    renderLayerSwitcher();
  }
  var layersEl = document.getElementById("layers");
  var layersOpen = false;
  function renderLayerSwitcher() {
    if (!layersEl) return;
    if (!layersOpen) {
      layersEl.className = "layers";
      layersEl.innerHTML = '<button class="lbtn" style="background-image:url(' + (BASEMAPS[currentBase] ? BASEMAPS[currentBase].thumb : BASEMAPS.satellite.thumb) + ')" title="Basemap"></button>';
      var btn = layersEl.querySelector(".lbtn");
      if (btn) btn.onclick = function () { layersOpen = true; renderLayerSwitcher(); };
    } else {
      layersEl.className = "layers open";
      var h = '<div class="lpanel">';
      Object.keys(BASEMAPS).forEach(function (k) {
        h += '<div class="ltile ' + (k === currentBase ? "active" : "") + '" data-k="' + k + '"><div class="lthumb" style="background-image:url(' + BASEMAPS[k].thumb + ')"></div><div class="llabel">' + BASEMAPS[k].label + "</div></div>";
      });
      h += "</div>";
      layersEl.innerHTML = h;
      Array.prototype.forEach.call(layersEl.querySelectorAll(".ltile"), function (t) {
        t.onclick = function () { layersOpen = false; setBase(t.getAttribute("data-k")); };
      });
    }
  }
  setBase(currentBase);

  var siteLayer = L.layerGroup().addTo(map);
  var labelLayer = L.layerGroup().addTo(map);
  var sectorLayer = L.layerGroup().addTo(map);
  var allSites = [], allSectors = [];

  /* ---------- zoom-to-rectangle ---------- */
  var zoomRectActive = false;
  var zoomRectDrag = null;
  var overlay = document.createElement("div");
  overlay.className = "zoom-rect-overlay";
  var mapcEl = document.getElementById("mapc");
  if (mapcEl) mapcEl.appendChild(overlay);
  var zoomBtn = document.getElementById("zoom-rect-btn");
  function setZoomRect(active) {
    zoomRectActive = active;
    if (zoomBtn) zoomBtn.className = "zoom-rect-btn" + (active ? " active" : "");
    if (mapcEl) mapcEl.style.cursor = active ? "crosshair" : "";
    if (active) { map.dragging.disable(); map.doubleClickZoom.disable(); map.boxZoom.disable(); }
    else { map.dragging.enable(); map.doubleClickZoom.enable(); map.boxZoom.enable(); }
    if (!active && zoomRectDrag) { overlay.style.display = "none"; zoomRectDrag = null; }
  }
  if (zoomBtn) zoomBtn.onclick = function() { setZoomRect(!zoomRectActive); };
  if (mapcEl) {
    mapcEl.addEventListener("mousedown", function(e) {
      if (!zoomRectActive || e.button !== 0) return;
      e.preventDefault();
      var r = mapcEl.getBoundingClientRect();
      zoomRectDrag = { sx: e.clientX - r.left, sy: e.clientY - r.top };
      overlay.style.cssText = "position:absolute;border:2px dashed #13a38f;background:rgba(19,163,143,0.10);pointer-events:none;z-index:2000;box-sizing:border-box;left:" + zoomRectDrag.sx + "px;top:" + zoomRectDrag.sy + "px;width:0;height:0;display:block;";
    });
    mapcEl.addEventListener("mousemove", function(e) {
      if (!zoomRectActive || !zoomRectDrag) return;
      var r = mapcEl.getBoundingClientRect();
      var cx = e.clientX - r.left, cy = e.clientY - r.top;
      var x = Math.min(zoomRectDrag.sx, cx), y = Math.min(zoomRectDrag.sy, cy);
      var w = Math.abs(cx - zoomRectDrag.sx), h = Math.abs(cy - zoomRectDrag.sy);
      overlay.style.left = x + "px"; overlay.style.top = y + "px";
      overlay.style.width = w + "px"; overlay.style.height = h + "px";
    });
    mapcEl.addEventListener("mouseup", function(e) {
      if (!zoomRectActive || !zoomRectDrag) return;
      var r = mapcEl.getBoundingClientRect();
      var ex = e.clientX - r.left, ey = e.clientY - r.top;
      var minX = Math.min(zoomRectDrag.sx, ex), maxX = Math.max(zoomRectDrag.sx, ex);
      var minY = Math.min(zoomRectDrag.sy, ey), maxY = Math.max(zoomRectDrag.sy, ey);
      overlay.style.display = "none"; zoomRectDrag = null;
      if (maxX - minX > 10 && maxY - minY > 10) {
        var sw = map.containerPointToLatLng(L.point(minX, maxY));
        var ne = map.containerPointToLatLng(L.point(maxX, minY));
        map.flyToBounds(L.latLngBounds(sw, ne), { padding: [4, 4], duration: 0.45 });
      }
      setZoomRect(false);
    });
  }
  document.addEventListener("keydown", function(e) { if (e.key === "Escape" && zoomRectActive) setZoomRect(false); });

  function drawSites(list) {
    siteLayer.clearLayers();
    labelLayer.clearLayers();
    if (S.visibility.siteMarkers === false) return;
    var op = Math.max(0, Math.min(1, S.markerOpacity / 100));
    list.forEach(function (s) {
      var r = circleRadius(s.icon);
      var m = L.circleMarker([s.lat, s.lon], {
        radius: r, color: s.icon.color, weight: 1,
        fillColor: s.icon.color, fillOpacity: (s.icon.opacity != null ? s.icon.opacity : 1) * op
      });
      m.bindPopup(s.popupHtml, { className: "pg-popup", maxWidth: 280, minWidth: 170 });
      m.bindTooltip(s.site, { direction: "top", opacity: 1 });
      siteLayer.addLayer(m);
      if (S.visibility.siteLabels) {
        var lm = L.marker([s.lat, s.lon], { icon: L.divIcon({ html: "", iconSize: [0, 0] }), interactive: false });
        lm.bindTooltip(s.site, { permanent: true, direction: "top", className: "site-label", offset: [0, -r - 4] });
        labelLayer.addLayer(lm);
      }
    });
  }
  function drawSectors(list) {
    sectorLayer.clearLayers();
    if (S.visibility.beams === false) return;
    list.forEach(function (sec) {
      if (!sec.polygon.length) return;
      var poly = L.polygon(sec.polygon, {
        color: sec.color, weight: 1, fillColor: sec.color,
        fillOpacity: sec.opacity, opacity: Math.max(0.2, sec.opacity)
      });
      poly.bindPopup(sec.popupHtml, { className: "pg-popup", maxWidth: 280, minWidth: 170 });
      if (S.visibility.cellLabels) poly.bindTooltip(sec.label, { permanent: true, direction: "center", className: "beam-label" });
      sectorLayer.addLayer(poly);
    });
  }

  function computeAll() {
    var m = S.mapping;
    var sites = [], sectors = [], seen = {};
    data.forEach(function (row) {
      var site = String(row[m.SiteName] || "");
      var lat = parseFloat(row[m.Latitude]), lon = parseFloat(row[m.Longitude]);
      if (!site || isNaN(lat) || isNaN(lon)) return;
      if (!seen[site]) {
        seen[site] = true;
        var st = resolveStyle(row);
        sites.push({ row: row, site: site, lat: lat, lon: lon, icon: st.icon, popupHtml: buildPopup(row, m.sitePopupCols, site, st.icon.color) });
      }
      var az = parseFloat(row[m.Azimuth]);
      if (!isNaN(az)) {
        var st2 = resolveStyle(row);
        var labelCol = m.CellLabelCol || m.SectorName;
        var label = String(row[labelCol] || "") || String(row[m.SectorName] || "");
        sectors.push({
          row: row, lat: lat, lon: lon,
          polygon: calcSectorPolygon(lat, lon, az, st2.beamwidth, st2.radius),
          color: st2.color, opacity: Math.max(0, Math.min(100, S.opacity)) / 100,
          label: label, popupHtml: buildPopup(row, m.sectorPopupCols, String(row[m.SectorName] || ""), st2.color)
        });
      }
    });
    allSites = sites;
    allSectors = sectors;
  }

  function updateCount(fs, fx) {
    document.getElementById("count-badge").innerHTML =
      "<strong>" + fs + "</strong> / " + allSites.length + " sites" +
      '<span class="sep">·</span>' +
      "<strong>" + fx + "</strong> / " + allSectors.length + " sectors";
  }

  function uniqueVals(col) {
    var vals = [];
    if (!col) return vals;
    var seen = {};
    data.forEach(function (r) {
      var v = String(r[col] || "");
      if (v && !seen[v]) { seen[v] = 1; vals.push(v); }
    });
    return vals.sort();
  }

  function ensureLegends() {
    var i, v;
    if (S.mapping.ColorCode) {
      var vals = uniqueVals(S.mapping.ColorCode);
      for (i = 0; i < vals.length; i++) { v = vals[i]; if (S.legends.color[v] == null) S.legends.color[v] = PALETTE[i % PALETTE.length]; }
    }
    if (S.mapping.IconCategory) {
      var vals2 = uniqueVals(S.mapping.IconCategory);
      for (i = 0; i < vals2.length; i++) { v = vals2[i]; if (!S.legends.icons[v]) S.legends.icons[v] = { color: PALETTE[i % PALETTE.length], scale: 1, opacity: 1 }; }
    }
    if (S.mapping.BeamCategory) {
      var vals3 = uniqueVals(S.mapping.BeamCategory);
      for (i = 0; i < vals3.length; i++) { v = vals3[i]; if (S.legends.beam[v] == null) S.legends.beam[v] = String(S.defaultBeamwidth); }
    }
    if (S.mapping.RadiusCategory) {
      var vals4 = uniqueVals(S.mapping.RadiusCategory);
      for (i = 0; i < vals4.length; i++) { v = vals4[i]; if (S.legends.radius[v] == null) S.legends.radius[v] = String(S.defaultRadius); }
    }
  }

  function renderRangeLists() {
    var elc = document.getElementById("legend-color-range");
    if (elc) {
      var hc = "";
      (S.colorRanges || []).forEach(function (r, idx) { hc += rangeRowHtml("colour", idx, r); });
      hc += '<button type="button" class="btn-line range-add" data-kind="colour" style="margin-top:6px">+ Add range</button>';
      elc.innerHTML = hc;
    }
    var eli = document.getElementById("legend-icon-range");
    if (eli) {
      var hi = "";
      (S.iconRanges || []).forEach(function (r, idx) { hi += rangeRowHtml("icon", idx, r); });
      hi += '<button type="button" class="btn-line range-add" data-kind="icon" style="margin-top:6px">+ Add range</button>';
      eli.innerHTML = hi;
    }
  }

  function catRow(label, dotColor, inputHtml) {
    return '<div class="cat-row"><span class="dot" style="background:' + esc(dotColor) + '"></span><span>' + esc(label) + '</span>' + inputHtml + '</div>';
  }

  function renderLegendLists() {
    var el = document.getElementById("legend-color-list");
    if (el) {
      var h = "";
      if (S.mapping.ColorCode) {
        uniqueVals(S.mapping.ColorCode).forEach(function (k) {
          var col = S.legends.color[k] || "#22c55e";
          h += catRow(k, col, '<input type="color" class="color-input leg-color" data-k="' + esc(k) + '" value="' + esc(col) + '">');
        });
      } else { h = '<div class="pval" style="padding:4px 0">No colour column selected</div>'; }
      el.innerHTML = h;
    }
    var el2 = document.getElementById("legend-icon-list");
    if (el2) {
      var h2 = "";
      if (S.mapping.IconCategory) {
        uniqueVals(S.mapping.IconCategory).forEach(function (k) {
          var col = (S.legends.icons[k] || {}).color || "#ef4444";
          h2 += catRow(k, col, '<input type="color" class="color-input leg-icon" data-k="' + esc(k) + '" value="' + esc(col) + '">');
        });
      } else { h2 = '<div class="pval" style="padding:4px 0">No icon column selected</div>'; }
      el2.innerHTML = h2;
    }
    var el3 = document.getElementById("legend-beam-list");
    if (el3) {
      var h3 = "";
      if (S.mapping.BeamCategory) {
        uniqueVals(S.mapping.BeamCategory).forEach(function (k) {
          h3 += '<div class="cat-row"><span>' + esc(k) + '</span><div style="display:flex;align-items:center;gap:4px;flex:none"><input type="number" class="pnum leg-beam" data-k="' + esc(k) + '" value="' + esc(S.legends.beam[k]) + '" min="1" max="180" style="width:60px;height:26px;text-align:right"><span style="font-size:9px;color:#98a7a3">°</span></div></div>';
        });
      } else { h3 = '<div class="pval" style="padding:4px 0">Manual mode</div>'; }
      el3.innerHTML = h3;
    }
    var el4 = document.getElementById("legend-radius-list");
    if (el4) {
      var h4 = "";
      if (S.mapping.RadiusCategory) {
        uniqueVals(S.mapping.RadiusCategory).forEach(function (k) {
          h4 += '<div class="cat-row"><span>' + esc(k) + '</span><div style="display:flex;align-items:center;gap:4px;flex:none"><input type="number" class="pnum leg-radius" data-k="' + esc(k) + '" value="' + esc(S.legends.radius[k]) + '" min="1" style="width:60px;height:26px;text-align:right"><span style="font-size:9px;color:#98a7a3">m</span></div></div>';
        });
      } else { h4 = '<div class="pval" style="padding:4px 0">Manual mode</div>'; }
      el4.innerHTML = h4;
    }
  }

  function isNumCol(col) {
    if (!col) return false;
    var num = 0, tot = 0;
    for (var ii = 0; ii < data.length; ii++) {
      var vv = data[ii][col];
      if (vv !== undefined && vv !== null && String(vv).trim() !== "") {
        tot++;
        if (!isNaN(parseFloat(String(vv)))) num++;
      }
    }
    return tot > 0 && num / tot >= 0.8;
  }
  S.isNum = isNumCol;

  function rangeRowHtml(kind, idx, range) {
    var pickCls = kind === "colour" ? "leg-crange-col" : "leg-irange-col";
    var curCol = range.color || (range.iconConfig && range.iconConfig.color) || "#22c55e";
    return '<div class="range-row2"><div class="rline">' +
      '<select class="' + kind + '-omin" data-idx="' + idx + '"><option value=">=" ' + (range.opMin === ">=" ? "selected" : "") + '>&ge;</option><option value=">" ' + (range.opMin === ">" ? "selected" : "") + '>&gt;</option><option value="=" ' + (range.opMin === "=" ? "selected" : "") + '>=</option><option value="!=" ' + (range.opMin === "!=" ? "selected" : "") + '>&ne;</option></select>' +
      '<input class="pnum ' + kind + '-min" data-idx="' + idx + '" value="' + esc(range.min) + '" placeholder="Val">' +
      '<span class="amp">&amp;</span>' +
      '<select class="' + kind + '-omax" data-idx="' + idx + '"><option value="<=" ' + (range.opMax === "<=" ? "selected" : "") + '>&le;</option><option value="<" ' + (range.opMax === "<" ? "selected" : "") + '>&lt;</option><option value="=" ' + (range.opMax === "=" ? "selected" : "") + '>=</option><option value="!=" ' + (range.opMax === "!=" ? "selected" : "") + '>&ne;</option><option value=">=" ' + (range.opMax === ">=" ? "selected" : "") + '>&ge;</option><option value=">" ' + (range.opMax === ">" ? "selected" : "") + '>&gt;</option></select>' +
      '<input class="pnum ' + kind + '-max" data-idx="' + idx + '" value="' + esc(range.max) + '" placeholder="Val">' +
      '<input type="color" class="pcolor range-color ' + pickCls + '" data-idx="' + idx + '" value="' + esc(curCol) + '" title="Assign color">' +
      '<button type="button" class="rm range-rm" data-idx="' + idx + '" data-kind="' + kind + '" title="Remove rule">&times;</button>' +
      '</div></div>';
  }

  function rebuild(fit) {
    ensureLegends();
    computeAll();
    drawSites(allSites);
    drawSectors(allSectors);
    updateCount(allSites.length, allSectors.length);
    renderLegendLists();
    renderRangeLists();
    var key = JSON.stringify(S.mapping);
    if ((fit || key !== lastMappingKey) && allSites.length) {
      try { map.fitBounds(L.latLngBounds(allSites.map(function (s) { return [s.lat, s.lon]; })).pad(0.25), { maxZoom: 15 }); } catch (e) {}
    }
    lastMappingKey = key;
  }
  var lastMappingKey = "";

  /* ---------- shared UI helpers ---------- */
  function selHtml(id, value, opts, emptyLabel) {
    var h = '<select id="' + id + '" class="psel">';
    if (emptyLabel != null) h += '<option value="" ' + (value === "" ? "selected" : "") + ">" + esc(emptyLabel) + "</option>";
    for (var i = 0; i < opts.length; i++) {
      var o = opts[i];
      h += '<option value="' + esc(o) + '" ' + (o === value ? "selected" : "") + ">" + esc(o) + "</option>";
    }
    return h + "</select>";
  }
  function field(label, inner) { return '<div class="param-field"><label>' + label + "</label>" + inner + "</div>"; }
  function checkHtml(id, label, checked) {
    return '<label class="pcheck"><input type="checkbox" id="' + id + '" ' + (checked ? "checked" : "") + ">" + label + "</label>";
  }
  function bindSelById(id, fn, fit) {
    var elx = document.getElementById(id);
    if (elx) elx.addEventListener("change", function () { fn(elx.value); rebuild(!!fit); });
  }
  function bindNumById(id, fn) {
    var elx = document.getElementById(id);
    if (!elx) return;
    elx.addEventListener("change", function () {
      var v = parseFloat(elx.value);
      if (!isNaN(v)) { fn(v); rebuild(false); }
    });
  }
  function bindRangeById(id, valId, fmt, fn) {
    var elx = document.getElementById(id);
    if (!elx) return;
    elx.addEventListener("input", function () {
      var v = parseFloat(elx.value);
      if (isNaN(v)) return;
      fn(v);
      if (valId) { var sv = document.getElementById(valId); if (sv) sv.textContent = fmt(v); }
      rebuild(false);
    });
  }
  function bindColorById(id, valId, fn) {
    var elx = document.getElementById(id);
    if (!elx) return;
    elx.addEventListener("input", function () {
      fn(elx.value);
      if (valId) { var sv = document.getElementById(valId); if (sv) sv.textContent = elx.value; }
      rebuild(false);
    });
  }
  function bindCheckById(id, fn) {
    var elx = document.getElementById(id);
    if (elx) elx.addEventListener("change", function () { fn(elx.checked); rebuild(false); });
  }

  /* ---------- Tab 1: Upload ---------- */
  function buildUploadPanel() {
    var h = "";
    h += '<div class="intro-sec"><div class="kicker">Step 01</div><h1>Bring your network data.</h1>' +
         '<p>This standalone file already contains the dataset — everything below is embedded and works offline (map tiles need internet).</p></div>';

    h += '<div class="side-sec">';
    h += '<div class="file-chip"><div style="flex:1;min-width:0"><strong>' + esc(P.fileName || "dataset") + "</strong>" +
         "<small>" + data.length.toLocaleString() + " rows · " + headers.length + " columns</small></div></div>";

    h += '<div class="prev-wrap"><table class="prev"><thead><tr>';
    var cols = headers.slice(0, 5);
    cols.forEach(function (c) { h += "<th>" + esc(c) + "</th>"; });
    h += "</tr></thead><tbody>";
    data.slice(0, 12).forEach(function (r) {
      h += "<tr>";
      cols.forEach(function (c) { h += "<td>" + esc(r[c]) + "</td>"; });
      h += "</tr>";
    });
    h += "</tbody></table></div></div>";

    document.getElementById("panel-upload").innerHTML = h;
  }

  /* ---------- Tab 2: Columns ---------- */
  function renderPopupChecks(kind) {
    var arrKey = kind === "site" ? "sitePopupCols" : "sectorPopupCols";
    var arr = S.mapping[arrKey] || [];
    var box = document.getElementById("popbox-" + kind);
    if (!box) return;
    var hh = "";
    headers.forEach(function (col) {
      var checked = arr.indexOf(col) !== -1;
      hh += '<label class="pcheck"><input type="checkbox" class="pop-' + kind + '" data-col="' + esc(col) + '"' + (checked ? " checked" : "") + ">" + esc(col) + "</label>";
    });
    box.innerHTML = hh;
  }

  function buildColumnsPanel() {
    var m = S.mapping;
    var h = "";

    h += '<div class="intro-sec"><div class="kicker">Step 02</div><h1>Map your columns.</h1>' +
         '<p>Tell the viewer which fields hold the site and sector data, then pick what shows inside the popups.</p></div>';

    h += '<div class="side-sec">';
    h += field("Site name", selHtml("p-site", m.SiteName, headers, "-- Select --"));
    h += field("Sector / Cell name", selHtml("p-sector", m.SectorName, headers, "-- Select --"));
    h += field("Longitude", selHtml("p-lon", m.Longitude, headers, "-- Select --"));
    h += field("Latitude", selHtml("p-lat", m.Latitude, headers, "-- Select --"));
    h += field("Azimuth", selHtml("p-az", m.Azimuth, headers, "-- Select --"));
    h += "</div>";

    h += '<div class="side-sec"><div class="side-head">Popup fields</div>';
    ["site", "sector"].forEach(function (kind) {
      h += '<div class="param-field"><label>' + (kind === "site" ? "Site" : "Sector") + " popup columns</label>";
      h += '<div class="bulk-links"><button type="button" class="pop-all" data-kind="' + kind + '">All</button>' +
           '<button type="button" class="pop-clear" data-kind="' + kind + '">Clear</button></div>';
      h += '<div class="check-list" id="popbox-' + kind + '"></div></div>';
    });
    h += "</div>";

    document.getElementById("panel-columns").innerHTML = h;
    renderPopupChecks("site");
    renderPopupChecks("sector");

    bindSelById("p-site", function (v) { S.mapping.SiteName = v; }, true);
    bindSelById("p-sector", function (v) { S.mapping.SectorName = v; }, true);
    bindSelById("p-lat", function (v) { S.mapping.Latitude = v; }, true);
    bindSelById("p-lon", function (v) { S.mapping.Longitude = v; }, true);
    bindSelById("p-az", function (v) { S.mapping.Azimuth = v; }, true);

    // Delegated: popup-field checkboxes + All/Clear
    var colPanel = document.getElementById("panel-columns");
    colPanel.addEventListener("change", function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      ["site", "sector"].forEach(function (kind) {
        if (t.classList.contains("pop-" + kind)) {
          var arrKey = kind === "site" ? "sitePopupCols" : "sectorPopupCols";
          var col = t.getAttribute("data-col");
          var arr = (S.mapping[arrKey] || []).slice();
          if (t.checked) { if (arr.indexOf(col) === -1) arr.push(col); }
          else { arr = arr.filter(function (x) { return x !== col; }); }
          S.mapping[arrKey] = arr;
          rebuild(false);
        }
      });
    });
    colPanel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.classList) return;
      var kind = t.getAttribute && t.getAttribute("data-kind");
      if (!kind) return;
      var arrKey = kind === "site" ? "sitePopupCols" : "sectorPopupCols";
      if (t.classList.contains("pop-all")) {
        S.mapping[arrKey] = headers.slice();
        renderPopupChecks(kind);
        rebuild(false);
      } else if (t.classList.contains("pop-clear")) {
        S.mapping[arrKey] = [];
        renderPopupChecks(kind);
        rebuild(false);
      }
    });
  }

  /* ---------- Tab 3: Style (mirrors the main tool layout) ---------- */
  var styleBound = false;

  function sliderRow(id, label, min, max, step, value, valText) {
    return '<div class="param-field"><div class="slide-head"><label>' + label + '</label><span class="pval" id="' + id + '-val">' + valText + "</span></div>" +
      '<input type="range" class="prange" id="' + id + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + value + '"></div>';
  }
  function swatchRow(cls, current) {
    var hh = '<div class="swrow">';
    PALETTE.forEach(function (c) {
      hh += '<button type="button" class="sw ' + cls + ((current || "").toLowerCase() === c.toLowerCase() ? " on" : "") + '" data-c="' + c + '" style="background:' + c + '"></button>';
    });
    hh += '<input type="color" class="pcolor ' + cls + '-custom" value="' + esc(current) + '" title="Custom colour">';
    return hh + "</div>";
  }

  function buildStylePanel() {
    var m = S.mapping;
    var baseKeys = Object.keys(BASEMAPS);
    var h = "";

    h += '<div class="intro-sec"><div class="kicker">Step 03</div><h1>Style the map.</h1>' +
         '<p>Colour the beams and points, tune beamwidth and radius, or split them by a column.</p></div>';

    /* Sector color — same as tool: By Category / By Range toggle when numeric */
    h += '<div class="side-sec"><div class="side-head">Sector color</div>';
    h += field("Color by column", selHtml("p-colourcol", m.ColorCode, headers, "-- Apply default color to all --"));
    if (!m.ColorCode) {
      h += field("Default sector colour", swatchRow("sw-sector", S.defaultSectorColor));
    } else {
      var isNumCol = S.isNum && S.isNum(m.ColorCode);
      if (isNumCol) {
        h += '<div class="seg"><button type="button" id="seg-col-cat" class="' + (S.colorMode === "category" ? "on" : "") + '">By Category</button>' +
             '<button type="button" id="seg-col-range" class="' + (S.colorMode === "range" ? "on" : "") + '">By Range</button></div>';
      }
      if (!isNumCol || S.colorMode === "category") {
        h += '<div id="legend-color-list"></div>';
      } else {
        h += '<div id="legend-color-range"></div>';
      }
    }
    h += "</div>";

    /* Beam & radius — sliders in manual mode, per-category rows otherwise */
    h += '<div class="side-sec"><div class="side-head">Beam &amp; radius</div>';
    h += field("Beamwidth column", selHtml("p-beamcol", m.BeamCategory, headers, "-- Manual (global slider) --"));
    if (!m.BeamCategory) {
      h += sliderRow("p-beam", "Beamwidth (deg)", 1, 180, 1, S.defaultBeamwidth, S.defaultBeamwidth + "\\u00b0");
    } else {
      h += '<div id="legend-beam-list" style="margin-bottom:12px"></div>';
    }
    h += field("Radius column", selHtml("p-radcol", m.RadiusCategory, headers, "-- Manual (global slider) --"));
    if (!m.RadiusCategory) {
      h += sliderRow("p-rad", "Radius (m)", 10, 2000, 10, S.defaultRadius, S.defaultRadius + " m");
    } else {
      h += '<div id="legend-radius-list" style="margin-bottom:12px"></div>';
    }
    h += sliderRow("p-op", "Beam opacity", 0, 100, 1, S.opacity, S.opacity + "%");
    h += "</div>";

    /* Site points — same as tool: single color vs By Category / By Range when numeric */
    h += '<div class="side-sec"><div class="side-head">Site points</div>';
    if (!m.IconCategory) {
      h += '<div class="seg"><button type="button" id="seg-single" class="on">Single Color</button>' +
           '<button type="button" id="seg-cat">Categorized</button></div>';
      h += field("Point colour", swatchRow("sw-point", S.pointColor));
    } else {
      h += field("Category column", selHtml("p-icocol", m.IconCategory, headers, "-- Apply default icon to all --"));
      var isNumIcon = S.isNum && S.isNum(m.IconCategory);
      if (isNumIcon) {
        h += '<div class="seg"><button type="button" id="seg-ico-cat" class="' + (S.iconMode === "category" ? "on" : "") + '">By Category</button>' +
             '<button type="button" id="seg-ico-range" class="' + (S.iconMode === "range" ? "on" : "") + '">By Range</button></div>';
      }
      if (!isNumIcon || S.iconMode === "category") {
        h += '<div id="legend-icon-list"></div>';
      } else {
        h += '<div id="legend-icon-range" style="margin-bottom:10px"></div>';
      }
    }
    h += sliderRow("p-scale", "Marker scale", 0.1, 3, 0.1, S.globalIconScale, Number(S.globalIconScale).toFixed(1) + "\\u00d7");
    h += sliderRow("p-mop", "Marker opacity", 10, 100, 5, S.markerOpacity, S.markerOpacity + "%");
    h += "</div>";

    /* Layers */
    h += '<div class="side-sec"><div class="side-head">Layers</div>';
    h += checkHtml("p-beams", "Sector beams", S.visibility.beams);
    h += checkHtml("p-markers", "Site markers", S.visibility.siteMarkers);
    h += checkHtml("p-sitelabels", "Site labels", S.visibility.siteLabels);
    h += checkHtml("p-celllabels", "Cell labels", S.visibility.cellLabels);
    h += '<div style="margin-top:14px">';
    h += field("Cell label field", selHtml("p-label", m.CellLabelCol, headers, "-- Use Sector / Cell name --"));
    h += "</div></div>";

    document.getElementById("panel-style").innerHTML = h;
    renderLegendLists();

    if (styleBound) return;
    styleBound = true;

    var stylePanel = document.getElementById("panel-style");
    var STRUCTURAL = { "p-colourcol": "ColorCode", "p-beamcol": "BeamCategory", "p-radcol": "RadiusCategory", "p-icocol": "IconCategory" };
    var SIMPLE = {
      "p-label": function (v) { S.mapping.CellLabelCol = v; },
      "p-base": function (v) { S.baseLayer = v; setBase(v); },
      "p-beam": function (v) { var n = parseFloat(v); if (!isNaN(n)) S.defaultBeamwidth = n; },
      "p-rad": function (v) { var n = parseFloat(v); if (!isNaN(n)) S.defaultRadius = n; },
      "p-op": function (v) { var n = parseFloat(v); if (!isNaN(n)) S.opacity = n; },
      "p-scale": function (v) { var n = parseFloat(v); if (!isNaN(n)) S.globalIconScale = n; },
      "p-mop": function (v) { var n = parseFloat(v); if (!isNaN(n)) S.markerOpacity = n; },
      "p-beams": function (v, t) { S.visibility.beams = t.checked; },
      "p-markers": function (v, t) { S.visibility.siteMarkers = t.checked; },
      "p-sitelabels": function (v, t) { S.visibility.siteLabels = t.checked; },
      "p-celllabels": function (v, t) { S.visibility.cellLabels = t.checked; }
    };
    var VALFMT = {
      "p-beam": function (v) { return v + "\\u00b0"; },
      "p-rad": function (v) { return v + " m"; },
      "p-op": function (v) { return v + "%"; },
      "p-scale": function (v) { return Number(v).toFixed(1) + "\\u00d7"; },
      "p-mop": function (v) { return v + "%"; }
    };

    function onStyleEvent(e) {
      var t = e.target;
      if (!t) return;
      var cl = t.classList;
      if (cl) {
        if (cl.contains("leg-color")) { S.legends.color[t.getAttribute("data-k")] = t.value; rebuild(false); return; }
        if (cl.contains("leg-icon")) {
          var kk = t.getAttribute("data-k");
          if (!S.legends.icons[kk]) S.legends.icons[kk] = { scale: 1, opacity: 1 };
          S.legends.icons[kk].color = t.value; rebuild(false); return;
        }
        if (cl.contains("leg-beam")) { S.legends.beam[t.getAttribute("data-k")] = t.value; rebuild(false); return; }
        if (cl.contains("leg-radius")) { S.legends.radius[t.getAttribute("data-k")] = t.value; rebuild(false); return; }
        if (cl.contains("sw-sector-custom")) { S.defaultSectorColor = t.value; rebuild(false); return; }
        if (cl.contains("sw-point-custom")) { S.pointColor = t.value; rebuild(false); return; }
      }
      var id = t.id;
      if (STRUCTURAL[id]) {
        S.mapping[STRUCTURAL[id]] = t.value;
        buildStylePanel();
        rebuild(false);
        return;
      }
      if (SIMPLE[id]) {
        SIMPLE[id](t.value, t);
        var sv = document.getElementById(id + "-val");
        if (sv && VALFMT[id]) sv.textContent = VALFMT[id](t.value);
        rebuild(false);
      }
    }
    stylePanel.addEventListener("input", onStyleEvent);
    stylePanel.addEventListener("change", onStyleEvent);
    stylePanel.addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      // segmented toggles for sector color mode
      if (t.id === "seg-col-cat") { S.colorMode = "category"; buildStylePanel(); rebuild(false); return; }
      if (t.id === "seg-col-range") { S.colorMode = "range"; buildStylePanel(); rebuild(false); return; }
      if (t.id === "seg-ico-cat") { S.iconMode = "category"; buildStylePanel(); rebuild(false); return; }
      if (t.id === "seg-ico-range") { S.iconMode = "range"; buildStylePanel(); rebuild(false); return; }

      if (t.id === "seg-single") {
        S.mapping.IconCategory = "";
        buildStylePanel();
        rebuild(false);
        return;
      }
      if (t.id === "seg-cat") {
        if (!S.mapping.IconCategory) {
          var guess = "";
          for (var gi = 0; gi < headers.length; gi++) {
            if (/type|tech|band|cat|region|vendor/i.test(headers[gi])) { guess = headers[gi]; break; }
          }
          S.mapping.IconCategory = guess || headers[0] || "";
        }
        buildStylePanel();
        rebuild(false);
        return;
      }
      var cls = t.classList;
      if (cls && cls.contains("sw-sector")) {
        S.defaultSectorColor = t.getAttribute("data-c");
        buildStylePanel();
        rebuild(false);
        return;
      }
      if (cls && cls.contains("sw-point")) {
        S.pointColor = t.getAttribute("data-c");
        buildStylePanel();
        rebuild(false);
        return;
      }

      // range rows — color pickers, inputs, add/remove
      var ridx = t.getAttribute && t.getAttribute("data-idx");
      if (t.classList && t.classList.contains("leg-crange-col")) {
        var cr = S.colorRanges[parseInt(ridx)]; if (cr) cr.color = t.value;
        rebuild(false); return;
      }
      if (t.classList && t.classList.contains("leg-irange-col")) {
        var ir = S.iconRanges[parseInt(ridx)]; if (ir) ir.iconConfig.color = t.value;
        rebuild(false); return;
      }
      if (cl.contains("colour-min")) { var cr2 = S.colorRanges[parseInt(ridx)]; if (cr2) cr2.min = t.value; rebuild(false); return; }
      if (cl.contains("colour-max")) { var cr3 = S.colorRanges[parseInt(ridx)]; if (cr3) cr3.max = t.value; rebuild(false); return; }
      if (cl.contains("colour-omin")) { var cr4 = S.colorRanges[parseInt(ridx)]; if (cr4) cr4.opMin = t.value; rebuild(false); return; }
      if (cl.contains("colour-omax")) { var cr5 = S.colorRanges[parseInt(ridx)]; if (cr5) cr5.opMax = t.value; rebuild(false); return; }
      if (cl.contains("icon-min")) { var ir2 = S.iconRanges[parseInt(ridx)]; if (ir2) ir2.min = t.value; rebuild(false); return; }
      if (cl.contains("icon-max")) { var ir3 = S.iconRanges[parseInt(ridx)]; if (ir3) ir3.max = t.value; rebuild(false); return; }
      if (cl.contains("icon-omin")) { var ir4 = S.iconRanges[parseInt(ridx)]; if (ir4) ir4.opMin = t.value; rebuild(false); return; }
      if (cl.contains("icon-omax")) { var ir5 = S.iconRanges[parseInt(ridx)]; if (ir5) ir5.opMax = t.value; rebuild(false); return; }
      if (cl.contains("range-rm")) {
        var kindRm = t.getAttribute("data-kind");
        var idxRm = parseInt(t.getAttribute("data-idx"));
        if (kindRm === "colour" && S.colorRanges.length > 1) { S.colorRanges.splice(idxRm, 1); }
        if (kindRm === "icon" && S.iconRanges.length > 1) { S.iconRanges.splice(idxRm, 1); }
        buildStylePanel();
        rebuild(false);
        return;
      }
      if (cl.contains("range-add")) {
        var kindAdd = t.getAttribute("data-kind");
        if (kindAdd === "colour") {
          S.colorRanges.push({ opMin: ">=", min: "", opMax: "<=", max: "", color: PALETTE[S.colorRanges.length % PALETTE.length] });
        } else if (kindAdd === "icon") {
          S.iconRanges.push({ opMin: ">=", min: "", opMax: "<=", max: "", iconConfig: { color: PALETTE[S.iconRanges.length % PALETTE.length], scale: 1, opacity: 1 } });
        }
        buildStylePanel();
        rebuild(false);
      }
    });
  }

  /* ---------- Tab 4: Draw & export (mirrors the main tool) ---------- */
  function hexToKmlColor(hex, opPct) {
    var hx = (hex || "#000000").replace("#", "");
    if (hx.length === 3) hx = hx.charAt(0) + hx.charAt(0) + hx.charAt(1) + hx.charAt(1) + hx.charAt(2) + hx.charAt(2);
    var a = Math.round(((opPct == null ? 100 : opPct) / 100) * 255).toString(16);
    if (a.length < 2) a = "0" + a;
    return (a + hx.substr(4, 2) + hx.substr(2, 2) + hx.substr(0, 2)).toUpperCase();
  }
  function xmlEsc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  }
  function exportKmlFile() {
    var m = S.mapping;
    var kml = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Network Export</name>' +
      "<Folder><name>Sites</name>";
    var n = 0;
    allSites.forEach(function (s) {
      var sid = "st" + (n++);
      var kcol = hexToKmlColor(s.icon.color, (s.icon.opacity != null ? s.icon.opacity : 1) * S.markerOpacity);
      var descRows = "";
      (m.sitePopupCols || []).forEach(function (c) {
        descRows += "<tr><td><b>" + xmlEsc(c) + ":</b></td><td>" + xmlEsc(s.row[c]) + "</td></tr>";
      });
      kml += '<Style id="' + sid + '"><IconStyle><color>' + kcol + "</color><scale>" +
        (0.5 * S.globalIconScale).toFixed(2) +
        "</scale><Icon><href>https://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon></IconStyle>" +
        "<LabelStyle><scale>" + (S.visibility.siteLabels ? "0.8" : "0") + "</scale></LabelStyle></Style>" +
        "<Placemark><name>" + xmlEsc(s.site) + "</name>" +
        "<description><![CDATA[<table>" + descRows + "</table>]]></description>" +
        '<styleUrl>#' + sid + "</styleUrl><Point><coordinates>" + s.lon + "," + s.lat + ",0</coordinates></Point></Placemark>";
    });
    kml += "</Folder><Folder><name>Sectors</name>";
    allSectors.forEach(function (sec) {
      var sid = "sc" + (n++);
      var kcol = hexToKmlColor(sec.color, S.opacity);
      var coords = sec.polygon.map(function (p) { return p[1] + "," + p[0] + ",0"; }).join(" ");
      var descRows = "";
      (m.sectorPopupCols || []).forEach(function (c) {
        descRows += "<tr><td><b>" + xmlEsc(c) + ":</b></td><td>" + xmlEsc(sec.row[c]) + "</td></tr>";
      });
      kml += '<Style id="' + sid + '"><LineStyle><color>' + kcol + "</color><width>1</width></LineStyle>" +
        "<PolyStyle><color>" + kcol + "</color></PolyStyle>" +
        "<LabelStyle><scale>" + (S.visibility.cellLabels ? "0.7" : "0") + "</scale></LabelStyle></Style>" +
        "<Placemark><name>" + xmlEsc(sec.label) + "</name>" +
        "<description><![CDATA[<table>" + descRows + "</table>]]></description>" +
        '<styleUrl>#' + sid + "</styleUrl><Polygon><tessellate>1</tessellate>" +
        "<outerBoundaryIs><LinearRing><coordinates>" + coords + "</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>";
    });
    kml += "</Folder></Document></kml>";

    var blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Engineering Parameter Export.kml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function buildFilterPanel() {
    var h = "";
    h += '<div class="intro-sec"><div class="kicker">Step 04</div><h1>Draw &amp; export.</h1>' +
         '<p>Render the network on the map, then export a KML for Google Earth. Use the search bar on the map to filter points live.</p></div>';
    h += '<div class="side-sec">';
    h += '<button id="f-draw" class="btn-dark">Calculate &amp; Draw</button>';
    h += '<button id="f-kml" class="btn-line">Export KML for Google Earth</button>';
    h += "</div>";
    document.getElementById("panel-filter").innerHTML = h;
    // Use delegated click on the panel — survives re-renders
    document.getElementById("panel-filter").addEventListener("click", function (e) {
      var t = e.target;
      if (!t) return;
      if (t.id === "f-draw") {
        lastMappingKey = "";
        rebuild(true);
        setTimeout(function () { map.invalidateSize(); }, 80);
      }
      if (t.id === "f-kml") { exportKmlFile(); }
    });
  }

  /* ---------- tab switching + sidebar toggle ---------- */
  var TAB_IDS = ["upload", "columns", "style", "filter"];
  TAB_IDS.forEach(function (name) {
    var btn = document.getElementById("tab-" + name);
    if (!btn) return;
    btn.addEventListener("click", function () {
      TAB_IDS.forEach(function (k) {
        var b = document.getElementById("tab-" + k);
        var p = document.getElementById("panel-" + k);
        if (b) b.classList.toggle("active", k === name);
        if (p) p.style.display = k === name ? "" : "none";
      });
    });
  });
  document.getElementById("menu-btn").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("collapsed");
    setTimeout(function () { map.invalidateSize(); }, 280);
  });

  /* ---------- search + column filter ---------- */
  var colSel = document.getElementById("colfilter");
  var valSel = document.getElementById("valfilter");
  var valContainer = document.getElementById("valfilter-container");
  var valDiv = document.getElementById("valfilter-div");
  headers.forEach(function (hname) { var o = document.createElement("option"); o.value = hname; o.textContent = hname; colSel.appendChild(o); });

  var prevSitesKey = "";
  function applyFilter() {
    var term = document.getElementById("search").value.trim().toLowerCase();
    var col = colSel.value;
    var val = valSel.value;
    var filteredData = data.filter(function (row) {
      if (term) {
        var match = Object.keys(row).some(function (k) { return String(row[k] == null ? "" : row[k]).toLowerCase().indexOf(term) !== -1; });
        if (!match) return false;
      }
      if (col && val) {
        if (String(row[col] == null ? "" : row[col]) !== val) return false;
      }
      return true;
    });
    var keep = {};
    filteredData.forEach(function (r) { keep[String(r[S.mapping.SiteName] || "")] = true; });
    var fSites = allSites.filter(function (s) { return keep[s.site]; });
    var fSectors = allSectors.filter(function (sec) { return filteredData.indexOf(sec.row) !== -1; });
    drawSites(fSites);
    drawSectors(fSectors);
    updateCount(fSites.length, fSectors.length);
    
    var sitesKey = fSites.map(function(s) { return s.site; }).join("|");
    var isSearchActive = term.length > 0;
    var shouldZoom = sitesKey !== prevSitesKey || (isSearchActive && fSites.length > 0 && fSites.length <= 20);
    
    if (shouldZoom) {
      prevSitesKey = sitesKey;
      if (fSites.length) {
        try {
          if (fSites.length === 1) map.flyTo([fSites[0].lat, fSites[0].lon], Math.max(map.getZoom(), 14), { duration: 0.6 });
          else map.flyToBounds(L.latLngBounds(fSites.map(function (s) { return [s.lat, s.lon]; })).pad(0.2), { maxZoom: 15, duration: 0.6 });
        } catch (e) {}
      }
    }
  }
  var searchEl = document.getElementById("search");
  var clearEl = document.getElementById("search-clear");
  searchEl.addEventListener("input", function () {
    clearEl.style.display = searchEl.value ? "grid" : "none";
    applyFilter();
  });
  clearEl.addEventListener("click", function () {
    searchEl.value = "";
    clearEl.style.display = "none";
    applyFilter();
  });
  colSel.addEventListener("change", function() {
    var col = colSel.value;
    if (!col) {
      valContainer.style.display = "none";
      if (valDiv) valDiv.style.display = "none";
      valSel.value = "";
      valSel.setAttribute("aria-label", "Filter value");
    } else {
      valContainer.style.display = "";
      if (valDiv) valDiv.style.display = "";
      var u = uniqueVals(col);
      var html = '<option value="">All values</option>';
      for (var i = 0; i < u.length; i++) {
        html += '<option value="' + esc(u[i]) + '">' + esc(u[i]) + '</option>';
      }
      valSel.innerHTML = html;
      valSel.value = "";
      valSel.setAttribute("aria-label", "Filter " + col + " value");
    }
    applyFilter();
  });
  valSel.addEventListener("change", applyFilter);

  /* ---------- boot ---------- */
  buildUploadPanel();
  buildColumnsPanel();
  buildStylePanel();
  buildFilterPanel();
  rebuild(true);
})();
</script>
</body>
</html>
`;

  downloadBlob(filename, html, "text/html");
  return Promise.resolve();
}
