/**
 * Input formats for Software Heritage identifiers (SWHIDs).
 *
 * A SWHID (or its archive URL) is resolved in two steps:
 *
 *   1. `@swhid/id` fetches a record `{ swhid, citation?, release?, revision? }`
 *      from the Software Heritage API.
 *   2. `@swhid/record` translates that record to CSL-JSON, without any
 *      network access.
 *
 * @module input
 */

import { plugins, util } from '@citation-js/core'
import { parse as parseDate } from '@citation-js/date'
import { parse as parseName } from '@citation-js/name'

import { SWHID, SWHID_URL, parseSwhid, getAnchor } from './swhid.js'

/** Software Heritage instance used for the API and for archive links */
const HOST = 'https://archive.softwareheritage.org'

/** DOI resolver prefix that Software Heritage sometimes includes in `doi` fields */
const DOI_PREFIX = /^https?:\/\/(dx\.)?doi\.org\//i

/**
 * Call the Software Heritage API.
 *
 * @param {string} path - API path after `/api/1`, e.g. `/release/<hash>/`
 * @return {Promise<Object>} parsed JSON response
 * @throws {Error} when the server answers with a status code >= 400; the
 *   status code is available as `error.status`
 */
async function api(path) {
  const headers = { accept: 'application/json' }
  return JSON.parse(await util.fetchFileAsync(`${HOST}/api/1${path}`, { headers }))
}

/**
 * Fetch the BibTeX citation that Software Heritage generates from the
 * `codemeta.json` or `CITATION.cff` file of the archived code.
 *
 * The API answers 404 when the archived code has no such file, and 400 when
 * no root directory can be found for the SWHID (e.g. a content SWHID without
 * an `anchor` qualifier). Both cases are not errors for this plugin, as the
 * reference can still be built from other metadata.
 *
 * @see https://docs.softwareheritage.org/devel/architecture/citation.html
 *   for how Software Heritage generates citations
 *
 * @param {string} swhid - SWHID, possibly with qualifiers
 * @return {Promise<Object|undefined>} the API response, with the BibTeX
 *   entry in `content`, or `undefined` if no citation is available
 * @throws {Error} on any other API error
 */
async function fetchCitation(swhid) {
  try {
    return await api(`/raw-intrinsic-metadata/citation/swhid/?citation_format=bibtex&target_swhid=${encodeURIComponent(swhid)}`)
  } catch (error) {
    if (error.status === 404 || error.status === 400) {
      return undefined
    }
    throw error
  }
}

/**
 * Fetch the release or revision that a SWHID points to.
 *
 * @param {Object|null} anchor - parsed SWHID of a release or revision, see
 *   {@link getAnchor}
 * @return {Promise<Object|undefined>} the release or revision from the API,
 *   or `undefined` if there is no anchor
 * @throws {Error} if the release or revision is not archived
 */
async function fetchAnchor(anchor) {
  if (!anchor) {
    return undefined
  }
  return api(`/${anchor.type === 'rel' ? 'release' : 'revision'}/${anchor.hash}/`)
}

/**
 * Collect everything needed to cite a SWHID.
 *
 * The citation and the release or revision the SWHID points to (directly or
 * through its `anchor` qualifier) are fetched in parallel. If neither is
 * available, the SWHID is resolved to make sure the object is archived.
 *
 * @param {string} swhid - SWHID, possibly with qualifiers
 * @return {Promise<Object>} record `{ swhid, citation?, release?, revision? }`
 * @throws {Error} if the object, or its anchor, is not archived
 */
async function fetchRecord(swhid) {
  // parse the SWHID to get the core and the anchor (if any) without fetching from the API
  const parsed = parseSwhid(swhid)

  // the anchor is needed to fetch the release or revision, so it is computed
  const anchor = getAnchor(parsed)

  const [citation, object] = await Promise.all([
    fetchCitation(swhid),
    fetchAnchor(anchor)
  ])

  const record = { swhid }
  if (citation) {
    record.citation = citation
  }
  if (anchor) {
    record[anchor.type === 'rel' ? 'release' : 'revision'] = object
  } else if (!citation) {
    // throws if the object is not archived
    await api(`/resolve/${parsed.core}/`)
  }

  return record
}

/**
 * Convert a Software Heritage person (release or revision author) to a list
 * of CSL names.
 *
 * @param {Object|null} person - `{ fullname, name, email }`
 * @return {Array<Object>|undefined} list with one CSL name, or `undefined`
 *   if the person has no name
 */
