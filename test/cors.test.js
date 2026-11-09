const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const app = require('../index.js')

const allowedOrigin = 'https://wanderstories.space'
const foreignOrigin = 'https://example.com'

// Served from content/images, which is gitignored. Created and removed by the
// suite so the image route can be exercised without shipping a fixture.
const fixtureRelativePath = '__test__/watermark-fixture.jpg'
const fixturePath = path.join(
    __dirname,
    '..',
    'content',
    'images',
    fixtureRelativePath
)
const fixtureDir = path.dirname(fixturePath)

let server
let baseUrl

function get(pathname, headers = {}) {
    return fetch(`${baseUrl}${pathname}`, { headers })
}

before(async () => {
    await fs.promises.mkdir(fixtureDir, { recursive: true })
    await sharp({
        create: {
            width: 40,
            height: 40,
            channels: 3,
            background: '#336699',
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

test('serves requests without an Origin header', async () => {
    const response = await get('/')

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('reports the running version on the root page', async () => {
    const response = await get('/')

    assert.equal(response.status, 200)
    const body = await response.text()
    assert.equal(body, `Wanderstories Image Watermarker v${require('../package.json').version}`)
})

test('sets CORS headers for allowlisted origins', async () => {
    const response = await get('/', { Origin: allowedOrigin })

    assert.equal(response.status, 200)
    assert.equal(
        response.headers.get('access-control-allow-origin'),
        allowedOrigin
    )
    assert.equal(
        response.headers.get('access-control-allow-credentials'),
        'true'
    )
})

// Regression: the origin callback used to throw for unknown origins, which
// Express turned into a 500 before the route ran. CORS is browser-enforced,
// so the request must still succeed without Access-Control-Allow-* headers.
test('does not fail requests from unknown origins', async () => {
    const response = await get('/', { Origin: foreignOrigin })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('does not fail requests with a null origin', async () => {
    const response = await get('/', { Origin: 'null' })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('serves images to unknown origins instead of returning 500', async () => {
    const response = await get(`/content/images/${fixtureRelativePath}`, {
        Origin: foreignOrigin,
    })

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /^image\/jpeg/)
    assert.equal(response.headers.get('access-control-allow-origin'), null)
})

test('serves images to allowlisted origins with CORS headers', async () => {
    const response = await get(`/content/images/${fixtureRelativePath}`, {
        Origin: allowedOrigin,
    })

    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /^image\/jpeg/)
    assert.equal(
        response.headers.get('access-control-allow-origin'),
        allowedOrigin
    )
})

// Regression: a cache directory that is not writable (e.g. a bind-mounted
// volume owned by another user) must not turn the request into a 500. The
// processed image is served from memory instead.
test('serves the processed image from memory when the cache dir is not writable', async (t) => {
    const realRelPath = 'size/w2000/2026/11/crystal-creek-lower-waterfall.jpg'
    const realAbsDir = path.join(
        __dirname,
        '..',
        'content',
        'images',
        'size',
        'w2000',
        '2026',
        '11'
    )

    let networkOk = false
    try {
        const probe = await fetch(
            'https://wanderstories.space/content/images/size/w2000/2026/11/crystal-creek-lower-waterfall.jpg'
        )
        networkOk = probe.ok
    } catch {}
    if (!networkOk) {
        t.skip('origin image not reachable')
        return
    }

    await fs.promises.mkdir(realAbsDir, { recursive: true })
    const cachedFile = path.join(realAbsDir, 'crystal-creek-lower-waterfall.jpg')
    await fs.promises.rm(cachedFile, { force: true })

    const originalMode = (await fs.promises.stat(realAbsDir)).mode & 0o777
    await fs.promises.chmod(realAbsDir, 0o555)
    try {
        const response = await get(`/content/images/${realRelPath}`, {
            Origin: foreignOrigin,
        })
        assert.equal(response.status, 200)
        assert.match(response.headers.get('content-type') ?? '', /^image\/jpeg/)
    } finally {
        await fs.promises.chmod(realAbsDir, originalMode || 0o755)
        await fs.promises.rm(cachedFile, { force: true })
        await fs.promises.rm(
            path.join(__dirname, '..', 'content', 'images', 'size'),
            { recursive: true, force: true }
        )
    }
})
