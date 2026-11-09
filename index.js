const express = require('express')
const rateLimit = require('express-rate-limit')
const cors = require('cors')
const csrfImport = require('@dr.pogodin/csurf')
const csrf = typeof csrfImport === 'function' ? csrfImport : csrfImport.default
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { version } = require('./package.json')

const port = process.env.PORT || 8080

const accepted = ['jpg', 'jpeg', 'png']
const logoPath = path.join(__dirname, 'Wanderstories-logo.png')
const imagesRoot = path.resolve(__dirname, 'content', 'images')

const app = express()
app.set('trust proxy', 1) // trust first proxy

// Use necessary middleware
app.use(express.urlencoded({ extended: false }))
app.use(express.json())
app.use(cookieParser())
app.use(csrf({ cookie: true })) // Implement CSRF protection
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: [
                    "'self'",
                    'https://static.cloudflareinsights.com',
                    'https://www.googletagmanager.com',
                    'https://www.google-analytics.com',
                ],
                connectSrc: [
                    "'self'",
                    'https://images.wanderstories.space',
                    'https://static.cloudflareinsights.com',
                    'https://www.google.com.au',
                    'https://www.google-analytics.com',
                ],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https://wanderstories.space'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                upgradeInsecureRequests: [],
            },
        },
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
) // Implement security headers
const allowedOrigins = [
    'https://images.wanderstories.space',
    'https://wanderstories.space',
    'http://localhost:8080',
]
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true)

        // Never reject a request because of its Origin. CORS is enforced by the
        // browser, not the server: for an unknown origin we simply omit the
        // Access-Control-Allow-* headers and still serve the response. Throwing
        // here made every request from an unlisted origin fail with a 500,
        // including plain <img> loads that do not need CORS at all.
        callback(null, allowedOrigins.includes(origin))
    },
    credentials: true,
    optionsSuccessStatus: 204,
}
app.use(cors(corsOptions))
// Enable CORS for all routes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 800,
    standardHeaders: true,
    legacyHeaders: false,
})
app.use(limiter)

app.get('/', async (req, res, next) => {
    res.writeHead(200, {
        'Content-Type': 'text/plain',
    })
    res.end(`Wanderstories Image Watermarker v${version}`)
})

app.get('/favicon.ico', async (req, res, next) => {
    res.sendFile(path.join(__dirname, 'favicon.ico'))
})

app.get('/content/images/{*imagePath}', async (req, res, next) => {
    // Only allow this specific pattern
    try {
        const imagePathParam = req.params.imagePath
        const relativePath = Array.isArray(imagePathParam)
            ? imagePathParam.join('/')
            : imagePathParam || ''

        // Very strict validation to only allow certain characters in the path
        if (!/^[\w\-\/\.]+$/.test(relativePath)) {
            // invalid path
            //console.error('Invalid path');
            return res.status(400).send('Invalid request')
        }

        const fileExtension = path
            .extname(relativePath)
            .substring(1)
            .toLowerCase()

        if (!accepted.includes(fileExtension)) {
            // invalid file type
            //console.error('Invalid file type');
            return res.status(400).send('Invalid request')
        }

        const imagePath = path.join(
            __dirname,
            'content',
            'images',
            relativePath
        )
        const resolvedImagePath = path.resolve(imagePath)
        if (!resolvedImagePath.startsWith(imagesRoot + path.sep)) {
            return res.status(403).send('Forbidden')
        }

        try {
            // Only serve the cached file if it is readable; otherwise fall
            // through and regenerate it. A cached file that exists but is not
            // readable (e.g. owned by another user from an older container)
            // would otherwise make sendFile fail with a 500.
            await fs.promises.access(resolvedImagePath, fs.constants.R_OK)
            return res.sendFile(resolvedImagePath)
        } catch (err) {
            if (err.code !== 'ENOENT') {
                console.error(
                    'Cached image not readable, regenerating:',
                    resolvedImagePath,
                    err
                )
            }
            // File doesn't exist or isn't readable (expected in most cases),
            // continue processing
        }

        // Split the path by slashes
        const pathSegments = relativePath.split('/')
        // Encode each segment separately
        const encodedSegments = pathSegments.map((segment) =>
            encodeURIComponent(segment)
        )
        // Join them back together with slashes
        const encodedPath = encodedSegments.join('/')
        // Construct the URL
        const originalImageUrl = new URL(
            `https://wanderstories.space/content/images/${encodedPath}`
        )

        let imageBuffer
        try {
            const imageResponse = await fetch(originalImageUrl.href)
            if (!imageResponse.ok) {
                console.error(
                    'Failed to fetch image:',
                    originalImageUrl.href,
                    imageResponse.status
                )
                throw new Error('Failed to fetch image')
            }
            imageBuffer = await imageResponse.arrayBuffer()
        } catch (err) {
            console.error('Failed to fetch image, redirecting:', err)
            return res.redirect(originalImageUrl.href)
        }

        const imageMetadata = await sharp(imageBuffer).metadata()

        // Check if image exceeds maximum dimensions
        // Note that Ghost only reduces the width to 2000px
        if (imageMetadata.width > 2000 || imageMetadata.height > 4000) {
            return res.status(413).send('Image too large')
        }

        const logoMetadata = await sharp(logoPath).metadata()
        let compositeLogoBuffer

        // Validate that the logo resizing operation is successful before compositing
        if (
            logoMetadata.width > imageMetadata.width ||
            logoMetadata.height > imageMetadata.height
        ) {
            // console.log('Logo dimensions are larger than base image');
            // Resize the logo to fit within the base image
            compositeLogoBuffer = await sharp(logoPath)
                .resize({
                    width: imageMetadata.width,
                    height: imageMetadata.height,
                    fit: 'inside', // Preserve aspect ratio
                })
                .toBuffer()
        } else {
            // If the logo is already smaller than the base image, use it as is
            compositeLogoBuffer = await sharp(logoPath).toBuffer()
        }

        // Resize the logo to 1/5 of the base image width for compositing
        const resizedLogoBuffer = await sharp(compositeLogoBuffer)
            .resize({ width: Math.round(imageMetadata.width / 5) })
            .toBuffer()

        // Composite the resized logo onto the base image
        const outputBuffer = await sharp(imageBuffer)
            .composite([
                {
                    input: resizedLogoBuffer,
                    gravity: 'center',
                    blend: 'overlay',
                },
                {
                    input: resizedLogoBuffer,
                    gravity: 'center',
                    blend: 'dest-over',
                    opacity: 0.1,
                },
            ])
            .jpeg({ quality: 60 })
            .toBuffer()

        // Safely create directory and write file
        const directoryPath = path.dirname(imagePath)
        try {
            await fs.promises.mkdir(directoryPath, { recursive: true })
            await fs.promises.writeFile(resolvedImagePath, outputBuffer)
        } catch (err) {
            // Handle file writing error
            console.error('Error writing file:', resolvedImagePath, err)
            // Never turn a cache-write failure (e.g. a bind-mounted volume
            // owned by another user) into a 500: serve the processed image
            // from memory instead. Caching is lost, but the request succeeds.
            res.set('Content-Type', 'image/jpeg')
            return res.send(outputBuffer)
        }

        return res.sendFile(resolvedImagePath)
    } catch (err) {
        console.error('Error processing image:', err)
        return res.status(500).send('Internal Server Error')
    }
})

if (require.main === module) {
    app.listen(port, (error) => {
        if (error) {
            throw error
        }
        console.log(`Listening on http://localhost:${port}`)
    })
}

module.exports = app
