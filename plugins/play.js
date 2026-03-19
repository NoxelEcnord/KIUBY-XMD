const axios = require('axios');
const { kiubyxmd } = require('../core/commandHandler');
const s = require(__dirname + "/../config");
const XMD = require('../core/xmd');

const BOT_NAME = s.BOT || 'KIUBY-XMD';

const extractVideoId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
};

kiubyxmd({
  pattern: "play",
  aliases: ["song", "music", "yta"],
  category: "Downloader",
  description: "Search and download audio/video from YouTube"
},
  async (from, client, conText) => {
    const { q, mek, reply } = conText;

    if (!q) return reply("Please provide a search query or YouTube URL");

    try {
      let videoUrl;
      let videoTitle;
      let videoThumbnail;
      let videoDuration;
      let videoViews;
      let videoChannel;
      let videoId;

      if (q.match(/(youtube\.com|youtu\.be)/i)) {
        videoUrl = q;
        videoId = extractVideoId(q);
        if (!videoId) return reply("Invalid YouTube URL");
        videoTitle = "YouTube Media";
        videoThumbnail = XMD.EXTERNAL.YOUTUBE_THUMB(videoId);
        videoDuration = "Unknown";
        videoViews = "Unknown";
        videoChannel = "Unknown";

        return await showDownloadOptions(from, client, { title: videoTitle, url: videoUrl, thumbnail: videoThumbnail, duration: videoDuration, views: videoViews, channel: videoChannel }, mek);
      } else {
        let videos;
        try {
          const searchResponse = await axios.get(XMD.SEARCH_EXT.YTS_QUERY(q), { timeout: 15000 });
          videos = searchResponse.data?.result || searchResponse.data;
          if (!Array.isArray(videos) && searchResponse.data?.videos) videos = searchResponse.data.videos;
        } catch (searchErr) {
          console.log("Primary YT search failed, trying backup...");
          const backupResponse = await axios.get(`https://api.bk9.dev/search/yts?q=${encodeURIComponent(q)}`, { timeout: 15000 });
          videos = backupResponse.data?.result || backupResponse.data;
        }

        if (!Array.isArray(videos) || videos.length === 0) return reply("No results found. Try a different query.");

        // Show top 5 results
        const top5 = videos.slice(0, 5);
        let pickerMsg = `🔍 *YouTube Results for:* ${q}\n\n`;
        top5.forEach((v, i) => {
          pickerMsg += `*${i + 1}.* ${v.name || v.title}\n⏱️ ${v.duration || v.timestamp} | 👀 ${v.views}\n\n`;
        });
        pickerMsg += `_Reply with a number (1-5) to select_`;

        const sentPicker = await client.sendMessage(from, {
          image: { url: top5[0].thumbnail || top5[0].image },
          caption: pickerMsg,
          contextInfo: {
            externalAdReply: {
              title: "YT SEARCH PICKER",
              body: `Select a number to download`,
              mediaType: 1,
              thumbnailUrl: top5[0].thumbnail || top5[0].image,
              renderLargerThumbnail: false
            }
          }
        }, { quoted: mek });

        const handlePicker = async (update) => {
          try {
            const message = update.messages[0];
            if (!message?.message) return;

            const quotedId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
            if (quotedId !== sentPicker.key.id) return;

            const responseText = (message.message.extendedTextMessage?.text || message.message.conversation)?.trim();
            const choice = parseInt(responseText);
            if (isNaN(choice) || choice < 1 || choice > top5.length) return;

            const selected = top5[choice - 1];
            const mediaInfo = {
              title: selected.name || selected.title,
              url: selected.url || `https://www.youtube.com/watch?v=${selected.id}`,
              thumbnail: selected.thumbnail || selected.image,
              duration: selected.duration || selected.timestamp,
              views: selected.views,
              channel: selected.author?.name || selected.channel
            };

            client.ev.off("messages.upsert", handlePicker);
            await showDownloadOptions(from, client, mediaInfo, message);
          } catch (e) { console.error("Picker error:", e); }
        };

        client.ev.on("messages.upsert", handlePicker);
        setTimeout(() => client.ev.off("messages.upsert", handlePicker), 300000);
      }
    } catch (error) {
      console.error("Play error:", error);
      reply("❌ Failed to search YouTube.");
    }
  });

