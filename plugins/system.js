const { kiubyxmd } = require('../core/commandHandler');
const fs = require('fs');
const path = require('path');
const now = require('performance-now');
const fsp = require('fs').promises;
const os = require('os');
const util = require('util');
const execAsync = util.promisify(require('child_process').exec);
const axios = require('axios');
const XMD = require('../core/xmd');

const NCS_API = XMD.NCS_RANDOM;

const convertToOpus = async (mp3Buffer) => {
  const tempMp3 = path.join(os.tmpdir(), `ncs_${Date.now()}.mp3`);
  const tempOgg = path.join(os.tmpdir(), `ncs_${Date.now()}.ogg`);

  try {
    await fsp.writeFile(tempMp3, mp3Buffer);
    await execAsync(`ffmpeg -i "${tempMp3}" -c:a libopus -b:a 64k -vbr on -compression_level 10 "${tempOgg}" -y`);
    const oggBuffer = await fsp.readFile(tempOgg);
    await fsp.unlink(tempMp3).catch(() => { });
    await fsp.unlink(tempOgg).catch(() => { });
    return oggBuffer;
  } catch (err) {
    console.error('Audio conversion error:', err.message);
    await fsp.unlink(tempMp3).catch(() => { });
    await fsp.unlink(tempOgg).catch(() => { });
    return null;
  }
};

const fetchCorazonSong = async () => {
  try {
    const response = await axios.get(XMD.API.DOWNLOAD.AUDIO(XMD.THEME_SONG_URL), { timeout: 30000 });
    return response.data?.result;
  } catch (error) {
    console.error("Error fetching Corazon song:", error.message);
    return null;
  }
};

//========================================================================================================================


const ABOUT_FACTS = [
  "KIUBY-XMD is built on a neural-link architecture for maximum efficiency.",
  "The bot uses a stealth protocol to bypass restrictive group settings.",
  "KIUBY-XMD was designed by ECNORD as a next-gen communication tool.",
  "The mainframe of KIUBY-XMD can process over 1000 requests per millisecond.",
  "KIUBY-XMD is more than a bot; it's a sentient system breach.",
  "Neural nodes in KIUBY-XMD are self-healing and auto-optimize data flow.",
  "The 'XMD' stands for eXtensible Multiplexed Datahub."
];

kiubyxmd({
  pattern: "about",
  aliases: ["info", "botinfo"],
  description: "Learn more about the KIUBY-XMD mainframe",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, botname } = conText;
  const fact = ABOUT_FACTS[Math.floor(Math.random() * ABOUT_FACTS.length)];
  const aboutText = `🛸 *ABOUT ${botname}*\n\n🛰️ *Protocol:* NEURAL-X\n🦾 *Architect:* ECNORD\n📊 *Status:* OPTIMAL\n\n💡 *Did you know?*\n${fact}\n\n_System integrity verified._`;

  await client.sendMessage(from, {
    text: aboutText,
    contextInfo: XMD.getContextInfo(`🛸 MAINFRAME INFO`, 'Integrity Check: Pass')
  });
});

//========================================================================================================================

