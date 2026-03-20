const { kiubyxmd } = require("../core/commandHandler");
const moment = require("moment-timezone");
const s = require(__dirname + "/../config");
const XMD = require("../core/xmd");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

const PREFIX = s.PREFIX || ".";
const BOT_NAME = s.BOT || "KIUBY";
const WEB = XMD.WEB;
const GURL = XMD.CHANNEL_URL;
const readMore = String.fromCharCode(8206).repeat(4000);

// Global session tracking for menus
if (!global.menuSessions) {
    global.menuSessions = new Map();
}

const categories = {
    "🤖 NEURAL CORE": ["ai", "gpt", "ai-tools"],
    "📥 DOWNLINK HUB": ["downloader", "search", "media-dl", "play"],
    "🎨 SYNTHETIC FORGE": ["sticker", "logo-effects", "photo", "video-effects"],
    "👥 NODE CONTROL": ["group", "general", "utility"],
    "🎮 CHAOS ROOM": ["fun", "games", "economy", "levels"],
    "🔍 STALKER NET": ["stalker", "system", "movie", "sports"],
    "🛠️ QUANTUM TOOLS": ["tools", "text-tools", "audio-tools", "encrypt", "url"],
    "⚙️ MAIN FRAME": ["settings", "owner", "update", "repo"],
    "🥋 NEURAL INFILTRATION": ["infiltration", "attack", "bug"]
};

const getpluginsCommands = () => {
    const commands = require("../core/commandHandler").commands;
    const pluginCmds = {};
    commands.forEach((cmd) => {
        if (cmd.filename && cmd.filename.includes("plugins")) {
            const category = (cmd.category || "General").toLowerCase();
            if (!pluginCmds[category]) pluginCmds[category] = [];
            pluginCmds[category].push(cmd.pattern);
        }
    });
    console.log(`[MENU DEBUG] Total Commands found: ${commands.length}`);
    console.log(`[MENU DEBUG] Categories found: ${Object.keys(pluginCmds).join(', ')}`);
    return pluginCmds;
};

const randomMedia = () => {
    return XMD.BOT_LOGO;
};

const setupGlobalReplyHandler = (client) => {
    if (global.menuReplyHandlerActive) return;

    client.ev.on("messages.upsert", async (update) => {
        const message = update.messages[0];
        if (!message?.message) return;

        const contextInfo = message.message.extendedTextMessage?.contextInfo;
        const quotedStanzaId = contextInfo?.stanzaId;
        if (!quotedStanzaId) return;

        const session = global.menuSessions.get(quotedStanzaId);
        if (!session) return;

        const text = message.message.extendedTextMessage?.text?.trim() || message.message.conversation?.trim();
        if (!text) return;

        const index = parseInt(text);
        if (isNaN(index)) return;

        const { from, contactMessage, pluginCommands } = session;

        const menuReactions = {
            1: '🌐', 2: '🎵', 3: '📢', 4: '🤖', 5: '🎨', 6: '📥', 7: '👥',
            8: '😂', 9: '🌍', 10: '⚽', 11: '🔧', 12: '🥋', 13: '⚙️', 14: '🔗'
        };

        try {
            await client.sendMessage(from, { react: { text: menuReactions[index] || '📋', key: message.key } });

            if (index === 1) {
                await client.sendMessage(from, {
                    text: `🌐 *${BOT_NAME} WEB PORTAL*\n\nExplore our mainframe via the web:\n${WEB}\n\n*Hacker Mode:* Enabled\n*Uplink:* Optimal`,
                    contextInfo: XMD.getContextInfo('🌐 WEB PORTAL', 'Established Mainframe Connection')
                }, { quoted: contactMessage });
            } else if (index === 2) {
                const songArr = await axios.get(XMD.API.DOWNLOAD.AUDIO(XMD.THEME_SONG_URL), { timeout: 15000 }).then(res => res.data?.result).catch(() => null);
                if (songArr) {
                    await client.sendMessage(from, {
                        audio: { url: songArr }, mimetype: 'audio/mpeg', ptt: true,
                        contextInfo: XMD.getContextInfo('🎵 CORE AUDIO', 'Transmitting Corazon...')
                    }, { quoted: contactMessage });
                }
            } else if (index === 3) {
                await client.sendMessage(from, {
                    text: `📢 *${BOT_NAME} SATELLITE CHANNEL*\n\nJoin our neural network for updates:\n${GURL}`,
                    contextInfo: XMD.getContextInfo('📢 CHANNEL AUTH', 'Satellite Link Active')
                }, { quoted: contactMessage });
            } else if (index >= 4 && index <= 12) {
                const names = Object.keys(categories);
                const catName = names[index - 4];
                if (catName) {
                    const keys = categories[catName];
                    let list = [];
                    const pCmds = pluginCommands;
                    keys.forEach(k => { if (pCmds[k]) list = list.concat(pCmds[k].map(p => `• ${PREFIX}${p}`)); });
                    await client.sendMessage(from, {
                        text: `📋 *${catName}*\n\n${list.length > 0 ? list.join("\n") : "No modules found."}\n\n_Reply 0 to reset._`,
                        contextInfo: XMD.getContextInfo(`📋 ${catName} MODULES`, 'Decrypting Sub-Systems...')
                    }, { quoted: contactMessage });
                }
            }
        } catch (e) {
            console.error("Menu Session Error:", e);
        }
    });
    global.menuReplyHandlerActive = true;
};

