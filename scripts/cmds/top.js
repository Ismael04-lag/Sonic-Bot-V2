const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const axios = require("axios");

const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";
const BANK_API_URL = "https://hedgehog-bank-api.vercel.app/api/bank";
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
        const response = await axios.get(`${CONVERT_API_URL}?number=${bigNum.toString()}`, { timeout: 5000 });
        if (response.data && response.data.success) return response.data.formatted;
    } catch (error) {}
    return formatBigInt(bigNum);
}

async function getAllUsersCash() {
    try {
        const response = await axios.get(`${CASH_API_URL}/top?limit=50`, { timeout: 10000 });
        if (response.data && response.data.success && Array.isArray(response.data.data)) {
            return response.data.data;
        }
    } catch (error) {
        console.error("Cash API Error:", error.message);
    }
    return [];
}

async function getAvatarUrl(uid, api) {
    try {
        const info = await api.getUserInfo(uid);
        return info[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    } catch(e) {
        return `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
    }
}

function formatStyledMessage(contentLines) {
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        msg += `│ ${line}\n`;
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

async function generateTopImage(users, page, totalPages, avatars) {
    const canvas = createCanvas(700, 600);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 700, 600);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 700, 600);

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 680, 580);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 24px 'Segoe UI', 'Arial'";
    ctx.fillText("🏆 CLASSEMENT DES RICHES 🏆", 200, 55);

    ctx.fillStyle = "#ffd700";
    ctx.font = "14px 'Segoe UI', 'Arial'";
    ctx.fillText(`Page ${page}/${totalPages}`, 580, 85);

    for (let i = 0; i < 3 && i < users.length; i++) {
        const user = users[i];
        const rank = (page - 1) * 10 + i + 1;
        const x = 30 + (i * 220);
        const y = 120;

        ctx.fillStyle = "#d4af37";
        ctx.font = "bold 18px 'Segoe UI', 'Arial'";
        ctx.fillText(`#${rank}`, x + 60, y + 30);

        if (avatars[user.userId]) {
            try {
                const avatar = await loadImage(avatars[user.userId]);
                ctx.save();
                ctx.beginPath();
                ctx.arc(x + 65, y + 85, 40, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, x + 25, y + 45, 80, 80);
                ctx.restore();
                ctx.beginPath();
                ctx.arc(x + 65, y + 85, 42, 0, Math.PI * 2);
                ctx.strokeStyle = rank === 1 ? "#ffd700" : (rank === 2 ? "#c0c0c0" : "#cd7f32");
                ctx.lineWidth = 3;
                ctx.stroke();
            } catch(e) {}
        }

        ctx.fillStyle = rank === 1 ? "#ffd700" : (rank === 2 ? "#c0c0c0" : "#cd7f32");
        ctx.font = "bold 14px 'Segoe UI', 'Arial'";
        const name = user.name.length > 18 ? user.name.substring(0, 15) + "..." : user.name;
        ctx.fillText(name, x + 20, y + 155);

        ctx.fillStyle = "#fff";
        ctx.font = "12px 'Segoe UI', 'Arial'";
        ctx.fillText(user.formattedCash, x + 20, y + 180);
    }

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px 'Segoe UI', 'Arial'";
    ctx.fillText("RANG", 30, 280);
    ctx.fillText("NOM", 100, 280);
    ctx.textAlign = "right";
    ctx.fillText("MONTANT", 660, 280);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(212, 175, 55, 0.3)";
    ctx.fillRect(20, 290, 660, 2);

    let y = 320;
    for (let i = 3; i < users.length; i++) {
        const user = users[i];
        const rank = (page - 1) * 10 + i + 1;

        if (rank % 2 === 0) {
            ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
            ctx.fillRect(20, y - 22, 660, 25);
        }

        ctx.fillStyle = "#fff";
        ctx.font = "13px 'Segoe UI', 'Arial'";
        ctx.fillText(`${rank}.`, 30, y);

        const name = user.name.length > 25 ? user.name.substring(0, 22) + "..." : user.name;
        ctx.fillText(name, 100, y);

        ctx.textAlign = "right";
        ctx.fillText(user.formattedCash, 660, y);
        ctx.textAlign = "left";

        y += 28;
        if (y > 560) break;
    }

    ctx.fillStyle = "#d4af37";
    ctx.font = "12px 'Segoe UI', 'Arial'";
    ctx.fillText("💰 Hedgehog Bank - Les plus riches", 220, 580);

    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px 'Segoe UI', 'Arial'";
    ctx.fillText(dateStr, 600, 580);

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "top",
        version: "3.0",
        author: "Ismael Soma",
        role: 0,
        shortDescription: { en: "Top richest users" },
        longDescription: { en: "Displays the top 50 richest users with avatars and real names" },
        category: "economy",
        guide: { en: "{pn} [page]" }
    },

    onStart: async function ({ api, args, message, event }) {
        const allUsers = await getAllUsersCash();

        if (allUsers.length === 0) {
            return message.reply(formatStyledMessage([
                "📊 CLASSEMENT INDISPONIBLE",
                "━━━━━━━━━━━━━━━━━━",
                "❌ L'API Cash est actuellement",
                "   indisponible ou vide.",
                "",
                "💡 Utilisez `bank deposit` pour",
                "   commencer à gagner de l'argent !",
                "",
                "🔄 Réessaie plus tard."
            ]));
        }

        let page = args[0] ? parseInt(args[0]) : 1;
        const usersPerPage = 10;
        const totalPages = Math.ceil(Math.min(allUsers.length, 50) / usersPerPage);

        if (page < 1 || page > totalPages) {
            return message.reply(formatStyledMessage([`❌ Page invalide. Il y a ${totalPages} pages disponibles.`]));
        }

        const startIndex = (page - 1) * usersPerPage;
        const endIndex = startIndex + usersPerPage;
        const usersOnPage = allUsers.slice(startIndex, endIndex);

        const avatars = {};
        const enrichedUsers = [];

        for (const user of usersOnPage) {
            try {
                let name = `User_${String(user.userId).slice(-5)}`;
                try {
                    const userInfo = await api.getUserInfo(user.userId);
                    if (userInfo && userInfo[user.userId] && userInfo[user.userId].name) {
                        const realName = userInfo[user.userId].name;
                        if (realName && realName !== "Facebook User" && realName !== "Utilisateur") {
                            name = realName;
                        }
                    }
                } catch (nameErr) {}

                if (!avatars[user.userId]) {
                    avatars[user.userId] = await getAvatarUrl(user.userId, api);
                }

                const cashAmount = toBigInt(user.cash || 0);
                const formattedCash = await formatNumber(cashAmount);
                enrichedUsers.push({
                    ...user,
                    name: name,
                    formattedCash
                });
            } catch (error) {
                console.error(`Erreur pour ${user.userId}:`, error.message);
                const cashAmount = toBigInt(user.cash || 0);
                enrichedUsers.push({
                    ...user,
                    name: `User_${String(user.userId).slice(-5)}`,
                    formattedCash: await formatNumber(cashAmount)
                });
            }
        }

        let textMsg = `🏆 TOP 50 - LES PLUS RICHES\n━━━━━━━━━━━━━━━━━━\n`;
        for (let i = 0; i < enrichedUsers.length; i++) {
            const user = enrichedUsers[i];
            const rank = startIndex + i + 1;
            const prefix = rank === 1 ? "🥇" : (rank === 2 ? "🥈" : (rank === 3 ? "🥉" : "▸"));
            textMsg += `${prefix} ${rank}. ${user.name}: ${user.formattedCash}\n`;
        }
        textMsg += `━━━━━━━━━━━━━━━━━━\n📜 Page ${page}/${totalPages}`;

        await message.reply(textMsg);

        try {
            const img = await generateTopImage(enrichedUsers, page, totalPages, avatars);
            const imgPath = path.join(__dirname, `top_${Date.now()}.png`);
            fs.writeFileSync(imgPath, img);
            await message.reply({
                body: "💳 Classement officiel :",
                attachment: fs.createReadStream(imgPath)
            });
            fs.unlinkSync(imgPath);
        } catch (error) {
            console.error("Erreur génération image:", error);
        }
    }
};