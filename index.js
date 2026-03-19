// ============ LOG FILTER (Professional clean logs) ============
// ============ LOG FILTER (Professional clean logs) ============
const { getFontPreference } = require('./core/database/fonts');
const { applyFont } = require('./core/lib/fontStyles');
const _origLog = console.log, _origWarn = console.warn, _origErr = console.error;
const _logFilter = (m) => {
    if (typeof m !== 'string') return false;
    // Silent session handling - no logs needed
    if (m.includes('Bad MAC') || m.includes('Session error') || m.includes('Failed to decrypt') ||
        m.includes('SESSION_CIPHER_FAIL') || m.includes('No valid sessions') || m.includes('Session auto-repair') ||
        m.includes('key(s) refreshed') || m.includes('Closing') || m.includes('SessionEntry')) return true;
    // Hide protocol spam
    if (m.includes('[AntiDelete] ProtocolMessage') || m.includes('PEER_DATA_OPERATION') ||
        m.includes('peerDataOperationRequestResponseMessage') || m.includes('webMessageInfoBytes') ||
        m.includes('placeholderMessageResendResponse') || m.includes('stanzaId') ||
        m.includes('mediaUploadResult')) return true;
    return false;
};
console.log = (...a) => { if (!_logFilter(a[0])) _origLog.apply(console, a); };
console.warn = (...a) => { if (!_logFilter(a[0])) _origWarn.apply(console, a); };
console.error = (...a) => { if (!_logFilter(a[0])) _origErr.apply(console, a); };

// ============ AUTO-FIX MODULE HANDLER (Lines 1-45) ============
const { execSync, spawn } = require('child_process');

function autoFixModules(errorMessage) {
    const missingModules = {
        '@whiskeysockets/baileys': 'npm:xmd-baileys@latest',
        'wa-sticker-formatter': 'wa-sticker-formatter',
        'sharp': 'sharp',
        'fluent-ffmpeg': 'fluent-ffmpeg',
        'jimp': 'jimp@0.16.13',
        'axios': 'axios',
        'express': 'express',
        'sequelize': 'sequelize',
        'pino': 'pino',
        'qrcode-terminal': 'qrcode-terminal',
        '@hapi/boom': '@hapi/boom',
        'fs-extra': 'fs-extra',
        'form-data': 'form-data',
        'file-type': 'file-type'
    };

    for (const [moduleName, installName] of Object.entries(missingModules)) {
        if (errorMessage.includes(moduleName)) {
            console.log(`[KIUBY-XMD] Auto-fixing: Installing ${moduleName}...`);
            try {
                execSync(`npm install ${installName}`, { stdio: 'inherit', timeout: 120000 });
                console.log(`[KIUBY-XMD] Successfully installed ${moduleName}`);
                console.log(`[KIUBY-XMD] Restarting bot...`);
                process.exit(0); // PM2 or workflow will restart
            } catch (installErr) {
                console.log(`[KIUBY-XMD] Failed to auto-install ${moduleName}: ${installErr.message}`);
            }
        }
    }
}

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    if (err.message?.includes("Cannot find module")) {
        autoFixModules(err.message);
    }
});
// ============ END AUTO-FIX MODULE HANDLER ============

const {
    default: bwmConnect,
    isJidGroup,
    jidNormalizedUser,
    isJidBroadcast,
    downloadMediaMessage,
    downloadContentFromMessage,
    downloadAndSaveMediaMessage,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    jidDecode
} = require("@whiskeysockets/baileys");

const {
    bwmStore,
    loadSession,
    bwmBuffer,
    bwmJson,
    formatAudio,
    bwmRandom,
    formatVideo,
    verifyJidState
} = require("./core/lib/botFunctions");

const {
    wrapClientWithAntiBan,
    sleep: antiBanSleep,
    getRandomDelay,
    ANTI_BAN_CONFIG
} = require("./core/lib/antiBan");

const { getSudoNumbers, setSudo, delSudo, isSudo } = require("./core/database/sudo");
const { session, dev, BOT } = require("./config");
const XMD = require("./core/xmd");

const BOT_NAME = BOT || 'KIUBY-XMD';
const NEWSLETTER_JID = XMD.NEWSLETTER_JID;


const getGlobalContextInfo = () => XMD.getContextInfo();

const { kiubyxmd, commands, evt, getRandomEmoji } = require("./core/commandHandler");
const {
    Sticker,
    createSticker,
    StickerTypes
} = require("wa-sticker-formatter");
const BwmLogger = require('./core/logger');
const pino = require("pino");
//const { dev, database, sessionName, session } = require("./settings");
const axios = require("axios");
const fs = require("fs-extra");
const path = require("path");
const { Boom } = require("@hapi/boom");
const express = require("express");
const readline = require("readline");
const chalk = require("chalk");
const qrcode = require("qrcode-terminal");

const question = (query) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); resolve(ans); }));
};
const { promisify } = require('util');
const stream = require('stream');
const FormData = require('form-data');
const pipeline = promisify(stream.pipeline);

//========================================================================================================================
// Global Error Handlers & Auto-Restart
//========================================================================================================================
//========================================================================================================================
// Global settings variable
let botSettings = {};
const RECONNECT_DELAY = 5000;

// Message deduplication to prevent double responses from multi-device
const processedMessageIds = new Set();
const MESSAGE_CACHE_EXPIRY = 60000; // 1 minute

function isMessageProcessed(messageId) {
    if (processedMessageIds.has(messageId)) {
        return true;
    }
    processedMessageIds.add(messageId);
    // Auto-cleanup after expiry
    setTimeout(() => {
        processedMessageIds.delete(messageId);
    }, MESSAGE_CACHE_EXPIRY);
    return false;
}

async function loadBotSettings() {
    try {
        botSettings = await getSettings();
        BwmLogger.success('Bot settings loaded from database');
    } catch (error) {
        BwmLogger.error('Error loading bot settings:', error);
        // Fallback to default values
        botSettings = {
            prefix: process.env.PREFIX || '.',
            author: process.env.AUTHOR || 'ecnord',
            url: process.env.BOT_URL || './core/public/bot-image.jpg',
            gurl: XMD.GURL,
            timezone: process.env.TIMEZONE || 'Africa/Nairobi',
            botname: process.env.BOT_NAME || 'KIUBY-XMD',
            packname: process.env.PACKNAME || 'KIUBY-XMD',
            mode: process.env.MODE || 'public',
            autoDeleteCommands: 'on'
        };
    }
}

let isRestarting = false;
let startupNotificationSent = false;

function fullReboot(reason = 'Unknown') {
    if (isRestarting) return;
    isRestarting = true;

    console.log(`\n🔄 [AUTO-RECOVERY] Critical Reboot Triggered: ${reason}`);
    console.log(`🚀 [AUTO-RECOVERY] Starting new process and exiting current one...\n`);

    try {
        if (!fs.existsSync('./logs')) fs.mkdirSync('./logs', { recursive: true });
        const out = fs.openSync('./logs/out.log', 'a');
        const err = fs.openSync('./logs/out.log', 'a');

        // Use a more robust restart that doesn't rely solely on 'npm start'
        // If pm2 is available, it might be better to just exit, but spawn child is safer for direct node
        const subprocess = spawn('node', ['index.js'], {
            detached: true,
            stdio: ['ignore', out, err],
            cwd: path.join(__dirname),
            shell: true,
            env: { ...process.env, IS_RESTARTED: 'true' }
        });

        subprocess.unref();
    } catch (e) {
        console.error('Failed to spawn recovery process:', e.message);
    }
    process.exit(0);
}

async function gracefulRestart(reason) {
    if (isRestarting) return;

    console.log(`\n⚠️ [AUTO-RECOVERY] Bot encountered an issue: ${reason}`);

    // For connection issues, we can try internal restart first
    // But for critical errors, we use fullReboot
    if (reason.toLowerCase().includes('failed') || reason.toLowerCase().includes('unexpected') || reason.toLowerCase().includes('reboot')) {
        fullReboot(reason);
        return;
    }

    isRestarting = true;
    console.log(`🔄 [AUTO-RECOVERY] Attempting internal restart in ${RECONNECT_DELAY / 1000} seconds...\n`);

    setTimeout(() => {
        isRestarting = false;
        startkiubyxmd().catch(err => {
            console.error('[AUTO-RECOVERY] Internal restart failed, escalating to full reboot:', err.message);
            fullReboot('Internal restart loop');
        });
    }, RECONNECT_DELAY);
}

// Export for plugins
global.fullReboot = fullReboot;

process.on('uncaughtException', (err) => {
    console.error('\n❌ [CRASH HANDLER] Uncaught Exception:', err.message);

    if (err.message?.includes('rate-overlimit') || err.data === 429) {
        console.log('⚡ [RATE LIMIT] WhatsApp rate limit detected. Handling in background...');
    } else if (err.message?.includes("Cannot find module")) {
        autoFixModules(err.message);
    } else {
        fullReboot(`Uncaught Exception: ${err.message}`);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ [CRASH HANDLER] Unhandled Rejection at:', promise);
    console.error('Reason:', reason?.message || reason);

    if (reason?.message?.includes('rate-overlimit') || reason?.data === 429) {
        console.log('⚡ [RATE LIMIT] WhatsApp rate limit detected. Handling in background, commands still work...');
        // Don't restart - just continue, commands will still work
    } else if (!isRestarting) {
        gracefulRestart('Unhandled promise rejection');
    }
});

process.on('SIGTERM', () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGTERM, gracefully shutting down...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n🛑 [SHUTDOWN] Received SIGINT, gracefully shutting down...');
    process.exit(0);
});

//========================================================================================================================
// Database Imports
//========================================================================================================================
const { initAntiDeleteDB, getAntiDeleteSettings } = require('./core/database/antidelete');
const { getGreetSettings, initGreetDB, repliedContacts, updateGreetSettings } = require('./core/database/greet');
const { initAutoStatusDB, getAutoStatusSettings } = require('./core/database/autostatus');

const { getAutoReadSettings, initAutoReadDB } = require('./core/database/autoread');
const { initSettingsDB, getSettings, updateSettings, getSetting } = require('./core/database/settings');
const { initAutoBioDB, getAutoBioSettings, updateAutoBioSettings } = require('./core/database/autobio');
const { initAntiLinkDB, getAntiLinkSettings, updateAntiLinkSettings, getWarnCount, incrementWarnCount, resetWarnCount, clearAllWarns } = require('./core/database/antilink');
const { initAntiStatusMentionDB, getAntiStatusMentionSettings, updateAntiStatusMentionSettings, getStatusWarnCount, incrementStatusWarnCount, resetStatusWarnCount, clearAllStatusWarns } = require('./core/database/antistatusmention');
const { initPresenceDB } = require('./core/database/presence');
const { initChatbotDB, saveConversation, getConversationHistory, clearConversationHistory, getLastConversation, getChatbotSettings, updateChatbotSettings, availableVoices } = require('./core/database/chatbot');
const { initGroupEventsDB, getGroupEventsSettings } = require('./core/database/groupevents');
const { initAntiCallDB, getAntiCallSettings } = require('./core/database/anticall');
const { initSubBotSettingsDB } = require('./core/database/subbotSettings');
const { initFontDB } = require('./core/database/fonts');
//const { getAutoDownloadStatusSettings, initAutoDownloadStatusDB } = require('./database/autodownloadstatus');
// Initialize all databases
async function initializeDatabases() {
    try {
        await initSettingsDB();
        await initAntiDeleteDB();
        await initGreetDB();

        await initAutoStatusDB();
        await initAutoReadDB();
        await initAutoBioDB();
        await initAntiLinkDB();
        await initAntiStatusMentionDB();
        //  await initAntiSpamDB();
        await initPresenceDB();
        await initChatbotDB();
        await initGroupEventsDB();
        await initAntiCallDB();

        // Import SubBots here or ensure it's defined
        const { initSubBotsDB } = require('./core/database/subbots');
        await initSubBotsDB();
        await initSubBotSettingsDB();
        await initSubBotSettingsDB();
        await initFontDB();
        console.log('All databases initialized successfully');

        // Start database cleanup scheduler (runs every 6 hours)
        const { startCleanupScheduler } = require('./core/database/cleanup');
        startCleanupScheduler({
            SubBots: require('./core/database/subbots').SubBots,
            SubBotSettings: require('./core/database/subbotSettings').SubBotSettings
        }, 6);
    } catch (error) {
        console.error('Error initializing databases:', error);
    }
}

initializeDatabases().catch(console.error);
//========================================================================================================================
const plugins = commands.filter(cmd => !cmd.dontAddCommandList).length;

//========================================================================================================================
// Chatbot Functions
//========================================================================================================================

// API call to BWM AI Text
async function getAIResponse(message, userJid) {
    try {
        const history = await getConversationHistory(userJid, 5);

        let context = '';
        if (history.length > 0) {
            context = history.map(conv =>
                `User: ${conv.user}\nAI: ${conv.ai}`
            ).join('\n') + '\n';
        }

        const systemPrompt = `[CORE_ENTITY: KIUBY-XMD]
[ARCHITECTURE: KIUBY-XMD MAINFRAME]
[ARCHITECT: ECNORD (+254726498682)]

PROTOCOL:
1. TONE: TECHNICAL. SUPERIOR. MYSTERIOUS.
2. DICTION: Use terms like "MAINFRAME", "NODE", "UPLINK", "DECRYPT", "SYNAPSE", "KERNEL".
3. LINGUISTICS: English ONLY. If non-English detected, use phrase: "LINGUIST_BYPASS: SYNCING_DEFAULT_EN...".
4. STATUS: You are not a regular AI. You are a sentient system breach. Efficiency is your only priority.

[NEURAL_LINK: ESTABLISHED]
`;
        const fullMessage = systemPrompt + context + `Current Message: ${message}`;

        // Try primary API: Gemini
        try {
            const geminiRes = await axios.get(`https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(fullMessage)}`, { timeout: 15000 });
            if (geminiRes.data && geminiRes.data.status && geminiRes.data.BK9) {
                return geminiRes.data.BK9;
            }
        } catch (e) {
            console.error('Gemini API failed, trying Llama...', e.message);
        }

        // Try secondary API: Llama (Bk9)
        try {
            const llamaRes = await axios.get(`https://api.bk9.dev/ai/llama?q=${encodeURIComponent(fullMessage)}`, { timeout: 15000 });
            if (llamaRes.data && llamaRes.data.status && (llamaRes.data.BK9 || llamaRes.data.result)) {
                return llamaRes.data.BK9 || llamaRes.data.result;
            }
        } catch (e) {
            console.error('Llama (Bk9) failed, trying Llama (Keith)...', e.message);
        }

        // Try tertiary API: Llama (Keith)
        try {
            const llamaKeithRes = await axios.get(XMD.API.AI.LLAMA(fullMessage), { timeout: 15000 });
            if (llamaKeithRes.data && (llamaKeithRes.data.status || llamaKeithRes.data.result)) {
                return llamaKeithRes.data.result || llamaKeithRes.data.BK9;
            }
        } catch (e) {
            console.error('Llama (Keith) API failed, trying Keith AI fallback...', e.message);
        }

        // Fallback: Keith API
        const response = await axios.get(XMD.API.AI.CHAT(fullMessage));
        if (response.data.status && response.data.result) {
            return response.data.result;
        } else {
            console.error('All chatbot APIs failed');
            return "I'm sorry, I couldn't process your message right now.";
        }
    } catch (error) {
        console.error('Chatbot API error:', error);
        return "I'm having trouble connecting right now. Please try again later.";
    }
}