kiubyxmd({
  pattern: "deljunk",
  aliases: ["deletejunk", "clearjunk", "cleanjunk"],
  description: "Delete junk files from session, tmp, logs, and more",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;
  if (!isSuperUser) return reply("✖ You need superuser privileges to execute this command.");

  await reply("🔍 Scanning for junk files...");

  const JUNK_FILE_TYPES = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff', '.svg',
    '.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv',
    '.mp3', '.wav', '.ogg', '.opus', '.m4a', '.flac',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt',
    '.zip', '.rar', '.7z', '.tar', '.gz',
    '.log', '.tmp', '.temp', '.cache'
  ];

  const DIRECTORIES_TO_CLEAN = [
    { path: "./session", filters: ["pre-key", "sender-key", "session-", "app-state"], name: "session" },
    { path: "./tmp", filters: JUNK_FILE_TYPES.map(ext => ext.slice(1)), name: "temporary" },
    { path: "./logs", filters: ['.log', '.txt'], name: "logs" },
    { path: "./message_data", filters: JUNK_FILE_TYPES.map(ext => ext.slice(1)), name: "message data" }
  ];

  const OPTIONAL_DIRS = ['temp', 'cache', 'downloads', 'upload'];
  for (const dir of OPTIONAL_DIRS) {
    const dirPath = path.resolve(`./${dir}`);
    try {
      await fsp.access(dirPath);
      DIRECTORIES_TO_CLEAN.push({
        path: dirPath,
        filters: JUNK_FILE_TYPES.map(ext => ext.slice(1)),
        name: dir
      });
    } catch { }
  }

  const cleanDirectory = async (dirPath) => {
    const files = await fsp.readdir(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = await fsp.stat(filePath);
      if (stat.isDirectory()) {
        await cleanDirectory(filePath);
        await fsp.rmdir(filePath);
      } else {
        await fsp.unlink(filePath);
      }
    }
  };

  const cleanJunkFiles = async (dirPath, filters, folderName) => {
    try {
      const exists = await fsp.access(dirPath).then(() => true).catch(() => false);
      if (!exists) return { count: 0, folder: folderName };

      const files = await fsp.readdir(dirPath);
      const junkFiles = files.filter(item => {
        const lower = item.toLowerCase();
        return filters.some(f => lower.includes(f.toLowerCase())) ||
          JUNK_FILE_TYPES.some(ext => lower.endsWith(ext));
      });

      if (junkFiles.length === 0) return { count: 0, folder: folderName };

      await reply(`🗑️ Clearing ${junkFiles.length} junk files from ${folderName}...`);

      let deleted = 0;
      for (const file of junkFiles) {
        try {
          const filePath = path.join(dirPath, file);
          const stat = await fsp.stat(filePath);
          if (stat.isDirectory()) {
            await cleanDirectory(filePath);
          } else {
            await fsp.unlink(filePath);
          }
          deleted++;
        } catch (err) {
          console.error(`Error deleting ${file}:`, err);
        }
      }

      return { count: deleted, folder: folderName };
    } catch (err) {
      console.error(`Error scanning ${folderName}:`, err);
      await reply(`⚠ Error cleaning ${folderName}: ${err.message}`);
      return { count: 0, folder: folderName, error: true };
    }
  };

  let totalDeleted = 0;
  const results = [];

  for (const dir of DIRECTORIES_TO_CLEAN) {
    const result = await cleanJunkFiles(dir.path, dir.filters, dir.name);
    results.push(result);
    totalDeleted += result.count;
  }

  if (totalDeleted === 0) {
    await reply("✅ No junk files found to delete!");
  } else {
    let summary = "🗑️ *Junk Cleanup Summary:*\n";
    results.forEach(res => {
      summary += `• ${res.folder}: ${res.count} files${res.error ? ' (with errors)' : ''}\n`;
    });
    summary += `\n✅ *Total deleted:* ${totalDeleted} junk files`;
    await reply(summary);
  }

  if (os.platform() === 'win32') {
    try {
      await execAsync('del /q /f /s %temp%\\*.*');
      await reply("♻ Also cleared system temporary files!");
    } catch (err) {
      console.error('System temp cleanup error:', err);
    }
  }
});
//========================================================================================================================


kiubyxmd({
  pattern: "ping",
  aliases: ["speed", "latency"],
  description: "Check bot response time",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { react, ms, reply, sender } = conText;

  // Calculate realistic latency (Total turnaround time)
  // Baileys provides messageTimestamp in seconds
  const timestamp = ms.messageTimestamp?.low || ms.messageTimestamp || Date.now() / 1000;
  const speed = (Date.now() - (timestamp * 1000)).toFixed(0);

  // Instant reaction for feedback
  react("⚡");


  const hackerPhrase = XMD.getRandomHackerPhrase();
  const pingText = `⚡ *SYSTEM LATENCY REPORT*\n\n🛰️ *Protocol:* ${hackerPhrase}\n📡 *Uplink:* ${speed}ms\n🦾 *Entity:* NEURAL-X\n\nRegards, *KIUBY-XMD*`;

  // Use getContextInfo for consistent branding
  const context = XMD.getContextInfo('⚡ KIUBY SYSTEM SPEED', `Latency: ${speed}ms | Node: Active`);

  const sentMsg = await reply(pingText, { deleteAfter: 5000 });
});


