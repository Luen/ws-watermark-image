const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Sharp = require('sharp');

const app = express();
const port = process.env.PORT || 8080;

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

app.get('/', async (req, res, next) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
    });
    res.end('Wanderstories Image Watermarker');
});

app.get('*', async (req, res) => {
    try {
        const segments = req.url.split('/').filter(segment => segment);
        
        if (segments.length < 3 || segments[0] !== 'content' || segments[1] !== 'images') {
            return res.status(404).send('Not Found');
        }

        const encodedSegments = segments.map(segment => encodeURIComponent(segment));
        const encodedPath = encodedSegments.join('/');
        
        const originalImageUrl = new URL(`https://wanderstories.space/${encodedPath}`);
        
        if (originalImageUrl.origin !== 'https://wanderstories.space') {
            return res.status(400).send('Invalid URL');
        }

        const fileExtension = originalImageUrl.pathname.split('.').pop().toLowerCase();
        const accepted = ['jpg', 'jpeg', 'png'];
        
        if (!accepted.includes(fileExtension)) {
            return res.status(400).send('Invalid file type');
        }

        const logoPath = path.join(__dirname, 'Wanderstories-logo.png');
        const imagePath = path.normalize(path.join(__dirname, ...encodedSegments));
        const relativePath = path.relative(__dirname, imagePath);

        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return res.status(400).send('Invalid path');
        }

        if (fs.existsSync(imagePath)) {
            return res.sendFile(imagePath);
        }

        const imageResponse = await axios.get(originalImageUrl.href, { responseType: 'arraybuffer' });

        const imageBuffer = imageResponse.data;
        const metadata = await sharp(imageBuffer).metadata();

        const resizedLogoBuffer = await sharp(logoPath)
            .resize({ width: Math.round(metadata.width / 5) })
            .toBuffer();

        const outputBuffer = await sharp(imageBuffer)
            .composite([
                {
                    input: resizedLogoBuffer,
                    gravity: 'center',
                    blend: 'overlay',
                },
            ])
            .jpeg({ quality: 60 })
            .toBuffer();

        const directoryPath = path.dirname(imagePath);
        fs.mkdirSync(directoryPath, { recursive: true });
        fs.writeFileSync(imagePath, outputBuffer);

        return res.sendFile(imagePath);

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server Error');
    }
});


app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
