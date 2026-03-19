const { kiubyxmd } = require('../core/commandHandler');
const fs = require('fs');
const { exec } = require('child_process');
const axios = require('axios');
const path = require('path');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

//========================================================================================================================
// TRIM — Trim audio/video by start and end time
//========================================================================================================================

kiubyxmd({
  pattern: "trim",
  description: "Trim quoted audio or video using start and end time",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, quoted, q, mek, reply } = conText;

  if (!quotedMsg) {
    return reply("❌ Reply to an audio or video file with start and end time.\n\nExample: `trim 0:10 0:30` (start end)");
  }

  const parts = (q || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) {
    return reply("⚠️ Invalid format. Provide start and end time.\n\nExample: `.trim 0:10 0:30` (minutes:seconds)");
  }

  const [startTime, endTime] = parts;

  // Detect media type and message structure
  const audioMsg = (quotedMsg.message?.audioMessage || quoted?.audioMessage);
  const videoMsg = (quotedMsg.message?.videoMessage || quoted?.videoMessage);

  if (!audioMsg && !videoMsg) {
    return reply("❌ Unsupported media type. Quote an audio or video file.");
  }

  try {
    const isAudio = !!audioMsg;
    const mediaObj = audioMsg || videoMsg;

    // Download with a generic name, let index.js detect the extension
    const baseName = path.join('/tmp', `trim_${Date.now()}`);
    const savedPath = await client.downloadAndSaveMediaMessage(mediaObj, baseName);

    // Get actual extension from saved file
    const ext = path.extname(savedPath);
    const outputFile = `${savedPath}_trimmed${ext}`;

    await reply(`✂️ *KIUBY-XMD*: Trimming ${isAudio ? 'audio' : 'video'} [${startTime} ➔ ${endTime}]...`);

    // Use -ss AFTER -i for slower but frame-accurate seeking
    // Use -to for end time relative to start of file
    const ffmpegCmd = isAudio
      ? `ffmpeg -y -i "${savedPath}" -ss ${startTime} -to ${endTime} -c:a libmp3lame -q:a 2 "${outputFile}"`
      : `ffmpeg -y -i "${savedPath}" -ss ${startTime} -to ${endTime} -c:v libx264 -preset superfast -crf 23 -c:a aac "${outputFile}"`;

    exec(ffmpegCmd, async (err, stdout, stderr) => {
      try { if (fs.existsSync(savedPath)) fs.unlinkSync(savedPath); } catch (e) { }

      if (err) {
        console.error("FFMPEG Error:", stderr);
        return reply("❌ *Trimming Failed*: Ensure time format is Correct (e.g. 0:00 or 00:00:00).");
      }

      try {
        if (!fs.existsSync(outputFile)) throw new Error("Output file not generated");

        const buffer = fs.readFileSync(outputFile);
        const message = isAudio
          ? { audio: buffer, mimetype: "audio/mpeg", ptt: audioMsg.ptt || false }
          : { video: buffer, mimetype: "video/mp4", caption: `✂️ Trimmed: ${startTime} - ${endTime}` };

        await client.sendMessage(from, message, { quoted: mek });
      } catch (sendErr) {
        console.error("Transmission Error:", sendErr);
        reply("❌ Failed to broadcast trimmed signal.");
      }

      try { if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile); } catch (e) { }
    });
  } catch (error) {
    console.error("TRIM System Error:", error);
    await reply("❌ System failure during trimming operation.");
  }
});

//========================================================================================================================
// VOLUME — Adjust audio/video volume
//========================================================================================================================

kiubyxmd({
  pattern: "volume",
  description: "Adjust volume of quoted audio or video",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, quoted, q, mek, reply } = conText;

  if (!q) {
    return reply("⚠️ Example: volume 1.5");
  }

  const audioMsg = quoted?.audioMessage;
  const videoMsg = quoted?.videoMessage;

  if (!audioMsg && !videoMsg) {
    return reply("❌ Quote an audio or video file to adjust its volume.");
  }

  try {
    const mediaMessage = audioMsg || videoMsg;
    const isAudio = !!audioMsg;
    const inputExt = isAudio ? 'mp3' : 'mp4';
    const outputExt = isAudio ? 'mp3' : 'mp4';

    const inputFile = path.join('/tmp', `vol_in_${Date.now()}.${inputExt}`);
    const outputFile = path.join('/tmp', `vol_out_${Date.now()}.${outputExt}`);

    const savedPath = await client.downloadAndSaveMediaMessage(mediaMessage, inputFile.replace(`.${inputExt}`, ''));

    exec(`ffmpeg -y -i "${savedPath}" -filter:a volume=${q} "${outputFile}"`, async (err) => {
      try { fs.unlinkSync(savedPath); } catch (e) { }
      if (err) {
        console.error("ffmpeg volume error:", err);
        return reply("❌ Volume adjustment failed.");
      }

      try {
        const buffer = fs.readFileSync(outputFile);
        const message = isAudio
          ? { audio: buffer, mimetype: "audio/mpeg" }
          : { video: buffer, mimetype: "video/mp4" };
        await client.sendMessage(from, message, { quoted: mek });
      } catch (e) {
        reply("❌ Failed to send adjusted media.");
      }
      try { fs.unlinkSync(outputFile); } catch (e) { }
    });
  } catch (error) {
    console.error("volume error:", error);
    await reply("❌ An error occurred: " + error.message);
  }
});

