const { kiubyxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');

const getContactMsg = (contactName, sender) => XMD.getContactMsg(contactName, sender);
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================
//========================================================================================================================


kiubyxmd({
  pattern: "fancy",
  aliases: ["fancytext", "font", "style", "fancystyle"],
  category: "tools",
  description: "Generate fancy text styles and select by number"
},
  async (from, client, conText) => {
    const { q, mek, quotedMsg, reply } = conText;

    let text;
    if (q) {
      text = q;
    } else if (quotedMsg) {
      text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
      if (!text) return reply("❌ Could not extract quoted text.");
    } else {
      return reply("📌 Provide text or reply to a message.");
    }

    try {
      // First API: get all styles
      const apiUrl = XMD.FANCYTEXT.STYLES(text);
      const { data } = await axios.get(apiUrl, { timeout: 60000 });

      if (!data || !Array.isArray(data.styles)) {
        return reply("❌ Failed to fetch fancy styles.");
      }

      // Build numbered list showing actual fancy results (fallback to name if blank)
      let caption = `✨ Fancy styles for: *${data.input}*\n\n`;
      data.styles.forEach((style, i) => {
        caption += `${i + 1}. ${style.result || style.name}\n`;
      });
      caption += `\n📌 Reply with the style number to get the fancy text.`;

      const sent = await client.sendMessage(from, { text: caption }, { quoted: mek });
      const messageId = sent.key.id;

      // Listen for reply with number
      client.ev.on("messages.upsert", async (update) => {
        const msg = update.messages[0];
        if (!msg.message) return;

        const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
        const chatId = msg.key.remoteJid;

        if (!isReply) return;

        const num = parseInt(responseText.trim(), 10);
        if (isNaN(num) || num < 1 || num > data.styles.length) {
          return client.sendMessage(chatId, {
            text: `❌ Invalid style number. Reply with a number between 1 and ${data.styles.length}.`,
            quoted: msg
          });
        }

        try {
          // Second API: fix off-by-one by subtracting 1
          const index = num - 1;
          const styleUrl = XMD.FANCYTEXT.APPLY(text, index);
          const res = await axios.get(styleUrl, { timeout: 60000 });
          const styled = res.data?.result;

          if (!styled) {
            return client.sendMessage(chatId, {
              text: "❌ Failed to generate fancy text.",
              quoted: msg
            });
          }

          await client.sendMessage(chatId, { text: styled }, { quoted: msg });
        } catch (err) {
          console.error("Fancy error:", err);
          await client.sendMessage(chatId, {
            text: `❌ Error generating fancy text: ${err.message}`,
            quoted: msg
          });
        }
      });

    } catch (error) {
      console.error("Fancy text error:", error);
      reply("⚠️ An error occurred while fetching fancy styles.");
    }
  });

//========================================================================================================================


kiubyxmd({
  pattern: "tts",
  aliases: ["say", "speak"],
  category: "tools",
  description: "Convert text or quoted message to professional PTT audio"
},
  async (from, client, conText) => {
    const { q, mek, quotedMsg, reply } = conText;

    let text;
    if (q) {
      text = q;
    } else if (quotedMsg) {
      text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
      if (!text) {
        return reply("❌ Could not extract quoted text.");
      }
    } else {
      return reply("📌 Reply to a message with text or provide text directly.");
    }

    try {
      // Professional TTS using Google's translate_tts as a reliable fallback
      // Or use a more advanced voice API if provided in XMD
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=en&client=tw-ob`;

      await client.sendMessage(from, {
        audio: { url: ttsUrl },
        mimetype: "audio/mpeg",
        ptt: true,
        contextInfo: XMD.getContextInfo('🔊 PROFESSIONAL AUDIO', 'Uplink: Synchronized')
      }, { quoted: mek });

    } catch (error) {
      console.error("TTS error:", error);
      reply("⚠️ An error occurred while generating professional speech.");
    }
  });
//========================================================================================================================
//
kiubyxmd({
  pattern: "langcodes",
  aliases: ["langcode", "langs"],
  category: "tools",
  description: "List available language codes for translation"
},
  async (from, client, conText) => {
    const { reply } = conText;

    try {
      const url = XMD.LANGCODE_JSON;
      const { data } = await axios.get(url, { timeout: 100000 });

      const langs = Array.isArray(data?.languages) ? data.languages : [];
      if (langs.length === 0) {
        return reply("❌ No language codes found.");
      }

      // Build list: code → name
      const list = langs.map(l => `${l.code} → ${l.name}`).join("\n");

      reply(`🌐 Available Language Codes:\n\n${list}`);
    } catch (err) {
      console.error("Langcodes error:", err);
      reply("❌ Failed to fetch language codes.");
    }
  });
//========================================================================================================================
kiubyxmd({
  pattern: "translate",
  aliases: ["trt", "tl"],
  category: "tools",
  description: "Translate quoted text into target language"
},
  async (from, client, conText) => {
    const { q, quotedMsg, reply } = conText;

    if (!quotedMsg) {
      return reply("📌 Reply to a message with `.translate <langcode>`");
    }

    if (!q || typeof q !== "string") {
      return reply("❌ Missing target language code. Example: `.translate en`");
    }

    try {
      // Extract text from quoted message
      const text = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text;
      if (!text) {
        return reply("❌ Could not extract quoted text.");
      }

      // Call translate API
      const apiUrl = XMD.TRANSLATE(text, q);
      const { data } = await axios.get(apiUrl, { timeout: 100000 });

      const result = data?.result;
      if (!result?.translatedText) {
        return reply("❌ Translation failed.");
      }

      // Reply with translated text only
      reply(result.translatedText);
    } catch (err) {
      console.error("Translate error:", err);
      reply("❌ Error translating text.");
    }
  });
//========================================================================================================================
// Font Selection System
//========================================================================================================================

kiubyxmd({
  pattern: "setfont",
  aliases: ["changefont", "myfont"],
  category: "tools",
  description: "Choose a fancy font for all your outgoing messages"
},
  async (from, client, conText) => {
    const { reply, sender, react } = conText;

    const fonts = [
      "Normal", "𝔉𝔞𝔫𝔠𝔶 𝔉𝔬𝔫𝔱", "𝓕𝓪𝓷𝓬𝔂 𝓕𝓸𝓷𝓽", "𝓯𝓪𝓷𝓬𝔂 𝓯𝓸𝓷𝓽", "𝔽𝕒𝕟𝕔𝕪 𝔽𝕠𝕟𝕥", "ғᴀɴᴄʏ ғᴏɴᴛ", "ꜰᴀɴᴄʏ ꜰᴏɴᴛ", "ℱ𝒶𝓃𝒸𝓎 ℱℴ𝓃𝓉", "🄵🄰🄽🄲🅈 🄵🄾🄽🅃", "Ⓕⓐⓝⓒⓨ Ⓕⓞⓝⓣ", "fαиcy fσит", "⨍αɳƈყ ⨍σɳƚ", "ʄąŋƈყ ʄơŋɬ", "fthncth fthnt", "fαи¢у fσит", "₣₳₦₵Ɏ ₣Ø₦₮", "千卂几匚ㄚ 千ㄖ几ㄒ", "fancч fσnt", "FΛПCY FӨПT", "ₘY Fₒₙₜ"
    ];

    let caption = `✨ *KIUBY-XMD FONT SELECTOR*\n\n`;
    fonts.forEach((f, i) => {
      caption += `${i}. ${f}\n`;
    });
    caption += `\n📌 Reply with the font number to select it.`;

    const sent = await reply(caption);
    const messageId = sent.key.id;

    client.ev.on("messages.upsert", async (update) => {
      const msg = update.messages[0];
      if (!msg.message) return;
      const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
      const isReply = msg.message.extendedTextMessage?.contextInfo?.stanzaId === messageId;
      if (!isReply) return;

      const num = parseInt(responseText.trim());
      if (isNaN(num) || num < 0 || num >= fonts.length) {
        return reply("❌ Invalid font number.");
      }

      const { setFontPreference } = require('../core/database/fonts');
      await setFontPreference(sender, num);
      await react("✅");
      await reply(`✅ Font updated to style #${num}. All your messages will now be edited to this font.`);
    });
  });
