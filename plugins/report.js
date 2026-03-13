const { kiubyxmd } = require('../core/commandHandler');
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const FormData = require('form-data');
const XMD = require('../core/xmd');

// --- Uguu uploader ---
async function uploadToUguu(filePath) {
  if (!fs.existsSync(filePath)) throw new Error("File does not exist");

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  const form = new FormData();
  form.append('files[]', fs.createReadStream(filePath), {
    filename: path.basename(filePath),
    contentType: mimeType
  });

  const response = await axios.post(XMD.UGUU_UPLOAD, form, {
    headers: {
      ...form.getHeaders(),
      'origin': 'https://uguu.se',
      'referer': 'https://uguu.se/',
      'user-agent': 'Mozilla/5.0'
    }
  });

  const result = response.data;
  if (result.success && result.files?.[0]?.url) {
    return result.files[0].url;
  } else {
    throw new Error("Uguu upload failed or malformed response");
  }
}

// --- Save quoted media to tmp ---
async function saveMediaToTemp(client, quotedMedia, type) {
  const tmpDir = path.join(__dirname, "..", "tmp");
  await fs.ensureDir(tmpDir);
  const fileName = `${type}-${Date.now()}`;
  const filePath = path.join(tmpDir, fileName);
  const savedPath = await client.downloadAndSaveMediaMessage(quotedMedia, filePath);
  return savedPath;
}

// --- Report command ---
kiubyxmd({
  pattern: "report",
  aliases: ["bug", "feedback"],
  description: "Send a report with text and optional quoted media",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quoted, quotedMsg, reply, q, sender, pushName, isGroup } = conText;

  if (!q) {
    return reply("❌ Please provide a report message.\nExample: .report Hello bro");
  }

  let filePath, fileUrl;
  try {
    // Derive contact number from sender JID
    const userJid = sender || from;
    const contactNumber = userJid.split('@')[0] || 'Unknown';
    const userName = pushName || mek.pushName || mek.notify || 'Unknown User';

    // If quoted media exists → save + upload to Uguu
    if (quotedMsg) {
      const mediaNode =
        quoted.imageMessage ||
        quoted.videoMessage ||
        quoted.stickerMessage ||
        quoted.audioMessage ||
        quoted.documentMessage;

      if (mediaNode) {
        const type = quotedMsg.imageMessage ? "image"
                  : quotedMsg.videoMessage ? "video"
                  : quotedMsg.stickerMessage ? "sticker"
                  : quotedMsg.audioMessage ? "audio"
                  : quotedMsg.documentMessage ? "document"
                  : "file";

        filePath = await saveMediaToTemp(client, mediaNode, type);
        fileUrl = await uploadToUguu(filePath);
      }
    }

    // Build API URL
    const apiUrl = XMD.API.TOOLS.REPORT(q, userName, contactNumber) + (fileUrl ? `&url=${encodeURIComponent(fileUrl)}` : "");

    const { data } = await axios.get(apiUrl);

    if (data.success) {
      let successMessage = `✅ Report sent successfully.\n\n📝 *Details:*\n`;
      successMessage += `• 👤 Name: ${userName}\n`;
      successMessage += `• 📞 Contact: ${contactNumber}\n`;
      successMessage += `• 📋 Message: ${q}\n`;
      if (fileUrl) successMessage += `• 📎 Media: ${fileUrl}\n`;
      if (isGroup) successMessage += `• 👥 Group: Yes`;

      await reply(successMessage);
    } else {
      await reply("❌ Failed to send report.");
    }
  } catch (err) {
    console.error("Report error:", err);
    await reply("❌ Failed to send report. Error: " + err.message);
  } finally {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
});
