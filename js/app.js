import { CATEGORIES, getCategory } from "./plots.js";
import { moderateText, SAFETY_BOT, safetySelfCheck } from "./safety.js";
import {
  makePlotCode,
  normalizeCode,
  usedCodes,
  ensurePlotCode,
  emptyIrl,
  plotIrl,
  unpackPlot,
  shareUrl,
  qrImageUrl,
  readLinkParams,
  clearLinkParams,
  stashPending,
  takePending,
} from "./phygital.js";
import { allQuests, rewardFor, DEFAULT_REWARD, questWindowId, questWindowLeft, formatWindowLeft } from "./quests.js";
import { SHOP_ITEMS, shopItem, shopHats, shopAuras, publicAuras } from "./shop.js";
import { STARTER_HATS, normalizeHat, hatLabel, hatMarkup } from "./hats.js";
import { GAMES, gameById, mountGame, stopActiveGame } from "./games.js";

const STORAGE_KEY = "motion-magic-v1";
const LEGACY_KEYS = [];
const SKINS = ["#ffd6a5", "#fdffb6", "#caffbf", "#9bf6ff", "#bdb2ff", "#ffc6ff", "#ffadad", "#f4a261"];
const PLOT_EMOJIS = ["🌈", "🍕", "🎮", "📚", "🐱", "🌙", "🔥", "💜", "🍀", "🎵", "🚀", "🧸", "☕", "🌸", "⚡", "🧊", "🌊", "🎯", "🪄", "🧁"];
const PLOT_THEMES = [
  { color: "#7b61ff", ground: "#d9d2ff" },
  { color: "#ef476f", ground: "#ffd0da" },
  { color: "#118ab2", ground: "#c5ebf6" },
  { color: "#f4a261", ground: "#ffe0c2" },
  { color: "#2a9d8f", ground: "#b7e4c7" },
  { color: "#3a86ff", ground: "#d6e6ff" },
  { color: "#9b5de5", ground: "#e8d6fb" },
  { color: "#f72585", ground: "#ffd0e6" },
  { color: "#e07a5f", ground: "#f8d8ce" },
  { color: "#f9c74f", ground: "#fff3c4" },
];
const EYES = [
  { id: "happy", label: "Happy" },
  { id: "wink", label: "Wink" },
  { id: "sleepy", label: "Sleepy" },
  { id: "cool", label: "Cool" },
];
const HATS = STARTER_HATS;
const OUTFITS = [
  { id: "none", label: "Plain" },
  { id: "hoodie", label: "Hoodie" },
  { id: "dress", label: "Dress" },
  { id: "overalls", label: "Overalls" },
  { id: "tee", label: "Tee" },
  { id: "scarf", label: "Scarf" },
  { id: "cape", label: "Cape" },
  { id: "pjs", label: "Pajamas" },
  { id: "raincoat", label: "Raincoat" },
  { id: "sweater", label: "Sweater" },
  { id: "vest", label: "Vest" },
  { id: "tuxedo", label: "Tuxedo" },
  { id: "astronaut", label: "Astronaut" },
  { id: "bee", label: "Bee" },
  { id: "apron", label: "Apron" },
  { id: "varsity", label: "Varsity" },
  { id: "cowboy", label: "Cowboy" },
  { id: "pirate", label: "Pirate" },
  { id: "sailor", label: "Sailor" },
  { id: "knight", label: "Knight" },
  { id: "soccer", label: "Soccer" },
  { id: "wizard", label: "Wizard" },
  { id: "super", label: "Super" },
];

const VISITOR_NAMES = [
  "Pip", "Mochi", "Noodle", "Bean", "Pebble", "Sunny", "Clover", "Biscuit",
  "Maple", "Olive", "Pudding", "Pixel", "Nori", "Butter", "Juniper", "Toast",
];
const START_CAP = 100;
const CAP_STEP = 25;

const state = loadState();

function defaultState() {
  return {
    me: null,
    draft: {
      name: "",
      skin: SKINS[0],
      eyes: "happy",
      hat: "bow",
      outfit: "tee",
    },
    groups: [],
    customPlots: [],
    plotCap: START_CAP,
    flash: "",
    lives: {},
    messages: {},
    view: "welcome",
    plotId: 1,
    filter: "all",
    query: "",
    modal: null,
    bans: [],
    warns: {},
    checkins: {},
    parentPin: "",
    parentUnlocked: false,
    customQuests: [],
    questDone: {},
    stars: 0,
    badges: [],
    owned: [],
    siteOwner: "",
    siteAdmins: [],
    gameScores: {},
    gameId: null,
    gameResult: null,
  };
}

function readSaved() {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current) return JSON.parse(current);
  for (const key of LEGACY_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const legacy = JSON.parse(raw);
    localStorage.removeItem(key);
    return {
      ...legacy,
      customPlots: [],
      groups: [],
      lives: {},
      messages: {},
      plotId: 1,
      view: legacy.me ? "map" : "welcome",
    };
  }
  return null;
}

function loadState() {
  const base = defaultState();
  try {
    const saved = readSaved();
    if (saved) {
      const customPlots = (Array.isArray(saved.customPlots) ? saved.customPlots : []).map((plot, _, list) => {
        const next = {
          ...plot,
          owner: plot.owner || saved.me?.name || "",
          admins: Array.isArray(plot.admins)
            ? plot.admins.filter((name) => name && name !== (plot.owner || saved.me?.name))
            : [],
          irl: plotIrl(plot),
        };
        return ensurePlotCode(next, list);
      });
      const plotExists = customPlots.some((plot) => Number(plot.id) === Number(saved.plotId));
      const next = {
        ...base,
        ...saved,
        me: saved.me ? { outfit: "none", aura: "none", ...saved.me, hat: normalizeHat(saved.me.hat) } : null,
        customPlots,
        plotCap: Math.max(START_CAP, Number(saved.plotCap) || START_CAP, minCapFor(customPlots.length)),
        groups: livingGroups(saved.groups, customPlots),
        messages: saved.messages && typeof saved.messages === "object" ? saved.messages : {},
        lives: saved.lives && typeof saved.lives === "object" ? saved.lives : {},
        draft: { ...base.draft, ...(saved.draft || {}), hat: normalizeHat((saved.draft || {}).hat || saved.me?.hat || base.draft.hat) },
        view: saved.me ? (plotExists && saved.view === "plot" ? "plot" : "map") : "welcome",
        filter: saved.filter || "all",
        query: saved.query || "",
        plotId: plotExists ? saved.plotId : 1,
        modal: null,
        flash: "",
        bans: Array.isArray(saved.bans) ? saved.bans : [],
        warns: saved.warns && typeof saved.warns === "object" ? saved.warns : {},
        checkins: saved.checkins && typeof saved.checkins === "object" ? saved.checkins : {},
        parentPin: String(saved.parentPin || "").replace(/\D/g, "").slice(0, 4),
        parentUnlocked: false,
        customQuests: Array.isArray(saved.customQuests) ? saved.customQuests : [],
        questDone: saved.questDone && typeof saved.questDone === "object" ? saved.questDone : {},
        stars: Math.max(0, Number(saved.stars) || 0),
        badges: Array.isArray(saved.badges) ? saved.badges : [],
        owned: Array.isArray(saved.owned)
          ? saved.owned.filter((id) => Boolean(shopItem(id)))
          : [],
        siteOwner: String(saved.siteOwner || ""),
        siteAdmins: Array.isArray(saved.siteAdmins) ? saved.siteAdmins.filter(Boolean) : [],
        gameScores: saved.gameScores && typeof saved.gameScores === "object" ? saved.gameScores : {},
        gameId: null,
        gameResult: null,
      };
      backfillQuestRewards(next);
      grantSiteOwner(next);
      try { persist(next); } catch { /* keep going even if storage is full */ }
      return next;
    }
  } catch {
    /* start fresh */
  }
  return base;
}

function livingGroups(groups, plots) {
  const ids = new Set((plots || []).map((plot) => Number(plot.id)));
  if (!Array.isArray(groups)) return [];
  return groups.filter((group) => ids.has(Number(group.plotId)));
}

function backfillQuestRewards(data) {
  if (!data.questDone || typeof data.questDone !== "object") return;
  const badges = Array.isArray(data.badges) ? [...data.badges] : [];
  let stars = Math.max(0, Number(data.stars) || 0);
  for (const quest of allQuests(data.customQuests)) {
    const rec = data.questDone[quest.id];
    if (!rec?.done) continue;
    const prize = rewardFor(quest);
    if (!badges.some((badge) => badge.questId === quest.id)) {
      badges.push({ questId: quest.id, name: prize.badge, prize: prize.prize });
    }
    if (!rec.stars) {
      rec.stars = prize.stars;
      stars += prize.stars;
    }
  }
  data.badges = badges;
  data.stars = stars;
}

function grantSiteOwner(data) {
  if (!data.me?.name) {
    data.siteOwner = String(data.siteOwner || "");
    data.siteAdmins = Array.isArray(data.siteAdmins) ? data.siteAdmins.filter(Boolean) : [];
    return;
  }
  data.siteOwner = data.me.name;
  data.owned = Array.isArray(data.owned) ? data.owned : [];
  if (!data.owned.includes("aura-angel")) data.owned.push("aura-angel");
  data.me.aura = "angel";
  data.siteAdmins = (Array.isArray(data.siteAdmins) ? data.siteAdmins : [])
    .filter((name) => name && name !== data.me.name);
}

function isSiteOwner(name = state.me?.name) {
  return Boolean(name && state.siteOwner && name === state.siteOwner);
}

function isSiteAdmin(name = state.me?.name) {
  return Boolean(name && (state.siteAdmins || []).includes(name));
}

function persist(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    me: data.me,
    groups: data.groups,
    customPlots: data.customPlots,
    plotCap: data.plotCap,
    messages: data.messages,
    lives: data.lives,
    bans: data.bans,
    warns: data.warns,
    checkins: data.checkins,
    parentPin: data.parentPin,
    customQuests: data.customQuests,
    questDone: data.questDone,
    stars: data.stars,
    badges: data.badges,
    owned: data.owned,
    siteOwner: data.siteOwner,
    siteAdmins: data.siteAdmins,
    gameScores: data.gameScores,
    draft: data.draft,
  }));
}

function save() {
  persist(state);
}

function minCapFor(count) {
  let cap = START_CAP;
  while (count >= cap) cap += CAP_STEP;
  return cap;
}

function canCreatePlot() {
  if (isBanned()) return false;
  return allPlots().length < state.plotCap;
}

function expandIfFull() {
  if (allPlots().length < state.plotCap) return 0;
  let added = 0;
  while (allPlots().length >= state.plotCap) {
    state.plotCap += CAP_STEP;
    added += CAP_STEP;
  }
  return added;
}

function showFlash(text) {
  state.flash = text;
  window.clearTimeout(showFlash.timer);
  showFlash.timer = window.setTimeout(() => {
    state.flash = "";
    const note = document.getElementById("town-flash");
    if (note) note.remove();
  }, 2800);
}

