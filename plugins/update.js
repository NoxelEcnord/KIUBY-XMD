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

        // Stage 1: Git Pull
        await reply("📡 *Step 1/3*: Synchronizing with GitHub mainframe...");
        await new Promise((resolve, reject) => {
            exec('git pull origin main', { cwd: path.join(__dirname, '..') }, (err, stdout, stderr) => {
                if (err) {
                    if (stderr.includes('not a git repository')) {
                        return reject(new Error("Local system is not a git repository. Manual update required."));
                    }
                    return reject(new Error(`Git Pull Error: ${stderr}`));
                }
                console.log("Git Pull:", stdout);
                if (stdout.includes('Already up to date')) {
                    reply("✅ System is already running the latest neural patch.");
                    // Still proceed to npm install just in case of corruption
                    resolve('up-to-date');
                } else {
                    reply("📥 Updates siphoned successfully.");
                    resolve('updated');
                }
            });
        });

        // Stage 2: NPM Install
        await reply("📦 *Step 2/3*: Upgrading dependency shards...");
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

        // Stage 3: Restart
        await reply("✅ *Step 3/3*: Update sequence complete. Rebooting mainframe...");

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
