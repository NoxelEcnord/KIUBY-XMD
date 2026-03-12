const { bwmxmd } = require('../core/commandHandler');
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


bwmxmd({
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


bwmxmd({
  pattern: "ping",
  aliases: ["speed", "latency"],
  description: "Check bot response time",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { react, ms, reply, sender } = conText;
  const start = performance.now();

  // Instant reaction for feedback
  react("⚡");

  const end = performance.now();
  const speed = (end - start).toFixed(2);

  const hackerPhrase = XMD.getRandomHackerPhrase();
  const pingText = `🛸 *${hackerPhrase}*\n\n⚡ *Latency:* ${speed}ms\n📡 *Status:* Optimal\n\nRegards, *KIUBY-XMD*`;

  // Send primary text response IMMEDIATELY
  const sentMsg = await client.sendMessage(from, {
    text: pingText,
    contextInfo: XMD.getContextInfo(`⚡ 𝐒𝐏𝐄𝐄𝐃: ${speed}𝐦𝐬`, `𝐏𝐢𝐧𝐠𝐢𝐧𝐠 𝐌𝐚𝐢𝐧frame...`)
  }, { quoted: ms });

  // Secondary audio fetching (non-blocking for the user experience)
  try {
    fetchCorazonSong().then(async (audioUrl) => {
      if (audioUrl) {
        await client.sendMessage(from, {
          audio: { url: audioUrl },
          mimetype: 'audio/mpeg',
          ptt: true,
          contextInfo: {
            ...XMD.getContextInfo().externalAdReply,
            title: `🔊 Playing: Corazon`,
            body: `🛸 Bypass Latency: ${speed}ms`
          }
        }, { quoted: sentMsg });
      }
    }).catch(e => console.error("Async audio fetch failed:", e.message));
  } catch (e) {
    console.error("Ping logic error:", e);
  }
});


//========================================================================================================================
//const { bwmxmd } = require('../core/commandHandler');

bwmxmd({
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


bwmxmd({
  pattern: "restart",
  aliases: ["reboot", "startbot"],
  description: "Bot restart",
  category: "System",
  filename: __filename
}, async (from, client, conText) => {
  const { reply, isSuperUser } = conText;

  if (!isSuperUser) {
    return reply("❌ You need superuser privileges to execute this command.");
  }

  try {
    await reply("*🚀 Rebooting ISCE-BOT System...*");
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
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
//const { bwmxmd } = require('../core/commandHandler');

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

bwmxmd(
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

bwmxmd({
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