function createPlotButton() {
  if (isBanned()) {
    return `<button class="btn ghost" disabled title="You're banned from town chat">You're banned from town chat</button>`;
  }
  if (canCreatePlot()) {
    return `<button class="btn berry open-plot">Create a plot</button>`;
  }
  return `<button class="btn ghost" disabled title="The town is full right now">Plots full</button>`;
}

function allPlots() {
  return [...state.customPlots];
}

function findPlot(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  return allPlots().find((plot) => Number(plot.id) === n) || null;
}

function isBanned(name = state.me?.name) {
  if (!name) return false;
  return (state.bans || []).includes(name);
}

function botPost(plotId, text, kind) {
  const list = state.messages[plotId] || [];
  list.push({ name: SAFETY_BOT, text, bot: true, kind });
  state.messages[plotId] = list.slice(-20);
}

function applyModeration(text, plotId) {
  if (isBanned()) {
    showFlash("You're banned from town chat");
    return "blocked";
  }
  const verdict = moderateText(text);
  if (verdict.action === "ban") {
    if (!state.bans) state.bans = [];
    if (!state.bans.includes(state.me.name)) state.bans.push(state.me.name);
    botPost(
      plotId,
      verdict.reason === "address"
        ? "Sharing a home address is not allowed here."
        : "A message was blocked to keep the town safe.",
      "ban"
    );
    showFlash("You're banned from town chat");
    save();
    return "blocked";
  }
  if (verdict.action === "block") {
    showFlash("Please use kind words. Swears aren't allowed.");
    return "blocked";
  }
  if (verdict.action === "warn") {
    if (!state.warns) state.warns = {};
    const n = (state.warns[state.me.name] || 0) + 1;
    state.warns[state.me.name] = n;
    botPost(plotId, `Please don't share Discord or other contact apps here. (warning ${n})`, "warn");
    showFlash("Safety Pip: please don't share Discord here.");
    save();
    return "blocked";
  }
  return "ok";
}

function liveKey(id) {
  return String(id);
}

function getLive(plotId) {
  return state.lives[liveKey(plotId)] || null;
}

function isPlotLive(plotId) {
  return Boolean(getLive(plotId)?.on);
}

function isPlotOwner(plot) {
  if (!plot || !state.me) return false;
  if (plot.owner) return plot.owner === state.me.name;
  return true;
}

function plotAdmins(plot) {
  if (!plot || !Array.isArray(plot.admins)) return [];
  return plot.admins.filter((name) => name && name !== plot.owner);
}

function isPlotAdmin(plot, name = state.me?.name) {
  if (!plot || !name || name === plot.owner) return false;
  return plotAdmins(plot).includes(name);
}

function canTeachOn(plot) {
  if (!plot || !state.me || isBanned()) return false;
  if (isPlotOwner(plot)) return true;
  return plotAdmins(plot).includes(state.me.name);
}

function plotPeopleNames(plot) {
  const names = new Set();
  getParkPeople(plot.id).forEach((person) => names.add(person.name));
  state.groups
    .filter((group) => Number(group.plotId) === Number(plot.id))
    .forEach((group) => (group.members || []).forEach((name) => names.add(name)));
  plotAdmins(plot).forEach((name) => names.add(name));
  names.delete(plot.owner);
  if (isPlotOwner(plot)) names.delete(state.me.name);
  return [...names].filter(Boolean);
}

