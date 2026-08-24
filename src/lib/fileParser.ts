import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { DataRow, Mapping } from "../types";

export interface ParseResult {
  headers: string[];
  data: DataRow[];
}

function rowsToObjects(rows: unknown[][]): ParseResult {
  if (!rows.length) return { headers: [], data: [] };
  const headers = (rows[0] as unknown[]).map((h, i) =>
    h !== null && h !== undefined && String(h).trim() !== ""
      ? String(h).trim()
      : `Column_${i + 1}`
  );
  const data: DataRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => c === null || c === undefined || String(c).trim() === ""))
      continue;
    const obj: DataRow = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] as string | number;
    });
    data.push(obj);
  }
  return { headers, data };
}

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const isExcel = name.endsWith(".xls") || name.endsWith(".xlsx");

  if (isExcel) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    return rowsToObjects(matrix);
  }

  // CSV / TXT (comma or tab separated)
  return new Promise((resolve, reject) => {
    Papa.parse<DataRow>(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      complete: (res) => {
        const headers = (res.meta.fields || []).map((h) => String(h).trim());
        const data: DataRow[] = (res.data as DataRow[]).filter((row) =>
          Object.values(row).some(
            (v) => v !== null && v !== undefined && String(v).trim() !== ""
          )
        );
        resolve({ headers, data });
      },
      error: (err) => reject(err),
    });
  });
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const FIELD_SYNONYMS: { key: keyof Mapping; tests: string[] }[] = [
  {
    key: "SiteName",
    tests: ["sitename", "site", "siteid", "sitename", "nodeb", "enbid", "cellid", "btsid", "tower", "location"],
  },
  {
    key: "SectorName",
    tests: ["sectorname", "sector", "cell", "cellname", "cellid", "sectorid"],
  },
  {
    key: "Longitude",
    tests: ["longitude", "lon", "long", "lng", "x"],
  },
  {
    key: "Latitude",
    tests: ["latitude", "lat", "y"],
  },
  {
    key: "Azimuth",
    tests: ["azimuth", "az", "bearing", "dir", "direction", "antennaazimuth"],
  },
  {
    key: "ColorCode",
    tests: ["pci", "technology", "band", "bandwidth", "freq", "earfcn", "arfcn", "color", "tech", "network"],
  },
  {
    key: "BeamCategory",
    tests: ["beamwidth", "beam", "hbw", "horizontalbeamwidth", "bw"],
  },
  {
    key: "RadiusCategory",
    tests: ["radius", "range", "coverage", "distance"],
  },
  {
    key: "IconCategory",
    tests: ["sitetype", "type", "category", "vendor", "towerheight", "height"],
  },
];

/** Best-effort auto mapping of dataset headers to the required fields. */
export function autoMap(headers: string[]): Partial<Mapping> {
  const map: Record<string, string> = {};
  const used = new Set<string>();
  for (const { key, tests } of FIELD_SYNONYMS) {
    // exact-ish match first
    let found = headers.find((h) => tests.includes(norm(h)) && !used.has(h));
    if (!found) {
      found = headers.find((h) => {
        if (used.has(h)) return false;
        return tests.some((t) => norm(h).includes(t));
      });
    }
    if (found && !used.has(found)) {
      map[key] = found;
      used.add(found);
    }
  }
  return map as Partial<Mapping>;
}