async function showDownloadOptions(from, client, info, quoted) {
  const infoMessage = `╔═════════════════════════════╗
║   🎵  KIUBY PLAY SERVICE      ║
╠═════════════════════════════╣
║ 📛 Title: ${info.title}
║ ⏱️ Duration: ${info.duration}
║ 👤 Channel: ${info.channel}
║ 👁️ Views: ${info.views}
║ 🔗 ${info.url}
╚═════════════════════════════╝

> ⬇️ *Downloading audio to your device...*
_Reply *1-4* for selection or *0* to cancel_`;

  const sentSelect = await client.sendMessage(from, {
    image: { url: info.thumbnail },
    caption: infoMessage,
    contextInfo: {
      externalAdReply: {
        title: "KIUBY MUSIC HUB",
        body: "🚀 Tap to view channel",
        mediaType: 2,
        thumbnailUrl: info.thumbnail,
        sourceUrl: info.authorUrl || info.url
      }
    }
  }, { quoted });

  const handleDownload = async (update) => {
    try {
      const message = update.messages[0];
      if (!message?.message) return;

      const quotedId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
      if (quotedId !== sentSelect.key.id) return;

      const responseText = (message.message.extendedTextMessage?.text || message.message.conversation)?.trim();
      const choice = parseInt(responseText);
      if (choice === 0) {
        client.ev.off("messages.upsert", handleDownload);
        return client.sendMessage(from, { text: "❌ Cancelled" }, { quoted: message });
      }
      if (isNaN(choice) || choice < 1 || choice > 4) return;

      await client.sendMessage(from, { react: { text: "⏳", key: message.key } });
      const fileName = `${info.title}`.replace(/[^\w\s.-]/gi, '');
      const XMD = require('../core/xmd');
      const axios = require('axios');

      let dlUrl;
      const getUrl = async (api) => (await axios.get(api)).data?.result;

      if (choice === 1) dlUrl = await getUrl(XMD.API.DOWNLOAD.YOUTUBE_AUDIO(info.url));
      if (choice === 2) dlUrl = await getUrl(XMD.API.DOWNLOAD.YOUTUBE(info.url));
      if (choice === 3) dlUrl = await getUrl(XMD.API.DOWNLOAD.AUDIO(info.url));
      if (choice === 4) dlUrl = await getUrl(XMD.API.DOWNLOAD.VIDEO(info.url));

      if (!dlUrl) throw new Error("API Offline");

      if (choice === 1) await client.sendMessage(from, { audio: { url: dlUrl }, mimetype: "audio/mpeg", fileName: `${fileName}.mp3` }, { quoted: message });
      if (choice === 2) await client.sendMessage(from, { video: { url: dlUrl }, mimetype: "video/mp4", fileName: `${fileName}.mp4` }, { quoted: message });
      if (choice === 3) await client.sendMessage(from, { document: { url: dlUrl }, mimetype: "audio/mpeg", fileName: `${fileName}.mp3` }, { quoted: message });
      if (choice === 4) await client.sendMessage(from, { document: { url: dlUrl }, mimetype: "video/mp4", fileName: `${fileName}.mp4` }, { quoted: message });

      await client.sendMessage(from, { react: { text: "✅", key: message.key } });
      client.ev.off("messages.upsert", handleDownload);
    } catch (e) {
      console.error("Download handling error:", e);
      client.ev.off("messages.upsert", handleDownload);
    }
  };

  client.ev.on("messages.upsert", handleDownload);
  setTimeout(() => client.ev.off("messages.upsert", handleDownload), 600000);
}


