const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const pino = require("pino");
const pako = require("pako");
const fs = require("fs");
const path = require("path");

module.exports = async (req, res) => {
    const sessionDir = `/tmp/session-qr-${Date.now()}`;
    if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir, { recursive: true });

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
        let qrSent = false;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', async (update) => {
            const { connection, qr, lastDisconnect } = update;

            if (qr && !qrSent) {
                qrSent = true;
                res.status(200).json({ status: 'success', qr });
            }

            if (connection === 'open') {
                try {
                    const userJid = jidNormalizedUser(sock.user.id);
                    const credsData = fs.readFileSync(path.join(sessionDir, 'creds.json'), 'utf-8');

                    const compressed = pako.gzip(credsData);
                    let base64 = Buffer.from(compressed).toString('base64');

                    let sessionID = base64;
                    if (base64.startsWith('H4sI')) {
                        sessionID = 'XMDI' + base64.slice(4);
                    } else if (base64.startsWith('H4s')) {
                        sessionID = 'XMD' + base64.slice(3);
                    }

                    const message = `*KIUBY-XMD SESSION CONNECTED (QR)*\n\nYour Session ID is below:\n\n\`\`\`${sessionID}\`\`\`\n\n*DO NOT SHARE THIS CODE!*`;

                    await sock.sendMessage(userJid, { text: message });
                    await sock.logout();
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
    });
};

