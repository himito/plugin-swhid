import { plugins } from '@citation-js/core'
import '..'

const a = plugins.input.data('https://archive.softwareheritage.org/swh:1:rev:75a422b4275740aa2b18753e5264f048c2b0cb48', '@swhid/url')
const b = plugins.input.data({ swhid: 'swh:1:rev:75a422b4275740aa2b18753e5264f048c2b0cb48' }, '@swhid/record')

type Expect<T extends true> = T
type IsString<T> = T extends string ? true : false
type IsArray<T> = T extends unknown[] ? true : false

// @ts-ignore
type Tests = [
  Expect<IsString<typeof a>>,
  Expect<IsArray<typeof b>>
]
