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
    const { reply, react, arg, q } = conText;

    if (!q) {
        await react("❓");
        return reply("❌ Please provide a YouTube URL.\nExample: .ytdl https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    try {
        await react("⏳");
        reply("📥 *Processing YouTube Download...*");

        const apiUrl = XMD.API.DOWNLOAD.YOUTUBE(q);
        const response = await axios.get(apiUrl);

        if (response.data && response.data.status && response.data.result) {
            const result = response.data.result;
            const downloadUrl = result.download_url || result.url;
            const title = result.title || "KIUBY-XMD Video";

            await client.sendMessage(from, {
                video: { url: downloadUrl },
                caption: `🎬 *Title:* ${title}\n\nDownloaded via *KIUBY-XMD*`,
                fileName: `${title}.mp4`
            }, { quoted: conText.ms });

            await react("✅");
        } else {
            await react("❌");
            reply("❌ Failed to fetch download link. The video might be restricted or the API is down.");
        }
    } catch (e) {
        console.error("YTDL Error:", e);
        await react("❌");
        reply("❌ An error occurred while processing the request.");
    }
});

kiubyxmd({
    pattern: "ytmp3",
    aliases: ["song", "ytaudio"],
    description: "Download YouTube videos as MP3",
    category: "Downloader",
    filename: __filename
}, async (from, client, conText) => {
    const { reply, react, arg, q } = conText;

    if (!q) {
        await react("❓");
        return reply("❌ Please provide a YouTube URL.\nExample: .ytmp3 https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }

    try {
        await react("⏳");
        reply("📥 *Processing YouTube Audio...*");

        const apiUrl = `https://apiskeith.top/download/ytmp3?url=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);

        if (response.data && response.data.status && response.data.result) {
            const result = response.data.result;
            const downloadUrl = result.download_url || result.url;
            const title = result.title || "KIUBY-XMD Audio";

            await client.sendMessage(from, {
                audio: { url: downloadUrl },
                mimetype: "audio/mpeg",
                fileName: `${title}.mp3`
            }, { quoted: conText.ms });

            await react("✅");
        } else {
            await react("❌");
            reply("❌ Failed to fetch download link.");
        }
    } catch (e) {
        console.error("YTDL Error:", e);
        await react("❌");
        reply("❌ An error occurred.");
    }
});
