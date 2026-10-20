import { CSL } from '@citation-js/core'

interface SwhPerson {
  fullname: string
  name: string | null
  email: string | null
}

interface SwhCitation {
  format: string
  content: string
  source_swhid: string
  source_url: string
  error: string | null
  warning: string | null
}

interface SwhRelease {
  id: string
  name: string
  message: string | null
  author: SwhPerson | null
  date: string | null
  target: string
  target_type: string
}

interface SwhRevision {
  id: string
  message: string | null
  author: SwhPerson | null
  date: string | null
  committer: SwhPerson | null
  committer_date: string | null
  directory: string
}

interface SwhidRecord {
  swhid: string
  citation?: SwhCitation
  release?: SwhRelease
  revision?: SwhRevision
}

declare module '@citation-js/core' {
  namespace plugins {
    namespace input {
      interface Formats {
        '@swhid/id': (input: string) => SwhidRecord
        '@swhid/url': (input: string) => string
        '@swhid/record': (input: SwhidRecord) => CSL[]
      }
    }
    namespace output {
      interface Formats {
        'biblatex-software': (options?: object) => string
      }
    }
  }
}
