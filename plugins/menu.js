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
    "1. AI MENU": ["ai", "gpt"],
    "2. EPHOTO MENU": ["ephoto", "photofunia"],
    "3. DOWNLOAD MENU": ["downloader", "search"],
    "4. GROUP MENU": ["group"],
    "5. SETTINGS MENU": ["settings", "owner"],
    "6. FUN MENU": ["fun"],
    "7. GENERAL MENU": ["general", "utility", "tools"],
    "8. SPORTS MENU": ["sports"],
    "9. STALKER MENU": ["stalker"],
    "10. STICKER MENU": ["sticker"],
    "11. SYSTEM MENU": ["system"],
    "12. EDUCATION MENU": ["education"],
    "13. SHORTENER MENU": ["shortener"],
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
    return pluginCmds;
};

const randomMedia = () => {
    const localBg = path.join(__dirname, "../core/public/kiuby_bg.png");
    const localLogo = path.join(__dirname, "../core/public/kiuby_logo.png");

    // Randomly pick between bg and logo or use logo as default
    const mediaPool = [localBg, localLogo].filter(p => fs.existsSync(p));
    if (mediaPool.length > 0) return mediaPool[Math.floor(Math.random() * mediaPool.length)];

    const combinedUrls = [...(s.BOT_URL || [])];
    const validUrls = combinedUrls.filter(url => typeof url === "string" && url.trim().startsWith("http"));
    return validUrls.length > 0 ? validUrls[Math.floor(Math.random() * validUrls.length)] : XMD.BOT_LOGO;
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
            8: '⚙️', 9: '😂', 10: '🌍', 11: '⚽', 12: '🔍', 13: '🖼️', 14: '🔧', 15: '📚', 16: '🔗'
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
            } else if (index >= 4 && index <= 16) {
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
        category: "general",
        description: "Interactive KIUBY Mainframe Menu",
    },
    async (from, client, conText) => {
        const { mek, pushName, sender } = conText;
        try {
            setupGlobalReplyHandler(client);
            const pluginCommands = getpluginsCommands();
            const contactName = pushName || "User";
            const contactMessage = XMD.getContactMsg(contactName, sender?.split("@")[0] || "0");
            const greeting = moment().hour() < 12 ? "Dawn Breach" : moment().hour() < 18 ? "Core Access" : "Dusk Uplink";

            const options = `╭───『 KIUBY NEXTGEN 』───╮\n│\n│ 1. 🌐 WEB PORTAL    9. 😂 FUN MODULES\n│ 2. 🎵 AUDIO UPLINK  10. 🌍 GLOBAL UTIL\n│ 3. 📢 CHANNEL AUTH   11. ⚽ SPORT LIVE\n│ 4. 🤖 AI NEURALS    12. 🔍 STALKER VIEW\n│ 5. 🎨 EPHOTO LAB     13. 🖼️ STICKER FORGE\n│ 6. 📥 DATA SIPHON   14. 🔧 SYS MAINT\n│ 7. 👥 GROUP HUB      15. 📚 EDU ARCHIVE\n│ 8. ⚙️ SYS CONFIG     16. HOOK URL SHREDDER\n│\n╰─────────────────────╯\n💡 Reply with a number (1-16)`;

            const header = `╭───────────────╮\n│ 🤖 Entity: KIUBY NEXTGEN\n│ 📊 Status: Optimal\n│ 🛰️ Uplink: Established\n│ 🦾 AI: NEURAL-X\n╰───────────────╯\n${greeting}, *${contactName}*! Welcome to the Mainframe.`;

            const media = randomMedia();
            const msg = await client.sendMessage(from, {
                [media.match(/\.(mp4|gif)$/i) ? 'video' : 'image']: media.startsWith("http") ? { url: media } : fs.readFileSync(media),
                caption: `${header}\n\n${readMore}\n${options}`,
                contextInfo: XMD.getContextInfo('🛸 KIUBY NEXTGEN MAIN MENU', `Access: Granted | User: ${contactName}`)
            }, { quoted: contactMessage });

            global.menuSessions.set(msg.key.id, { from, contactMessage, pluginCommands });
            setTimeout(() => global.menuSessions.delete(msg.key.id), 600000);

            // Audio Greeting follow-up (Rephrased for Hacker Persona)
            try {
                const greetingText = `Mainframe uplink established. Identity verified as ${contactName}. Accessing KIUBY NEXTGEN sub-systems. Neural link secure.`;
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(greetingText)}&tl=en&client=tw-ob`;
                await client.sendMessage(from, {
                    audio: { url: ttsUrl },
                    mimetype: 'audio/mp4',
                    ptt: true,
                    contextInfo: XMD.getContextInfo('🔊 NEURAL GREETING', 'Identity: Verified')
                }, { quoted: msg });
            } catch (e) { }
        } catch (err) {
            console.error("Menu Error:", err);
            client.sendMessage(from, { text: "Mainframe error. Try .help" });
        }
    }
);
