const { kiubyxmd, commands } = require('../core/commandHandler');
const fs = require("fs");
const path = require("path");
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
//const { kiubyxmd } = require("../commandHandler");

kiubyxmd({
  pattern: "groupanon",
  aliases: ["ganon", "grouptext"],
  description: "Send custom text or quoted media anonymously to one or more groups",
  category: "Anonymous",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, arg, quoted, quotedMsg, reply, isSuperUser, prefix } = conText;

  if (!isSuperUser) return reply("You are not authorised to use this command !!!");

  if (!arg[0] && !quotedMsg) {
    return reply(
      `Usage:\n${prefix}groupanon <message> | <groupJid[,groupJid,...]>\n${prefix}groupanon <groupJid[,groupJid,...]> (with quoted media)`
    );
  }

  // Join args back into one string
  const text = arg.join(" ");
  const parts = text.split("|");

  let message = "";
  let groups = [];

  if (parts.length === 1) {
    // Either ".groupanon <groupJid>" or ".groupanon <message>"
    if (quotedMsg) {
      groups = parts[0].split(",").map(x => x.trim()).filter(x => x !== "");
    } else {
      return reply("❌ Please provide a group JID after '|'");
    }
  } else {
    message = parts[0].trim();
    groups = parts[1].split(",").map(x => x.trim()).filter(x => x !== "");
  }

  if (groups.length === 0) return reply("❌ Please provide at least one group JID");

  reply(`⏳ Sending to groups: ${groups.join(", ")}`);

  try {
    for (const group of groups) {
      const jid = group.endsWith("@g.us") ? group : group + "@g.us";

      if (quotedMsg) {
        if (quoted?.imageMessage) {
          const caption = message || quoted.imageMessage.caption || "";
          const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage);
          await client.sendMessage(jid, { image: { url: filePath }, caption });
        } else if (quoted?.videoMessage) {
          const caption = message || quoted.videoMessage.caption || "";
          const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage);
          await client.sendMessage(jid, { video: { url: filePath }, caption });
        } else if (quoted?.audioMessage) {
          const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage);
          await client.sendMessage(jid, { audio: { url: filePath }, mimetype: "audio/mpeg", ptt: true });
        } else if (quoted?.stickerMessage) {
          const filePath = await client.downloadAndSaveMediaMessage(quoted.stickerMessage);
          await client.sendMessage(jid, { sticker: { url: filePath } });
        } else {
          const body = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || message;
          await client.sendMessage(jid, { text: body });
        }
      } else {
        // No quoted message, just send text
        await client.sendMessage(jid, { text: message });
      }
    }

    reply(`✅ Message sent to groups: ${groups.join(", ")}`);
  } catch (err) {
    console.error("groupanon command error:", err);
    reply("❌ Failed to send your message.");
  }
});
//========================================================================================================================

kiubyxmd({
  pattern: "text",
  aliases: ["anonymous", "anon", "textmess"],
  description: "Send custom text or quoted media anonymously to one or more numbers",
  category: "Anonymous",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, arg, quoted, quotedMsg, reply, isSuperUser, prefix } = conText;

  if (!isSuperUser) return reply("You are not authorised to use this command !!!");

  if (!arg[0] && !quotedMsg) {
    return reply(
      `Usage:\n${prefix}text <message> | <number[,number,...]>\n${prefix}text <number[,number,...]> (with quoted media)`
    );
  }

  // Join args back into one string
  const text = arg.join(" ");
  const parts = text.split("|");

  let message = "";
  let numbers = [];

  if (parts.length === 1) {
    // Either ".anon <number>" or ".anon <message>"
    if (quotedMsg) {
      numbers = parts[0].split(",").map(x => x.trim()).filter(x => x !== "");
    } else {
      return reply("❌ Please provide a target number after '|'");
    }
  } else {
    message = parts[0].trim();
    numbers = parts[1].split(",").map(x => x.trim()).filter(x => x !== "");
  }

  if (numbers.length === 0) return reply("❌ Please provide at least one target number");

  reply(`⏳ Sending to ${numbers.join(", ")}`);

  try {
    for (const number of numbers) {
      const jid = number.includes("@s.whatsapp.net") ? number : number + "@s.whatsapp.net";

      if (quotedMsg) {
        if (quoted?.imageMessage) {
          const caption = message || quoted.imageMessage.caption || "";
          const filePath = await client.downloadAndSaveMediaMessage(quoted.imageMessage);
          await client.sendMessage(jid, { image: { url: filePath }, caption });
        } else if (quoted?.videoMessage) {
          const caption = message || quoted.videoMessage.caption || "";
          const filePath = await client.downloadAndSaveMediaMessage(quoted.videoMessage);
          await client.sendMessage(jid, { video: { url: filePath }, caption });
        } else if (quoted?.audioMessage) {
          const filePath = await client.downloadAndSaveMediaMessage(quoted.audioMessage);
          await client.sendMessage(jid, { audio: { url: filePath }, mimetype: "audio/mpeg", ptt: true });
        } else if (quoted?.stickerMessage) {
          const filePath = await client.downloadAndSaveMediaMessage(quoted.stickerMessage);
          await client.sendMessage(jid, { sticker: { url: filePath } });
        } else {
          const body = quotedMsg.conversation || quotedMsg.extendedTextMessage?.text || message;
          await client.sendMessage(jid, { text: body });
        }
      } else {
        // No quoted message, just send text
        await client.sendMessage(jid, { text: message });
      }
    }

    reply(`✅ Message sent to ${numbers.join(", ")}`);
  } catch (err) {
    console.error("anon command error:", err);
    reply("❌ Failed to send your message.");
  }
});
//========================================================================================================================

