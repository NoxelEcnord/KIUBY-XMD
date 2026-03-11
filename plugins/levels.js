const { bwmxmd } = require('../core/commandHandler');
const { LevelsDB } = require('../core/database/levels');

bwmxmd({
    pattern: "rank",
    aliases: ["level", "lvl"],
    category: "levels",
    description: "Check your current rank and level"
}, async (from, client, conText) => {
    const { sender, reply } = conText;
    let user = await LevelsDB.findOne({ where: { jid: sender } });
    if (!user) {
        user = await LevelsDB.create({ jid: sender });
    }

    const xpNeeded = user.level * user.level * 100;
    const progress = (user.xp / xpNeeded) * 100;
    const progressBar = "█".repeat(Math.floor(progress / 10)) + "░".repeat(10 - Math.floor(progress / 10));

    reply(`🏆 *User Rank*\n\n👤 *User:* @${sender.split('@')[0]}\n⭐ *Level:* ${user.level}\n✨ *XP:* ${user.xp} / ${xpNeeded}\n\n[${progressBar}] ${progress.toFixed(1)}%`, { mentions: [sender] });
});

bwmxmd({
    pattern: "leaderboard",
    aliases: ["lb", "top"],
    category: "levels",
    description: "View the top users by level"
}, async (from, client, conText) => {
    const { reply } = conText;
    const topUsers = await LevelsDB.findAll({
        order: [['level', 'DESC'], ['xp', 'DESC']],
        limit: 10
    });

    if (topUsers.length === 0) return reply("🏆 No one on the leaderboard yet!");

    let text = "🏆 *GLOBAL LEADERBOARD*\n\n";
    topUsers.forEach((user, i) => {
        text += `${i + 1}. @${user.jid.split('@')[0]} - *Lvl ${user.level}* (${user.xp} XP)\n`;
    });

    reply(text, { mentions: topUsers.map(u => u.jid) });
});
