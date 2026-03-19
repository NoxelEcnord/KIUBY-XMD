const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');

kiubyxmd({
    pattern: "forcesend",
    aliases: ["fsend", "sendto", "bypass"],
    description: "ADMIN BYPASS: Send message to restricted groups using protocol vulnerabilities.",
    category: "Owner",
    filename: __filename,
    usePrefix: true
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;

    if (!isSuperUser) return reply("❌ *ACCESS DENIED*: Requires KIUBY-XMD SuperUser clearance.");
    if (!q) return reply("📌 *Usage*: `.forcesend <jid> <text>`\nExample: `.forcesend 120363045612345678@g.us Hello World`\n\n_Bypasses 'Only Admins Can Send Messages' restriction._");

    const parts = q.trim().split(/\s+/);
    const jid = parts[0];
    const text = parts.slice(1).join(" ");

    if (!jid || !jid.includes("@") || !text) {
        return reply("❌ *INVALID PARAMETERS*: Ensure JID and Message content are provided.");
    }

    try {
        await reply(`📡 *KIUBY-XMD INFILTRATION*: Attempting bypass on node ${jid.split('@')[0].slice(-4)}...`);

        // Stage 1: Protocol Relay Bypass (ViewOnce + 3EB0 Prefix)
        // Many WhatsApp versions skip permission checks for ViewOnce stanzas or 3EB0 IDs.
        const messageId = "3EB0" + Math.random().toString(36).substring(2, 10).toUpperCase();

        const relayMsg = {
            viewOnceMessage: {
                message: {
                    extendedTextMessage: {
                        text: text,
                        contextInfo: {
                            externalAdReply: {
                                title: "🔗 𝐍𝐞𝐮𝐫𝐚𝐥 𝐁𝐲𝐩𝐚𝐬𝐬: 𝐀𝐜𝐭𝐢𝐯𝐞",
                                body: "𝐏𝐫𝐨𝐭𝐨𝐜𝐨𝐥: 𝐒𝐭𝐞𝐚𝐥𝐭𝐡 𝐔𝐩𝐥𝐢𝐧𝐤",
                                mediaType: 1,
                                thumbnailUrl: XMD.BOT_LOGO,
                                sourceUrl: XMD.CHANNEL_URL,
                                renderLargerThumbnail: false,
                                showAdAttribution: true
                            }
                        }
                    }
                }
            }
        };

        try {
            await client.relayMessage(jid, relayMsg, { messageId: messageId });
            console.log(`[ForceSend] Stage 1 (Relay) sent to ${jid}`);
        } catch (relayErr) {
            console.warn("[ForceSend] Stage 1 failed, attempting Stage 2 (Poll Fallback)...");

            // Stage 2: Poll Exploit Fallback
            // Poll stanzas often have different server-side validation rules.
            await client.sendMessage(jid, {
                poll: {
                    name: `📡 *FORCE_SEND_UPLINK*\n\n${text}`,
                    values: ['ACKNOWLEDGED'],
                    selectableCount: 1
                }
            });
            console.log(`[ForceSend] Stage 2 (Poll) sent to ${jid}`);
        }

        await reply(`✅ *NEURAL LINK ESTABLISHED*: Message injected into ${jid}`);

    } catch (err) {
        console.error("Critical Force Send Failure:", err);
        await reply(`❌ *TERMINAL ERROR*: Infiltration failed code: ${err.message}`);
    }
});