//========================================================================================================================
//const { kiubyxmd } = require('../core/commandHandler');

kiubyxmd({
  pattern: "resetdb",
  aliases: ["cleardb", "refreshdb"],
  description: "Delete the database file at ./database.db",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) return reply("✖ You need superuser privileges to execute this command.");

  const dbPath = path.resolve("./database.db");

  try {
    if (!fs.existsSync(dbPath)) return reply("✅ No database file found to delete.");

    fs.unlinkSync(dbPath);
    reply("🗑️ Database file deleted successfully.");
  } catch (err) {
    console.error("cleardb error:", err);
    reply("❌ Failed to delete database file. Check logs for details.");
  }
});
//========================================================================================================================


kiubyxmd({
  pattern: "restart",
  aliases: ["reboot", "startbot"],
  description: "Bot restart (kills all node processes first)",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) {
    return reply("❌ You need superuser privileges to execute this command.");
  }

  try {
    await reply("*🚀 Rebooting KIUBY-XMD System...*\n_Killing all node processes and restarting..._");
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      // Kill all other node processes before restart
      const { execSync } = require('child_process');
      try {
        execSync('bash kill.sh 2>/dev/null || pkill -f node 2>/dev/null', { cwd: __dirname + '/..', timeout: 5000 });
      } catch (e) { /* expected — we're killing ourselves too */ }

      if (global.fullReboot) {
        global.fullReboot("Manual Reboot from Command");
      } else {
        process.exit(0);
      }
    } catch (e) {
      console.log("Fallback exit...");
      process.exit(1);
    }
  } catch (err) {
    console.error("Restart error:", err);
    reply("❌ Failed to initiate reboot.");
  }
});
//========================================================================================================================
//const { kiubyxmd } = require('../core/commandHandler');

const formatUptime = (seconds) => {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  const dDisplay = d > 0 ? `${d} ${d === 1 ? "day" : "days"}, ` : "";
  const hDisplay = h > 0 ? `${h} ${h === 1 ? "hour" : "hours"}, ` : "";
  const mDisplay = m > 0 ? `${m} ${m === 1 ? "minute" : "minutes"}, ` : "";
  const sDisplay = s > 0 ? `${s} ${s === 1 ? "second" : "seconds"}` : "";

  return `${dDisplay}${hDisplay}${mDisplay}${sDisplay}`.trim().replace(/,\s*$/, "");
};

kiubyxmd(
  {
    pattern: "uptime",
    aliases: ["up", "runtime"],
    category: "System",
    description: "Show bot runtime",
  },
  async (from, client, conText) => {
    const { reply, botname, pushName, author, sender } = conText;

    try {
      const contactMessage = {
        key: {
          fromMe: false,
          participant: "0@s.whatsapp.net",
          remoteJid: "status@broadcast",
        },
        message: {
          contactMessage: {
            displayName: author,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${author};;;;\nFN:${author}\nitem1.TEL;waid=${sender?.split('@')[0] ?? 'unknown'}:${sender?.split('@')[0] ?? 'unknown'}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
          },
        },
      };

      const uptimeText = `${botname} uptime is: *${formatUptime(process.uptime())}*`;

      await client.sendMessage(from, { text: uptimeText }, { quoted: contactMessage });
    } catch (error) {
      console.error("Error sending uptime message:", error);
    }
  }
);
//========================================================================================================================




const formatSize = (bytes) => {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
};

