const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const CASH_URL   = "https://cash-api-five.vercel.app/api/cash";
const FORMAT_URL = "https://numbers-conversion.vercel.app/api/format";

const MAX_LIMIT = 10n ** 261n;

function toBigInt(v) {
    if (typeof v === "bigint") return v;
    if (v === undefined || v === null) return 0n;
    try { return BigInt(String(v).split(".")[0].replace(/[^0-9\-]/g, "") || "0"); }
    catch { return 0n; }
}

async function formatNumber(num) {
    const big = toBigInt(num);
    
    if (big === 0n) return "0";
    if (big >= MAX_LIMIT || big <= -MAX_LIMIT) return "∞";
    
    try {
        const r = await axios.get(`${FORMAT_URL}?n=${big.toString()}`, { timeout: 5000 });
        if (r.data?.success) {
            if (r.data.isInfinity) return "∞";
            return r.data.formatted;
        }
    } catch {}
    
    const suffixes = [
        "", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", 
        "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", 
        "OcDc", "NoDc", "kN", "MN", "BN", "TN", "QaN", "QiN", "SxN", 
        "SpN", "OcN", "NoN", "DcN", "UI", "DI", "TI", "QI", "QiI", 
        "SxI", "SpI", "OcI", "NoI", "DcI", "UV", "DV", "TV", "QV", 
        "QiV", "SxV", "SpV", "OcV", "NoV", "DcV", "UT", "DT", "TT", 
        "QT", "QiT", "SxT", "SpT", "OcT", "NoT", "DcT", "UTr", "DTr", 
        "TTr", "QTr", "QiTr", "SxTr", "SpTr", "OcTr", "NoTr", "DcTr", 
        "UQ", "DQ", "TQ", "QQ", "QiQ", "SxQ", "SpQ", "OcQ", "NoQ", 
        "DcQ", "Uc", "Du", "Tu", "Qu", "Qiu"
    ];
    
    let scaled = big;
    let suffixIndex = 0;
    const thousand = 1000n;
    
    while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
        scaled = scaled / thousand;
        suffixIndex++;
    }
    
    if (suffixIndex === suffixes.length - 1 && scaled >= thousand) return "∞";
    
    const divisor = thousand ** BigInt(suffixIndex);
    const remainder = (big % divisor) * 100n / divisor;
    
    if (suffixIndex > 0 && remainder > 0n) {
        const decStr = remainder.toString().padStart(2, '0').slice(0, 2).replace(/0+$/, '');
        return decStr ? `${scaled}.${decStr}${suffixes[suffixIndex]}` : `${scaled}${suffixes[suffixIndex]}`;
    }
    
    if (suffixIndex === 0) {
        return big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    return `${scaled}${suffixes[suffixIndex]}`;
}

const SFX = {
    k: 1_000n,
    m: 1_000_000n,
    b: 1_000_000_000n,
    t: 1_000_000_000_000n,
    qa: 10n**15n,
    qi: 10n**18n,
    sx: 10n**21n,
    sp: 10n**24n,
    oc: 10n**27n,
    no: 10n**30n,
    dc: 10n**33n,
    udc: 10n**36n,
    ddc: 10n**39n,
    tdc: 10n**42n,
    qadc: 10n**45n,
    qidc: 10n**48n,
    sxdc: 10n**51n,
    spdc: 10n**54n,
    ocdc: 10n**57n,
    nodc: 10n**60n,
    kn: 10n**63n,
    mn: 10n**66n,
    bn: 10n**69n,
    tn: 10n**72n,
    qan: 10n**75n,
    qin: 10n**78n,
    sxn: 10n**81n,
    spn: 10n**84n,
    ocn: 10n**87n,
    non: 10n**90n,
    dcn: 10n**93n,
    ui: 10n**96n,
    di: 10n**99n,
    ti: 10n**102n,
    qi_i: 10n**105n,
    qii: 10n**108n,
    sxi: 10n**111n,
    spi: 10n**114n,
    oci: 10n**117n,
    noi: 10n**120n,
    dci: 10n**123n,
    uv: 10n**126n,
    dv: 10n**129n,
    tv: 10n**132n,
    qv: 10n**135n,
    qiv: 10n**138n,
    sxv: 10n**141n,
    spv: 10n**144n,
    ocv: 10n**147n,
    nov: 10n**150n,
    dcv: 10n**153n,
    ut: 10n**156n,
    dt: 10n**159n,
    tt: 10n**162n,
    qt: 10n**165n,
    qit: 10n**168n,
    sxt: 10n**171n,
    spt: 10n**174n,
    oct: 10n**177n,
    not: 10n**180n,
    dct: 10n**183n,
    utr: 10n**186n,
    dtr: 10n**189n,
    ttr: 10n**192n,
    qtr: 10n**195n,
    qitr: 10n**198n,
    sxtr: 10n**201n,
    sptr: 10n**204n,
    octr: 10n**207n,
    notr: 10n**210n,
    dctr: 10n**213n,
    uq: 10n**216n,
    dq: 10n**219n,
    tq: 10n**222n,
    qq: 10n**225n,
    qiq: 10n**228n,
    sxq: 10n**231n,
    spq: 10n**234n,
    ocq: 10n**237n,
    noq: 10n**240n,
    dcq: 10n**243n,
    uc: 10n**246n,
    du: 10n**249n,
    tu: 10n**252n,
    qu: 10n**255n,
    qiu: 10n**258n,
};

