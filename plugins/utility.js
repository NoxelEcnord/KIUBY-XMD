const { kiubyxmd } = require('../core/commandHandler');

// Utility: Fetch all group JIDs
kiubyxmd({
    pattern: "fetchjid",
    aliases: ["getjids", "listjids", "groupsjids"],
    description: "Fetch all participating groups and their JIDs",
    category: "Utility",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react } = conText;

    try {
        const groups = await client.groupFetchAllParticipating();
        const groupList = Object.values(groups);

        if (groupList.length === 0) {
            return await reply("❌ The bot is not in any groups.");
        }

        let response = "📋 *Participating Groups & JIDs*\n\n";
        groupList.forEach((group, i) => {
            response += `${i + 1}. *Name:* ${group.subject}\n   *JID:* \`${group.id}\`\n\n`;
        });

        await reply(response);
        await react("📋");
    } catch (err) {
        console.error("fetchjid error:", err);
        await reply("❌ Failed to fetch group JIDs.");
    }
});

