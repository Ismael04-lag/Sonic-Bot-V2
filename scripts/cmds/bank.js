const fs = require("fs");
const { createCanvas, loadImage } = require("canvas");
const path = require("path");
const axios = require("axios");

const API_URL = "https://hedgehog-bank-api.vercel.app/api/bank";
const CONVERT_API_URL = "https://numbers-conversion.vercel.app/api/parse";
const CASH_API_URL = "https://cash-api-five.vercel.app/api/cash";

const pendingTimeouts = new Map();
let pendingTransactions = new Map();

const PENDING_FILE = path.join(__dirname, "pending_transactions.json");
if (fs.existsSync(PENDING_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(PENDING_FILE, "utf8"));
        pendingTransactions = new Map(Object.entries(data));
    } catch (e) {}
}

function savePendingTransactions() {
    try {
        const obj = Object.fromEntries(pendingTransactions);
        fs.writeFileSync(PENDING_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {}
}

const VIP_FILE = path.join(__dirname, "vips.json");
let vipList = [];
if (fs.existsSync(VIP_FILE)) {
    try {
        vipList = JSON.parse(fs.readFileSync(VIP_FILE, "utf8"));
    } catch (e) {}
}
function saveVIPs() {
    fs.writeFileSync(VIP_FILE, JSON.stringify(vipList, null, 2));
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

function getDisplayWidth(text) {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
        const code = text.charCodeAt(i);
        if (code >= 0x1D400 && code <= 0x1D7FF) {
            width += 2;
        } else {
            width += 1;
        }
    }
    return width;
}

function wrapText(text, maxWidth = 42) {
    const lines = [];
    let currentLine = "";
    let currentWidth = 0;
    const words = text.split(' ');

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordWidth = getDisplayWidth(word);
        const separatorWidth = currentLine === "" ? 0 : 1;
        const totalWidth = currentWidth + separatorWidth + wordWidth;

        if (totalWidth <= maxWidth) {
            if (currentLine === "") {
                currentLine = word;
                currentWidth = wordWidth;
            } else {
                currentLine += " " + word;
                currentWidth += 1 + wordWidth;
            }
        } else {
            if (currentLine) lines.push(currentLine);
            currentLine = word;
            currentWidth = wordWidth;
        }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
}

function formatStyledMessage(contentLines, maxWidth = 42) {
    let msg = `╭─────────────•┈┈\n`;
    for (let line of contentLines) {
        const wrapped = wrapText(line, maxWidth);
        for (const w of wrapped) {
            msg += `│ ${w}\n`;
        }
    }
    msg += `╰─────────────•┈┈`;
    return msg;
}

async function generateRealisticBankCard(title, balance, messageText, username, cvv = null, cardData = null, avatarUrl = null) {
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
    ctx.fillText("PREMIUM BANKING", 25, 62);

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
    ctx.fillText("CHIP", 48, 112);
    for (let i = 0; i < 6; i++) {
        ctx.fillStyle = i % 2 === 0 ? "#d4af37" : "#b8960c";
        ctx.fillRect(30 + i * 8, 118, 3, 5);
    }

    ctx.fillStyle = "#e0e0e0";
    ctx.font = "bold 20px 'Courier New'";
    let cardNumber = cardData?.cardNumber || "4532 **** **** 5772";
    const cardNumbers = cardNumber.split(" ");
    let formattedNumber = "";
    for (let i = 0; i < cardNumbers.length; i++) {
        if (cardNumbers[i] === "****") {
            formattedNumber += "****";
        } else {
            formattedNumber += cardNumbers[i];
        }
        if (i < cardNumbers.length - 1) formattedNumber += " ";
    }
    ctx.fillText(formattedNumber, 25, 160);

    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("VALID", 25, 188);
    ctx.fillText("THRU", 25, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 13px 'Courier New'";
    const expiry = cardData?.cardExpiry || "12/28";
    ctx.fillText(expiry, 25, 218);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px 'Courier New'";
    const cardHolderName = username.toUpperCase().substring(0, 22);
    ctx.fillText(cardHolderName, 25, 260);

    ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
    ctx.fillRect(width - 150, height - 75, 135, 55);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 26px 'Courier New'";
    ctx.fillText(balance, width - 145, height - 35);

    ctx.fillStyle = "#88ff88";
    ctx.font = "11px 'Courier New'";
    const msgLines = messageText.split('\n');
    let msgY = height - 70;
    for (let i = 0; i < Math.min(msgLines.length, 2); i++) {
        ctx.fillStyle = i === 0 ? "#88ff88" : "#aaa";
        ctx.fillText(msgLines[i], width - 145, msgY);
        msgY += 18;
    }

    if (cvv) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
        ctx.font = "9px 'Courier New'";
        ctx.fillText("CVV", width - 55, 115);
        ctx.fillStyle = "#d4af37";
        ctx.font = "bold 14px 'Courier New'";
        ctx.fillText(cvv.toString(), width - 55, 133);
    }

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, height - 22, width, 22);
    ctx.fillStyle = "rgba(212, 175, 55, 0.5)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText("HEDGEHOG BANK • PREMIUM • SINCE 2025", width / 2 - 145, height - 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText(title, width - 85, height - 8);

    return canvas.toBuffer();
}

async function generateLotteryCard(username, ticketPrice, win, winAmount, numbers, drawnNumbers, matchCount) {
    const canvas = createCanvas(600, 420);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 600, 420);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 420);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 400);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText("HEDGEHOG LOTTERY", 30, 55);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "#aaa";
    ctx.fillText("LUCKY DRAW", 30, 75);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(480, 35, 45, 30);
    ctx.fillStyle = "#b8960c";
    ctx.fillRect(484, 39, 37, 22);
    const cardHolder = username.toUpperCase().substring(0, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Courier New'";
    ctx.fillText(cardHolder, 30, 110);
    ctx.fillStyle = "#aaa";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("PLAYER", 30, 125);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("NUMEROS TIRES", 380, 110);
    ctx.fillStyle = "#fff";
    ctx.font = "24px 'Courier New'";
    ctx.fillText(numbers.join(" - "), 380, 150);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("RESULTAT", 380, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "24px 'Courier New'";
    ctx.fillText(drawnNumbers.join(" - "), 380, 240);
    ctx.fillStyle = "#88ff88";
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillText(`CORRESPONDANCES: ${matchCount}`, 380, 290);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px 'Courier New'";
    ctx.fillText(`${await formatNumber(bankData?.bank || 0n)}$`, 30, 315);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px 'Courier New'";
    ctx.fillText("NEW BALANCE", 30, 340);
    if (win) {
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 16px 'Courier New'";
        ctx.fillText(`GAIN: +${await formatNumber(winAmount)}$`, 380, 340);
    } else {
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 16px 'Courier New'";
        ctx.fillText(`PERTE: -${await formatNumber(ticketPrice)}$`, 380, 340);
    }
    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    ctx.fillStyle = "#666";
    ctx.font = "9px 'Courier New'";
    ctx.fillText(dateStr, 30, 395);
    return canvas.toBuffer();
}

async function generateParrainCard(username, code, count, gains, type) {
    const canvas = createCanvas(600, 420);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 600, 420);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 420);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 400);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText("HEDGEHOG PARRAINAGE", 30, 55);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "#aaa";
    ctx.fillText("REFERRAL", 30, 75);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(480, 35, 45, 30);
    ctx.fillStyle = "#b8960c";
    ctx.fillRect(484, 39, 37, 22);
    const cardHolder = username.toUpperCase().substring(0, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Courier New'";
    ctx.fillText(cardHolder, 30, 110);
    ctx.fillStyle = "#aaa";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("PLAYER", 30, 125);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 18px 'Courier New'";
    if (type === "create") {
        ctx.fillText("CODE CREE", 380, 110);
        ctx.fillStyle = "#fff";
        ctx.font = "24px 'Courier New'";
        ctx.fillText(code, 380, 160);
        ctx.fillStyle = "#88ff88";
        ctx.font = "14px 'Courier New'";
        ctx.fillText("Partagez ce code !", 380, 210);
    } else if (type === "stats") {
        ctx.fillText("STATISTIQUES", 380, 110);
        ctx.fillStyle = "#fff";
        ctx.font = "16px 'Courier New'";
        ctx.fillText(`Code: ${code}`, 380, 160);
        ctx.fillText(`Parraines: ${count}`, 380, 190);
        ctx.fillText(`Gains: ${await formatNumber(gains)}$`, 380, 220);
    } else if (type === "use") {
        ctx.fillText("CODE UTILISE", 380, 110);
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'Courier New'";
        ctx.fillText(code, 380, 160);
        ctx.fillStyle = "#88ff88";
        ctx.font = "14px 'Courier New'";
        ctx.fillText(`Bonus: +10000$`, 380, 210);
    }
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px 'Courier New'";
    ctx.fillText(`${await formatNumber(bankData?.bank || 0n)}$`, 30, 315);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px 'Courier New'";
    ctx.fillText("NEW BALANCE", 30, 340);
    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    ctx.fillStyle = "#666";
    ctx.font = "9px 'Courier New'";
    ctx.fillText(dateStr, 30, 395);
    return canvas.toBuffer();
}

