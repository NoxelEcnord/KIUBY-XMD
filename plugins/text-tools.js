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
      if (!sent || !sent.key) return;
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
      const { pushName } = conText;
      const greeting = `Hello ${pushName || 'User'}, `;
      const fullText = greeting + text;

      // Neural TTS with personalized greeting and 1.5x speed optimization
      // tl: language, q: text, ttsspeed: 0.8 (Google interprets <1 as faster in some clients/proxies)
      // Actually, standardizing with a more natural voice:
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(fullText)}&tl=en&client=tw-ob&ttsspeed=0.8`;

      await client.sendMessage(from, {
        audio: { url: ttsUrl },
        mimetype: "audio/mpeg",
        ptt: true,
        contextInfo: XMD.getContextInfo('🔊 NEURAL UPLINK', `User: ${pushName || 'Infiltrator'}`)
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
    const { reply, sender, react, q, args } = conText;
    const { fontLabels } = require('../core/lib/fontStyles');
    const { setFontPreference } = require('../core/database/fonts');

    // If argument provided (e.g., .setfont 5), set directly
    if (q && !isNaN(parseInt(q))) {
      const num = parseInt(q);
      if (num < 0 || num >= fontLabels.length) {
        return reply(`❌ Invalid font number. Please choose between 0 and ${fontLabels.length - 1}.`);
      }
      await setFontPreference(sender, num);
      await react("✅");
      return reply(`✅ Font updated to style #${num} (${fontLabels[num]}). Your outgoing texts will now be auto-styled.`);
    }

    // Otherwise show list with previews and wait for reply
    let caption = `✨ *KIUBY-XMD FONT SELECTOR*\n\n`;
    const { applyFont } = require('../core/lib/fontStyles');

    fontLabels.forEach((label, i) => {
      // Create a preview of the font name/label using its own style
      const preview = applyFont(label, i);
      caption += `*${i}.* ${preview}\n`;
    });

    caption += `\n📌 *Usage:* \`.setfont <number>\` or reply with a number to this message.`;

    const sent = await reply(caption);
    if (!sent || !sent.key) return;
    const messageId = sent.key.id;

    // Listener for reply
    client.ev.on("messages.upsert", async (update) => {
      try {
        const msg = update.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const responseText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const contextInfo = msg.message.extendedTextMessage?.contextInfo;
        const isReply = contextInfo?.stanzaId === messageId;

        if (!isReply) return;

        const num = parseInt(responseText?.trim());
        if (isNaN(num) || num < 0 || num >= fontLabels.length) {
          return client.sendMessage(msg.key.remoteJid, { text: "❌ Invalid font number." }, { quoted: msg });
        }

        await setFontPreference(sender, num);
        await client.sendMessage(msg.key.remoteJid, { react: { key: msg.key, text: "✅" } });
        await client.sendMessage(msg.key.remoteJid, { text: `✅ Font updated to style #${num} (${fontLabels[num]}).` }, { quoted: msg });
      } catch (e) {
        console.error("setfont listener error:", e);
      }
    });
  });
