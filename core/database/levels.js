const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const LevelsDB = database.define('levels', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    xp: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    level: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
        allowNull: false
    },
    lastXpGain: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        allowNull: false
    }
}, {
    timestamps: true
});

async function initLevelsDB() {
    try {
        await database.query('DROP TABLE IF EXISTS levels_backup').catch(() => { });
        await LevelsDB.sync({ alter: true });
        console.log('Levels table ready');
    } catch (error) {
        console.error('Error initializing Levels table:', error);
    }
}

module.exports = { LevelsDB, initLevelsDB };
