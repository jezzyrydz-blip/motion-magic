export const GAMES = [
  {
    id: "memory",
    name: "Memory Meadow",
    emoji: "🌸",
    blurb: "Flip cards and find the matching friends.",
    how: "Tap two cards. Matches stay up. Clear the meadow!",
  },
  {
    id: "catch",
    name: "Star Catch",
    emoji: "⭐",
    blurb: "Tap falling stars before they drift away.",
    how: "20 seconds. Catch as many stars as you can.",
  },
  {
    id: "simon",
    name: "Simon Sparkle",
    emoji: "🌈",
    blurb: "Watch the colors, then tap them back.",
    how: "The song gets longer each round. Don't miss!",
  },
  {
    id: "bubbles",
    name: "Bubble Pop",
    emoji: "🫧",
    blurb: "Pop the floaty bubbles. So satisfying.",
    how: "20 seconds. Pop every bubble you see.",
  },
  {
    id: "cups",
    name: "Find the Star",
    emoji: "🧁",
    blurb: "The star hides. Watch the cups. Tap the right one.",
    how: "Five rounds of hide-and-seek.",
  },
];

export function gameById(id) {
  return GAMES.find((game) => game.id === id) || null;
}

const MEMORY_FACES = ["🌸", "🐱", "⭐", "🍪", "🌈", "🧸", "🎵", "🍀"];
const SIMON_COLORS = [
  { id: "pink", label: "Pink" },
  { id: "blue", label: "Blue" },
  { id: "sun", label: "Sun" },
  { id: "leaf", label: "Leaf" },
];

let active = null;

export function stopActiveGame() {
  if (!active) return;
  active.dead = true;
  (active.timers || []).forEach((id) => window.clearTimeout(id));
  (active.intervals || []).forEach((id) => window.clearInterval(id));
  active = null;
}

export function mountGame(id, root, hooks) {
  stopActiveGame();
  if (!root) return;
  active = { dead: false, timers: [], intervals: [] };
  const game = gameById(id);
  if (!game) {
    root.innerHTML = `<p class="tag">That game wandered off.</p>`;
    return;
  }
  if (id === "memory") return playMemory(root, hooks);
  if (id === "catch") return playFallers(root, hooks, { emoji: ["⭐", "✦", "🌟"], seconds: 20, good: 8, great: 14 });
  if (id === "simon") return playSimon(root, hooks);
  if (id === "bubbles") return playFallers(root, hooks, { emoji: ["🫧", "🔵", "💜"], seconds: 20, good: 10, great: 16, kind: "bubbles" });
  if (id === "cups") return playCups(root, hooks);
}

function later(fn, ms) {
  if (!active) return;
  const id = window.setTimeout(() => {
    if (!active?.dead) fn();
  }, ms);
  active.timers.push(id);
}

function every(fn, ms) {
  if (!active) return;
  const id = window.setInterval(() => {
    if (!active?.dead) fn();
  }, ms);
  active.intervals.push(id);
}

function shuffle(list) {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function hud(root, text) {
  const el = root.querySelector("[data-game-hud]");
  if (el) el.textContent = text;
}

function playMemory(root, hooks) {
  const deck = shuffle([...MEMORY_FACES, ...MEMORY_FACES]).map((face, index) => ({
    id: index,
    face,
    up: false,
    matched: false,
  }));
  let open = [];
  let locked = false;
  let moves = 0;

  root.innerHTML = `
    <p class="tag game-hud" data-game-hud>Find the pairs</p>
    <div class="memory-grid">
      ${deck.map((card) => `
        <button class="memory-card" type="button" data-card="${card.id}" aria-label="Hidden card"></button>
      `).join("")}
    </div>
  `;

  const paint = () => {
    deck.forEach((card) => {
      const btn = root.querySelector(`[data-card="${card.id}"]`);
      if (!btn) return;
      btn.classList.toggle("up", card.up || card.matched);
      btn.classList.toggle("matched", card.matched);
      btn.textContent = card.up || card.matched ? card.face : "";
      btn.setAttribute("aria-label", card.up || card.matched ? card.face : "Hidden card");
    });
    const left = deck.filter((card) => !card.matched).length / 2;
    hud(root, left ? `${left} pairs left · ${moves} flips` : `You did it in ${moves} flips!`);
  };

  root.querySelectorAll("[data-card]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (locked || active?.dead) return;
      const card = deck[Number(btn.dataset.card)];
      if (!card || card.up || card.matched) return;
      card.up = true;
      open.push(card);
      moves += 1;
      paint();
      if (open.length < 2) return;
      if (open[0].face === open[1].face) {
        open[0].matched = true;
        open[1].matched = true;
        open = [];
        paint();
        if (deck.every((item) => item.matched)) {
          later(() => hooks.onFinish({ won: true, score: moves, message: `All pairs found in ${moves} flips.` }), 400);
        }
        return;
      }
      locked = true;
      later(() => {
        open.forEach((item) => { item.up = false; });
        open = [];
        locked = false;
        paint();
      }, 700);
    });
  });
  paint();
}

