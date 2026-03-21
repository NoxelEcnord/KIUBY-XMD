const fs = require('fs-extra');
const path = require('path');

/**
 * Powerful Session Cleaner for KIUBY-XMD
 * Runs every minute to keep the bot "sleek" and prevent disk exhaustion.
 */
function startSessionCleaner(client) {
    console.log('[CLEANER] 🧹 Session cleaner service started (1m interval)');

    const CLEANUP_INTERVAL = 60 * 1000; // 1 minute
    const FILE_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes for tmp/antidelete
    const SESSION_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes for old session keys

    setInterval(async () => {
        try {
            const now = Date.now();
            let totalDeleted = 0;

            // 1. Clean tmp/ directory
            const tmpDir = path.join(__dirname, '../tmp');
            if (fs.existsSync(tmpDir)) {
                const files = await fs.readdir(tmpDir);
                for (const file of files) {
                    const filePath = path.join(tmpDir, file);
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtimeMs > FILE_EXPIRY_MS) {
                        await fs.remove(filePath);
                        totalDeleted++;
                    }
                }
            }

            // 2. Clean antidelete_data/ directory
            const antiDeleteDir = path.join(__dirname, '../antidelete_data');
            if (fs.existsSync(antiDeleteDir)) {
                const files = await fs.readdir(antiDeleteDir);
                for (const file of files) {
                    const filePath = path.join(antiDeleteDir, file);
                    const stats = await fs.stat(filePath);
                    if (now - stats.mtimeMs > FILE_EXPIRY_MS) {
                        await fs.remove(filePath);
                        totalDeleted++;
                    }
                }
            }

            // 3. Clean main session directory (aggressive but safe)
            const mainSessionDir = path.join(__dirname, '../session');
            if (fs.existsSync(mainSessionDir)) {
                const files = await fs.readdir(mainSessionDir);
                for (const file of files) {
                    // NEVER delete creds.json
                    if (file === 'creds.json') continue;

                    const filePath = path.join(mainSessionDir, file);
                    const stats = await fs.stat(filePath);
                    // Delete pre-keys, app-states, etc. older than 5 mins
                    if (now - stats.mtimeMs > SESSION_EXPIRY_MS) {
                        await fs.remove(filePath);
                        totalDeleted++;
                    }
                }
            }

            // 4. Clean sub-bot sessions
            const subBotsDir = path.join(__dirname, 'subbots_sessions');
            if (fs.existsSync(subBotsDir)) {
                const botFolders = await fs.readdir(subBotsDir);
                for (const folder of botFolders) {
                    const folderPath = path.join(subBotsDir, folder);
                    const folderStat = await fs.stat(folderPath);
                    if (folderStat.isDirectory()) {
                        const files = await fs.readdir(folderPath);
                        for (const file of files) {
                            if (file === 'creds.json') continue;
                            const filePath = path.join(folderPath, file);
                            const stats = await fs.stat(filePath);
                            if (now - stats.mtimeMs > SESSION_EXPIRY_MS) {
                                await fs.remove(filePath);
                                totalDeleted++;
                            }
                        }
                    }
                }
            }

            if (totalDeleted > 0) {
                console.log(`[CLEANER] 🧹 Sleek operation complete: ${totalDeleted} files removed.`);
            }

        } catch (err) {
            console.error('[CLEANER] ❌ Cleanup error:', err.message);
        }
    }, CLEANUP_INTERVAL);
}

module.exports = startSessionCleaner;
