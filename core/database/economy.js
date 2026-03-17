const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const EconomyDB = database.define('economy', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    balance: {
        type: DataTypes.BIGINT,
        defaultValue: 1000,
        allowNull: false
    },
    lastDaily: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true
    },
    lastWork: {
        type: DataTypes.DATE,
        defaultValue: null,
        allowNull: true
    }
}, {
    timestamps: true
});

async function initEconomyDB() {
    try {
        await EconomyDB.sync({ alter: true });
        console.log('Economy table ready');
    } catch (error) {
        console.error('Error initializing Economy table:', error);
    }
}

module.exports = { EconomyDB, initEconomyDB };
