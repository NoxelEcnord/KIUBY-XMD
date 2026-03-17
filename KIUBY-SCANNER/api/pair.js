const { default: makeWASocket, useMultiFileAuthState, delay, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser, DisconnectReason } = require("@whiskeysockets/baileys");
const pino = require("pino");
const pako = require("pako");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
    const { number } = req.query;

    if (!number) {
        return res.status(400).json({ status: 'error', message: 'Phone number is required' });
    }

    const cleanNumber = number.replace(/\D/g, '');
    const sessionDir = `/tmp/session-${cleanNumber}`;

    // Ensure clean session directory
    if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    fs.mkdirSync(sessionDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
    });

    return new Promise(async (resolve) => {
        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                try {
                    const userJid = jidNormalizedUser(sock.user.id);
                    const credsData = fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf-8');

                    // Compress and Encode
                    const compressed = pako.gzip(credsData);
                    let base64 = Buffer.from(compressed).toString('base64');

                    // Format as XMDI
                    let sessionID = base64;
                    if (base64.startsWith('H4sI')) {
                        sessionID = 'XMDI' + base64.slice(4);
                    } else if (base64.startsWith('H4s')) {
                        sessionID = 'XMD' + base64.slice(3);
                    }

                    const message = `*KIUBY-XMD SESSION CONNECTED*\n\nYour Session ID is below. Copy and paste it into your config file.\n\n\`\`\`${sessionID}\`\`\`\n\n*DO NOT SHARE THIS CODE WITH ANYONE!*`;

                    await sock.sendMessage(userJid, { text: message });

                    // Delay before logout to ensure message is delivered
                    await delay(5000);

                    // Cleanup
                    console.log(`[SCANNER] Session generated for ${cleanNumber}`);
                    sock.end();
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    resolve();
                } catch (e) {
                    console.error('Error sending session ID:', e);
                    resolve();
                }
            } else if (connection === 'close') {
                const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                if (!shouldReconnect) {
                    fs.rmSync(sessionDir, { recursive: true, force: true });
                    resolve();
                }
            }
        });

        if (!sock.authState.creds.registered) {
            try {
                await delay(2000);
                const code = await sock.requestPairingCode(cleanNumber);
                res.status(200).json({ status: 'success', code });
            } catch (err) {
                console.error(err);
                res.status(500).json({ status: 'error', message: 'Failed to generate pairing code' });
                resolve();
            }
        }
    });
};

