# RF EP KML Creator Tools

This repository contains standalone web-based utilities for RF planning, antenna line-of-sight (LOS) analysis, and KML generation.

## Included Tools

### 1. Sector KML Creator (SectorViz Pro)
A responsive web application to visualize and export cell site antenna sector data into KML format for use in Google Earth and other GIS tools.
- **Data Import**: Supports importing site details via CSV/Excel.
- **Visualization**: Interactive Leaflet map interface with layer switching.
- **Customization**: Supports comprehensive formatting, custom map pin icons, sector coloring, and detailed tooltips/metadata.
- **KML Export**: Instantly generate and download KML files representing network topologies.

### 2. Antenna Angle Calculator
An RF planning tool and dashboard specifically optimized for calculating line-of-sight (LOS) metrics, inner/outer coverage radii, and antenna characteristics.
- **Interactive Map**: Real-time Leaflet map with draggable transmitter and receiver coordinates.
- **Terrain Profiling**: Integration with the Open-Elevation API to generate dynamic terrain cross-section profiles using Chart.js.
- **Metrics**: Real-time visualization of line of sight, clearance, and beam visualization.

## Technology Stack

- **Core**: HTML5, Vanilla JavaScript, CSS3
- **Libraries**:
  - **React 18** (Standalone via Babel) for UI components in the KML tool.
  - **Leaflet.js** for interactive satellite and street map layers.
  - **Chart.js** for plotting elevation profile charts.
  - **PapaParse** & **SheetJS (XLSX)** for reliable data parsing.

## Getting Started

These tools are built as lightweight, single-file HTML applications. No backend server, Node.js environment, or complex build step is required to run them.

1. Clone or download this repository.
2. Open `Sector KML Creator.html` or the `Antenna Angle Calculator.html` file in any modern web browser (Chrome, Edge, Firefox, Safari).
3. Ensure you have an active internet connection to load the external CDNs (React, Leaflet, Chart.js, etc.) and fetch map/elevation data.