kiubyxmd({
  pattern: "video",
  aliases: ["ytmp4", "ytv", "vid"],
  category: "Downloader",
  description: "Search and download video from YouTube"
},
  async (from, client, conText) => {
    const { q, mek, reply } = conText;

    if (!q) return reply("Please provide a search query or YouTube URL");

    try {
      let videoUrl;
      let videoTitle;
      let videoThumbnail;
      let videoDuration;
      let videoViews;
      let videoChannel;
      let videoId;

      if (q.match(/(youtube\.com|youtu\.be)/i)) {
        videoUrl = q;
        videoId = extractVideoId(q);
        if (!videoId) return reply("Invalid YouTube URL");
        videoTitle = "YouTube Media";
        videoThumbnail = XMD.EXTERNAL.YOUTUBE_THUMB(videoId);
        videoDuration = "Unknown";
        videoViews = "Unknown";
        videoChannel = "Unknown";
      } else {
        let videos;
        try {
          const searchResponse = await axios.get(XMD.SEARCH_EXT.YTS_QUERY(q), { timeout: 15000 });
          videos = Array.isArray(searchResponse.data) ? searchResponse.data : searchResponse.data?.result;
        } catch (searchErr) {
          console.log("Primary YT search failed, trying backup...");
          const backupResponse = await axios.get(XMD.SEARCH_EXT.YTS_BACKUP(q), { timeout: 15000 });
          videos = backupResponse.data?.result;
        }

        if (!Array.isArray(videos) || videos.length === 0) return reply("No results found");

        const firstVideo = videos[0];
        videoUrl = firstVideo.url;
        videoId = firstVideo.id || extractVideoId(firstVideo.url);
        videoTitle = firstVideo.name || firstVideo.title;
        videoThumbnail = firstVideo.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
        videoDuration = firstVideo.duration || "Unknown";
        videoViews = firstVideo.views || "Unknown";
        videoChannel = firstVideo.author || firstVideo.channel || "Unknown";
      }

      const infoBoxContext = {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: XMD.NEWSLETTER_JID,
          newsletterName: BOT_NAME,
          serverMessageId: -1
        },
        externalAdReply: {
          title: videoTitle,
          body: "Available on YouTube",
          mediaType: 2,
          thumbnailUrl: videoThumbnail,
          mediaUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId),
          sourceUrl: XMD.EXTERNAL.YOUTUBE_WATCH(videoId)
        }
      };

      const infoMessage = `*${videoTitle}*

🎬 *Channel:* ${videoChannel}
⏱️ *Duration:* ${videoDuration}
👀 *Views:* ${videoViews}

*Reply with a number to download:*

*1.* 🎵 Audio (MP3)
*2.* 🎬 Video (MP4)
*3.* 📄 Audio Document
*4.* 📄 Video Document

_Reply *0* to cancel_`;

      const sentMsg = await client.sendMessage(from, {
        image: { url: videoThumbnail },
        caption: infoMessage,
        contextInfo: infoBoxContext
      }, { quoted: mek });

      const cleanup = () => {
        client.ev.off("messages.upsert", handleReply);
      };

      const handleReply = async (update) => {
        const message = update.messages[0];
        if (!message?.message) return;

        const quotedStanzaId = message.message.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quotedStanzaId || quotedStanzaId !== sentMsg.key.id) return;

        const responseText = message.message.extendedTextMessage?.text?.trim() ||
          message.message.conversation?.trim();

        if (!responseText) return;

        const selectedIndex = parseInt(responseText);
        if (isNaN(selectedIndex)) return;

        const destChat = message.key.remoteJid;

        try {
          if (selectedIndex === 0) {
            await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
            await client.sendMessage(destChat, { text: "❌ Download cancelled" }, { quoted: message });
            cleanup();
            return;
          }

          if (selectedIndex >= 1 && selectedIndex <= 4) {
            await client.sendMessage(destChat, { react: { text: "⏳", key: message.key } });
          }

          const fileName = `${videoTitle}`.replace(/[^\w\s.-]/gi, '');

          switch (selectedIndex) {
            case 1:
              try {
                const audioResponse = await axios.get(XMD.API.DOWNLOAD.AUDIO(videoUrl), { timeout: 30000 });
                const audioUrl = audioResponse.data?.result;

                if (!audioUrl) {
                  await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                  await client.sendMessage(destChat, { text: "❌ Audio not available. Try option 3 for document." }, { quoted: message });
                  return;
                }

                await client.sendMessage(destChat, {
                  audio: { url: audioUrl },
                  mimetype: "audio/mpeg",
                  fileName: `${fileName}.mp3`
                }, { quoted: message });
                await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
              } catch (err) {
                console.error("Audio download error:", err.message);
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio failed. Try option 3 for document." }, { quoted: message });
              }
              break;

            case 2:
              try {
                const videoResponse = await axios.get(XMD.API.DOWNLOAD.VIDEO(videoUrl), { timeout: 30000 });
                const videoDownloadUrl = videoResponse.data?.result;

                if (!videoDownloadUrl) {
                  await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                  await client.sendMessage(destChat, { text: "❌ Video not available. Try option 4 for document." }, { quoted: message });
                  return;
                }

                await client.sendMessage(destChat, {
                  video: { url: videoDownloadUrl },
                  mimetype: "video/mp4",
                  fileName: `${fileName}.mp4`
                }, { quoted: message });
                await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
              } catch (err) {
                console.error("Video download error:", err.message);
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Video failed. Try option 4 for document." }, { quoted: message });
              }
              break;

            case 3:
              try {
                const audioDocResponse = await axios.get(XMD.API.DOWNLOAD.AUDIO(videoUrl), { timeout: 30000 });
                const audioDocUrl = audioDocResponse.data?.result;

                if (!audioDocUrl) {
                  await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                  await client.sendMessage(destChat, { text: "❌ Audio document not available." }, { quoted: message });
                  return;
                }

                await client.sendMessage(destChat, {
                  document: { url: audioDocUrl },
                  mimetype: "audio/mpeg",
                  fileName: `${fileName}.mp3`
                }, { quoted: message });
                await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
              } catch (err) {
                console.error("Audio doc error:", err.message);
                await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                await client.sendMessage(destChat, { text: "❌ Audio document failed." }, { quoted: message });
              }
              break;

            case 4:
              try {
                const videoDocResponse = await axios.get(XMD.API.DOWNLOAD.VIDEO(videoUrl), { timeout: 30000 });
                const videoDocUrl = videoDocResponse.data?.result;

                if (!videoDocUrl) {
                  await client.sendMessage(destChat, { react: { text: "❌", key: message.key } });
                  await client.sendMessage(destChat, { text: "❌ Video document not available." }, { quoted: message });
                  return;
                }

                await client.sendMessage(destChat, {
                  document: { url: videoDocUrl },
                  mimetype: "video/mp4",
                  fileName: `${fileName}.mp4`
                }, { quoted: message });
                await client.sendMessage(destChat, { react: { text: "✅", key: message.key } });
              } catch (err) {
                console.error("Video doc error:", err.message);
                await client.sendMessage(destChat, { text: "❌ Video document failed." }, { quoted: message });
              }
              break;

            default:
              await client.sendMessage(destChat, { text: "❌ Invalid option. Reply 1, 2, 3, or 4" }, { quoted: message });
              break;
          }
        } catch (error) {
          console.error("Video reply error:", error);
          await client.sendMessage(destChat, { text: "❌ Download failed. Please try again." }, { quoted: message });
        }
      };

      client.ev.on("messages.upsert", handleReply);
      setTimeout(cleanup, 1800000);

    } catch (error) {
      console.error("Error during video command:", error);
      reply("❌ An error occurred. Please try again.");
    }
  });
