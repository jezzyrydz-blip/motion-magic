export const STARTER_HATS = [
  { id: "none", label: "None" },
  { id: "bow", label: "Bow" },
  { id: "tophat", label: "Top hat" },
  { id: "headphones", label: "Headphones" },
  { id: "crown", label: "Crown" },
  { id: "flower", label: "Flower" },
  { id: "cap", label: "Cap" },
  { id: "star", label: "Star" },
];

export const HAT_LABELS = {
  none: "None",
  bow: "Bow",
  tophat: "Top hat",
  headphones: "Headphones",
  crown: "Crown",
  flower: "Flower",
  cap: "Cap",
  star: "Star",
  unicorn: "Unicorn Horn",
  cat: "Cat Ears",
  frog: "Frog Cap",
  wizard: "Wizard Hat",
  cowboy: "Cowboy Hat",
  sun: "Sun Hat",
  bolt: "Storm Spike",
  ninja: "Ninja Hood",
  rocket: "Rocket Helm",
  ice: "Ice Crown",
  dino: "Dino Helm",
  ufo: "UFO Hat",
  dragon: "Dragon Crown",
  gem: "Crystal Crown",
};

const HAT_ALIASES = {
  "🎀": "bow",
  "🎩": "tophat",
  "🎧": "headphones",
  "👑": "crown",
  "🌸": "flower",
  "🧢": "cap",
  "⭐": "star",
  "🦄": "unicorn",
  "😺": "cat",
  "🐸": "frog",
  "🪄": "wizard",
  "🤠": "cowboy",
  "🌞": "sun",
  "⚡": "bolt",
  "🥷": "ninja",
  "🚀": "rocket",
  "❄️": "ice",
  "🦖": "dino",
  "🛸": "ufo",
  "🐉": "dragon",
  "💎": "gem",
};

export function normalizeHat(hat) {
  if (!hat || hat === "none") return "none";
  if (HAT_ALIASES[hat]) return HAT_ALIASES[hat];
  if (HAT_LABELS[hat]) return hat;
  return "none";
}

export function hatLabel(hat) {
  const id = normalizeHat(hat);
  return HAT_LABELS[id] || "Hat";
}

export function hatMarkup(hat) {
  const id = normalizeHat(hat);
  if (id === "none") return "";
  return `<div class="hat" aria-hidden="true"><i></i><i></i><i></i></div>`;
}
