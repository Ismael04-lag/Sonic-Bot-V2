const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { createCanvas, loadImage } = require("canvas");

const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/parse";
const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";

const SOUND_URLS = {
    win: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3",
    lose: "https://assets.mixkit.co/active_storage/sfx/837/837-preview.mp3"
};

function getTicTacSoundURL() {
    const text = encodeURIComponent("tic-tac tic-tac tic-tac tic-tac tic-tac");
    return `https://translate.google.com/translate_tts?ie=UTF-8&q=${text}&tl=fr&client=tw-ob`;
}

async function sendRemoteSound(url, message) {
    try {
        const response = await axios.get(url, { responseType: "stream" });
        await message.reply({ attachment: response.data });
    } catch (err) {
        console.error("Erreur son:", err);
    }
}

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === undefined || value === null) return 0n;
    try {
        return BigInt(String(value).split('.')[0]);
    } catch {
        return 0n;
    }
}

function isInfinity(value) {
    if (typeof value === 'bigint') return value > BigInt("9".repeat(260));
    return !isFinite(Number(value)) || Number(value) >= 1e260;
}

function formatBigInt(num) {
    if (isInfinity(num)) return "∞";
    if (num === 0n) return "0";
  const suffixes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc", "Dq", "Dz", "Qs", "Qo", "Qu"];
    let i = 0;
    let scaled = num;
    const thousand = 1000n;
    while (scaled >= thousand && i < suffixes.length - 1) {
        scaled = scaled / thousand;
        i++;
    }
    const remainder = i > 0 ? (num % (thousand ** BigInt(i))) / (thousand ** BigInt(i - 1)) : 0n;
    if (i > 0 && remainder > 0n) return `${scaled}.${remainder}${suffixes[i]}`;
    return `${scaled}${suffixes[i]}`;
}

async function formatNumber(num) {
    if (isInfinity(num)) return "∞";
    const bigNum = toBigInt(num);
    try {
        const response = await axios.get(`${CONVERT_API_URL}?number=${bigNum.toString()}`);
        if (response.data && response.data.success) return response.data.formatted;
    } catch (error) {}
    return formatBigInt(bigNum);
}

async function getUserCash(userId) {
    try {
        const response = await axios.get(`${CASH_API_URL}/${userId}`);
        if (response.data.success) return toBigInt(response.data.data.cash);
    } catch (error) {
        console.error("Cash API Error:", error.message);
    }
    return 0n;
}

async function updateUserCash(userId, amount) {
    const bigAmount = toBigInt(amount);
    try {
        if (bigAmount >= 0n) {
            await axios.post(`${CASH_API_URL}/${userId}/add`, { amount: bigAmount.toString() });
        } else {
            await axios.post(`${CASH_API_URL}/${userId}/subtract`, { amount: (-bigAmount).toString() });
        }
    } catch (error) {
        console.error("Cash API Update Error:", error.message);
    }
}

const COOLDOWN_FILE = "./slot_cooldowns.json";
let slotCooldowns = new Map();

if (fs.existsSync(COOLDOWN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(COOLDOWN_FILE, "utf8"));
        slotCooldowns = new Map(Object.entries(data));
    } catch (e) {
        console.error("Erreur chargement slot_cooldowns.json:", e);
    }
}

