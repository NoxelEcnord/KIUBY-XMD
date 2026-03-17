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
    category: "Settings",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser } = conText;

    if (!isSuperUser) return reply("❌ Owner only command");

    // Start the GC loop if not already running
    startGCLoop(client);

    if (!q) {
        const status = global.gcEnabled ? '🟢 ON' : '🔴 OFF';
        return reply(
            `♻️ *Garbage Collection Status*\n\n` +
            `• Status: ${status}\n` +
            `• Timeout: ${global.gcTimeout}s\n` +
            `• Queued: ${global.gcQueue.length} messages\n\n` +
            `Usage:\n` +
            `• \`.gc on\` / \`.gc off\` — Toggle\n` +
            `• \`.gc 30\` — Set timeout to 30 seconds\n` +
            `• \`.gc flush\` — Delete all queued messages now`
        );
    }

    if (q === 'on') {
        global.gcEnabled = true;
        return reply("♻️ Garbage collection *enabled*. Bot responses will auto-delete after " + global.gcTimeout + "s.");
    }

    if (q === 'off') {
        global.gcEnabled = false;
        global.gcQueue = [];
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

    return reply("⚠️ Invalid usage. Try `.gc on`, `.gc off`, `.gc 30`, or `.gc flush`.");
});

module.exports = { scheduleDelete, startGCLoop };