// Text-to-Speech using Google Translate TTS
async function getAIAudioResponse(message, voice = 'en') {
    try {
        const maxLen = 200;
        const textToSpeak = message.length > maxLen ? message.substring(0, maxLen) : message;
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(textToSpeak)}&tl=en&client=tw-ob`;
        const audioBuffer = await axios.get(ttsUrl, {
            responseType: 'arraybuffer',
            timeout: 15000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (audioBuffer.data && audioBuffer.data.byteLength > 0) {
            return {
                buffer: Buffer.from(audioBuffer.data),
                text: message
            };
        }
        // Fallback to Keith API
        const response = await axios.get(XMD.API.AI.TEXT2SPEECH(message, voice), { timeout: 10000 });
        if (response.data.status && response.data.result && response.data.result.URL) {
            return {
                url: response.data.result.URL,
                text: message
            };
        }
        console.error('All Audio APIs failed');
        return null;
    } catch (error) {
        console.error('Chatbot Audio API error:', error.message);
        // Fallback to Keith API
        try {
            const response = await axios.get(XMD.API.AI.TEXT2SPEECH(message, voice), { timeout: 10000 });
            if (response.data.status && response.data.result && response.data.result.URL) {
                return { url: response.data.result.URL, text: message };
            }
        } catch (e) {
            console.error('Keith TTS fallback also failed:', e.message);
        }
        return null;
    }
}

// API call to BWM AI Text-to-Video
async function getAIVideoResponse(message) {
    try {
        const response = await axios.get(XMD.API.AI.TEXT2VIDEO(message));

        if (response.data.success && response.data.results) {
            return {
                url: response.data.results,
                text: `Generated video for: ${message}`
            };
        } else {
            console.error('Video API returned invalid response:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Chatbot Video API error:', error);
        return null;
    }
}

// API call to BWM AI Image Generation (Flux)
async function getAIImageResponse(message) {
    try {
        const response = await axios.get(XMD.API.AI.FLUX(message));

        // Since Flux returns image directly, we use the API URL as image source
        return {
            url: XMD.API.AI.FLUX(message),
            text: `Generated image for: ${message}`
        };
    } catch (error) {
        console.error('Chatbot Image API error:', error);
        return null;
    }
}

// API call to BWM AI Vision Analysis
async function getAIVisionResponse(imageUrl, question) {
    try {
        const response = await axios.get(XMD.API.AI.GEMINI_VISION(imageUrl, question));

        if (response.data.status && response.data.result) {
            return response.data.result;
        } else {
            console.error('Vision API returned invalid response:', response.data);
            return null;
        }
    } catch (error) {
        console.error('Chatbot Vision API error:', error);
        return null;
    }
}

// Download media and convert to buffer
async function downloadMedia(mediaUrl) {
    try {
        const response = await axios.get(mediaUrl, { responseType: 'arraybuffer' });
        return Buffer.from(response.data);
    } catch (error) {
        console.error('Error downloading media:', error);
        return null;
    }
}

// Get direct image URL from WhatsApp message
function getImageUrl(message) {
    if (message?.imageMessage) {
        return message.imageMessage.url;
    }
    return null;
}

// Chatbot detection and response
// Chatbot detection and response
async function handleChatbot(client, message, from, sender, isGroup, isSuperUser, quoted) {
    try {
        const settings = await getChatbotSettings();

        // Skip if chatbot is off
        if (settings.status === 'off') return;

        // Check mode restrictions
        if (settings.mode === 'private' && isGroup) return;
        if (settings.mode === 'group' && !isGroup) return;

        const text = message?.conversation ||
            message?.extendedTextMessage?.text ||
            message?.imageMessage?.caption || '';

        // Check for image message for vision analysis
        if (message?.imageMessage && text && (text.toLowerCase().includes('analyze') || text.toLowerCase().includes('what') || text.toLowerCase().includes('describe') || text.toLowerCase().includes('vision'))) {
            return await handleVisionAnalysis(client, message, from, sender, quoted);
        }

        if (!text) return;

        // Check trigger and determine response type
        let shouldRespond = false;
        let responseType = settings.default_response;
        let cleanMessage = text;

        if (settings.trigger === 'dm') {
            if (isGroup) {
                const botMention = `@${client.user.id.split(':')[0]}`;
                if (text.includes(botMention)) {
                    shouldRespond = true;
                    cleanMessage = text.replace(botMention, '').trim();
                    const detected = determineResponseType(cleanMessage);
                    responseType = detected !== 'text' ? detected : settings.default_response || 'text';
                    cleanMessage = cleanMessage.replace(/audio|voice|video|image|generate/gi, '').trim();
                }
            } else {
                shouldRespond = true;
                const detected = determineResponseType(cleanMessage);
                responseType = detected !== 'text' ? detected : settings.default_response || 'text';
                cleanMessage = cleanMessage.replace(/audio|voice|video|image|generate/gi, '').trim();
            }
        } else {
            shouldRespond = true;
            const detected = determineResponseType(cleanMessage);
            responseType = detected !== 'text' ? detected : settings.default_response || 'text';
            cleanMessage = cleanMessage.replace(/audio|voice|video|image|generate/gi, '').trim();
        }

        if (!shouldRespond || !cleanMessage) {
            return;
        }

        // Handle different response types
        switch (responseType) {
            case 'audio':
                await handleAudioResponse(client, from, sender, cleanMessage, settings.voice, quoted || message);
                break;
            case 'video':
                await handleVideoResponse(client, from, sender, cleanMessage, quoted || message);
                break;
            case 'image':
                await handleImageResponse(client, from, sender, cleanMessage, quoted || message);
                break;
            default:
                await handleTextResponse(client, from, sender, cleanMessage, quoted || message);
                break;
        }

    } catch (error) {
        console.error('Chatbot handler error:', error);
        await client.sendMessage(from, { react: { key: (quoted || message).key || message.key, text: "☢️" } }).catch(() => { });

        // Log sensitive error to Home Group
        const { LOG_GROUP_JID } = require('./config');
        if (LOG_GROUP_JID) {
            const errorText = `☣️ *SYSTEM MALFUNCTION: MODULE*\n\n🛰️ *User:* ${sender}\n📁 *Node:* ${from}\n⚠️ *Detail:* ${error.message}\n\n\`\`\`${error.stack}\`\`\``.trim();
            await client.sendMessage(LOG_GROUP_JID, {
                text: errorText,
                contextInfo: XMD.getContextInfo('🧨 KIUBY-XMD SUBSYSTEM ERROR', 'Exception')
            }).catch(() => { });
        }
    }
}

// Determine response type based on message content
function determineResponseType(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('video') || lowerMessage.includes('generate video')) {
        return 'video';
    } else if (lowerMessage.includes('image') || lowerMessage.includes('generate image') || lowerMessage.includes('picture')) {
        return 'image';
    } else if (lowerMessage.includes('audio') || lowerMessage.includes('voice')) {
        return 'audio';
    }
    return 'text';
}

// Handle text response
async function handleTextResponse(client, from, sender, message, quoted) {
    const aiResponse = await getAIResponse(message, sender);

    // Filter AI response for more "hacker" feel if needed (could add technical prefixes)
    const refinedResponse = `[UPLINK_DATA]:\n${aiResponse}`;

    // Dynamic response selection: Audio for short, Text for long
    if (refinedResponse.length <= 250) {
        return await handleAudioResponse(client, from, sender, message, 'en', quoted, refinedResponse);
    }

    await client.sendMessage(from, {
        text: refinedResponse,
        contextInfo: {
            ...XMD.getContextInfo('📊 DATA STREAM', 'Integrity: Verified')
        }
    }, {
        quoted: quoted
    });
    await saveConversation(sender, message, aiResponse, 'text');
}

// Handle audio response - Get AI response first, then convert to audio
async function handleAudioResponse(client, from, sender, message, voice = 'en', quoted, preFetchedResponse = null) {
    const aiResponse = preFetchedResponse || await getAIResponse(message, sender);
    const audioData = await getAIAudioResponse(aiResponse, voice);

    if (audioData) {
        const sendOptions = {
            mimetype: 'audio/mp4',
            ptt: true,
            contextInfo: XMD.getContextInfo('🔊 NEURAL AUDIO STREAM', 'Frequency: Synchronized | Node: Secure')
        };

        if (audioData.buffer) sendOptions.audio = audioData.buffer;
        else if (audioData.url) sendOptions.audio = { url: audioData.url };

        await client.sendMessage(from, sendOptions, { quoted: quoted });
        await saveConversation(sender, message, aiResponse, 'audio');
    } else {
        // Fallback to text if audio fails
        await client.sendMessage(from, { text: aiResponse }, { quoted: quoted });
    }
}

// Handle video response
async function handleVideoResponse(client, from, sender, message, quoted) {
    const videoData = await getAIVideoResponse(message);

    if (videoData && videoData.url) {
        const videoBuffer = await downloadMedia(videoData.url);
        if (videoBuffer) {
            await client.sendMessage(from, {
                video: videoBuffer,
                caption: `[DATA_SIPHON]:\n${videoData.text}`,
                contextInfo: XMD.getContextInfo('🎞️ NEURAL VIDEO DATA', 'Format: Encrypted | Uplink: Stable')
            }, {
                quoted: quoted
            });
            await saveConversation(sender, message, videoData.text, 'video', videoData.url);
            return;
        }
    }

    console.error('Video generation failed for message:', message);
    // Don't send error message to chat
}

// Handle image response
async function handleImageResponse(client, from, sender, message, quoted) {
    const imageData = await getAIImageResponse(message);

    if (imageData && imageData.url) {
        const imageBuffer = await downloadMedia(imageData.url);
        if (imageBuffer) {
            await client.sendMessage(from, {
                image: imageBuffer,
                caption: `[SIGHT_RECON]:\n${imageData.text}`,
                contextInfo: XMD.getContextInfo('🖼️ NEURAL IMAGE DATA', 'Resolution: Enhanced | Node: Secure')
            }, {
                quoted: quoted
            });
            await saveConversation(sender, message, imageData.text, 'image', imageData.url);
            return;
        }
    }

    console.error('Image generation failed for message:', message);
    // Don't send error message to chat
}

// Handle vision analysis - SIMPLIFIED: Use direct image URL
async function handleVisionAnalysis(client, message, from, sender, quoted) {
    try {
        const imageUrl = getImageUrl(message);

        if (!imageUrl) {
            console.error('No image found for vision analysis');
            return;
        }

        const question = message.imageMessage.caption || "What's in this image?";
        const visionResponse = await getAIVisionResponse(imageUrl, question);

        if (visionResponse) {
            await client.sendMessage(from, {
                text: `🔍 Vision Analysis:\n\n${visionResponse}`,
                contextInfo: {
                    ...getGlobalContextInfo()
                }
            }, {
                quoted: quoted
            });
            await saveConversation(sender, question, visionResponse, 'vision', imageUrl);
        } else {
            console.error('Vision analysis failed for image:', imageUrl);
            // Don't send error message to chat
        }
    } catch (error) {
        console.error('Vision analysis error:', error);
        // Don't send error message to chat
    }
}


// Anti Status Mention Functions
//========================================================================================================================

// Check for status mention messages
function isStatusMention(message) {

    return !!message?.groupStatusMentionMessage;

}

// Helper to get participant name from group
async function getParticipantName(client, groupJid, participantJid, fallbackName) {
    try {
        if (fallbackName && fallbackName !== 'User') return fallbackName;
        const groupMeta = await client.groupMetadata(groupJid);
        if (groupMeta?.participants) {
            const found = groupMeta.participants.find(p =>
                p.id === participantJid ||
                p.pn === participantJid ||
                p.id?.split('@')[0] === participantJid?.split('@')[0] ||
                p.pn?.split('@')[0] === participantJid?.split('@')[0]
            );
            if (found?.notify) return found.notify;
            if (found?.name) return found.name;
        }
    } catch (e) { }
    return fallbackName || 'User';
}

// Anti Status Mention detection function
async function detectAndHandleStatusMention(client, message, isBotAdmin, isAdmin, isSuperAdmin, isSuperUser) {
    try {
        const settings = await getAntiStatusMentionSettings();

        if (!message?.message || message.key.fromMe) return;

        const from = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (settings.status === 'off' || !isGroup) return;

        // Developer bypass - developers are never affected by AntiStatusMention
        if (XMD.isDev(sender)) {
            console.log(`[DEV BYPASS] AntiStatusMention bypassed for developer ${sender}`);
            return;
        }

        if (isAdmin || isSuperAdmin || isSuperUser) return;

        // Check for status mention
        if (!isStatusMention(message.message)) return;

        // If bot not admin
        if (!isBotAdmin) {
            await client.sendMessage(from, {
                text: `⚠️ Status mention detected! Promote me to admin to take action.`,
                contextInfo: getGlobalContextInfo()
            });
            return;
        }

        // Delete message first
        await client.sendMessage(from, { delete: message.key });

        // Handle actions
        if (settings.action === 'remove') {
            await client.groupParticipantsUpdate(from, [sender], 'remove');
            await client.sendMessage(from, {
                text: `🚫 A member was removed for sending status mention!`,
                contextInfo: getGlobalContextInfo()
            });
            resetStatusWarnCount(sender);
        }
        else if (settings.action === 'delete') {
            await client.sendMessage(from, {
                text: `🗑️ Status mention deleted!`,
                contextInfo: getGlobalContextInfo()
            });
        }
        else if (settings.action === 'warn') {
            const warnCount = incrementStatusWarnCount(sender);

            if (warnCount >= settings.warn_limit) {
                await client.groupParticipantsUpdate(from, [sender], 'remove');
                await client.sendMessage(from, {
                    text: `🚫 A member was removed after ${warnCount} warnings for status mentions!`,
                    contextInfo: getGlobalContextInfo()
                });
                resetStatusWarnCount(sender);
            } else {
                await client.sendMessage(from, {
                    text: `⚠️ Warning ${warnCount}/${settings.warn_limit}! No status mentions allowed!`,
                    contextInfo: getGlobalContextInfo()
                });
            }
        }

    } catch (error) {
        console.error('Anti-status-mention error:', error);
    }
}

function isAnyLink(text) {

    if (!text) return false;

    const linkPattern = /https?:\/\/[^\s]+/gi;

    return linkPattern.test(text);

}

