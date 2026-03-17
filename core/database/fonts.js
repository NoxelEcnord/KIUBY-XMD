const { DataTypes } = require('sequelize');
const { database } = require('../../config');

const FontDB = database.define('fonts', {
    jid: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false,
        unique: true
    },
    styleIndex: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
    }
}, {
    timestamps: false,
});

async function initFontDB() {
    try {
        await FontDB.sync();
        console.log('Font preferences table ready');
    } catch (error) {
        console.error('Error initializing FontDB:', error);
    }
}

async function getFontPreference(jid) {
    try {
        const pref = await FontDB.findOne({ where: { jid } });
        return pref ? pref.styleIndex : 0;
    } catch (error) {
        return 0;
    }
}

async function setFontPreference(jid, styleIndex) {
    try {
        await FontDB.upsert({ jid, styleIndex });
        return true;
    } catch (error) {
        return false;
    }
}

initFontDB();

module.exports = {
    getFontPreference,
    setFontPreference,
    initFontDB
};
