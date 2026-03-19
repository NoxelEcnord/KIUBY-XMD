const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');
const fs = require('fs');
const path = require('path');

//========================================================================================================================
// SENDSTATUS — Send quoted media to WhatsApp status
//========================================================================================================================

kiubyxmd({
    pattern: "sendstatus",
    aliases: ["poststatus", "statuspost", "ss"],
    description: "Send quoted media (image/video/audio) to your WhatsApp status",
    category: "Media",
    filename: __filename
}, async (from, client, conText) => {
    const { q, quoted, quotedMsg, reply, mek, isSuperUser } = conText;

    if (!isSuperUser) return reply("❌ Owner-only command");
    if (!quotedMsg) {
        return reply(
            "📌 *Usage:* Reply to an image, video, or audio with:\n" +
            "`.sendstatus <caption>`\n\n" +
            "The caption argument is optional for images/videos."
        );
    }

    const caption = q || "";
    const STATUS_JID = 'status@broadcast';

    try {
        // ── Image ──
        if (quoted?.imageMessage) {
            const tmpFile = path.join('/tmp', `status_img_${Date.now()}`);
            const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage, tmpFile);
            const buffer = fs.readFileSync(filePath);

            await client.sendMessage(STATUS_JID, {
                image: buffer,
                caption: caption
            });

            try { fs.unlinkSync(filePath); } catch (e) { }
            return reply("✅ Image posted to status.");
        }

        // ── Video ──
        if (quoted?.videoMessage) {
            if (quoted.videoMessage.seconds && quoted.videoMessage.seconds > 60) {
                return reply("⚠️ Video status must be 60 seconds or shorter.");
            }

            const tmpFile = path.join('/tmp', `status_vid_${Date.now()}`);
            const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage, tmpFile);
            const buffer = fs.readFileSync(filePath);

            await client.sendMessage(STATUS_JID, {
                video: buffer,
                caption: caption
            });

            try { fs.unlinkSync(filePath); } catch (e) { }
            return reply("✅ Video posted to status.");
        }

        // ── Audio ──
        if (quoted?.audioMessage) {
            const tmpFile = path.join('/tmp', `status_aud_${Date.now()}`);
            const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage, tmpFile);
            const buffer = fs.readFileSync(filePath);

            await client.sendMessage(STATUS_JID, {
                audio: buffer,
                mimetype: quoted.audioMessage.mimetype || 'audio/mpeg',
                ptt: true
            });

            try { fs.unlinkSync(filePath); } catch (e) { }
            return reply("✅ Audio posted to status.");
        }

        // ── Text (if replied to text) ──
        if (quoted?.conversation || quoted?.extendedTextMessage?.text) {
            const text = quoted.conversation || quoted.extendedTextMessage.text;
            await client.sendMessage(STATUS_JID, {
                text: caption ? `${caption}\n\n${text}` : text
            });
            return reply("✅ Text posted to status.");
        }

        return reply("❌ Unsupported media type. Reply to an image, video, audio, or text message.");

    } catch (error) {
        console.error("sendstatus error:", error);
        await reply(`❌ Failed to post status: ${error.message}`);
    }
});
