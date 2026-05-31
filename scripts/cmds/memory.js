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
        for (const [k, v] of activeGames) obj[k] = { ...v, bet: v.bet.toString() };
        fs.writeFileSync(GAME_FILE, JSON.stringify(obj, null, 2));
    } catch {}
}

const TIME_LIMIT = 600;

const DIFFICULTIES = {
    facile:   { cols: 4, pairs: 8,  multiplier: 2,   bonusSpeed: 300, bonusMult: 3   },
    normal:   { cols: 4, pairs: 8,  multiplier: 3,   bonusSpeed: 240, bonusMult: 5   },
    difficile:{ cols: 5, pairs: 10, multiplier: 5,   bonusSpeed: 180, bonusMult: 8   },
    extreme:  { cols: 6, pairs: 12, multiplier: 8,   bonusSpeed: 120, bonusMult: 15  },
};

const CARD_THEMES = {
    animaux:  ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮"],
    fruits:   ["🍎","🍊","🍋","🍇","🍓","🫐","🍑","🍒","🥭","🍍","🥝","🍈"],
    espace:   ["🌍","🌙","⭐","☀️","🪐","🌠","🌌","🚀","🛸","🌟","💫","🌑"],
    casino:   ["🎰","🎲","🃏","🎴","🀄","🎯","🎳","🎮","🕹️","🎱","🎭","🎪"],
    nature:   ["🌸","🌺","🌻","🌹","🌷","🍀","🌿","🍃","🌱","🌾","🍂","🍁"],
    sport:    ["⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🏹"],
    pays:     ["🇫🇷","🇺🇸","🇯🇵","🇧🇷","🇩🇪","🇮🇹","🇪🇸","🇬🇧","🇨🇳","🇷🇺","🇦🇺","🇰🇷"],
    food:     ["🍕","🍔","🌮","🍜","🍣","🍩","🎂","🍦","🧁","🥗","🍱","🥩"],
};

const DIFFICULTY_COLORS = {
    facile:    "#22c55e",
    normal:    "#3b82f6",
    difficile: "#f59e0b",
    extreme:   "#ef4444",
};

