# Cell Parameter KML Export Tools

A web-based tool for visualizing and exporting cell tower coverage data to KML format for Google Earth.

## Features

- **Data Import**: Support for CSV, TXT, XLS, and XLSX files
- **Interactive Map**: View cell sites and sector beams on an interactive map
- **Visual Attributes**: Customizable beamwidth, radius, colors, and icons
- **Export**: Generate KML files for Google Earth

## How to Use

### 1. Import Data

1. Open `Cell Parameter KML Export Tools.html` in a web browser
2. Drag and drop your Excel/CSV file onto the upload area, or click to browse
3. Supported formats: `.csv`, `.txt`, `.xlsx`, `.xls`

### 2. Map Columns

Go to the **Columns** tab and map your data columns:

| Field | Description |
|-------|------------|
| Site Name | Site identifier |
| Sector Name | Sector/Cell name |
| Longitude | Longitude coordinate |
| Latitude | Latitude coordinate |
| Azimuth | Beam bearing (degrees) |

### 3. Visual Settings (Optional)

Go to the **Style** tab to customize:

- **Beamwidth Column**: Beam width per category
- **Radius Column**: Coverage radius per category
- **Sector Color**: Color by category
- **Icon Category**: Different icons per category
- **Global Opacity**: Sector beam transparency
- **Global Icon Scale**: Site marker size

### 4. Export

Go to the **Actions** tab and click:
- **Export Site KML** - Export site markers
- **Export Sector KML** - Export sector beams
- **Export Both** - Export combined KML

## Column Mapping Example

For a file with columns:
- LTE site ID
- Sector
- Cell Name
- Longitude
- Latitude
- Azimuth(°)
- Antenna Hegiht
- Etilt
- Mtilt
- State / Division
- Township
- Band

Map as:
- **Site Name** → `LTE site ID`
- **Sector Name** → `Cell Name`
- **Longitude** → `Longitude`
- **Latitude** → `Latitude`
- **Azimuth** → `Azimuth(°)`

## Technical Notes

- Beam calculations use default beamwidth of 35° and radius of 120m
- KML files can be opened in Google Earth
- Map supports Light, Dark, Satellite, and OpenStreetMap layers
