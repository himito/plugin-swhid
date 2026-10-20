# @citation-js/plugin-swhid

This plugin adds support for exporting references from a [Software Heritage](https://www.softwareheritage.org/) identifier ([SWHID](https://www.swhid.org/)).

## Install

```js
npm install @citation-js/plugin-swhid @citation-js/plugin-bibtex
```

Note: this plugin requires `@citation-js/plugin-bibtex`, so be sure to install that one as well if you have not already. It is automatically included in the `citation-js` package.

## Use

```js
import '@citation-js/plugin-swhid'
```

## Formats

Formats and other features added by this plugin.

### Input

#### SWHIDs

Create a reference from a SWHID, with or without qualifiers, or from its URL on the Software Heritage archive:

```js
import { Cite } from '@citation-js/core'
import '@citation-js/plugin-swhid'

const cite = await Cite.async('swh:1:rel:90582c5fcb6a3eb0d48826f3162ac91fd1109f06;origin=https://github.com/citation-js/citation-js')
cite.format('bibliography', { template: 'apa' })
// Willighagen, L. G. (2026). Citation.js: a format-independent, modular bibliography tool for the browser
// and command line (Version v0.9.0) [Computer software]. Software Heritage
// (swh:1:rel:90582c5fcb6a3eb0d48826f3162ac91fd1109f06;origin=https://github.com/citation-js/citation-js).
// https://doi.org/10.7717/peerj-cs.214
```

The reference is built from:

1. the [citation](https://archive.softwareheritage.org/api/1/raw-intrinsic-metadata/citation/swhid/doc/) that Software Heritage generates from the `codemeta.json` or `CITATION.cff` file of the archived code, if there is one;
2. the release or revision the SWHID points to, either directly or through its `anchor` qualifier, for the version, date and author.

When neither is available, a minimal reference with the SWHID is returned. The SWHID is always stored in `archive_location` (with `archive` set to `Software Heritage`) and in `custom.swhid`.

| Format | Input |
|---|---|
| `@swhid/id` | a SWHID, e.g. `swh:1:rev:75a422b4275740aa2b18753e5264f048c2b0cb48` |
| `@swhid/url` | an archive URL, e.g. `https://archive.softwareheritage.org/swh:1:rev:…` |
| `@swhid/record` | `{ swhid, citation?, release?, revision? }`, the API responses for a SWHID |



### Output

#### biblatex-software

Format references for [biblatex-software](https://ctan.org/pkg/biblatex-software), with the entry type that matches what the SWHID points to and a `swhid` field:

```js
cite.format('biblatex-software')
// @softwareversion{Willighagen2026Citation,
// 	author = {Willighagen, Lars G.},
// 	doi = {10.7717/peerj-cs.214},
// 	date = {2026-09-18},
// 	title = {Citation.js: a format-independent, modular bibliography tool for the browser and command line},
// 	url = {http://dx.doi.org/10.7717/peerj-cs.214},
// 	version = {v0.9.0},
// 	swhid = {swh:1:rel:90582c5fcb6a3eb0d48826f3162ac91fd1109f06;origin=https://github.com/citation-js/citation-js},
// }
```

| SWHID | Entry type |
|---|---|
| file (`cnt`) | `@codefragment` |
| directory (`dir`) with a `path` below the root | `@softwaremodule` |
| release (`rel`), revision (`rev`) or root directory (`dir`) | `@softwareversion` |
| snapshot (`snp`) | `@software` |

References without a SWHID are formatted as plain BibLaTeX.