async function parseAmount(input) {
    if (!input) return 0n;
    const str = String(input).toLowerCase().trim();
    
    try {
        const r = await axios.get(`${FORMAT_URL}?n=${encodeURIComponent(str)}`, { timeout: 5000 });
        if (r.data?.success && r.data?.raw) return toBigInt(r.data.raw);
    } catch {}
    
    const m = str.match(/^(-?\d+(?:\.\d+)?)([a-zA-Z]+)?$/i);
    if (!m) return 0n;
    
    const val = parseFloat(m[1]);
    const sfx = (m[2] || "").toLowerCase();
    const base = BigInt(Math.floor(Math.abs(val)));
    const neg = val < 0;
    
    if (isNaN(val)) return 0n;
    
    if (!sfx) return neg ? -base : base;
    
    const mult = SFX[sfx];
    if (mult) {
        const result = base * mult;
        if (result >= MAX_LIMIT) return neg ? -MAX_LIMIT : MAX_LIMIT;
        return neg ? -result : result;
    }
    
    return neg ? -base : base;
}

async function getUserCash(uid) {
    try {
        const r = await axios.get(`${CASH_URL}/${uid}`, { timeout: 10000 });
        if (r.data?.success && r.data?.data) {
            const cash = toBigInt(r.data.data.cash);
            return cash >= MAX_LIMIT ? MAX_LIMIT : cash;
        }
    } catch {}
    return 0n;
}

async function updateUserCash(uid, amount) {
    const a = toBigInt(amount);
    try {
        if (a > 0n) {
            await axios.post(`${CASH_URL}/${uid}/add`, { amount: a.toString() });
            return true;
        } else if (a < 0n) {
            await axios.post(`${CASH_URL}/${uid}/subtract`, { amount: (-a).toString() });
            return true;
        }
        return true;
    } catch (e) {
        console.error("Cash update:", e.message);
        return false;
    }
}

function getUserName(uid, api) {
    return new Promise(resolve => {
        api.getUserInfo(uid, (err, data) => {
            const n = data?.[uid]?.name;
            resolve((n && n !== "Facebook User") ? n : `User_${String(uid).slice(-5)}`);
        });
    });
}

