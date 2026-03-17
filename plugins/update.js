
const { kiubyxmd } = require('../core/commandHandler');
const XMD = require('../core/xmd');
const { database } = require('../config');
const { DataTypes } = require('sequelize');
const AdmZip = require('adm-zip');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');

// DB Model
const UpdateDB = database.define('bot_updates', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  current_hash: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'initial' },
  last_checked: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  status: { type: DataTypes.ENUM('pending', 'updated', 'failed'), allowNull: false, defaultValue: 'updated' }
}, {
  timestamps: false,
  freezeTableName: true
});

// DB Ops
async function initializeUpdateDB() {
  await UpdateDB.sync();
  await UpdateDB.findOrCreate({
    where: { id: 1 },
    defaults: {
      current_hash: 'initial',
      last_checked: new Date(),
      status: 'updated'
    }
  });
}

async function getCurrentHash() {
  const record = await UpdateDB.findByPk(1);
  return record?.current_hash || 'initial';
}

async function setCurrentHash(hash) {
  return await UpdateDB.update({
    current_hash: hash,
    last_checked: new Date(),
    status: 'updated'
  }, { where: { id: 1 } });
}

// File Sync
async function syncFiles(source, target) {
  const preserve = ['app.json', 'settings.js', 'set.env'];
  const items = await fs.readdir(source);

  for (const item of items) {
    if (preserve.includes(item)) continue;
    const srcPath = path.join(source, item);
    const destPath = path.join(target, item);
    const stat = await fs.lstat(srcPath);

    if (stat.isDirectory()) {
      await fs.ensureDir(destPath);
      await syncFiles(srcPath, destPath);
    } else {
      await fs.copy(srcPath, destPath);
    }
  }
}

// Update Command
kiubyxmd({
  pattern: "update",
  aliases: ["upgrade", "sync"],
  description: "Update KIUBY-XMD from remote repository",
  category: "System",
  filename: __filename,
  reaction: "🔄"
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("❌ Owner-only command");

  try {
    await reply("🔍 *KIUBY-XMD*: Initializing Update Protocol...");

    // Check if repo is defined in XMD or use default
    const repo = XMD.GITHUB_REPO_URL?.split('github.com/')[1] || "ecnord/KIUBY-XMD";
    const apiUrl = `https://api.github.com/repos/${repo}/commits/main`;

    const { data: commit } = await axios.get(apiUrl, { timeout: 10000 }).catch(err => {
      throw new Error(`GitHub API Connection Failed: ${err.message}`);
    });

    if (!commit || !commit.sha) throw new Error("Invalid response from GitHub API");

    const currentHash = await getCurrentHash();
    if (commit.sha === currentHash) {
      return reply("✅ *KIUBY-XMD*: System is already running the latest neural patch.");
    }

    await reply("⬇️ *KIUBY-XMD*: Siphoning update data from main node...");
    const zipUrl = `https://github.com/${repo}/archive/${commit.sha}.zip`;
    const zipPath = path.join(__dirname, '..', 'tmp', `update_${commit.sha.slice(0, 7)}.zip`);

    await fs.ensureDir(path.join(__dirname, '..', 'tmp'));
    const writer = fs.createWriteStream(zipPath);

    const response = await axios({
      url: zipUrl,
      method: 'GET',
      responseType: 'stream',
      timeout: 60000
    });

    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    await reply("📦 *KIUBY-XMD*: Extracting data shards...");
    const extractPath = path.join(__dirname, '..', 'tmp', `extract_${commit.sha.slice(0, 7)}`);
    await fs.ensureDir(extractPath);

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(extractPath, true);

    const extractedFolder = fs.readdirSync(extractPath)
      .find(name => name.toLowerCase().includes('kiuby-xmd'));

    if (!extractedFolder) throw new Error("Update package structure unrecognized.");

    const updateSrc = path.join(extractPath, extractedFolder);

    await reply("🔄 *KIUBY-XMD*: Applying neural patches to core...");
    await syncFiles(updateSrc, path.join(__dirname, '..'));
    await setCurrentHash(commit.sha);

    await reply("✅ *KIUBY-XMD*: Update sequence complete. Rebooting mainframe...");

    // Cleanup
    await fs.remove(zipPath).catch(() => { });
    await fs.remove(extractPath).catch(() => { });

    setTimeout(() => {
      if (global.fullReboot) {
        global.fullReboot("System Update Applied");
      } else {
        process.exit(0);
      }
    }, 2000);

  } catch (err) {
    console.error("❗ Update failed:", err);
    await reply(`❌ *KIUBY-XMD*: Update sequence aborted.\n⚠️ *Detail*: ${err.message}`);
  }
});

// Init DB
initializeUpdateDB().catch(console.error);
