const express = require('express');
const rateLimit = require('express-rate-limit');
const Fs = require('fs');
const Sharp = require('sharp');
const axios = require('axios');

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

app.get('*', async (req, res, next) => {
    function encodePath(path) {
        return path.split('/').map(segment => encodeURIComponent(segment)).join('/');
    }    
    const FILENAME = encodePath(req.url);
    const ORIGINAL_IMAGE = 'https://wanderstories.space' + FILENAME;
    const FILE_EXTENSION = ORIGINAL_IMAGE.split('.').pop().toLowerCase();
    const LOGO = __dirname + '/Wanderstories-logo.png';
    const ACCEPTED = ['jpg', 'jpeg', 'png'];
    
    if (
        ACCEPTED.indexOf(FILE_EXTENSION) >= 0 &&
        FILENAME.split('/')[1] === 'content' &&
        FILENAME.split('/')[2] === 'images'
    ) {
        const PATH = __dirname + FILENAME.replace('/content', '');
        console.log(PATH);
        
        if (Fs.existsSync(PATH)) {
            res.sendFile(PATH);
        } else {
            axios
                .get(ORIGINAL_IMAGE, { responseType: 'arraybuffer' })
                .then((imageResponse) => {
                    const imageBuffer = imageResponse.data;

                    Sharp(imageBuffer)
                        .metadata()
                        .then(({ width }) => {
                            return Sharp(LOGO)
                                .resize({ width: Math.round(width / 5) })
                                .toBuffer();
                        })
                        .then((resizedLogoBuffer) => {
                            return Sharp(imageBuffer)
                                .composite([
                                    {
                                        input: resizedLogoBuffer,
                                        gravity: 'centre',
                                        blend: 'overlay',
                                    },
                                ])
                                .jpeg({ quality: 60 })
                                .toBuffer();
                        })
                        .then((outputBuffer) => {
                            const directoryPath = PATH.substring(0, PATH.lastIndexOf("/"));
                            Fs.mkdirSync(directoryPath, { recursive: true });
                            Fs.writeFileSync(PATH, outputBuffer);
                            res.sendFile(PATH);
                        })
                })
                .catch((err) => {
                    console.error(err);
                    res.status(500).send('Server Error');
                });
        }
    } else {
        res.status(404).send('Not Found !!!');
    }
});

app.listen(port, () => {
    console.log(`Listening on port ${port}`);
});