function createBoard(difficulty, theme) {
    const diff    = DIFFICULTIES[difficulty];
    const symbols = CARD_THEMES[theme] || CARD_THEMES.animaux;
    const selected = symbols.slice(0, diff.pairs);
    const all = [...selected, ...selected];
    for (let i = all.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [all[i], all[j]] = [all[j], all[i]];
    }
    return all;
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

function timeStr(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
}

async function generateBoardImage({ game, username, avatarUrl, lastFlipped, lastMatch, lastMiss, phase }) {
    const diff      = DIFFICULTIES[game.difficulty];
    const diffColor = DIFFICULTY_COLORS[game.difficulty] || "#818cf8";
    const cols      = game.cols;
    const rows      = Math.ceil(game.board.length / cols);
    const CELL      = 90;
    const GUTTER    = 10;
    const PAD_L     = 62;
    const PAD_T     = 185;
    const W         = PAD_L + cols * (CELL + GUTTER) + 44;
    const H         = PAD_T + rows * (CELL + GUTTER) + 160;
    const canvas    = createCanvas(W, H);
    const ctx       = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#08060f");
    bg.addColorStop(0.5, "#100e22");
    bg.addColorStop(1, "#060410");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = "rgba(255,255,255,0.018)";
    for (let x = 0; x < W; x += 32)
        for (let y = 0; y < H; y += 32)
            ctx.fillRect(x, y, 1.5, 1.5);

    const borderG = ctx.createLinearGradient(0, 0, W, H);
    borderG.addColorStop(0, diffColor);
    borderG.addColorStop(0.5, diffColor + "88");
    borderG.addColorStop(1, diffColor);
    ctx.strokeStyle = borderG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 8, 8, W - 16, H - 16, 18);
    ctx.stroke();

    const hdrG = ctx.createLinearGradient(0, 0, W, 0);
    hdrG.addColorStop(0, diffColor + "30");
    hdrG.addColorStop(0.5, diffColor + "10");
    hdrG.addColorStop(1, diffColor + "30");
    ctx.fillStyle = hdrG;
    ctx.fillRect(8, 8, W - 16, 72);

    ctx.font = "bold 22px 'Courier New'";
    ctx.fillStyle = diffColor;
    ctx.fillText("🧠 MEMORY GAME", 28, 48);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`${game.difficulty.toUpperCase()} • ${game.theme.toUpperCase()}`, 30, 66);

    const ax = W - 52, ay = 46;
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
    ctx.strokeStyle = diffColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    const elapsed    = Math.floor((Date.now() - game.startTime) / 1000);
    const remaining  = Math.max(0, TIME_LIMIT - elapsed);
    const timeColor  = remaining <= 60 ? "#ef4444" : remaining <= 120 ? "#f59e0b" : diffColor;
    const accuracy   = game.attempts > 0 ? Math.round((game.matched / game.attempts) * 100) : 0;
    const streak     = game.streak || 0;

    const statsY = 94;
    const statItems = [
        { label: "PAIRES",    value: `${game.matched}/${diff.pairs}` },
        { label: "ESSAIS",    value: `${game.attempts}`              },
        { label: "PRÉCISION", value: `${accuracy}%`                  },
        { label: "SÉRIE",     value: `${streak}🔥`                   },
        { label: "TEMPS",     value: timeStr(remaining), color: timeColor },
        { label: "MISE",      value: `${game.betFormatted}$`         },
    ];
    const sW = (W - 56) / statItems.length;
    for (let i = 0; i < statItems.length; i++) {
        const sx = 28 + i * sW;
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        roundRect(ctx, sx + 2, statsY - 14, sW - 4, 46, 6);
        ctx.fill();
        ctx.font = "7px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(statItems[i].label, sx + 7, statsY + 2);
        ctx.font = `bold ${statItems[i].value.length > 9 ? "10" : "13"}px 'Courier New'`;
        ctx.fillStyle = statItems[i].color || "#e0d4ff";
        ctx.fillText(statItems[i].value, sx + 7, statsY + 22);
    }

    const timeBarY = statsY + 38;
    const timeBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, timeBarY, timeBarW, 8, 4);
    ctx.fill();
    const pct = remaining / TIME_LIMIT;
    const barColor = remaining <= 60 ? "#ef4444" : remaining <= 120 ? "#f59e0b" : diffColor;
    const barG = ctx.createLinearGradient(28, 0, 28 + timeBarW * pct, 0);
    barG.addColorStop(0, barColor);
    barG.addColorStop(1, barColor + "99");
    ctx.fillStyle = barG;
    roundRect(ctx, 28, timeBarY, Math.max(timeBarW * pct, 8), 8, 4);
    ctx.fill();

    for (let c = 0; c < cols; c++) {
        const label = String.fromCharCode(65 + c);
        const cx = PAD_L + c * (CELL + GUTTER) + CELL / 2;
        ctx.font = "bold 11px 'Courier New'";
        ctx.fillStyle = diffColor + "cc";
        ctx.textAlign = "center";
        ctx.fillText(label, cx, PAD_T - 14);
        ctx.textAlign = "left";
    }
    for (let r = 0; r < rows; r++) {
        const ry = PAD_T + r * (CELL + GUTTER) + CELL / 2 + 5;
        ctx.font = "bold 11px 'Courier New'";
        ctx.fillStyle = diffColor + "cc";
        ctx.textAlign = "right";
        ctx.fillText(String(r + 1), PAD_L - 14, ry);
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

        let strokeColor, strokeW, cardBg;
        if (isMatched) {
            strokeColor = diffColor; strokeW = 2;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#0d2e1a"); cardBg.addColorStop(1, "#061410");
        } else if (isMatchNow) {
            strokeColor = "#34d399"; strokeW = 3;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#0d3020"); cardBg.addColorStop(1, "#061a10");
        } else if (isMissNow) {
            strokeColor = "#ef4444"; strokeW = 2.5;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#2e0d0d"); cardBg.addColorStop(1, "#1a0606");
        } else if (isFlipped) {
            strokeColor = diffColor; strokeW = 2;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#1a1040"); cardBg.addColorStop(1, "#0d0820");
        } else {
            strokeColor = diffColor + "33"; strokeW = 1;
            cardBg = ctx.createLinearGradient(cx, cy, cx, cy + CELL);
            cardBg.addColorStop(0, "#12103a"); cardBg.addColorStop(1, "#09071e");
        }

        ctx.fillStyle = cardBg;
        roundRect(ctx, cx, cy, CELL, CELL, 11);
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeW;
        ctx.stroke();

        if (isMatched) {
            const matchGlow = ctx.createRadialGradient(cx+CELL/2, cy+CELL/2, 5, cx+CELL/2, cy+CELL/2, 40);
            matchGlow.addColorStop(0, diffColor + "22");
            matchGlow.addColorStop(1, "transparent");
            ctx.fillStyle = matchGlow;
            roundRect(ctx, cx, cy, CELL, CELL, 11);
            ctx.fill();
        }

        if (isMatched || isFlipped || isMatchNow || isMissNow) {
            ctx.font = "40px 'Segoe UI Emoji'";
            ctx.textAlign = "center";
            ctx.fillText(game.board[idx], cx + CELL / 2, cy + CELL / 2 + 15);
            ctx.textAlign = "left";
            if (isMatched) {
                ctx.font = "bold 11px 'Courier New'";
                ctx.fillStyle = diffColor;
                ctx.textAlign = "center";
                ctx.fillText("✓", cx + CELL - 10, cy + 16);
                ctx.textAlign = "left";
            }
        } else {
            const hintNum = idx + 1;
            ctx.font = "bold 18px 'Courier New'";
            ctx.fillStyle = diffColor + "44";
            ctx.textAlign = "center";
            ctx.fillText("?", cx + CELL / 2, cy + CELL / 2 + 7);
            ctx.font = "8px 'Courier New'";
            ctx.fillStyle = diffColor + "55";
            ctx.fillText(String(hintNum), cx + CELL / 2, cy + CELL - 7);
            ctx.textAlign = "left";
        }

        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = diffColor + "55";
        ctx.textAlign = "center";
        ctx.fillText(`${String.fromCharCode(65 + c)}${r + 1}`, cx + CELL / 2, cy + CELL - 7);
        ctx.textAlign = "left";
    }

    const progressPairs = game.matched / diff.pairs;
    const progBarY = H - 94;
    const progBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, progBarY, progBarW, 10, 5);
    ctx.fill();
    const progG = ctx.createLinearGradient(28, 0, 28 + progBarW * progressPairs, 0);
    progG.addColorStop(0, diffColor);
    progG.addColorStop(1, diffColor + "88");
    ctx.fillStyle = progG;
    roundRect(ctx, 28, progBarY, Math.max(progBarW * progressPairs, 8), 10, 5);
    ctx.fill();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`PROGRESSION : ${game.matched}/${diff.pairs} paires`, 28, progBarY - 5);

    let statusText = "", statusColor = diffColor;
    if (phase === "start")   { statusText = `Retournez 2 cartes — ex: memory A1 B3`; }
    else if (phase === "match") { statusText = "✦ PAIRE TROUVÉE ! Continuez..."; statusColor = "#34d399"; }
    else if (phase === "miss")  { statusText = "✕ Pas de paire — mémorisez et réessayez !"; statusColor = "#ef4444"; }
    else if (phase === "win")   { statusText = "🏆 FÉLICITATIONS — Toutes les paires !"; statusColor = "#fbbf24"; }
    else if (phase === "timeout") { statusText = "⏰ TEMPS ÉCOULÉ — Partie terminée !"; statusColor = "#ef4444"; }
    else if (phase === "hint")  { statusText = "💡 Indice utilisé !"; statusColor = "#fbbf24"; }

    const footerY = H - 58;
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    roundRect(ctx, 28, footerY, W - 56, 34, 7);
    ctx.fill();
    ctx.strokeStyle = statusColor + "44";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.font = "bold 11px 'Courier New'";
    ctx.fillStyle = statusColor;
    ctx.textAlign = "center";
    ctx.fillText(statusText, W / 2, footerY + 23);
    ctx.textAlign = "left";

    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "55";
    ctx.textAlign = "center";
    ctx.fillText(`${username.toUpperCase()} • HEDGEHOG MEMORY`, W / 2, H - 14);
    ctx.textAlign = "left";

    return canvas.toBuffer("image/png");
}

