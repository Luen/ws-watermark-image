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

app.get('*', async (req, res, next) => {
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

        // Validate the relativePath to prevent Path Traversal
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            return res.status(400).send('Invalid path');
        }

        // Changed from existsSync to promises to avoid deprecation warnings
        const directoryPath = path.dirname(imagePath);
        try {
            await fs.promises.access(imagePath);
            return res.sendFile(imagePath);
        } catch (err) {
            // File doesn't exist, continue processing
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

        // Safely create directory and write file
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
