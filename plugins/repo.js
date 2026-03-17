const { kiubyxmd } = require('../core/commandHandler');
const { sendButtons } = require('gifted-btns');
const axios = require('axios');
const moment = require("moment-timezone");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const s = require(__dirname + "/../config");
const XMD = require('../core/xmd');

const BOT_NAME = s.BOT || 'KIUBY-XMD';
const MEDIA_URLS = s.BOT_URL || [];
const getGlobalContextInfo = () => XMD.getContextInfo();
const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);

const randomMedia = () => {
  if (!MEDIA_URLS || MEDIA_URLS.length === 0) return null;
  const url = MEDIA_URLS[Math.floor(Math.random() * MEDIA_URLS.length)];
  if (typeof url === 'string') {
    const trimmed = url.trim();
    return trimmed.startsWith('http') ? trimmed : null;
  }
  return null;
};

const getRandomAudio = async () => {
  try {
    const response = await axios.get(XMD.EXTERNAL.NCS_RANDOM, { timeout: 10000 });
    if (response.data.status === "success" && response.data.data.length > 0) {
      return response.data.data[0].links.Bwm_stream_link;
    }
    return null;
  } catch (error) {
    console.error("Error fetching random audio:", error.message);
    return null;
  }
};

const convertToOpus = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    exec(`ffmpeg -y -i "${inputPath}" -c:a libopus -b:a 64k -vbr on -compression_level 10 -frame_duration 60 -application voip "${outputPath}"`, (error) => {
      if (error) reject(error);
      else resolve(outputPath);
    });
  });
};

kiubyxmd({
  pattern: "bwmgift",
  aliases: ["bwmapk", "siteapk"],
  description: "Send KIUBY-XMD APK",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, botPic } = conText;

  const apkUrl = XMD.SUPABASE_APK;
  const fileName = "BWMGIFT5.5.apk";

  try {
    await client.sendMessage(from, {
      document: { url: apkUrl },
      mimetype: "application/vnd.android.package-archive",
      fileName,
      contextInfo: {
        ...getGlobalContextInfo(),
        externalAdReply: {
          title: "BWMGIFT APK",
          body: "",
          mediaType: 1,
          sourceUrl: `https://zone.${XMD.WEB}`,
          thumbnailUrl: botPic,
          renderLargerThumbnail: false
        }
      }
    }, { quoted: mek });
  } catch (err) {
    console.error("bwmsite APK send error:", err);
    await client.sendMessage(from, { text: "❌ Failed to send APK. " + (err?.message || "Unknown error"), contextInfo: getGlobalContextInfo() }, { quoted: mek });
  }
});

kiubyxmd({
  pattern: "pair",
  description: "Generate pairing code and copy it",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, q, reply, botname, deviceMode } = conText;

  if (!q) {
    return reply("❌ Please provide a number to pair.\nExample: .pair 254710772666");
  }

  try {
    await reply("⏳ *KIUBY-XMD*: Initiating pairing protocol... This may take up to 30s if the scanner is waking up.");

    const response = await axios.get(XMD.SESSION_SCANNER(q), { timeout: 60000 });
    const data = response.data;

    if (data.status === 'error' || !data.code) {
      return reply(`❌ Failed to generate pairing code.\n${data.message || 'Scanner returned no code.'}`);
    }

    const code = data.code;

    const messageText =
      `🔑 *Pairing Code Generated*\n\n` +
      `• Number: ${q}\n` +
      `• Code: *${code}*\n\n` +
      `📋 Copy the code above and paste in WhatsApp pairing.`;

    if (deviceMode === 'iPhone') {
      await client.sendMessage(from, { text: messageText });
    } else {
      try {
        await sendButtons(client, from, {
          title: '',
          text: messageText + `\n\n_Tap button to copy._`,
          footer: `> *${botname}*`,
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "📋 Copy Pairing Code",
                id: "copy_pair",
                copy_code: code
              })
            }
          ]
        }, { quoted: mek });
      } catch (btnErr) {
        await client.sendMessage(from, {
          text: messageText,
          contextInfo: getGlobalContextInfo()
        }, { quoted: mek });
      }
    }

  } catch (err) {
    console.error("pair error:", err);
    const hint = err.code === 'ECONNABORTED' || err.message.includes('timeout')
      ? 'Scanner service may be sleeping. Try again in 30 seconds.'
      : err.message;
    return reply(`❌ Failed to fetch pairing code.\n⚠️ ${hint}`);
  }
});

kiubyxmd({
  pattern: "location",
  aliases: ["pinlocation", "getlocation"],
  category: "General",
  description: "Send a location pin by name",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, q, reply } = conText;

  if (!q) {
    return reply("📌 Usage: `.location Nairobi, Kenya`");
  }

  try {
    const apiUrl = XMD.API.TOOLS.LOCATION(q);
    const { data } = await axios.get(apiUrl, { timeout: 60000 });

    if (!data.status || !data.result?.results?.length) {
      return reply(`❌ Could not find location for: ${q}`);
    }

    const loc = data.result.results[0];
    const { lat, lng } = loc.geometry;
    const formatted = loc.formatted || q;

    await client.sendMessage(
      from,
      {
        location: {
          degreesLatitude: lat,
          degreesLongitude: lng,
          name: formatted
        },
        contextInfo: getGlobalContextInfo()
      },
      { quoted: mek }
    );
  } catch (err) {
    console.error("Location error:", err);
    reply("❌ Failed to fetch location.");
  }
});

