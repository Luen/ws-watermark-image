const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const app = require('../index.js')

let server
let baseUrl

const fixtureDir = path.join(__dirname, '..', 'content', 'images', '__cache_test__')
const fixturePath = path.join(fixtureDir, 'cache-fixture.jpg')
const fixtureRelativePath = '__cache_test__/cache-fixture.jpg'

before(async () => {
    await fs.promises.mkdir(fixtureDir, { recursive: true })
    await sharp({
        create: {
            width: 30,
            height: 30,
            channels: 3,
            background: '#4488aa',
        },
    })
        .jpeg()
        .toFile(fixturePath)

    await new Promise((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve)
        server.once('error', reject)
    })

    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await fs.promises.rm(fixtureDir, { recursive: true, force: true })
})

function get(pathname) {
    return fetch(`${baseUrl}${pathname}`, {
        headers: { connection: 'close' },
    })
}

test('sets Cache-Control header on cached image responses', async () => {
    const response = await get(`/content/images/${fixtureRelativePath}`)

    assert.equal(response.status, 200)
    assert.equal(
        response.headers.get('cache-control'),
        'public, max-age=31536000, immutable'
    )
})

test('sets Cache-Control header on favicon.ico', async () => {
    const response = await get('/favicon.ico')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'public, max-age=86400')
})
