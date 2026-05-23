const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const path = require("path");

const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/format";
const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";

function toBigInt(value) {
    if (typeof value === 'bigint') return value;
    if (value === undefined || value === null) return 0n;
    try {
        const clean = String(value).split('.')[0].replace(/[^0-9\-]/g, "") || "0";
        return BigInt(clean);
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
    if (num < 0n) return "-" + formatBigInt(-num);
    const tiers = [
        { v: 10n**48n, s: "Qu" }, { v: 10n**45n, s: "Qo" }, { v: 10n**42n, s: "Qs" }, { v: 10n**39n, s: "Dz" }, { v: 10n**36n, s: "Dq" }, { v: 10n**33n, s: "Dc" }, { v: 10n**30n, s: "No" }, { v: 10n**27n, s: "Oc" },
        { v: 10n**24n, s: "Sp" }, { v: 10n**21n, s: "Sx" }, { v: 10n**18n, s: "Qi" },
        { v: 10n**15n, s: "Qa" }, { v: 10n**12n, s: "T"  }, { v: 10n**9n,  s: "B"  },
        { v: 10n**6n,  s: "M"  }, { v: 10n**3n,  s: "k"  },
    ];
    for (const { v, s } of tiers) {
        if (num >= v) {
            const int = num / v;
            const dec = (num % v) * 10n / v;
            if (dec > 0n) {
                if (int > 10n) return `${int}${s}`;
                return `${int}.${dec}${s}`;
            }
            return `${int}${s}`;
        }
    }
    return num.toString();
}

async function formatNumber(num) {
    const big = toBigInt(num);
    if (isInfinity(big)) return "∞";
    try {
        const response = await axios.get(`${CONVERT_API_URL}?number=${big.toString()}`, { timeout: 3000 });
        if (response.data && response.data.success && response.data.formatted) return response.data.formatted;
    } catch (error) {}
    return formatBigInt(big);
}

async function getUserCash(userId) {
    try {
        const response = await axios.get(`${CASH_API_URL}/${userId}`, { timeout: 10000 });
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

function getUserInfo(uid, api) {
    return new Promise((resolve) => {
        api.getUserInfo(uid, (err, data) => {
            if (err || !data || !data[uid]) {
                resolve({ name: `User_${String(uid).slice(-5)}`, thumbSrc: null });
            } else {
                resolve({
                    name: data[uid].name || `User_${String(uid).slice(-5)}`,
                    thumbSrc: data[uid].thumbSrc || null
                });
            }
        });
    });
}

function formatStyledMessage(contentLines) {
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        msg += `│ ${line}\n`;
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

async function parseAmountWithSuffix(input) {
    if (!input) return 0n;
    try {
        const response = await axios.get(`${CONVERT_API_URL}?input=${encodeURIComponent(input)}`);
        if (response.data.success && response.data.result) return toBigInt(response.data.result);
    } catch (error) {}
    const str = String(input).toLowerCase().trim();
    const SUFFIXES = {
        'k': 1000n, 'm': 1000000n, 'b': 1000000000n, 't': 1000000000000n,
        'q': 1000000000000000n, 'Q': 1000000000000000000n,
        's': 1000000000000000000000n, 'S': 1000000000000000000000000n,
        'o': 1000000000000000000000000000n, 'n': 1000000000000000000000000000000n,
        'd': 1000000000000000000000000000000000n
    };
    const match = str.match(/^(\d+(?:\.\d+)?)([a-z]?)$/i);
    if (!match) return 0n;
    let value = parseFloat(match[1]);
    const suffix = match[2]?.toLowerCase();
    if (isNaN(value)) return 0n;
    if (suffix && SUFFIXES[suffix]) return toBigInt(Math.floor(value)) * SUFFIXES[suffix];
    return toBigInt(Math.floor(value));
}

async function generateTransferImage(senderName, receiverName, amount, icon, senderAvatarUrl, targetAvatarUrl) {
    const canvas = createCanvas(900, 500);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 900, 500);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 900, 500);

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 880, 480);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 22px 'Courier New'";
    ctx.fillText("HEDGEHOG BANK", 30, 55);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "#aaa";
    ctx.fillText("PREMIUM TRANSFER", 30, 75);

    ctx.fillStyle = "#d4af37";
    ctx.fillRect(780, 30, 50, 35);
    ctx.fillStyle = "#b8960c";
    ctx.fillRect(784, 34, 42, 27);

    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 24px 'Courier New'";
    ctx.fillText("TRANSFERT", 370, 55);

    async function drawAvatar(x, y, radius, avatarUrl) {
        try {
            const avatar = await loadImage(avatarUrl);
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, x - radius, y - radius, radius * 2, radius * 2);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = "#d4af37";
            ctx.lineWidth = 3;
            ctx.stroke();
        } catch (error) {
            ctx.fillStyle = "#fff";
            ctx.font = "bold 30px 'Courier New'";
            ctx.fillText("👤", x - 20, y + 10);
        }
    }

    await drawAvatar(180, 200, 65, senderAvatarUrl);
    await drawAvatar(720, 200, 65, targetAvatarUrl);

    const senderNameShort = senderName.length > 15 ? senderName.substring(0, 12) + "..." : senderName;
    const receiverNameShort = receiverName.length > 15 ? receiverName.substring(0, 12) + "..." : receiverName;

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText(senderNameShort.toUpperCase(), 180, 290);
    ctx.fillText(receiverNameShort.toUpperCase(), 720, 290);

    ctx.fillStyle = "#aaa";
    ctx.font = "11px 'Courier New'";
    ctx.fillText("EXPEDITEUR", 180, 310);
    ctx.fillText("DESTINATAIRE", 720, 310);
    ctx.textAlign = "left";

    ctx.beginPath();
    ctx.moveTo(280, 200);
    ctx.lineTo(620, 200);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(620, 200);
    ctx.lineTo(590, 180);
    ctx.lineTo(590, 220);
    ctx.closePath();
    ctx.fillStyle = "#d4af37";
    ctx.fill();

    ctx.fillStyle = "#88ff88";
    ctx.font = "bold 22px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText(`${amount} $`, 450, 260);
    ctx.textAlign = "left";

    ctx.font = "bold 36px 'Courier New'";
    ctx.fillStyle = "#d4af37";
    ctx.textAlign = "center";
    ctx.fillText(icon, 450, 340);
    ctx.textAlign = "left";

    ctx.fillStyle = "#00ff88";
    ctx.font = "bold 13px 'Courier New'";
    ctx.textAlign = "center";
    ctx.fillText("TRANSFERT REUSSI ✓", 450, 420);
    ctx.textAlign = "left";

    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()} - ${date.getHours()}:${date.getMinutes()}`;
    ctx.fillStyle = "#666";
    ctx.font = "10px 'Courier New'";
    ctx.fillText(dateStr, 720, 470);

    ctx.fillStyle = "#fff";
    ctx.font = "20px 'Courier New'";
    ctx.fillText("📡", 840, 450);

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "give",
        version: "4.0",
        author: "Ismael Soma",
        countDown: 5,
        role: 0,
        category: "economy"
    },

    onStart: async function ({ args, message, event, api }) {
        const { senderID, messageReply } = event;

        let targetID;
        let targetName;

        if (messageReply) {
            targetID = messageReply.senderID;
            const targetInfo = await getUserInfo(targetID, api);
            targetName = targetInfo.name;
        } else if (Object.keys(event.mentions).length > 0) {
            targetID = Object.keys(event.mentions)[0];
            const targetInfo = await getUserInfo(targetID, api);
            targetName = targetInfo.name;
        } else {
            return message.reply(formatStyledMessage([
                "❌ COMMENT DONNER ?",
                "━━━━━━━━━━━━━━━━",
                "📝 2 façons :",
                "",
                "💬 give @user 5000",
                "   → Mentionne la personne",
                "",
                "💬 give 5000 (en répondant)",
                "   → Réponds à son message",
                "━━━━━━━━━━━━━━━━",
                "📝 Exemples :",
                "1k = 1 000",
                "2.5k = 2 500",
                "1M = 1 000 000",
                "1B = 1 000 000 000",
                "1T = 1 000 000 000 000",
                "all = tout ton argent"
            ]));
        }

        if (targetID === senderID) {
            return message.reply(formatStyledMessage(["❌ Tu ne peux pas te donner à toi-même"]));
        }

        if (!args[0]) {
            return message.reply(formatStyledMessage(["❌ Montant manquant"]));
        }

        const senderMoney = await getUserCash(senderID);
        let amount;

        if (args[0].toLowerCase() === "all") {
            amount = senderMoney;
        } else {
            amount = await parseAmountWithSuffix(args[0]);
        }

        if (amount <= 0n) {
            return message.reply(formatStyledMessage(["❌ Montant invalide"]));
        }

        if (amount > senderMoney) {
            return message.reply(formatStyledMessage([
                "❌ Fonds insuffisants",
                "━━━━━━━━━━━━━━━━",
                `💰 Ton solde : ${await formatNumber(senderMoney)}$`,
                `🎁 Montant : ${await formatNumber(amount)}$`
            ]));
        }

        await updateUserCash(senderID, -amount);
        await updateUserCash(targetID, amount);

        const newSenderMoney = await getUserCash(senderID);
        const formattedAmount = await formatNumber(amount);

        const icons = ["🎁", "💝", "💸", "🤝", "🎉", "💎", "✨", "🌟"];
        const randomIcon = icons[Math.floor(Math.random() * icons.length)];

        const senderInfo = await getUserInfo(senderID, api);
        const targetInfo = await getUserInfo(targetID, api);
        const senderName = senderInfo.name;
        const targetRealName = targetInfo.name;

        let senderThumb, targetThumb;
        try {
            const si = await api.getUserInfo(senderID);
            senderThumb = si?.thumbSrc || si?.[senderID]?.thumbSrc || `https://graph.facebook.com/${senderID}/picture?width=200&height=200`;
        } catch (e) {
            senderThumb = `https://graph.facebook.com/${senderID}/picture?width=200&height=200`;
        }
        try {
            const ti = await api.getUserInfo(targetID);
            targetThumb = ti?.thumbSrc || ti?.[targetID]?.thumbSrc || `https://graph.facebook.com/${targetID}/picture?width=200&height=200`;
        } catch (e) {
            targetThumb = `https://graph.facebook.com/${targetID}/picture?width=200&height=200`;
        }

        await message.reply(formatStyledMessage([
            `${randomIcon} TRANSFERT RÉUSSI ${randomIcon}`,
            "━━━━━━━━━━━━━━━━",
            `💸 ${formattedAmount}$ → ${targetName}`,
            "━━━━━━━━━━━━━━━━",
            `💰 Nouveau solde : ${await formatNumber(newSenderMoney)}$`
        ]));

        try {
            const transferImage = await generateTransferImage(
                senderName,
                targetRealName,
                formattedAmount,
                randomIcon,
                senderThumb,
                targetThumb
            );
            const imgPath = `./transfer_${senderID}_${targetID}.png`;
            fs.writeFileSync(imgPath, transferImage);
            await message.reply({
                body: "💳 Reçu du transfert :",
                attachment: fs.createReadStream(imgPath)
            });
            fs.unlinkSync(imgPath);
        } catch (error) {
            console.error("Erreur generation image:", error);
        }
    }
};