kiubyxmd({
  pattern: "test",
  aliases: ["botstatus", "alive"],
  description: "Display bot system information with NCS music",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, react, botname, author, sender } = conText;

  try {
    await react("💫");
    const start = now();

    const uptime = process.uptime();
    const formattedUptime = formatUptime(uptime);

    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;

    const memory = process.memoryUsage();
    const heapUsed = formatSize(memory.heapUsed);
    const heapTotal = formatSize(memory.heapTotal);

    let disk = { size: "N/A", free: "N/A" };
    try {
      const { stdout } = await execAsync('df -h --total | grep total');
      const parts = stdout.trim().split(/\s+/);
      disk.size = parts[1];
      disk.free = parts[3];
    } catch (err) { }

    const ping = `${(now() - start).toFixed(2)} ms`;

    const contactMessage = {
      key: { fromMe: false, participant: "0@s.whatsapp.net", remoteJid: "status@broadcast" },
      message: {
        contactMessage: {
          displayName: author,
          vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;${author};;;;\nFN:${author}\nitem1.TEL;waid=${sender?.split('@')[0] ?? 'unknown'}:${sender?.split('@')[0] ?? 'unknown'}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`,
        },
      },
    };

    const status = `
*╭──────────────┈❖*
*│  『 💫 ɪᴄᴇ sᴛᴀᴛᴜs 』*
*╰──────────────┈❖*
*❯ ɪɴᴛᴇʟʟɪɢᴇɴᴛ sʏɴᴛʜᴇᴛɪᴄ ᴄᴏᴍᴘᴜᴛɪɴɢ ᴇɴᴛɪᴛʏ*

*🤖 ʙᴏᴛ:* ${botname}
*⚡ ᴘɪɴɢ:* ${ping}
*⏰ ᴜᴘᴛɪᴍᴇ:* ${formattedUptime}

*╭─『 📊 sʏsᴛᴇᴍ ɪɴғᴏ 』*
*│*
*├💾 ʀᴀᴍ:* ${formatSize(usedRam)} / ${formatSize(totalRam)}
*├🆓 ғʀᴇᴇ:* ${formatSize(freeRam)}
*├📦 ʜᴇᴀᴘ:* ${heapUsed} / ${heapTotal}
*├💿 ᴅɪsᴋ:* ${disk.size} / ${disk.free}
*│*
*╰──────────────┈❖*

*╭─『 🖥️ ᴇɴᴠɪʀᴏɴᴍᴇɴᴛ 』*
*│*
*├🐧 ᴏs:* ${os.platform()} ${os.arch()}
*├📗 ɴᴏᴅᴇ:* ${process.version}
*├🔧 ᴄᴘᴜ:* ${os.cpus()[0]?.model?.substring(0, 25) || 'Unknown'}
*│*
*╰──────────────┈❖*

*❯ ɪsᴄᴇ-ʙᴏᴛ ɪs ᴀʟɪᴠᴇ ᴀɴᴅ ʀᴜɴɴɪɴɢ!* 🔥`.trim();

    await client.sendMessage(from, { text: status }, { quoted: contactMessage });

    try {
      const ncsData = await fetchRandomNCS();
      console.log('[TEST] NCS Data:', ncsData ? 'Received' : 'NULL', 'Buffer:', ncsData?.audioBuffer ? 'Yes' : 'No');
      if (ncsData && ncsData.audioBuffer) {
        await client.sendMessage(from, {
          audio: ncsData.audioBuffer,
          mimetype: 'audio/ogg; codecs=opus',
          ptt: true
        });
        console.log('[TEST] Audio sent successfully');
      } else {
        console.log('[TEST] No audio buffer available');
      }
    } catch (audioErr) {
      console.error('[TEST] Audio error:', audioErr.message);
    }

    await react("✅");

  } catch (err) {
    console.error("Test/Alive error:", err);
    reply("❌ Failed to get system status. Please try again.");
  }
});