kiubyxmd(
    {
        pattern: "menu",
        aliases: ["help"],
        category: "general",
        description: "Comprehensive KIUBY Mainframe Menu",
    },
    async (from, client, conText) => {
        const { mek, pushName, sender, reply } = conText;
        try {
            const pluginCommands = getpluginsCommands();
            const contactName = pushName || "User";
            const moment = require('moment-timezone');
            const greeting = moment().tz('Africa/Nairobi').hour() < 12 ? "Good Morning" : moment().tz('Africa/Nairobi').hour() < 18 ? "Good Afternoon" : "Good Evening";

            // Header Section
            const header = `╔══════════════════════════════╗
║  K̷I̷U̷B̷Y̷  X̷M̷D̷  N̷E̷X̷T̷  ║
╠══════════════════════════════╣
║  Hello @${contactName}             ║
║  🌆 ${greeting}                ║
║  ⚡ Uplink: STABLE            ║
║  🧬 Protocol: VEGETA-NEON     ║
╚══════════════════════════════╝`;

            // Category & Emoji Mapping
            const categoryMapping = {
                "general": { emoji: "🏮", title: "CORE SYSTEM" },
                "tools": { emoji: "🥷", title: "SAYAN TOOLS" },
                "media": { emoji: "🌊", title: "NEURAL MEDIA" },
                "system": { emoji: "☢️", title: "KERNEL PROTOCOLS" },
                "ai": { emoji: "🧬", title: "NEURAL-AI" },
                "fun": { emoji: "🎭", title: "GHOST DYNAMICS" },
                "group": { emoji: "🦾", title: "SQUADRON OPS" },
                "nsfw": { emoji: "💀", title: "DARK SECTOR" },
                "owner": { emoji: "👑", title: "MAINFRAME ROOT" },
                "download": { emoji: "⚡", title: "FAST DOWNLOAD" },
                "search": { emoji: "🧿", title: "CYBER SEARCH" }
            };

            // Process Commands into Categories
            let menuContent = "";
            const sortedCategories = Object.keys(pluginCommands).sort();

            for (const category of sortedCategories) {
                if (category.toLowerCase() === 'general' || category.toLowerCase() === 'system' && category !== 'system') continue;

                const style = categoryMapping[category.toLowerCase()] || { emoji: "🔹", title: category.toUpperCase() };
                menuContent += `\n╭────── ${style.emoji} ──────╮\n`;
                menuContent += `│ ✦ ${style.title} ✦ │\n`;
                menuContent += `╰────── ${style.emoji} ──────╯\n`;

                const commands = pluginCommands[category];
                commands.sort().forEach(cmd => {
                    menuContent += `${style.emoji}  \`.${cmd}\`  \n`;
                });
            }

            const footer = `\n╔══════════════════════════════╗
║  Powered by KIUBY-XMD 🥀    ║
║  ecnord                     ║
║  ©2025–2026                  ║
╚══════════════════════════════╝\n\n.kiuby-xmd.`;

            const fullMenu = `${header}\n${menuContent}${footer}`;

            const thematicImage = XMD.BOT_LOGO;

            await reply({
                image: { url: thematicImage },
                caption: fullMenu,
                contextInfo: {
                    mentionedJid: [sender],
                }
            });

        } catch (e) {
            console.error("Menu Generation Error:", e);
        }
    }
);
