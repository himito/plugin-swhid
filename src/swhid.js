/**
 * Parsing of Software Heritage identifiers (SWHIDs).
 *
 * A SWHID is made of a core identifier and optional qualifiers:
 *
 *   swh:1:<object type>:<hash>[;<qualifier>=<value>]*
 *
 * e.g. `swh:1:rev:75a422b4275740aa2b18753e5264f048c2b0cb48;origin=https://github.com/citation-js/citation-js`
 *
 * @see https://www.swhid.org/specification/ for the full syntax
 *
 * @module swhid
 */

/**
 * Core identifier: scheme version 1, object type and 40-character SHA1 hash.
 * Object types are content (`cnt`), directory (`dir`), revision (`rev`),
 * release (`rel`) and snapshot (`snp`).
 */
const CORE = 'swh:1:(?:cnt|dir|rev|rel|snp):[0-9a-f]{40}'

/**
 * Optional qualifiers. Their values cannot contain `;`, which has to be
 * percent-encoded.
 * TODO: improve the regex to validate the qualifiers, e.g. `origin` must be a URL
 */
const QUALIFIERS = '(?:;(?:origin|visit|anchor|path|lines)=[^;]+)*'

/** Matches a SWHID, with or without qualifiers */
export const SWHID = new RegExp(`^${CORE}${QUALIFIERS}$`)

/**
 * Matches the URL of a SWHID on the Software Heritage archive. The SWHID is
 * captured in the first group.
 */
export const SWHID_URL = new RegExp(`^https?://archive\\.softwareheritage\\.org/(${CORE}${QUALIFIERS})/?$`)

/**
 * Split a SWHID into its parts. The input is assumed to be valid, see
 * {@link SWHID}.
 *
 * @param {string} swhid - SWHID, possibly with qualifiers
 * @return {Object} `{ core, type, hash, qualifiers }`, where `qualifiers`
 *   maps each qualifier name to its percent-decoded value
 *
 * @example
 * parseSwhid('swh:1:dir:b4eecafa9be2f2006ce1b709d6857b07069b4608;path=/src')
 * // {
 * //   core: 'swh:1:dir:b4eecafa9be2f2006ce1b709d6857b07069b4608',
 * //   type: 'dir',
 * //   hash: 'b4eecafa9be2f2006ce1b709d6857b07069b4608',
 * //   qualifiers: { path: '/src' }
 * // }
 */
export function parseSwhid(swhid) {
  const [core, ...qualifiers] = swhid.split(';')
  const [, , type, hash] = core.split(':')

  return {
    core,
    type,
    hash,
    qualifiers: Object.fromEntries(qualifiers.map(qualifier => {
      const index = qualifier.indexOf('=')
      return [qualifier.slice(0, index), decodeURIComponent(qualifier.slice(index + 1))]
    }))
  }
}

/**
 * Find the release or revision that best describes what the SWHID points to:
 * either the object itself, or its `anchor` qualifier. This is where the
 * version, date and author of the code can be found.
 *
 * @param {Object} swhid - parsed SWHID, see {@link parseSwhid}
 * @return {Object|null} parsed SWHID of the release or revision, without
 *   qualifiers, or `null` if there is none (e.g. a directory without anchor,
 *   or a snapshot)
 */
export function getAnchor({ core, type, qualifiers }) {
  if (type === 'rel' || type === 'rev') {
    return parseSwhid(core)
  }

  if (qualifiers.anchor) {
    const anchor = parseSwhid(qualifiers.anchor)
    if (anchor.type === 'rel' || anchor.type === 'rev') {
      return anchor
    }
  }

  return null
}