function parsePerson(person) {
  return person && (person.name || person.fullname) ? [parseName(person.name || person.fullname)] : undefined
}

/**
 * Pick a title for code without a metadata file: the repository name from
 * the `origin` qualifier, or else the core SWHID itself.
 *
 * @param {Object} swhid - parsed SWHID, see {@link parseSwhid}
 * @return {string} title
 *
 * @example
 * getTitle(parseSwhid('swh:1:rev:…;origin=https://github.com/octocat/Hello-World.git'))
 * // 'Hello-World'
 */
function getTitle({ core, qualifiers }) {
  if (qualifiers.origin) {
    const name = qualifiers.origin.replace(/(\.git)?\/*$/, '').split('/').pop()
    if (name) {
      return name
    }
  }
  return core
}

/**
 * Get the author, date and version of a release or revision.
 *
 * Only releases have a `name`, which is used as version (e.g. `v1.0.0`).
 *
 * @param {Object} [object] - release or revision from the API
 * @return {Object} partial CSL item; missing fields are `undefined`
 */
function parseObject(object) {
  if (!object) {
    return {}
  }

  const date = object.date && parseDate(object.date)
  return {
    author: parsePerson(object.author),
    issued: date && date['date-parts'] ? date : undefined,
    version: object.name
  }
}

/**
 * Translate the BibTeX citation generated by Software Heritage to CSL with
 * `@citation-js/plugin-bibtex`, fixing what that translation gets wrong.
 *
 * - The entry type (`@softwareversion`, from biblatex-software) is unknown
 *   to plugin-bibtex and becomes `document`, so it is removed here and set
 *   to `software` by {@link parseRecord}.
 * - The `doi` field may contain a resolver URL instead of a bare DOI.
 *
 * @param {Object} [citation] - API response from {@link fetchCitation}
 * @return {Object} partial CSL item
 */
function parseCitation(citation) {
  if (!citation || !citation.content) {
    return {}
  }

  const [item] = plugins.input.chain(citation.content, { forceType: '@biblatex/text', generateGraph: false })
  if (!item) {
    return {}
  }

  // @softwareversion is not known to plugin-bibtex
  delete item.type
  if (item.DOI) {
    item.DOI = item.DOI.replace(DOI_PREFIX, '')
  }
  return item
}

/**
 * Translate a record to CSL-JSON.
 *
 * Fields are merged in increasing order of priority: defaults derived from
 * the SWHID, then the release or revision, then the citation. The SWHID is
 * always stored in `archive_location` and `custom.swhid`, and the archive
 * link is used as `URL` if there is no other.
 *
 * @param {Object} record - `{ swhid, citation?, release?, revision? }`
 * @return {Array<Object>} list with one CSL item
 */
function parseRecord(record) {
  const swhid = parseSwhid(record.swhid)

  const item = {
    id: `swh-${swhid.type}-${swhid.hash.slice(0, 7)}`,
    type: 'software',
    title: getTitle(swhid),
    ...parseObject(record.release || record.revision),
    ...parseCitation(record.citation),
    archive: 'Software Heritage',
    archive_location: record.swhid,
    custom: { swhid: record.swhid }
  }

  item.URL = item.URL || `${HOST}/${record.swhid}`

  for (const key in item) {
    if (item[key] === undefined) {
      delete item[key]
    }
  }

  return [item]
}

/** Plugin name, used to register it with `plugins.add` */
export const ref = '@swhid'

/**
 * Input formats registered by this plugin.
 *
 * - `@swhid/id`: a SWHID string → record (async, uses the API)
 * - `@swhid/url`: an archive URL → SWHID string
 * - `@swhid/record`: a record → CSL-JSON
 */
export const formats = {
  // fetch from API
  '@swhid/id': {
    parseAsync: fetchRecord,
    parseType: {
      dataType: 'String',
      predicate: SWHID
    }
  },

  '@swhid/url': {
    parse(url) {
      // the last qualifier would otherwise include the trailing slash
      return url.match(SWHID_URL)[1].replace(/\/$/, '')
    },
    parseType: {
      dataType: 'String',
      predicate: SWHID_URL,
      extends: '@else/url'
    }
  },

  // translate to CSL-JSON
  '@swhid/record': {
    parse: parseRecord,
    parseType: {
      dataType: 'SimpleObject',
      propertyConstraint: {
        props: 'swhid',
        value: swhid => typeof swhid === 'string' && SWHID.test(swhid)
      }
    }
  }
}