async function generateGambleCard(username, amount, win, winAmount, choice, result) {
    const canvas = createCanvas(600, 420);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 600, 420);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 420);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 400);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText("HEDGEHOG CASINO", 30, 55);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "#aaa";
    ctx.fillText("PILE OU FACE", 30, 75);
    ctx.fillStyle = "#d4af37";
    ctx.fillRect(480, 35, 45, 30);
    ctx.fillStyle = "#b8960c";
    ctx.fillRect(484, 39, 37, 22);
    const cardHolder = username.toUpperCase().substring(0, 18);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px 'Courier New'";
    ctx.fillText(cardHolder, 30, 110);
    ctx.fillStyle = "#aaa";
    ctx.font = "9px 'Courier New'";
    ctx.fillText("JOUEUR", 30, 125);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("VOTRE CHOIX", 380, 110);
    ctx.fillStyle = "#fff";
    ctx.font = "24px 'Courier New'";
    ctx.fillText(choice === "pile" ? "🪙 PILE" : "🪙 FACE", 380, 150);
    ctx.fillStyle = "#ffd700";
    ctx.font = "bold 18px 'Courier New'";
    ctx.fillText("RESULTAT", 380, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "24px 'Courier New'";
    ctx.fillText(result === "pile" ? "🪙 PILE" : "🪙 FACE", 380, 240);
    ctx.fillStyle = "#88ff88";
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillText(win ? "🎉 GAGNE !" : "💀 PERDU !", 380, 290);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px 'Courier New'";
    ctx.fillText(`${await formatNumber(bankData?.bank || 0n)}$`, 30, 315);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px 'Courier New'";
    ctx.fillText("NEW BALANCE", 30, 340);
    if (win) {
        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 16px 'Courier New'";
        ctx.fillText(`GAIN: +${await formatNumber(winAmount)}$`, 380, 340);
    } else {
        ctx.fillStyle = "#ff4444";
        ctx.font = "bold 16px 'Courier New'";
        ctx.fillText(`PERTE: -${await formatNumber(amount)}$`, 380, 340);
    }
    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    ctx.fillStyle = "#666";
    ctx.font = "9px 'Courier New'";
    ctx.fillText(dateStr, 30, 395);
    return canvas.toBuffer();
}

