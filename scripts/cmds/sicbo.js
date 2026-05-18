const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/parse";

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
    const suffixes = ["", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
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
    const match = strInput.match(/^(\d+(?:\.\d+)?)([a-zA-Z]?)$/);
    if (!match) return 0n;
    let value = parseFloat(match[1]);
    const suffix = match[2];
    if (isNaN(value)) return 0n;
    if (suffix && SUFFIXES[suffix]) {
        return toBigInt(Math.floor(value)) * SUFFIXES[suffix];
    }
    return toBigInt(Math.floor(value));
}

function rollDice() {
    return [Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1];
}

function getDiceEmoji(value) {
    const emojis = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };
    return emojis[value];
}

function evaluateBet(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
    switch(betType) {
        case "petit": return !isTriple && sum >= 4 && sum <= 10;
        case "grand": return !isTriple && sum >= 11 && sum <= 17;
        case "total": return sum === betValue;
        case "triple": return isTriple && (betValue === "any" || dice[0] === betValue);
        case "double":
            if (!isTriple) {
                const counts = {};
                dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
                return Object.values(counts).some(c => c >= 2) && (betValue === "any" || counts[betValue] >= 2);
            }
            return false;
        case "simple": return dice.includes(betValue);
        case "combo": return dice.includes(betValue[0]) && dice.includes(betValue[1]);
        default: return false;
    }
}

function getPayout(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const payouts = {
        petit: 3, grand: 3,
        total: { 4: 60, 5: 30, 6: 18, 7: 12, 8: 8, 9: 7, 10: 6, 11: 6, 12: 7, 13: 8, 14: 12, 15: 18, 16: 30, 17: 60 },
        triple_any: 30, triple_specific: 180,
        double_any: 10, double_specific: 11,
        simple: 3, combo: 7
    };
    if (betType === "total") return payouts.total[sum] || 0;
    if (betType === "triple") return betValue === "any" ? payouts.triple_any : payouts.triple_specific;
    if (betType === "double") return betValue === "any" ? payouts.double_any : payouts.double_specific;
    if (betType === "simple") return payouts.simple;
    if (betType === "combo") return payouts.combo;
    return payouts[betType] || 0;
}

