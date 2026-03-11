const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'core/public');
const geminiDir = path.join(publicDir, 'gemini_images');

if (!fs.existsSync(geminiDir)) {
    fs.mkdirSync(geminiDir, { recursive: true });
}

// 1. Rename and move large Gemini images
const files = fs.readdirSync(publicDir);
let count = 1;
files.forEach(file => {
    if (file.toLowerCase().includes('gemini') && file.endsWith('.png') && !file.includes('gemini_images')) {
        const oldPath = path.join(publicDir, file);
        const newFileName = `kiuby_${count++}.png`;
        const newPath = path.join(geminiDir, newFileName);

        console.log(`Moving/Renaming: ${file} -> gemini_images/${newFileName}`);
        fs.renameSync(oldPath, newPath);
    }
});

// 2. Remove isce.png and bot-image.jpg if they exist
const toRemove = [
    path.join(publicDir, 'isce.png'),
    path.join(publicDir, 'bot-image.jpg'),
    path.join(__dirname, 'assets/isce.png')
];

toRemove.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        console.log(`Removing: ${filePath}`);
        fs.unlinkSync(filePath);
    }
});

console.log('Cleanup complete!');
