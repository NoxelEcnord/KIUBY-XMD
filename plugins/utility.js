const { kiubyxmd } = require('../core/commandHandler');

// Utility: Get JID of current chat
kiubyxmd({
    pattern: "jid",
    aliases: ["getjid", "groupjid"],
    description: "Get the JID (unique identifier) of the current chat",
    category: "Utility",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, isGroup } = conText;

    const chatType = isGroup ? "Group" : "Private Chat";
    const jidInfo = `📋 *Chat Information*\n\n` +
        `*Type:* ${chatType}\n` +
        `*JID:* \`${from}\`\n\n` +
        `_Copy the JID above for bot configuration_`;

    await reply(jidInfo);
});

