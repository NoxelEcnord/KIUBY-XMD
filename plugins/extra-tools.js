const { bwmxmd } = require('../core/commandHandler');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

bwmxmd({
    pattern: "qr",
    category: "utility",
    description: "Generate a QR code from text"
}, async (from, client, conText) => {
    const { q, reply } = conText;
    if (!q) return reply("✏️ Provide text to generate a QR code. Example: .qr hello world");

    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(q)}`;

    await client.sendMessage(from, { image: { url: qrUrl }, caption: `✅ QR Code generated for: *${q}*` });
});

bwmxmd({
    pattern: "ocr",
    category: "utility",
    description: "Extract text from a quoted image"
}, async (from, client, conText) => {
    const { quoted, reply, react } = conText;
    const quotedImg = quoted?.imageMessage || quoted?.message?.imageMessage;
    if (!quotedImg) return reply("📸 Quote an image to extract text.");

    try {
        await react("⏳");
        const filePath = await client.downloadAndSaveMediaMessage(quotedImg, 'temp_ocr');
        const formData = new (require('form-data'))();
        formData.append('file', fs.createReadStream(filePath));
        formData.append('apikey', 'helloworld'); // Public test key for OCR.space or use a better API

        // Using a more reliable OCR API if possible, for now let's try a public one or bk9
        const ocrRes = await axios.post('https://api.ocr.space/parse/image', formData, {
            headers: formData.getHeaders()
        });

        fs.unlinkSync(filePath);

        const text = ocrRes.data?.ParsedResults?.[0]?.ParsedText;
        if (!text) return reply("❌ Could not extract any text from this image.");

        reply(`📖 *Extracted Text:*\n\n${text}`);
        await react("✅");

    } catch (err) {
        console.error("OCR Error:", err);
        reply("❌ OCR extraction failed. Make sure the image is clear.");
        await react("❌");
    }
});

bwmxmd({
    pattern: "inspect",
    category: "utility",
    description: "Get detailed information about a quoted message"
}, async (from, client, conText) => {
    const { quoted, reply, mek } = conText;
    if (!quoted) return reply("❓ Quote a message to inspect.");

    const info = `📝 *Message Inspector*\n\n` +
        `🆔 *ID:* ${quoted.key?.id || 'N/A'}\n` +
        `👤 *Sender:* @${(quoted.sender || mek.key.participant || from).split('@')[0]}\n` +
        `📱 *Device:* ${quoted.key?.id?.length > 21 ? 'Android/iOS' : 'Web'}\n` +
        `⏰ *Time:* ${new Date().toLocaleString()}\n` +
        `📦 *Type:* ${Object.keys(quoted.message || {})[0] || 'text'}`;

    reply(info, { mentions: [quoted.sender || from] });
});
