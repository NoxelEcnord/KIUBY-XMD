const { bwmxmd } = require('../core/commandHandler');
const { EconomyDB } = require('../core/database/economy');
const moment = require('moment-timezone');

bwmxmd({
    pattern: "balance",
    aliases: ["bal", "money", "wallet"],
    category: "economy",
    description: "Check your current balance"
}, async (from, client, conText) => {
    const { sender, reply } = conText;
    let user = await EconomyDB.findOne({ where: { jid: sender } });
    if (!user) {
        user = await EconomyDB.create({ jid: sender });
    }
    reply(`💰 *Wallet Balance*\n\n👤 *User:* @${sender.split('@')[0]}\n💵 *Balance:* $${user.balance.toLocaleString()}`, { mentions: [sender] });
});

bwmxmd({
    pattern: "daily",
    category: "economy",
    description: "Claim your daily reward"
}, async (from, client, conText) => {
    const { sender, reply } = conText;
    const now = new Date();
    let user = await EconomyDB.findOne({ where: { jid: sender } });
    if (!user) {
        user = await EconomyDB.create({ jid: sender });
    }

    if (user.lastDaily && (now - user.lastDaily) < 86400000) {
        const remaining = 86400000 - (now - user.lastDaily);
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        return reply(`⏳ You've already claimed your daily reward. Come back in *${hours}h ${minutes}m*.`);
    }

    const reward = Math.floor(Math.random() * 500) + 500;
    await user.update({
        balance: parseInt(user.balance) + reward,
        lastDaily: now
    });

    reply(`🎁 *Daily Reward*\n\n✅ You've claimed $${reward}!\n💰 *Total Balance:* $${(parseInt(user.balance)).toLocaleString()}`);
});

bwmxmd({
    pattern: "gamble",
    category: "economy",
    description: "Gamble your money (Double or Nothing)"
}, async (from, client, conText) => {
    const { sender, reply, q } = conText;
    if (!q || isNaN(q) || parseInt(q) <= 0) return reply("🎲 Provide a valid amount to gamble. Example: .gamble 100");

    const bet = parseInt(q);
    let user = await EconomyDB.findOne({ where: { jid: sender } });
    if (!user || user.balance < bet) return reply("❌ You don't have enough money to place this bet.");

    const win = Math.random() > 0.55; // 45% win chance
    if (win) {
        await user.update({ balance: parseInt(user.balance) + bet });
        reply(`📈 *GAMBLE WIN*\n\n🎊 Congratulations! You won $${bet.toLocaleString()}!\n💰 *New Balance:* $${(parseInt(user.balance)).toLocaleString()}`);
    } else {
        await user.update({ balance: parseInt(user.balance) - bet });
        reply(`📉 *GAMBLE LOSS*\n\n💀 Ouch! You lost $${bet.toLocaleString()}.\n💰 *New Balance:* $${(parseInt(user.balance)).toLocaleString()}`);
    }
});
