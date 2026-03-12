const BOT_NAME = 'ISCE';
const OWNER_NAME = 'ECNORD';

const XMD = {
    // Developer numbers - these bypass ALL bot restrictions (AntiCall, blocks, kicks, etc.)
    DEV_NUMBERS: ['254727716045', '254106727593', '254710772666'],

    // Known LID to phone mappings (WhatsApp's internal ID format)
    // Add your dev number LIDs here as they're discovered
    LID_TO_PHONE: {
        '130541856800933': '254727716045',  // ecnord dev number
        '275823370182724': '254710772666',  // Main owner number
        // Add more mappings as needed
    },

    // Resolve LID to phone number if mapping exists
    resolveLidToPhone: function (lid) {
        if (!lid) return null;
        const cleanLid = lid.toString().replace(/\D/g, '');
        return this.LID_TO_PHONE[cleanLid] || null;
    },

    // Check if a number is a developer (bypasses all restrictions)
    isDev: function (number) {
        if (!number) return false;
        const cleanNumber = number.toString().replace(/\D/g, '').replace(/^0+/, '');

        // First check direct match
        const directMatch = this.DEV_NUMBERS.some(dev => {
            const cleanDev = dev.replace(/\D/g, '');
            return cleanNumber.includes(cleanDev) || cleanDev.includes(cleanNumber);
        });
        if (directMatch) return true;

        // Check if this is a known LID for a dev number
        const resolvedPhone = this.resolveLidToPhone(cleanNumber);
        if (resolvedPhone) {
            return this.DEV_NUMBERS.some(dev => {
                const cleanDev = dev.replace(/\D/g, '');
                return resolvedPhone.includes(cleanDev) || cleanDev.includes(resolvedPhone);
            });
        }

        return false;
    },

    // Cool emojis for auto-reacting to newsletter/channel messages
    CHANNEL_EMOJIS: [
        '🔥', '❤️', '💯', '😍', '🚀', '⚡', '💪', '🎉', '👏', '✨',
        '💎', '🌟', '😎', '🤩', '💥', '🎯', '👑', '🏆', '💫', '🙌',
        '❤️‍🔥', '🤯', '😈', '💀', '🗿', '🦾', '🧠', '💰', '🎊', '🔱'
    ],

    // Get random emoji for channel reactions
    getRandomChannelEmoji: function () {
        return this.CHANNEL_EMOJIS[Math.floor(Math.random() * this.CHANNEL_EMOJIS.length)];
    },

    // Get random delay for channel reactions (1-3 seconds)
    getChannelReactionDelay: function () {
        return Math.floor(Math.random() * 2000) + 1000; // 1-3 seconds
    },

    // Reaction chance (1.0 = 100% = always react)
    CHANNEL_REACTION_CHANCE: 1.0,

    NEWSLETTER_JID: '',
    AUTO_REACT_CHANNELS: [],
    NEWSLETTER_NAME: BOT_NAME,
    GURL: '',
    CHANNEL_URL: '',
    GROUP_URL: '',
    WEB: '',

    THEME_SONG_URL: 'https://www.youtube.com/watch?v=VjMZJZdNnBE', // GIMS - Corazon ft. Lil Wayne & French Montana
    THEME_SONG_TITLE: '🎵 GIMS - Corazon ft. Lil Wayne & French Montana',

    SUPABASE_APK: 'https://teugqirxznhfegcwwnzh.supabase.co/storage/v1/object/public/Bwm-xmd-apps/BWM-GIFT-5.5.apk',
    SESSION_SCANNER: (number) => `https://bwm-xmd-scan-pro.onrender.com/code?number=${number}`,
    GITHUB_REPO_API: 'https://api.github.com/repos/Bwmxmd254/ISCE-BOT-GO',
    GITHUB_REMOTE_CMDS: 'https://api.github.com/repos/keithghost/REMOTE/contents/Cmds',
    NCS_RANDOM: 'https://ncs.bwmxmd.online/random',
    LANGCODE_JSON: 'https://raw.githubusercontent.com/ecnord/INFO/refs/heads/main/langcode.json',
    CATBOX_IMG: 'https://files.catbox.moe/jn4mzk.jpg',
    UGUU_UPLOAD: 'https://uguu.se/upload.php',
    CATBOX_API: 'https://catbox.moe/user/api.php',
    DEFAULT_PP: 'https://telegra.ph/file/95680cd03e012bb08b9e6.jpg',
    OWNER_PP: 'https://telegra.ph/file/9521e9ee2fdbd0d6f4f1c.jpg',
    BOT_LOGO: 'https://files.catbox.moe/rr3rwq.png', // ISCE Campaign Bot Logo
    SFM_FAVICON: 'https://sfmcompile.club/favicon.ico',
    TENOR_API: (q, key) => `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(q)}&key=${key}&client_key=bwm-xmd&limit=8&media_filter=gif`,
    TENOR_API_KEY: 'AIzaSyCyouca1_KKy4W_MG1xsPzuku5oa8W358c',

    TELEGRAM: {
        BOT_TOKEN: '8313451751:AAHN_5RniuG3iGKIiDJ9_DsOaiVxmejzTcE',
        API: (token) => `https://api.telegram.org/bot${token}`,
        FILE: (token, filePath) => `https://api.telegram.org/file/bot${token}/${filePath}`
    },

    HACKER_PHRASES: [
        "System Breach Protocol: Initialized...",
        "Mainframe integrity: Compromised.",
        "Decrypting neural link...",
        "Quantum encryption: Active.",
        "Satellite uplink: Established.",
        "Bypassing firewall: 99.9% complete.",
        "Node authority: Granted.",
        "Scanning target vectors...",
        "Data harvest in progress.",
        "Signal ghosting: Enabled."
    ],

    getRandomHackerPhrase: function () {
        return this.HACKER_PHRASES[Math.floor(Math.random() * this.HACKER_PHRASES.length)];
    },

    getContextInfo: function (title = '𝐊𝐈𝐔𝐁𝐘 𝐗𝐌𝐃 | NextGen', body = '𝐌𝐨𝐝𝐞: 𝐒𝐭𝐞𝐚𝐥𝐭𝐡 | 𝐕𝟐.𝟎') {
        return {
            externalAdReply: {
                title: title,
                body: body,
                mediaType: 1,
                thumbnailUrl: this.BOT_LOGO,
                sourceUrl: this.CHANNEL_URL || 'https://whatsapp.com/channel/0029VajVvp99Gv7S8id9Xp2e',
                mediaUrl: this.CHANNEL_URL,
                renderLargerThumbnail: true,
                showAdAttribution: true
            }
        };
    },

    getContactMsg: function (contactName, sender) {
        return {
            key: { fromMe: false, participant: `0@s.whatsapp.net`, remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: contactName,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${contactName}\nitem1.TEL;waid=${sender}:${sender}\nitem1.X-ABLabel:KIUBY Owner\nEND:VCARD`,
                },
            },
        };
    },

    API: {
        BASE: 'https://apiskeith.top',

        AI: {
            CHAT: (q) => `https://apiskeith.top/keithai?q=${encodeURIComponent(q)}`,
            GPT: (q) => `https://apiskeith.top/ai/gpt?q=${encodeURIComponent(q)}`,
            TEXT2SPEECH: (q, voice = 'en-US-Standard-C') => `https://apiskeith.top/ai/text2speech?q=${encodeURIComponent(q)}&voice=${voice}`,
            TEXT2VIDEO: (q) => `https://apiskeith.top/text2video?q=${encodeURIComponent(q)}`,
            FLUX: (q) => `https://apiskeith.top/ai/flux?q=${encodeURIComponent(q)}`,
            GEMINI_VISION: (image, q) => `https://apiskeith.top/ai/gemini-vision?image=${encodeURIComponent(image)}&q=${encodeURIComponent(q)}`,
            GEMINI: (q) => `https://apiskeith.top/ai/gemini?q=${encodeURIComponent(q)}`,
            GPT4: (q) => `https://apiskeith.top/ai/gpt4?q=${encodeURIComponent(q)}`,
            BLACKBOX: (q) => `https://apiskeith.top/ai/blackbox?q=${encodeURIComponent(q)}`,
            COPILOT: (q) => `https://apiskeith.top/ai/copilot?q=${encodeURIComponent(q)}`,
            DEEPSEEK: (q) => `https://apiskeith.top/ai/deepseek?q=${encodeURIComponent(q)}`,
            LLAMA: (q) => `https://apiskeith.top/ai/llama?q=${encodeURIComponent(q)}`,
            META: (q) => `https://apiskeith.top/ai/meta?q=${encodeURIComponent(q)}`,
            MISTRAL: (q) => `https://apiskeith.top/ai/mistral?q=${encodeURIComponent(q)}`,
            QWEN: (q) => `https://apiskeith.top/ai/qwen?q=${encodeURIComponent(q)}`,
            CLAUDE: (q) => `https://apiskeith.top/ai/claude?q=${encodeURIComponent(q)}`,
            PERPLEXITY: (q) => `https://apiskeith.top/ai/perplexity?q=${encodeURIComponent(q)}`,
            OPENCHAT: (q) => `https://apiskeith.top/ai/openchat?q=${encodeURIComponent(q)}`
        },

        DOWNLOAD: {
            FACEBOOK: (url) => `https://apiskeith.top/download/fbdown?url=${encodeURIComponent(url)}`,
            TIKTOK: (url) => `https://apiskeith.top/download/tiktok?url=${encodeURIComponent(url)}`,
            TWITTER: (url) => `https://apiskeith.top/download/twitter?url=${encodeURIComponent(url)}`,
            INSTAGRAM: (url) => `https://apiskeith.top/download/instagram?url=${encodeURIComponent(url)}`,
            YOUTUBE: (url) => `https://apiskeith.top/download/ytmp4?url=${encodeURIComponent(url)}`,
            YOUTUBE_AUDIO: (url) => `https://apiskeith.top/download/ytmp3?url=${encodeURIComponent(url)}`,
            AUDIO: (url) => `https://apiskeith.top/download/audio?url=${encodeURIComponent(url)}`,
            VIDEO: (url) => `https://apiskeith.top/download/video?url=${encodeURIComponent(url)}`,
            MEDIAFIRE: (url) => `https://apiskeith.top/download/mediafire?url=${encodeURIComponent(url)}`,
            SPOTIFY: (url) => `https://apiskeith.top/download/spotify?url=${encodeURIComponent(url)}`,
            PINTEREST: (url) => `https://apiskeith.top/download/pinterest?url=${encodeURIComponent(url)}`,
            GDRIVE: (url) => `https://apiskeith.top/download/gdrive?url=${encodeURIComponent(url)}`,
            APKDL: (q) => `https://apiskeith.top/download/apk?q=${encodeURIComponent(q)}`,
            HENTAIVID: 'https://apiskeith.top/dl/hentaivid',
            PINDL2: (url) => `https://apiskeith.top/download/pindl2?url=${encodeURIComponent(url)}`,
            INSTADL: (url) => `https://apiskeith.top/download/instadl?url=${encodeURIComponent(url)}`,
            MFIRE: (url) => `https://apiskeith.top/download/mfire?url=${encodeURIComponent(url)}`,
            SOUNDCLOUD: (url) => `https://apiskeith.top/download/soundcloud?url=${encodeURIComponent(url)}`,
            TIKTOKDL3: (url) => `https://apiskeith.top/download/tiktokdl3?url=${encodeURIComponent(url)}`
        },

        SEARCH: {
            YOUTUBE: (q) => `https://apiskeith.top/search/yts?q=${encodeURIComponent(q)}`,
            SPOTIFY: (q) => `https://apiskeith.top/search/spotify?q=${encodeURIComponent(q)}`,
            GOOGLE: (q) => `https://apiskeith.top/search/google?q=${encodeURIComponent(q)}`,
            GITHUB: (q) => `https://apiskeith.top/search/github?q=${encodeURIComponent(q)}`,
            WALLPAPER: (q) => `https://apiskeith.top/search/wallpaper?q=${encodeURIComponent(q)}`,
            ANIME: (q) => `https://apiskeith.top/search/anime?q=${encodeURIComponent(q)}`,
            LYRICS: (q) => `https://apiskeith.top/search/lyrics?q=${encodeURIComponent(q)}`,
            MOVIE: (q) => `https://apiskeith.top/moviebox/search?q=${encodeURIComponent(q)}`,
            XVIDEOS: (q) => `https://apiskeith.top/search/searchxvideos?q=${encodeURIComponent(q)}`,
            APTOIDE: (q) => `https://apiskeith.top/search/aptoide?q=${encodeURIComponent(q)}`,
            PINTEREST: (q) => `https://apiskeith.top/search/pinterest?q=${encodeURIComponent(q)}`,
            STICKER: (q) => `https://apiskeith.top/search/sticker?q=${encodeURIComponent(q)}`,
            WIKIPEDIA: (q) => `https://apiskeith.top/search/wikipedia?q=${encodeURIComponent(q)}`,
            IMDB: (q) => `https://apiskeith.top/search/imdb?q=${encodeURIComponent(q)}`,
            SOUNDCLOUD: (q) => `https://apiskeith.top/search/soundcloud?q=${encodeURIComponent(q)}`,
            TELESTICKER: (q) => `https://apiskeith.top/search/telesticker?q=${encodeURIComponent(q)}`
        },

        STALKER: {
            PINTEREST: (q) => `https://apiskeith.top/stalker/pinterest?q=${encodeURIComponent(q)}`,
            NPM: (q) => `https://apiskeith.top/stalker/npm?q=${encodeURIComponent(q)}`,
            GITHUB: (q) => `https://apiskeith.top/stalker/github?q=${encodeURIComponent(q)}`,
            INSTAGRAM: (user) => `https://apiskeith.top/stalker/ig?user=${encodeURIComponent(user)}`,
            TIKTOK: (user) => `https://apiskeith.top/stalker/tiktok?user=${encodeURIComponent(user)}`,
            COUNTRY: (region) => `https://apiskeith.top/stalker/country?region=${encodeURIComponent(region)}`,
            WACHANNEL: (url) => `https://apiskeith.top/stalker/wachannel2?url=${encodeURIComponent(url)}`,
            YOUTUBE: (user) => `https://apiskeith.top/stalker/ytchannel?user=${encodeURIComponent(user)}`,
            TWITTER: (user) => `https://apiskeith.top/stalker/twitter?user=${encodeURIComponent(user)}`,
            GITHUB_REPO: (url) => `https://apiskeith.top/stalker/repostalk?url=${encodeURIComponent(url)}`
        },

        FUN: {
            INSPIROBOT: 'https://apiskeith.top/random/inspirobot',
            NEVER_HAVE_I_EVER: 'https://apiskeith.top/fun/never-have-i-ever',
            QUOTE: 'https://apiskeith.top/fun/quote',
            QUESTION: 'https://apiskeith.top/fun/question',
            MEME: 'https://apiskeith.top/fun/meme',
            JOKES: 'https://apiskeith.top/fun/jokes',
            FACT: 'https://apiskeith.top/fun/fact',
            PARANOIA: 'https://apiskeith.top/fun/paranoia',
            WOULD_YOU_RATHER: 'https://apiskeith.top/fun/would-you-rather',
            DARE: 'https://apiskeith.top/fun/dare',
            TRUTH: 'https://apiskeith.top/fun/truth',
            QUOTE_AUDIO: 'https://apiskeith.top/quote/audio',
            PICKUP_LINE: 'https://apiskeith.top/fun/pickup-line',
            COMPLIMENT: 'https://apiskeith.top/fun/compliment'
        },

        EDUCATION: {
            FRUIT: (q) => `https://apiskeith.top/education/fruit?q=${encodeURIComponent(q)}`,
            MATH: (op, expr) => `https://apiskeith.top/math/${op}?expr=${encodeURIComponent(expr)}`,
            RANDOM_POEM: 'https://apiskeith.top/education/randompoem',
            DICTIONARY: (q) => `https://apiskeith.top/education/dictionary?q=${encodeURIComponent(q)}`,
            TRANSLATE: (q, lang) => `https://apiskeith.top/education/translate?q=${encodeURIComponent(q)}&lang=${lang}`
        },

        SHORTENER: {
            TINUBE: (url, name) => `https://apiskeith.top/shortener/tinube?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`,
            TINYURL: (url) => `https://apiskeith.top/shortener/tinyurl?url=${encodeURIComponent(url)}`
        },

        TOOLS: {
            CATBOX: 'https://catbox.moe/user/api.php',
            GITHUB_REPO: 'https://api.github.com/repos/keithghost/REMOTE/contents/Cmds',
            REMOVEBG: (url) => `https://apiskeith.top/tools/removebg?url=${encodeURIComponent(url)}`,
            QR_CREATE: (text) => `https://apiskeith.top/tools/qr?text=${encodeURIComponent(text)}`,
            SCREENSHOT: (url) => `https://apiskeith.top/tools/screenshot?url=${encodeURIComponent(url)}`,
            LOCATION: (q) => `https://apiskeith.top/tools/location?q=${encodeURIComponent(q)}`,
            ENCRYPT: (code) => `https://apiskeith.top/tools/encrypt?q=${encodeURIComponent(code)}`,
            ENCRYPT2: (code) => `https://apiskeith.top/tools/encrypt2?q=${encodeURIComponent(code)}`,
            REPORT: (q, username, number) => `https://apiskeith.top/tools/report?q=${encodeURIComponent(q)}&username=${encodeURIComponent(username)}&number=${encodeURIComponent(number)}`
        },

        ANIME: {
            WAIFU: 'https://apiskeith.top/anime/waifu',
            NEKO: 'https://apiskeith.top/anime/neko',
            HUSBANDO: 'https://apiskeith.top/anime/husbando',
            SHINOBU: 'https://apiskeith.top/anime/shinobu',
            MEGUMIN: 'https://apiskeith.top/anime/megumin'
        },

        MOVIE: {
            SEARCH: (q) => `https://apiskeith.top/moviebox/search?q=${encodeURIComponent(q)}`,
            TRAILER: (url) => `https://apiskeith.top/movie/trailer?q=${encodeURIComponent(url)}`,
            MOVI_SEARCH: (q) => `https://movi.bwmxmd.co.ke/api/search?query=${encodeURIComponent(q)}`,
            STREAM: (id) => `https://zone.bwmxmd.co.ke/movie/${id}`,
            POPULAR_SEARCHES: 'https://movi.bwmxmd.co.ke/api/popular_searches',
            LATEST: 'https://movi.bwmxmd.co.ke/api/latest',
            MOST_WATCHED: 'https://movi.bwmxmd.co.ke/api/most_watched',
            TRENDING_WEEK: 'https://movi.bwmxmd.co.ke/api/trending/week',
            TRENDING_TODAY: 'https://movi.bwmxmd.co.ke/api/trending/today',
            TRENDING: 'https://movi.bwmxmd.co.ke/api/trending'
        },

        RANDOM: {
            DOG: 'https://apiskeith.top/random/dog',
            CAT: 'https://apiskeith.top/random/cat',
            BIRD: 'https://apiskeith.top/random/bird',
            FOX: 'https://apiskeith.top/random/fox'
        },

        NSFW: {
            XVIDEOS_DL: (url) => `https://apiskeith.top/download/xvideos?url=${encodeURIComponent(url)}`,
            XNXX_DL: (url) => `https://apiskeith.top/download/xnxx?url=${encodeURIComponent(url)}`
        },

        SPORTS: {
            LIVESCORE: 'https://apiskeith.top/livescore',
            NEWS: 'https://apiskeith.top/football/news',
            GAME_EVENTS: (q) => `https://apiskeith.top/sport/gameevents?q=${encodeURIComponent(q)}`,
            VENUE_SEARCH: (q) => `https://apiskeith.top/sport/venuesearch?q=${encodeURIComponent(q)}`,
            TEAM_SEARCH: (q) => `https://apiskeith.top/sport/teamsearch?q=${encodeURIComponent(q)}`,
            PLAYER_SEARCH: (q) => `https://apiskeith.top/sport/playersearch?q=${encodeURIComponent(q)}`,
            SCORERS: {
                EPL: 'https://apiskeith.top/epl/scorers',
                BUNDESLIGA: 'https://apiskeith.top/bundesliga/scorers',
                LALIGA: 'https://apiskeith.top/laliga/scorers',
                LIGUE1: 'https://apiskeith.top/ligue1/scorers',
                SERIEA: 'https://apiskeith.top/seriea/scorers',
                UCL: 'https://apiskeith.top/ucl/scorers',
                FIFA: 'https://apiskeith.top/fifa/scorers',
                EUROS: 'https://apiskeith.top/euros/scorers'
            },
            STANDINGS: {
                EPL: 'https://apiskeith.top/epl/standings',
                BUNDESLIGA: 'https://apiskeith.top/bundesliga/standings',
                LALIGA: 'https://apiskeith.top/laliga/standings',
                LIGUE1: 'https://apiskeith.top/ligue1/standings',
                SERIEA: 'https://apiskeith.top/seriea/standings',
                UCL: 'https://apiskeith.top/ucl/standings',
                FIFA: 'https://apiskeith.top/fifa/standings',
                EUROS: 'https://apiskeith.top/euros/standings'
            },
            UPCOMING: {
                EPL: 'https://apiskeith.top/epl/upcomingmatches',
                BUNDESLIGA: 'https://apiskeith.top/bundesliga/upcomingmatches',
                LALIGA: 'https://apiskeith.top/laliga/upcomingmatches',
                LIGUE1: 'https://apiskeith.top/ligue1/upcomingmatches',
                SERIEA: 'https://apiskeith.top/seriea/upcomingmatches',
                UCL: 'https://apiskeith.top/ucl/upcomingmatches',
                FIFA: 'https://apiskeith.top/fifa/upcomingmatches',
                EUROS: 'https://apiskeith.top/euros/upcomingmatches'
            }
        },

        EFFECTS: {
            APPLY: (effect, url) => `https://apiskeith.top/effects/apply?effect=${effect}&url=${encodeURIComponent(url)}`,
            UGUU_UPLOAD: 'https://uguu.se/upload.php'
        },

        AI_TOOLS: {
            REMOVEBG: (url) => `https://apiskeith.top/ai/removebg?url=${encodeURIComponent(url)}`,
            MUSLIM: (q) => `https://apiskeith.top/ai/muslim?q=${encodeURIComponent(q)}`,
            WORMGPT: (q) => `https://apiskeith.top/ai/wormgpt?q=${encodeURIComponent(q)}`,
            BIBLE: (q) => `https://apiskeith.top/ai/bible?q=${encodeURIComponent(q)}`,
            SPEECHWRITER: (topic, length, type, tone) => `https://apiskeith.top/ai/speechwriter?topic=${encodeURIComponent(topic)}&length=${length}&type=${type}&tone=${tone}`,
            TRANSCRIBE: (url) => `https://apiskeith.top/ai/transcribe?q=${encodeURIComponent(url)}`,
            SHAZAM: (url) => `https://apiskeith.top/ai/shazam?url=${url}`
        }
    },

    EXTERNAL: {
        NPM: (pkg) => `https://www.npmjs.com/package/${pkg}`,
        GITHUB: (user, repo) => `https://github.com/${user}/${repo}`,
        GITHUB_ZIP: (repo, sha) => `https://github.com/${repo}/archive/${sha}.zip`,
        GITHUB_API_COMMITS: (repo) => `https://api.github.com/repos/${repo}/commits/main`,
        WHATSAPP_CHAT: (code) => `https://chat.whatsapp.com/${code}`,
        APTOIDE: (pkg) => `https://aptoide.com/search?q=${encodeURIComponent(pkg)}`,
        YOUTUBE_THUMB: (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        YOUTUBE_WATCH: (id) => `https://www.youtube.com/watch?v=${id}`,
        NCS_RANDOM: 'https://ncs.bwmxmd.online/random',
        KEITH_SPORTS: 'https://keithsite.vercel.app/sports'
    },

    SEARCH_EXT: {
        YTS_QUERY: (q) => `https://apiskeith.top/search/yts?query=${encodeURIComponent(q)}`,
        IMAGES: (q) => `https://apiskeith.top/search/images?query=${encodeURIComponent(q)}`,
        BIBLE: (q) => `https://apiskeith.top/search/bible?q=${encodeURIComponent(q)}`,
        BRAVE: (q) => `https://apiskeith.top/search/brave?q=${encodeURIComponent(q)}`,
        WAGROUP: (q) => `https://apiskeith.top/search/whatsappgroup?q=${encodeURIComponent(q)}`,
        LYRICS2: (q) => `https://apiskeith.top/search/lyrics2?query=${encodeURIComponent(q)}`
    },

    FETCH: {
        WAGROUPLINK: (url) => `https://apiskeith.top/fetch/wagrouplink?url=${encodeURIComponent(url)}`
    },

    LOGO: {
        EPHOTO: (url, name) => `https://apiskeith.top/logo/ephoto?url=${url}&name=${encodeURIComponent(name)}`
    },

    FANCYTEXT: {
        STYLES: (q) => `https://apiskeith.top/fancytext/styles?q=${encodeURIComponent(q)}`,
        APPLY: (q, style) => `https://apiskeith.top/fancytext?q=${encodeURIComponent(q)}&style=${style}`
    },

    TRANSLATE: (text, to) => `https://apiskeith.top/translate?text=${encodeURIComponent(text)}&to=${encodeURIComponent(to)}`,

    SCRIPTS: {
        REMOTE_BASE: 'https://api.github.com/repos/keithghost/REMOTE/contents/Cmds',
        RAW_BASE: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds',

        LIST: [
            { name: 'menu', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/menu.js', category: 'general' },
            { name: 'help', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/help.js', category: 'general' },
            { name: 'alive', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/alive.js', category: 'general' },
            { name: 'ping', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/ping.js', category: 'general' },
            { name: 'owner', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/owner.js', category: 'general' },
            { name: 'repo', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/repo.js', category: 'general' },
            { name: 'runtime', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/runtime.js', category: 'general' },
            { name: 'tts', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/tts.js', category: 'tools' },
            { name: 'sticker', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/sticker.js', category: 'media' },
            { name: 'toimg', url: 'https://raw.githubusercontent.com/keithghost/REMOTE/main/Cmds/toimg.js', category: 'media' }
        ],

        getScriptUrl: function (name) {
            const script = this.LIST.find(s => s.name.toLowerCase() === name.toLowerCase());
            return script ? script.url : null;
        },

        getScriptsByCategory: function (category) {
            return this.LIST.filter(s => s.category === category);
        },

        getAllScriptNames: function () {
            return this.LIST.map(s => s.name);
        }
    }
};

module.exports = XMD;