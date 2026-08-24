export const VECTOR_CIRCLE = "VECTOR_CIRCLE";
export const NO_ICON = "NO_ICON";

const BASE = "https://maps.google.com/mapfiles/kml";

export interface IconGroup {
  id: string;
  label: string;
  icons: string[];
}

const SHAPES = [
  "placemark_circle", "placemark_circle_highlight",
  "placemark_square", "placemark_square_highlight",
  "shaded_dot", "donut", "open-diamond",
  "square", "triangle", "star", "target",
  "cross-hairs", "cross-hairs_highlight",
  "polygon", "arrow", "flag",
  "info", "info-i", "info_circle", "caution", "forbidden",
  "man", "woman", "wheel_chair_accessible",
  "parking_lot", "cabs", "truck",
  "bus", "rail", "subway", "tram",
  "airports", "heliport", "ferry", "sailing", "marina",
  "swimming", "fishing", "campground", "campfire", "picnic",
  "hiker", "trail", "cycling", "horsebackriding",
  "golf", "ski", "snowflake_simple",
  "mountains", "volcano", "earthquake", "water",
  "dining", "coffee", "bars", "snack_bar",
  "grocery", "shopping", "convenience", "gas_stations",
  "mechanic", "toilets", "post_office", "phone", "wifi",
  "electronics", "camera", "movies", "arts",
  "homegardenbusiness", "realestate", "salon",
  "euro", "dollar", "yen",
  "police", "firedept", "hospitals", "pharmacy", "schools",
  "library", "church", "ranger_station",
  "capital_big", "capital_big_highlight",
  "capital_small", "capital_small_highlight",
  "sunny", "partly_cloudy", "rainy", "thunderstorm",
  "poi", "webcam", "motorcycling",
].map((n) => `${BASE}/shapes/${n}.png`);

const PUSHPINS = [
  "ylw", "blue", "grn", "ltblu", "pink", "purple", "red", "wht",
].map((c) => `${BASE}/pushpin/${c}-pushpin.png`);

const PADDLE_COLORS = ["red", "blu", "grn", "ylw", "purple", "pink", "orange", "ltblu", "wht"];
const PADDLE_SHAPES = ["circle", "blank", "diamond", "square", "stars"];
const PADDLES = [
  ...PADDLE_COLORS.flatMap((c) => PADDLE_SHAPES.map((s) => `${BASE}/paddle/${c}-${s}.png`)),
  ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((l) => `${BASE}/paddle/${l}.png`),
  ...Array.from({ length: 10 }, (_, i) => `${BASE}/paddle/${i + 1}.png`),
];

export const ICON_GROUPS: IconGroup[] = [
  { id: "shapes", label: "Shapes", icons: SHAPES },
  { id: "pushpin", label: "Pushpins", icons: PUSHPINS },
  { id: "paddle", label: "Paddles", icons: PADDLES },
];

export const ALL_ICONS: string[] = ICON_GROUPS.flatMap((g) => g.icons);

export function iconName(url: string): string {
  if (url === VECTOR_CIRCLE) return "Vector circle";
  if (url === NO_ICON) return "No icon";
  const file = url.split("/").pop() ?? url;
  return file.replace(/\.png$/, "").replace(/[-_]/g, " ");
}
