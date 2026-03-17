const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');

kiubyxmd({
    pattern: "forcesend",
    aliases: ["fsend", "sendto"],
    description: "Force send text to a specific JID (Group/User)",
    category: "Owner",
    filename: __filename,
    usePrefix: true
}, async (from, client, conText) => {
    const { q, reply, isSuperUser } = conText;

    if (!isSuperUser) return reply("❌ Owner-only command");
    if (!q) return reply("📌 Usage: `.forcesend <jid> <text>`\nExample: `.forcesend 120363045612345678@g.us Hello World`");

    const [jid, ...textArray] = q.split(" ");
    const text = textArray.join(" ");

    if (!jid || !jid.includes("@") || !text) {
        return reply("❌ Invalid JID or empty message content.");
    }

    try {
        await client.sendMessage(jid, {
            text: text,
            contextInfo: XMD.getContextInfo('📡 FORCE_SEND_UPLINK', 'Neural Bypass: Active')
        });
        await reply(`✅ Message successfully force-sent to: \`${jid}\``);
    } catch (err) {
        console.error("Force Send Error:", err);
        await reply(`❌ Failed to force-send message. Error: ${err.message}`);
    }
});
