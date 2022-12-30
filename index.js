const express = require('express')
const rateLimit = require('express-rate-limit')
const Fs = require('fs')
const Jimp = require("jimp")

const app = express()
const port = process.env.PORT || 8080

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 200, // Limit each IP to 200 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
})
// Apply the rate limiting middleware to all requests
app.use(limiter)

app.get('/', async (req, res, next) => {
  res.writeHead(200, {
    'Content-Type': 'text/plain'
  })
  res.end('Wanderstories Image Watermarker')
})

app.get('*', function(req, res) {

  //const FILENAME = ORIGINAL_IMAGE.split('/').pop()
  const FILENAME = escape(req.url)
  //console.log(FILENAME)

  const ORIGINAL_IMAGE = "https://wanderstories.space" + FILENAME

  const FILE_EXTENSION = ORIGINAL_IMAGE.split('.').pop().toLowerCase()

  //const LOGO = "https://wanderstories.space/content/images/size/w1000/2016/06/Wander-Stories-logo.jpg"
  //const LOGO = "https://wanderstories.space/content/images/size/w1000/2021/11/Wanderstories-publication-logo.png"
  const LOGO = __dirname + "/Wanderstories-logo.png"

  const JIMP_QUALITY = 60

  const ACCEPTED = [
    'jpg',
    'jpeg',
    'png'
  ]

   // If an accepted file extensinon && path is /content/images
  if (ACCEPTED.indexOf(FILE_EXTENSION) >= 0 && FILENAME.split('/')[1] == 'content' && FILENAME.split('/')[2] == 'images') {

    // Store on server in images folder (not content/images)
    const PATH = __dirname + FILENAME.replace('/content','')
    console.log(PATH)

    // Check if file exists on server
    if (Fs.existsSync(PATH)) {
        // file already exists, send file
        //res.send('File Exists ' + FILENAME + '!')
        res.sendFile(PATH)

    } else { // file does not exist, generate watermarked image

      const main = async () => {
        const [image, logo] = await Promise.all([
          Jimp.read(ORIGINAL_IMAGE),
          Jimp.read(LOGO)
        ])

        ///////////////////
        ///// Center //////
        ///////////////////
        logo.resize(image.bitmap.width / 5, Jimp.AUTO)

        const X = (image.bitmap.width / 2) - (logo.bitmap.width / 2)
        const Y = (image.bitmap.height / 2) - (logo.bitmap.height / 2)

          /* // BLEND MODES
          Jimp.BLEND_SOURCE_OVER;
          Jimp.BLEND_DESTINATION_OVER;
          Jimp.BLEND_MULTIPLY;
          Jimp.BLEND_ADD; ---
          Jimp.BLEND_SCREEN;
          Jimp.BLEND_OVERLAY;
          Jimp.BLEND_DARKEN;
          Jimp.BLEND_LIGHTEN;
          Jimp.BLEND_HARDLIGHT;
          Jimp.BLEND_DIFFERENCE;
          Jimp.BLEND_EXCLUSION;
          */

        return image.composite(logo, X, Y, {
            mode: Jimp.BLEND_ADD,
            opacitySource: 0.2,
            opacityDest: 1
        })
        ///////////////////
        // Bottom Right ///
        ///////////////////
        /*

        const LOGO_MARGIN_PERCENTAGE = 5

        logo.resize(image.bitmap.width / 10, Jimp.AUTO)

        const xMargin = (image.bitmap.width * LOGO_MARGIN_PERCENTAGE) / 100
        const yMargin = (image.bitmap.height * LOGO_MARGIN_PERCENTAGE) / 100

        const X = image.bitmap.width - logo.bitmap.width - xMargin
        const Y = image.bitmap.height - logo.bitmap.height - yMargin

        return image.composite(logo, X, Y, {
            mode: Jimp.BLEND_SCREEN,
            opacitySource: 0.5,
            opacityDest: 1
        })
        */
      }

      // write file to server and send file
      main().then(image => image.quality(JIMP_QUALITY).writeAsync(PATH)).then(() => {
        res.sendFile(PATH)
      })
    }

  } else { // not acceptable fileformat
    res.status(404).send('Not Found !!!')
  }

})

app.listen(port)
console.log('Listening on port ' + port)
