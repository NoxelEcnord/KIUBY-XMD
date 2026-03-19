const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const AutoStatusDB = database.define('autostatus', {
  autoviewStatus: {
    type: DataTypes.STRING,
    defaultValue: 'true',
    allowNull: false,
    validate: { isIn: [['true', 'false']] }
  },
  autoLikeStatus: {
    type: DataTypes.STRING,
    defaultValue: 'true',
    allowNull: false,
    validate: { isIn: [['true', 'false']] }
  },
  autoReplyStatus: {
    type: DataTypes.STRING,
    defaultValue: 'false',
    allowNull: false,
    validate: { isIn: [['true', 'false']] }
  },
  statusReplyText: {
    type: DataTypes.TEXT,
    defaultValue: '✅ Status Viewed By KIUBY-XMD',
    allowNull: false
  },
  statusLikeEmojis: {
    type: DataTypes.TEXT,
    defaultValue: '💛,❤️,💜,🤍,💙',
    allowNull: false
  }
}, {
  timestamps: true
});

async function initAutoStatusDB() {
  try {
    // SQLite migration workaround: Drop previous failed backup tables if they exist
    // This prevents UNIQUE constraint failures during sync({ alter: true }) in SQLite
    await database.query('DROP TABLE IF EXISTS autostatuses_backup').catch(() => { });

    await AutoStatusDB.sync({ alter: true });
    console.log('AutoStatus table ready');
  } catch (error) {
    console.error('Error initializing AutoStatus table:', error);
    throw error;
  }
}

async function getAutoStatusSettings() {
  try {
    let settings = await AutoStatusDB.findOne();

    // If no record exists, create one using env vars as initial defaults
    if (!settings) {
      const envView = process.env.AUTO_STATUS_VIEW;
      const envLike = process.env.AUTO_STATUS_LIKE;
      const envReply = process.env.AUTO_STATUS_REPLY;
      const envReplyText = process.env.STATUS_REPLY_MSG;
      const envLikeEmojis = process.env.STATUS_LIKE_EMOJIS;

      settings = await AutoStatusDB.create({
        autoviewStatus: envView ? ((envView.toLowerCase() === 'on' || envView.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
        autoLikeStatus: envLike ? ((envLike.toLowerCase() === 'on' || envLike.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
        autoReplyStatus: envReply ? ((envReply.toLowerCase() === 'on' || envReply.toLowerCase() === 'true') ? 'true' : 'false') : 'false',
        statusReplyText: envReplyText || '✅ Status Viewed By KIUBY-XMD',
        statusLikeEmojis: envLikeEmojis || '💛,❤️,💜,🤍,💙'
      });
    }

    // Database values take priority (commands override env vars)
    return {
      autoviewStatus: settings.autoviewStatus || 'true',
      autoLikeStatus: settings.autoLikeStatus || 'true',
      autoReplyStatus: settings.autoReplyStatus || 'false',
      statusReplyText: settings.statusReplyText || '✅ Status Viewed By KIUBY-XMD',
      statusLikeEmojis: settings.statusLikeEmojis || '💛,❤️,💜,🤍,💙'
    };
  } catch (error) {
    console.error('Error getting auto status settings:', error);
    const envView = process.env.AUTO_STATUS_VIEW;
    const envLike = process.env.AUTO_STATUS_LIKE;
    const envReply = process.env.AUTO_STATUS_REPLY;
    const envReplyText = process.env.STATUS_REPLY_MSG;
    const envLikeEmojis = process.env.STATUS_LIKE_EMOJIS;
    return {
      autoviewStatus: envView ? ((envView.toLowerCase() === 'on' || envView.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
      autoLikeStatus: envLike ? ((envLike.toLowerCase() === 'on' || envLike.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
      autoReplyStatus: envReply ? ((envReply.toLowerCase() === 'on' || envReply.toLowerCase() === 'true') ? 'true' : 'false') : 'false',
      statusReplyText: envReplyText || '✅ Status Viewed By KIUBY-XMD',
      statusLikeEmojis: envLikeEmojis || '💛,❤️,💜,🤍,💙'
    };
  }
}

// Sync settings from Heroku env vars
async function syncAutoStatusFromEnv() {
  try {
    const envView = process.env.AUTO_STATUS_VIEW;
    const envLike = process.env.AUTO_STATUS_LIKE;
    const envReply = process.env.AUTO_STATUS_REPLY;
    const envReplyText = process.env.STATUS_REPLY_MSG;
    const envLikeEmojis = process.env.STATUS_LIKE_EMOJIS;

    const updates = {
      autoviewStatus: envView ? ((envView.toLowerCase() === 'on' || envView.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
      autoLikeStatus: envLike ? ((envLike.toLowerCase() === 'on' || envLike.toLowerCase() === 'true') ? 'true' : 'false') : 'true',
      autoReplyStatus: envReply ? ((envReply.toLowerCase() === 'on' || envReply.toLowerCase() === 'true') ? 'true' : 'false') : 'false',
      statusReplyText: envReplyText || '✅ Status Viewed By KIUBY-XMD',
      statusLikeEmojis: envLikeEmojis || '💛,❤️,💜,🤍,💙'
    };

    let settings = await AutoStatusDB.findOne();
    if (!settings) {
      settings = await AutoStatusDB.create(updates);
    } else {
      await settings.update(updates);
    }
    return updates;
  } catch (error) {
    console.error('Error syncing auto status from env:', error);
    return null;
  }
}

async function updateAutoStatusSettings(updates) {
  try {
    let settings = await AutoStatusDB.findOne();
    if (!settings) {
      settings = await AutoStatusDB.create({});
    }
    return await settings.update(updates);
  } catch (error) {
    console.error('Error updating auto status settings:', error);
    return null;
  }
}

module.exports = {
  initAutoStatusDB,
  getAutoStatusSettings,
  updateAutoStatusSettings,
  syncAutoStatusFromEnv,
  AutoStatusDB
};
