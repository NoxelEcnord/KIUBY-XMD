const { kiubyxmd } = require('../core/commandHandler');
const fs = require('fs-extra');
const path = require('path');
const { deployNewBot } = require('../core/subBotManager');
const XMD = require('../core/xmd');

/**
 * Session Management & Pairing Plugin for KIUBY-XMD
 */

// 1. .pair command - Generate pairing code
kiubyxmd({
    pattern: "pair",
    aliases: ["pairing", "code"],
    description: "Generate a pairing code for sub-bot deployment",
    category: "Owner",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner only command");

    if (!q) {
        return reply(`*🔗 KIUBY-XMD PAIRING HELP*\n\n` +
            `Usage: \`.pair 254XXXXXXXXX\`\n\n` +
            `This will generate a pairing code for your sub-bot. Alternatively, use our web scanner:\n` +
            `> https://pair.bwmxmd.co.ke/`);
    }

    const phoneNumber = q.replace(/[^0-9]/g, '');
    if (phoneNumber.length < 10) return reply("❌ Invalid phone number format.");

    try {
        await reply(`⏳ Requesting pairing code for *${phoneNumber}*...`);
        const code = await client.requestPairingCode(phoneNumber);
        const formattedCode = code?.match(/.{1,4}/g)?.join('-');

        const msg = `*🛡️ KIUBY-XMD PAIRING CODE*\n\n` +
            `📱 *Number:* ${phoneNumber}\n` +
            `🔑 *Code:* \`${formattedCode}\`\n\n` +
            `> Enter this code in WhatsApp -> Linked Devices -> Link with Phone Number.\n` +
            `> Once linked, you will receive a *Session ID*. Share it with me using \`.subbot <SESSION_ID>\` to start your sub-bot.`;

        await reply(msg);
    } catch (err) {
        console.error('Pairing error:', err);
        reply(`❌ Failed to generate code: ${err.message}\n\nFallback to Web: https://pair.bwmxmd.co.ke/`);
    }
});

// 2. .subbot / .deploy command - Deploy sub-bot
kiubyxmd({
    pattern: "subbot",
    aliases: ["deploy", "startbot"],
    description: "Deploy a sub-bot using a Session ID",
    category: "Owner",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner only command");

    if (!q) return reply("❌ Please provide a valid Session ID.\nUsage: `.subbot SESSION_ID` (Starts with XMD...)");

    try {
        await reply("⏳ Deploying sub-bot... Please wait.");
        const result = await deployNewBot(q);

        if (result.success) {
            reply(`✅ *Bot Deployed Successfully!*\n\n🤖 *Bot ID:* ${result.botId}\n📅 *Expires:* ${new Date(result.expiresAt).toLocaleDateString()}\n\n> The bot is connecting in the background. Check your linked devices.`);
        } else {
            reply(`❌ *Deployment Failed:*\n${result.message}`);
        }
    } catch (err) {
        console.error('Subbot deploy error:', err);
        reply(`❌ System Error: ${err.message}`);
    }
});

// 3. .session command - Update main session and reboot
kiubyxmd({
    pattern: "session",
    aliases: ["updatesession", "setsession"],
    description: "Update the main bot Session ID",
    category: "Owner",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner only command");

    if (!q) return reply("❌ Provide a new Session ID to replace the current one.");

    try {
        const configPath = path.join(__dirname, '../config.env');
        let configContent = "";

        if (fs.existsSync(configPath)) {
            configContent = await fs.readFile(configPath, 'utf8');
            // Regex to replace SESSION value
            if (configContent.includes('SESSION=')) {
                configContent = configContent.replace(/SESSION=.*/, `SESSION=${q}`);
            } else {
                configContent += `\nSESSION=${q}`;
            }
        } else {
            configContent = `SESSION=${q}\n`;
        }

        await fs.writeFile(configPath, configContent);
        await reply("✅ *Session ID Updated!*\n\n> The bot will now reboot to apply changes. Please wait for reconnection.");

        console.log('[SESSION] Update requested. Rebooting in 3 seconds...');
        setTimeout(() => {
            process.exit(0); // Assuming supervisor (PM2/Nodemon) will restart it
        }, 3000);

    } catch (err) {
        console.error('Session update error:', err);
        reply(`❌ Failed to update session: ${err.message}`);
    }
});

// 4. .sessions command - Manual deep cleanup
kiubyxmd({
    pattern: "sessions",
    aliases: ["clearsessiondata", "sessons"],
    description: "Deep cleanup of the session directory (Wipe and Reset)",
    category: "Owner",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Owner only command");

    try {
        const sessionDir = path.join(__dirname, '../session');
        if (fs.existsSync(sessionDir)) {
            await reply("🧹 *Performing deep session cleanup...*");
            const files = await fs.readdir(sessionDir);
            let count = 0;
            for (const file of files) {
                // In deep cleanup, we delete EVERYTHING to force a fresh login/re-sync
                await fs.remove(path.join(sessionDir, file));
                count++;
            }
            await reply(`✅ *Session directory wiped clean!* (${count} items removed)\n\n> You may need to reconnect or reboot.`);
        } else {
            reply("❌ Session directory not found.");
        }
    } catch (err) {
        console.error('Sessions deep cleanup error:', err);
        reply(`❌ Cleanup failed: ${err.message}`);
    }
});
