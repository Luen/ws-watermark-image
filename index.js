const express = require('express');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const csrf = require('csurf');
const cookieParser = require('cookie-parser');

const app = express();

// Use necessary middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(csrf({ cookie: true })); // Implement CSRF protection
app.use(helmet()); // Apply additional security headers
app.use(compression()); // Compress all routes
app.use(cors()); // Enable CORS for all routes

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

app.get('/content/images/*', async (req, res, next) => { // Only allow this specific pattern
    try {
        const relativePath = req.params[0]; // Get the relative path after /content/images/

        // Very strict validation to only allow certain characters in the path
        if (!/^[\w\-\/\.]+$/.test(relativePath)) {
            return res.status(400).send('Invalid path');
        }

        const fileExtension = path.extname(relativePath).substring(1).toLowerCase();
        const accepted = ['jpg', 'jpeg', 'png'];

        if (!accepted.includes(fileExtension)) {
            return res.status(400).send('Invalid file type');
        }

        const imagePath = path.join(__dirname, 'content', 'images', relativePath);

        const logoPath = path.join(__dirname, 'Wanderstories-logo.png');

        try {
            await fs.promises.access(imagePath);
            return res.sendFile(imagePath);
        } catch (err) {
            // File doesn't exist (this is expected), continue processing
        }

        const originalImageUrl = new URL(`https://wanderstories.space/content/images/${encodeURIComponent(relativePath)}`);

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

        // Safely create directory and write file
        const directoryPath = path.dirname(imagePath);
        await fs.promises.mkdir(directoryPath, { recursive: true });
        await fs.promises.writeFile(imagePath, outputBuffer);

        return res.sendFile(imagePath);

    } catch (err) {
        console.error(err);
        return res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