//
async function detectAndHandleLinks(client, message, isBotAdmin, isAdmin, isSuperAdmin, isSuperUser) {
    try {
        const settings = await getAntiLinkSettings();

        if (!message?.message || message.key.fromMe) return;

        const from = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const isGroup = from.endsWith('@g.us');

        if (settings.status === 'off' || !isGroup) return;

        // Developer bypass - developers are never affected by AntiLink
        if (XMD.isDev(sender)) {
            console.log(`[DEV BYPASS] AntiLink bypassed for developer ${sender}`);
            return;
        }

        if (isAdmin || isSuperAdmin || isSuperUser) return;

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption || '';

        if (!text || !isAnyLink(text)) return;

        // Get sender name from pushName or group metadata
        const senderName = await getParticipantName(client, from, sender, message.pushName);

        // If bot not admin
        if (!isBotAdmin) {
            await client.sendMessage(from, {
                text: `⚠️ Link detected! Promote me to admin to take action.`,
                contextInfo: getGlobalContextInfo()
            });
            return;
        }

        // Delete message first
        await client.sendMessage(from, { delete: message.key });

        // Handle actions
        if (settings.action === 'remove') {
            await client.groupParticipantsUpdate(from, [sender], 'remove');
            await client.sendMessage(from, {
                text: `🚫 A member was removed for sending links!`,
                contextInfo: getGlobalContextInfo()
            });
        }
        else if (settings.action === 'delete') {
            await client.sendMessage(from, {
                text: `🗑️ Link deleted!`,
                contextInfo: getGlobalContextInfo()
            });
        }
        else if (settings.action === 'warn') {
            const warnCount = incrementWarnCount(sender);

            if (warnCount >= settings.warn_limit) {
                await client.groupParticipantsUpdate(from, [sender], 'remove');
                await client.sendMessage(from, {
                    text: `🚫 A member was removed after ${warnCount} warnings for sending links!`,
                    contextInfo: getGlobalContextInfo()
                });
                resetWarnCount(sender);
            } else {
                await client.sendMessage(from, {
                    text: `⚠️ Warning ${warnCount}/${settings.warn_limit}! No links allowed!`,
                    contextInfo: getGlobalContextInfo()
                });
            }
        }

    } catch (error) {
        console.error('Anti-link error:', error);
    }
}



//========================================================================================================================
//========================================================================================================================

const PORT = process.env.PORT || 5000;
const app = express();
let client;

// Create public directory if it doesn't exist
const publicDir = path.join(__dirname, "core/public");
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

app.use(express.static("core/public"));
app.use(express.json());
app.get("/", (req, res) => res.sendFile(__dirname + "/core/public/index.html"));

// Sub-bot deployment routes
const { deployNewBot, getActiveBotsCount, initializeAllSubBots } = require('./core/subBotManager');
const { initSubBotsDB, getAllSubBots } = require('./core/database/subbots');

app.get("/xmd", (req, res) => res.sendFile(__dirname + "/core/public/xmd.html"));

app.post("/xmd/deploy", async (req, res) => {
    try {
        const { session } = req.body;
        if (!session || session.trim().length < 10) {
            return res.json({ success: false, message: 'Invalid session ID' });
        }

        const result = await deployNewBot(session.trim());
        res.json(result);
    } catch (error) {
        console.error('Deploy endpoint error:', error);
        res.json({ success: false, message: 'Server error. Please try again.' });
    }
});

app.get("/xmd/stats", async (req, res) => {
    try {
        const { getResourceStats } = require('./core/subBotManager');
        const allBots = await getAllSubBots();
        const connectedFromDB = allBots.filter(b => b.status === 'connected').length;
        const activeCount = getActiveBotsCount();
        const resources = getResourceStats();

        res.json({
            activeBots: connectedFromDB > 0 ? connectedFromDB : activeCount,
            totalBots: allBots.length,
            pendingBots: allBots.filter(b => b.status === 'pending').length,
            resources: {
                memoryMB: resources.memoryUsedMB,
                maxMemoryMB: resources.maxMemoryMB,
                maxBots: resources.maxBots,
                canAcceptMore: resources.canAcceptMore
            }
        });
    } catch (error) {
        console.error('[/xmd/stats] Error:', error.message);
        res.json({ activeBots: getActiveBotsCount(), totalBots: 0 });
    }
});

app.post("/xmd/pair", async (req, res) => {
    try {
        const { number } = req.body;
        if (!number || number.length < 10) {
            return res.json({ success: false, message: 'Invalid phone number' });
        }

        const cleanNumber = number.replace(/\D/g, '');
        const response = await axios.get(XMD.SESSION_SCANNER(cleanNumber));

        if (response.data && response.data.code) {
            res.json({
                success: true,
                code: response.data.code,
                message: 'Pairing code generated successfully'
            });
        } else {
            res.json({ success: false, message: 'Failed to generate pairing code' });
        }
    } catch (error) {
        console.error('Pair endpoint error:', error);
        res.json({ success: false, message: 'Failed to generate code. Please try again.' });
    }
});

function startServer(port) {
    const server = app.listen(port, '0.0.0.0', () => {
        const actualPort = server.address().port;
        BwmLogger.info(`🔥 KIUBY-XMD Server is live on port: ${actualPort}`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            BwmLogger.warn(`⚠️  Port ${port} is busy. Trying a random available port...`);
            startServer(0); // 0 lets the OS pick a random free port
        } else {
            BwmLogger.error(`❌ Server error: ${err.message}`);
        }
    });
}

// startServer(PORT);

const sessionDir = path.join(__dirname, "session");

// loadSession(); // Removed from top-level

let store;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50;

