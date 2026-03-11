const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const WarningsDB = database.define('warnings', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    groupJid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    count: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    },
    reasons: {
        type: DataTypes.TEXT,
        defaultValue: '',
        allowNull: false
    }
}, {
    timestamps: true
});

async function initWarningsDB() {
    try {
        await WarningsDB.sync({ alter: true });
        console.log('Warnings table ready');
    } catch (error) {
        console.error('Error initializing Warnings table:', error);
    }
}

module.exports = { WarningsDB, initWarningsDB };
