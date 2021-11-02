const express = require('express');
const Fs = require('fs');
const Jimp = require("jimp");

const app = express();
const port = process.env.PORT || 8080;

app.get('*', function(req, res) {

  //const FILENAME = ORIGINAL_IMAGE.split('/').pop()
  const FILENAME = req.url
  console.log(FILENAME);

  const ORIGINAL_IMAGE = "https://wanderstories.space" + FILENAME;

  const EXTENSION = ORIGINAL_IMAGE.split('.').pop().toLowerCase();

  const LOGO = "https://wanderstories.space/content/images/size/w1000/2016/06/Wander-Stories-logo.jpg";

  const LOGO_MARGIN_PERCENTAGE = 5;

  const ACCEPTED = [
    'jpg',
    'jpeg',
    'png'
  ]

  if (ACCEPTED.indexOf(EXTENSION) >= 0 && FILENAME.split('/')[1] == 'content') { // If an accepted fileextensinon

    const PATH = __dirname + FILENAME.replace('/content','');
    console.log(PATH)

    if (Fs.existsSync(PATH)) {

        //res.send('File Exists ' + FILENAME + '!'); // file exists, send file
        res.sendFile(PATH)

    } else { // generate file

      const main = async () => {
        const [image, logo] = await Promise.all([
          Jimp.read(ORIGINAL_IMAGE),
          Jimp.read(LOGO)
        ]);

        logo.resize(image.bitmap.width / 10, Jimp.AUTO);

        const xMargin = (image.bitmap.width * LOGO_MARGIN_PERCENTAGE) / 100;
        const yMargin = (image.bitmap.width * LOGO_MARGIN_PERCENTAGE) / 100;

        const X = image.bitmap.width - logo.bitmap.width - xMargin;
        const Y = image.bitmap.height - logo.bitmap.height - yMargin;

        return image.composite(logo, X, Y, [
          {
            mode: Jimp.BLEND_SCREEN,
            opacitySource: 0.1,
            opacityDest: 1
          }
        ]);
      };

      main().then(image => image.writeAsync(PATH)).then(() => {
        res.sendFile(PATH)
      })
    }

  } else { // not acceptable fileformat
    res.status(404).send('Not Found !!!');
  }

});

app.listen(port);
console.log('Server started at http://localhost:' + port);
