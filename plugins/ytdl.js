const { kiubyxmd } = require('../core/commandHandler');
const axios = require('axios');
const XMD = require('../core/xmd');

kiubyxmd({
    pattern: "ytdl",
    aliases: ["ytmp4", "downloadyt"],
    description: "Download YouTube videos as MP4",
    category: "Downloader",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, args, q, ms } = conText;

    if (!q) {
        await react("❓");
        return reply("❌ Please provide a YouTube URL.\nExample: .ytdl https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    await react("⏳");
    reply("📥 *Processing YouTube Download...*");

    const providers = [
        {
            name: "Keith API",
            url: XMD.API.DOWNLOAD.YOUTUBE(q),
            getData: (res) => res.data.result
        },
        {
            name: "Gifted Tech",
            url: `https://api.giftedtech.my.id/api/download/ytmp4?apikey=gifted&url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        },
        {
            name: "Maher-Zubair",
            url: `https://api.maher-zubair.tech/download/ytmp4?url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        },
        {
            name: "Vreden",
            url: `https://api.vreden.my.id/api/download/ytmp4?url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        }
    ];

    let success = false;
    for (const provider of providers) {
        try {
            const response = await axios.get(provider.url, { timeout: 20000 });
            const result = provider.getData(response);
            if (result && (result.download_url || result.url || result.dl_url)) {
                const downloadUrl = result.download_url || result.url || result.dl_url;
                const title = result.title || "KIUBY-XMD Video";

                await reply(`🎬 *Title:* ${title}\n\nDownloaded via *KIUBY-XMD*`, {
                    video: { url: downloadUrl },
                    fileName: `${title}.mp4`
                });

                await react("✅");
                success = true;
                break;
            }
        } catch (e) {
            console.error(`YTDL: ${provider.name} failed:`, e.message);
        }
    }

    if (!success) {
        await react("❌");
        reply("❌ Failed to fetch download link. All providers are currently down or the video is restricted.");
    }
});

kiubyxmd({
    pattern: "ytmp3",
    aliases: ["song", "ytaudio"],
    description: "Download YouTube videos as MP3",
    category: "Downloader",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, args, q, ms } = conText;

    if (!q) {
        await react("❓");
        return reply("❌ Please provide a YouTube URL.\nExample: .ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    await react("⏳");
    reply("📥 *Processing YouTube Audio...*");

    const providers = [
        {
            name: "Keith API",
            url: XMD.API.DOWNLOAD.YOUTUBE_AUDIO(q),
            getData: (res) => res.data.result
        },
        {
            name: "Gifted Tech",
            url: `https://api.giftedtech.my.id/api/download/ytmp3?apikey=gifted&url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        },
        {
            name: "Maher-Zubair",
            url: `https://api.maher-zubair.tech/download/ytmp3?url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        },
        {
            name: "Vreden",
            url: `https://api.vreden.my.id/api/download/ytmp3?url=${encodeURIComponent(q)}`,
            getData: (res) => res.data.result
        }
    ];

    let success = false;
    for (const provider of providers) {
        try {
            const response = await axios.get(provider.url, { timeout: 20000 });
            const result = provider.getData(response);
            if (result && (result.download_url || result.url || result.dl_url)) {
                const downloadUrl = result.download_url || result.url || result.dl_url;
                const title = result.title || "KIUBY-XMD Audio";

                await reply(`🎧 *Title:* ${title}\n\nDownloaded via *KIUBY-XMD*`, {
                    audio: { url: downloadUrl },
                    fileName: `${title}.mp3`
                });

                await react("✅");
                success = true;
                break;
            }
        } catch (e) {
            console.error(`YTMP3: ${provider.name} failed:`, e.message);
        }
    }

    if (!success) {
        await react("❌");
        reply("❌ Failed to fetch audio download link.");
    }
});
