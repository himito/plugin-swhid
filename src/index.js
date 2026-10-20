import { plugins } from '@citation-js/core'
import '@citation-js/plugin-bibtex'

import { ref, formats as input } from './input.js'
plugins.add(ref, { input })
