import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

import { plugins } from '@citation-js/core'
import '../src/index.js'

/**
 * Load a saved Software Heritage API response, so that tests of
 * `@swhid/record` run without network access.
 *
 * Fixtures are stored in `test/fixtures/<name>.json` and were fetched from
 * the API as is, e.g. `/api/1/release/<hash>/` for `release.json`.
 *
 * @param {string} name - file name of the fixture, without `.json`
 * @return {Object} parsed JSON response
 */
function fixture (name) {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
}

const REV = 'swh:1:rev:75a422b4275740aa2b18753e5264f048c2b0cb48'
const REL = 'swh:1:rel:90582c5fcb6a3eb0d48826f3162ac91fd1109f06;origin=https://github.com/citation-js/citation-js'
const HELLO = 'swh:1:rev:7fd1a60b01f91b314f59955a4e4d4e80d8edf11d;origin=https://github.com/octocat/Hello-World'
const DIR = 'swh:1:dir:b4eecafa9be2f2006ce1b709d6857b07069b4608'

// Expected CSL fields shared by the Citation.js tests (see `fixtures/citation.json`);
// each test adds the fields that depend on the SWHID.
const citationJs = {
  type: 'software',
  title: 'Citation.js: a format-independent, modular bibliography tool for the browser and command line',
  author: [{ given: 'Lars G.', family: 'Willighagen' }],
  DOI: '10.7717/peerj-cs.214',
  URL: 'http://dx.doi.org/10.7717/peerj-cs.214',
  archive: 'Software Heritage'
}

const recordTests = [
  {
    name: 'citation and revision',
    input: { swhid: REV, citation: fixture('citation'), revision: fixture('revision-citation-js') },
    output: {
      ...citationJs,
      id: 'swh-rev-75a422b',
      'citation-key': 'swh-rev-75a422b',
      issued: { 'date-parts': [[2026, 9, 18]] },
      archive_location: REV,
      custom: { swhid: REV }
    }
  },
  {
    name: 'citation and release',
    input: { swhid: REL, citation: fixture('citation'), release: fixture('release') },
    output: {
      ...citationJs,
      id: 'swh-rev-75a422b',
      'citation-key': 'swh-rev-75a422b',
      issued: { 'date-parts': [[2026, 9, 18]] },
      version: 'v0.9.0',
      archive_location: REL,
      custom: { swhid: REL }
    }
  },
  {
    name: 'revision without metadata file',
    input: { swhid: HELLO, revision: fixture('revision') },
    output: {
      id: 'swh-rev-7fd1a60',
      type: 'software',
      title: 'Hello-World',
      author: [{ given: 'The', family: 'Octocat' }],
      issued: { 'date-parts': [[2012, 3, 6]] },
      URL: `https://archive.softwareheritage.org/${HELLO}`,
      archive: 'Software Heritage',
      archive_location: HELLO,
      custom: { swhid: HELLO }
    }
  },
  {
    name: 'bare SWHID',
    input: { swhid: DIR },
    output: {
      id: 'swh-dir-b4eecaf',
      type: 'software',
      title: DIR,
      URL: `https://archive.softwareheritage.org/${DIR}`,
      archive: 'Software Heritage',
      archive_location: DIR,
      custom: { swhid: DIR }
    }
  }
]

const apiTests = [
  {
    name: 'release with metadata file',
    input: REL,
    output: recordTests[1].output
  },
  {
    name: 'revision without metadata file',
    input: HELLO,
    output: recordTests[2].output
  },
  {
    name: 'archive URL',
    input: `https://archive.softwareheritage.org/${DIR}/`,
    output: recordTests[3].output
  }
]

describe('swhid', function () {
  describe('type', function () {
    it('recognises SWHIDs', function () {
      assert.strictEqual(plugins.input.type(REV), '@swhid/id')
      assert.strictEqual(plugins.input.type(REL), '@swhid/id')
      assert.strictEqual(plugins.input.type(`${DIR};origin=https://github.com/octocat/Hello-World;path=/README`), '@swhid/id')
    })

    it('recognises archive URLs', function () {
      assert.strictEqual(plugins.input.type(`https://archive.softwareheritage.org/${REL}`), '@swhid/url')
    })

    it('rejects malformed SWHIDs', function () {
      assert.notStrictEqual(plugins.input.type('swh:1:foo:75a422b4275740aa2b18753e5264f048c2b0cb48'), '@swhid/id')
      assert.notStrictEqual(plugins.input.type('swh:1:rev:75a422b'), '@swhid/id')
      assert.notStrictEqual(plugins.input.type(`${REV};foo=bar`), '@swhid/id')
    })

    it('recognises records', function () {
      assert.strictEqual(plugins.input.type({ swhid: REV }), '@swhid/record')
      assert.notStrictEqual(plugins.input.type({ swhid: 'foo' }), '@swhid/record')
    })
  })

  describe('url', function () {
    it('extracts the SWHID', function () {
      assert.strictEqual(plugins.input.data(`https://archive.softwareheritage.org/${REL}/`, '@swhid/url'), REL)
    })
  })

  describe('record', function () {
    for (const { name, input, output } of recordTests) {
      it(name, function () {
        assert.deepStrictEqual(plugins.input.chain(input, { generateGraph: false }), [output])
      })
    }
  })

  describe('api', function () {
    for (const { name, input, output } of apiTests) {
      it(name, { timeout: 10000 }, async function () {
        const [item] = await plugins.input.chainAsync(input, { generateGraph: false })
        // the date of an archived revision is fixed, but the metadata file may change
        assert.strictEqual(item.type, output.type)
        assert.strictEqual(item.archive_location, output.archive_location)
        assert.deepStrictEqual(item.custom, output.custom)
        assert.ok(item.title)
      })
    }

    it('fails for unknown objects', { timeout: 10000 }, async function () {
      await assert.rejects(
        plugins.input.chainAsync('swh:1:dir:0000000000000000000000000000000000000001'),
        { status: 404 }
      )
    })
  })
})