//const { kiubyxmd } = require("../commandHandler");

kiubyxmd({
  pattern: "toviewonce",
  aliases: ["tovo", "tovv", "vv"],
  description: "Send quoted media (image/video/audio) as view-once message",
  category: "General",
  filename: __filename
}, async (from, client, conText) => {
  const { mek, reply, ms } = conText;

  const quotedMsg = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
  if (!quotedMsg) return reply("❌ Reply to a media message (image, video, or audio) to make it view-once.");

  try {
    const mediaType = Object.keys(quotedMsg)[0];
    if (!['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage'].includes(mediaType)) {
      return reply("❌ This message type is not supported for view-once conversion.");
    }

    const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
    const type = mediaType.replace('Message', '');
    const stream = await downloadContentFromMessage(quotedMsg[mediaType], type);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
      buffer = Buffer.concat([buffer, chunk]);
    }

    const msg = {};
    msg[type] = buffer;
    msg.viewOnce = true;
    if (quotedMsg[mediaType].caption) msg.caption = quotedMsg[mediaType].caption;

    await client.sendMessage(from, msg, { quoted: mek });
  } catch (e) {
    console.error("View-Once Error:", e);
    reply("❌ Failed to process view-once message. Ensure you are replying to a supported media type.");
  }
});
//========================================================================================================================
kiubyxmd({
  pattern: "commands",
  category: "General",
  description: "Show all available commands from commands.md",
  filename: __filename
}, async (from, client, { reply, prefix }) => {
  try {
    const commandsPath = path.join(__dirname, "../commands.md");
    if (!fs.existsSync(commandsPath)) {
      return reply("❌ `commands.md` not found in the root directory.");
    }

    const content = fs.readFileSync(commandsPath, "utf8");
    const readMore = String.fromCharCode(8206).repeat(4000);

    // Split the content into header and commands to insert readMore
    const lines = content.split("\n");
    const header = lines.slice(0, 5).join("\n");
    const rest = lines.slice(5).join("\n");

    const output = `${header}\n${readMore}\n${rest}`;
    reply(output);
  } catch (err) {
    console.error("commands command error:", err);
    reply("❌ Failed to read `commands.md`.");
  }
});
//========================================================================================================================

kiubyxmd({
  pattern: "getdesc",
  aliases: ["getdescription"],
  category: "General",
  description: "Show description of a given command"
},
  async (from, client, { q, reply }) => {
    const input = q?.trim().toLowerCase();
    if (!input) return reply("❌ Provide a command name.\nExample: getdesc play");

    const match = commands.find(cmd => cmd.pattern?.toLowerCase() === input);
    if (!match) return reply(`❌ No command found with name: *${input}*`);

    const desc = match.description || "No description provided.";
    reply(`📝 Description for *${input}*:\n\n${desc}`);
  });
//========================================================================================================================

kiubyxmd({
  pattern: "getcategory",
  aliases: ["getcat"],
  category: "General",
  description: "Show category of a given command"
},
  async (from, client, { q, reply }) => {
    const input = q?.trim().toLowerCase();
    if (!input) return reply("❌ Provide a command name.\nExample: getcategory play");

    const match = commands.find(cmd => cmd.pattern?.toLowerCase() === input);
    if (!match) return reply(`❌ No command found with name: *${input}*`);

    const category = match.category || "Uncategorized";
    reply(`📂 Category for *${input}* is: *${category}*`);
  });
//========================================================================================================================
kiubyxmd({
  pattern: "getalias",
  category: "General",
  aliases: ["getaliases"],
  description: "Show aliases for a given command"
},
  async (from, client, { q, reply }) => {
    const input = q?.trim().toLowerCase();
    if (!input) return reply("❌ Provide a command name.\nExample: getalias play");

    const match = commands.find(cmd => cmd.pattern?.toLowerCase() === input);
    if (!match) return reply(`❌ No command found with name: *${input}*`);

    const aliases = match.aliases || match.alias || [];
    const list = Array.isArray(aliases) ? aliases : [aliases];

    if (list.length === 0) return reply(`ℹ️ Command *${input}* has no aliases.`);

    const aliasText = list.map((a, i) => `▸ ${i + 1}. ${a}`).join('\n');
    reply(`🔎 Aliases for *${input}*:\n\n${aliasText}`);
  });
