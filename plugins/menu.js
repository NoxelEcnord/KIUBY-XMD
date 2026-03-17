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
    "⚙️ MAIN FRAME": ["settings", "owner", "update", "repo"]
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

    // Check if local files exist
    if (fs.existsSync(localBg) || fs.existsSync(localLogo)) {
        const mediaPool = [localBg, localLogo].filter(p => fs.existsSync(p));
        return mediaPool[Math.floor(Math.random() * mediaPool.length)];
    }

    // High-quality fallbacks if local files are missing
    const fallbacks = [
        'https://files.catbox.moe/5i88b8.png',
        'https://files.catbox.moe/ak48ct.png'
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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
            } else if (index >= 4 && index <= 11) {
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
        aliases: ["help", "commands"],
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
            const greeting = moment().hour() < 12 ? "DAWN BREACH" : moment().hour() < 18 ? "CORE ACCESS" : "DUSK UPLINK";

            const options = `┌───────────────────────────────┐
│  1. 🌐 WEB PORTAL             │
│  2. 🎵 AUDIO UPLINK           │
│  3. 📢 CHANNEL AUTH           │
│  4. 🤖 NEURAL CORE            │
│  5. 📥 DOWNLINK HUB           │
│  6. 🎨 SYNTHETIC FORGE        │
│  7. 👥 NODE CONTROL           │
│  8. 🎮 CHAOS ROOM             │
│  9. 🔍 STALKER NET            │
│ 10. 🛠️ QUANTUM TOOLS          │
│ 11. ⚙️ MAIN FRAME             │
└───────────────────────────────┘
💡 *STAY TUNED:* Advanced exploits in next patch...
💡 Reply with a number (1-11) to access a sub-system.`;

            const header = `╭───────────────────────────────╮
│ 🛰️ MAINFRAME: KIUBY NEXTGEN
│ 🦾 OPERATOR: ${contactName}
│ 📊 UPLINK: STABLE
│ 🧬 PROTOCOL: NEURAL-X
╰───────────────────────────────╯
*${greeting}*, Agent *${contactName}*. Identity verified.`;

            const media = randomMedia();
            const isUrl = typeof media === "string" && media.startsWith("http");
            const isVideo = typeof media === "string" && media.match(/\.(mp4|gif)$/i);

            const msg = await client.sendMessage(from, {
                [isVideo ? 'video' : 'image']: isUrl ? { url: media } : fs.readFileSync(media),
                caption: `${header}\n\n${readMore}\n${options}`,
                contextInfo: XMD.getContextInfo('🛸 KIUBY NEXTGEN MAIN MENU', `Access: Granted | User: ${contactName}`)
            }, { quoted: contactMessage });

            if (!msg || !msg.key) return;
            global.menuSessions.set(msg.key.id, { from, contactMessage, pluginCommands });
            setTimeout(() => global.menuSessions.delete(msg.key.id), 600000);

            // Send Neural TTS Greeting with ROBOTIC voice filter
            try {
                const greetingText = `Neural connection established. Welcome back, Agent ${contactName}. KIUBY NEXTGEN Mainframe is at your disposal. System integrity nominal.`;
                const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(greetingText)}&tl=en&client=tw-ob`;

                // Download TTS audio first
                const tmpRaw = path.join('/tmp', `tts_raw_${Date.now()}.mp3`);
                const tmpRobot = path.join('/tmp', `tts_robot_${Date.now()}.ogg`);

                const ttsResponse = await axios({ url: ttsUrl, method: 'GET', responseType: 'arraybuffer', timeout: 15000 });
                fs.writeFileSync(tmpRaw, Buffer.from(ttsResponse.data));

                // Apply robotic voice filter: pitch down + flanger + echo + asetrate for darker tone
                const robotFilter = [
                    'asetrate=44100*0.8',           // Lower pitch for deeper voice
                    'aresample=44100',               // Resample back
                    'atempo=1.25',                   // Speed correction
                    'flanger=depth=3:speed=0.3',     // Robotic flanger
                    'aecho=0.8:0.7:20|40:0.5|0.3',  // Echo/reverb
                    'highpass=f=200',                 // Cut low rumble
                    'lowpass=f=3500'                  // Cut highs for radio effect
                ].join(',');

                await new Promise((resolve, reject) => {
                    exec(`ffmpeg -y -i "${tmpRaw}" -af "${robotFilter}" -c:a libopus -b:a 64k "${tmpRobot}"`, (err) => {
                        if (err) reject(err); else resolve();
                    });
                });

                const robotBuffer = fs.readFileSync(tmpRobot);
                await client.sendMessage(from, {
                    audio: robotBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true,
                    contextInfo: XMD.getContextInfo('🔊 NEURAL GREETING', 'Identity: Verified')
                }, { quoted: msg });

                // Cleanup temp files
                try { fs.unlinkSync(tmpRaw); } catch (e) { }
                try { fs.unlinkSync(tmpRobot); } catch (e) { }
            } catch (e) {
                console.error("Robotic TTS Error:", e.message);
            }
        } catch (err) {
            console.error("Menu Error:", err);
            client.sendMessage(from, { text: "Mainframe error. Try .help" });
        }
    }
);
