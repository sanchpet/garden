import fs from "node:fs"
import { mergeJournals, parseJournal, serializeJournal, type Journal } from "./journal"

export const JOURNAL_FILE = "posted.json"

export type Store = {
  // undefined: there is no journal yet.
  load(): Promise<Journal | undefined>
  save(journal: Journal, subject: string): Promise<void>
}

// Runs git with the given arguments and standard input, returns its output, throws on failure.
export type Git = (args: string[], input?: string) => string

const PUSH_ATTEMPTS = 3

// The journal is the only file on its branch. Commits are made with plumbing, so neither the
// work tree nor the index of the checkout the script runs in is touched.
export function gitStore(git: Git, remote: string, branch: string): Store {
  const ref = `refs/heads/${branch}`
  let tip: string | undefined

  // A failed ls-remote throws rather than reading as "no branch", which would seed the journal anew.
  const fetchJournal = (): Journal | undefined => {
    tip = undefined
    if (!git(["ls-remote", remote, ref]).trim()) return undefined
    git(["fetch", "--quiet", "--no-tags", remote, ref])
    tip = git(["rev-parse", "FETCH_HEAD"]).trim()
    if (!git(["ls-tree", tip, JOURNAL_FILE]).trim()) return undefined
    return parseJournal(git(["show", `${tip}:${JOURNAL_FILE}`]))
  }

  return {
    async load() {
      return fetchJournal()
    },
    async save(journal, subject) {
      for (let attempt = 1; ; attempt++) {
        const blob = git(["hash-object", "-w", "--stdin"], serializeJournal(journal)).trim()
        const tree = git(["mktree"], `100644 blob ${blob}\t${JOURNAL_FILE}\n`).trim()
        const parent = tip ? ["-p", tip] : []
        const commit = git(["commit-tree", tree, ...parent, "-m", subject]).trim()
        try {
          git(["push", "--quiet", remote, `${commit}:${ref}`])
          tip = commit
          return
        } catch (error) {
          if (attempt === PUSH_ATTEMPTS) throw error
          // The branch moved under us: put our records on top of what is there now.
          const theirs = fetchJournal()
          if (theirs) journal = mergeJournals(theirs, journal)
        }
      }
    },
  }
}

export function fileStore(file: string): Store {
  return {
    async load() {
      return fs.existsSync(file) ? parseJournal(fs.readFileSync(file, "utf8")) : undefined
    },
    async save(journal) {
      fs.writeFileSync(file, serializeJournal(journal))
    },
  }
}
