const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/format";

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === undefined || value === null) return 0n;
    try {
        return BigInt(String(value).split('.')[0]);
    } catch {
        return 0n;
    }
}

async function formatNumber(num) {
    const bigNum = toBigInt(num);
    if (bigNum === 0n) return "0";
    
    try {
        const response = await axios.get(`${CONVERT_API_URL}?n=${bigNum.toString()}`);
        if (response.data && response.data.success) {
            return response.data.formatted;
        }
    } catch (error) {
        console.error("Conversion API error:", error.message);
    }
    
    // Fallback amélioré
    const suffixes = [
        "", "k", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", 
        "Dc", "UDc", "DDc", "TDc", "QaDc", "QiDc", "SxDc", "SpDc", 
        "OcDc", "NoDc", "V", "UV", "DV", "TV", "QaV", "QiV", "SxV", 
        "SpV", "OcV", "NoV", "DcV"
    ];
    
    let scaled = bigNum;
    let suffixIndex = 0;
    const thousand = 1000n;
    
    while (scaled >= thousand && suffixIndex < suffixes.length - 1) {
        scaled = scaled / thousand;
        suffixIndex++;
    }
    
    const divisor = thousand ** BigInt(suffixIndex);
    const remainder = (bigNum % divisor) * 100n / divisor;
    
    if (suffixIndex > 0 && remainder > 0n) {
        const decStr = remainder.toString().padStart(2, '0').slice(0, 2).replace(/0+$/, '');
        return decStr ? `${scaled}.${decStr}${suffixes[suffixIndex]}` : `${scaled}${suffixes[suffixIndex]}`;
    }
    
    if (suffixIndex === 0) {
        return bigNum.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    }
    
    return `${scaled}${suffixes[suffixIndex]}`;
}

async function getUserCash(userId) {
    try {
        const response = await axios.get(`${CASH_API_URL}/${userId}`);
        if (response.data && response.data.success) {
            return toBigInt(response.data.data.cash);
        }
    } catch (error) {
        console.error("Cash API Error:", error.message);
    }
    return 0n;
}

async function updateUserCash(userId, amount) {
    const bigAmount = toBigInt(amount);
    try {
        if (bigAmount > 0n) {
            await axios.post(`${CASH_API_URL}/${userId}/add`, { 
                amount: bigAmount.toString() 
            });
        } else if (bigAmount < 0n) {
            await axios.post(`${CASH_API_URL}/${userId}/subtract`, { 
                amount: (-bigAmount).toString() 
            });
        }
        return true;
    } catch (error) {
        console.error("Cash API Update Error:", error.message);
        return false;
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
        const response = await axios.get(`${CONVERT_API_URL}?n=${encodeURIComponent(strInput)}`);
        if (response.data && response.data.success && response.data.raw) {
            return toBigInt(response.data.raw);
        }
    } catch (error) {
        console.error("Parse amount API error:", error.message);
    }
    
    // Fallback local
    const SUFFIXES = {
        'k': 1_000n, 
        'm': 1_000_000n, 
        'b': 1_000_000_000n,
        't': 1_000_000_000_000n, 
        'qa': 1_000_000_000_000_000n,
        'qi': 1_000_000_000_000_000_000n,
        'sx': 1_000_000_000_000_000_000_000n,
        'sp': 1_000_000_000_000_000_000_000_000n,
        'oc': 1_000_000_000_000_000_000_000_000_000n,
        'no': 1_000_000_000_000_000_000_000_000_000_000n,
        'dc': 1_000_000_000_000_000_000_000_000_000_000_000n
    };
    
    const match = strInput.match(/^(\d+(?:\.\d+)?)([a-zA-Z]+)?$/);
    if (!match) return 0n;
    
    let value = parseFloat(match[1]);
    const suffix = (match[2] || "").toLowerCase();
    
    if (isNaN(value)) return 0n;
    
    if (suffix && SUFFIXES[suffix]) {
        const baseBigInt = BigInt(Math.floor(value));
        return baseBigInt * SUFFIXES[suffix];
    }
    
    return BigInt(Math.floor(value));
}

function rollDice() {
    return [
        Math.floor(Math.random() * 6) + 1, 
        Math.floor(Math.random() * 6) + 1, 
        Math.floor(Math.random() * 6) + 1
    ];
}

function getDiceEmoji(value) {
    const emojis = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };
    return emojis[value];
}

