const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
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
        const response = await axios.get(`${CONVERT_API_URL}?number=${bigNum.toString()}`, { timeout: 5000 });
        if (response.data && response.data.success && response.data.formatted) {
            return response.data.formatted;
        }
    } catch (error) {
        console.error("Convert API Error:", error.message);
    }
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
        
        try {
            const demoPath = path.join(__dirname, "top_demo.json");
            if (fs.existsSync(demoPath)) {
                const demoData = JSON.parse(fs.readFileSync(demoPath, "utf8"));
                return demoData;
            }
        } catch (e) {}
    }
    return [];
}

async function generateTopImage(users, page, totalPages) {
    const canvas = createCanvas(600, 500);
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 600, 500);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 500);

    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 480);

    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 24px 'Segoe UI', 'Arial'";
    ctx.fillText("🏆 CLASSEMENT DES RICHES 🏆", 150, 55);

    ctx.fillStyle = "#ffd700";
    ctx.font = "14px 'Segoe UI', 'Arial'";
    ctx.fillText(`Page ${page}/${totalPages}`, 480, 85);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px 'Segoe UI', 'Arial'";
    ctx.fillText("RANG", 30, 120);
    ctx.fillText("NOM", 100, 120);
    ctx.textAlign = "right";
    ctx.fillText("MONTANT", 560, 120);
    ctx.textAlign = "left";

    ctx.fillStyle = "rgba(212, 175, 55, 0.3)";
    ctx.fillRect(20, 130, 560, 2);

    let y = 155;
    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const rank = (page - 1) * 10 + i + 1;
        const name = user.name || `User_${String(user.userId).slice(-5)}`;
        const cash = user.formattedCash;

        if (rank === 1) ctx.fillStyle = "#ffd700";
        else if (rank === 2) ctx.fillStyle = "#c0c0c0";
        else if (rank === 3) ctx.fillStyle = "#cd7f32";
        else ctx.fillStyle = "#fff";

        ctx.font = "bold 14px 'Segoe UI', 'Arial'";
        ctx.fillText(`${rank}.`, 30, y);

        const displayName = name.length > 28 ? name.substring(0, 25) + "..." : name;
        ctx.fillText(displayName, 100, y);

        ctx.textAlign = "right";
        ctx.fillText(cash, 560, y);
        ctx.textAlign = "left";

        y += 30;
        if (y > 450) break;
    }

    ctx.fillStyle = "#d4af37";
    ctx.font = "12px 'Segoe UI', 'Arial'";
    ctx.fillText("💰 Hedgehog Bank - Les plus riches", 180, 480);

    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "10px 'Segoe UI', 'Arial'";
    ctx.fillText(dateStr, 500, 480);

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
        name: "top",
        version: "2.1",
        author: "Ismael Soma",
        role: 0,
        shortDescription: { en: "Top 50 richest users" },
        longDescription: { en: "Displays the top 50 richest users with real names and image" },
        category: "economy",
        guide: { en: "{pn} [page]" }
    },

    onStart: async function ({ api, args, message, event }) {
        const allUsers = await getAllUsersCash();

        if (allUsers.length === 0) {
            return message.reply(formatStyledMessage([
                "📊 CLASSEMENT INDISPONIBLE",
                "━━━━━━━━━━━━━━━━━",
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

        await message.reply(formatStyledMessage(textMsg.split('\n')));

        try {
            const img = await generateTopImage(enrichedUsers, page, totalPages);
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