async function getUserAvatar(uid, api) {
    try {
        const d = await api.getUserInfo(uid);
        return d[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    } catch { return `https://graph.facebook.com/${uid}/picture?width=200&height=200`; }
}

const GAME_FILE = "./memory_games.json";
let activeGames = new Map();
if (fs.existsSync(GAME_FILE)) {
    try {
        const raw = JSON.parse(fs.readFileSync(GAME_FILE, "utf8"));
        for (const [k, v] of Object.entries(raw)) {
            v.bet = BigInt(v.bet);
            activeGames.set(k, v);
        }
    } catch {}
}

function saveGames() {
    try {
        const obj = {};
        for (const [k, v] of activeGames) {
            obj[k] = { ...v, bet: v.bet.toString() };
        }
        fs.writeFileSync(GAME_FILE, JSON.stringify(obj, null, 2));
    } catch {}
}

const DIFFICULTIES = {
    facile:  { grid: 4, pairs: 8,  timeLimit: 120, multiplier: 2,  bonusSpeed: 90,  bonusMult: 2.5 },
    normal:  { grid: 4, pairs: 8,  timeLimit: 90,  multiplier: 3,  bonusSpeed: 60,  bonusMult: 4   },
    difficile:{ grid: 5, pairs: 10, timeLimit: 75,  multiplier: 5,  bonusSpeed: 45,  bonusMult: 7   },
    extreme: { grid: 6, pairs: 12, timeLimit: 60,  multiplier: 8,  bonusSpeed: 30,  bonusMult: 12  },
};

const CARD_THEMES = {
    animaux:  ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮"],
    fruits:   ["🍎","🍊","🍋","🍇","🍓","🫐","🍑","🍒","🥭","🍍","🥝","🍈"],
    espace:   ["🌍","🌙","⭐","☀️","🪐","🌠","🌌","🚀","🛸","🌟","💫","🌑"],
    casino:   ["🎰","🎲","🃏","🎴","🀄","🎯","🎳","🎮","🕹️","🎱","🎭","🎪"],
    nature:   ["🌸","🌺","🌻","🌹","🌷","🍀","🌿","🍃","🌱","🌾","🍂","🍁"],
};

function createBoard(difficulty, theme) {
    const diff = DIFFICULTIES[difficulty];
    const symbols = CARD_THEMES[theme] || CARD_THEMES.animaux;
    const selectedSymbols = symbols.slice(0, diff.pairs);
    const allCards = [...selectedSymbols, ...selectedSymbols];
    for (let i = allCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
    }
    return allCards;
}

function parseCoord(input, cols, rows) {
    const str = String(input).toUpperCase().trim();
    const m = str.match(/^([A-Z])(\d+)$/);
    if (!m) return null;
    const col = m[1].charCodeAt(0) - 65;
    const row = parseInt(m[2]) - 1;
    if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
    return { row, col, index: row * cols + col };
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

async function generateBoardImage({ game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase }) {
    const diff   = DIFFICULTIES[game.difficulty];
    const cols   = game.cols;
    const rows   = Math.ceil(game.board.length / cols);
    const CELL   = 88;
    const GUTTER = 10;
    const PAD_L  = 58;
    const PAD_T  = 160;
    const W      = PAD_L + cols * (CELL + GUTTER) + 40;
    const H      = PAD_T + rows * (CELL + GUTTER) + 140;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#0a0818");
    bg.addColorStop(0.5, "#0f0d22");
    bg.addColorStop(1, "#060410");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
            ctx.fillRect(x, y, 1, 1);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, "#7c3aed");
    borderG.addColorStop(0.5, "#4f46e5");
    borderG.addColorStop(1, "#7c3aed");
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 2;
    roundRect(ctx, 8, 8, W - 16, H - 16, 16);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, "rgba(124,58,237,0.25)");
    hdrG.addColorStop(0.5, "rgba(79,70,229,0.12)");
    hdrG.addColorStop(1, "rgba(124,58,237,0.25)");
    ctx.fillStyle = hdrG;
    ctx.fillRect(8, 8, W - 16, 70);

    ctx.font = "bold 22px 'Courier New'";
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("🧠 MEMORY GAME", 28, 48);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(167,139,250,0.6)";
    ctx.fillText(`${game.difficulty.toUpperCase()} • ${game.theme.toUpperCase()}`, 30, 65);

    const ax = W - 50, ay = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 28, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 28, ay - 28, 56, 56);
    } catch {
        ctx.fillStyle = "#1a1040";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 29, 0, Math.PI * 2);
    ctx.strokeStyle = "#7c3aed";
    ctx.lineWidth = 2;
    ctx.stroke();

    const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
    const remaining = Math.max(0, diff.timeLimit - elapsed);
    const timeColor = remaining <= 15 ? "#ff4444" : remaining <= 30 ? "#ffaa00" : "#a78bfa";

    const statsY = 92;
    const statItems = [
        { label: "PAIRES",   value: `${game.matched}/${diff.pairs}`    },
        { label: "ESSAIS",   value: `${game.attempts}`                 },
        { label: "TEMPS",    value: `${remaining}s`,  color: timeColor },
        { label: "MISE",     value: `${game.betFormatted}$`            },
    ];
    const sW = (W - 60) / statItems.length;
    for (let i = 0; i < statItems.length; i++) {
        const sx = 30 + i * sW;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        roundRect(ctx, sx + 3, statsY - 14, sW - 6, 42, 6);
        ctx.fill();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(statItems[i].label, sx + 10, statsY);
        ctx.font = `bold ${statItems[i].value.length > 9 ? "11" : "14"}px 'Courier New'`;
        ctx.fillStyle = statItems[i].color || "#e0d4ff";
        ctx.fillText(statItems[i].value, sx + 10, statsY + 20);
    }

    const timeBarY = statsY + 34;
    const timeBarW = W - 60;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 30, timeBarY, timeBarW, 8, 4);
    ctx.fill();
    const pct = remaining / diff.timeLimit;
    const barColor = pct > 0.5 ? "#7c3aed" : pct > 0.25 ? "#f59e0b" : "#ef4444";
    const barG = ctx.createLinearGradient(30, 0, 30 + timeBarW * pct, 0);
    barG.addColorStop(0, barColor);
    barG.addColorStop(1, barColor + "99");
    ctx.fillStyle = barG;
    roundRect(ctx, 30, timeBarY, Math.max(timeBarW * pct, 8), 8, 4);
    ctx.fill();

    for (let c = 0; c < cols; c++) {
        const label = String.fromCharCode(65 + c);
        const cx = PAD_L + c * (CELL + GUTTER) + CELL / 2;
        ctx.font = "bold 11px 'Courier New'";
        ctx.fillStyle = "rgba(167,139,250,0.7)";
        ctx.textAlign = "center";
        ctx.fillText(label, cx, PAD_T - 12);
        ctx.textAlign = "left";
    }
    for (let r = 0; r < rows; r++) {
        const ry = PAD_T + r * (CELL + GUTTER) + CELL / 2 + 5;
        ctx.font = "bold 11px 'Courier New'";
        ctx.fillStyle = "rgba(167,139,250,0.7)";
        ctx.textAlign = "right";
        ctx.fillText(String(r + 1), PAD_L - 12, ry);
        ctx.textAlign = "left";
    }

    for (let idx = 0; idx < game.board.length; idx++) {
        const r   = Math.floor(idx / cols);
        const c   = idx % cols;
        const cx  = PAD_L + c * (CELL + GUTTER);
        const cy  = PAD_T + r * (CELL + GUTTER);
        const isMatched  = game.revealed[idx];
        const isFlipped  = lastFlipped?.includes(idx);
        const isMatchNow = lastMatch?.includes(idx);
        const isMissNow  = lastMiss?.includes(idx);

        let bgColor, strokeColor, strokeW;
        if (isMatched) {
            bgColor    = "rgba(16,185,129,0.22)";
            strokeColor = "#10b981";
            strokeW    = 2;
        } else if (isMatchNow) {
            bgColor    = "rgba(16,185,129,0.35)";
            strokeColor = "#34d399";
            strokeW    = 2.5;
        } else if (isMissNow) {
            bgColor    = "rgba(239,68,68,0.25)";
            strokeColor = "#ef4444";
            strokeW    = 2;
        } else if (isFlipped) {
            bgColor    = "rgba(124,58,237,0.35)";
            strokeColor = "#a78bfa";
            strokeW    = 2;
        } else {
            bgColor    = "rgba(255,255,255,0.05)";
            strokeColor = "rgba(167,139,250,0.2)";
            strokeW    = 1;
        }

        const cardG = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
        if (isMatched) {
            cardG.addColorStop(0, "#0d2e22");
            cardG.addColorStop(1, "#061a14");
        } else if (isFlipped || isMatchNow || isMissNow) {
            cardG.addColorStop(0, "#1a1040");
            cardG.addColorStop(1, "#0d0828");
        } else {
            cardG.addColorStop(0, "#14103a");
            cardG.addColorStop(1, "#0a0820");
        }
        ctx.fillStyle = cardG;
        roundRect(ctx, cx, cy, CELL, CELL, 10);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeW;
        ctx.stroke();

        if (isMatched || isFlipped || isMatchNow || isMissNow) {
            ctx.font = "38px 'Segoe UI Emoji'";
            ctx.textAlign = "center";
            ctx.fillText(game.board[idx], cx + CELL / 2, cy + CELL / 2 + 14);
            ctx.textAlign = "left";
            if (isMatched) {
                ctx.font = "bold 10px 'Courier New'";
                ctx.fillStyle = "rgba(16,185,129,0.7)";
                ctx.textAlign = "center";
                ctx.fillText("✓", cx + CELL - 10, cy + 16);
                ctx.textAlign = "left";
            }
        } else {
            ctx.font = "bold 20px 'Courier New'";
            ctx.fillStyle = "rgba(167,139,250,0.35)";
            ctx.textAlign = "center";
            ctx.fillText("?", cx + CELL / 2, cy + CELL / 2 + 8);
            ctx.textAlign = "left";
        }

        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(167,139,250,0.3)";
        ctx.textAlign = "center";
        ctx.fillText(`${String.fromCharCode(65 + c)}${r + 1}`, cx + CELL / 2, cy + CELL - 6);
        ctx.textAlign = "left";
    }

    let statusText = "", statusColor = "#a78bfa";
    if (phase === "start") {
        statusText = "Retournez 2 cartes — ex: memory A1 B2";
        statusColor = "#a78bfa";
    } else if (phase === "match") {
        statusText = "✦ PAIRE TROUVÉE ! Continuez...";
        statusColor = "#10b981";
    } else if (phase === "miss") {
        statusText = "✕ Pas de paire. Mémorisez et réessayez !";
        statusColor = "#ef4444";
    } else if (phase === "win") {
        statusText = "🏆 FÉLICITATIONS — Toutes les paires trouvées !";
        statusColor = "#fbbf24";
    } else if (phase === "timeout") {
        statusText = "⏰ TEMPS ÉCOULÉ — Partie terminée !";
        statusColor = "#ef4444";
    }

    const footerY = H - 58;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, 28, footerY, W - 56, 32, 6);
    ctx.fill();
    ctx.font = "bold 11px 'Courier New'";
    ctx.fillStyle = statusColor;
    ctx.textAlign = "center";
    ctx.fillText(statusText, W / 2, footerY + 21);
    ctx.textAlign = "left";

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = "rgba(167,139,250,0.3)";
    ctx.textAlign = "center";
    ctx.fillText(`${username.toUpperCase()} • HEDGEHOG MEMORY`, W / 2, H - 14);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateResultImage({ username, avatarUrl, win, bet, earned, newBalance, attempts, timeTaken, difficulty, matched, pairs, speedBonus }) {
    const W = 680, H = 360;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");

    const bg = ctx.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.8);
    bg.addColorStop(0, win ? "#0e1f18" : "#1a0a0a");
    bg.addColorStop(1, win ? "#050d09" : "#0a0404");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 30)
        for (let y = 0; y < H; y += 30)
            ctx.fillRect(x, y, 1, 1);

    const bG = ctx.createLinearGradient(0, 0, W, H);
    bG.addColorStop(0, win ? "#10b981" : "#ef4444");
    bG.addColorStop(0.5, win ? "#065f46" : "#7f1d1d");
    bG.addColorStop(1, win ? "#10b981" : "#ef4444");
    ctx.strokeStyle = bG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    const hG = ctx.createLinearGradient(0, 0, W, 0);
    hG.addColorStop(0, win ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)");
    hG.addColorStop(0.5, "rgba(0,0,0,0)");
    hG.addColorStop(1, win ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)");
    ctx.fillStyle = hG;
    ctx.fillRect(10, 10, W - 20, 65);

    ctx.font = "bold 24px 'Courier New'";
    ctx.fillStyle = win ? "#10b981" : "#ef4444";
    ctx.fillText(win ? "🏆 VICTOIRE — MEMORY" : "💀 DÉFAITE — MEMORY", 30, 52);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = win ? "rgba(16,185,129,0.55)" : "rgba(239,68,68,0.55)";
    ctx.fillText(`${difficulty.toUpperCase()} • ${matched}/${pairs} PAIRES`, 32, 68);

    const ax = W - 52, ay = 48;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ax, ay, 30, 0, Math.PI * 2);
    ctx.clip();
    try {
        const avatar = await loadImage(avatarUrl);
        ctx.drawImage(avatar, ax - 30, ay - 30, 60, 60);
    } catch {
        ctx.fillStyle = "#0a1a10";
        ctx.fill();
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(ax, ay, 31, 0, Math.PI * 2);
    ctx.strokeStyle = win ? "#10b981" : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "bold 13px 'Courier New'";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(username.toUpperCase().substring(0, 20), 30, 100);
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("JOUEUR", 30, 115);

    ctx.strokeStyle = win ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 128);
    ctx.lineTo(W - 30, 128);
    ctx.stroke();

    const statsY = 152;
    const cols = [
        { label: "MISE",         value: `${bet}$`,        color: "#a78bfa" },
        { label: win ? "GAIN" : "PERTE", value: win ? `+${earned}$` : `-${bet}$`, color: win ? "#10b981" : "#ef4444" },
        { label: "SOLDE",        value: `${newBalance}$`, color: "#fbbf24" },
        { label: "ESSAIS",       value: `${attempts}`,    color: "#60a5fa" },
        { label: "TEMPS",        value: `${timeTaken}s`,  color: "#f87171" },
    ];
    const cW = (W - 60) / cols.length;
    for (let i = 0; i < cols.length; i++) {
        const cx = 30 + i * cW;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, cx + 3, statsY - 16, cW - 6, 52, 7);
        ctx.fill();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(cols[i].label, cx + 8, statsY);
        ctx.font = `bold ${cols[i].value.length > 9 ? "11" : "13"}px 'Courier New'`;
        ctx.fillStyle = cols[i].color;
        ctx.fillText(cols[i].value, cx + 8, statsY + 22);
    }

    if (speedBonus && win) {
        ctx.fillStyle = "rgba(251,191,36,0.12)";
        roundRect(ctx, 30, statsY + 52, W - 60, 38, 8);
        ctx.fill();
        ctx.strokeStyle = "rgba(251,191,36,0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = "bold 13px 'Courier New'";
        ctx.fillStyle = "#fbbf24";
        ctx.textAlign = "center";
        ctx.fillText(`⚡ BONUS VITESSE — Partie terminée en moins de ${DIFFICULTIES[difficulty].bonusSpeed}s !`, W / 2, statsY + 77);
        ctx.textAlign = "left";
    }

    const accY = statsY + (speedBonus && win ? 108 : 68);
    const acc = attempts > 0 ? Math.round((matched / attempts) * 100) : 0;
    const accBarW = W - 60;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 30, accY, accBarW, 10, 5);
    ctx.fill();
    const accG = ctx.createLinearGradient(30, 0, 30 + accBarW * (acc / 100), 0);
    accG.addColorStop(0, "#7c3aed");
    accG.addColorStop(1, "#a78bfa");
    ctx.fillStyle = accG;
    roundRect(ctx, 30, accY, accBarW * (acc / 100), 10, 5);
    ctx.fill();
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(167,139,250,0.7)";
    ctx.fillText(`PRÉCISION : ${acc}%`, 30, accY - 5);

    const d = new Date();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = win ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)";
    ctx.textAlign = "center";
    ctx.fillText(`HEDGEHOG MEMORY • ${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()} • ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, W / 2, H - 16);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

function S(lines) {
    let out = "╭─────────────•┈┈\n";
    for (const l of lines) {
        if (l === "---") { out += "├─────────────•┈┈\n"; continue; }
        out += `│ ${l}\n`;
    }
    return out + "╰─────────────•┈┈";
}

async function sendBoard(message, game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase, bodyLines) {
    const body = S(bodyLines);
    try {
        const img = await generateBoardImage({ game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase });
        const p = `./memory_board_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body, attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch { await message.reply(body); }
}

