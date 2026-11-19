const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')

const app = require('../index.js')

let server
let baseUrl

before(async () => {
    await new Promise((resolve, reject) => {
        server = app.listen(0, '127.0.0.1', resolve)
        server.once('error', reject)
    })
    baseUrl = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
    await new Promise((resolve) => server.close(resolve))
})

function get(pathname, headers = {}) {
    return fetch(`${baseUrl}${pathname}`, {
        headers: { connection: 'close', ...headers },
    })
}

test('returns standard RateLimit headers', async () => {
    const response = await get('/')

    assert.equal(response.status, 200)
    assert.notEqual(response.headers.get('ratelimit-limit'), null)
    assert.notEqual(response.headers.get('ratelimit-remaining'), null)
    assert.notEqual(response.headers.get('ratelimit-reset'), null)
})

test('parses TRUST_PROXY configurations correctly', () => {
    assert.equal(app.parseTrustProxy(undefined), 1)
    assert.equal(app.parseTrustProxy(''), 1)
    assert.equal(app.parseTrustProxy('false'), false)
    assert.equal(app.parseTrustProxy('0'), false)
    assert.equal(app.parseTrustProxy('true'), true)
    assert.equal(app.parseTrustProxy('2'), 2)
    assert.equal(app.parseTrustProxy('127.0.0.1'), '127.0.0.1')
    assert.equal(app.parseTrustProxy('loopback, linklocal, uniquelocal'), 'loopback, linklocal, uniquelocal')
})
