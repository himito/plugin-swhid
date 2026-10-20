import { plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'

import { ref, formats as input } from './input.js'
import { formats as output } from './output.js'

plugins.add(ref, { input, output })