function nextPlotId() {
  return allPlots().reduce((max, plot) => Math.max(max, Number(plot.id) || 0), 0) + 1;
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function seed(n) {
  let x = n * 1103515245 + 12345;
  return () => {
    x = (x * 1664525 + 1013904223) % 4294967296;
    return x / 4294967296;
  };
}

function visitorsFor(plotId) {
  const rand = seed(plotId + 17);
  const count = 3 + Math.floor(rand() * 4);
  return Array.from({ length: count }, (_, i) => {
    const name = VISITOR_NAMES[Math.floor(rand() * VISITOR_NAMES.length)];
    return {
      id: `v-${plotId}-${i}`,
      name: i === 0 ? name : `${name}${i > 1 ? i : ""}`,
      skin: SKINS[Math.floor(rand() * SKINS.length)],
      eyes: EYES[Math.floor(rand() * EYES.length)].id,
      hat: rand() > 0.45
        ? shopHats()[Math.floor(rand() * shopHats().length)].hat
        : HATS[Math.floor(rand() * HATS.length)].id,
      outfit: OUTFITS[Math.floor(rand() * OUTFITS.length)].id,
      aura: rand() > 0.55 ? publicAuras()[Math.floor(rand() * publicAuras().length)].aura : "none",
      x: 14 + rand() * 72,
      y: 28 + rand() * 58,
    };
  });
}

function hatPickButton(hatId, active, attr) {
  const id = normalizeHat(hatId);
  const label = id === "none" ? (attr === "data-wear-hat" ? "No hat" : "None") : hatLabel(id);
  if (id === "none") {
    return `<button class="pick ${active ? "active" : ""}" ${attr}="${id}">${label}</button>`;
  }
  return `
    <button class="pick hat-pick ${active ? "active" : ""}" ${attr}="${id}" title="${escapeHtml(label)}">
      <span class="avatar mini-hat hat-${id}"><span class="hat"><i></i><i></i><i></i></span></span>
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function avatarMarkup(person, size = "") {
  const hat = normalizeHat(person.hat);
  const outfit = person.outfit || "none";
  const aura = person.aura && person.aura !== "none" ? `aura-${person.aura}` : "";
  return `
    <div class="avatar ${size} ${person.eyes || "happy"} outfit-${outfit} ${hat !== "none" ? `hat-${hat}` : ""} ${aura}" style="--skin:${person.skin}">
      <div class="aura-ring"></div>
      <div class="aura-orbit" aria-hidden="true"></div>
      <div class="aura-beam" aria-hidden="true"></div>
      <div class="aura-crown" aria-hidden="true"></div>
      <div class="aura-wings" aria-hidden="true"><i></i><i></i></div>
      <div class="aura-mist" aria-hidden="true"></div>
      <div class="aura-bits" aria-hidden="true"></div>
      <div class="cape"></div>
      ${hatMarkup(hat)}
      <div class="body"></div>
      <div class="fit"></div>
      <div class="face">
        <div class="eye left"></div>
        <div class="eye right"></div>
        <div class="blush left"></div>
        <div class="blush right"></div>
        <div class="mouth"></div>
      </div>
    </div>
  `;
}

function littleMarkup(person, isYou = false) {
  return `
    <div class="little ${isYou ? "you" : ""}" data-id="${person.id}" style="left:${person.x}%; top:${person.y}%">
      ${avatarMarkup(person)}
      <div class="nameplate">${isYou ? "You · " : ""}${person.name}</div>
    </div>
  `;
}

function render() {
  const app = document.getElementById("app");
  if (!state.me) {
    app.innerHTML = welcomeScreen();
    bindWelcome();
    return;
  }
  const worn = shopAuras().find((item) => item.adminOnly && item.aura === state.me.aura);
  if (worn && !isTownStaff()) state.me.aura = "none";
  app.innerHTML = `
    ${topbar()}
    ${state.view === "map" ? mapScreen() : ""}
    ${state.view === "plot" ? plotScreen() : ""}
    ${state.view === "groups" ? groupsScreen() : ""}
    ${state.view === "quests" ? questsScreen() : ""}
    ${state.view === "shop" ? shopScreen() : ""}
    ${state.view === "games" ? gamesScreen() : ""}
    ${state.modal ? modalScreen() : ""}
    ${state.flash ? `<div class="flash" id="town-flash" role="status">${escapeHtml(state.flash)}</div>` : ""}
  `;
  bindChrome();
  if (state.view === "map") bindMap();
  if (state.view === "plot") bindPlot();
  if (state.view === "groups") bindGroups();
  if (state.view === "quests") bindQuests();
  if (state.view === "shop") bindShop();
  if (state.view === "games") bindGames();
  if (state.modal) bindModal();
}

function topbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <div>${avatarMarkup(state.me)}</div>
        <div>
          <h1 class="logo"><img class="logo-img" src="./img/motion-magic-logo.png" alt="Motion Magic" /></h1>
          <p class="tag">Hi ${escapeHtml(state.me.name)}. ${allPlots().length} / ${state.plotCap} plots · ⭐ ${starsLabel()}${isSiteOwner() ? " · Town owner" : isSiteAdmin() ? " · App admin" : ""}${isBanned() ? " You're banned from town chat." : ""}</p>
        </div>
      </div>
      <div class="nav-actions">
        ${createPlotButton()}
        <button class="btn ghost" data-go="map">Plots</button>
        <button class="btn ghost" data-go="groups">Groups</button>
        <button class="btn ghost" data-go="quests">Quests</button>
        <button class="btn ghost" data-go="games">Games</button>
        <button class="btn berry" data-go="shop">Shop</button>
        ${isSiteOwner() ? `<button class="btn ghost" id="pick-town-admins">Town admins</button>` : ""}
        <button class="btn ghost" id="reset-me">New avatar</button>
      </div>
    </header>
  `;
}

function welcomeScreen() {
  const d = state.draft;
  return `
    <section class="card welcome screen">
      <div>
        <p class="tag">A tiny town for tiny avatars</p>
        <h1 class="logo welcome-logo"><img class="logo-img" src="./img/motion-magic-logo.png" alt="Motion Magic" /></h1>
        <p>Make a little you, plant a plot, then take it into the real world with a QR sign and a join code. Friends scan it, hang out online, or check in IRL.</p>
        <div class="form-grid">
          <label>Your name
            <input id="name-input" type="text" maxlength="16" value="${escapeHtml(d.name)}" placeholder="Pip, Mochi, you..." />
          </label>
          <div>
            <label>Body color</label>
            <div class="swatches">
              ${SKINS.map((color) => `
                <button class="swatch ${d.skin === color ? "active" : ""}" data-skin="${color}" style="background:${color}"></button>
              `).join("")}
            </div>
          </div>
          <div>
            <label>Face</label>
            <div class="picks">
              ${EYES.map((eye) => `
                <button class="pick ${d.eyes === eye.id ? "active" : ""}" data-eyes="${eye.id}">${eye.label}</button>
              `).join("")}
            </div>
          </div>
          <div>
            <label>Hat</label>
            <div class="picks">
              ${HATS.map((hat) => hatPickButton(hat.id, normalizeHat(d.hat) === hat.id, "data-hat")).join("")}
            </div>
          </div>
          <div>
            <label>Outfit</label>
            <div class="picks">
              ${OUTFITS.map((fit) => `
                <button class="pick ${ (d.outfit || "none") === fit.id ? "active" : ""}" data-outfit="${fit.id}">${fit.label}</button>
              `).join("")}
            </div>
          </div>
          <button class="btn berry" id="enter-world">Enter town</button>
        </div>
      </div>
      <div class="preview-stage">
        ${avatarMarkup({ ...d, name: d.name || "You" }, "lg")}
      </div>
    </section>
  `;
}

function mapScreen() {
  const plots = allPlots().filter((plot) => {
    const hay = `${plot.name} ${plot.blurb} ${plot.emoji} ${plot.code || ""}`.toLowerCase();
    const matchesQuery = hay.includes((state.query || "").toLowerCase());
    const matchesFilter = state.filter === "all"
      || (state.filter === "irl" && plotIrl(plot).on)
      || plot.category === state.filter;
    return matchesQuery && matchesFilter;
  });
  return `
    <section class="screen">
      <div class="stats">
        <div class="stat">${allPlots().length} / ${state.plotCap} plots</div>
        <div class="stat">${state.groups.length} groups</div>
        <div class="stat">${state.groups.filter((g) => g.members.includes(state.me.name)).length} joined</div>
        <div class="stat">${allPlots().filter((plot) => plotIrl(plot).on).length} IRL</div>
      </div>
      <div class="toolbar">
        <input class="search" id="plot-search" type="text" value="${escapeHtml(state.query)}" placeholder="Search plots or a join code..." />
        ${createPlotButton()}
      </div>
      <form class="join-code" id="join-code-form">
        <input name="code" maxlength="8" placeholder="Got a code from a poster? Type it here" autocomplete="off" />
        <button class="btn" type="submit">Open door</button>
      </form>
      <div class="filters">
        <button class="chip ${state.filter === "all" ? "active" : ""}" data-filter="all">All</button>
        <button class="chip ${state.filter === "irl" ? "active" : ""}" data-filter="irl">IRL</button>
        ${CATEGORIES.map((cat) => `
          <button class="chip ${state.filter === cat.id ? "active" : ""}" data-filter="${cat.id}">${cat.label}</button>
        `).join("")}
      </div>
      ${plots.length ? `
      <div class="plot-grid">
        ${plots.map((plot) => `
          <button class="card plot-card" data-plot="${plot.id}" style="background:${plot.ground}">
            <span class="num">#${String(plot.id).padStart(2, "0")}</span>
            <span class="yours">Yours</span>
            ${isPlotLive(plot.id) ? `<span class="live-pill card-live">LIVE</span>` : ""}
            ${plotIrl(plot).on ? `<span class="irl-pill card-irl">IRL</span>` : ""}
            <div>
              <div class="emoji">${plot.emoji}</div>
              <h3>${escapeHtml(plot.name)}</h3>
              <p>${escapeHtml(plot.blurb)}</p>
            </div>
          </button>
        `).join("")}
      </div>
      ` : `
      <div class="card empty-town">
        <div class="emoji" style="font-size:2.4rem">🌱</div>
        <h2>${allPlots().length ? "Nothing matches" : "No plots yet"}</h2>
        <p>${allPlots().length
          ? "Try another search or category."
          : "The town is empty until someone plants one. Name what you like, pick a vibe, and hang out there."}</p>
        ${allPlots().length ? "" : createPlotButton()}
      </div>
      `}
    </section>
  `;
}

function plotScreen() {
  const plot = findPlot(state.plotId);
  if (!plot) {
    state.view = "map";
    return mapScreen();
  }
  const cat = getCategory(plot.category) || { label: "Custom" };
  const people = getParkPeople(plot.id);
  const groups = state.groups.filter((g) => g.plotId === plot.id);
  const msgs = state.messages[plot.id] || [];
  const deco = decorations(plot);
  const live = getLive(plot.id);
  const teaching = Boolean(live?.on);
  const owner = isPlotOwner(plot);
  const teacher = canTeachOn(plot);
  return `
    <section class="screen">
      <div class="toolbar">
        <button class="btn ghost" data-go="map">← All plots</button>
        <div>
          <h2 style="margin:0">${teaching ? `<span class="live-pill">LIVE</span> ` : ""}${plot.emoji} ${escapeHtml(plot.name)}</h2>
          <p class="tag">Plot #${plot.id} · ${cat.label}${plot.owner ? ` · ${escapeHtml(plot.owner)}'s plot` : ""}${plot.code ? ` · code ${plot.code}` : ""} · click the park to walk over</p>
        </div>
        <div class="nav-actions">
          ${teacher && !teaching ? `<button class="btn berry go-live">Teach live</button>` : ""}
          <button class="btn ghost" id="open-phygital">Phygital</button>
          ${owner ? `<button class="btn ghost" id="pick-admins">Pick admins</button>` : ""}
          <button class="btn berry" id="open-group">Make a group here</button>
          ${owner ? `<button class="btn danger" id="delete-plot">Delete plot</button>` : ""}
        </div>
      </div>
      <div class="plot-layout">
        <div class="park" id="park" style="background:
          radial-gradient(circle at 20% 20%, rgba(255,255,255,.35), transparent 28%),
          linear-gradient(${plot.ground}, ${plot.color}55);">
          ${teaching ? `<div class="park-deco live-sign">LIVE class with ${escapeHtml(live.teacher || plot.owner || "a friend")}</div>` : ""}
          ${plotIrl(plot).on ? `<div class="park-deco irl-sign">IRL · ${escapeHtml(plotIrl(plot).place || "Meet in real life")}${plotIrl(plot).when ? ` · ${escapeHtml(plotIrl(plot).when)}` : ""}</div>` : ""}
          ${deco}
          ${people.map((person) => littleMarkup(person, person.id === "me")).join("")}
        </div>
        <aside class="side">
          ${phygitalPanel(plot, owner)}
          ${lessonPanel(plot, live, teacher, teaching)}
          <div class="card panel">
            <h3>Who's hanging out</h3>
            <div class="who">
              ${people.map((person) => `
                <div class="who-row">
                  ${avatarMarkup(person)}
                  <div>
                    <div class="who-name">
                      <strong>${escapeHtml(person.name)}</strong>
                      ${isSiteOwner(person.name) ? `<span class="role-pill owner">Town owner</span>` : isSiteAdmin(person.name) ? `<span class="role-pill admin">App admin</span>` : person.name === plot.owner ? `<span class="role-pill owner">Owner</span>` : isPlotAdmin(plot, person.name) ? `<span class="role-pill admin">Admin</span>` : ""}
                      ${isCheckedIn(plot.id, person.name) ? `<span class="role-pill irl">Here IRL</span>` : ""}
                    </div>
                    <div class="tag">${person.id === "me" ? "That's you" : teaching && person.name === live.teacher ? "Teaching live" : isCheckedIn(plot.id, person.name) ? "Checked in nearby" : "Visiting this plot"}</div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
          <div class="card panel">
            <h3>Groups on this plot</h3>
            <div class="group-list">
              ${groups.length ? groups.map(groupRow).join("") : `<p class="empty">No groups yet. Be the first.</p>`}
            </div>
          </div>
          <div class="card panel">
            <h3>Plot chatter</h3>
            <div class="msg-list">
              ${msgs.length ? msgs.slice(-6).map((msg) => `
                <div class="msg ${msg.bot ? `bot ${msg.kind || ""}` : ""}"><strong>${escapeHtml(msg.name)}</strong><span>${escapeHtml(msg.text)}</span></div>
              `).join("") : `<p class="empty">Say hi. Someone will hear you.</p>`}
            </div>
            ${isBanned() ? `<p class="ban-note">You're banned from town chat. Safety Pip is keeping the town safe.</p>` : `
            <form class="compose" id="chat-form">
              <input name="text" maxlength="80" placeholder="Wave, joke, invite..." />
              <button class="btn" type="submit">Send</button>
            </form>
            `}
          </div>
        </aside>
      </div>
    </section>
  `;
}

function groupsScreen() {
  const mine = state.groups.filter((g) => g.members.includes(state.me.name));
  const listed = state.groups.filter((group) => findPlot(group.plotId));
  return `
    <section class="screen">
      <div class="toolbar">
        <div>
          <h2 style="margin:0">Groups</h2>
          <p class="tag">Make a club around what you like. Each group lives on one plot.</p>
        </div>
        <button class="btn berry" id="open-group">${allPlots().length ? "Start a group" : "Create a plot first"}</button>
      </div>
      <div class="stats">
        <div class="stat">You joined ${mine.length}</div>
        <div class="stat">${listed.length} open groups</div>
      </div>
      ${listed.length ? `
      <div class="group-list">
        ${listed.map((group) => {
          const plot = findPlot(group.plotId);
          return `
            <article class="card panel group-item">
              <div>
                <h3 style="margin:0 0 4px">${escapeHtml(group.name)}</h3>
                <p class="tag">${plot.emoji} ${escapeHtml(plot.name)} · ${group.members.length} members</p>
                <p>${escapeHtml(group.blurb)}</p>
                <p class="tag">${group.members.join(", ")}</p>
              </div>
              <div>
                ${joinButton(group)}
                <div style="height:8px"></div>
                <button class="btn ghost" data-plot="${plot.id}">Visit plot</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
      ` : `
      <div class="card empty-town">
        <h2>No groups yet</h2>
        <p>${allPlots().length ? "Start a group on one of your plots." : "Plant a plot first, then invite people who like the same thing."}</p>
        <button class="btn berry ${allPlots().length ? "" : "open-plot"}" ${allPlots().length ? 'id="open-group-empty"' : ""}>${allPlots().length ? "Start a group" : "Create a plot"}</button>
      </div>
      `}
    </section>
  `;
}

function questsScreen() {
  const quests = allQuests(state.customQuests);
  const doneCount = quests.filter((quest) => isQuestDone(quest.id)).length;
  const parentOn = Boolean(state.parentUnlocked);
  const windowStart = questWindowId();
  return `
    <section class="screen">
      <p class="quest-banner">Kid's Want Digital, Parent's Want Physical, Why Not Make It Phygital.</p>
      <div class="toolbar">
        <div>
          <h2 style="margin:0">Phygital quests</h2>
          <p class="tag">Real-life missions. A parent ticks them when they're done. The board refreshes every 12 hours.</p>
        </div>
        <div class="nav-actions">
          ${parentOn
            ? `<button class="btn ghost" id="lock-parent">Lock parent</button><button class="btn berry" id="open-add-quest">Add quest</button>`
            : `<button class="btn berry" id="open-parent">${state.parentPin ? "Parent unlock" : "Set parent PIN"}</button>`}
        </div>
      </div>
      <div class="stats">
        <div class="stat">${doneCount} / ${quests.length} done</div>
        <div class="stat">⭐ ${hasUnlimitedStars() ? "Unlimited stars" : `${state.stars || 0} stars`}</div>
        <div class="stat">${(state.badges || []).length} badges</div>
        <div class="stat" id="quest-refresh" data-window="${windowStart}">New quests in ${formatWindowLeft(questWindowLeft())}</div>
        <div class="stat">${parentOn ? "Parent mode on" : "Ask a parent to tick"}</div>
      </div>
      ${state.badges?.length ? `
      <div class="card panel reward-shelf">
        <h3>Rewards</h3>
        <p class="tag">Earned when a parent ticks a real-life quest.</p>
        <div class="badge-row">
          ${state.badges.map((badge) => `
            <div class="badge-chip" title="${escapeHtml(badge.name)}">${badge.prize || "⭐"} <span>${escapeHtml(badge.name)}</span></div>
          `).join("")}
        </div>
      </div>
      ` : `<p class="tag">Finish a quest in real life. A parent ticks it, and a reward pops out. Spend stars in the Shop.</p>`}
      <div class="quest-grid">
        ${quests.map((quest) => {
          const done = isQuestDone(quest.id);
          const prize = rewardFor(quest);
          return `
            <article class="card panel quest-card ${done ? "done" : ""}">
              <div class="quest-emoji">${quest.emoji || "⭐"}</div>
              <h3>${escapeHtml(quest.title)}</h3>
              <p>${escapeHtml(quest.blurb || "A real-life quest.")}</p>
              <p class="tag">Reward: ${prize.prize} ${escapeHtml(prize.badge)} · ⭐ ${prize.stars}</p>
              <p class="tag">${done ? "A parent said this is done. Reward collected." : "Not ticked yet."}</p>
              ${parentOn
                ? `<button class="btn ${done ? "ghost" : "berry"}" data-tick-quest="${quest.id}">${done ? "Untick" : "Tick — give reward"}</button>`
                : `<button class="btn ghost" disabled>${done ? "Done ✓" : "Parent ticks this"}</button>`}
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function isTownStaff(name = state.me?.name) {
  return isSiteOwner(name) || isSiteAdmin(name);
}

function hasUnlimitedStars(name = state.me?.name) {
  return isTownStaff(name);
}

function starsLabel() {
  return hasUnlimitedStars() ? "Unlimited" : String(state.stars || 0);
}

function canUseShopItem(item) {
  if (!item) return false;
  if (item.adminOnly && !isTownStaff()) return false;
  return true;
}

function ownsItem(id) {
  return (state.owned || []).includes(id);
}

function isWearing(item) {
  if (!item || !state.me) return false;
  if (item.type === "hat") return normalizeHat(state.me.hat) === item.hat;
  return (state.me.aura || "none") === item.aura;
}

function shopCard(item) {
  const owned = ownsItem(item.id);
  const wearing = isWearing(item);
  const stars = state.stars || 0;
  const staff = canUseShopItem(item);
  const free = hasUnlimitedStars();
  const canBuy = !owned && staff && (free || stars >= item.cost);
  const preview = {
    ...state.me,
    hat: item.type === "hat" ? item.hat : state.me.hat,
    aura: item.type === "aura" ? item.aura : (state.me.aura || "none"),
  };
  let action = "";
  if (item.adminOnly && !staff) {
    action = `<button class="btn ghost" disabled>Admin only</button>`;
  } else if (wearing) {
    action = `<button class="btn ghost" disabled>Wearing</button>`;
  } else if (owned) {
    action = `<button class="btn berry" data-wear-item="${item.id}">Wear it</button>`;
  } else if (canBuy && (item.cost === 0 || free)) {
    action = `<button class="btn berry" data-buy-item="${item.id}">${item.adminOnly ? "Claim — admin" : "Get it"}</button>`;
  } else if (canBuy) {
    action = `<button class="btn berry" data-buy-item="${item.id}">Buy · ⭐ ${item.cost}</button>`;
  } else {
    action = `<button class="btn ghost" disabled>Need ⭐ ${item.cost}</button>`;
  }
  const tag = owned
    ? "In your closet"
    : item.adminOnly
      ? (staff ? "App admin perk · free" : "Town owner or app admin only")
      : free
        ? "Free for town staff"
        : `Costs ⭐ ${item.cost}`;
  return `
    <article class="card panel shop-card ${owned ? "owned" : ""} ${wearing ? "wearing" : ""} ${item.aura === "warp" ? "shop-card-warp" : ""} ${item.aura === "angel" ? "shop-card-angel" : ""}">
      <div class="shop-preview">${avatarMarkup(preview)}</div>
      <h3>${escapeHtml(item.name)}</h3>
      <p>${escapeHtml(item.blurb)}</p>
      <p class="tag">${tag}</p>
      ${action}
    </article>
  `;
}

function shopScreen() {
  const hats = shopHats();
  const auras = shopAuras();
  const ownedCount = (state.owned || []).length;
  return `
    <section class="screen">
      <div class="toolbar">
        <div>
          <h2 style="margin:0">Star shop</h2>
          <p class="tag">${hasUnlimitedStars() ? "Town owner and town admins have unlimited stars." : "Spend quest stars on cool hats and auras. Wear them around town."}</p>
        </div>
        <div class="shop-you">
          ${avatarMarkup(state.me, "lg")}
        </div>
      </div>
      <div class="stats">
        <div class="stat">⭐ ${hasUnlimitedStars() ? "Unlimited stars" : `${state.stars || 0} stars`}</div>
        <div class="stat">${ownedCount} / ${SHOP_ITEMS.length} owned</div>
        <div class="stat">${normalizeHat(state.me.hat) !== "none" ? hatLabel(state.me.hat) : "No hat"}</div>
        <div class="stat">${state.me.aura && state.me.aura !== "none" ? "Aura on" : "No aura"}</div>
      </div>
      <div class="card panel reward-shelf">
        <h3>Free closet</h3>
        <p class="tag">Hats and outfits you already have. Take the aura off anytime.</p>
        <div class="badge-row closet-row">
          ${HATS.map((hat) => hatPickButton(hat.id, normalizeHat(state.me.hat) === hat.id, "data-wear-hat")).join("")}
          <button class="pick ${(state.me.aura || "none") === "none" ? "active" : ""}" data-wear-aura="none">No aura</button>
        </div>
        <div class="badge-row closet-row">
          ${OUTFITS.map((fit) => `
            <button class="pick ${(state.me.outfit || "none") === fit.id ? "active" : ""}" data-wear-outfit="${fit.id}">${fit.label}</button>
          `).join("")}
        </div>
      </div>
      <h3>Auras</h3>
      <div class="quest-grid shop-grid">
        ${auras.map((item) => shopCard(item)).join("")}
      </div>
      <h3>Cool hats</h3>
      <div class="quest-grid shop-grid">
        ${hats.map((item) => shopCard(item)).join("")}
      </div>
    </section>
  `;
}

function leaveGames() {
  stopActiveGame();
  state.gameId = null;
  state.gameResult = null;
}

function gamesScreen() {
  if (state.gameId) return playGameScreen();
  const plays = Object.values(state.gameScores || {}).reduce((sum, rec) => sum + (Number(rec.plays) || 0), 0);
  const wins = Object.values(state.gameScores || {}).reduce((sum, rec) => sum + (Number(rec.wins) || 0), 0);
  return `
    <section class="screen">
      <div class="toolbar">
        <div>
          <h2 style="margin:0">Mini games</h2>
          <p class="tag">Just for fun. Beat your best score, then hop back to town.</p>
        </div>
      </div>
      <div class="stats">
        <div class="stat">${GAMES.length} games</div>
        <div class="stat">${plays} plays</div>
        <div class="stat">${wins} wins</div>
      </div>
      <div class="quest-grid shop-grid">
        ${GAMES.map((game) => {
          const rec = (state.gameScores || {})[game.id] || {};
          return `
            <article class="card panel shop-card game-card">
              <div class="game-preview" aria-hidden="true">${game.emoji}</div>
              <h3>${escapeHtml(game.name)}</h3>
              <p>${escapeHtml(game.blurb)}</p>
              <p class="tag">Best ${rec.best || 0} · Wins ${rec.wins || 0}</p>
              <button class="btn berry" data-play-game="${game.id}">Play</button>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function playGameScreen() {
  const game = gameById(state.gameId);
  if (!game) {
    state.gameId = null;
    return gamesScreen();
  }
  const result = state.gameResult;
  return `
    <section class="screen">
      <div class="toolbar">
        <div>
          <h2 style="margin:0">${game.emoji} ${escapeHtml(game.name)}</h2>
          <p class="tag">${escapeHtml(game.how)}</p>
        </div>
        <div class="nav-actions">
          <button class="btn ghost" id="leave-game">← Arcade</button>
        </div>
      </div>
      ${result ? `
        <div class="card panel game-result">
          <p class="quest-emoji">${result.won ? "🎉" : "✨"}</p>
          <h3>${result.won ? "Nice play!" : "Good try!"}</h3>
          <p>${escapeHtml(result.message || "")}</p>
          <p class="tag">Just for fun · Play again anytime</p>
          <div class="nav-actions" style="justify-content:center;margin-top:12px">
            <button class="btn berry" id="replay-game">Play again</button>
            <button class="btn ghost" id="leave-game-done">Arcade</button>
          </div>
        </div>
      ` : `<div class="card panel game-stage" id="game-stage"></div>`}
    </section>
  `;
}

function finishGame(result) {
  const game = gameById(state.gameId);
  if (!game) return;
  const scores = { ...(state.gameScores || {}) };
  const rec = { best: 0, wins: 0, plays: 0, ...(scores[game.id] || {}) };
  rec.plays += 1;
  rec.best = Math.max(Number(rec.best) || 0, Number(result.score) || 0);
  if (result.won) rec.wins += 1;
  scores[game.id] = rec;
  state.gameScores = scores;
  state.gameResult = result;
  save();
  render();
}

function groupRow(group) {
  return `
    <div class="group-item">
      <div>
        <strong>${escapeHtml(group.name)}</strong>
        <div class="tag">${group.members.length} members · ${escapeHtml(group.blurb)}</div>
      </div>
      ${joinButton(group)}
    </div>
  `;
}

function phygitalPanel(plot, owner) {
  const irl = plotIrl(plot);
  const here = isCheckedIn(plot.id, state.me.name);
  const door = shareUrl(plot);
  const hereNames = checkedInNames(plot.id);
  return `
    <div class="card panel phygital-panel">
      <h3>Phygital door</h3>
      <p class="tag">A real-world sign that opens this digital hangout.</p>
      <div class="code-row">
        <span class="join-code-big">${escapeHtml(plot.code || "------")}</span>
        <button class="btn ghost" id="copy-plot-code" type="button">Copy code</button>
      </div>
      <img class="qr" alt="QR code for this plot" src="${qrImageUrl(door)}" width="160" height="160" />
      ${irl.on ? `<p class="irl-note">Meet IRL${irl.place ? ` at ${escapeHtml(irl.place)}` : ""}${irl.when ? ` · ${escapeHtml(irl.when)}` : ""}</p>` : `<p class="tag">Digital only — turn on IRL if you're meeting in a real place.</p>`}
      <p class="tag">${hereNames.length ? `Here IRL: ${hereNames.map(escapeHtml).join(", ")}` : "Nobody has checked in nearby yet."}</p>
      <div class="nav-actions">
        <button class="btn ${here ? "ghost" : "berry"}" id="checkin-irl" type="button">${here ? "I'm here ✓" : "I'm here IRL"}</button>
        <button class="btn ghost" id="print-plot-sign" type="button">Print sign</button>
        ${owner ? `<button class="btn ghost" id="edit-irl" type="button">${irl.on ? "Edit IRL" : "Add IRL meetup"}</button>` : ""}
      </div>
    </div>
  `;
}

function lessonPanel(plot, live, teacher, teaching) {
  if (!teaching) {
    if (!teacher) return "";
    return `
      <div class="card panel lesson-panel">
        <h3>Teach live</h3>
        <p class="tag">Share what you learned. Friends on this plot can follow along.</p>
        <button class="btn berry go-live">Go live</button>
      </div>
    `;
  }
  const claps = live.claps || 0;
  const gotIt = Array.isArray(live.gotIt) ? live.gotIt : [];
  const learning = Array.isArray(live.learning) ? live.learning : [];
  const meName = state.me.name;
  const iGotIt = gotIt.includes(meName);
  const iLearn = learning.includes(meName);
  return `
    <div class="card panel lesson-panel on-air">
      <div class="lesson-head">
        <span class="live-pill">LIVE</span>
        <span class="tag">with ${escapeHtml(live.teacher || plot.owner || "a teacher")}</span>
      </div>
      ${teacher ? `
        <form id="live-update-form" class="form-grid">
          <label>Lesson title
            <input name="title" required maxlength="42" value="${escapeHtml(live.title)}" />
          </label>
          <label>What you learned / what you're teaching
            <textarea name="notes" required maxlength="280">${escapeHtml(live.notes)}</textarea>
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Update lesson</button>
            <button class="btn ghost" type="button" id="end-live">End live</button>
          </div>
        </form>
      ` : `
        <h3 style="margin:8px 0 6px">${escapeHtml(live.title)}</h3>
        <p class="lesson-notes">${escapeHtml(live.notes)}</p>
      `}
      <p class="tag">${claps} claps · ${gotIt.length} got it · ${learning.length} learning</p>
      ${teacher ? "" : `
        <div class="nav-actions">
          <button class="btn ghost" id="live-clap">Clap</button>
          <button class="btn ${iLearn ? "ghost" : "berry"}" id="live-learn">${iLearn ? "Learning ✓" : "I'm learning"}</button>
          <button class="btn ${iGotIt ? "ghost" : ""}" id="live-gotit">${iGotIt ? "Got it ✓" : "Got it"}</button>
        </div>
      `}
    </div>
  `;
}

function joinButton(group) {
  const inGroup = group.members.includes(state.me.name);
  return `<button class="btn ${inGroup ? "ghost" : ""}" data-join="${group.id}">${inGroup ? "Leave" : "Join"}</button>`;
}

function modalScreen() {
  if (state.modal === "plot") return plotModal();
  if (state.modal === "delete") return deleteModal();
  if (state.modal === "live") return liveModal();
  if (state.modal === "admins") return adminsModal();
  if (state.modal === "town-admins") return townAdminsModal();
  if (state.modal === "phygital") return phygitalModal();
  if (state.modal === "irl") return irlModal();
  if (state.modal === "parent") return parentModal();
  if (state.modal === "add-quest") return addQuestModal();
  if (state.modal === "reward") return rewardModal();
  return groupModal();
}

function rewardModal() {
  const prize = state.lastReward;
  if (!prize) return "";
  return `
    <div class="modal-back" id="modal-back">
      <div class="card modal reward-pop">
        <p class="tag">Reward unlocked</p>
        <div class="poster-emoji">${prize.prize || "⭐"}</div>
        <h2>${escapeHtml(prize.badge)}</h2>
        <p>You did <strong>${escapeHtml(prize.questTitle)}</strong> in real life.</p>
        <p class="stat" style="display:inline-block">+⭐ ${prize.stars} stars</p>
        <div class="nav-actions" style="justify-content:center;margin-top:16px">
          <button class="btn berry" type="button" id="close-modal">Yay!</button>
          <button class="btn ghost" type="button" id="reward-to-shop">Spend stars</button>
        </div>
      </div>
    </div>
  `;
}

function parentModal() {
  const setting = !state.parentPin;
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="parent-pin-form">
        <h2>${setting ? "Set a parent PIN" : "Parent unlock"}</h2>
        <p class="tag">${setting
          ? "Pick a 4-digit PIN only grown-ups should know. Kids can see quests, but only a parent can tick them."
          : "Enter the parent PIN to tick real-life quests."}</p>
        <div class="form-grid">
          <label>4-digit PIN
            <input name="pin" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required placeholder="••••" />
          </label>
          ${setting ? `
          <label>Type it again
            <input name="pin2" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" required placeholder="••••" />
          </label>
          ` : ""}
          <div class="nav-actions">
            <button class="btn berry" type="submit">${setting ? "Save PIN" : "Unlock"}</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function addQuestModal() {
  if (!state.parentUnlocked) return "";
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="add-quest-form">
        <h2>Add a real-life quest</h2>
        <p class="tag">Something a child can do in the real world. You tick it when it's done.</p>
        <div class="form-grid">
          <label>Quest name
            <input name="title" required maxlength="36" placeholder="Brush teeth without being asked" />
          </label>
          <label>What it looks like
            <textarea name="blurb" maxlength="100" placeholder="Two minutes. Smile in the mirror."></textarea>
          </label>
          <label>Emoji
            <input name="emoji" maxlength="4" value="⭐" />
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Add quest</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function phygitalModal() {
  const plot = findPlot(state.plotId);
  if (!plot) return "";
  const door = shareUrl(plot);
  const irl = plotIrl(plot);
  return `
    <div class="modal-back" id="modal-back">
      <div class="card modal print-poster">
        <p class="tag">Phygital sign</p>
        <div class="poster-emoji">${plot.emoji}</div>
        <h2>${escapeHtml(plot.name)}</h2>
        <p>${escapeHtml(plot.blurb)}</p>
        <img class="qr lg" alt="QR code for this plot" src="${qrImageUrl(door)}" width="200" height="200" />
        <p class="join-code-big">${escapeHtml(plot.code || "------")}</p>
        <p class="tag">Scan the QR or type the code at Motion Magic to hang out here.</p>
        ${irl.on ? `<p class="irl-note">IRL${irl.place ? ` · ${escapeHtml(irl.place)}` : ""}${irl.when ? ` · ${escapeHtml(irl.when)}` : ""}</p>` : ""}
        <div class="nav-actions no-print">
          <button class="btn berry" type="button" id="print-now">Print this sign</button>
          <button class="btn ghost" type="button" id="close-modal">Close</button>
        </div>
      </div>
    </div>
  `;
}

function irlModal() {
  const plot = findPlot(state.plotId);
  if (!plot || !isPlotOwner(plot)) return "";
  const irl = plotIrl(plot);
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="irl-form">
        <h2>IRL meetup</h2>
        <p class="tag">Tell friends where the digital plot meets the real world. Don't share a home address — Safety Pip will ban that.</p>
        <div class="form-grid">
          <label class="check-row">
            <input type="checkbox" name="on" ${irl.on ? "checked" : ""} />
            This plot has a real-world hangout
          </label>
          <label>Place
            <input name="place" maxlength="48" value="${escapeHtml(irl.place)}" placeholder="Library, cafe, school club..." />
          </label>
          <label>When
            <input name="when" maxlength="42" value="${escapeHtml(irl.when)}" placeholder="Saturdays after 3" />
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Save IRL</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function townPeopleNames() {
  const names = new Set();
  allPlots().forEach((plot) => {
    if (plot.owner) names.add(plot.owner);
    plotAdmins(plot).forEach((name) => names.add(name));
    getParkPeople(plot.id).forEach((person) => names.add(person.name));
  });
  (state.groups || []).forEach((group) => {
    (group.members || []).forEach((name) => names.add(name));
  });
  Object.values(state.checkins || {}).forEach((bag) => {
    if (bag && typeof bag === "object") Object.keys(bag).forEach((name) => names.add(name));
  });
  names.delete(state.siteOwner);
  names.delete(state.me?.name);
  return [...names].filter(Boolean);
}

function townAdminsModal() {
  if (!isSiteOwner()) return "";
  const names = townPeopleNames();
  const admins = state.siteAdmins || [];
  return `
    <div class="modal-back" id="modal-back">
      <div class="card modal">
        <h2>Town admins</h2>
        <p class="tag">People you pick can wear Angel and help run the app. Only you can add or remove them.</p>
        <div class="picks admin-picks">
          ${names.length ? names.map((name) => `
            <button type="button" class="pick ${admins.includes(name) ? "active" : ""}" data-town-admin="${escapeHtml(name)}">${escapeHtml(name)}${admins.includes(name) ? " · App admin" : ""}</button>
          `).join("") : `<p class="empty">Nobody else is in town yet. Type a name below, or wait for a visitor.</p>`}
        </div>
        <form class="form-grid" id="town-admin-form">
          <label>Add by name
            <input name="name" maxlength="16" placeholder="A friend's avatar name" />
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Make admin</button>
            <button class="btn ghost" type="button" id="close-modal">Done</button>
          </div>
        </form>
        <p class="tag">${admins.length ? `App admins: ${admins.map(escapeHtml).join(", ")}` : "No app admins yet."}</p>
      </div>
    </div>
  `;
}

function adminsModal() {
  const plot = findPlot(state.plotId);
  if (!plot || !isPlotOwner(plot)) return "";
  const names = plotPeopleNames(plot);
  const admins = plotAdmins(plot);
  return `
    <div class="modal-back" id="modal-back">
      <div class="card modal">
        <h2>Pick admins</h2>
        <p class="tag">Tap someone hanging out here to let them teach live. They still can't delete this plot or pick other admins.</p>
        <div class="picks admin-picks">
          ${names.length ? names.map((name) => `
            <button type="button" class="pick ${admins.includes(name) ? "active" : ""}" data-admin-name="${escapeHtml(name)}">${escapeHtml(name)}${admins.includes(name) ? " · Admin" : ""}</button>
          `).join("") : `<p class="empty">Nobody else is here yet. Wait for a visitor, then pick them.</p>`}
        </div>
        <p class="tag">${admins.length ? `Admins: ${admins.map(escapeHtml).join(", ")}` : "No admins yet."}</p>
        <div class="nav-actions">
          <button class="btn berry" type="button" id="close-modal">Done</button>
        </div>
      </div>
    </div>
  `;
}

function liveModal() {
  const plot = findPlot(state.plotId);
  if (!plot || !canTeachOn(plot)) return "";
  const prev = getLive(plot.id) || {};
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="live-start-form">
        <h2>Go live and teach</h2>
        <p class="tag">Tell people what you learned. Anyone hanging out here can follow the lesson.</p>
        <div class="form-grid">
          <label>Lesson title
            <input name="title" required maxlength="42" value="${escapeHtml(prev.title || "")}" placeholder="How I finally got the hang of chords" />
          </label>
          <label>What you learned / what you're teaching
            <textarea name="notes" required maxlength="280" placeholder="Start with two notes. Hum them. Then try together.">${escapeHtml(prev.notes || "")}</textarea>
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Start live</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function deleteModal() {
  const plot = findPlot(state.plotId);
  if (!plot) return "";
  const groupCount = state.groups.filter((g) => Number(g.plotId) === Number(plot.id)).length;
  return `
    <div class="modal-back" id="modal-back">
      <div class="card modal">
        <h2>Delete ${plot.emoji} ${escapeHtml(plot.name)}?</h2>
        <p class="tag">This removes the plot${groupCount ? `, ${groupCount} group${groupCount === 1 ? "" : "s"},` : ""} and its chatter. You cannot undo it.</p>
        <div class="nav-actions">
          <button class="btn danger solid" id="confirm-delete">Delete plot</button>
          <button class="btn ghost" type="button" id="close-modal">Keep it</button>
        </div>
      </div>
    </div>
  `;
}

function groupModal() {
  const plots = allPlots();
  if (!plots.length) {
    return canCreatePlot() ? plotModal() : "";
  }
  const current = findPlot(state.plotId) || plots[0];
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="group-form">
        <h2>Make a group</h2>
        <p class="tag">Pick the plot that matches the vibe, then invite people who like the same thing.</p>
        <div class="form-grid">
          <label>Group name
            <input name="name" required maxlength="28" placeholder="Midnight Pizza Club" />
          </label>
          <label>Lives on plot
            <select name="plotId">
              ${allPlots().map((plot) => `
                <option value="${plot.id}" ${plot.id === current.id ? "selected" : ""}>#${plot.id} ${escapeHtml(plot.name)}</option>
              `).join("")}
            </select>
          </label>
          <label>What you like
            <textarea name="blurb" required maxlength="120" placeholder="We meet to talk snacks, share playlists, and wave at strangers."></textarea>
          </label>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Create group</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function plotModal() {
  const theme = PLOT_THEMES[0];
  return `
    <div class="modal-back" id="modal-back">
      <form class="card modal" id="plot-form">
        <h2>Create a plot</h2>
        <p class="tag">Make a hangout for what you like. Friends can visit, walk around, and start groups here.</p>
        <div class="form-grid">
          <label>Plot name
            <input name="name" required maxlength="24" placeholder="Moonlit Dumpling Yard" />
          </label>
          <label>What people like here
            <textarea name="blurb" required maxlength="120" placeholder="Late-night dumplings, steam, and kind strangers."></textarea>
          </label>
          <label>Category
            <select name="category">
              ${CATEGORIES.map((cat) => `<option value="${cat.id}">${cat.label}</option>`).join("")}
            </select>
          </label>
          <div>
            <label>Emoji</label>
            <div class="picks" id="plot-emojis">
              ${PLOT_EMOJIS.map((emoji, i) => `
                <button type="button" class="pick ${i === 0 ? "active" : ""}" data-plot-emoji="${emoji}">${emoji}</button>
              `).join("")}
            </div>
            <input type="hidden" name="emoji" value="${PLOT_EMOJIS[0]}" />
          </div>
          <div>
            <label>Color</label>
            <div class="swatches" id="plot-colors">
              ${PLOT_THEMES.map((item, i) => `
                <button type="button" class="swatch ${i === 0 ? "active" : ""}" data-plot-color="${item.color}" data-plot-ground="${item.ground}" style="background:${item.color}"></button>
              `).join("")}
            </div>
            <input type="hidden" name="color" value="${theme.color}" />
            <input type="hidden" name="ground" value="${theme.ground}" />
          </div>
          <div class="nav-actions">
            <button class="btn berry" type="submit">Plant this plot</button>
            <button class="btn ghost" type="button" id="close-modal">Not now</button>
          </div>
        </div>
      </form>
    </div>
  `;
}

function decorations(plot) {
  const rand = seed(plot.id * 9);
  return Array.from({ length: 8 }, (_, i) => {
    const glyphs = [plot.emoji, "🌳", "🌼", "☁️", "🪨"];
    const glyph = glyphs[Math.floor(rand() * glyphs.length)];
    const left = 6 + rand() * 88;
    const top = 8 + rand() * 78;
    return `<div class="park-deco tree" style="left:${left}%; top:${top}%; font-size:${1.4 + rand()}rem">${glyph}</div>`;
  }).join("");
}

function getParkPeople(plotId) {
  const visitors = visitorsFor(plotId);
  const me = {
    ...state.me,
    id: "me",
    x: state.me.x ?? 50,
    y: state.me.y ?? 62,
  };
  return [me, ...visitors];
}

function syncDraftName() {
  const typed = document.getElementById("name-input")?.value;
  if (typeof typed === "string") state.draft.name = typed;
}

function bindWelcome() {
  document.getElementById("name-input").addEventListener("input", (e) => {
    state.draft.name = e.target.value;
  });
  document.querySelectorAll("[data-skin]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncDraftName();
      state.draft.skin = btn.dataset.skin;
      render();
      document.getElementById("name-input")?.focus();
    });
  });
  document.querySelectorAll("[data-eyes]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncDraftName();
      state.draft.eyes = btn.dataset.eyes;
      render();
    });
  });
  document.querySelectorAll("[data-hat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncDraftName();
      state.draft.hat = btn.dataset.hat;
      render();
    });
  });
  document.querySelectorAll("[data-outfit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      syncDraftName();
      state.draft.outfit = btn.dataset.outfit;
      render();
    });
  });
  document.getElementById("enter-world").addEventListener("click", () => {
    const typed = document.getElementById("name-input")?.value || "";
    const name = typed.trim() || state.draft.name.trim() || "Little One";
    state.draft.name = name;
    state.me = {
      ...state.draft,
      name,
      hat: normalizeHat(state.draft.hat),
      aura: state.me?.aura || "none",
      x: 48,
      y: 64,
    };
    grantSiteOwner(state);
    state.view = "map";
    save();
    consumePhygitalLink();
    if (state.view !== "plot" && !state.portaling) render();
  });
}

function bindChrome() {
  document.querySelectorAll("[data-go]").forEach((btn) => {
    btn.addEventListener("click", () => {
      leaveGames();
      state.view = btn.dataset.go;
      state.modal = null;
      render();
    });
  });
  document.getElementById("reset-me")?.addEventListener("click", () => {
    leaveGames();
    state.me = null;
    state.view = "welcome";
    render();
  });
  document.querySelectorAll("#open-group, #open-group-empty").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.modal = allPlots().length ? "group" : (canCreatePlot() ? "plot" : "group");
      render();
    });
  });
  document.querySelectorAll(".go-live").forEach((btn) => {
    btn.addEventListener("click", () => {
      const plot = findPlot(state.plotId);
      if (!canTeachOn(plot)) return;
      state.modal = "live";
      render();
    });
  });
  document.getElementById("end-live")?.addEventListener("click", () => endLive(state.plotId));
  document.getElementById("live-clap")?.addEventListener("click", () => clapLive(state.plotId));
  document.getElementById("live-learn")?.addEventListener("click", () => toggleLearn(state.plotId));
  document.getElementById("live-gotit")?.addEventListener("click", () => toggleGotIt(state.plotId));
  document.getElementById("live-update-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    updateLive(state.plotId, data.get("title").toString().trim(), data.get("notes").toString().trim());
  });
  document.getElementById("pick-admins")?.addEventListener("click", () => {
    if (!isPlotOwner(findPlot(state.plotId))) return;
    state.modal = "admins";
    render();
  });
  document.getElementById("pick-town-admins")?.addEventListener("click", () => {
    if (!isSiteOwner()) return;
    state.modal = "town-admins";
    render();
  });
  document.querySelectorAll("[data-admin-name]").forEach((btn) => {
    btn.addEventListener("click", () => toggleAdmin(state.plotId, btn.dataset.adminName));
  });
  document.querySelectorAll("[data-town-admin]").forEach((btn) => {
    btn.addEventListener("click", () => toggleTownAdmin(btn.dataset.townAdmin));
  });
  document.getElementById("town-admin-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    addTownAdmin(new FormData(e.target).get("name")?.toString() || "");
  });
  document.getElementById("delete-plot")?.addEventListener("click", () => {
    if (!isPlotOwner(findPlot(state.plotId))) return;
    state.modal = "delete";
    render();
  });
  document.querySelectorAll(".open-plot").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!canCreatePlot()) return;
      state.modal = "plot";
      render();
    });
  });
  document.querySelectorAll("[data-join]").forEach((btn) => {
    btn.addEventListener("click", () => toggleJoin(btn.dataset.join));
  });
  document.querySelectorAll("[data-plot]").forEach((btn) => {
    btn.addEventListener("click", () => enterPlot(Number(btn.dataset.plot)));
  });
  document.getElementById("open-phygital")?.addEventListener("click", () => {
    state.modal = "phygital";
    render();
  });
  document.getElementById("edit-irl")?.addEventListener("click", () => {
    if (!isPlotOwner(findPlot(state.plotId))) return;
    state.modal = "irl";
    render();
  });
  document.getElementById("copy-plot-code")?.addEventListener("click", () => copyPlotCode());
  document.getElementById("print-plot-sign")?.addEventListener("click", () => {
    state.modal = "phygital";
    render();
  });
  document.getElementById("print-now")?.addEventListener("click", () => window.print());
  document.getElementById("checkin-irl")?.addEventListener("click", () => toggleCheckin(state.plotId));
}

function bindMap() {
  const search = document.getElementById("plot-search");
  if (!search) return;
  search.addEventListener("input", (e) => {
    state.query = e.target.value;
    const active = document.activeElement === e.target;
    const start = e.target.selectionStart;
    render();
    if (active) {
      const next = document.getElementById("plot-search");
      next?.focus();
      next?.setSelectionRange(start, start);
    }
  });
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      render();
    });
  });
  document.getElementById("join-code-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const code = normalizeCode(new FormData(e.target).get("code"));
    if (!joinPhygital(code, "")) {
      showFlash("No plot found for that code.");
      render();
    }
  });
}

function bindPlot() {
  const park = document.getElementById("park");
  if (!park) return;
  park.addEventListener("click", (e) => {
    const box = park.getBoundingClientRect();
    state.me.x = ((e.clientX - box.left) / box.width) * 100;
    state.me.y = ((e.clientY - box.top) / box.height) * 100;
    save();
    const you = park.querySelector(".little.you");
    if (you) {
      you.style.left = `${state.me.x}%`;
      you.style.top = `${state.me.y}%`;
    }
  });
  document.getElementById("chat-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = new FormData(e.target).get("text").toString().trim();
    if (!text) return;
    if (applyModeration(text, state.plotId) !== "ok") {
      render();
      return;
    }
    const list = state.messages[state.plotId] || [];
    list.push({ name: state.me.name, text });
    state.messages[state.plotId] = list.slice(-20);
    save();
    render();
  });
  wanderVisitors();
}

function bindGroups() {
  /* joins and plot visits bound in chrome */
}

let questClock = 0;

function bindQuests() {
  window.clearInterval(questClock);
  questClock = window.setInterval(() => {
    const el = document.getElementById("quest-refresh");
    if (!el) {
      window.clearInterval(questClock);
      return;
    }
    if (Number(el.dataset.window) !== questWindowId()) {
      render();
      return;
    }
    el.textContent = `New quests in ${formatWindowLeft(questWindowLeft())}`;
  }, 15000);
  document.getElementById("open-parent")?.addEventListener("click", () => {
    state.modal = "parent";
    render();
  });
  document.getElementById("lock-parent")?.addEventListener("click", () => {
    state.parentUnlocked = false;
    showFlash("Parent mode locked");
    render();
  });
  document.getElementById("open-add-quest")?.addEventListener("click", () => {
    if (!state.parentUnlocked) return;
    state.modal = "add-quest";
    render();
  });
  document.querySelectorAll("[data-tick-quest]").forEach((btn) => {
    btn.addEventListener("click", () => toggleQuest(btn.dataset.tickQuest));
  });
}

function bindShop() {
  document.querySelectorAll("[data-buy-item]").forEach((btn) => {
    btn.addEventListener("click", () => buyShopItem(btn.dataset.buyItem));
  });
  document.querySelectorAll("[data-wear-item]").forEach((btn) => {
    btn.addEventListener("click", () => wearShopItem(btn.dataset.wearItem));
  });
  document.querySelectorAll("[data-wear-hat]").forEach((btn) => {
    btn.addEventListener("click", () => wearStarterHat(btn.dataset.wearHat));
  });
  document.querySelectorAll("[data-wear-aura]").forEach((btn) => {
    btn.addEventListener("click", () => wearAura(btn.dataset.wearAura));
  });
  document.querySelectorAll("[data-wear-outfit]").forEach((btn) => {
    btn.addEventListener("click", () => wearOutfit(btn.dataset.wearOutfit));
  });
}

function bindGames() {
  document.querySelectorAll("[data-play-game]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const game = gameById(btn.dataset.playGame);
      if (!game) return;
      stopActiveGame();
      state.gameId = game.id;
      state.gameResult = null;
      render();
    });
  });
  document.getElementById("leave-game")?.addEventListener("click", () => {
    leaveGames();
    state.view = "games";
    render();
  });
  document.getElementById("leave-game-done")?.addEventListener("click", () => {
    leaveGames();
    state.view = "games";
    render();
  });
  document.getElementById("replay-game")?.addEventListener("click", () => {
    stopActiveGame();
    state.gameResult = null;
    render();
  });
  const stage = document.getElementById("game-stage");
  if (stage && state.gameId && !state.gameResult) {
    mountGame(state.gameId, stage, { onFinish: finishGame });
  }
}

function bindModal() {
  document.getElementById("close-modal")?.addEventListener("click", () => {
    state.modal = null;
    state.lastReward = null;
    render();
  });
  document.getElementById("reward-to-shop")?.addEventListener("click", () => {
    state.modal = null;
    state.lastReward = null;
    state.view = "shop";
    render();
  });
  document.getElementById("modal-back")?.addEventListener("click", (e) => {
    if (e.target.id === "modal-back") {
      state.modal = null;
      state.lastReward = null;
      render();
    }
  });
  document.querySelectorAll("[data-plot-emoji]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = document.getElementById("plot-form");
      form.emoji.value = btn.dataset.plotEmoji;
      document.querySelectorAll("[data-plot-emoji]").forEach((el) => el.classList.toggle("active", el === btn));
    });
  });
  document.querySelectorAll("[data-plot-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = document.getElementById("plot-form");
      form.color.value = btn.dataset.plotColor;
      form.ground.value = btn.dataset.plotGround;
      document.querySelectorAll("[data-plot-color]").forEach((el) => el.classList.toggle("active", el === btn));
    });
  });
  document.getElementById("group-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    state.groups.unshift({
      id: uid("g"),
      name: data.get("name").toString().trim(),
      plotId: Number(data.get("plotId")),
      blurb: data.get("blurb").toString().trim(),
      members: [state.me.name],
    });
    state.modal = null;
    state.view = "groups";
    save();
    render();
  });
  document.getElementById("confirm-delete")?.addEventListener("click", () => {
    deletePlot(state.plotId);
  });
  document.getElementById("live-start-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    startLive(state.plotId, data.get("title").toString().trim(), data.get("notes").toString().trim());
  });
  document.getElementById("irl-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    saveIrlMeetup(state.plotId, new FormData(e.target));
  });
  document.getElementById("print-now")?.addEventListener("click", () => window.print());
  document.getElementById("parent-pin-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    handleParentPin(new FormData(e.target));
  });
  document.getElementById("add-quest-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    addCustomQuest(new FormData(e.target));
  });
  document.getElementById("plot-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!canCreatePlot()) {
      state.modal = null;
      render();
      return;
    }
    const data = new FormData(e.target);
    const name = data.get("name").toString().trim();
    const blurb = data.get("blurb").toString().trim();
    const naming = moderateText(`${name} ${blurb}`);
    if (naming.action === "block") {
      showFlash("Please pick a kind plot name. Swears aren't allowed.");
      render();
      return;
    }
    if (naming.action !== "ok") {
      applyModeration(`${name} ${blurb}`, state.plotId);
      state.modal = naming.action === "ban" ? null : state.modal;
      render();
      return;
    }
    const plot = {
      id: nextPlotId(),
      name,
      blurb,
      category: data.get("category").toString(),
      emoji: data.get("emoji").toString() || "🌈",
      color: data.get("color").toString() || PLOT_THEMES[0].color,
      ground: data.get("ground").toString() || PLOT_THEMES[0].ground,
      custom: true,
      owner: state.me.name,
      admins: [],
      code: makePlotCode(usedCodes(allPlots())),
      irl: emptyIrl(),
    };
    state.customPlots.unshift(plot);
    const opened = expandIfFull();
    if (opened) showFlash(`${opened} new plots opened up!`);
    state.modal = null;
    state.filter = "all";
    state.query = "";
    save();
    enterPlot(plot.id);
    if (state.view !== "plot" && !state.portaling) render();
  });
}

function deletePlot(id) {
  const plotId = Number(id);
  if (!isPlotOwner(findPlot(plotId))) return;
  state.customPlots = state.customPlots.filter((plot) => Number(plot.id) !== plotId);
  state.groups = state.groups.filter((group) => Number(group.plotId) !== plotId);
  Object.keys(state.messages).forEach((key) => {
    if (Number(key) === plotId) delete state.messages[key];
  });
  delete state.lives[liveKey(plotId)];
  if (state.checkins) delete state.checkins[String(plotId)];
  state.modal = null;
  state.view = "map";
  state.plotId = allPlots()[0]?.id || 1;
  save();
  render();
}

function toggleTownAdmin(name) {
  if (!isSiteOwner() || !name || name === state.siteOwner) return;
  const clean = name.toString().trim().slice(0, 16);
  if (!clean) return;
  if (!state.siteAdmins) state.siteAdmins = [];
  if (state.siteAdmins.includes(clean)) {
    state.siteAdmins = state.siteAdmins.filter((admin) => admin !== clean);
    showFlash(`${clean} is not an app admin anymore`);
  } else {
    state.siteAdmins.push(clean);
    showFlash(`${clean} is an app admin now`);
  }
  save();
  render();
}

function addTownAdmin(raw) {
  if (!isSiteOwner()) return;
  const name = raw.toString().trim().slice(0, 16);
  if (!name) {
    showFlash("Type a name first");
    render();
    return;
  }
  if (name === state.me.name || name === state.siteOwner) {
    showFlash("You're already the town owner");
    render();
    return;
  }
  const verdict = moderateText(name);
  if (verdict.action !== "ok") {
    showFlash("Please use kind words for admin names.");
    render();
    return;
  }
  if (!(state.siteAdmins || []).includes(name)) {
    state.siteAdmins = [...(state.siteAdmins || []), name];
    showFlash(`${name} is an app admin now`);
  }
  save();
  render();
}

function toggleAdmin(plotId, name) {
  const plot = findPlot(plotId);
  if (!isPlotOwner(plot) || !name || name === plot.owner) return;
  if (!Array.isArray(plot.admins)) plot.admins = [];
  if (plot.admins.includes(name)) {
    plot.admins = plot.admins.filter((admin) => admin !== name);
  } else {
    plot.admins.push(name);
  }
  save();
  render();
}

function startLive(plotId, title, notes) {
  const plot = findPlot(plotId);
  if (!canTeachOn(plot) || !title || !notes) return;
  if (applyModeration(`${title} ${notes}`, plotId) !== "ok") {
    state.modal = null;
    render();
    return;
  }
  if (!state.lives) state.lives = {};
  const prev = getLive(plotId) || {};
  state.lives[liveKey(plotId)] = {
    on: true,
    title,
    notes,
    teacher: state.me.name,
    claps: prev.claps || 0,
    gotIt: prev.gotIt || [],
    learning: prev.learning || [],
  };
  state.modal = null;
  save();
  showFlash("You're live — teach what you learned!");
  render();
}

function endLive(plotId) {
  const plot = findPlot(plotId);
  if (!canTeachOn(plot)) return;
  const live = getLive(plotId);
  if (!live) return;
  live.on = false;
  save();
  render();
}

function updateLive(plotId, title, notes) {
  const plot = findPlot(plotId);
  const live = getLive(plotId);
  if (!canTeachOn(plot) || !live?.on || !title || !notes) return;
  if (applyModeration(`${title} ${notes}`, plotId) !== "ok") {
    if (isBanned()) endLive(plotId);
    render();
    return;
  }
  live.title = title;
  live.notes = notes;
  save();
  showFlash("Lesson updated");
  render();
}

function clapLive(plotId) {
  const live = getLive(plotId);
  if (!live?.on) return;
  live.claps = (live.claps || 0) + 1;
  save();
  render();
}

function toggleNameList(list, name) {
  const next = Array.isArray(list) ? [...list] : [];
  const i = next.indexOf(name);
  if (i >= 0) next.splice(i, 1);
  else next.push(name);
  return next;
}

function toggleLearn(plotId) {
  const live = getLive(plotId);
  if (!live?.on || canTeachOn(findPlot(plotId))) return;
  live.learning = toggleNameList(live.learning, state.me.name);
  save();
  render();
}

function toggleGotIt(plotId) {
  const live = getLive(plotId);
  if (!live?.on || canTeachOn(findPlot(plotId))) return;
  live.gotIt = toggleNameList(live.gotIt, state.me.name);
  save();
  render();
}

function isQuestDone(id) {
  const rec = state.questDone?.[id];
  return Boolean(rec?.done && rec.window === questWindowId());
}

function toggleQuest(id) {
  if (!state.parentUnlocked || !id) return;
  if (!state.questDone) state.questDone = {};
  const quest = allQuests(state.customQuests).find((item) => item.id === id);
  const prize = rewardFor(quest);
  const was = isQuestDone(id);
  if (was) {
    delete state.questDone[id];
    state.stars = Math.max(0, (state.stars || 0) - prize.stars);
    state.badges = (state.badges || []).filter((badge) => badge.questId !== id);
    state.lastReward = null;
    showFlash("Quest unticked. Reward taken back.");
  } else {
    state.questDone[id] = { done: true, at: Date.now(), stars: prize.stars, window: questWindowId() };
    state.stars = (state.stars || 0) + prize.stars;
    if (!(state.badges || []).some((badge) => badge.questId === id)) {
      state.badges = [...(state.badges || []), {
        questId: id,
        name: prize.badge,
        prize: prize.prize,
      }];
    }
    state.lastReward = { ...prize, questTitle: quest?.title || "a quest" };
    state.modal = "reward";
    showFlash(`Reward: ${prize.prize} ${prize.badge} · +${prize.stars} stars`);
  }
  save();
  render();
}

function buyShopItem(id) {
  const item = shopItem(id);
  if (!item || !state.me) return;
  if (!canUseShopItem(item)) {
    showFlash(`${item.name} is for the town owner and app admins.`);
    render();
    return;
  }
  if (ownsItem(id)) {
    wearShopItem(id);
    return;
  }
  const free = hasUnlimitedStars();
  if (!free && (state.stars || 0) < item.cost) {
    showFlash(`Need ⭐ ${item.cost} for ${item.name}`);
    render();
    return;
  }
  if (item.cost && !free) state.stars -= item.cost;
  state.owned = [...(state.owned || []), item.id];
  applyShopLook(item);
  save();
  showFlash(free || !item.cost ? `Claimed ${item.name}!` : `Bought ${item.name}!`);
  render();
}

function wearShopItem(id) {
  const item = shopItem(id);
  if (!item || !state.me || !ownsItem(id)) return;
  if (!canUseShopItem(item)) {
    showFlash(`${item.name} is for the town owner and app admins.`);
    render();
    return;
  }
  applyShopLook(item);
  save();
  showFlash(`Wearing ${item.name}`);
  render();
}

function applyShopLook(item) {
  if (item.type === "hat") state.me.hat = normalizeHat(item.hat);
  if (item.type === "aura") state.me.aura = item.aura;
}

function wearStarterHat(hat) {
  if (!state.me) return;
  state.me.hat = normalizeHat(hat);
  save();
  render();
}

function wearAura(aura) {
  if (!state.me) return;
  state.me.aura = aura || "none";
  save();
  render();
}

function wearOutfit(outfit) {
  if (!state.me) return;
  if (!OUTFITS.some((fit) => fit.id === outfit)) return;
  state.me.outfit = outfit;
  save();
  render();
}

function handleParentPin(data) {
  const pin = String(data.get("pin") || "").replace(/\D/g, "").slice(0, 4);
  if (pin.length !== 4) {
    showFlash("PIN must be 4 digits");
    render();
    return;
  }
  if (!state.parentPin) {
    const again = String(data.get("pin2") || "").replace(/\D/g, "").slice(0, 4);
    if (pin !== again) {
      showFlash("PINs didn't match");
      render();
      return;
    }
    state.parentPin = pin;
    state.parentUnlocked = true;
    state.modal = null;
    save();
    showFlash("Parent PIN saved. You can tick quests now.");
    render();
    return;
  }
  if (pin !== state.parentPin) {
    showFlash("That PIN is wrong");
    render();
    return;
  }
  state.parentUnlocked = true;
  state.modal = null;
  showFlash("Parent mode unlocked");
  render();
}

function addCustomQuest(data) {
  if (!state.parentUnlocked) return;
  const title = data.get("title")?.toString().trim() || "";
  const blurb = data.get("blurb")?.toString().trim() || "";
  const emoji = data.get("emoji")?.toString().trim() || "⭐";
  if (!title) return;
  const verdict = moderateText(`${title} ${blurb}`);
  if (verdict.action !== "ok") {
    showFlash(verdict.action === "block" ? "Please use kind words on quests." : "That quest isn't allowed.");
    if (verdict.action === "ban") applyModeration(`${title} ${blurb}`, state.plotId);
    render();
    return;
  }
  if (!state.customQuests) state.customQuests = [];
  state.customQuests.push({
    id: uid("quest"),
    title: title.slice(0, 36),
    blurb: blurb.slice(0, 100),
    emoji: emoji.slice(0, 4),
    reward: { ...DEFAULT_REWARD, badge: `${title.slice(0, 18)} Star`, prize: emoji.slice(0, 4) },
  });
  state.modal = null;
  save();
  showFlash("Quest added");
  render();
}

function findPlotByCode(code) {
  const needle = normalizeCode(code);
  if (!needle) return null;
  return allPlots().find((plot) => normalizeCode(plot.code) === needle) || null;
}

function isCheckedIn(plotId, name) {
  const bag = state.checkins?.[String(plotId)];
  return Boolean(bag && name && bag[name]);
}

function checkedInNames(plotId) {
  const bag = state.checkins?.[String(plotId)] || {};
  return Object.keys(bag).filter((name) => bag[name]);
}

function toggleCheckin(plotId) {
  if (!state.me?.name || !findPlot(plotId)) return;
  if (!state.checkins) state.checkins = {};
  const key = String(plotId);
  if (!state.checkins[key]) state.checkins[key] = {};
  const here = Boolean(state.checkins[key][state.me.name]);
  if (here) delete state.checkins[key][state.me.name];
  else state.checkins[key][state.me.name] = true;
  save();
  showFlash(here ? "Checked out of IRL" : "You're here in real life.");
  render();
}

function copyPlotCode() {
  const plot = findPlot(state.plotId);
  if (!plot?.code) return;
  const text = `${plot.code} · ${shareUrl(plot)}`;
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showFlash("Code and door link copied");
      render();
    }).catch(() => {
      showFlash(plot.code);
      render();
    });
    return;
  }
  showFlash(plot.code);
  render();
}

function saveIrlMeetup(plotId, data) {
  const plot = findPlot(plotId);
  if (!isPlotOwner(plot)) return;
  const place = data.get("place")?.toString().trim() || "";
  const when = data.get("when")?.toString().trim() || "";
  const on = data.get("on") === "on" || data.get("on") === "true";
  if (applyModeration(`${place} ${when}`, plotId) !== "ok") {
    state.modal = null;
    render();
    return;
  }
  plot.irl = { on, place, when };
  state.modal = null;
  save();
  showFlash(on ? "IRL meetup is on this plot" : "Plot is digital-only again");
  render();
}

function importPackedPlot(data) {
  const verdict = moderateText(`${data.name} ${data.blurb} ${data.irl?.place || ""}`);
  if (verdict.action === "ban") {
    showFlash("That plot sign was blocked to keep the town safe.");
    return null;
  }
  if (verdict.action === "block") {
    showFlash("That plot name isn't allowed. Swears stay out of town.");
    return null;
  }
  const plot = {
    id: nextPlotId(),
    name: String(data.name).slice(0, 28),
    blurb: String(data.blurb || "A phygital hangout.").slice(0, 120),
    category: CATEGORIES.some((cat) => cat.id === data.category) ? data.category : "cozy",
    emoji: data.emoji || "🌈",
    color: data.color || "#7b61ff",
    ground: data.ground || "#d9d2ff",
    custom: true,
    guest: data.owner !== state.me.name,
    owner: data.owner || "A friend",
    admins: [],
    code: normalizeCode(data.code) || makePlotCode(usedCodes(allPlots())),
    irl: plotIrl(data),
  };
  state.customPlots.unshift(plot);
  expandIfFull();
  save();
  return plot;
}

function joinPhygital(code, pack) {
  const existing = findPlotByCode(code);
  if (existing) {
    enterPlot(existing.id);
    return true;
  }
  const data = pack ? unpackPlot(pack) : null;
  if (data) {
    const again = findPlotByCode(data.code);
    if (again) {
      enterPlot(again.id);
      return true;
    }
    const imported = importPackedPlot(data);
    if (imported) {
      enterPlot(imported.id);
      return true;
    }
    return false;
  }
  return false;
}

function consumePhygitalLink() {
  const fromUrl = readLinkParams();
  let pending = fromUrl.join || fromUrl.pack ? fromUrl : takePending();
  if (!pending?.join && !pending?.pack) return;
  if (!state.me) {
    stashPending(pending);
    return;
  }
  clearLinkParams();
  if (joinPhygital(pending.join, pending.pack)) {
    showFlash("Phygital door opened.");
  } else if (pending.join || pending.pack) {
    showFlash("That door code didn't open a plot.");
    render();
  }
}

function enterPlot(id) {
  const plotId = Number(id);
  const plot = findPlot(plotId);
  if (!plot) return;
  if (state.portaling) {
    clearPortal();
  }
  const skipMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (skipMotion) {
    landOnPlot(plotId);
    return;
  }
  state.portaling = true;
  try {
    playPortal(plot, () => {
      landOnPlot(plotId);
    });
  } catch {
    clearPortal();
    landOnPlot(plotId);
  }
}

function landOnPlot(id) {
  state.plotId = id;
  state.view = "plot";
  state.modal = null;
  state.me.x = 50;
  state.me.y = 62;
  save();
  render();
}

function clearPortal() {
  window.clearTimeout(playPortal.mid);
  window.clearTimeout(playPortal.end);
  const layer = document.getElementById("portal");
  if (layer) {
    layer.className = "portal";
    layer.hidden = true;
    layer.innerHTML = "";
  }
  state.portaling = false;
}

function playPortal(plot, onOpen) {
  const layer = document.getElementById("portal");
  if (!layer) {
    onOpen();
    state.portaling = false;
    return;
  }
  layer.hidden = false;
  layer.removeAttribute("hidden");
  layer.className = "portal play";
  layer.style.setProperty("--portal", plot.color || "#7b61ff");
  layer.style.setProperty("--portal-ground", plot.ground || "#ffe8a3");
  layer.innerHTML = `
    <div class="portal-stage">
      <div class="portal-well">
        <div class="portal-ring"></div>
        <div class="portal-ring two"></div>
      </div>
      <div class="portal-emoji">${plot.emoji || "🌈"}</div>
    </div>
  `;
  window.clearTimeout(playPortal.mid);
  window.clearTimeout(playPortal.end);
  playPortal.mid = window.setTimeout(() => {
    try {
      onOpen();
    } catch {
      clearPortal();
      return;
    }
    layer.classList.add("open");
  }, 400);
  playPortal.end = window.setTimeout(() => {
    clearPortal();
  }, 800);
}

function toggleJoin(id) {
  const group = state.groups.find((g) => g.id === id);
  if (!group) return;
  if (group.members.includes(state.me.name)) {
    group.members = group.members.filter((name) => name !== state.me.name);
  } else {
    group.members.push(state.me.name);
  }
  save();
  render();
}

let wanderTimer = 0;
function wanderVisitors() {
  clearInterval(wanderTimer);
  wanderTimer = setInterval(() => {
    const park = document.getElementById("park");
    if (!park || state.view !== "plot") {
      clearInterval(wanderTimer);
      return;
    }
    park.querySelectorAll(".little:not(.you)").forEach((node) => {
      if (Math.random() > 0.45) return;
      const x = 12 + Math.random() * 76;
      const y = 24 + Math.random() * 62;
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
    });
  }, 1800);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

render();
consumePhygitalLink();
