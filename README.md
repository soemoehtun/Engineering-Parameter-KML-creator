# 📡 Cell Parameter KML Export Tools

A professional-grade, standalone Single-Page Application (SPA) designed for telecommunications engineers to visualize cellular network engineering parameters (Sites and Sectors) and export them directly to KML for Google Earth.

No server installation required. Simply open the HTML file in any modern browser to start mapping.

---

## 🌟 Overview

The **Cell Parameter KML Export Tools** is a lightweight, purely client-side web application built for RF (Radio Frequency) and Network Planning engineers. It simplifies the process of transforming raw engineering parameter files (Excel/CSV) into interactive, geographical visualizations and exporting them to Google Earth KML format. By performing all calculations directly in the browser, it ensures data privacy and instantaneous feedback without the need for complex desktop software or server-side processing.

---

## ✨ Key Features

*   **Zero Setup:** 100% client-side processing within a single HTML file. No backend or server required.
*   **Drag & Drop Upload:** Supports `.csv`, `.xls`, and `.xlsx` formats via seamless drag-and-drop or file browsing.
*   **Dynamic Column Mapping:** Flexibly map your dataset's specific column names to the required geographical fields (Latitude, Longitude, Azimuth, etc.), eliminating the need for rigid template formats.
*   **Advanced Visualizations:**
    *   **Sector Beams:** Draw precise sector polygons (pie slices) based on azimuth, beamwidth, and radius.
    *   **Conditional Styling:** Color sectors by text **Category** (e.g., Bandwidth, Technology) or by numerical **Range** (e.g., PCI >= 0 and <= 100).
    *   **Custom Site Icons:** Assign specific Google Earth icons to sites by **Category** or numerical **Range**, with customizable sizes.
*   **Interactive Web Map:** High-performance Leaflet-based map featuring Marker Clustering for dense networks and an interactive Layer Switcher (Light, Dark, Satellite, OSM).
*   **Comprehensive Data Filtering:** Instantly search for specific sites/sectors or filter data by exact column values to isolate specific network elements.
*   **One-Click KML Export:** Generates highly optimized, ready-to-use KML files for deep analysis in Google Earth.
*   **Customizable Popups:** Select which data fields appear in tooltips/popups for both Sites and Sectors on the map and in the exported KML.

---

## 🧮 Calculation Concepts

The core function of this tool is calculating the geographical footprint of a cell sector. This is achieved by creating a polygon that represents the sector's coverage area.

The application calculates sector polygons using the following logic:

1.  **Origin Point:** Starts at the Site's Latitude and Longitude.
2.  **Azimuth:** The direction the antenna is pointing (0° is North, 90° is East, 180° is South, 270° is West).
3.  **Beamwidth:** The angular width of the sector's main coverage lobe. The polygon spans from `(Azimuth - Beamwidth/2)` to `(Azimuth + Beamwidth/2)`.
4.  **Radius:** The theoretical distance the sector covers, dictating the length of the polygon's sides.
5.  **Arc Generation:** Calculates multiple coordinate points along the arc between the start and end angles at the specified radius, connecting back to the origin to form a filled polygon.

*Calculations use flat-earth approximations suitable for small radii typical of cellular sectors, employing standard conversion factors (e.g., ~111,320 meters per degree of latitude).*

---

## 📁 File Format Requirements

For optimal performance and accurate rendering, ensure your input data adheres to these guidelines:

1.  **Supported Extensions:** `.csv`, `.txt` (comma or tab-separated), `.xls`, `.xlsx`.
2.  **Headers:** The first row of your file **must** contain clear column headers (e.g., `Site_ID`, `Cell_Name`, `Lat`, `Lon`, `Azimuth`).
3.  **Coordinate Format:** Latitude and Longitude must be in **Decimal Degrees** format (e.g., `16.8409`, `96.1735`). Degrees/Minutes/Seconds (DMS) formats are not supported directly and must be converted prior to upload.
4.  **Numerical Values:**
    *   **Azimuth:** Must be numerical values between `0` and `360`.
    *   **Beamwidth/Radius (If using columns):** Must be valid numbers.
5.  **Clean Data:** Remove merged cells, leading/trailing empty rows, or complex formatting in Excel before uploading. Clean tabular data works best.

---

## 📖 Usage Guide

The application is structured into sequential steps via the left-hand sidebar panels.

### Step 1: File Upload
*   Navigate to the **Upload** tab.
*   Drag and drop your engineering parameter file into the designated zone, or click to browse your computer.
*   Once successfully parsed, a green confirmation message will display the number of records loaded.

### Step 2: Location Mapping
*   Navigate to the **Columns** tab -> **LOCATION MAPPING**.
*   This is the most critical step. You must tell the application which columns in your file correspond to the required fields:
    *   **Site Name:** The unique identifier for the physical location/tower.
    *   **Sector Name:** The unique identifier for the specific cell/antenna.
    *   **Longitude & Latitude:** The geographical coordinates.
    *   **Azimuth:** The pointing direction of the antenna.

### Step 3: Configure Settings
*   Use the **Style**, **Popup Settings**, and **Visibility** panels to customize how the data is rendered (see *Settings Explained* section below).

### Step 4: Calculate & Draw
*   Navigate to the **Filter** tab (or the bottom of any tab where the actions are located).
*   Click the **Calculate & Draw** button. The application will process your data and render the sites and sectors on the interactive map.