function playFallers(root, hooks, opts) {
  let score = 0;
  let left = opts.seconds;
  root.innerHTML = `
    <p class="tag game-hud" data-game-hud>0 · ${left}s</p>
    <div class="game-field ${opts.kind === "bubbles" ? "game-field-bubbles" : ""}" data-field></div>
  `;
  const field = root.querySelector("[data-field]");

  const tickHud = () => hud(root, `${score} popped · ${left}s`);

  const spawn = () => {
    if (active?.dead || left <= 0) return;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = opts.kind === "bubbles" ? "game-bubble" : "game-star";
    btn.textContent = opts.emoji[Math.floor(Math.random() * opts.emoji.length)];
    btn.style.left = `${8 + Math.random() * 76}%`;
    btn.style.animationDuration = `${1.8 + Math.random() * 1.1}s`;
    if (opts.kind === "bubbles") btn.style.fontSize = `${1.4 + Math.random() * 1.4}rem`;
    btn.setAttribute("aria-label", "Catch");
    btn.addEventListener("click", () => {
      if (active?.dead || left <= 0) return;
      score += 1;
      btn.remove();
      tickHud();
    });
    field.appendChild(btn);
    later(() => btn.remove(), 2800);
  };

  spawn();
  every(spawn, opts.kind === "bubbles" ? 420 : 520);
  every(() => {
    left -= 1;
    tickHud();
    if (left > 0) return;
    stopActiveGame();
    hooks.onFinish({
      won: score >= opts.good,
      score,
      message: score >= opts.great ? `Wow, ${score}!` : score >= opts.good ? `Nice, ${score}.` : `${score} this time. Try again!`,
    });
  }, 1000);
  tickHud();
}

function playSimon(root, hooks) {
  let sequence = [];
  let step = 0;
  let listening = false;
  let round = 0;

  root.innerHTML = `
    <p class="tag game-hud" data-game-hud>Watch the sparkle</p>
    <div class="simon-grid">
      ${SIMON_COLORS.map((color) => `
        <button class="simon-pad simon-${color.id}" type="button" data-simon="${color.id}" aria-label="${color.label}"></button>
      `).join("")}
    </div>
  `;

  const pads = [...root.querySelectorAll("[data-simon]")];
  const light = (id, on) => {
    const pad = root.querySelector(`[data-simon="${id}"]`);
    pad?.classList.toggle("lit", on);
  };

  const playBack = () => {
    listening = false;
    hud(root, `Round ${round} · watch`);
    sequence.forEach((id, index) => {
      later(() => {
        light(id, true);
        later(() => light(id, false), 380);
      }, 700 * index);
    });
    later(() => {
      listening = true;
      step = 0;
      hud(root, `Round ${round} · your turn`);
    }, 700 * sequence.length + 200);
  };

  const nextRound = () => {
    round += 1;
    sequence.push(SIMON_COLORS[Math.floor(Math.random() * SIMON_COLORS.length)].id);
    playBack();
  };

  pads.forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!listening || active?.dead) return;
      const id = btn.dataset.simon;
      light(id, true);
      later(() => light(id, false), 180);
      if (id !== sequence[step]) {
        listening = false;
        later(() => hooks.onFinish({
          won: round >= 4,
          score: Math.max(0, round - 1),
          message: `You reached round ${round}.`,
        }), 280);
        return;
      }
      step += 1;
      if (step < sequence.length) return;
      if (round >= 10) {
        later(() => hooks.onFinish({
          won: true,
          score: round,
          message: "Sparkle master! Ten rounds.",
        }), 280);
        return;
      }
      later(nextRound, 500);
    });
  });

  later(nextRound, 500);
}

function playCups(root, hooks) {
  const cups = [0, 1, 2];
  let hidden = 0;
  let round = 1;
  let found = 0;
  let locked = true;

  root.innerHTML = `
    <p class="tag game-hud" data-game-hud>Watch the star</p>
    <div class="cups-row">
      ${cups.map((slot) => `
        <button class="cup" type="button" data-cup="${slot}" style="order:${slot}" aria-label="Cup ${slot + 1}">
          <span class="cup-star" hidden>⭐</span>
        </button>
      `).join("")}
    </div>
  `;

  const starAt = (slot, show) => {
    root.querySelectorAll(".cup-star").forEach((el) => { el.hidden = true; });
    const mark = root.querySelector(`[data-cup="${slot}"] .cup-star`);
    if (mark) mark.hidden = !show;
  };

  const setLocked = (next) => {
    locked = next;
    root.querySelectorAll("[data-cup]").forEach((btn) => { btn.disabled = next; });
  };

  const deal = () => {
    hidden = Math.floor(Math.random() * 3);
    setLocked(true);
    hud(root, `Round ${round} of 5 · watch`);
    starAt(hidden, true);
    later(() => {
      starAt(hidden, false);
      let swaps = 0;
      const runSwap = () => {
        if (swaps >= 5) {
          setLocked(false);
          hud(root, `Round ${round} of 5 · pick a cup`);
          return;
        }
        const a = Math.floor(Math.random() * 3);
        let b = Math.floor(Math.random() * 3);
        if (b === a) b = (a + 1) % 3;
        const buttons = [...root.querySelectorAll("[data-cup]")];
        const orderA = buttons[a].style.order || String(a);
        const orderB = buttons[b].style.order || String(b);
        buttons[a].style.order = orderB;
        buttons[b].style.order = orderA;
        swaps += 1;
        later(runSwap, 280);
      };
      runSwap();
    }, 900);
  };

  root.querySelectorAll("[data-cup]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (locked || active?.dead) return;
      const pick = Number(btn.dataset.cup);
      setLocked(true);
      starAt(hidden, true);
      const hit = pick === hidden;
      if (hit) found += 1;
      hud(root, hit ? "You found it!" : "Not that one.");
      later(() => {
        if (round >= 5) {
          hooks.onFinish({
            won: found >= 3,
            score: found,
            message: `${found} out of 5 stars found.`,
          });
          return;
        }
        round += 1;
        deal();
      }, 800);
    });
  });

  deal();
}
