const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const LocksDB = database.define('locks', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    antiviewonce: { type: DataTypes.BOOLEAN, defaultValue: false },
    antilink: { type: DataTypes.BOOLEAN, defaultValue: false },
    antidelete: { type: DataTypes.BOOLEAN, defaultValue: false },
    antibadword: { type: DataTypes.BOOLEAN, defaultValue: false },
    antiimage: { type: DataTypes.BOOLEAN, defaultValue: false },
    antivideo: { type: DataTypes.BOOLEAN, defaultValue: false },
    antiaudio: { type: DataTypes.BOOLEAN, defaultValue: false },
    antisticker: { type: DataTypes.BOOLEAN, defaultValue: false },
    antipdf: { type: DataTypes.BOOLEAN, defaultValue: false },
    antizip: { type: DataTypes.BOOLEAN, defaultValue: false },
    warnlimit: { type: DataTypes.INTEGER, defaultValue: 3 }
});

async function initLocksDB() {
    try {
        await LocksDB.sync({ alter: true });
        console.log('Locks table ready');
    } catch (error) {
        console.error('Error initializing Locks table:', error);
    }
}

module.exports = { LocksDB, initLocksDB };