async function generateTransferCard(username, targetName, amount, newBalance) {
    const canvas = createCanvas(600, 420);
    const ctx = canvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 600, 420);
    gradient.addColorStop(0, "#1a1a2e");
    gradient.addColorStop(0.5, "#16213e");
    gradient.addColorStop(1, "#0f3460");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 600, 420);
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 580, 400);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 20px 'Courier New'";
    ctx.fillText("HEDGEHOG BANK", 30, 55);
    ctx.font = "10px 'Courier New'";
    ctx.fillStyle = "#aaa";
    ctx.fillText("TRANSFERT", 30, 75);
    ctx.fillStyle = "#e0e0e0";
    ctx.font = "22px 'Courier New'";
    ctx.fillText("**** **** **** 4532", 30, 165);
    ctx.font = "12px 'Courier New'";
    ctx.fillStyle = "#ccc";
    ctx.fillText("VALID THRU", 30, 200);
    ctx.fillStyle = "#fff";
    ctx.font = "14px 'Courier New'";
    ctx.fillText("12/28", 120, 200);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 16px 'Courier New'";
    ctx.fillText("TRANSFER", 380, 210);
    const cardHolder = username.toUpperCase().substring(0, 20);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 14px 'Courier New'";
    ctx.fillText(cardHolder, 30, 250);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px 'Courier New'";
    ctx.fillText("EXPEDITEUR", 30, 265);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 28px 'Courier New'";
    ctx.fillText(`${await formatNumber(newBalance)}$`, 30, 315);
    ctx.fillStyle = "#aaa";
    ctx.font = "10px 'Courier New'";
    ctx.fillText("NOUVEAU SOLDE", 30, 335);
    ctx.fillStyle = "#88ff88";
    ctx.font = "12px 'Courier New'";
    ctx.fillText(`Destinataire: ${targetName}`, 350, 300);
    ctx.fillText(`Montant: -${await formatNumber(amount)}$`, 350, 320);
    const date = new Date();
    const dateStr = `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
    ctx.fillStyle = "#666";
    ctx.font = "9px 'Courier New'";
    ctx.fillText(dateStr, 30, 395);
    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "bank",
        description: "Gestion bancaire complète",
        guide: { en: "bank deposit|withdraw|balance|interest|transfer|gamble|top|card|lottery|parrainage|image|history|rob|vip" },
        category: "economy",
        countDown: 1,
        role: 0,
        author: "Itachi Soma"
    },

    onStart: async function ({ args, message, event, api }) {
        const { getPrefix } = global.utils;
        const p = getPrefix(event.threadID);
        const user = String(event.senderID);
        const info = await api.getUserInfo(user);
        const username = info[user]?.name || "Utilisateur";
        let imageMode = true;
        let bankData = null;
        let userCardData = null;

        async function apiCall(endpoint, method = "GET", body = null) {
            try {
                const options = { method, headers: { "Content-Type": "application/json" } };
                if (body) options.body = JSON.stringify(body);
                const response = await fetch(`${API_URL}${endpoint}`, options);
                return await response.json();
            } catch (error) {
                console.error("API Error:", error);
                return { success: false, error: error.message };
            }
        }

        async function getUserBankData(userId) {
            const result = await apiCall(`/${userId}`);
            if (result.success) return result.data;
            return null;
        }

        async function createUserCard(userId) {
            return await apiCall(`/${userId}/card`, "POST");
        }

        async function updateUserBankData(userId, amount, cvv, type) {
            if (type === "deposit") return await apiCall(`/${userId}/deposit`, "POST", { amount, cvv });
            if (type === "withdraw") return await apiCall(`/${userId}/withdraw`, "POST", { amount, cvv });
            return null;
        }

        async function getInterest(userId) {
            return await apiCall(`/${userId}/interest`, "POST");
        }

        async function getTopUsers() {
            return await apiCall(`/top`);
        }

        async function playLottery(userId, ticketPrice) {
            return await apiCall(`/${userId}/lottery`, "POST", { ticketPrice });
        }

        async function createParrainCode(userId) {
            return await apiCall(`/${userId}/parrain/create`, "POST");
        }

        async function useParrainCode(userId, code) {
            return await apiCall(`/${userId}/parrain/use`, "POST", { code });
        }

        async function gambleApi(userId, amount, choice) {
            return await apiCall(`/${userId}/gamble`, "POST", { amount, choice });
        }

        async function transferApi(userId, targetId, amount, cvv) {
            return await apiCall(`/${userId}/transfer`, "POST", { targetId, amount, cvv });
        }

        async function getTransactions(userId, limit = 10) {
            return await apiCall(`/${userId}/transactions?limit=${limit}`);
        }

        function clearPendingTransaction(userId) {
            if (pendingTimeouts.has(userId)) {
                clearTimeout(pendingTimeouts.get(userId));
                pendingTimeouts.delete(userId);
            }
            pendingTransactions.delete(userId);
            savePendingTransactions();
        }

        bankData = await getUserBankData(user);
        if (!bankData) bankData = { bank: 0n, lastInterestClaimed: Date.now(), card: null };
        if (bankData.imageMode !== undefined) imageMode = bankData.imageMode;

        const command = args[0]?.toLowerCase();

        async function parseAmountWithSuffix(input) {
            if (!input) return 0n;
            try {
                const response = await fetch(`${CONVERT_API_URL}?input=${encodeURIComponent(input)}`);
                const data = await response.json();
                if (data.success && data.result) return toBigInt(data.result);
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

        async function formatNumberAsync(num) {
            return formatNumber(num);
        }

        async function getUserDisplayName(uid) {
            try { const u = await api.getUserInfo(uid); return u[uid]?.name || uid; } catch(e) { return uid; }
        }

        async function getUserAvatar(uid) {
            try {
                const info = await api.getUserInfo(uid);
                return info[uid]?.thumbSrc || `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
            } catch(e) {
                return `https://graph.facebook.com/${uid}/picture?width=200&height=200`;
            }
        }

        if (command === "vip") {
            const sub = args[1]?.toLowerCase();
            if (!sub || sub === "help") {
                const helpLines = [
                    "👑 VIP MANAGEMENT",
                    `✰ ${p}bank vip -a <uid> → Ajouter un VIP`,
                    `✰ ${p}bank vip -r <uid> → Retirer un VIP`,
                    `✰ ${p}bank vip list → Liste des VIP`,
                    "⚠️ Seul l'ID 61589149033077 peut modifier."
                ];
                return message.reply(formatStyledMessage(helpLines));
            }
            const adminVip = "61589149033077";
            if (user !== adminVip) {
                return message.reply(formatStyledMessage(["❌ Vous n'êtes pas autorisé à gérer les VIP."]));
            }
            if (sub === "-a") {
                const targetUid = args[2];
                if (!targetUid) return message.reply(formatStyledMessage(["❌ UID manquant."]));
                const targetName = await getUserDisplayName(targetUid);
                if (!vipList.includes(targetUid)) {
                    vipList.push(targetUid);
                    saveVIPs();
                    return message.reply(formatStyledMessage([`✅ ${targetName} (${targetUid}) a été ajouté à la liste VIP.`]));
                } else {
                    return message.reply(formatStyledMessage([`⚠️ ${targetName} (${targetUid}) est déjà VIP.`]));
                }
            } else if (sub === "-r") {
                const targetUid = args[2];
                if (!targetUid) return message.reply(formatStyledMessage(["❌ UID manquant."]));
                const targetName = await getUserDisplayName(targetUid);
                const idx = vipList.indexOf(targetUid);
                if (idx !== -1) {
                    vipList.splice(idx, 1);
                    saveVIPs();
                    return message.reply(formatStyledMessage([`✅ ${targetName} (${targetUid}) a été retiré de la liste VIP.`]));
                } else {
                    return message.reply(formatStyledMessage([`⚠️ ${targetName} (${targetUid}) n'est pas VIP.`]));
                }
            } else if (sub === "list") {
                if (vipList.length === 0) return message.reply(formatStyledMessage(["📋 Aucun VIP pour l'instant."]));
                let lines = ["👑 LISTE DES VIP"];
                for (let i = 0; i < vipList.length; i++) {
                    const name = await getUserDisplayName(vipList[i]);
                    lines.push(`${i+1}. ${name} (${vipList[i]})`);
                }
                return message.reply(formatStyledMessage(lines));
            }
        }

        if (command === "rob") {
            if (!vipList.includes(user)) {
                return message.reply(formatStyledMessage(["❌ Seuls les VIP peuvent utiliser la commande `bank rob`."]));
            }
            let targetUid;
            if (Object.keys(event.mentions).length > 0) targetUid = Object.keys(event.mentions)[0];
            else targetUid = args[1];
            if (!targetUid) return message.reply(formatStyledMessage(["❌ Mentionnez ou entrez l'UID de la cible."]));
            if (targetUid === user) return message.reply(formatStyledMessage(["❌ Vous ne pouvez pas vous voler vous-même."]));
            const targetBank = await getUserBankData(targetUid);
            if (!targetBank || targetBank.bank <= 0) return message.reply(formatStyledMessage(["❌ Cette personne n'a pas d'argent en banque."]));
            let robAmount = await parseAmountWithSuffix(args[2]);
            if (robAmount <= 0n) {
                const rand = Number(targetBank.bank) * (Math.random() * 0.2 + 0.1);
                robAmount = toBigInt(Math.floor(rand));
                if (robAmount <= 0n) robAmount = 1n;
            }
            if (robAmount > targetBank.bank) robAmount = targetBank.bank;
            const success = Math.random() < 0.5;
            if (!success) {
                return message.reply(formatStyledMessage([`💀 Échec du vol ! Vous avez tenté de voler ${await formatNumber(robAmount)}$ mais vous vous êtes fait prendre.`]));
            }
            const transferResult = await transferApi(user, targetUid, Number(robAmount), bankData.card?.cardCvv);
            if (transferResult && transferResult.success) {
                bankData = await getUserBankData(user);
                const successMsg = [
                    `🦹‍♂️ Vol réussi !`,
                    `💸 Vous avez volé ${await formatNumber(robAmount)}$ à ${targetUid}.`,
                    `💰 Nouveau solde : ${await formatNumber(bankData.bank)}$`
                ];
                if (imageMode !== false) {
                    const avatarUrl = await getUserAvatar(user);
                    const img = await generateRealisticBankCard("ROB", `${await formatNumber(bankData.bank)}$`, `+ ${await formatNumber(robAmount)}$ (vol)`, username, bankData.card?.cardCvv, bankData.card, avatarUrl);
                    const imgPath = `./bank_rob_${user}.png`;
                    fs.writeFileSync(imgPath, img);
                    await message.reply({ body: formatStyledMessage(successMsg), attachment: fs.createReadStream(imgPath) });
                    fs.unlinkSync(imgPath);
                } else await message.reply(formatStyledMessage(successMsg));
            } else return message.reply(formatStyledMessage(["❌ Le vol a échoué à cause d'une erreur technique."]));
            return;
        }

        if (command === "history") {
            const limit = parseInt(args[1]) || 10;
            const histResult = await getTransactions(user, limit);
            if (histResult.success && histResult.data.length > 0) {
                let lines = ["📜 HISTORIQUE DES TRANSACTIONS"];
                for (const tx of histResult.data.slice(0, limit)) {
                    const date = new Date(tx.date).toLocaleString();
                    let amountStr = tx.amount >= 0 ? `+${await formatNumber(tx.amount)}$` : `${await formatNumber(tx.amount)}$`;
                    let rawLine = `📌 ${tx.type} : ${amountStr} (${date})`;
                    const wrappedLines = wrapText(rawLine, 42);
                    for (const wl of wrappedLines) {
                        lines.push(wl);
                    }
                }
                return message.reply(formatStyledMessage(lines));
            } else return message.reply(formatStyledMessage(["📭 Aucune transaction trouvée."]));
        }

        const pending = pendingTransactions.get(user);
        if (pending && !isNaN(parseInt(command))) {
            const userCvv = parseInt(command);
            if (!isNaN(userCvv)) {
                clearPendingTransaction(user);
                const cardCvv = bankData.card?.cardCvv;
                if (userCvv !== cardCvv) return message.reply(formatStyledMessage(["❌ CVV incorrect !"]));
                const amount = pending.amount;
                const type = pending.type;
                if (type === "deposit") {
                    const currentUserMoney = await getUserCash(event.senderID);
                    if (amount > currentUserMoney) return message.reply(formatStyledMessage(["❌ Solde cash insuffisant."]));
                    const depositResult = await updateUserBankData(user, Number(amount), userCvv, "deposit");
                    if (depositResult?.success) {
                        bankData = await getUserBankData(user);
                        await updateUserCash(event.senderID, -amount);
                        const txt = `✅ Dépôt de ${await formatNumber(amount)}$ effectué ! Nouveau solde: ${await formatNumber(bankData.bank)}$`;
                        if (imageMode !== false) {
                            const avatarUrl = await getUserAvatar(user);
                            const img = await generateRealisticBankCard("DEPOSIT", `${await formatNumber(bankData.bank)}$`, `+ ${await formatNumber(amount)}$`, username, bankData.card?.cardCvv, bankData.card, avatarUrl);
                            const imgPath = `./bank_deposit_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage(["❌ Erreur dépôt."]));
                } else if (type === "withdraw") {
                    const currentBalance = bankData.bank || 0n;
                    if (amount > currentBalance) return message.reply(formatStyledMessage(["❌ Solde bancaire insuffisant."]));
                    const withdrawResult = await updateUserBankData(user, Number(amount), userCvv, "withdraw");
                    if (withdrawResult?.success) {
                        bankData = await getUserBankData(user);
                        await updateUserCash(event.senderID, amount);
                        const txt = `💸 Retrait de ${await formatNumber(amount)}$ effectué ! Nouveau solde: ${await formatNumber(bankData.bank)}$`;
                        if (imageMode !== false) {
                            const avatarUrl = await getUserAvatar(user);
                            const img = await generateRealisticBankCard("WITHDRAW", `${await formatNumber(bankData.bank)}$`, `- ${await formatNumber(amount)}$`, username, bankData.card?.cardCvv, bankData.card, avatarUrl);
                            const imgPath = `./bank_withdraw_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage(["❌ Erreur retrait."]));
                } else if (type === "transfer") {
                    const currentBalance = bankData.bank || 0n;
                    if (amount > currentBalance) return message.reply(formatStyledMessage(["❌ Solde bancaire insuffisant."]));
                    const transferResult = await transferApi(user, pending.targetId, Number(amount), userCvv);
                    if (transferResult?.success) {
                        bankData = await getUserBankData(user);
                        const txt = `💸 Transfert de ${await formatNumber(amount)}$ vers ${pending.targetName} réussi ! Nouveau solde: ${await formatNumber(bankData.bank)}$`;
                        if (imageMode !== false) {
                            const img = await generateTransferCard(username, pending.targetName, amount, bankData.bank);
                            const imgPath = `./bank_transfer_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage(["❌ Erreur transfert."]));
                }
                return;
            }
        }

        switch (command) {
            case "deposit":
                const depositAmount = await parseAmountWithSuffix(args[1]);
                if (depositAmount <= 0n) return message.reply(formatStyledMessage(["❌ Montant invalide.", `   Utilisation: ${p}bank deposit <montant>`]));
                if (!bankData.card?.cardCreated) return message.reply(formatStyledMessage([`❌ Créez d'abord une carte avec ${p}bank card`]));
                clearPendingTransaction(user);
                pendingTransactions.set(user, { amount: depositAmount, type: "deposit" });
                savePendingTransactions();
                const to1 = setTimeout(() => { if (pendingTransactions.has(user)) { pendingTransactions.delete(user); savePendingTransactions(); message.reply(formatStyledMessage(["⏰ Transaction expirée."])); } pendingTimeouts.delete(user); }, 15000);
                pendingTimeouts.set(user, to1);
                return message.reply(formatStyledMessage([`💳 Transaction de ${await formatNumber(depositAmount)}$`, `🔐 Entrez votre CVV (ex: bank 123) [15s]`]));

            case "withdraw":
                const withdrawAmount = await parseAmountWithSuffix(args[1]);
                if (withdrawAmount <= 0n) return message.reply(formatStyledMessage(["❌ Montant invalide.", `   Utilisation: ${p}bank withdraw <montant>`]));
                if (!bankData.card?.cardCreated) return message.reply(formatStyledMessage([`❌ Créez d'abord une carte.`]));
                if ((bankData.bank || 0n) < withdrawAmount) return message.reply(formatStyledMessage(["❌ Solde bancaire insuffisant."]));
                clearPendingTransaction(user);
                pendingTransactions.set(user, { amount: withdrawAmount, type: "withdraw" });
                savePendingTransactions();
                const to2 = setTimeout(() => { if (pendingTransactions.has(user)) { pendingTransactions.delete(user); savePendingTransactions(); message.reply(formatStyledMessage(["⏰ Transaction expirée."])); } pendingTimeouts.delete(user); }, 15000);
                pendingTimeouts.set(user, to2);
                return message.reply(formatStyledMessage([`💳 Transaction de ${await formatNumber(withdrawAmount)}$`, `🔐 Entrez votre CVV (ex: bank 123) [15s]`]));

            case "balance":
            case "show": {
                const bal = bankData.bank || 0n;
                const txt = `💰 Solde bancaire : ${await formatNumber(bal)}$`;
                if (imageMode !== false) {
                    const avatarUrl = await getUserAvatar(user);
                    const img = await generateRealisticBankCard("BALANCE", `${await formatNumber(bal)}$`, "Disponible", username, bankData.card?.cardCvv, bankData.card, avatarUrl);
                    const imgPath = `./bank_balance_${user}.png`;
                    fs.writeFileSync(imgPath, img);
                    await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                    fs.unlinkSync(imgPath);
                } else await message.reply(formatStyledMessage([txt]));
                break;
            }

            case "interest": {
                if ((bankData.bank || 0n) <= 0n) return message.reply(formatStyledMessage(["❌ Pas d'argent en banque."]));
                const interestRes = await getInterest(user);
                if (interestRes.success) {
                    bankData = await getUserBankData(user);
                    const earned = toBigInt(interestRes.interestEarned);
                    const txt = `📈 Intérêts crédités : ${await formatNumber(earned)}$\n💰 Nouveau solde : ${await formatNumber(bankData.bank)}$`;
                    const lines = txt.split('\n');
                    if (imageMode !== false) {
                        const avatarUrl = await getUserAvatar(user);
                        const img = await generateRealisticBankCard("INTEREST", `${await formatNumber(bankData.bank)}$`, `+ ${await formatNumber(earned)}$`, username, bankData.card?.cardCvv, bankData.card, avatarUrl);
                        const imgPath = `./bank_interest_${user}.png`;
                        fs.writeFileSync(imgPath, img);
                        await message.reply({ body: formatStyledMessage(lines), attachment: fs.createReadStream(imgPath) });
                        fs.unlinkSync(imgPath);
                    } else await message.reply(formatStyledMessage(lines));
                } else return message.reply(formatStyledMessage([`❌ ${interestRes.error}`]));
                break;
            }

            case "top":
            case "richest": {
                try {
                    const topRes = await getTopUsers();
                    
                    if (topRes.success && topRes.data && topRes.data.length > 0) {
                        let lines = ["👑 CLASSEMENT BANCAIRE"];
                        for (let i = 0; i < Math.min(topRes.data.length, 25); i++) {
                            const u = topRes.data[i];
                            let userName = `User_${String(u.userId).slice(-5)}`;
                            try {
                                const userInfo = await api.getUserInfo(u.userId);
                                if (userInfo && userInfo[u.userId] && userInfo[u.userId].name) {
                                    userName = userInfo[u.userId].name;
                                }
                            } catch (nameErr) {}
                            const bankAmount = u.bank || "0";
                            const line = `${i+1}. ${userName} - ${await formatNumber(bankAmount)}$`;
                            const wrapped = wrapText(line, 42);
                            for (const w of wrapped) lines.push(w);
                        }
                        return message.reply(formatStyledMessage(lines));
                    } else {
                        return message.reply(formatStyledMessage([
                            "👑 CLASSEMENT BANCAIRE",
                            "━━━━━━━━━━━━━━━━",
                            "📊 Aucun utilisateur enregistré.",
                            "💡 Faites `bank card` pour créer",
                            "   votre compte bancaire !"
                        ]));
                    }
                } catch (topError) {
                    console.error("Top command error:", topError);
                    return message.reply(formatStyledMessage([
                        "👑 CLASSEMENT BANCAIRE",
                        "━━━━━━━━━━━━━━━━",
                        "❌ Erreur lors du chargement",
                        "   du classement. Réessaie plus tard."
                    ]));
                }
                break;
            }

            case "card": {
                const cardRes = await createUserCard(user);
                if (cardRes.success) {
                    userCardData = cardRes.data;
                    bankData.card = userCardData;
                    const cvvMsg = `💳 Carte créée ! N°: ${userCardData.cardNumber}, Exp: ${userCardData.cardExpiry}, CVV: ${userCardData.cardCvv}`;
                    if (imageMode !== false) {
                        const avatarUrl = await getUserAvatar(user);
                        const img = await generateRealisticBankCard("CARD", `${await formatNumber(bankData.bank || 0n)}$`, cvvMsg, username, userCardData.cardCvv, userCardData, avatarUrl);
                        const imgPath = `./bank_card_${user}.png`;
                        fs.writeFileSync(imgPath, img);
                        await message.reply({ body: formatStyledMessage([cvvMsg]), attachment: fs.createReadStream(imgPath) });
                        fs.unlinkSync(imgPath);
                    } else await message.reply(formatStyledMessage([cvvMsg]));
                } else return message.reply(formatStyledMessage([`❌ ${cardRes.error}`]));
                break;
            }

            case "transfer": {
                let targetUser;
                if (Object.keys(event.mentions).length > 0) targetUser = Object.keys(event.mentions)[0];
                else targetUser = args[1];
                const transferAmount = await parseAmountWithSuffix(args[2]);
                if (!targetUser) return message.reply(formatStyledMessage([`❌ Destinataire manquant. Utilisation: ${p}bank transfer @mention <montant>`]));
                if (targetUser === user) return message.reply(formatStyledMessage(["❌ Auto-transfert interdit."]));
                if (transferAmount <= 0n) return message.reply(formatStyledMessage(["❌ Montant invalide."]));
                if ((bankData.bank || 0n) < transferAmount) return message.reply(formatStyledMessage(["❌ Solde insuffisant."]));
                if (!bankData.card?.cardCreated) return message.reply(formatStyledMessage([`❌ Créez d'abord une carte.`]));
                let targetName = targetUser;
                try { const ti = await api.getUserInfo(targetUser); targetName = ti[targetUser]?.name || targetUser; } catch(e) {}
                clearPendingTransaction(user);
                pendingTransactions.set(user, { amount: transferAmount, type: "transfer", targetId: targetUser, targetName });
                savePendingTransactions();
                const to3 = setTimeout(() => { if (pendingTransactions.has(user)) { pendingTransactions.delete(user); savePendingTransactions(); message.reply(formatStyledMessage(["⏰ Transfert expiré."])); } pendingTimeouts.delete(user); }, 15000);
                pendingTimeouts.set(user, to3);
                return message.reply(formatStyledMessage([`💸 Transfert de ${await formatNumber(transferAmount)}$ vers ${targetName}`, `🔐 Entrez votre CVV (ex: bank 123) [15s]`]));
            }

            case "gamble":
            case "bet": {
                const subGamble = args[1]?.toLowerCase();
                if (!subGamble || subGamble === "help") {
                    const helpG = [
                        "🎰 GAMBLE",
                        `✰ ${p}bank gamble play <montant> <pile/face>`
                    ];
                    return message.reply(formatStyledMessage(helpG));
                }
                if (subGamble === "play") {
                    const betAmount = await parseAmountWithSuffix(args[2]);
                    const choice = args[3]?.toLowerCase();
                    if (betAmount <= 0n) return message.reply(formatStyledMessage(["❌ Montant invalide."]));
                    if (choice !== "pile" && choice !== "face") return message.reply(formatStyledMessage(["❌ Choisissez pile ou face."]));
                    if ((bankData.bank || 0n) < betAmount) return message.reply(formatStyledMessage(["❌ Solde insuffisant."]));
                    const gambleRes = await gambleApi(user, Number(betAmount), choice);
                    if (gambleRes.success) {
                        bankData = await getUserBankData(user);
                        const win = gambleRes.win;
                        const result = gambleRes.result;
                        const winAmount = toBigInt(gambleRes.winAmount);
                        const txt = win ? `🎉 Gagné ! +${await formatNumber(winAmount)}$` : `💀 Perdu ! -${await formatNumber(betAmount)}$`;
                        if (imageMode !== false) {
                            const img = await generateGambleCard(username, betAmount, win, winAmount, choice, result);
                            const imgPath = `./bank_gamble_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage([`❌ ${gambleRes.error}`]));
                }
                break;
            }

            case "lottery": {
                const subLot = args[1]?.toLowerCase();
                if (!subLot || subLot === "help") {
                    const helpL = [
                        "🎲 LOTTERY",
                        `✰ ${p}bank lottery play <montant>`
                    ];
                    return message.reply(formatStyledMessage(helpL));
                }
                if (subLot === "play") {
                    const ticket = await parseAmountWithSuffix(args[2]);
                    if (ticket <= 0n) return message.reply(formatStyledMessage(["❌ Montant invalide."]));
                    const userCashBal = await getUserCash(user);
                    if (ticket > userCashBal) return message.reply(formatStyledMessage(["❌ Solde cash insuffisant."]));
                    const lotteryRes = await playLottery(user, Number(ticket));
                    if (lotteryRes.success) {
                        await updateUserCash(user, -ticket);
                        bankData = await getUserBankData(user);
                        const win = lotteryRes.win;
                        const winAmount = toBigInt(lotteryRes.winAmount || 0);
                        const txt = win ? `🎉 Gain: +${await formatNumber(winAmount)}$` : `💀 Perte: -${await formatNumber(ticket)}$`;
                        if (imageMode !== false) {
                            const img = await generateLotteryCard(username, ticket, win, winAmount, lotteryRes.userNumbers, lotteryRes.drawnNumbers, lotteryRes.matchCount);
                            const imgPath = `./bank_lottery_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage([`❌ ${lotteryRes.error}`]));
                }
                break;
            }

            case "parrainage":
            case "parrain": {
                const subPar = args[1]?.toLowerCase();
                if (!subPar || subPar === "help") {
                    const helpP = [
                        "🎁 PARRAINAGE",
                        `✰ ${p}bank parrainage creer`,
                        `✰ ${p}bank parrainage utiliser <code>`
                    ];
                    return message.reply(formatStyledMessage(helpP));
                }
                if (subPar === "creer" || subPar === "create") {
                    const codeRes = await createParrainCode(user);
                    if (codeRes.success) {
                        const txt = `🔑 Votre code: ${codeRes.code}`;
                        if (imageMode !== false) {
                            const img = await generateParrainCard(username, codeRes.code, 0, 0, "create");
                            const imgPath = `./bank_parrain_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage([`❌ ${codeRes.error}`]));
                } else if (subPar === "utiliser" || subPar === "use") {
                    const code = args[2];
                    if (!code) return message.reply(formatStyledMessage(["❌ Code manquant."]));
                    const useRes = await useParrainCode(user, code);
                    if (useRes.success) {
                        bankData = await getUserBankData(user);
                        const txt = `🎉 Bonus 10000$ ajouté ! Nouveau solde: ${await formatNumber(bankData.bank)}$`;
                        if (imageMode !== false) {
                            const img = await generateParrainCard(username, code, 0, 0, "use");
                            const imgPath = `./bank_parrain_use_${user}.png`;
                            fs.writeFileSync(imgPath, img);
                            await message.reply({ body: formatStyledMessage([txt]), attachment: fs.createReadStream(imgPath) });
                            fs.unlinkSync(imgPath);
                        } else await message.reply(formatStyledMessage([txt]));
                    } else return message.reply(formatStyledMessage([`❌ ${useRes.error}`]));
                }
                break;
            }

            case "image": {
                const subImg = args[1]?.toLowerCase();
                if (subImg === "on") {
                    imageMode = true;
                    return message.reply(formatStyledMessage(["🖼️ Mode carte activé."]));
                } else if (subImg === "off") {
                    imageMode = false;
                    return message.reply(formatStyledMessage(["📝 Mode texte activé."]));
                } else return message.reply(formatStyledMessage([`🖼️ Utilisez ${p}bank image on/off`]));
            }

            default: {
                const helpMain = [
                    "🏦 HEDGEHOG BANK 🏦",
                    "━━━━━━━━━━━━━━━━",
                    `✰ ${p}bank deposit`,
                    `✰ ${p}bank withdraw`,
                    `✰ ${p}bank balance`,
                    `✰ ${p}bank interest`,
                    `✰ ${p}bank transfer`,
                    `✰ ${p}bank gamble play`,
                    `✰ ${p}bank lottery play`,
                    `✰ ${p}bank parrainage`,
                    `✰ ${p}bank card`,
                    `✰ ${p}bank image on/off`,
                    `✰ ${p}bank top`,
                    `✰ ${p}bank history [nb]`,
                    `✰ ${p}bank rob`,
                    `✰ ${p}bank vip -a/-r/list`,
                    "━━━━━━━━━━━━━━━━",
                    "MERCI POUR VOTRE CONTRIBUTION !"
                ];
                return message.reply(formatStyledMessage(helpMain));
            }
        }
    }
};