function formatStyledMessage(contentLines) {
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        msg += `│ ${line}\n`;
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

async function generateRealisticSicboCard(username, betDisplay, amount, win, winAmount, newBalance, dice, sum, isTriple, payout, avatarUrl) {
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
    ctx.fillText("SIC BO CASINO", 25, 62);

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

    const diceEmojis = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };
    ctx.font = "42px 'Segoe UI Emoji'";
    ctx.fillStyle = "#fff";
    ctx.fillText(diceEmojis[dice[0]], 280, 170);
    ctx.fillText(diceEmojis[dice[1]], 340, 170);
    ctx.fillText(diceEmojis[dice[2]], 400, 170);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("DICE", 25, 188);
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
        ctx.fillText(`GAIN: +${await formatNumber(winAmount)}$ (x${payout})`, width - 145, height - 70);
    } else {
        ctx.fillText(`PERTE: -${await formatNumber(amount)}$`, width - 145, height - 70);
    }

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("BET", width - 55, 115);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 14px 'Courier New'";
    const shortBet = betDisplay.length > 12 ? betDisplay.substring(0, 10) + ".." : betDisplay;
    ctx.fillText(shortBet, width - 55, 133);

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, height - 22, width, 22);
    ctx.fillStyle = "rgba(212, 175, 55, 0.5)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("HEDGEHOG SIC BO • PREMIUM • SINCE 2025", width / 2 - 155, height - 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("CASINO", width - 85, height - 8);

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "sicbo",
        version: "5.0",
        author: "Itachi Soma",
        countDown: 3,
        role: 0,
        category: "fun"
    },

    onStart: async function ({ args, message, event, api }) {
        const { senderID } = event;
        const userMoney = await getUserCash(senderID);
        const subCommand = args[0]?.toLowerCase();

        const bankPath = "./bank.json";
        let bankData = {};
        if (fs.existsSync(bankPath)) {
            bankData = JSON.parse(fs.readFileSync(bankPath, "utf8"));
        }
        const userBank = bankData[senderID] || { bank: 0, imageMode: true };
        const username = await getUserName(senderID, api);
        const avatarUrl = await getUserAvatar(senderID, api);

        if (!subCommand || subCommand === "help") {
            return message.reply(formatStyledMessage([
                "🎲 SIC BO - LE JEU DES 3 DÉS",
                "━━━━━━━━━━━━━━━━",
                "⚙️ COMMANDES ⚙️",
                "",
                "🎲 sicbo balance",
                "🎲 sicbo petit <montant>",
                "🎲 sicbo grand <montant>",
                "🎲 sicbo total <montant> <4-17>",
                "🎲 sicbo triple <montant> [1-6/any]",
                "🎲 sicbo double <montant> [1-6/any]",
                "🎲 sicbo simple <montant> <1-6>",
                "🎲 sicbo combo <montant> <1-6> <1-6>",
                "🎲 sicbo bonus",
                "",
                "━━━━━━━━━━━━━━━━",
                `📋 Ton solde : ${await formatNumber(userMoney)}$`
            ]));
        }

        if (subCommand === "balance" || subCommand === "solde") {
            return message.reply(formatStyledMessage([`📋 Capital actuel: ${await formatNumber(userMoney)}$`]));
        }

        if (subCommand === "bonus") {
            let lastBonus = 0;
            const now = Date.now();
            const dayMs = 86400000;
            const userData = await usersData?.get(senderID) || {};
            lastBonus = userData.lastBonus || 0;

            if (now - lastBonus < dayMs) {
                const remaining = Math.ceil((dayMs - (now - lastBonus)) / 3600000);
                return message.reply(formatStyledMessage([`🎁 Bonus déjà reçu !`, `⏳ Prochain bonus dans ${remaining}h`]));
            }

            await updateUserCash(senderID, 200n);
            const newBalance = await getUserCash(senderID);
            if (usersData) await usersData.set(senderID, { lastBonus: now });
            return message.reply(formatStyledMessage([
                "🎁 BONUS QUOTIDIEN",
                "━━━━━━━━━━━━━━━━",
                "✨ +200$",
                `💰 Nouveau solde : ${await formatNumber(newBalance)}$`
            ]));
        }

        const betType = subCommand;
        const amount = await parseAmountWithSuffix(args[1]);

        if (amount <= 0n) {
            return message.reply(formatStyledMessage(["❌ Montant invalide", "", "Exemples : 50k, 1.5M, 2B, 100T"]));
        }

        if (amount > userMoney) {
            return message.reply(formatStyledMessage([
                "❌ Fonds insuffisants",
                "━━━━━━━━━━━━━━━━",
                `💰 Ton solde : ${await formatNumber(userMoney)}$`,
                `🎲 Montant : ${await formatNumber(amount)}$`
            ]));
        }

        let betValue = null;
        const validTypes = ["petit", "grand", "total", "triple", "double", "simple", "combo"];

        if (!validTypes.includes(betType)) {
            return message.reply(formatStyledMessage(["❌ Type de pari inconnu", "", "➜ sicbo help"]));
        }

        if (betType === "total") {
            betValue = parseInt(args[2]);
            if (isNaN(betValue) || betValue < 4 || betValue > 17) {
                return message.reply(formatStyledMessage(["❌ Total invalide → 4-17"]));
            }
        }

        if (betType === "triple" || betType === "double") {
            betValue = args[2] || "any";
            if (betValue !== "any" && (parseInt(betValue) < 1 || parseInt(betValue) > 6)) {
                return message.reply(formatStyledMessage(["❌ Valeur invalide → 1-6 ou any"]));
            }
            if (betValue !== "any") betValue = parseInt(betValue);
        }

        if (betType === "simple") {
            betValue = parseInt(args[2]);
            if (isNaN(betValue) || betValue < 1 || betValue > 6) {
                return message.reply(formatStyledMessage(["❌ Valeur invalide → 1-6"]));
            }
        }

        if (betType === "combo") {
            const num1 = parseInt(args[2]);
            const num2 = parseInt(args[3]);
            if (isNaN(num1) || isNaN(num2) || num1 < 1 || num1 > 6 || num2 < 1 || num2 > 6) {
                return message.reply(formatStyledMessage(["❌ Combinaison invalide"]));
            }
            betValue = [num1, num2];
        }

        await updateUserCash(senderID, -amount);

        const dice = rollDice();
        const diceDisplay = dice.map(d => getDiceEmoji(d)).join(" ");
        const sum = dice[0] + dice[1] + dice[2];
        const isTriple = dice[0] === dice[1] && dice[1] === dice[2];

        const randomWin = Math.random() < 0.85;

        let win = false;
        let payout = 0;
        let winAmount = 0n;

        if (randomWin) {
            win = evaluateBet(betType, betValue, dice);
            if (win) {
                payout = getPayout(betType, betValue, dice);
                winAmount = amount * BigInt(payout);
            } else {
                win = false;
                payout = 0;
                winAmount = 0n;
            }
        } else {
            win = false;
        }

        let newBalance;
        if (win) {
            await updateUserCash(senderID, winAmount);
            newBalance = await getUserCash(senderID);
        } else {
            newBalance = await getUserCash(senderID);
        }

        let betDisplay = "";
        if (betType === "total") betDisplay = `Total = ${betValue}`;
        else if (betType === "triple") betDisplay = `Triple ${betValue === "any" ? "quelconque" : `de ${betValue}`}`;
        else if (betType === "double") betDisplay = `Double ${betValue === "any" ? "quelconque" : `de ${betValue}`}`;
        else if (betType === "simple") betDisplay = `Numéro ${betValue}`;
        else if (betType === "combo") betDisplay = `Combinaison ${betValue[0]}+${betValue[1]}`;
        else betDisplay = betType === "petit" ? "Petit (4-10)" : "Grand (11-17)";

        let resultMsg = "";
        if (win) {
            resultMsg = `🎉 VICTOIRE ! 🎉\n━━━━━━━━━━━━━━━━\n✨ Gain : +${await formatNumber(winAmount)}$ (x${payout})\n💰 Nouveau solde : ${await formatNumber(newBalance)}$`;
        } else {
            resultMsg = `💀 PERDU ... 💀\n━━━━━━━━━━━━━━━━\n📉 Perte : -${await formatNumber(amount)}$\n💰 Nouveau solde : ${await formatNumber(newBalance)}$`;
        }

        let tripleInfo = isTriple ? `\n━━━━━━━━━━━━━━━━\n🎲 TRIPLE ! ${dice[0]} ${dice[0]} ${dice[0]}` : "";

        await message.reply(formatStyledMessage([
            "☘️ SIC BO - RÉSULTAT ☘️",
            "━━━━━━━━━━━━━━━━",
            `🎲 Lancer : ${diceDisplay}`,
            `📊 Total : ${sum}${tripleInfo}`,
            "━━━━━━━━━━━━━━━━",
            `📋 Ton pari : ${betDisplay}`,
            `💰 Mise : ${await formatNumber(amount)}$`,
            "━━━━━━━━━━━━━━━━",
            resultMsg
        ]));

        if (userBank.imageMode !== false) {
            try {
                const cardImage = await generateRealisticSicboCard(
                    username, betDisplay, amount, win, winAmount, newBalance,
                    dice, sum, isTriple, payout, avatarUrl
                );
                const imgPath = `./sicbo_card_${senderID}.png`;
                fs.writeFileSync(imgPath, cardImage);
                await message.reply({
                    body: "💳 Récapitulatif sur votre carte bancaire :",
                    attachment: fs.createReadStream(imgPath)
                });
                fs.unlinkSync(imgPath);
            } catch (error) {
                console.error("Erreur génération carte:", error);
            }
        }
    }
};