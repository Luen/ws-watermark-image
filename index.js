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

const port = process.env.PORT || 8080;

const accepted = ['jpg', 'jpeg', 'png'];
const logoPath = path.join(__dirname, 'Wanderstories-logo.png');

const app = express();
app.set('trust proxy', 1); // trust first proxy

// Use necessary middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());
app.use(csrf({ cookie: true })); // Implement CSRF protection
app.use(
    helmet({
        contentSecurityPolicy: false,
        crossOriginOpenerPolicy: { policy: 'unsafe-none' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
      }) 
); // Apply additional security headers
app.use(compression()); // Compress all routes
const corsOptions = {
    origin: function (origin, callback) {
      console.log('Origin:', origin);  // Log the origin
      callback(null, true)
    },
    optionsSuccessStatus: 204,
    credentials: true  // Enable credentials (cookies, etc.)
};
app.use(cors(corsOptions)); // Enable CORS for all routes
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

app.get('/favicon.ico', async (req, res, next) => {
    res.sendFile(path.join(__dirname, 'favicon.ico'));
})

app.get('/content/images/*', async (req, res, next) => { // Only allow this specific pattern
    try {
        const relativePath = req.params[0]; // Get the relative path after /content/images/

        // Very strict validation to only allow certain characters in the path
        if (!/^[\w\-\/\.]+$/.test(relativePath)) {
            // invalid path
            console.error('Invalid path');
            return res.status(400).send('Invalid request');
        }

        const fileExtension = path.extname(relativePath).substring(1).toLowerCase();

        if (!accepted.includes(fileExtension)) {
            // invalid file type
            console.error('Invalid file type');
            return res.status(400).send('Invalid request');
        }

        const imagePath = path.join(__dirname, 'content', 'images', relativePath);

        try {
            await fs.promises.access(imagePath);
            return res.sendFile(imagePath);
        } catch (err) {
            // File doesn't exist (this is expected), continue processing
        }

        const originalImageUrl = new URL(`https://wanderstories.space/content/images/${encodeURIComponent(relativePath)}`);

        const imageResponse = await axios.get(originalImageUrl.href, { responseType: 'arraybuffer' });

        const imageBuffer = imageResponse.data;
        const imageMetadata = await sharp(imageBuffer).metadata();

        const logoMetadata = await sharp(logoPath).metadata(); 
        let compositeLogoBuffer;

        // Validate that the logo resizing operation is successful before compositing
        if (logoMetadata.width > imageMetadata.width || logoMetadata.height > imageMetadata.height) {
            // console.log('Logo dimensions are larger than base image');
            // Resize the logo to fit within the base image
            compositeLogoBuffer = await sharp(logoPath)
            .resize({
                width: imageMetadata.width,
                height: imageMetadata.height,
                fit: 'inside' // Preserve aspect ratio
            })
            .toBuffer();
        } else {
            // If the logo is already smaller than the base image, use it as is
            compositeLogoBuffer = await sharp(logoPath).toBuffer();
        }       

        // Resize the logo to 1/5 of the base image width for compositing
        const resizedLogoBuffer = await sharp(compositeLogoBuffer)
            .resize({ width: Math.round(imageMetadata.width / 5) })
            .toBuffer();

        // Composite the resized logo onto the base image
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
    console.log(`Listening on http://localhost:${port}`);
});