kiubyxmd({
  pattern: "copy",
  aliases: ["copied", "cp"],
  description: "Copy quoted message text via button",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, quotedMsg, reply, botname, deviceMode } = conText;

  if (!quotedMsg) {
    return reply("📌 Reply to a message with `.copy` to generate a copy button.");
  }

  const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
  if (!text) {
    return reply("❌ Could not extract quoted text.");
  }

  const plainText = `📋 *Text to Copy:*\n\n\`\`\`${text}\`\`\`\n\n_Long-press to copy._`;

  if (deviceMode === 'iPhone') {
    await client.sendMessage(from, { text: plainText });
  } else {
    try {
      await sendButtons(client, from, {
        title: "",
        text: plainText,
        footer: `> *${botname}*`,
        buttons: [
          {
            name: "cta_copy",
            buttonParamsJson: JSON.stringify({
              display_text: "📋 Copy Text",
              id: "copy_text",
              copy_code: text
            })
          }
        ]
      }, { quoted: mek });
    } catch (err) {
      console.error("Copy button failed, sending plain text:", err.message);
      await client.sendMessage(from, {
        text: plainText,
        contextInfo: getGlobalContextInfo()
      }, { quoted: mek });
    }
  }
});

kiubyxmd({
  pattern: "repo",
  aliases: ["script", "sc", "git"],
  description: "Send KIUBY-XMD repo information with random audio",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, pushName, botname, author, botSettings } = conText;

  try {
    const response = await axios.get(XMD.GITHUB_REPO_API, { timeout: 10000 });
    const repoData = response.data;
    const currentTime = moment().tz("Africa/Nairobi").format("DD/MM/YYYY HH:mm:ss");

    const createdDate = new Date(repoData.created_at).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric"
    });

    const lastUpdateDate = new Date(repoData.updated_at).toLocaleDateString("en-KE", {
      day: "numeric", month: "short", year: "numeric"
    });

    const repoUrl = 'github.com/KIUBY-XMD254/KIUBY-XMD-GO';

    const messageText =
      `📌 *${BOT_NAME} REPO INFO*\n\n` +
      `⭐ Stars: ${repoData.stargazers_count * 2}\n` +
      `🍴 Forks: ${repoData.forks_count * 2}\n` +
      `📅 Created: ${createdDate}\n` +
      `🕰 Updated: ${lastUpdateDate}\n` +
      `👤 Owner: ${author}\n\n` +
      `🔗 Repo Url\n ${repoUrl}\n\n` +
      `_Reply *1* for random NCS audio_\n\n` +
      `▬▬▬▬▬▬▬▬▬▬\n *Visit for more*\n> KIUBY-XMD.co.ke \n\n*Deploy your bot now*\n> pro.KIUBY-XMD.co.ke \n▬▬▬▬▬▬▬▬▬▬`;

    const contextInfo = {
      forwardingScore: 1,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: XMD.NEWSLETTER_JID,
        newsletterName: BOT_NAME,
        serverMessageId: -1
      }
    };

    const selectedMedia = randomMedia();
    let sentMsg;

    if (selectedMedia) {
      try {
        if (selectedMedia.match(/\.(mp4|gif)$/i)) {
          sentMsg = await client.sendMessage(from, {
            video: { url: selectedMedia },
            gifPlayback: true,
            caption: messageText,
            contextInfo
          }, { quoted: mek });
        } else {
          sentMsg = await client.sendMessage(from, {
            image: { url: selectedMedia },
            caption: messageText,
            contextInfo
          }, { quoted: mek });
        }
      } catch (mediaErr) {
        console.error("Repo media error:", mediaErr.message);
        sentMsg = await client.sendMessage(from, { text: messageText, contextInfo }, { quoted: mek });
      }
    } else {
      sentMsg = await client.sendMessage(from, { text: messageText, contextInfo }, { quoted: mek });
    }

    const cleanup = () => {
      client.ev.off("messages.upsert", handleReply);
    };

    const handleReply = async (update) => {
      const message = update.messages[0];
      if (!message?.message) return;

      const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (!sentMsg || !sentMsg.key || quotedStanzaId !== sentMsg.key.id) return;

      const responseText = message.message.extendedTextMessage?.text?.trim() ||
        message.message.conversation?.trim();

      if (!responseText) return;

      const destChat = message.key.remoteJid;

      if (responseText === "1") {
        try {
          await client.sendMessage(destChat, { react: { text: "⏳", key: message.key } });

          const audioUrl = await getRandomAudio();
          if (audioUrl) {
            const tempMp3 = path.join('/tmp', `repo_song_${Date.now()}.mp3`);
            const tempOgg = path.join('/tmp', `repo_song_${Date.now()}.ogg`);

            const audioResponse = await axios({
              method: 'GET',
              url: audioUrl,
              responseType: 'arraybuffer',
              timeout: 30000
            });

            fs.writeFileSync(tempMp3, Buffer.from(audioResponse.data));
            await convertToOpus(tempMp3, tempOgg);

            const audioBuffer = fs.readFileSync(tempOgg);
            await client.sendMessage(destChat, {
              audio: audioBuffer,
              mimetype: 'audio/ogg; codecs=opus',
              ptt: true,
              contextInfo
            }, { quoted: message });

            await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });

            fs.unlinkSync(tempMp3);
            fs.unlinkSync(tempOgg);
          } else {
            await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
            await client.sendMessage(destChat, { text: "❌ Failed to fetch audio. Try again." }, { quoted: message });
          }
        } catch (audioErr) {
          console.error("Repo audio error:", audioErr.message);
          await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
          await client.sendMessage(destChat, { text: "❌ Audio failed. Try again." }, { quoted: message });
        }
      }
    };

    client.ev.on("messages.upsert", handleReply);
    setTimeout(cleanup, 1800000);

  } catch (err) {
    console.error("❌ Repo fetch failed:", err);
    await client.sendMessage(from, {
      text: "❌ Failed to fetch repository information."
    }, { quoted: mek });
  }
});
