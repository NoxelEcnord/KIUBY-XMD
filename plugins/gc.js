const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');

// ══════════════════════════════════════════════════════════════
// MESSAGE GARBAGE COLLECTOR — Auto-delete bot responses
// Prevents WhatsApp chat bloat by cleaning up bot messages
// ══════════════════════════════════════════════════════════════

// Global GC queue: stores { from, key, deleteAt }
if (!global.gcQueue) {
    global.gcQueue = [];
    global.gcRunning = false;
    global.gcEnabled = true;
    global.gcTimeout = 60; // seconds before auto-delete (default: 60s)
}

// Background GC loop — runs every 5 seconds
const startGCLoop = (client) => {
    if (global.gcRunning) return;
    global.gcRunning = true;

    setInterval(async () => {
        if (!global.gcEnabled || global.gcQueue.length === 0) return;

        const now = Date.now();
        const expired = global.gcQueue.filter(item => now >= item.deleteAt);

        for (const item of expired) {
            try {
                await client.sendMessage(item.from, { delete: item.key });
            } catch (e) {
                // Silently fail — message may already be gone
            }
        }

        // Remove processed items
        global.gcQueue = global.gcQueue.filter(item => now < item.deleteAt);
    }, 5000);
};

// Helper: schedule a message for deletion
const scheduleDelete = (from, key, timeoutSeconds) => {
    if (!global.gcEnabled) return;
    const timeout = (timeoutSeconds || global.gcTimeout) * 1000;
    global.gcQueue.push({
        from,
        key,
        deleteAt: Date.now() + timeout
    });
};

// Expose globally so other plugins can use it
global.scheduleDelete = scheduleDelete;
global.startGCLoop = startGCLoop;

// ══════════════════════════════════════════════════════════════
// Commands
// ══════════════════════════════════════════════════════════════

kiubyxmd({
    pattern: "gc",
    aliases: ["autodel", "garbagecollect"],
    description: "Toggle message garbage collection (auto-delete bot responses)",
    category: "System",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, botSettings, updateSettings } = conText;

    if (!isSuperUser) return reply("❌ *ACCESS DENIED*: Requires SuperUser clearance.");

    // Start the GC loop if not already running
    startGCLoop(client);

    if (!q) {
        const gcStatus = global.gcEnabled ? '🟢 ON' : '🔴 OFF';
        const stealthStatus = (botSettings.autoDeleteCommands === "on" || botSettings.autoDeleteCommands === "true") ? '🟢 ON' : '🔴 OFF';

        return reply(
            `♻️ *KIUBY-XMD GARBAGE COLLECTION*\n\n` +
            `▸ *Response Auto-Delete:* ${gcStatus} (${global.gcTimeout}s)\n` +
            `▸ *Command Auto-Delete:* ${stealthStatus}\n\n` +
            `📌 *Usage*:\n` +
            `• \`.gc on/off\` — Toggle response cleanup\n` +
            `• \`.gc cmd on/off\` — Toggle command scrubbing\n` +
            `• \`.gc <seconds>\` — Set response timeout\n` +
            `• \`.gc flush\` — Clear all queued response deletions`
        );
    }

    if (q === 'cmd on') {
        await updateSettings({ autoDeleteCommands: "on" });
        return reply("✅ *STEALTH MODE*: Commands will now be scrubbed after execution.");
    }

    if (q === 'cmd off') {
        await updateSettings({ autoDeleteCommands: "off" });
        return reply("❌ *STEALTH MODE*: Command scrubbing disabled.");
    }

    if (q === 'on') {
        global.gcEnabled = true;
        await updateSettings({ autoDeleteResponses: "on" });
        return reply("♻️ Garbage collection *enabled*. Bot responses will auto-delete after " + global.gcTimeout + "s.");
    }

    if (q === 'off') {
        global.gcEnabled = false;
        global.gcQueue = [];
        await updateSettings({ autoDeleteResponses: "off" });
        return reply("♻️ Garbage collection *disabled*.");
    }

    if (q === 'flush') {
        const count = global.gcQueue.length;
        for (const item of global.gcQueue) {
            try {
                await client.sendMessage(item.from, { delete: item.key });
            } catch (e) { }
        }
        global.gcQueue = [];
        return reply(`♻️ Flushed ${count} queued messages.`);
    }

    const timeout = parseInt(q);
    if (!isNaN(timeout) && timeout > 0) {
        global.gcTimeout = timeout;
        return reply(`♻️ Auto-delete timeout set to *${timeout} seconds*.`);
    }

    return reply("⚠️ Invalid usage. Try `.gc on`, `.gc off`, `.gc cmd on`, or `.gc 30`.");
});

module.exports = { scheduleDelete, startGCLoop };