async function generateResultImage({ username, avatarUrl, win, bet, earned, newBalance, attempts, timeTaken, difficulty, matched, pairs, speedBonus, streak, accuracy, combo }) {
    const W = 720, H = 420;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext("2d");
    const diffColor = DIFFICULTY_COLORS[difficulty] || "#818cf8";

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
    bG.addColorStop(0, win ? diffColor : "#ef4444");
    bG.addColorStop(0.5, win ? diffColor + "55" : "#7f1d1d");
    bG.addColorStop(1, win ? diffColor : "#ef4444");
    ctx.strokeStyle = bG;
    ctx.lineWidth = 2.5;
    roundRect(ctx, 10, 10, W - 20, H - 20, 18);
    ctx.stroke();

    const hG = ctx.createLinearGradient(0, 0, W, 0);
    hG.addColorStop(0, (win ? diffColor : "#ef4444") + "28");
    hG.addColorStop(0.5, "rgba(0,0,0,0)");
    hG.addColorStop(1, (win ? diffColor : "#ef4444") + "28");
    ctx.fillStyle = hG;
    ctx.fillRect(10, 10, W - 20, 70);

    ctx.font = "bold 24px 'Courier New'";
    ctx.fillStyle = win ? diffColor : "#ef4444";
    ctx.fillText(win ? "🏆 VICTOIRE — MEMORY" : "💀 DÉFAITE — MEMORY", 28, 52);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = (win ? diffColor : "#ef4444") + "88";
    ctx.fillText(`${difficulty.toUpperCase()} • ${matched}/${pairs} PAIRES • ${timeStr(timeTaken)}`, 30, 70);

    const ax = W - 52, ay = 46;
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
    ctx.strokeStyle = win ? diffColor : "#ef4444";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = "bold 14px 'Courier New'";
    ctx.fillStyle = "#e8e8e8";
    ctx.fillText(username.toUpperCase().substring(0, 20), 28, 106);
    ctx.font = "9px 'Courier New'";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText("JOUEUR", 28, 120);

    ctx.strokeStyle = (win ? diffColor : "#ef4444") + "22";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, 132);
    ctx.lineTo(W - 28, 132);
    ctx.stroke();

    const statsY = 158;
    const cols = [
        { label: "MISE",     value: `${bet}$`,        color: "#c4b5fd" },
        { label: win ? "GAIN" : "PERTE", value: win ? `+${earned}$` : `-${bet}$`, color: win ? diffColor : "#ef4444" },
        { label: "SOLDE",    value: `${newBalance}$`,  color: "#fbbf24" },
        { label: "ESSAIS",   value: `${attempts}`,     color: "#60a5fa" },
        { label: "TEMPS",    value: timeStr(timeTaken),color: "#f87171" },
        { label: "PRÉCISION",value: `${accuracy}%`,    color: accuracy >= 70 ? "#34d399" : "#f59e0b" },
    ];
    const cW = (W - 56) / 3;
    for (let i = 0; i < cols.length; i++) {
        const row = Math.floor(i / 3), col2 = i % 3;
        const cx = 28 + col2 * cW;
        const cy = statsY + row * 64;
        ctx.fillStyle = "rgba(255,255,255,0.04)";
        roundRect(ctx, cx + 3, cy - 16, cW - 6, 52, 7);
        ctx.fill();
        ctx.font = "8px 'Courier New'";
        ctx.fillStyle = "rgba(255,255,255,0.38)";
        ctx.fillText(cols[i].label, cx + 10, cy);
        ctx.font = `bold ${cols[i].value.length > 9 ? "11" : "13"}px 'Courier New'`;
        ctx.fillStyle = cols[i].color;
        ctx.fillText(cols[i].value, cx + 10, cy + 22);
    }

    const badgesY = statsY + 148;
    const badges = [];
    if (speedBonus && win) badges.push({ icon: "⚡", label: "BONUS VITESSE", color: "#fbbf24" });
    if (streak >= 3)       badges.push({ icon: "🔥", label: `SÉRIE x${streak}`,  color: "#f97316" });
    if (accuracy === 100)  badges.push({ icon: "💯", label: "PARFAIT",           color: "#34d399" });
    if (combo >= 3)        badges.push({ icon: "✨", label: `COMBO x${combo}`,   color: "#a78bfa" });
    if (matched === pairs && attempts <= pairs) badges.push({ icon: "🎯", label: "MAÎTRE", color: "#fbbf24" });

    if (badges.length > 0) {
        const badgeW = (W - 56) / badges.length;
        for (let i = 0; i < badges.length; i++) {
            const bx = 28 + i * badgeW;
            ctx.fillStyle = badges[i].color + "18";
            roundRect(ctx, bx + 3, badgesY - 14, badgeW - 6, 38, 7);
            ctx.fill();
            ctx.strokeStyle = badges[i].color + "55";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = "bold 12px 'Courier New'";
            ctx.fillStyle = badges[i].color;
            ctx.textAlign = "center";
            ctx.fillText(`${badges[i].icon} ${badges[i].label}`, bx + badgeW / 2, badgesY + 10);
            ctx.textAlign = "left";
        }
    }

    const accY = H - 52;
    const accBarW = W - 56;
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    roundRect(ctx, 28, accY, accBarW, 10, 5);
    ctx.fill();
    const accG = ctx.createLinearGradient(28, 0, 28 + accBarW * (accuracy / 100), 0);
    accG.addColorStop(0, diffColor);
    accG.addColorStop(1, diffColor + "88");
    ctx.fillStyle = accG;
    roundRect(ctx, 28, accY, accBarW * (accuracy / 100), 10, 5);
    ctx.fill();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = diffColor + "99";
    ctx.fillText(`PRÉCISION : ${accuracy}%`, 28, accY - 5);

    const d = new Date();
    ctx.font = "8px 'Courier New'";
    ctx.fillStyle = (win ? diffColor : "#ef4444") + "44";
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
        const p   = `./memory_board_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body, attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch { await message.reply(body); }
}

async function endGame(message, game, win, username, avatarUrl) {
    const timeoutHandle = gameTimeouts.get(game.uid);
    if (timeoutHandle) { clearTimeout(timeoutHandle); gameTimeouts.delete(game.uid); }

    activeGames.delete(game.uid);
    saveGames();

    const diff       = DIFFICULTIES[game.difficulty];
    const timeTaken  = Math.floor((Date.now() - game.startTime) / 1000);
    const speedBonus = win && timeTaken <= diff.bonusSpeed;
    const mult       = speedBonus ? diff.bonusMult : diff.multiplier;
    const accuracy   = game.attempts > 0 ? Math.round((game.matched / game.attempts) * 100) : 0;
    const streak     = game.streak || 0;
    const combo      = game.maxCombo || 0;

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
        `🃏 Paires     : ${game.matched}/${diff.pairs}`,
        `🎯 Essais     : ${game.attempts}`,
        `🎯 Précision  : ${accuracy}%`,
        `⏱️ Temps      : ${timeStr(timeTaken)}`,
        streak >= 3 ? `🔥 Meilleure série : ${streak}` : null,
        "---",
        win ? `✨ Gain   : +${fEarned}$ (x${mult})` : `📉 Perte  : -${fBet}$`,
        speedBonus ? `⚡ Bonus vitesse activé !` : null,
        `💳 Solde  : ${fNew}$`,
    ].filter(Boolean);

    await message.reply(S(lines));

    try {
        const img = await generateResultImage({
            username, avatarUrl, win,
            bet: fBet, earned: fEarned, newBalance: fNew,
            attempts: game.attempts, timeTaken,
            difficulty: game.difficulty,
            matched: game.matched, pairs: diff.pairs,
            speedBonus: speedBonus && win,
            streak, accuracy, combo,
        });
        const p = `./memory_result_${game.uid}_${Date.now()}.png`;
        fs.writeFileSync(p, img);
        await message.reply({ body: "🧠 Carte de résultat :", attachment: fs.createReadStream(p) });
        fs.unlinkSync(p);
    } catch {}
}

const gameTimeouts = new Map();

async function processMove(coord1, coord2, game, uid, message, api, diff, rows) {
    game.attempts++;
    const isMatch = game.board[coord1.index] === game.board[coord2.index];
    const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);

    const arg1Str = `${String.fromCharCode(65 + coord1.col)}${coord1.row + 1}`;
    const arg2Str = `${String.fromCharCode(65 + coord2.col)}${coord2.row + 1}`;

    if (isMatch) {
        game.revealed[coord1.index] = true;
        game.revealed[coord2.index] = true;
        game.matched++;
        game.streak = (game.streak || 0) + 1;
        game.currentCombo = (game.currentCombo || 0) + 1;
        if (game.currentCombo > (game.maxCombo || 0)) game.maxCombo = game.currentCombo;
        saveGames();

        const win = game.matched >= diff.pairs;
        if (win) {
            await sendBoard(message, game, username, avatarUrl,
                [coord1.index, coord2.index], [coord1.index, coord2.index], [], "win",
                [
                    `✦ PAIRE ! ${game.board[coord1.index]}`,
                    `📍 ${arg1Str} & ${arg2Str}`,
                    `✅ ${game.matched}/${diff.pairs} paires`,
                    "🏆 TOUTES LES PAIRES TROUVÉES !",
                ]
            );
            return endGame(message, game, true, username, avatarUrl);
        }

        const comboBonus = game.currentCombo >= 3 ? ` 🔥 COMBO x${game.currentCombo} !` : "";
        await sendBoard(message, game, username, avatarUrl,
            [coord1.index, coord2.index], [coord1.index, coord2.index], [], "match",
            [
                `✦ PAIRE ! ${game.board[coord1.index]}${comboBonus}`,
                `📍 ${arg1Str} & ${arg2Str}`,
                `🃏 ${game.matched}/${diff.pairs} paires`,
                `🎯 Essais : ${game.attempts}`,
                "---",
                "📝 Continuez : memory A1 B2",
            ]
        );
    } else {
        game.streak = 0;
        game.currentCombo = 0;
        saveGames();
        await sendBoard(message, game, username, avatarUrl,
            [coord1.index, coord2.index], [], [coord1.index, coord2.index], "miss",
            [
                `✕ Pas de paire`,
                `📍 ${arg1Str} (${game.board[coord1.index]}) & ${arg2Str} (${game.board[coord2.index]})`,
                `🃏 ${game.matched}/${diff.pairs} paires`,
                `🎯 Essais : ${game.attempts}`,
                "---",
                "📝 Réessayez : memory A1 B2",
            ]
        );
    }
}

module.exports = {
    config: {
        name: "memory",
        version: "3.0",
        author: "Hedgehog",
        countDown: 2,
        role: 0,
        category: "fun",
        shortDescription: { en: "Jeu de mémoire — trouvez toutes les paires !" },
        longDescription: { en: "🧠 Retournez des cartes et trouvez toutes les paires en 10 minutes. Bonus vitesse, séries, précision et multiplicateurs !" },
    },

    onStart: async function ({ args, message, event, api }) {
        const uid = String(event.senderID);
        const p   = global.utils.getPrefix(event.threadID);
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === "help") {
            return message.reply(S([
                "🧠 MEMORY GAME",
                "---",
                `${p}memory start <mise> [diff] [thème]`,
                "---",
                "📊 DIFFICULTÉS",
                `facile    → x${DIFFICULTIES.facile.multiplier}  (bonus vitesse <${timeStr(DIFFICULTIES.facile.bonusSpeed)} → x${DIFFICULTIES.facile.bonusMult})`,
                `normal    → x${DIFFICULTIES.normal.multiplier}  (bonus vitesse <${timeStr(DIFFICULTIES.normal.bonusSpeed)} → x${DIFFICULTIES.normal.bonusMult})`,
                `difficile → x${DIFFICULTIES.difficile.multiplier}  (bonus vitesse <${timeStr(DIFFICULTIES.difficile.bonusSpeed)} → x${DIFFICULTIES.difficile.bonusMult})`,
                `extreme   → x${DIFFICULTIES.extreme.multiplier}  (bonus vitesse <${timeStr(DIFFICULTIES.extreme.bonusSpeed)} → x${DIFFICULTIES.extreme.bonusMult})`,
                "---",
                "🎨 THÈMES",
                Object.keys(CARD_THEMES).join(" • "),
                "---",
                "🎮 EN JEU",
                "memory A1 B3 → retourner 2 cartes",
                `${p}memory hint → indice (-20% gain)`,
                `${p}memory abandon`,
                "⏱️ 10 minutes pour toutes les difficultés",
            ]));
        }

        if (sub === "abandon" || sub === "quit") {
            const game = activeGames.get(uid);
            if (!game) return message.reply(S(["❌ Aucune partie en cours."]));
            const th = gameTimeouts.get(uid);
            if (th) { clearTimeout(th); gameTimeouts.delete(uid); }
            await updateUserCash(uid, -game.bet);
            activeGames.delete(uid);
            saveGames();
            return message.reply(S(["🏳️ Partie abandonnée.", `📉 Mise perdue : -${await formatNumber(game.bet)}$`]));
        }

        if (sub === "hint") {
            const game = activeGames.get(uid);
            if (!game) return message.reply(S(["❌ Aucune partie en cours."]));
            const hidden = game.board
                .map((sym, idx) => ({ sym, idx }))
                .filter(({ idx }) => !game.revealed[idx]);
            if (hidden.length === 0) return message.reply(S(["❌ Toutes les cartes sont déjà retournées !"]));
            const pick = hidden[Math.floor(Math.random() * hidden.length)];
            const r    = Math.floor(pick.idx / game.cols);
            const c    = pick.idx % game.cols;
            const coord = `${String.fromCharCode(65 + c)}${r + 1}`;
            game.hintPenalty = (game.hintPenalty || 0) + 1;
            saveGames();
            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            await sendBoard(message, game, username, avatarUrl, [pick.idx], [], [], "hint", [
                `💡 Indice : case ${coord} → ${pick.sym}`,
                `⚠️ -20% sur le gain final par indice utilisé`,
                `📊 Indices utilisés : ${game.hintPenalty}`,
            ]);
            return;
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
            const difficulty = DIFFICULTIES[args[2]?.toLowerCase()] ? args[2].toLowerCase() : "normal";
            const theme      = CARD_THEMES[args[3]?.toLowerCase()]  ? args[3].toLowerCase() : "animaux";

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

            await updateUserCash(uid, -bet);
            const diff  = DIFFICULTIES[difficulty];
            const board = createBoard(difficulty, theme);
            const game  = {
                uid, difficulty, theme,
                board, cols: diff.cols,
                revealed:    new Array(board.length).fill(false),
                attempts:    0,
                matched:     0,
                streak:      0,
                maxCombo:    0,
                currentCombo:0,
                hintPenalty: 0,
                startTime:   Date.now(),
                bet,
                betFormatted: await formatNumber(bet),
                firstCard: null,
            };
            activeGames.set(uid, game);
            saveGames();

            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);

            await sendBoard(message, game, username, avatarUrl, [], [], [], "start", [
                "🧠 MEMORY — PARTIE LANCÉE !",
                "---",
                `📊 Difficulté : ${difficulty}`,
                `🎨 Thème      : ${theme}`,
                `🃏 Paires     : ${diff.pairs}`,
                `⏱️ Temps      : 10 minutes`,
                `💰 Mise       : ${game.betFormatted}$`,
                `⚡ Bonus vitesse si < ${timeStr(diff.bonusSpeed)} → x${diff.bonusMult}`,
                "---",
                "📝 Ex : memory A1 B2",
                `💡 Indice : ${p}memory hint`,
            ]);

            const timeout = setTimeout(async () => {
                const g = activeGames.get(uid);
                if (!g) return;
                const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
                await sendBoard(message, g, uname, uavatar, [], [], [], "timeout", [
                    "⏰ TEMPS ÉCOULÉ !",
                    `🃏 Paires trouvées : ${g.matched}/${diff.pairs}`,
                    `📉 Mise perdue : -${await formatNumber(g.bet)}$`,
                ]);
                await endGame(message, g, false, uname, uavatar);
            }, TIME_LIMIT * 1000);

            gameTimeouts.set(uid, timeout);
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
        if (elapsed >= TIME_LIMIT) {
            const [uname, uavatar] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            return endGame(message, game, false, uname, uavatar);
        }

        const rows   = Math.ceil(game.board.length / game.cols);
        const coord1 = parseCoord(args[0], game.cols, rows);
        const coord2 = args[1] ? parseCoord(args[1], game.cols, rows) : null;

        if (!coord1) {
            return message.reply(S([
                "❌ Coordonnées invalides.",
                "📝 Ex : memory A1 B2",
                `📐 Colonnes A-${String.fromCharCode(64 + game.cols)}, Lignes 1-${rows}`,
            ]));
        }

        if (!coord2) {
            if (game.firstCard !== null && game.firstCard !== coord1.index) {
                const c2 = coord1;
                const c1 = { index: game.firstCard, row: Math.floor(game.firstCard / game.cols), col: game.firstCard % game.cols };
                if (game.revealed[c1.index] || game.revealed[c2.index]) {
                    game.firstCard = null;
                    return message.reply(S(["❌ Une de ces cartes est déjà trouvée !"]));
                }
                const coord1Final = c1;
                const coord2Final = c2;
                game.firstCard = null;
                return processMove(coord1Final, coord2Final, game, uid, message, api, diff, rows);
            }
            if (game.revealed[coord1.index]) return message.reply(S(["❌ Cette carte est déjà trouvée !"]));
            game.firstCard = coord1.index;
            saveGames();
            const [username, avatarUrl] = await Promise.all([getUserName(uid, api), getUserAvatar(uid, api)]);
            await sendBoard(message, game, username, avatarUrl, [coord1.index], [], [], "start", [
                `🃏 Première carte : ${args[0].toUpperCase()}`,
                "📝 Entrez la 2ème carte : memory B3",
                `ou : memory ${args[0].toUpperCase()} B3`,
            ]);
            return;
        }

        if (coord1.index === coord2.index) return message.reply(S(["❌ Choisissez 2 cartes différentes !"]));
        if (game.revealed[coord1.index] || game.revealed[coord2.index]) return message.reply(S(["❌ Une de ces cartes est déjà trouvée !"]));
        game.firstCard = null;
        return processMove(coord1, coord2, game, uid, message, api, diff, rows);
    }
};