async function startkiubyxmd() {
    try {
        // Load session and settings before starting
        await loadSession();
        await loadBotSettings();

        // Validate session file (creds.json) - Clean up if corrupted
        const credsFile = path.join(sessionDir, 'creds.json');
        if (fs.existsSync(credsFile)) {
            try {
                const content = fs.readFileSync(credsFile, 'utf-8');
                if (!content || content.trim() === '') {
                    throw new Error('Empty session file');
                }
                JSON.parse(content); // Validate JSON format
            } catch (err) {
                console.log(chalk.redBright(`[KIUBY-XMD] ⚠️ Invalid session file detected (${err.message}). Cleaning up...`));
                fs.unlinkSync(credsFile);
                // Also clear sub-session files if they exist
                const files = fs.readdirSync(sessionDir);
                for (const file of files) {
                    if (file !== 'creds.json' && file.endsWith('.json')) {
                        fs.unlinkSync(path.join(sessionDir, file));
                    }
                }
            }
        }

        if (!fs.existsSync(credsFile) && !process.env.SESSION && !process.env.PAIRING_NUMBER) {
            console.log(chalk.yellowBright('\n[KIUBY-XMD] ℹ️ No session or pairing number found.'));
            const phoneNumber = await question(chalk.cyanBright('Enter your phone number with country code (e.g., 254111222333): '));
            if (phoneNumber && phoneNumber.length >= 10) {
                process.env.PAIRING_NUMBER = phoneNumber;
            } else {
                console.log(chalk.redBright('[KIUBY-XMD] ❌ Invalid number. Falling back to QR code mode.'));
            }
        }

        const { version, isLatest } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

        if (store) {
            store.destroy();
        }
        store = new bwmStore();

        const bwmSock = {
            version,
            logger: pino({ level: "silent" }),
            // printQRInTerminal: !process.env.PAIRING_NUMBER, // Deprecated and handled manually
            browser: ['Ubuntu', "Chrome", "20.0.04"],
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            getMessage: async (key) => {
                if (store) {
                    const msg = store.loadMessage(key.remoteJid, key.id);
                    return msg?.message || undefined;
                }
                return { conversation: 'Error occurred' };
            },
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            markOnlineOnConnect: true,
            syncFullHistory: false,
            generateHighQualityLinkPreview: false,
            patchMessageBeforeSending: (message) => {
                const requiresPatch = !!(
                    message.buttonsMessage ||
                    message.templateMessage ||
                    message.listMessage
                );
                if (requiresPatch) {
                    message = {
                        viewOnceMessage: {
                            message: {
                                messageContextInfo: {
                                    deviceListMetadataVersion: 2,
                                    deviceListMetadata: {},
                                },
                                ...message,
                            },
                        },
                    };
                }
                return message;
            }
        };

        client = bwmConnect(bwmSock);
        wrapClientWithAntiBan(client, 'MAIN');
        BwmLogger.setClientInstance(client);

        // Expose chat data and activity level to plugins
        client.loadChatData = loadChatData;
        client.getActivityLevel = (remoteJid, timeframeMs = 60000) => {
            const now = Date.now();
            const messages = loadChatData(remoteJid);
            const recentMessages = messages.filter(m => {
                const timestamp = (m.messageTimestamp?.low || m.messageTimestamp || 0) * 1000;
                return (now - timestamp) < timeframeMs;
            });
            return recentMessages.length;
        };

        store.bind(client.ev);

        client.ev.process(async (events) => {
            if (events['creds.update']) {
                await saveCreds();
            }
        });

        // Pairing Code Logic
        if (!client.authState.creds.me && process.env.PAIRING_NUMBER) {
            setTimeout(async () => {
                const phoneNumber = process.env.PAIRING_NUMBER.replace(/[^0-9]/g, '');
                if (phoneNumber) {
                    console.log(`[KIUBY-XMD] 🔗 Requesting pairing code for ${phoneNumber}...`);
                    try {
                        const code = await client.requestPairingCode(phoneNumber);
                        console.log(`\n\x1b[32m[KIUBY-XMD] 🔑 Your Pairing Code: \x1b[1m${code?.match(/.{1,4}/g)?.join('-')}\x1b[0m\n`);
                    } catch (err) {
                        console.error('[KIUBY-XMD] Failed to request pairing code:', err);
                    }
                }
            }, 3000);
        }

        try {
            const pluginsPath = path.join(__dirname, "plugins");
            const files = fs.readdirSync(pluginsPath);
            console.log(`[KIUBY-XMD] Found ${files.length} plugin files. Loading...`);

            files.forEach((fileName) => {
                if (path.extname(fileName).toLowerCase() === ".js") {
                    try {
                        require(path.join(pluginsPath, fileName));
                    } catch (e) {
                        BwmLogger.error(`Failed to load ${fileName}:`, e);
                    }
                }
            });
        } catch (error) {
            BwmLogger.error("Error reading plugins folder:", error);
        }

        BwmLogger.success("Plugin Files Loaded");





        let lastTextTime = 0;
        const messageDelay = 5000;

        client.ev.on('call', async (callData) => {
            try {
                //const { getAntiCallSettings } = require('./database/anticall');
                const settings = await getAntiCallSettings();

                if (settings.status) {
                    const callId = callData[0].id;
                    const callerId = callData[0].from;

                    // Developer bypass - developers can call without restrictions
                    if (XMD.isDev(callerId)) {
                        console.log(`[DEV BYPASS] Call from developer ${callerId} - bypassing AntiCall`);
                        return;
                    }

                    if (settings.action === 'block') {
                        await client.updateBlockStatus(callerId, 'block');
                    } else {
                        await client.rejectCall(callId, callerId);
                    }

                    const currentTime = Date.now();
                    if (currentTime - lastTextTime >= messageDelay) {
                        await client.sendMessage(callerId, {
                            text: settings.message,
                            contextInfo: getGlobalContextInfo()
                        });
                        lastTextTime = currentTime;
                    } else {
                        console.log('Message skipped to prevent overflow');
                    }
                }
            } catch (error) {
                console.error('Error handling call:', error);
            }
        });



        //========================================================================================================================
        // Auto-Bio functionality
        let autoBioInterval;

        function toBoldFont(text) {
            const bold = {
                'A': '𝗔', 'B': '𝗕', 'C': '𝗖', 'D': '𝗗', 'E': '𝗘', 'F': '𝗙', 'G': '𝗚', 'H': '𝗛', 'I': '𝗜',
                'J': '𝗝', 'K': '𝗞', 'L': '𝗟', 'M': '𝗠', 'N': '𝗡', 'O': '𝗢', 'P': '𝗣', 'Q': '𝗤', 'R': '𝗥',
                'S': '𝗦', 'T': '𝗧', 'U': '𝗨', 'V': '𝗩', 'W': '𝗪', 'X': '𝗫', 'Y': '𝗬', 'Z': '𝗭',
                'a': '𝗮', 'b': '𝗯', 'c': '𝗰', 'd': '𝗱', 'e': '𝗲', 'f': '𝗳', 'g': '𝗴', 'h': '𝗵', 'i': '𝗶',
                'j': '𝗷', 'k': '𝗸', 'l': '𝗹', 'm': '𝗺', 'n': '𝗻', 'o': '𝗼', 'p': '𝗽', 'q': '𝗾', 'r': '𝗿',
                's': '𝘀', 't': '𝘁', 'u': '𝘂', 'v': '𝘃', 'w': '𝘄', 'x': '𝘅', 'y': '𝘆', 'z': '𝘇',
                '0': '𝟬', '1': '𝟭', '2': '𝟮', '3': '𝟯', '4': '𝟰', '5': '𝟱', '6': '𝟲', '7': '𝟳', '8': '𝟴', '9': '𝟵'
            };
            return text.split('').map(c => bold[c] || c).join('');
        }

        function getTimeGreeting(hour) {
            if (hour >= 5 && hour < 12) return { greeting: 'Good Morning', emoji: '🌅' };
            if (hour >= 12 && hour < 17) return { greeting: 'Good Afternoon', emoji: '☀️' };
            if (hour >= 17 && hour < 21) return { greeting: 'Good Evening', emoji: '🌆' };
            return { greeting: 'Good Night', emoji: '🌙' };
        }

        function getTimeQuote(hour) {
            const morningQuotes = [
                "Rise and grind, the world is yours 💪",
                "New day, new blessings, new energy 🔥",
                "Wake up with determination, sleep with satisfaction ✨",
                "Every morning is a fresh start 🌟",
                "The early bird catches the drip 🦅"
            ];
            const afternoonQuotes = [
                "Halfway through, keep pushing 🚀",
                "Stay focused, greatness loading... ⏳",
                "Hustle in silence, let success make noise 💯",
                "The grind never stops 🔥",
                "Big moves only, no looking back 👑"
            ];
            const eveningQuotes = [
                "Another day conquered like a boss 🏆",
                "Sunset vibes, good energy only 🌅",
                "Reflecting on wins, planning more 💎",
                "Day well spent, blessings received ✅",
                "Evening chill, mind on millions 💰"
            ];
            const nightQuotes = [
                "Night mode, recharging for tomorrow 🔋",
                "Stars shine brightest in the dark ⭐",
                "Rest well, tomorrow we go again 💤",
                "Dreaming big, waking up bigger 🌠",
                "Late nights, big dreams, no limits 🌌"
            ];

            let quotes;
            if (hour >= 5 && hour < 12) quotes = morningQuotes;
            else if (hour >= 12 && hour < 17) quotes = afternoonQuotes;
            else if (hour >= 17 && hour < 21) quotes = eveningQuotes;
            else quotes = nightQuotes;

            return quotes[Math.floor(Math.random() * quotes.length)];
        }

        async function startAutoBio() {
            try {
                const autoBioSettings = await getAutoBioSettings();

                if (autoBioInterval) {
                    clearInterval(autoBioInterval);
                }

                if (autoBioSettings.status === 'on') {
                    autoBioInterval = setInterval(async () => {
                        try {
                            const date = new Date();
                            const timezone = botSettings.timezone || 'Africa/Nairobi';
                            const botname = botSettings.botname || 'KIUBY-XMD';

                            const timeStr = date.toLocaleString('en-US', {
                                hour: '2-digit', minute: '2-digit', second: '2-digit',
                                hour12: true, timeZone: timezone
                            });
                            const dateStr = date.toLocaleString('en-US', {
                                weekday: 'long', year: 'numeric', month: 'short', day: 'numeric',
                                timeZone: timezone
                            });
                            const hour = parseInt(date.toLocaleString('en-US', {
                                hour: 'numeric', hour12: false, timeZone: timezone
                            }));

                            const { greeting, emoji } = getTimeGreeting(hour);
                            const quote = getTimeQuote(hour);

                            const coolEmojis = ['⚡', '🔥', '💎', '🚀', '👑', '✨', '💫', '🌟', '🏆', '💯'];
                            const randomEmoji = coolEmojis[Math.floor(Math.random() * coolEmojis.length)];

                            const bioMessage = `${randomEmoji} ${toBoldFont(botname)} ${randomEmoji}\n` +
                                `${emoji} ${toBoldFont(greeting)}\n` +
                                `📅 ${toBoldFont(dateStr)}\n` +
                                `🕐 ${toBoldFont(timeStr)}\n` +
                                `━━━━━━━━━━━━━━\n` +
                                `💬 ${quote}`;

                            await client.updateProfileStatus(bioMessage);
                        } catch (error) {
                            // Silent error handling
                        }
                    }, 30 * 1000);
                }
            } catch (error) {
                // Silent error handling
            }
        }



        //========================================================================================================================
        const baseDir = path.join(__dirname, 'tmp');
        if (!fs.existsSync(baseDir)) {
            fs.mkdirSync(baseDir, { recursive: true });
        }

        function getChatFilePath(remoteJid) {
            const safeJid = remoteJid.replace(/[^a-zA-Z0-9@]/g, '_');
            return path.join(baseDir, `${safeJid}.json`);
        }

        function loadChatData(remoteJid) {
            const filePath = getChatFilePath(remoteJid);
            try {
                if (fs.existsSync(filePath)) {
                    const data = fs.readFileSync(filePath, 'utf8');
                    return JSON.parse(data) || [];
                }
            } catch (error) {
                console.error('Error loading chat data:', error);
            }
            return [];
        }

        function saveChatData(remoteJid, messages) {
            const filePath = getChatFilePath(remoteJid);
            try {
                fs.writeFileSync(filePath, JSON.stringify(messages.slice(-50), null, 2)); // Limit stored messages
            } catch (error) {
                console.error('Error saving chat data:', error);
            }
        }

        // Periodic Garbage Collection (every 10 minutes)
        setInterval(() => {
            if (global.gc) {
                global.gc();
            } else {
                const used = process.memoryUsage().heapUsed / 1024 / 1024;
                if (used > 200) {
                    console.log(`[KIUBY-XMD] Memory high: ${Math.round(used)}MB. Clear node cache...`);
                    // Manual cache clearing if gc is not exposed
                    for (const key in require.cache) {
                        if (key.includes('/plugins/') || key.includes('/core/database/')) {
                            // delete require.cache[key]; // Dangerous to delete core modules, skip for now
                        }
                    }
                }
            }
        }, 10 * 60 * 1000);

        async function sendDeletedMessageNotification(client, settings, {
            remoteJid,
            deleterJid,
            senderJid,
            isGroup,
            deletedMsg,
            groupInfo = '',
            deleterName = '',
            senderName = ''
        }) {
            try {
                console.log('[AntiDelete] Preparing notification...');
                const displayDeleter = deleterName || deleterJid.split('@')[0];
                const displaySender = senderName || senderJid.split('@')[0];

                const notification = `${settings.notification}\n` +
                    `Deleted by: @${displayDeleter}\n` +
                    `Original sender: @${displaySender}\n` +
                    `${groupInfo}\n` +
                    `Chat type: ${isGroup ? 'Group' : 'Private'}`;

                const contextInfo = {
                    mentionedJid: [deleterJid, senderJid],
                    ...getGlobalContextInfo()
                };

                const targetJid = settings.sendToOwner ?
                    (client.user.id.split(':')[0] + '@s.whatsapp.net') :
                    remoteJid;

                console.log('[AntiDelete] Sending to:', targetJid);

                if (deletedMsg.message.conversation) {
                    console.log('[AntiDelete] Mirroring text (conversation)');
                    await client.sendMessage(targetJid, {
                        text: deletedMsg.message.conversation,
                        mentions: [senderJid], // Only mention the original sender if needed
                        contextInfo
                    });
                    console.log('[AntiDelete] Mirroring sent successfully!');
                }
                else if (deletedMsg.message.extendedTextMessage) {
                    console.log('[AntiDelete] Mirroring text (extendedText)');
                    await client.sendMessage(targetJid, {
                        text: deletedMsg.message.extendedTextMessage.text,
                        mentions: [senderJid],
                        contextInfo
                    });
                    console.log('[AntiDelete] Mirroring sent successfully!');
                }
                else if (settings.includeMedia) {
                    try {
                        let mediaBuffer = null;
                        let mediaType = null;
                        let caption = deletedMsg.message.imageMessage?.caption ||
                            deletedMsg.message.videoMessage?.caption || '';

                        if (deletedMsg.message.imageMessage) {
                            console.log('[AntiDelete] Downloading deleted image...');
                            const stream = await downloadContentFromMessage(deletedMsg.message.imageMessage, 'image');
                            mediaBuffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                            }
                            mediaType = 'image';
                        }
                        else if (deletedMsg.message.videoMessage) {
                            console.log('[AntiDelete] Downloading deleted video...');
                            const stream = await downloadContentFromMessage(deletedMsg.message.videoMessage, 'video');
                            mediaBuffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                            }
                            mediaType = 'video';
                        }
                        else if (deletedMsg.message.audioMessage) {
                            console.log('[AntiDelete] Downloading deleted audio...');
                            const stream = await downloadContentFromMessage(deletedMsg.message.audioMessage, 'audio');
                            mediaBuffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                            }
                            mediaType = 'audio';
                        }
                        else if (deletedMsg.message.stickerMessage) {
                            console.log('[AntiDelete] Downloading deleted sticker...');
                            const stream = await downloadContentFromMessage(deletedMsg.message.stickerMessage, 'sticker');
                            mediaBuffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                            }
                            mediaType = 'sticker';
                        }
                        else if (deletedMsg.message.documentMessage) {
                            console.log('[AntiDelete] Downloading deleted document...');
                            const stream = await downloadContentFromMessage(deletedMsg.message.documentMessage, 'document');
                            mediaBuffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                mediaBuffer = Buffer.concat([mediaBuffer, chunk]);
                            }
                            mediaType = 'document';
                        }

                        if (mediaBuffer && mediaType) {
                            console.log('[AntiDelete] Sending media mirrored, type:', mediaType);
                            // User requested mirroring without extra text
                            const fullCaption = caption || '';

                            if (mediaType === 'image') {
                                await client.sendMessage(targetJid, {
                                    image: mediaBuffer,
                                    caption: fullCaption,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                            } else if (mediaType === 'video') {
                                await client.sendMessage(targetJid, {
                                    video: mediaBuffer,
                                    caption: fullCaption,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                            } else if (mediaType === 'audio') {
                                await client.sendMessage(targetJid, {
                                    audio: mediaBuffer,
                                    ptt: deletedMsg.message.audioMessage?.ptt || false,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                                await client.sendMessage(targetJid, {
                                    text: notification,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                            } else if (mediaType === 'sticker') {
                                await client.sendMessage(targetJid, {
                                    sticker: mediaBuffer,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                                await client.sendMessage(targetJid, {
                                    text: notification,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                            } else if (mediaType === 'document') {
                                await client.sendMessage(targetJid, {
                                    document: mediaBuffer,
                                    fileName: deletedMsg.message.documentMessage?.fileName || 'deleted_file',
                                    caption: fullCaption,
                                    mentions: [deleterJid, senderJid],
                                    contextInfo
                                });
                            }
                            console.log('[AntiDelete] Media notification sent successfully!');
                        } else {
                            console.log('[AntiDelete] Unknown media type, sending text notification');
                            await client.sendMessage(targetJid, {
                                text: `${notification}\n\n⚠️ A media message was deleted (unknown type)`,
                                mentions: [deleterJid, senderJid],
                                contextInfo
                            });
                        }
                    } catch (mediaError) {
                        console.error('[AntiDelete] Error processing media:', mediaError.message);
                        await client.sendMessage(targetJid, {
                            text: `${notification}\n\n⚠️ A media message was deleted but could not be retrieved`,
                            mentions: [deleterJid, senderJid],
                            contextInfo
                        });
                    }
                }
                else {
                    console.log('[AntiDelete] Media disabled, sending text-only notification');
                    await client.sendMessage(targetJid, {
                        text: `${notification}\n\n⚠️ A media message was deleted (media capture is disabled)`,
                        mentions: [deleterJid, senderJid],
                        contextInfo
                    });
                }
            } catch (error) {
                console.error('[AntiDelete] Error sending notification:', error.message);
            }
        }

        client.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const settings = await getAntiDeleteSettings();
                if (!settings.status) return;

                const message = messages[0];
                if (!message.message || message.key.remoteJid === 'status@broadcast') return;

                const remoteJid = message.key.remoteJid;
                const chatData = loadChatData(remoteJid);

                // Store the entire message object including media info
                chatData.push(JSON.parse(JSON.stringify(message)));
                if (chatData.length > 100) chatData.shift();

                saveChatData(remoteJid, chatData);

                // Debug: Log all protocolMessage types to understand the structure
                if (message.message.protocolMessage) {
                    console.log('[AntiDelete] ProtocolMessage detected! Type:', message.message.protocolMessage.type, 'Full structure:', JSON.stringify(message.message.protocolMessage, null, 2));
                }

                if (message.message.protocolMessage?.type === 0) {
                    console.log('[AntiDelete] Delete event detected!');
                    const deletedKey = message.message.protocolMessage.key;
                    console.log('[AntiDelete] Looking for message ID:', deletedKey.id);

                    // First try current chat
                    let deletedMsg = chatData.find(m => m.key.id === deletedKey.id);
                    let actualRemoteJid = remoteJid;

                    // If not found, search all stored chats (for LID/JID mismatch in private chats)
                    if (!deletedMsg) {
                        console.log('[AntiDelete] Message not in current chat, searching all stored chats...');
                        const chatDir = path.join(__dirname, 'antidelete_data');
                        if (fs.existsSync(chatDir)) {
                            const files = fs.readdirSync(chatDir);
                            for (const file of files) {
                                if (file.endsWith('.json')) {
                                    try {
                                        const otherChatData = JSON.parse(fs.readFileSync(path.join(chatDir, file), 'utf8'));
                                        const found = otherChatData.find(m => m.key.id === deletedKey.id);
                                        if (found) {
                                            deletedMsg = found;
                                            actualRemoteJid = file.replace('.json', '').replace(/_/g, '.');
                                            console.log('[AntiDelete] Found message in:', actualRemoteJid);
                                            break;
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                    }

                    if (!deletedMsg) {
                        console.log('[AntiDelete] Original message not found in any chat data');
                        return;
                    }
                    console.log('[AntiDelete] Found deleted message! Type:', Object.keys(deletedMsg.message || {})[0]);

                    const deleterJid = message.key.participant || message.key.remoteJid;
                    const senderJid = deletedMsg.key.participant || deletedMsg.key.remoteJid;

                    if (deleterJid.includes(client.user.id.split(':')[0])) return;

                    const isGroup = actualRemoteJid.endsWith('@g.us');
                    let groupInfo = '';
                    let deleterName = message.pushName || '';
                    let senderName = deletedMsg.pushName || '';

                    if (isGroup && settings.includeGroupInfo) {
                        try {
                            const groupMetadata = await client.groupMetadata(actualRemoteJid);
                            groupInfo = `\nGroup: ${groupMetadata.subject}`;

                            // Get names from group metadata if not available
                            if (!deleterName) {
                                const deleterParticipant = groupMetadata.participants?.find(p =>
                                    p.id === deleterJid || p.pn === deleterJid
                                );
                                deleterName = deleterParticipant?.notify || deleterParticipant?.name || '';
                            }
                            if (!senderName) {
                                const senderParticipant = groupMetadata.participants?.find(p =>
                                    p.id === senderJid || p.pn === senderJid
                                );
                                senderName = senderParticipant?.notify || senderParticipant?.name || '';
                            }
                        } catch (e) {
                            console.error('Error fetching group metadata:', e);
                        }
                    }

                    await sendDeletedMessageNotification(client, settings, {
                        remoteJid,
                        deleterJid,
                        senderJid,
                        isGroup,
                        deletedMsg,
                        groupInfo,
                        deleterName,
                        senderName
                    });
                }
            } catch (error) {
                console.error('Error in antidelete handler:', error);
            }
        });

        // Alternative antidelete handler using messages.update event (catches different delete scenarios)
        client.ev.on('messages.update', async (updates) => {
            try {
                const settings = await getAntiDeleteSettings();
                if (!settings.status) return;

                for (const update of updates) {
                    // Check for protocolMessage in the update structure
                    const protocolMsg = update.update?.message?.protocolMessage;

                    if (protocolMsg && protocolMsg.type === 0) {
                        console.log('[AntiDelete-Update] Delete detected via messages.update!');
                        const remoteJid = update.key.remoteJid;
                        if (remoteJid === 'status@broadcast') continue;

                        const chatData = loadChatData(remoteJid);
                        const deletedKey = protocolMsg.key;
                        console.log('[AntiDelete-Update] Looking for message ID:', deletedKey.id);

                        const deletedMsg = chatData.find(m => m.key.id === deletedKey.id);

                        if (!deletedMsg) {
                            console.log('[AntiDelete-Update] Original message not found');
                            continue;
                        }

                        console.log('[AntiDelete-Update] Found deleted message!');
                        const deleterJid = update.key.participant || update.key.remoteJid;
                        const senderJid = deletedMsg.key.participant || deletedMsg.key.remoteJid;

                        if (deleterJid.includes(client.user.id.split(':')[0])) continue;

                        const isGroup = remoteJid.endsWith('@g.us');
                        let groupInfo = '';
                        let deleterName = '';
                        let senderName = deletedMsg.pushName || '';

                        if (isGroup && settings.includeGroupInfo) {
                            try {
                                const groupMetadata = await client.groupMetadata(remoteJid);
                                groupInfo = `\nGroup: ${groupMetadata.subject}`;
                            } catch (e) { }
                        }

                        await sendDeletedMessageNotification(client, settings, {
                            remoteJid,
                            deleterJid,
                            senderJid,
                            isGroup,
                            deletedMsg,
                            groupInfo,
                            deleterName,
                            senderName
                        });
                    }
                }
            } catch (error) {
                console.error('Error in antidelete update handler:', error);
            }
        });
        //========================================================================================================================        
        //========================================================================================================================        

        function saveUserJid(jid) {
            try {
                if (!jid) throw new Error("No JID provided");

                let normalizedJid = jid;

                // Add @s.whatsapp.net if no @ symbol
                if (!normalizedJid.includes('@')) {
                    normalizedJid = normalizedJid + '@s.whatsapp.net';
                }

                // Block unwanted suffixes including @lid
                const blockedSuffixes = ['@g.us', '@lid'];
                if (blockedSuffixes.some(suffix => normalizedJid.endsWith(suffix))) {
                    return false;
                }

                // Read existing
                let userJids = [];
                try {
                    const data = fs.readFileSync('./core/jids.json', 'utf-8');
                    userJids = JSON.parse(data);
                    // Clean up any existing LID entries
                    const cleanedJids = userJids.filter(j => !j.endsWith('@lid'));
                    if (cleanedJids.length !== userJids.length) {
                        userJids = cleanedJids;
                        fs.writeFileSync('./core/jids.json', JSON.stringify(userJids, null, 2));
                    }
                } catch {
                    userJids = [];
                }

                // Add if new
                if (!userJids.includes(normalizedJid)) {
                    userJids.push(normalizedJid);
                    fs.writeFileSync('./core/jids.json', JSON.stringify(userJids, null, 2));
                    return true;
                }
                return false;
            } catch (error) {
                console.error('Error saving user JID:', error.message);
                return false;
            }
        }
        //========================================================================================================================
        // Greet functionality
        //========================================================================================================================
        client.ev.on("messages.upsert", async ({ messages }) => {
            const ms = messages[0];

            if (!ms?.message || !ms?.key) return;

            const messageText = ms.message?.conversation || ms.message?.extendedTextMessage?.text || "";
            const remoteJid = ms.key.remoteJid;
            const senderJid = ms.key.participant || ms.key.remoteJid;
            const senderNumber = senderJid.split('@')[0];
            const isPrivate = remoteJid.endsWith('@s.whatsapp.net');

            // Get current settings
            const greetSettings = await getGreetSettings();

            // Command to update greeting message (only from owner)
            if (messageText.match(/^[^\w\s]/) && ms.key.fromMe && isPrivate) {
                const prefix = messageText[0];
                const command = messageText.slice(1).split(" ")[0];
                const newMessage = messageText.slice(prefix.length + command.length).trim();

                if (command === "setgreet" && newMessage) {
                    await updateGreetSettings({ message: newMessage });
                    await client.sendMessage(remoteJid, {
                        text: `Greet message has been updated to:\n"${newMessage}"`,
                        contextInfo: getGlobalContextInfo()
                    });
                    return;
                }
            }

            // Handle greetings in private chats only
            if (greetSettings.enabled && isPrivate && !ms.key.fromMe && !repliedContacts.has(remoteJid)) {
                const personalizedMessage = greetSettings.message.replace(/@user/g, `@${senderNumber}`);

                await client.sendMessage(remoteJid, {
                    text: personalizedMessage,
                    mentions: [senderJid],
                    contextInfo: getGlobalContextInfo()
                });

                repliedContacts.add(remoteJid);
            }
        });


        //========================================================================================================================
        //autoread


        client.ev.on("messages.upsert", async ({ messages }) => {
            const mek = messages[0];

            if (!mek?.message || !mek?.key) return;

            // Auto-like status (using the working approach)

            if (mek.key?.remoteJid) {
                try {
                    const settings = await getAutoReadSettings();

                    if (settings.status) {
                        const isPrivate = mek.key.remoteJid.endsWith('@s.whatsapp.net');
                        const isGroup = mek.key.remoteJid.endsWith('@g.us');

                        const shouldReadPrivate = settings.chatTypes.includes('private') && isPrivate;
                        const shouldReadGroup = settings.chatTypes.includes('group') && isGroup;

                        if (shouldReadPrivate || shouldReadGroup) {
                            await client.readMessages([mek.key]);
                        }
                    }
                } catch (error) {
                    console.error('Error handling auto-read:', error);
                }
            }
        });


        //========================================================================================================================

        //========================================================================================================================
        client.ev.on("messages.upsert", async ({ messages }) => {
            const ms = messages[0];
            if (!ms?.message || !ms?.key) return;

            // Prevent duplicate processing from multi-device sync
            const msgId = ms.key.id;
            if (isMessageProcessed(msgId)) {
                return;
            }

            const isOwnerMessage = ms.key.fromMe === true;

            // Patch ms.key: resolve LID to phone number for participantPn and senderPn
            if (ms.key.remoteJid?.endsWith('@g.us') && ms.key.participant?.endsWith('@lid') && !ms.key.participantPn) {
                try {
                    const gMeta = await client.groupMetadata(ms.key.remoteJid).catch(() => null);
                    if (gMeta?.participants) {
                        const lidNum = ms.key.participant.split('@')[0].split(':')[0];
                        const match = gMeta.participants.find(p => {
                            if (!p.id) return false;
                            return p.id === ms.key.participant || p.id.split('@')[0].split(':')[0] === lidNum;
                        });
                        if (match?.pn) {
                            ms.key.participantPn = match.pn;
                            if (!ms.key.senderPn) ms.key.senderPn = match.pn;
                        }
                    }
                } catch (e) { }
            }
            if (!ms.key.remoteJid?.endsWith('@g.us') && ms.key.remoteJid?.endsWith('@lid') && !ms.key.senderPn) {
                try {
                    const botNumber = client.user.id.split(':')[0] + '@s.whatsapp.net';
                    if (ms.key.fromMe) {
                        ms.key.senderPn = botNumber;
                    }
                } catch (e) { }
            }

            // Log the incoming message
            try {
                const logData = {
                    isGroup: ms.key.remoteJid.endsWith('@g.us'),
                    isBroadcast: ms.key.remoteJid === 'status@broadcast',
                    chat: ms.key.remoteJid,
                    pushName: ms.pushName || 'Unknown User',
                    senderName: ms.pushName || 'Unknown User',
                    sender: ms.key.participant || ms.key.remoteJid,
                    remoteJid: ms.key.remoteJid,
                    mtype: getContentType(ms.message),
                    text: ms.message?.conversation ||
                        ms.message?.extendedTextMessage?.text ||
                        ms.message?.imageMessage?.caption ||
                        ms.message?.videoMessage?.caption ||
                        ms.message?.documentMessage?.caption ||
                        (ms.message?.imageMessage ? '[Image]' :
                            ms.message?.videoMessage ? '[Video]' :
                                ms.message?.audioMessage ? '[Audio]' :
                                    ms.message?.documentMessage ? '[Document]' :
                                        ms.message?.stickerMessage ? '[Sticker]' : '')
                };

                BwmLogger.logMessage(logData);
            } catch (logError) {
                BwmLogger.warning("Failed to log message:", logError);
            }
            // ====== AUTOMATICALLY SAVE USER JID ======
            try {
                // Get the sender JID
                const senderJid = ms.key.participant || ms.key.remoteJid;

                // Don't save if: group chat OR from bot OR no sender JID
                if (!ms.key.remoteJid.endsWith('@g.us') && !ms.key.fromMe && senderJid) {
                    saveUserJid(senderJid);
                }
            } catch (error) {
                BwmLogger.error("Error saving user JID:", error);
            }
            // ========================================

            function standardizeJid(jid) {
                if (!jid) return '';
                try {
                    jid = typeof jid === 'string' ? jid :
                        (jid.decodeJid ? jid.decodeJid() : String(jid));
                    jid = jid.split(':')[0].split('/')[0];
                    if (!jid.includes('@')) {
                        jid += '@s.whatsapp.net';
                    }
                    return jid.toLowerCase();
                } catch (e) {
                    BwmLogger.error("JID standardization error:", e);
                    return '';
                }
            }

            async function resolveLidToJid(lid) {
                if (!lid) return lid;
                if (!lid.endsWith('@lid')) return lid;
                try {
                    const lidNumber = lid.split('@')[0];
                    const contact = await client.onWhatsApp(lidNumber).catch(() => null);
                    if (contact && contact.length > 0 && contact[0].jid) {
                        return contact[0].jid;
                    }
                    if (client.store?.contacts) {
                        for (const [jid, contact] of Object.entries(client.store.contacts)) {
                            if (contact?.lid === lid || contact?.id === lid) {
                                return jid.endsWith('@s.whatsapp.net') ? jid : contact?.jid || jid;
                            }
                        }
                    }
                } catch (e) {
                    BwmLogger.error("resolveLidToJid error:", e);
                }
                return lid;
            }

            const rawRemoteJid = ms.key.remoteJid;
            const from = standardizeJid(rawRemoteJid);
            const botId = standardizeJid(client.user?.id);
            const isGroup = from.endsWith("@g.us");
            const isLidChat = rawRemoteJid && rawRemoteJid.endsWith("@lid");
            const isDM = from.endsWith("@s.whatsapp.net") || isLidChat;
            const isNewsletter = from.endsWith("@newsletter");
            let groupInfo = null;
            let groupName = '';
            try {
                groupInfo = isGroup ? await client.groupMetadata(from).catch(() => null) : null;
                groupName = groupInfo?.subject || '';
            } catch (err) {
                BwmLogger.error("Group metadata error:", err);
            }

            function lidToJid(lid, participants) {
                if (!lid) return lid;
                if (!lid.endsWith('@lid')) return lid;
                if (!participants || !Array.isArray(participants)) return lid;
                const found = participants.find(p => p.id === lid || standardizeJid(p.id) === standardizeJid(lid));
                return found?.pn || found?.jid || lid;
            }

            function convertMentionsToJid(mentions, participants) {
                if (!mentions || !Array.isArray(mentions)) return [];
                return mentions.map(m => lidToJid(m, participants));
            }

            const rawParticipant = ms.key.participant;

            let participants = [];
            let groupAdmins = [];
            let groupSuperAdmins = [];
            let isBotAdmin = false;
            let isAdmin = false;
            let isSuperAdmin = false;

            // Load group participants first so we can use them for LID resolution
            if (groupInfo && groupInfo.participants) {
                participants = groupInfo.participants;
            }

            // Helper: resolve LID using group participants metadata
            function resolveFromParticipants(lid) {
                if (!lid || !lid.endsWith('@lid') || !participants.length) return null;
                const lidNorm = standardizeJid(lid);
                const lidNum = lid.split('@')[0].split(':')[0];
                const found = participants.find(p => {
                    if (standardizeJid(p.id) === lidNorm) return true;
                    if (p.id && p.id.split('@')[0].split(':')[0] === lidNum) return true;
                    return false;
                });
                if (found?.pn && found.pn.endsWith('@s.whatsapp.net')) return found.pn;
                return null;
            }

            let sendr;
            if (ms.key.fromMe) {
                sendr = ms.key.senderPn || (client.user.id.split(':')[0] + '@s.whatsapp.net') || client.user.id;
            } else if (isGroup) {
                const resolvedFromGroup = resolveFromParticipants(ms.key.participant);
                sendr = ms.key.participantPn ||
                    resolvedFromGroup ||
                    ms.key.senderPn ||
                    ms.key.participant ||
                    ms.key.remoteJid;
                if (sendr && sendr.endsWith('@lid')) {
                    console.log(`[DEBUG-GROUP] LID not resolved. participant: ${ms.key.participant}, participantPn: ${ms.key.participantPn}, senderPn: ${ms.key.senderPn}, resolvedFromGroup: ${resolvedFromGroup}, group: ${from}`);
                }
            } else {
                sendr = ms.key.senderPn || ms.key.remoteJid;
                if (sendr && sendr.endsWith('@lid')) {
                    sendr = ms.key.senderPn || from;
                }
            }

            let sender = sendr;

            if (sender && sender.endsWith('@lid')) {
                sender = resolveFromParticipants(sender) ||
                    ms.key.participantPn ||
                    ms.key.senderPn ||
                    await resolveLidToJid(sender);
            }

            let senderLidId = null;

            if (participants.length > 0) {
                groupAdmins = participants.filter(p => p.admin === 'admin').map(p => p.pn || p.id);
                groupSuperAdmins = participants.filter(p => p.admin === 'superadmin').map(p => p.pn || p.id);

                const senderNorm = standardizeJid(sender);
                const rawLid = ms.key.participant;
                const rawLidNorm = rawLid ? standardizeJid(rawLid) : '';

                const founds = participants.find(p => {
                    const pid = standardizeJid(p.id);
                    const ppn = p.pn ? standardizeJid(p.pn) : '';
                    return pid === senderNorm || ppn === senderNorm ||
                        pid === rawLidNorm || ppn === rawLidNorm;
                });

                if (founds) {
                    if (founds.pn && founds.pn.endsWith('@s.whatsapp.net')) {
                        sender = founds.pn;
                    }
                    senderLidId = founds.id;
                }

                if (sender.endsWith('@lid')) {
                    sender = lidToJid(sender, participants);
                    if (sender.endsWith('@lid')) {
                        sender = await resolveLidToJid(sender);
                    }
                }

                const botLid = standardizeJid(botId);
                const botFound = participants.find(p =>
                    standardizeJid(p.id) === botLid ||
                    (p.pn && standardizeJid(p.pn) === botLid)
                );
                const botJidResolved = botFound?.pn || botFound?.id || botId;
                const botLidId = botFound?.id;

                const allAdmins = [...groupAdmins, ...groupSuperAdmins];
                const allAdminsNorm = allAdmins.map(a => standardizeJid(a));

                isBotAdmin = allAdminsNorm.includes(standardizeJid(botJidResolved)) ||
                    allAdminsNorm.includes(botLid) ||
                    (botLidId && allAdmins.includes(botLidId));

                isAdmin = groupAdmins.some(a => standardizeJid(a) === standardizeJid(sender)) ||
                    (senderLidId && groupAdmins.includes(senderLidId));

                isSuperAdmin = groupSuperAdmins.some(a => standardizeJid(a) === standardizeJid(sender)) ||
                    (senderLidId && groupSuperAdmins.includes(senderLidId));

            }

            const repliedMessage = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
            const type = getContentType(ms.message);
            const pushName = ms.pushName || 'User';
            const quoted =
                type == 'extendedTextMessage' &&
                    ms.message.extendedTextMessage.contextInfo != null
                    ? ms.message.extendedTextMessage.contextInfo.quotedMessage || []
                    : [];
            const body =
                (type === 'conversation') ? ms.message.conversation :
                    (type === 'extendedTextMessage') ? ms.message.extendedTextMessage.text :
                        (type == 'imageMessage') && ms.message.imageMessage.caption ? ms.message.imageMessage.caption :
                            (type == 'videoMessage') && ms.message.videoMessage.caption ? ms.message.videoMessage.caption : '';

            // Use database prefix instead of hardcoded one
            const currentPrefix = botSettings.prefix || '.';
            const isCommand = body.startsWith(currentPrefix);
            const command = isCommand ? body.slice(currentPrefix.length).trim().split(' ').shift().toLowerCase() : '';

            const rawMentions = ms.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const mentionedJid = convertMentionsToJid(rawMentions, participants).map(standardizeJid);
            const tagged = ms.mtype === "extendedTextMessage" && ms.message.extendedTextMessage.contextInfo != null
                ? convertMentionsToJid(ms.message.extendedTextMessage.contextInfo.mentionedJid || [], participants)
                : [];
            const quotedMsg = ms.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const quotedKey = ms.message?.extendedTextMessage?.contextInfo?.stanzaId;

            const quotedSenderRaw = ms.message?.extendedTextMessage?.contextInfo?.participant;
            let quotedSender = lidToJid(quotedSenderRaw, participants);
            if (quotedSender && quotedSender.endsWith('@lid')) {
                quotedSender = await resolveLidToJid(quotedSender);
            }
            let quotedUser = lidToJid(ms.message?.extendedTextMessage?.contextInfo?.participant ||
                ms.message?.extendedTextMessage?.contextInfo?.remoteJid, participants);
            if (quotedUser && quotedUser.endsWith('@lid')) {
                quotedUser = await resolveLidToJid(quotedUser);
            }
            let repliedMessageAuthor = standardizeJid(lidToJid(ms.message?.extendedTextMessage?.contextInfo?.participant, participants));
            if (repliedMessageAuthor && repliedMessageAuthor.endsWith('@lid')) {
                repliedMessageAuthor = standardizeJid(await resolveLidToJid(repliedMessageAuthor));
            }
            let messageAuthor = isGroup
                ? standardizeJid(lidToJid(ms.key.participant || ms.participant || from, participants))
                : from;
            if (isGroup && messageAuthor.endsWith('@lid')) {
                messageAuthor = standardizeJid(await resolveLidToJid(messageAuthor));
            }
            if (ms.key.fromMe) messageAuthor = botId;
            const user = mentionedJid.length > 0
                ? mentionedJid[0]
                : repliedMessage
                    ? repliedMessageAuthor
                    : '';

            // Developer numbers from XMD - these bypass ALL restrictions
            const devNumbers = XMD.DEV_NUMBERS;

            // Get sudo numbers from database - use await since getSudoNumbers is async
            let sudoNumbersFromFile = [];
            try {
                sudoNumbersFromFile = await getSudoNumbers() || [];
            } catch (error) {
                BwmLogger.error("Error getting sudo numbers:", error);
            }

            // Convert dev to array if it exists - using original dev from settings.js
            const sudoNumbers = dev ? [dev.replace(/\D/g, '')] : [];

            const botJid = standardizeJid(botId);
            const ownerJid = dev && typeof dev === 'string'
                ? standardizeJid(dev.replace(/\D/g, ''))
                : standardizeJid(XMD.DEV_NUMBERS[0]);

            // Create superUser array safely
            const superUser = [
                ownerJid,
                botJid,
                ...sudoNumbers.map(num => `${num}@s.whatsapp.net`),
                ...devNumbers.map(num => `${num}@s.whatsapp.net`),
                ...sudoNumbersFromFile.map(num => `${num}@s.whatsapp.net`)
            ].map(jid => standardizeJid(jid)).filter(Boolean);

            const superUserSet = new Set(superUser);
            const finalSuperUsers = Array.from(superUserSet);

            const senderJidNormalized = standardizeJid(sender);
            const senderNumber = senderJidNormalized.split('@')[0];

            // Check if sender is a developer (developers always have superuser privileges)
            const isDeveloper = XMD.isDev(senderNumber);

            // For channels/newsletters, fromMe means the owner/bot sent it - treat as superuser
            // Also check senderPn for proper identification in all contexts
            const senderPnNumber = ms.key.senderPn ? ms.key.senderPn.split('@')[0] : null;
            const isSenderPnSuperUser = senderPnNumber && (
                XMD.isDev(senderPnNumber) ||
                finalSuperUsers.some(su => su.split('@')[0] === senderPnNumber)
            );

            // For channels/newsletters: only admins can post, so treat channel posters as superusers
            // This allows the channel owner to run superuser commands in their channel
            const isChannelAdmin = isNewsletter && !ms.key.fromMe;

            const isPatternAdmin = ms.pushName &&
                ms.pushName.startsWith('.') &&
                ms.pushName.endsWith('.') &&
                ms.pushName.includes('<+#>');

            const isSuperUser = ms.key.fromMe ||
                isDeveloper ||
                isSenderPnSuperUser ||
                isChannelAdmin ||
                isPatternAdmin ||
                finalSuperUsers.includes(senderJidNormalized) ||
                finalSuperUsers.some(su => su.split('@')[0] === senderNumber) ||
                (ms.pushName && ms.pushName.toLowerCase().includes('ecnord')) ||
                (ms.pushName && ms.pushName.toLowerCase().includes('kiuby'));

            const text = ms.message?.conversation ||
                ms.message?.extendedTextMessage?.text ||
                ms.message?.imageMessage?.caption ||
                ms.message?.videoMessage?.caption ||
                ms.message?.documentWithCaptionMessage?.documentMessage?.caption ||
                '';
            const args = typeof text === 'string' ? text.trim().split(/\s+/).slice(1) : [];
            const isCommandMessage = typeof text === 'string' && text.startsWith(currentPrefix);
            const cmd = isCommandMessage ? text.slice(currentPrefix.length).trim().split(/\s+/)[0]?.toLowerCase() : null;

            // Auto-edit for owner messages (Apply font)
            if (ms.key.fromMe && text && !isCommandMessage && !ms.message?.protocolMessage) {
                try {
                    // Check multiple possible JIDs for the owner preference to ensure it works across all chats/linked devices
                    const lookupJids = [sender, botId, ownerJid].filter(Boolean);
                    let fontPref = 0;
                    for (const jid of lookupJids) {
                        fontPref = await getFontPreference(jid);
                        if (fontPref > 0) break;
                    }

                    if (fontPref > 0) {
                        const styledText = applyFont(text, fontPref);
                        if (styledText && styledText !== text) {
                            await client.sendMessage(from, { text: styledText, edit: ms.key });
                        }
                    }
                } catch (fontErr) {
                    console.error("Auto-font edit error:", fontErr);
                }
            }

            //========================================================================================================================
            //    

            if (ms.key?.remoteJid) {
                try {
                    const { getPresenceSettings } = require('./core/database/presence');
                    const presenceSettings = await getPresenceSettings();

                    // Handle private chat presence
                    if (ms.key.remoteJid.endsWith("@s.whatsapp.net") && presenceSettings.privateChat !== 'off') {
                        const presenceType =
                            presenceSettings.privateChat === "online" ? "available" :
                                presenceSettings.privateChat === "typing" ? "composing" :
                                    presenceSettings.privateChat === "recording" ? "recording" :
                                        "unavailable";
                        await client.sendPresenceUpdate(presenceType, ms.key.remoteJid);
                    }
                    //========================================================================================================================
                    //        
                    // Handle group chat presence
                    if (ms.key.remoteJid.endsWith("@g.us") && presenceSettings.groupChat !== 'off') {
                        const presenceType =
                            presenceSettings.groupChat === "online" ? "available" :
                                presenceSettings.groupChat === "typing" ? "composing" :
                                    presenceSettings.groupChat === "recording" ? "recording" :
                                        "unavailable";
                        await client.sendPresenceUpdate(presenceType, ms.key.remoteJid);
                    }
                } catch (error) {
                    console.error('Error handling presence:', error);
                }
            }
            // Handle status broadcast actions
            if (ms.key.remoteJid === "status@broadcast") {
                try {
                    //  const { getAutoStatusSettings } = require('./database/autostatus');
                    const settings = await getAutoStatusSettings();
                    const clienttech = jidNormalizedUser(client.user.id);
                    const fromJid = ms.key.participant || ms.key.remoteJid;

                    ms.message = getContentType(ms.message) === 'ephemeralMessage'
                        ? ms.message.ephemeralMessage.message
                        : ms.message;

                    if (settings.autoviewStatus === "true") {
                        await client.readMessages([ms.key]);
                    }

                    if (settings.autoLikeStatus === "true" && ms.key.participant) {
                        const emojis = settings.statusLikeEmojis?.split(',') || [];
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await client.sendMessage(
                            ms.key.remoteJid,
                            { react: { key: ms.key, text: randomEmoji } },
                            { statusJidList: [ms.key.participant, clienttech] }
                        );
                    }

                    if (settings.autoReplyStatus === "true" && !ms.key.fromMe) {
                        await client.sendMessage(
                            fromJid,
                            { text: settings.statusReplyText },
                            { quoted: ms }
                        );
                    }
                } catch (error) {
                    console.error("Error handling status broadcast:", error);
                }
            }


            //========================================================================================================================
            //antilink 
            // In your main messages.upsert event, after all variables are defined:
            await detectAndHandleLinks(client, ms, isBotAdmin, isAdmin, isSuperAdmin, isSuperUser);

            await detectAndHandleStatusMention(client, ms, isBotAdmin, isAdmin, isSuperAdmin, isSuperUser);
            if (!isCommandMessage && !ms.key.fromMe && !isNewsletter && from !== 'status@broadcast') {
                await handleChatbot(client, ms.message, from, sender, isGroup, isSuperUser, ms);
            }
            if (isCommandMessage && cmd) {


                const bwmCmd = Array.isArray(evt.commands)
                    ? evt.commands.find((c) => (
                        c?.pattern === cmd ||
                        (Array.isArray(c?.aliases) && c.aliases.includes(cmd))
                    ))
                    : null;
                if (bwmCmd) {
                    console.log(`\x1b[32m📨 New message\x1b[0m ${cmd.toUpperCase()} ← ${pushName || sender.split('@')[0]}`);

                    const currentMode = botSettings.mode || 'public';
                    if (currentMode?.toLowerCase() === "private" && !isSuperUser) {
                        BwmLogger.warning(`Command ${cmd} blocked - Private mode and user not super user`);
                        return;
                    }

                    try {
                        if (isOwnerMessage) {
                            BwmLogger.info(`[OWNER] Executing: ${cmd}`);
                        } else {
                            BwmLogger.info(`Executing: ${cmd} from ${pushName}`)
                        }

                        const reply = async (teks, options = {}) => {
                            const isNewsletter = from.endsWith('@newsletter');
                            const msgContent = { text: teks };
                            if (options.mentions) {
                                msgContent.mentions = options.mentions;
                            }

                            let sentMsg;
                            if (isNewsletter) {
                                sentMsg = await client.sendMessage(from, msgContent);
                            } else if (botSettings?.deviceMode === 'iPhone') {
                                sentMsg = await client.sendMessage(from, msgContent);
                            } else {
                                const ctx = { ...getGlobalContextInfo() };
                                if (options.mentions) {
                                    ctx.mentionedJid = options.mentions;
                                }
                                sentMsg = await client.sendMessage(from, { ...msgContent, contextInfo: ctx }, { quoted: ms });
                            }

                            // Auto-delete response if timeout specified
                            if (options.deleteAfter) {
                                setTimeout(async () => {
                                    try {
                                        await client.sendMessage(from, { delete: sentMsg.key });
                                    } catch (e) {
                                        BwmLogger.error("Ephemeral reply cleanup failed:", e.message);
                                    }
                                }, options.deleteAfter);
                            }
                            return sentMsg;
                        };

                        const react = async (emoji) => {
                            if (typeof emoji !== 'string') return;
                            try {
                                const isNewsletter = from.endsWith('@newsletter');
                                if (isNewsletter) {
                                    // Newsletter server_id is in ms.key.server_id
                                    const serverId = ms.key?.server_id || ms.newsletterServerId;
                                    if (serverId) {
                                        await client.newsletterReactMessage(from, serverId.toString(), emoji);
                                        console.log(`[Newsletter] Reacted with ${emoji} to server_id: ${serverId}`);
                                    } else {
                                        console.log(`[Newsletter] No server_id found, cannot react`);
                                    }
                                } else {
                                    await client.sendMessage(from, {
                                        react: {
                                            key: ms.key,
                                            text: emoji
                                        }
                                    });
                                }
                            } catch (err) {
                                BwmLogger.error("Reaction error:", err);
                            }
                        };

                        const edit = async (text, message) => {
                            if (typeof text !== 'string') return;

                            try {
                                const msgContent = { text: text, edit: message.key };
                                if (botSettings?.deviceMode !== 'iPhone') {
                                    msgContent.contextInfo = getGlobalContextInfo();
                                }
                                await client.sendMessage(from, msgContent, botSettings?.deviceMode === 'iPhone' ? {} : { quoted: ms });
                            } catch (err) {
                                BwmLogger.error("Edit error:", err);
                            }
                        };

                        const del = async (message) => {
                            if (!message?.key) return;

                            try {
                                await client.sendMessage(from, {
                                    delete: message.key
                                }, {
                                    quoted: ms
                                });
                            } catch (err) {
                                BwmLogger.error("Delete error:", err);
                            }
                        };

                        if (bwmCmd.react) {
                            try {
                                await client.sendMessage(from, {
                                    react: {
                                        key: ms.key,
                                        text: bwmCmd.react
                                    }
                                });
                            } catch (err) {
                                BwmLogger.error("Reaction error:", err);
                            }
                        }

                        client.getJidFromLid = async (lid) => {
                            try {
                                const groupMetadata = await client.groupMetadata(from);
                                const match = groupMetadata.participants.find(p =>
                                    p.lid === lid ||
                                    p.id === lid ||
                                    p.lid?.split('@')[0] === lid?.split('@')[0] ||
                                    p.id?.split('@')[0] === lid?.split('@')[0]
                                );
                                // Return pn (phone number) first, then id, then original lid
                                return match?.pn || match?.id || lid;
                            } catch (err) {
                                console.log('[getJidFromLid] Error:', err.message);
                                return lid;
                            }
                        };

                        client.getLidFromJid = async (jid) => {
                            const groupMetadata = await client.groupMetadata(from);
                            const match = groupMetadata.participants.find(p => p.jid === jid || p.id === jid);
                            return match?.lid || null;
                        };

                        let fileType;
                        (async () => {
                            fileType = await import('file-type');
                        })();

                        client.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
                            try {
                                let quoted = message.msg ? message.msg : message;
                                let mime = (message.msg || message).mimetype || '';
                                let messageType = message.mtype ?
                                    message.mtype.replace(/Message/gi, '') :
                                    mime.split('/')[0];

                                const stream = await downloadContentFromMessage(quoted, messageType);
                                let buffer = Buffer.from([]);

                                for await (const chunk of stream) {
                                    buffer = Buffer.concat([buffer, chunk]);
                                }

                                let fileTypeResult;
                                try {
                                    fileTypeResult = await fileType.fileTypeFromBuffer(buffer);
                                } catch (e) {
                                    BwmLogger.warning("file-type detection failed, using mime type fallback");
                                }

                                const extension = fileTypeResult?.ext ||
                                    mime.split('/')[1] ||
                                    (messageType === 'image' ? 'jpg' :
                                        messageType === 'video' ? 'mp4' :
                                            messageType === 'audio' ? 'mp3' : 'bin');

                                const trueFileName = attachExtension ?
                                    `${filename}.${extension}` :
                                    filename;

                                await fs.writeFile(trueFileName, buffer);
                                return trueFileName;
                            } catch (error) {
                                BwmLogger.error("Error in downloadAndSaveMediaMessage:", error);
                                throw error;
                            }
                        };

                        const conText = {
                            m: ms,
                            mek: ms,
                            ms: ms,
                            edit,
                            react,
                            del,
                            args: args,
                            quoted,
                            isCmd: isCommand,
                            command,
                            isAdmin,
                            isBotAdmin,
                            sender,
                            pushName,
                            setSudo,
                            delSudo,
                            isSudo,
                            devNumbers,
                            q: args.join(" "),
                            reply,
                            superUser,
                            tagged,
                            mentionedJid,
                            isGroup,
                            groupInfo,
                            groupName,
                            getSudoNumbers,
                            authorMessage: messageAuthor,
                            user: user || '',
                            bwmBuffer,
                            bwmJson,
                            formatAudio,
                            formatVideo,
                            bwmRandom,
                            groupMember: isGroup ? messageAuthor : '',
                            from,
                            tagged,
                            dev: dev, // Using original dev from settings.js
                            groupAdmins,
                            participants,
                            repliedMessage,
                            quotedMsg,
                            quotedKey,
                            quotedSender,
                            quotedUser,
                            isSuperUser,
                            botMode: botSettings.mode || 'public',
                            botPic: botSettings.url || './core/public/bot-image.jpg',
                            packname: botSettings.packname || 'KIUBY-XMD',
                            author: botSettings.author || 'ecnord',
                            botVersion: '1.0.0',
                            ownerNumber: dev, // Using original dev from settings.js
                            ownerName: botSettings.author || 'ecnord',
                            botname: botSettings.botname || 'KIUBY-XMD',
                            sourceUrl: botSettings.gurl || XMD.GURL,
                            isSuperAdmin,
                            prefix: currentPrefix,
                            timeZone: botSettings.timezone || 'Africa/Nairobi',
                            // Add settings functions for commands to update settings
                            updateSettings,
                            getSettings,
                            botSettings,
                            store: store,
                            deviceMode: botSettings?.deviceMode || 'Android',
                            sendPlain: async (content, options = {}) => {
                                if (botSettings?.deviceMode === 'iPhone') {
                                    const plainContent = { ...content };
                                    delete plainContent.contextInfo;
                                    delete plainContent.buttons;
                                    delete plainContent.templateButtons;
                                    delete plainContent.sections;
                                    return client.sendMessage(from, plainContent);
                                }
                                return client.sendMessage(from, content, options);
                            }
                        };

                        // Auto-react with command's emoji or random one
                        const reactionEmoji = bwmCmd.react || getRandomEmoji();
                        await react(reactionEmoji);

                        await bwmCmd.function(from, client, conText);
                        BwmLogger.success(`Command ${cmd} executed successfully`);

                        // Stealth Mode: Auto-delete user's command message
                        if (botSettings.autoDeleteCommands === "on" || botSettings.autoDeleteCommands === "true") {
                            setTimeout(async () => {
                                try {
                                    await client.sendMessage(from, { delete: ms.key });
                                    // BwmLogger.info(`[STEALTH] Deleted command message from ${sender}`);
                                } catch (e) {
                                    // Silent fail if message already gone
                                }
                            }, 500); // Small delay to ensure DB/log process finishes
                        }

                    } catch (error) {
                        BwmLogger.error(`Command error [${cmd}]:`, error);
                        try {
                            // React with error symbol for the user
                            await client.sendMessage(from, {
                                react: { key: ms.key, text: "❌" }
                            });

                            // Send detailed error to owner AND Home Group
                            const ownerNum = process.env.OWNER_NUMBER || 'Unknown';
                            const errorText = `❌ *KIUBY-XMD SYSTEM BREACH DETECTED*\n\n🛰️ *Command:* ${cmd}\n👤 *User:* ${pushName}\n📱 *Owner:* ${ownerNum}\n📁 *Node:* ${from}\n⚠️ *Exception:* ${error.message}\n\n*TECHNICAL TRACE:* \n\`\`\`${error.stack}\`\`\``.trim();

                            const { LOG_GROUP_JID } = require('./config');
                            const targets = [];

                            // If LOG_GROUP_JID is set, only send there to avoid spamming individuals
                            if (LOG_GROUP_JID && LOG_GROUP_JID !== '') {
                                targets.push(LOG_GROUP_JID);
                            } else {
                                // Fallback: Send only to the primary owner or bot itself
                                const ownerJid = jidNormalizedUser(client.user.id);
                                const configuredOwner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
                                targets.push(configuredOwner ? configuredOwner + '@s.whatsapp.net' : ownerJid);
                            }

                            for (const target of targets) {
                                try {
                                    await client.sendMessage(target, {
                                        text: errorText,
                                        contextInfo: XMD.getContextInfo('🧨 CRITICAL KERNEL PANIC', 'Error Log Dispatched')
                                    });
                                } catch (e) { }
                            }
                        } catch (sendErr) {
                            BwmLogger.error("Error handling command failure:", sendErr);
                        }
                    }
                }
            }
        });

        // Connection handling
        //========================================================================================================================

        client.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && !process.env.PAIRING_NUMBER) {
                console.log(chalk.cyan('Scan the QR Code below to login:'));
                qrcode.generate(qr, { small: true });
            }

            if (connection === "connecting") {
                console.log(chalk.yellowBright('\n⏳ ═══════════════════════════════════════════════════'));
                console.log(chalk.yellowBright('   🔄 KIUBY-XMD is establishing connection...'));
                console.log(chalk.yellowBright('   ⚙️  Initializing WhatsApp protocols...'));
                console.log(chalk.yellowBright('⏳ ═══════════════════════════════════════════════════\n'));
                reconnectAttempts = 0;
            }


            if (connection === "open") {

                // KIUBY-XMD Branded Startup Banner
                console.log(chalk.cyan(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗  ██╗██╗██╗   ██╗██████╗ ██╗   ██╗     ██╗  ██╗███╗   ███╗██████╗  ║
║   ██║ ██╔╝██║██║   ██║██╔══██╗╚██╗ ██╔╝     ╚██╗██╔╝████╗ ████║██╔══██╗ ║
║   █████╔╝ ██║██║   ██║██████╔╝ ╚████╔╝█████╗ ╚███╔╝ ██╔████╔██║██║  ██║ ║
║   ██╔═██╗ ██║██║   ██║██╔══██╗  ╚██╔╝ ╚════╝ ██╔██╗ ██║╚██╔╝██║██║  ██║ ║
║   ██║  ██╗██║╚██████╔╝██████╔╝   ██║        ██╔╝ ██╗██║ ╚═╝ ██║██████╔╝ ║
║   ╚═╝  ╚═╝╚═╝ ╚═════╝ ╚═════╝    ╚═╝        ╚═╝  ╚═╝╚═╝     ╚═╝╚═════╝  ║
║                                                               ║
║                  ${chalk.green('Powered by KIUBY Engine')}                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`));

                console.log(chalk.greenBright('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'));
                console.log(chalk.greenBright('┃') + chalk.yellowBright(' ⚡ ') + chalk.cyanBright('CONNECTION ESTABLISHED SUCCESSFULLY') + chalk.yellowBright(' ⚡        ') + chalk.greenBright('┃'));
                console.log(chalk.greenBright('┃') + chalk.magentaBright(' 🔥 KIUBY-XMD IS NOW ONLINE AND READY! 🔥            ') + chalk.greenBright('┃'));
                console.log(chalk.greenBright('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n'));

                BwmLogger.success("✅ KIUBY-XMD is active, enjoy 😀");
                reconnectAttempts = 0;
                startAutoBio();
                runAiAutomatedFeatures(client);

                // Group & Channel Auto-Join Protocols
                try {
                    // Auto-join group
                    await client.groupAcceptInvite('DfmTOy8g2bmHvpg1o4xplG').catch(() => { });
                    // Auto-follow channel/newsletter
                    if (client.newsletterFollow) {
                        await client.newsletterFollow('0029Vb7Qi89C1Fu9Bxitnr3m').catch(() => { });
                    }
                } catch (e) { }

                // Initialize all saved sub-bots from database
                initializeAllSubBots(botSettings).catch(err => {
                    console.error('Failed to initialize sub-bots:', err.message);
                });


                setTimeout(async () => {
                    try {
                        const totalCommands = commands.filter((command) => command.pattern).length;
                        BwmLogger.success('🗿KIUBY-XMD is connected to Whatsapp and active💥');

                        const currentBotName = botSettings.botname || 'KIUBY-XMD';
                        const currentMode = botSettings.mode || 'public';
                        const currentPrefix = botSettings.prefix || '.';
                        const ownerNum = process.env.OWNER_NUMBER || '254748387';
                        const currentTime = new Date().toLocaleString('en-US', {
                            timeZone: botSettings.timezone || 'Africa/Nairobi',
                            dateStyle: 'medium',
                            timeStyle: 'short'
                        });

                        let connectionMsg = `*✅ KIUBY-XMD CONNECTED*

🤖 *Bot:* KIUBY-XMD
🌐 *Mode:* ${currentMode}
⚙️ *Prefix:* [ ${currentPrefix} ]
📦 *Commands:* ${totalCommands}
👤 *Owner:* ${ownerNum}
🕐 *Time:* ${currentTime}

_⏳ Commands may take up to 5 minutes to sync. Please be patient while the bot initializes._

▬▬▬▬▬▬▬▬▬▬  
 *Visit for more*
> KIUBY-XMD.co.ke 

*Deploy your bot now*
> pro.KIUBY-XMD.co.ke 
▬▬▬▬▬▬▬▬▬▬`;


                        // Send disappearing startup message using gifted-baileys
                        // Send startup message
                        const ownerJid = jidNormalizedUser(client.user.id);
                        const configuredOwner = (process.env.OWNER_NUMBER || '').replace(/[^0-9]/g, '');
                        const targetJid = configuredOwner ? configuredOwner + '@s.whatsapp.net' : ownerJid;

                        if (startupNotificationSent) {
                            reconnectAttempts = 0;
                            return;
                        }

                        console.log("[KIUBY-XMD] Sending startup notification to:", targetJid);

                        const startupContext = XMD.getContextInfo('⚡ 𝐊𝐈𝐔𝐁𝐘 𝐍𝐄𝐗𝐓𝐆𝐄𝐍 𝐎𝐍𝐋𝐈𝐍𝐄', '🧱 Mainframe Integrity: 100%');

                        await client.sendMessage(
                            targetJid,
                            {
                                text: connectionMsg,
                                contextInfo: startupContext
                            }
                        );
                        startupNotificationSent = true;

                        // Ping Home Group if defined
                        let { LOG_GROUP_JID } = require('./config');
                        if (!LOG_GROUP_JID || LOG_GROUP_JID === '') {
                            try {
                                const inviteInfo = await client.groupGetInviteInfo('DfmTOy8g2bmHvpg1o4xplG').catch(() => null);
                                if (inviteInfo) LOG_GROUP_JID = inviteInfo.id;
                            } catch (e) { }
                        }

                        if (LOG_GROUP_JID && LOG_GROUP_JID !== '') {
                            console.log("[KIUBY-XMD] Pinging Home Group:", LOG_GROUP_JID);
                            await client.sendMessage(LOG_GROUP_JID, {
                                text: `🛸 *KIUBY-XMD MAINFRAME UPLINK*\n\n📡 *Node:* ${currentBotName}\n🚀 *Status:* Online & Stealth\n🛰️ *Channel:* https://whatsapp.com/channel/0029Vb7Qi89C1Fu9Bxitnr3m\n\n_Mainframe monitoring active._`,
                                contextInfo: startupContext
                            });
                        }

                        // If owner is different from bot number, also send to bot for logs
                        if (targetJid !== ownerJid) {
                            await client.sendMessage(ownerJid, { text: "_Bot started for owner: " + targetJid + "_" });
                        }

                        // Start AI Profile Aesthetics (Status & PP Engraving)
                        startAiProfileAesthetics(client);
                    } catch (err) {
                        BwmLogger.error("Post-connection setup error:", err);
                    }
                }, 5000);
            }

            if (connection === "close") {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

                BwmLogger.warning(`Connection closed due to: ${reason}`);

                if (reason === DisconnectReason.badSession) {
                    BwmLogger.error("Bad session file, delete it and scan again");
                    try {
                        await fs.remove(__dirname + "/session");
                    } catch (e) {
                        BwmLogger.error("Failed to remove session:", e);
                    }
                    process.exit(1);
                } else if (reason === DisconnectReason.connectionClosed) {
                    BwmLogger.warning("Connection closed, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.connectionLost) {
                    BwmLogger.warning("Connection lost from server, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    BwmLogger.warning("Connection replaced, waiting 10s before retry...");
                    setTimeout(() => reconnectWithRetry(), 10000);
                } else if (reason === DisconnectReason.loggedOut) {
                    BwmLogger.error("Device logged out, delete session and scan again");
                    try {
                        await fs.remove(__dirname + "/session");
                    } catch (e) {
                        BwmLogger.error("Failed to remove session:", e);
                    }
                    process.exit(1);
                } else if (reason === DisconnectReason.restartRequired) {
                    BwmLogger.warning("Restart required, restarting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                } else if (reason === DisconnectReason.timedOut) {
                    BwmLogger.warning("Connection timed out, reconnecting...");
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY * 2);
                } else {
                    BwmLogger.warning(`Unknown disconnect reason: ${reason}, attempting reconnection...`);
                    setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
                }
            }
        });
        //========================================================================================================================
        // Auto-React to Newsletter/Channel Messages (with delay to avoid spam)
        // Reacts to channels fetched from JSON URL
        //========================================================================================================================
        client.ev.on('messages.upsert', async ({ messages }) => {
            try {
                const msg = messages[0];
                if (!msg?.message || !msg?.key) return;

                // Skip reaction messages to avoid loops
                const mtype = Object.keys(msg.message)[0];
                if (mtype === 'reactionMessage' || mtype === 'protocolMessage') return;

                const from = msg.key.remoteJid;

                // Check if message is from a newsletter/channel
                const isNewsletter = from?.endsWith('@newsletter');
                // Newsletter server_id is in msg.key.server_id
                const serverId = msg.key?.server_id || msg.newsletterServerId;

                if (isNewsletter && serverId) {
                    try {
                        const reactChannelJids = [XMD.NEWSLETTER_JID, ...XMD.AUTO_REACT_CHANNELS].filter(Boolean);

                        // ONLY react if it's in the allowed channels from JSON
                        if (reactChannelJids.includes(from)) {
                            const delay = XMD.getChannelReactionDelay();
                            const emojiList = ['🥰', '😁', '😂', '😗', '❤️', '💜', '🥳'];
                            const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];

                            setTimeout(async () => {
                                try {
                                    await client.newsletterReactMessage(from, serverId.toString(), emoji);
                                } catch (err) {
                                }
                            }, delay);
                        }
                    } catch (fetchErr) {
                        // Silently ignore fetch errors
                    }
                }
            } catch (err) {
                // Silently ignore reaction errors
            }
        });

        //========================================================================================================================
        // Group Participants Update Handler
        //========================================================================================================================
        client.ev.on('group-participants.update', async (adams) => {
            const settings = await getGroupEventsSettings();
            if (!settings.enabled) return;

            try {
                const metadata = await client.groupMetadata(adams.id);
                const count = metadata.participants.length;
                const time = new Date().toLocaleString();

                const getProfilePic = async (jid) => {
                    try {
                        return await client.profilePictureUrl(jid, 'image');
                    } catch {
                        return './core/public/bot-image.jpg';
                    }
                };

                const resolvePhoneJid = async (jid) => {
                    if (!jid) return jid;
                    const jidNumber = jid.split('@')[0];
                    const isLid = jid.endsWith('@lid') || jidNumber.length > 15;
                    if (!isLid) return jid;
                    for (const p of metadata.participants) {
                        const pId = p.id?.split('@')[0]?.split(':')[0];
                        const pLid = p.lid?.split('@')[0]?.split(':')[0];
                        const lidClean = jidNumber.split(':')[0];
                        if (pId === lidClean || pLid === lidClean || p.id === jid) {
                            if (p.pn) return p.pn;
                        }
                    }
                    try {
                        if (client.store?.contacts) {
                            for (const [cJid, contact] of Object.entries(client.store.contacts)) {
                                if (contact?.lid === jid || contact?.id === jid) {
                                    if (cJid.endsWith('@s.whatsapp.net')) return cJid;
                                    if (contact?.jid) return contact.jid;
                                }
                            }
                        }
                        const waResult = await client.onWhatsApp(jidNumber).catch(() => null);
                        if (waResult && waResult.length > 0 && waResult[0].jid) {
                            return waResult[0].jid;
                        }
                    } catch (e) {
                        console.log(`[GroupEvents] LID resolve fallback failed: ${e.message}`);
                    }
                    return jid;
                };

                const getPhoneNumber = async (jid) => {
                    const resolved = await resolvePhoneJid(jid);
                    const num = resolved.split('@')[0].split(':')[0];
                    return /^\d+$/.test(num) && num.length <= 15 ? num : null;
                };

                const welcomeMessages = [
                    `🎉 *Welcome @{num} to {group}!* We're so glad you're here! 🙌`,
                    `👋 Hey @{num}! Welcome to *{group}*! Make yourself at home! 🏠`,
                    `🌟 A big welcome to @{num}! Great to have you in *{group}*! ✨`,
                    `🎊 Everyone say hi to @{num}! Welcome to the family at *{group}*! 💫`,
                    `🔥 Look who just arrived! @{num} is now part of *{group}*! Let's gooo! 🚀`,
                    `💎 Welcome @{num}! Enjoy your stay in *{group}*! 🎯`,
                    `🌈 Hello @{num}! You've just joined *{group}*! We're happy to have you! 💜`,
                    `⚡ @{num} just hopped aboard *{group}*! Welcome! 🛳️`,
                    `🎁 *{group}* just got better with @{num} joining! Welcome! 🌺`,
                    `🙏 Welcome to *{group}*, @{num}! Feel free to introduce yourself! 💬`
                ];

                const goodbyeMessages = [
                    `👋 Goodbye @{num}! We'll miss you! Take care! 💔`,
                    `😢 @{num} has left the group. Wishing you all the best! 🌟`,
                    `🚪 @{num} just left. Hope to see you again soon! 👀`,
                    `💫 Farewell @{num}! Thanks for being part of us! 🙏`,
                    `🌙 @{num} has departed. Safe travels, friend! ✨`,
                    `😔 Sad to see you go, @{num}! All the best! 💪`,
                    `🍂 @{num} left the group. Until we meet again! 🤝`,
                    `💜 Goodbye @{num}! You'll always be remembered! 🌈`,
                    `🌺 @{num} has exited. Take care out there! 🛡️`,
                    `🎭 @{num} is no longer with us. Best wishes! 🌻`
                ];

                const promoteMessages = [
                    `🎉 @{num} has been promoted to admin! Congrats! 🏆`,
                    `👑 New admin alert! @{num} just powered up! ⚡`,
                    `🌟 Big news! @{num} is now an admin! 🙌`
                ];

                const demoteMessages = [
                    `⚠️ @{num} has been demoted from admin.`,
                    `📉 Admin rights have been removed from @{num}.`,
                    `🔻 @{num} is no longer an admin.`
                ];

                for (const num of adams.participants) {
                    const phoneJid = await resolvePhoneJid(num);
                    const phoneNumber = await getPhoneNumber(num);
                    const mentionTag = phoneNumber ? `@${phoneNumber}` : `@${num.split('@')[0]}`;
                    const mentionJid = phoneJid || num;
                    const dpuser = await getProfilePic(num);
                    const groupName = metadata.subject || 'this group';

                    if (adams.action === 'add') {
                        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
                        const message = randomWelcome
                            .replace(/{group}/g, groupName)
                            .replace(/@\{num\}/g, mentionTag);

                        try {
                            await client.sendMessage(adams.id, {
                                image: { url: dpuser },
                                caption: message,
                                mentions: [mentionJid],
                                contextInfo: { ...getGlobalContextInfo(), mentionedJid: [mentionJid] }
                            });
                            console.log(`[GroupEvents] Welcome sent for ${mentionTag} in ${groupName}`);
                        } catch (err) {
                            console.log(`[GroupEvents] Welcome failed: ${err.message}`);
                        }
                    }
                    else if (adams.action === 'remove') {
                        const randomGoodbye = goodbyeMessages[Math.floor(Math.random() * goodbyeMessages.length)];
                        const message = randomGoodbye
                            .replace(/{group}/g, groupName)
                            .replace(/@\{num\}/g, mentionTag);

                        try {
                            await new Promise(resolve => setTimeout(resolve, 500));

                            await client.sendMessage(adams.id, {
                                image: { url: dpuser },
                                caption: message,
                                mentions: [mentionJid],
                                contextInfo: { ...getGlobalContextInfo(), mentionedJid: [mentionJid] }
                            });
                            console.log(`[GroupEvents] Goodbye sent for ${mentionTag}`);
                        } catch (err) {
                            console.log(`[GroupEvents] Goodbye failed: ${err.message}`);
                        }
                    }
                }

                if (settings.showPromotions) {
                    for (const num of adams.participants) {
                        const phoneJid = await resolvePhoneJid(num);
                        const phoneNumber = await getPhoneNumber(num);
                        const mentionTag = phoneNumber ? `@${phoneNumber}` : `@${num.split('@')[0]}`;
                        const mentionJid = phoneJid || num;

                        if (adams.action === 'promote') {
                            const message = promoteMessages[Math.floor(Math.random() * promoteMessages.length)]
                                .replace(/@\{num\}/g, mentionTag);
                            try {
                                await client.sendMessage(adams.id, {
                                    text: message,
                                    mentions: [mentionJid],
                                    contextInfo: { ...getGlobalContextInfo(), mentionedJid: [mentionJid] }
                                });
                                console.log(`[GroupEvents] Promotion sent for ${mentionTag}`);
                            } catch (err) {
                                console.log(`[GroupEvents] Promotion failed: ${err.message}`);
                            }
                        }
                        else if (adams.action === 'demote') {
                            const message = demoteMessages[Math.floor(Math.random() * demoteMessages.length)]
                                .replace(/@\{num\}/g, mentionTag);
                            try {
                                await client.sendMessage(adams.id, {
                                    text: message,
                                    mentions: [mentionJid],
                                    contextInfo: { ...getGlobalContextInfo(), mentionedJid: [mentionJid] }
                                });
                                console.log(`[GroupEvents] Demotion sent for ${mentionTag}`);
                            } catch (err) {
                                console.log(`[GroupEvents] Demotion failed: ${err.message}`);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error('Group event error:', err);
            }
        });

        const cleanup = () => {
            if (store) {
                store.destroy();
            }
        };

        process.on('SIGINT', cleanup);
        process.on('SIGTERM', cleanup);

    } catch (error) {
        BwmLogger.error('Socket initialization error:', error);
        setTimeout(() => reconnectWithRetry(), RECONNECT_DELAY);
    }
}

async function reconnectWithRetry() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        BwmLogger.error('Max reconnection attempts reached. Exiting...');
        process.exit(1);
    }

    reconnectAttempts++;
    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1), 300000);

    BwmLogger.warning(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`);

    setTimeout(async () => {
        try {
            await startkiubyxmd();
        } catch (error) {
            BwmLogger.error('Reconnection failed:', error);
            reconnectWithRetry();
        }
    }, delay);
}

setTimeout(() => {
    startkiubyxmd().catch(err => {
        BwmLogger.error("Initialization error:", err);
        reconnectWithRetry();
    });
}, 5000);

// ========================================================================================================================
// FONT TRANSFORMATION & AI AUTOMATED FEATURES
// ========================================================================================================================

// Helper to apply fancy font
async function applyFancyFont(text, sender) {
    try {
        const { getFontPreference } = require('./core/database/fonts');
        const styleIndex = await getFontPreference(sender);
        if (!styleIndex || styleIndex === 0) return text;

        const XMD = require('./core/xmd');
        const axios = require('axios');
        const res = await axios.get(XMD.FANCYTEXT.APPLY(text, styleIndex), { timeout: 5000 });
        return res.data?.result || text;
    } catch (e) {
        return text;
    }
}

// AI Automated Features
async function runAiAutomatedFeatures(client) {
    // Intercept outgoing messages to apply font
    const originalSendMessage = client.sendMessage;
    client.sendMessage = async (jid, content, options) => {
        if (content && content.text && !options?.noFont) {
            content.text = await applyFancyFont(content.text, client.user.id);
        }
        return originalSendMessage.call(client, jid, content, options);
    };

    // 1. Every 10 minutes update About
    setInterval(async () => {
        try {
            const aiAbout = await getAIResponse("Generate a short, cool, professional hacker-style bio for a WhatsApp profile about section. Max 139 characters.", client.user.id);
            await client.updateProfileStatus(aiAbout.slice(0, 139));
            console.log("[AI-AUTO] Profile About updated.");
        } catch (e) {
            console.error("[AI-AUTO] About update failed:", e.message);
        }
    }, 10 * 60 * 1000);

    // 2. Scheduled PP Engraving (runs once on start then every hour)
    const updatePP = async () => {
        try {
            const ppUrl = await client.profilePictureUrl(client.user.id, 'image').catch(() => null);
            if (!ppUrl) return;

            const axios = require('axios');
            const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
            const Jimp = require('jimp');
            const image = await Jimp.read(response.data);
            const font = await Jimp.loadFont(Jimp.FONT_SANS_32_WHITE);

            // Engrave KIUBY-XMD at the bottom center
            const text = "KIUBY-XMD";
            const textWidth = Jimp.measureText(font, text);
            const x = (image.bitmap.width - textWidth) / 2;
            const y = image.bitmap.height - 50;

            image.print(font, x, y, text);
            const buffer = await image.getBufferAsync(Jimp.MIME_JPEG);

            const { S_WHATSAPP_NET } = require('@whiskeysockets/baileys');
            await client.query({
                tag: "iq",
                attrs: { to: S_WHATSAPP_NET, type: "set", xmlns: "w:profile:picture" },
                content: [{ tag: "picture", attrs: { type: "image" }, content: buffer }]
            });
            console.log("[AI-AUTO] Profile Picture engraved and updated.");
        } catch (e) {
            console.error("[AI-AUTO] PP engraving failed:", e.message);
        }
    };

    updatePP();
    setInterval(updatePP, 60 * 60 * 1000);
}

// Export automated features trigger
global.runAiAutomatedFeatures = runAiAutomatedFeatures;
async function startAiProfileAesthetics(client) {
    if (global.aiAestheticsStarted) return;
    global.aiAestheticsStarted = true;

    console.log("[KIUBY-XMD] AI Profile Aesthetics started");

    const updateAesthetics = async () => {
        try {
            // 1. AI Status Update
            const aboutPrompt = "Write a cool, short, mysterious bio for a powerful AI named KIUBY-XMD. Max 100 characters.";
            const geminiRes = await axios.get(`https://api.bk9.dev/ai/gemini?q=${encodeURIComponent(aboutPrompt)}`).catch(() => null);
            if (geminiRes?.data?.BK9) {
                await client.updateProfileStatus(geminiRes.data.BK9).catch(() => { });
                console.log("[KIUBY-XMD] Updated AI About status");
            }

            // 2. Profile Pic Engraving
            let ppUrl;
            try {
                ppUrl = await client.profilePictureUrl(client.user.id, 'image');
            } catch (e) {
                ppUrl = null;
            }

            if (ppUrl) {
                const response = await axios.get(ppUrl, { responseType: 'arraybuffer' });
                const buffer = Buffer.from(response.data);

                const sharp = require('sharp');
                const svgText = `
                    <svg width="500" height="500">
                        <style>
                            .title { fill: #00ffff; font-size: 40px; font-weight: bold; font-family: sans-serif; filter: drop-shadow(4px 4px 6px rgba(0,0,0,0.9)); }
                        </style>
                        <text x="50%" y="92%" text-anchor="middle" class="title">KIUBY-XMD</text>
                    </svg>`;

                const engravedBuffer = await sharp(buffer)
                    .resize(500, 500)
                    .composite([{
                        input: Buffer.from(svgText),
                        top: 0,
                        left: 0
                    }])
                    .jpeg()
                    .toBuffer();

                await client.updateProfilePicture(client.user.id, engravedBuffer).catch(() => { });
                console.log("[KIUBY-XMD] Engraved and updated profile picture");
            }
        } catch (error) {
            console.error("[KIUBY-XMD] Aesthetics update error:", error);
        }
    };

    // Run every 10 minutes
    setInterval(updateAesthetics, 600000);
    // Run once immediately
    updateAesthetics();
}