//========================================================================================================================
// TOMP3 — Convert media to MP3
//========================================================================================================================

kiubyxmd({
  pattern: "tomp3",
  aliases: ["toaudio", "audioextract"],
  description: "Convert quoted audio or video to MP3",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, quoted, mek, reply } = conText;

  const audioMsg = quoted?.audioMessage;
  const videoMsg = quoted?.videoMessage;

  if (!audioMsg && !videoMsg) {
    return reply("❌ Quote an audio or video to convert to MP3.");
  }

  try {
    const mediaMessage = audioMsg || videoMsg;
    const inputFile = path.join('/tmp', `tomp3_in_${Date.now()}`);
    const outputFile = path.join('/tmp', `tomp3_out_${Date.now()}.mp3`);

    const savedPath = await client.downloadAndSaveMediaMessage(mediaMessage, inputFile);

    exec(`ffmpeg -y -i "${savedPath}" -q:a 0 -map a "${outputFile}"`, async (err) => {
      try { fs.unlinkSync(savedPath); } catch (e) { }
      if (err) {
        console.error("ffmpeg tomp3 error:", err);
        return reply("❌ Conversion failed.");
      }

      try {
        const buffer = fs.readFileSync(outputFile);
        await client.sendMessage(from, {
          audio: buffer,
          mimetype: "audio/mpeg"
        }, { quoted: mek });
      } catch (e) {
        reply("❌ Failed to send converted file.");
      }
      try { fs.unlinkSync(outputFile); } catch (e) { }
    });
  } catch (error) {
    console.error("tomp3 error:", error);
    await reply("❌ An error occurred: " + error.message);
  }
});

//========================================================================================================================
// TOIMG — Convert sticker to image
//========================================================================================================================

kiubyxmd({
  pattern: "toimg",
  aliases: ["sticker2img", "webp2png"],
  description: "Convert quoted sticker to image",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, quoted, mek, reply } = conText;

  if (!quoted?.stickerMessage) {
    return reply("❌ Quote a sticker to convert.");
  }

  try {
    const inputFile = path.join('/tmp', `toimg_in_${Date.now()}`);
    const outputFile = path.join('/tmp', `toimg_out_${Date.now()}.png`);

    const savedPath = await client.downloadAndSaveMediaMessage(quoted.stickerMessage, inputFile);

    exec(`ffmpeg -y -i "${savedPath}" "${outputFile}"`, async (err) => {
      try { fs.unlinkSync(savedPath); } catch (e) { }
      if (err) return reply("❌ Conversion failed.");

      try {
        const buffer = fs.readFileSync(outputFile);
        await client.sendMessage(from, {
          image: buffer,
          caption: "🖼️ Converted from sticker"
        }, { quoted: mek });
      } catch (e) {
        reply("❌ Failed to send converted image.");
      }
      try { fs.unlinkSync(outputFile); } catch (e) { }
    });
  } catch (e) {
    console.error("toimg error:", e);
    await reply("❌ Unable to convert the sticker.");
  }
});

//========================================================================================================================
// AMPLIFY — Replace video audio with a new audio URL
//========================================================================================================================

kiubyxmd({
  pattern: "amplify",
  aliases: ["replaceaudio", "mergeaudio"],
  description: "Replace quoted video's audio with a new audio URL",
  category: "Utility",
  filename: __filename
}, async (from, client, conText) => {
  const { quotedMsg, quoted, q, mek, reply } = conText;

  if (!quoted?.videoMessage) {
    return reply("❌ Reply to a video file with the audio URL to replace its audio.");
  }

  if (!q) {
    return reply("❌ Provide an audio URL.");
  }

  try {
    const audioUrl = q.trim();
    const videoInput = path.join('/tmp', `amp_vid_${Date.now()}`);
    const audioInput = path.join('/tmp', `amp_aud_${Date.now()}.mp3`);
    const outputFile = path.join('/tmp', `amp_out_${Date.now()}.mp4`);

    const videoPath = await client.downloadAndSaveMediaMessage(quoted.videoMessage, videoInput);

    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(audioInput, response.data);

    exec(`ffmpeg -y -i "${videoPath}" -i "${audioInput}" -c:v copy -map 0:v:0 -map 1:a:0 -shortest "${outputFile}"`, async (err) => {
      try { fs.unlinkSync(videoPath); } catch (e) { }
      try { fs.unlinkSync(audioInput); } catch (e) { }
      if (err) {
        console.error("ffmpeg amplify error:", err);
        return reply("❌ Error during audio replacement.");
      }

      try {
        const videoBuffer = fs.readFileSync(outputFile);
        await client.sendMessage(from, {
          video: videoBuffer,
          mimetype: "video/mp4"
        }, { quoted: mek });
      } catch (e) {
        reply("❌ Failed to send merged video.");
      }
      try { fs.unlinkSync(outputFile); } catch (e) { }
    });
  } catch (error) {
    console.error("amplify error:", error);
    await reply("❌ An error occurred: " + error.message);
  }
});
