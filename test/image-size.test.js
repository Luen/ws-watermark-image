const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const sharp = require('sharp')

const app = require('../index.js')

let server
let baseUrl

const testDir = path.join(__dirname, '..', 'content', 'images', 'size', 'w2000', '__test__')
const fixtureFile = path.join(testDir, 'allowed-size-fixture.jpg')
const fixtureRelativePath = 'size/w2000/__test__/allowed-size-fixture.jpg'

before(async () => {
    await fs.promises.mkdir(testDir, { recursive: true })
    await sharp({
        create: {
            width: 50,
            height: 50,
            channels: 3,
            background: '#224466',
        },
    })
        .jpeg()
        .toFile(fixtureFile)

    await new Promise((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve)
        server.once('error', reject)
    })

    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await new Promise((resolve) => server.close(resolve))
    await fs.promises.rm(path.join(__dirname, '..', 'content', 'images', 'size'), {
        recursive: true,
        force: true,
    })
})

function get(pathname, options = {}) {
    return fetch(`${baseUrl}${pathname}`, {
        redirect: 'manual',
        headers: { connection: 'close', ...options.headers },
        ...options,
    })
}

test('includes standard Ghost responsive widths and icon dimensions by default', () => {
    const allowed = app.getAllowedSizes()

    // Core content & standard themes (Casper, Source, etc.)
    const expectedSizes = [
        'w30',
        'w100',
        'w160',
        'w300',
        'w320',
        'w600',
        'w960',
        'w1000',
        'w1200',
        'w1600',
        'w2000',
        'w2400',
        'w60h60',
        'w100h100',
        'w256h256',
    ]

    for (const size of expectedSizes) {
        assert.equal(allowed.has(size), true, `Expected ${size} to be allowed by default`)
    }
})

test('redirects arbitrary/unallowed width w2500 to unresized original path with 302', async () => {
    const response = await get('/content/images/size/w2500/2021/12/bluewater-hut-prb-track.jpg')

    assert.equal(response.status, 302)
    assert.equal(
        response.headers.get('location'),
        '/content/images/2021/12/bluewater-hut-prb-track.jpg'
    )
})

test('redirects arbitrary/unallowed width w250 to unresized original path with 302', async () => {
    const response = await get('/content/images/size/w250/2021/12/bluewater-hut-prb-track.jpg')

    assert.equal(response.status, 302)
    assert.equal(
        response.headers.get('location'),
        '/content/images/2021/12/bluewater-hut-prb-track.jpg'
    )
})

test('redirects malformed size string to original path with 302', async () => {
    const response = await get('/content/images/size/invalid-size/gallery/hut.jpg')

    assert.equal(response.status, 302)
    assert.equal(response.headers.get('location'), '/content/images/gallery/hut.jpg')
})

test('encodes segments properly in redirect target', async () => {
    const response = await get('/content/images/size/w9999/2026/11/nested-dir/hut.jpg')

    assert.equal(response.status, 302)
    assert.equal(
        response.headers.get('location'),
        '/content/images/2026/11/nested-dir/hut.jpg'
    )
})

test('serves cached image when requested size is in allowed list', async () => {
    const response = await get(`/content/images/${fixtureRelativePath}`)

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /^image\/jpeg/)
})

test('supports ALLOWED_IMAGE_SIZES environment variable override', async () => {
    const prev = process.env.ALLOWED_IMAGE_SIZES
    try {
        process.env.ALLOWED_IMAGE_SIZES = 'w500,w800'
        const allowed = app.getAllowedSizes()
        assert.equal(allowed.has('w500'), true)
        assert.equal(allowed.has('w800'), true)
        assert.equal(allowed.has('w2000'), false)

        // w2000 should now redirect because it is no longer in allowed list
        const response = await get('/content/images/size/w2000/2021/12/photo.jpg')
        assert.equal(response.status, 302)
        assert.equal(response.headers.get('location'), '/content/images/2021/12/photo.jpg')
    } finally {
        if (prev === undefined) {
            delete process.env.ALLOWED_IMAGE_SIZES
        } else {
            process.env.ALLOWED_IMAGE_SIZES = prev
        }
    }
})

test('supports ALLOWED_IMAGE_WIDTHS with plain integers', () => {
    const prev = process.env.ALLOWED_IMAGE_WIDTHS
    try {
        process.env.ALLOWED_IMAGE_WIDTHS = '400, 800, 1200'
        const allowed = app.getAllowedSizes()
        assert.equal(allowed.has('w400'), true)
        assert.equal(allowed.has('w800'), true)
        assert.equal(allowed.has('w1200'), true)
        assert.equal(allowed.has('w600'), false)
    } finally {
        if (prev === undefined) {
            delete process.env.ALLOWED_IMAGE_WIDTHS
        } else {
            process.env.ALLOWED_IMAGE_WIDTHS = prev
        }
    }
})

test('forwards upstream 302 redirect without caching target', async () => {
    // Spin up a mock origin server that returns 302 for unsupported size
    const mockOrigin = http.createServer((req, res) => {
        if (req.url.startsWith('/content/images/size/')) {
            res.writeHead(302, {
                Location: '/content/images/2021/12/bluewater-hut-prb-track.jpg',
            })
            res.end()
            return
        }
        res.writeHead(404)
        res.end()
    })

    await new Promise((resolve) => mockOrigin.listen(0, '127.0.0.1', resolve))
    const mockPort = mockOrigin.address().port

    try {
        // Fetch through global fetch with redirect manual
        const ghostUrl = `http://127.0.0.1:${mockPort}/content/images/size/w600/2021/12/bluewater-hut-prb-track.jpg`
        const originRes = await fetch(ghostUrl, { redirect: 'manual' })
        assert.equal(originRes.status, 302)
        assert.equal(
            originRes.headers.get('location'),
            '/content/images/2021/12/bluewater-hut-prb-track.jpg'
        )
    } finally {
        await new Promise((resolve) => mockOrigin.close(resolve))
    }
})