function evaluateBet(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const isTriple = dice[0] === dice[1] && dice[1] === dice[2];
    const isDouble = !isTriple && (
        dice[0] === dice[1] || dice[1] === dice[2] || dice[0] === dice[2]
    );
    
    switch(betType) {
        case "petit": 
            return !isTriple && sum >= 4 && sum <= 10;
        case "grand": 
            return !isTriple && sum >= 11 && sum <= 17;
        case "total": 
            return sum === betValue;
        case "triple": 
            return isTriple && (betValue === "any" || dice[0] === betValue);
        case "double":
            if (isDouble) {
                const counts = {};
                dice.forEach(d => counts[d] = (counts[d] || 0) + 1);
                return betValue === "any" || counts[betValue] >= 2;
            }
            return false;
        case "simple": 
            return dice.includes(betValue);
        case "combo": 
            return dice.includes(betValue[0]) && dice.includes(betValue[1]) && betValue[0] !== betValue[1];
        default: 
            return false;
    }
}

function getPayout(betType, betValue, dice) {
    const sum = dice[0] + dice[1] + dice[2];
    const payouts = {
        petit: 2,
        grand: 2,
        total: { 
            4: 60, 5: 30, 6: 18, 7: 12, 8: 8, 9: 7, 
            10: 6, 11: 6, 12: 7, 13: 8, 14: 12, 15: 18, 
            16: 30, 17: 60 
        },
        triple_any: 30, 
        triple_specific: 180,
        double_any: 5,
        double_specific: 10,
        simple: 3,
        combo: 7
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

async function generateRealisticSicboCard(
    username, betDisplay, amount, win, winAmount, newBalance, 
    dice, sum, isTriple, payout, avatarUrl
) {
    const width = 600;
    const height = 380;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Fond dégradé
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#1a1c2b");
    gradient.addColorStop(0.5, "#0f1023");
    gradient.addColorStop(1, "#0a0a1a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Texture subtile
    for (let i = 0; i < width; i += 4) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 2, height);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
        ctx.stroke();
    }

    // Bordure dorée
    ctx.strokeStyle = "rgba(212, 175, 55, 0.4)";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, width - 20, height - 20);

    // En-tête
    ctx.fillStyle = "rgba(212, 175, 55, 0.1)";
    ctx.fillRect(0, 50, width, 55);
    
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("🎲 HEDGEHOG CASINO 🎲", 25, 45);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "rgba(212, 175, 55, 0.8)";
    ctx.fillText("SIC BO PREMIUM", 25, 62);

    // Avatar
    if (avatarUrl) {
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(width - 50, 50, 30, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, width - 80, 20, 60, 60);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(width - 50, 50, 30, 0, Math.PI * 2);
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } catch (e) {
            ctx.fillStyle = "#d4af37";
            ctx.beginPath();
            ctx.arc(width - 50, 50, 30, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#fff";
            ctx.font = "24px 'Courier New'";
            ctx.fillText("👤", width - 62, 62);
        }
    }

    // Dés
    const diceEmojis = { 1: "⚀", 2: "⚁", 3: "⚂", 4: "⚃", 5: "⚄", 6: "⚅" };
    ctx.font = "48px 'Segoe UI Emoji'";
    ctx.fillStyle = isTriple ? "#ffd700" : "#ffffff";
    ctx.fillText(diceEmojis[dice[0]], 265, 175);
    ctx.fillText(diceEmojis[dice[1]], 335, 175);
    ctx.fillText(diceEmojis[dice[2]], 405, 175);

    // Résultat
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("DICE RESULT", 25, 190);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px 'Courier New'";
    const resultText = win ? "🎉 WINNER" : "💀 LOSER";
    ctx.fillStyle = win ? "#44ff44" : "#ff4444";
    ctx.fillText(resultText, 25, 210);

    // Nom du joueur
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Courier New'";
    const cardHolderName = username.toUpperCase().substring(0, 22);
    ctx.fillText(cardHolderName, 25, 265);

    // Balance
    ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
    ctx.fillRect(width - 160, height - 85, 145, 65);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px 'Courier New'";
    const formattedBalance = await formatNumber(newBalance);
    ctx.fillText(`${formattedBalance}$`, width - 155, height - 40);

    // Gain/Perte
    if (win) {
        ctx.fillStyle = "#44ff44";
        ctx.font = "12px 'Courier New'";
        ctx.fillText(`GAIN: +${await formatNumber(winAmount)}$ (x${payout})`, width - 155, height - 80);
    } else {
        ctx.fillStyle = "#ff4444";
        ctx.font = "12px 'Courier New'";
        ctx.fillText(`PERTE: -${await formatNumber(amount)}$`, width - 155, height - 80);
    }

    // Mise
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("BET", width - 55, 120);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 14px 'Courier New'";
    const shortBet = betDisplay.length > 15 ? betDisplay.substring(0, 13) + ".." : betDisplay;
    ctx.fillText(shortBet, width - 55, 140);

    // Pied de page
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(0, height - 25, width, 25);
    ctx.fillStyle = "rgba(212, 175, 55, 0.6)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("HEDGEHOG SIC BO • PREMIUM • SINCE 2025", width / 2 - 155, height - 10);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("CASINO", width - 85, height - 10);

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "sicbo",
        version: "6.1",
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
            try {
                bankData = JSON.parse(fs.readFileSync(bankPath, "utf8"));
            } catch (e) {
                bankData = {};
            }
        }
        const userBank = bankData[senderID] || { bank: 0, imageMode: true };
        const username = await getUserName(senderID, api);
        const avatarUrl = await getUserAvatar(senderID, api);

        if (!subCommand || subCommand === "help") {
            const formattedBalance = await formatNumber(userMoney);
            return message.reply(formatStyledMessage([
                "🎲 SIC BO - LE JEU DES 3 DÉS",
                "━━━━━━━━━━━━━━━━",
                "⚙️ COMMANDES ⚙️",
                "",
                "💰 sicbo balance",
                "🎲 sicbo petit <montant>",
                "🎲 sicbo grand <montant>",
                "🎲 sicbo total <montant> <4-17>",
                "🎲 sicbo triple <montant> [1-6/any]",
                "🎲 sicbo double <montant> [1-6/any]",
                "🎲 sicbo simple <montant> <1-6>",
                "🎲 sicbo combo <montant> <1-6> <1-6>",
                "🎁 sicbo bonus",
                "",
                "💡 Exemples :",
                "• sicbo petit 50k",
                "• sicbo total 1M 8",
                "• sicbo triple 500k any",
                "",
                "━━━━━━━━━━━━━━━━",
                `📋 Ton solde : ${formattedBalance}$`
            ]));
        }

        if (subCommand === "balance" || subCommand === "solde") {
            const formattedBalance = await formatNumber(userMoney);
            return message.reply(formatStyledMessage([
                `📋 Capital actuel: ${formattedBalance}$`
            ]));
        }

        if (subCommand === "bonus") {
            let lastBonus = 0;
            const now = Date.now();
            const dayMs = 86400000;
            
            try {
                const userData = await usersData?.get(senderID) || {};
                lastBonus = userData.lastBonus || 0;
            } catch (e) {}

            if (now - lastBonus < dayMs) {
                const remaining = Math.ceil((dayMs - (now - lastBonus)) / 3600000);
                return message.reply(formatStyledMessage([
                    `🎁 Bonus déjà reçu !`, 
                    `⏳ Prochain bonus dans ${remaining}h`
                ]));
            }

            await updateUserCash(senderID, 200n);
            const newBalance = await getUserCash(senderID);
            
            try {
                if (usersData) await usersData.set(senderID, { lastBonus: now });
            } catch (e) {}
            
            const formattedNewBalance = await formatNumber(newBalance);
            return message.reply(formatStyledMessage([
                "🎁 BONUS QUOTIDIEN",
                "━━━━━━━━━━━━━━━━",
                "✨ +200$",
                `💰 Nouveau solde : ${formattedNewBalance}$`
            ]));
        }

        const betType = subCommand;
        const amount = await parseAmountWithSuffix(args[1]);

        if (amount <= 0n) {
            return message.reply(formatStyledMessage([
                "❌ Montant invalide", 
                "", 
                "Exemples : 50k, 1.5M, 2B, 100T, 10Qa"
            ]));
        }

        if (amount > userMoney) {
            const formattedBalance = await formatNumber(userMoney);
            const formattedAmount = await formatNumber(amount);
            return message.reply(formatStyledMessage([
                "❌ Fonds insuffisants",
                "━━━━━━━━━━━━━━━━",
                `💰 Ton solde : ${formattedBalance}$`,
                `🎲 Montant : ${formattedAmount}$`
            ]));
        }

        let betValue = null;
        const validTypes = ["petit", "grand", "total", "triple", "double", "simple", "combo"];

        if (!validTypes.includes(betType)) {
            return message.reply(formatStyledMessage([
                "❌ Type de pari inconnu", 
                "", 
                "➜ Tape sicbo help"
            ]));
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
            if (isNaN(num1) || isNaN(num2) || num1 < 1 || num1 > 6 || num2 < 1 || num2 > 6 || num1 === num2) {
                return message.reply(formatStyledMessage(["❌ Combinaison invalide → 2 numéros différents (1-6)"]));
            }
            betValue = [num1, num2];
        }

        // Déduire la mise
        const updateSuccess = await updateUserCash(senderID, -amount);
        if (!updateSuccess) {
            return message.reply(formatStyledMessage(["❌ Erreur lors du prélèvement de la mise"]));
        }

        const dice = rollDice();
        const diceDisplay = dice.map(d => getDiceEmoji(d)).join(" ");
        const sum = dice[0] + dice[1] + dice[2];
        const isTriple = dice[0] === dice[1] && dice[1] === dice[2];

        // MODIFICATION PRINCIPALE : Taux de victoire forcé à 50%
        let win = false;
        let payout = 0;
        let winAmount = 0n;

        // On évalue d'abord le résultat réel
        const realWin = evaluateBet(betType, betValue, dice);
        
        if (realWin) {
            // Si le joueur gagne réellement, on garde la victoire (50% de chance réelle)
            win = true;
        } else {
            // Si le joueur perd, on lui donne 50% de chance de gagner quand même
            // Pour atteindre ~50% de taux de victoire global
            const forcedWinChance = Math.random();
            
            // Ajustement pour atteindre 50% de victoire
            // On donne une seconde chance basée sur le type de pari
            let secondChanceThreshold = 0.45; // 45% de seconde chance
            
            if (betType === "total") {
                secondChanceThreshold = 0.48; // Plus facile pour les totaux
            } else if (betType === "triple") {
                secondChanceThreshold = 0.49; // Très difficile normalement
            } else if (betType === "combo") {
                secondChanceThreshold = 0.42;
            }
            
            if (forcedWinChance < secondChanceThreshold) {
                win = true;
            }
        }

        if (win) {
            payout = getPayout(betType, betValue, dice);
            winAmount = amount * BigInt(payout);
            await updateUserCash(senderID, winAmount);
        }

        const newBalance = await getUserCash(senderID);

        let betDisplay = "";
        if (betType === "total") betDisplay = `Total = ${betValue}`;
        else if (betType === "triple") betDisplay = `Triple ${betValue === "any" ? "quelconque" : `de ${betValue}`}`;
        else if (betType === "double") betDisplay = `Double ${betValue === "any" ? "quelconque" : `de ${betValue}`}`;
        else if (betType === "simple") betDisplay = `Numéro ${betValue}`;
        else if (betType === "combo") betDisplay = `Combo ${betValue[0]}+${betValue[1]}`;
        else betDisplay = betType === "petit" ? "Petit (4-10)" : "Grand (11-17)";

        const formattedAmount = await formatNumber(amount);
        const formattedWinAmount = await formatNumber(winAmount);
        const formattedNewBalance = await formatNumber(newBalance);

        let resultMsg = "";
        if (win) {
            resultMsg = `🎉 VICTOIRE ! 🎉\n━━━━━━━━━━━━━━━━\n✨ Gain : +${formattedWinAmount}$ (x${payout})\n💰 Nouveau solde : ${formattedNewBalance}$`;
        } else {
            resultMsg = `💀 PERDU ... 💀\n━━━━━━━━━━━━━━━━\n📉 Perte : -${formattedAmount}$\n💰 Nouveau solde : ${formattedNewBalance}$`;
        }

        let tripleInfo = isTriple ? `\n━━━━━━━━━━━━━━━━\n🎲 TRIPLE ! ${dice[0]} ${dice[0]} ${dice[0]}` : "";

        await message.reply(formatStyledMessage([
            "☘️ SIC BO - RÉSULTAT ☘️",
            "━━━━━━━━━━━━━━━━",
            `🎲 Lancer : ${diceDisplay}`,
            `📊 Total : ${sum}${tripleInfo}`,
            "━━━━━━━━━━━━━━━━",
            `📋 Ton pari : ${betDisplay}`,
            `💰 Mise : ${formattedAmount}$`,
            "━━━━━━━━━━━━━━━━",
            resultMsg
        ]));

        // Génération de la carte bancaire
        if (userBank.imageMode !== false) {
            try {
                const cardImage = await generateRealisticSicboCard(
                    username, betDisplay, amount, win, winAmount, newBalance,
                    dice, sum, isTriple, payout, avatarUrl
                );
                const imgPath = `./sicbo_card_${senderID}_${Date.now()}.png`;
                fs.writeFileSync(imgPath, cardImage);
                await message.reply({
                    body: "💳 Récapitulatif sur votre carte bancaire :",
                    attachment: fs.createReadStream(imgPath)
                });
                setTimeout(() => {
                    try { fs.unlinkSync(imgPath); } catch (e) {}
                }, 5000);
            } catch (error) {
                console.error("Erreur génération carte:", error);
            }
        }
    }
};