async function saveCooldowns() {
    try {
        const obj = Object.fromEntries(slotCooldowns);
        fs.writeFileSync(COOLDOWN_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {
        console.error("Erreur sauvegarde slot_cooldowns.json:", e);
    }
}

function getDisplaySymbols(slots) {
    const map = { "🤍": "◯", "🖤": "✕", "💚": "◆" };
    return slots.map(e => map[e] || e);
}

function calculateWinnings(slot1, slot2, slot3, betAmount) {
    const bet = toBigInt(betAmount);
    if (slot1 === "🤍" && slot2 === "🤍" && slot3 === "🤍") {
        return { win: true, winAmount: bet * 10n, multiplier: 10 };
    } else if (slot1 === "🖤" && slot2 === "🖤" && slot3 === "🖤") {
        return { win: true, winAmount: bet * 5n, multiplier: 5 };
    } else if (slot1 === slot2 && slot2 === slot3) {
        return { win: true, winAmount: bet * 3n, multiplier: 3 };
    } else if (slot1 === slot2 || slot1 === slot3 || slot2 === slot3) {
        return { win: true, winAmount: bet * 2n, multiplier: 2 };
    } else {
        return { win: false, winAmount: -bet, multiplier: 0 };
    }
}

function getUserName(uid, api) {
    return new Promise((resolve) => {
        api.getUserInfo(uid, (err, data) => {
            if (err || !data || !data[uid]) {
                resolve(`User_${String(uid).slice(-5)}`);
            } else {
                const name = data[uid].name;
                if (name && name !== "Facebook User" && name !== "Utilisateur") {
                    resolve(name);
                } else {
                    resolve(`User_${String(uid).slice(-5)}`);
                }
            }
        });
    });
}

async function getUserAvatar(uid, api) {
    try {
        const info = await api.getUserInfo(uid);
        return info[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    } catch(e) {
        return `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    }
}

async function generateRealisticSlotCard(username, amount, win, winAmount, newBalance, displaySlots, multiplier, remainingSpins, avatarUrl) {
    const width = 600;
    const height = 380;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1c2b");
    gradient.addColorStop(0.5, "#0f1023");
    gradient.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    for (let i = 0; i < width; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 2, height);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.stroke();
    }

    ctx.strokeStyle = "rgba(212, 175, 55, 0.3)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(8, 8, width - 16, height - 16);

    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fillRect(0, 50, width, 60);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("HEDGEHOG", 25, 45);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(212, 175, 55, 0.7)";
    ctx.fillText("SLOT MACHINE", 25, 62);

    if (avatarUrl) {
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(width - 50, 50, 35, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, width - 85, 15, 70, 70);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(width - 50, 50, 35, 0, Math.PI * 2);
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = "#d4af37";
            ctx.beginPath();
            ctx.arc(width - 50, 50, 35, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "28px 'Courier New'";
            ctx.fillText("👤", width - 68, 68);
        }
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.beginPath();
    ctx.roundRect(25, 85, 70, 45, 8);
    ctx.fill();
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 12px 'Courier New'";
    ctx.fillText("GAME", 48, 112);
    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#d4af37" : "#b8960c";
        ctx.fillRect(30 + i * 8, 118, 3, 5);
    }

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 28px 'Courier New'";
    ctx.fillText(displaySlots[0], 280, 170);
    ctx.fillText(displaySlots[1], 340, 170);
    ctx.fillText(displaySlots[2], 400, 170);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("SPIN", 25, 188);
    ctx.fillText("RESULT", 25, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Courier New'";
    ctx.fillText(win ? "WINNER" : "LOSER", 25, 218);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Courier New'";
    const cardHolderName = username.toUpperCase().substring(0, 22);
    ctx.fillText(cardHolderName, 25, 260);

    ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
    ctx.fillRect(width - 150, height - 75, 135, 55);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 26px 'Courier New'";
    ctx.fillText(`${await formatNumber(newBalance)}$`, width - 145, height - 35);

    ctx.fillStyle = "#88ff88";
    ctx.font = "11px 'Courier New'";
    if (win) {
        ctx.fillText(`GAIN: +${await formatNumber(winAmount)}$ (x${multiplier})`, width - 145, height - 70);
    } else {
        ctx.fillText(`PERTE: -${await formatNumber(amount)}$`, width - 145, height - 70);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("SPINS", width - 55, 115);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillText(`${remainingSpins}/15`, width - 55, 133);

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, height - 22, width, 22);
    ctx.fillStyle = "rgba(212, 175, 55, 0.5)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("HEDGEHOG SLOT • PREMIUM • SINCE 2025", width / 2 - 145, height - 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("CASINO", width - 85, height - 8);

    return canvas.toBuffer();
}

function formatStyledMessage(contentLines) {
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        msg += `│ ${line}\n`;
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

module.exports = {
    config: {
        name: "slot",
        version: "4.0",
        author: "Itachi Soma",
        countDown: 3,
        role: 0,
        category: "fun",
        shortDescription: { en: "Slot machine game" },
        longDescription: { en: "Play slot machine with your money! Jackpot x10, x5, x3, x2. 15 spins per 30 minutes." }
    },

    onStart: async function ({ args, message, event, api, usersData }) {
        const { senderID } = event;
        const userMoney = await getUserCash(senderID);

        async function parseAmountWithSuffix(input) {
            if (!input) return 0n;
            const strInput = String(input).toLowerCase().trim();
            try {
                const response = await axios.get(`${CONVERT_API_URL}?input=${encodeURIComponent(strInput)}`);
                if (response.data && response.data.success && response.data.result) {
                    return toBigInt(response.data.result);
                }
            } catch (error) {}
            const SUFFIXES = {
                'k': 1_000n, 'm': 1_000_000n, 'b': 1_000_000_000n,
                't': 1_000_000_000_000n, 'q': 1_000_000_000_000_000n,
                'Q': 1_000_000_000_000_000_000n,
                's': 1_000_000_000_000_000_000_000n,
                'S': 1_000_000_000_000_000_000_000_000n,
                'o': 1_000_000_000_000_000_000_000_000_000n,
                'n': 1_000_000_000_000_000_000_000_000_000_000n,
                'd': 1_000_000_000_000_000_000_000_000_000_000_000n
            };
            const scientificMatch = strInput.match(/^(\d+(?:\.\d+)?)e(\d+)$/i);
            if (scientificMatch) {
                return toBigInt(Math.floor(parseFloat(scientificMatch[1]) * Math.pow(10, parseInt(scientificMatch[2]))));
            }
            const match = strInput.match(/^(\d+(?:\.\d+)?)([a-zA-Z]?)$/);
            if (!match) return 0n;
            const value = parseFloat(match[1]);
            const suffix = match[2];
            if (isNaN(value)) return 0n;
            if (suffix && SUFFIXES[suffix]) {
                return toBigInt(Math.floor(value)) * SUFFIXES[suffix];
            }
            return toBigInt(Math.floor(value));
        }

        const amount = await parseAmountWithSuffix(args[0]);

        const bankPath = "./bank.json";
        let bankData = {};
        if (fs.existsSync(bankPath)) {
            bankData = JSON.parse(fs.readFileSync(bankPath, "utf8"));
        }

        const userBank = bankData[senderID] || { bank: 0, imageMode: true };
        const username = await getUserName(senderID, api);
        const avatarUrl = await getUserAvatar(senderID, api);

        function formatTimeRemaining(ms) {
            const minutes = Math.floor(ms / 60000);
            const seconds = Math.floor((ms % 60000) / 1000);
            return `${minutes}m ${seconds}s`;
        }

        function getSlotCooldown(userId) {
            if (!slotCooldowns.has(userId)) {
                slotCooldowns.set(userId, { spins: 15, maxSpins: 15, resetTime: Date.now() + 30 * 60 * 1000 });
                saveCooldowns();
            }
            const cooldown = slotCooldowns.get(userId);
            const now = Date.now();
            if (now > cooldown.resetTime) {
                cooldown.spins = cooldown.maxSpins;
                cooldown.resetTime = now + 30 * 60 * 1000;
                slotCooldowns.set(userId, cooldown);
                saveCooldowns();
            }
            return cooldown;
        }

        function useSpin(userId) {
            const cooldown = getSlotCooldown(userId);
            if (cooldown.spins > 0) {
                cooldown.spins--;
                slotCooldowns.set(userId, cooldown);
                saveCooldowns();
                return true;
            }
            return false;
        }

        function getRemainingSpins(userId) {
            const cooldown = getSlotCooldown(userId);
            return {
                spins: cooldown.spins,
                maxSpins: cooldown.maxSpins,
                resetTime: cooldown.resetTime,
                timeRemaining: Math.max(0, cooldown.resetTime - Date.now())
            };
        }

        if (args[0]?.toLowerCase() === "stats") {
            const stats = getRemainingSpins(senderID);
            const progressBar = "█".repeat(Math.floor(stats.spins / stats.maxSpins * 20)) +
                "░".repeat(20 - Math.floor(stats.spins / stats.maxSpins * 20));
            return message.reply(formatStyledMessage([
                "🎰 SLOT STATS",
                "━━━━━━━━━━━━━━━━",
                `🎲 Tours restants : ${stats.spins}/${stats.maxSpins}`,
                `📊 ${progressBar}`,
                "━━━━━━━━━━━━━━━━",
                `⏰ Rechargement dans : ${formatTimeRemaining(stats.timeRemaining)}`
            ]));
        }

        const spinStats = getRemainingSpins(senderID);
        if (spinStats.spins <= 0) {
            return message.reply(formatStyledMessage([
                "❌ Plus de tours disponibles !",
                "━━━━━━━━━━━━━━━━",
                "🎰 Vous avez utilisé vos 15 tours.",
                `⏰ Rechargement dans : ${formatTimeRemaining(spinStats.timeRemaining)}`,
                "━━━━━━━━━━━━━━━━",
                "📊 Tapez ~slot stats pour voir vos statistiques."
            ]));
        }

        if (amount <= 0n) {
            return message.reply(formatStyledMessage([
                "❌ Montant invalide",
                "━━━━━━━━━━━━━━━━",
                `📝 Utilisation : ${global.utils.getPrefix(event.threadID)}slot <montant>`,
                "💳 Exemple : ~slot 50k"
            ]));
        }

        if (amount > userMoney) {
            return message.reply(formatStyledMessage([
                "❌ Fonds insuffisants",
                "━━━━━━━━━━━━━━━━",
                `💰 Ton solde : ${await formatNumber(userMoney)}$`,
                `🎰 Montant : ${await formatNumber(amount)}$`
            ]));
        }

        const emojiSlots = ["🤍", "🖤", "💚", "🖤", "🤍", "💚", "💚", "🖤", "🤍"];
        const slot1 = emojiSlots[Math.floor(Math.random() * emojiSlots.length)];
        const slot2 = emojiSlots[Math.floor(Math.random() * emojiSlots.length)];
        const slot3 = emojiSlots[Math.floor(Math.random() * emojiSlots.length)];

        const result = calculateWinnings(slot1, slot2, slot3, amount);
        const win = result.win;
        const winAmount = result.winAmount;
        const multiplier = result.multiplier;

        useSpin(senderID);
        await updateUserCash(senderID, winAmount);
        const newBalance = await getUserCash(senderID);
        const updatedStats = getRemainingSpins(senderID);

        const formattedWinAmount = await formatNumber(win ? winAmount : -winAmount);
        const formattedNewBalance = await formatNumber(newBalance);
        const formattedAmount = await formatNumber(amount);

        let resultMsg = "";
        if (win) {
            resultMsg = `🎉 VICTOIRE ! 🎉\n━━━━━━━━━━━━━━━━\n✨ Gain : +${formattedWinAmount}$ (x${multiplier})\n💰 Nouveau solde : ${formattedNewBalance}$`;
        } else {
            resultMsg = `💀 PERDU ... 💀\n━━━━━━━━━━━━━━━━\n📉 Perte : -${formattedAmount}$\n💰 Nouveau solde : ${formattedNewBalance}$`;
        }

        await sendRemoteSound(getTicTacSoundURL(), message);
        await new Promise(r => setTimeout(r, 5000));

        await message.reply(formatStyledMessage([
            "🎰 SLOT MACHINE 🎰",
            "━━━━━━━━━━━━━━━━",
            `🎲 [ ${slot1} | ${slot2} | ${slot3} ]`,
            "━━━━━━━━━━━━━━━━",
            `💰 Mise : ${formattedAmount}$`,
            "━━━━━━━━━━━━━━━━",
            resultMsg,
            "━━━━━━━━━━━━━━━━",
            `🎰 Tours restants : ${updatedStats.spins}/${updatedStats.maxSpins}`
        ]));

        if (win) {
            sendRemoteSound(SOUND_URLS.win, message);
        } else {
            sendRemoteSound(SOUND_URLS.lose, message);
        }

        if (userBank.imageMode !== false) {
            try {
                const displaySlots = getDisplaySymbols([slot1, slot2, slot3]);
                const cardImage = await generateRealisticSlotCard(
                    username, amount, win, winAmount,
                    newBalance, displaySlots, multiplier, updatedStats.spins, avatarUrl
                );
                const imgPath = `./slot_card_${senderID}.png`;
                fs.writeFileSync(imgPath, cardImage);
                await message.reply({
                    body: "💳 Recapitulatif sur votre carte bancaire :",
                    attachment: fs.createReadStream(imgPath)
                });
                fs.unlinkSync(imgPath);
            } catch (error) {
                console.error("Erreur generation carte:", error);
            }
        }
    }
};