const { kiubyxmd } = require('../core/commandHandler');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

kiubyxmd({
    pattern: "update",
    aliases: ["upgrade", "sync"],
    description: "Pull latest changes from GitHub, install dependencies and restart",
    category: "System",
    filename: __filename,
    reaction: "🔄"
}, async (from, client, conText) => {
    const { reply, isSuperUser } = conText;

    if (!isSuperUser) return reply("❌ Owner-only command");

    try {
        await reply("🚀 *KIUBY-XMD*: Initializing Update Protocol...");

        // Stage 1: Fetch and Check Updates (Detail Mode)
        await reply("📡 *Step 1/4*: Checking for new neural patches...");

        const logs = await new Promise((resolve, reject) => {
            exec('git fetch origin main && git log HEAD..origin/main --pretty=format:"• %s (%h)"', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
                if (err) return reject(new Error(`Git Fetch Error: ${stderr}`));
                resolve(stdout.trim());
            });
        });

        if (!logs) {
            return reply("✅ *KIUBY-XMD*: System is already running the latest neural patch.");
        }

        const files = await new Promise((resolve) => {
            exec('git diff --name-only HEAD..origin/main', { cwd: path.join(__dirname, '..') }, (err, stdout) => {
                resolve(stdout ? stdout.trim() : "None detected");
            });
        });

        const commitCount = logs.split('\n').length;
        const patchReport = `📥 *NEURAL PATCH DETECTED* (${commitCount} Commits)\n\n` +
            `📜 *COMMIT LOGS*:\n${logs}\n\n` +
            `📁 *IMPACTED ASSETS*:\n\`\`\`\n${files}\n\`\`\`\n\n` +
            `_Siphoning data from mainframe..._`;

        await reply(patchReport);

        // Stage 2: Git Pull (Actual update)
        await reply("📡 *Step 2/4*: Synchronizing with GitHub mainframe...");
        await new Promise((resolve, reject) => {
            exec('git pull origin main', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
                if (err) return reject(new Error(`Git Pull Error: ${stderr}`));
                resolve();
            });
        });

        // Stage 3: NPM Install
        await reply("📦 *Step 3/4*: Upgrading dependency shards...");
        await new Promise((resolve, reject) => {
            exec('npm install', { cwd: path.join(__dirname, '..'), timeout: 180000 }, (err, stdout, stderr) => {
                if (err) {
                    console.error("NPM Install Error:", stderr);
                    // Don't reject if just warnings
                    if (stderr.includes('ERR!')) return reject(new Error(`NPM Install Failed: ${stderr.slice(0, 500)}`));
                }
                reply("📦 Dependencies optimized.");
                resolve();
            });
        });

        // Stage 4: Restart
        await reply("✅ *Step 4/4*: Update sequence complete. Rebooting mainframe...");

        setTimeout(() => {
            if (global.fullReboot) {
                global.fullReboot("System Update Applied via Command");
            } else {
                process.exit(0);
            }
        }, 3000);

    } catch (err) {
        console.error("❗ Update failed:", err);
        await reply(`❌ *KIUBY-XMD*: Update sequence aborted.\n⚠️ *Detail*: ${err.message}`);
    }
});
