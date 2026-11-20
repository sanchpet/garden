import { execFileSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import type { Git } from "../store"

// A bare repository stands in for GitHub, and a clone of it for the checkout on the runner.
export function sandbox(t: { after(fn: () => void): void }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "announce-"))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const remote = path.join(root, "remote.git")
  const identity = ["-c", "user.name=test", "-c", "user.email=test@example.invalid"]
  const at =
    (cwd: string): Git =>
    (args, input) =>
      execFileSync("git", [...identity, ...args], { cwd, input, encoding: "utf8", stdio: "pipe" })
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote])
  const clone = (name: string) => {
    const dir = path.join(root, name)
    execFileSync("git", ["clone", "-q", remote, dir], { stdio: "pipe" })
    return at(dir)
  }
  const first = clone("first")
  first(["commit", "-q", "--allow-empty", "-m", "site"])
  first(["push", "-q", "origin", "HEAD:main"])
  return { remote: at(remote), remotePath: remote, first, clone }
}