### Step 5: Explore and Filter
*   Use the map controls to zoom and pan. Click on sites or sectors to view their details in popups.
*   Use the **Search & Filter** panel to isolate specific sites or data points based on column values.

### Step 6: Export KML
*   Once you are satisfied with the visualization and filtering, click the **Export KML** button.
*   A `.kml` file will be generated and downloaded, ready to be opened in Google Earth.

---

## ⚙️ Settings Explained

### Visual Attributes (Style Tab)

*   **Sector Color Strategy:**
    *   **Default:** Applies a single color to all sectors.
    *   **By Category:** Select a text-based column (e.g., `Technology`). The app will find unique values (e.g., 'LTE', '5G') and allow you to assign a specific color to each.
    *   **By Range:** Select a numerical column (e.g., `PCI`). You can define rules using operators (`>=`, `<=`, `=`, etc.) to assign colors based on value ranges.
*   **Beamwidth / Radius Slicers:**
    *   **Manual (Default):** Use the global sliders to set a uniform beamwidth (e.g., 65°) and radius (e.g., 200m) for all sectors.
    *   **By Column:** Select a column that contains specific beamwidth or radius values for each sector. If values are missing, the tool falls back to the manual slider values.
*   **Global Opacity:** Controls the transparency of the sector polygons on the web map (0% = invisible, 100% = solid). This also affects the exported KML.

### Icon Settings (Style Tab)

*   **Icon Strategy:**
    *   **Default:** Applies a single Google Earth-style icon to all sites.
    *   **By Category:** Select a column (e.g., `Site_Type`). Assign specific icons to unique values (e.g., 'Macro', 'Small Cell').
    *   **By Range:** Select a numerical column (e.g., `Tower_Height`). Define rules to assign icons based on value ranges.
*   **Global Icon Scale:** A multiplier to increase or decrease the size of all site icons simultaneously.

### Popup Settings (Columns Tab)

*   **Site / Sector Popup Columns:** Select which specific columns from your dataset should be displayed when a user clicks on a site marker or sector polygon.

### Visibility (Style Tab)

Toggle visual elements on the web map:
*   **Sector Beams:** Show or hide the sector polygons.
*   **Site Markers:** Show or hide the physical site icons.
*   **Site / Cell Labels:** Show or hide permanent text labels next to the markers or sectors (use with caution on dense networks).

---

## 🗺️ Map Visualization

The integrated map provides a powerful preview of your network data:
*   **Leaflet Engine:** Utilizes the robust Leaflet.js library for smooth rendering.
*   **Marker Clustering:** Automatically groups nearby site markers into clusters when zoomed out to prevent visual clutter and improve performance. Clusters break apart as you zoom in.
*   **Layer Switcher:** Located in the top right corner of the map. Allows you to toggle between different basemaps:
    *   **Light / Dark:** Clean, minimalist maps ideal for highlighting colored sector data.
    *   **Satellite:** High-resolution imagery.
    *   **OSM:** Standard OpenStreetMap data for street-level context.

---

## 🛠️ Troubleshooting

*   **"No valid rows found to export" Error:**
    *   Ensure you have correctly mapped the `Latitude` and `Longitude` columns in the **LOCATION MAPPING** section.
    *   Check that your coordinate data is in Decimal Degrees format and contains numerical values.
*   **Sectors are not drawing:**
    *   Verify that the `Azimuth` column is correctly mapped and contains numerical values (0-360).
*   **Map is blank after clicking "Calculate & Draw":**
    *   Ensure your internet connection is active (required for loading basemaps and library CDNs).
    *   Check your dataset for severe coordinate errors (e.g., Latitude > 90 or < -90).
*   **Colors/Icons are not applying correctly by Range:**
    *   Ensure the column you selected for "By Range" contains purely numerical data. If it contains text or mixed formats, the tool will default back to "By Category" mode.
    *   Verify your logic operators (`>=`, `<=`) don't have overlapping or impossible conditions.

---

## 💻 Technology Stack

This application is built using modern, lightweight web technologies:

*   **Core:** HTML5, CSS3, JavaScript (ES6+).
*   **UI Framework:** [React 18](https://reactjs.org/) (Utilized via Babel standalone for a build-free SPA experience).
*   **Mapping Engine:** [Leaflet.js](https://leafletjs.com/) (v1.9.4).
*   **Clustering Plugin:** [Leaflet.markercluster](https://github.com/Leaflet/Leaflet.markercluster) (v1.4.1).
*   **Data Parsing:**
    *   [PapaParse](https://www.papaparse.com/) (v5.4.1) for blazing-fast CSV/TXT parsing.
    *   [SheetJS](https://sheetjs.com/) (v0.18.5) for robust Excel (XLS/XLSX) processing.
*   **Icons & Styling:** Custom SVG icons and a responsive, Tailwind-inspired CSS architecture.

---

## 🌐 Browser Compatibility

The tool is designed to work on modern, standard-compliant web browsers:

*   **Google Chrome:** Fully supported (Recommended).
*   **Microsoft Edge:** Fully supported.
*   **Mozilla Firefox:** Fully supported.
*   **Safari:** Supported (latest versions).
*   *Note: Internet Explorer is not supported.*

---

## 📂 File Structure

The entire application is contained within a single file for maximum portability:

*   `EP File 2.html`: The monolithic file containing all HTML structure, CSS styling, and React/JavaScript logic.

---

## 📜 License

This project is intended for professional use and is provided "as is" without warranty of any kind. 