async function endGame(message, game, win, username, avatarUrl) {
    activeGames.delete(game.uid);
    saveGames();

    const diff      = DIFFICULTIES[game.difficulty];
    const timeTaken = Math.floor((Date.now() - game.startTime) / 1000);
    const speedBonus = timeTaken <= diff.bonusSpeed;
    const mult       = speedBonus ? diff.bonusMult : diff.multiplier;

    let earned = 0n, netChange = 0n;
    if (win) {
        earned    = game.bet * BigInt(Math.floor(mult * 10)) / 10n;
        netChange = earned;
        await updateUserCash(game.uid, netChange);
    }

    const newBalance = await getUserCash(game.uid);
    const [fBet, fEarned, fNew] = await Promise.all([
        formatNumber(game.bet),
        formatNumber(win ? earned : game.bet),
        formatNumber(newBalance),
    ]);

    const lines = [
        win ? "🏆 VICTOIRE !" : "💀 DÉFAITE",
        "---",
        `🃏 Paires : ${game.matched}/${diff.pairs}`,
        `🎯 Essais : ${game.attempts}`,
        `⏱️ Temps  : ${timeTaken}s`,
        "---",
        win ? `✨ Gain : +${fEarned}$ (x${mult})` : `📉 Perte : -${fBet}$`,
        speedBonus && win ? `⚡ Bonus vitesse activé !` : null,
        `💳 Solde : ${fNew}$`,
    ].filter(Boolean);

    await message.reply(S(lines));

    try {
        const img = await generateResultImage({
            username, avatarUrl, win,
            bet: fBet, earned: fEarned, newBalance: fNew,
            attempts: game.attempts,
            timeTaken,
            difficulty: game.difficulty,
            matched: game.matched,
            pairs: diff.pairs,
            speedBonus: speedBonus && win,
        });
        const p = `./memory_result_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body: "🧠 Carte de résultat :", attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch {}
}

module.exports = {
    config: {
        name: "memory",
        version: "2.0",
        author: "Hedgehog",
        countDown: 2,
        role: 0,
        category: "fun",
        shortDescription: { en: "Jeu de mémoire — trouvez toutes les paires !" },
        longDescription: { en: "🧠 Retournez des cartes et trouvez toutes les paires avant la fin du temps imparti. Plus vite vous terminez, plus le multiplicateur est élevé !" },
    },

    onStart: async function ({ args, message, event, api }) {
        const uid = String(event.senderID);
        const p   = global.utils.getPrefix(event.threadID);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            return message.reply(S([
                "🧠 MEMORY GAME",
                "---",
                `${p}memory start <mise> [difficulté] [thème]`,
                "---",
                "📊 DIFFICULTÉS",
                "facile    → x2  (bonus x2.5)",
                "normal    → x3  (bonus x4)",
                "difficile → x5  (bonus x7)",
                "extreme   → x8  (bonus x12)",
                "---",
                "🎨 THÈMES",
                "animaux • fruits • espace",
                "casino  • nature",
                "---",
                "🎮 EN JEU : memory A1 B3",
                `${p}memory abandon`,
            ]));
        }

        if (sub === "abandon" || sub === "quit") {
            const game = activeGames.get(uid);
            if (!game) return message.reply(S(["❌ Aucune partie en cours."]));
            await updateUserCash(uid, -game.bet);
            activeGames.delete(uid);
            saveGames();
            return message.reply(S([
                "🏳️ Partie abandonnée.",
                `📉 Mise perdue : -${await formatNumber(game.bet)}$`,
            ]));
        }

        if (sub === "start" || sub === "jouer" || sub === "play") {
            if (activeGames.has(uid)) {
                return message.reply(S([
                    "⚠️ Partie déjà en cours !",
                    `📝 Jouez : ${p}memory A1 B2`,
                    `🏳️ Abandon : ${p}memory abandon`,
                ]));
            }
            const bet        = await parseAmount(args[1]);
            const difficulty = (args[2]?.toLowerCase() in DIFFICULTIES) ? args[2].toLowerCase() : "normal";
            const theme      = (args[3]?.toLowerCase() in CARD_THEMES)  ? args[3].toLowerCase() : "animaux";

            if (bet <= 0n) return message.reply(S(["❌ Montant invalide.", `📝 ${p}memory start 50k`]));
            const userMoney = await getUserCash(uid);
            if (bet > userMoney) {
                return message.reply(S([
                    "❌ Fonds insuffisants",
                    "---",
                    `💰 Solde : ${await formatNumber(userMoney)}$`,
                    `🎲 Mise   : ${await formatNumber(bet)}$`,
                ]));
            }

            const updateSuccess = await updateUserCash(uid, -bet);
            if (!updateSuccess) {
                return message.reply(S(["❌ Erreur lors du prélèvement"]));
            }

            const diff  = DIFFICULTIES[difficulty];
            const board = createBoard(difficulty, theme);
            const cols  = diff.grid;
            const game  = {
                uid, difficulty, theme,
                board, cols,
                revealed:  new Array(board.length).fill(false),
                attempts:  0,
                matched:   0,
                startTime: Date.now(),
                bet,
                betFormatted: await formatNumber(bet),
                firstCard: null,
                lastFlipped: null,
            };
            activeGames.set(uid, game);
            saveGames();

            const [username, avatarUrl] = await Promise.all([
                getUserName(uid, api),
                getUserAvatar(uid, api),
            ]);

            await sendBoard(message, game, username, avatarUrl, [], [], [], "start", [
                "🧠 MEMORY — PARTIE LANCÉE !",
                "---",
                `📊 Difficulté : ${difficulty}`,
                `🎨 Thème : ${theme}`,
                `🃏 Paires à trouver : ${diff.pairs}`,
                `⏱️ Temps limite : ${diff.timeLimit}s`,
                `💰 Mise : ${game.betFormatted}$`,
                "---",
                "📝 Retournez 2 cartes : memory A1 B2",
            ]);

            setTimeout(async () => {
                const g = activeGames.get(uid);
                if (!g) return;
                const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
                await endGame(message, g, g.matched >= diff.pairs, uname, uavatar);
            }, diff.timeLimit * 1000);

            return;
        }

        const game = activeGames.get(uid);
        if (!game) {
            return message.reply(S([
                "❌ Aucune partie en cours.",
                `📝 ${p}memory start <mise>`,
            ]));
        }

        const diff    = DIFFICULTIES[game.difficulty];
        const elapsed = Math.floor((Date.now() - game.startTime) / 1000);
        if (elapsed >= diff.timeLimit) {
            const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            return endGame(message, game, false, uname, uavatar);
        }

        const coord1 = parseCoord(args[0], game.cols, Math.ceil(game.board.length / game.cols));
        const coord2 = parseCoord(args[1], game.cols, Math.ceil(game.board.length / game.cols));

        if (!coord1 || !coord2) {
            return message.reply(S([
                "❌ Coordonnées invalides.",
                "📝 Ex : memory A1 B2",
                `📐 Colonnes A-${String.fromCharCode(64 + game.cols)}, Lignes 1-${Math.ceil(game.board.length / game.cols)}`,
            ]));
        }

        if (coord1.index === coord2.index) {
            return message.reply(S(["❌ Choisissez 2 cartes différentes !"]));
        }

        if (game.revealed[coord1.index] || game.revealed[coord2.index]) {
            return message.reply(S(["❌ Une de ces cartes est déjà trouvée !"]));
        }

        game.attempts++;
        const isMatch = game.board[coord1.index] === game.board[coord2.index];
        const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);

        if (isMatch) {
            game.revealed[coord1.index] = true;
            game.revealed[coord2.index] = true;
            game.matched++;
            saveGames();

            const win = game.matched >= diff.pairs;
            if (win) {
                await sendBoard(message, game, username, avatarUrl,
                    [coord1.index, coord2.index],
                    [coord1.index, coord2.index],
                    [], "win",
                    [
                        "✦ PAIRE TROUVÉE !",
                        `🃏 ${game.board[coord1.index]} — ${args[0].toUpperCase()} & ${args[1].toUpperCase()}`,
                        `✅ Paires : ${game.matched}/${diff.pairs}`,
                        "🏆 TOUTES LES PAIRES TROUVÉES !",
                    ]
                );
                return endGame(message, game, true, username, avatarUrl);
            }

            await sendBoard(message, game, username, avatarUrl,
                [coord1.index, coord2.index],
                [coord1.index, coord2.index],
                [], "match",
                [
                    `✦ PAIRE ! ${game.board[coord1.index]}`,
                    `📍 ${args[0].toUpperCase()} & ${args[1].toUpperCase()}`,
                    `🃏 Paires : ${game.matched}/${diff.pairs}`,
                    `🎯 Essais : ${game.attempts}`,
                    "---",
                    "📝 Continuez : memory A1 B2",
                ]
            );
        } else {
            saveGames();
            await sendBoard(message, game, username, avatarUrl,
                [coord1.index, coord2.index],
                [],
                [coord1.index, coord2.index],
                "miss",
                [
                    `✕ Pas de paire`,
                    `📍 ${args[0].toUpperCase()} (${game.board[coord1.index]}) & ${args[1].toUpperCase()} (${game.board[coord2.index]})`,
                    `🃏 Paires : ${game.matched}/${diff.pairs}`,
                    `🎯 Essais : ${game.attempts}`,
                    "---",
                    "📝 Réessayez : memory A1 B2",
                ]
            );
        }
    }
};