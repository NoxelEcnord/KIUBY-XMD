
const { kiubyxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');
const {
  saveConversation,
  getConversationHistory,
  clearConversationHistory,
  getLastConversation
} = require('../core/database/gpt');
//========================================================================================================================
//========================================================================================================================

kiubyxmd({
  pattern: "gpt",
  aliases: ['ai', 'ask'],
  //react: "🤖",
  category: "gpt",
  description: "Chat with GPT AI",
}, async (from, client, conText) => {
  const { mek, reply, react, arg, sender, pushName, ms } = conText;

  const quotedMsg = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || "";

  let question = arg.join(' ');
  if (!question && quotedText) {
    question = quotedText;
  }

  if (!question) {
    await react("❓");
    return reply(`🤖 *KIUBY-XMD GPT AI*\n\nAsk me anything or reply to a message!\n\nExample: gpt What is JavaScript?`);
  }

  try {
    await react("⏳");

    // Get last conversation for context
    const lastConv = await getLastConversation(sender);
    let context = '';

    if (lastConv) {
      context = `Previous conversation:\nYou: ${lastConv.user}\nAI: ${lastConv.ai}\n\nCurrent question: ${question}`;
    }

    const systemPrompt = `[System: You are KIUBY-XMD, a WhatsApp AI assistant made by ecnord. You are NOT Keith AI and NOT made by Keithkeizzah. Only mention your name or creator if the user asks who you are or who made you. Otherwise just reply naturally without introducing yourself.]\n`;
    const fullQuery = systemPrompt + (context || question);

    let aiResponse = null;

    // Define a list of AI API endpoints to try in order
    const aiEndpoints = [
      {
        name: "Gemini (BK9)",
        url: `https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.BK9
      },
      {
        name: "Llama (BK9)",
        url: `https://api.bk9.dev/ai/llama?q=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.BK9
      },
      {
        name: "Gemini (Vreden)",
        url: `https://api.vreden.my.id/api/ai/gemini?query=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.result
      },
      {
        name: "GPT-4 (Gifted)",
        url: `https://api.giftedtech.my.id/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.result
      },
      {
        name: "ChatGPT (Maher-Zubair)",
        url: `https://api.maher-zubair.tech/ai/chatgpt?q=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.result
      },
      {
        name: "Blackbox (IT-Admin)",
        url: `https://it-admin.tech/api/ai/blackbox?q=${encodeURIComponent(fullQuery)}`,
        getData: (res) => res.data.result
      },
      {
        name: "Keith API Fallback",
        url: XMD.API.AI.GPT(context || question),
        getData: (res) => res.data.result
      }
    ];

    for (const api of aiEndpoints) {
      try {
        const res = await axios.get(api.url, { timeout: 10000 });
        const data = api.getData(res);
        if (data && data.length > 0) {
          aiResponse = data;
          console.log(`[AI] Success with ${api.name}`);
          break;
        }
      } catch (e) {
        console.error(`[AI] ${api.name} failed:`, e.message);
      }
    }

    if (aiResponse) {
      await saveConversation(sender, question, aiResponse);
      await react("✅");
      await reply(`${aiResponse}`);
    } else {
      await react("❌");
      await reply("❌ Sorry, I couldn't process your request at the moment.");
    }

  } catch (error) {
    console.error("gpt error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
kiubyxmd({
  pattern: "gpthistory",
  aliases: ['aihistory', 'chathistory'],
  //react: "📚",
  category: "gpt",
  description: "View GPT conversation history",
}, async (from, client, conText) => {
  const { reply, react, sender, pushName } = conText;

  try {
    await react("📚");

    const history = await getConversationHistory(sender, 5); // Last 5 conversations

    if (!history.length) {
      return reply(`📚 *Chat History*\n\nNo previous conversations found. Start chatting with *gpt <question>*`);
    }

    let historyMsg = `📚 *Chat History for ${pushName}*\n\n`;

    history.forEach((conv, index) => {
      const shortUser = conv.user.length > 30 ? conv.user.substring(0, 30) + '...' : conv.user;
      const shortAI = conv.ai.length > 30 ? conv.ai.substring(0, 30) + '...' : conv.ai;

      historyMsg += `*${index + 1}. You:* ${shortUser}\n   *AI:* ${shortAI}\n\n`;
    });

    historyMsg += `_Total conversations: ${history.length}_`;

    await reply(historyMsg);

  } catch (error) {
    console.error("gpt history error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================
kiubyxmd({
  pattern: "lastchat",
  aliases: ['last conversation', 'previous chat'],
  react: "🕒",
  category: "gpt",
  description: "Get last GPT conversation",
}, async (from, client, conText) => {
  const { reply, react, sender, pushName } = conText;

  try {
    //  await react("🕒");

    const lastConv = await getLastConversation(sender);

    if (!lastConv) {
      return reply(`🕒 *Last Conversation*\n\nNo previous conversation found. Start chatting with *gpt <question>*`);
    }

    const lastChatMsg = `🕒 *Last Conversation*\n\n💬 *You:* ${lastConv.user}\n\n🤖 *AI:* ${lastConv.ai}`;

    await reply(lastChatMsg);

  } catch (error) {
    console.error("lastchat error:", error);
    //  await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});
//========================================================================================================================

kiubyxmd({
  pattern: "clearai",
  aliases: ['cleargpt', 'clearchat', 'deletehistory'],
  //react: "🗑️",
  category: "gpt",
  description: "Clear GPT conversation history",
}, async (from, client, conText) => {
  const { reply, react, sender, pushName } = conText;

  try {
    await react("🗑️");

    const cleared = await clearConversationHistory(sender);

    if (cleared) {
      await reply(`🗑️ *Chat History Cleared*\n\nAll your conversation history with GPT has been deleted successfully.`);
    } else {
      await reply(`ℹ️ *No History Found*\n\nYou don't have any conversation history to clear.`);
    }

  } catch (error) {
    console.error("clearai error:", error);
    await react("❌");
    await reply(`❌ Error: ${error.message}`);
  }
});

//========================================================================================================================
