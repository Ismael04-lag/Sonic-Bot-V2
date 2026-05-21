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
        const response = await axios.get(`${CONVERT_API_URL}?number=${bigNum.toString()}`, { timeout: 5000 });
        if (response.data && response.data.success) return response.data.formatted;
    } catch (error) {}
    return formatBigInt(bigNum);
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

async function getUserBankData(userId) {
    try {
        const response = await axios.get(`${BANK_API_URL}/${userId}`, { timeout: 10000 });
        if (response.data.success) {
            return {
                bank: toBigInt(response.data.data.bank || "0"),
                card: response.data.data.card || null
            };
        }
    } catch (error) {
        console.error("Bank API Error:", error.message);
    }
    return { bank: 0n, card: null };
}

function getUserInfo(uid, api) {
    return new Promise((resolve) => {
        api.getUserInfo(uid, (err, data) => {
            if (err || !data || !data[uid]) {
                resolve({ name: `User_${String(uid).slice(-5)}`, thumbSrc: null, id: uid });
            } else {
                resolve({
                    name: data[uid].name || `User_${String(uid).slice(-5)}`,
                    thumbSrc: data[uid].thumbSrc || null,
                    id: uid
                });
            }
        });
    });
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

async function generateRealisticBalanceCard(userInfo, bankData, cashMoney, api) {
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
    ctx.fillText("BALANCE CARD", 25, 62);

    const avatarUrl = await getAvatarUrl(userInfo.id, api);
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
    let cardNumber = bankData.card?.cardNumber || "4532 **** **** 5772";
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
    const expiry = bankData.card?.cardExpiry || "12/28";
    ctx.fillText(expiry, 25, 218);

    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px 'Courier New'";
    const cardHolderName = userInfo.name.toUpperCase().substring(0, 22);
    ctx.fillText(cardHolderName, 25, 260);

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.font = "8px 'Courier New'";
    ctx.fillText(`ID: ${userInfo.id}`, 25, 277);

    ctx.fillStyle = "rgba(212, 175, 55, 0.15)";
    ctx.fillRect(width - 170, height - 75, 155, 55);
    ctx.fillStyle = "#d4af37";
    ctx.font = "bold 26px 'Courier New'";
    ctx.fillText(`${await formatNumber(cashMoney)}$`, width - 165, height - 35);

    const formattedBank = await formatNumber(bankData.bank);
    ctx.fillStyle = "#88ff88";
    ctx.font = "11px 'Courier New'";
    ctx.fillText(`BANQUE: ${formattedBank}$`, width - 165, height - 55);

    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillRect(0, height - 22, width, 22);
    ctx.fillStyle = "rgba(212, 175, 55, 0.5)";
    ctx.font = "8px 'Courier New'";
    const d = new Date();
    ctx.fillText(`HEDGEHOG BANK • PREMIUM • BALANCE`, width / 2 - 145, height - 8);
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillText("💰", width - 85, height - 8);

    return canvas.toBuffer();
}

module.exports = {
    config: {
        name: "balance",
        aliases: ["bal"],
        version: "3.0",
        author: "Ismael Soma",
        countDown: 5,
        role: 0,
        description: { en: "View your money or the money of a tagged person" },
        category: "economy",
        guide: { en: "{pn} - view your balance\n{pn} @user - view tagged user's balance" }
    },

    onStart: async function ({ message, event, api }) {
        try {
            if (Object.keys(event.mentions).length > 0) {
                const uids = Object.keys(event.mentions);
                for (const uid of uids) {
                    const userMoney = await getUserCash(uid);
                    const bankData = await getUserBankData(uid);
                    const userInfo = await getUserInfo(uid, api);

                    const formattedMoney = await formatNumber(userMoney);
                    const formattedBank = await formatNumber(bankData.bank);

                    const img = await generateRealisticBalanceCard(
                        { id: uid, name: userInfo.name },
                        bankData,
                        userMoney,
                        api
                    );

                    const imgPath = path.join(__dirname, `balance_${uid}.png`);
                    fs.writeFileSync(imgPath, img);

                    await message.reply({
                        body: formatStyledMessage([
                            `👤 ${userInfo.name}`,
                            `🆔 ID: ${uid}`,
                            `━━━━━━━━━━━━━━━━━━`,
                            `💰 POCHE: ${formattedMoney}$`,
                            `🏦 BANQUE: ${formattedBank}$`,
                            `━━━━━━━━━━━━━━━━━━`,
                            `💵 TOTAL: ${await formatNumber(userMoney + bankData.bank)}$`
                        ]),
                        attachment: fs.createReadStream(imgPath)
                    });

                    fs.unlinkSync(imgPath);
                }
                return;
            }

            const uid = event.senderID;
            const userMoney = await getUserCash(uid);
            const bankData = await getUserBankData(uid);
            const userInfo = await getUserInfo(uid, api);

            const formattedMoney = await formatNumber(userMoney);
            const formattedBank = await formatNumber(bankData.bank);

            const img = await generateRealisticBalanceCard(
                { id: uid, name: userInfo.name },
                bankData,
                userMoney,
                api
            );

            const imgPath = path.join(__dirname, `balance_${uid}.png`);
            fs.writeFileSync(imgPath, img);

            await message.reply({
                body: formatStyledMessage([
                    `👤 ${userInfo.name}`,
                    `🆔 ID: ${uid}`,
                    `━━━━━━━━━━━━━━━━━━`,
                    `💰 POCHE: ${formattedMoney}$`,
                    `🏦 BANQUE: ${formattedBank}$`,
                    `━━━━━━━━━━━━━━━━━━`,
                    `💵 TOTAL: ${await formatNumber(userMoney + bankData.bank)}$`
                ]),
                attachment: fs.createReadStream(imgPath)
            });

            fs.unlinkSync(imgPath);

        } catch (error) {
            console.error("Balance error:", error);
            await message.reply(formatStyledMessage(["❌ Erreur lors de la récupération", "   de votre solde. Réessaie plus tard."]));
        }
    }
};