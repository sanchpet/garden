import test, { describe } from "node:test"
import assert from "node:assert"
import { frontmatterOf, isDraft } from "./frontmatter"
import { REJECTED } from "./frontmatter.fixtures"

describe("the frontmatter of a note", () => {
  test("the YAML between the opening rule and the first line that begins with one", () => {
    assert.deepStrictEqual(frontmatterOf("---\ntype: book\nyear: 2015\n---\n\nBody: text\n"), {
      type: "book",
      year: 2015,
    })
    assert.deepStrictEqual(frontmatterOf("---\r\ntype: book\r\n---\r\nBody\r\n"), { type: "book" })
    assert.deepStrictEqual(frontmatterOf("---\ntype: book\n---"), { type: "book" })
  })

  test("a byte order mark and a long block do not hide it", () => {
    assert.deepStrictEqual(frontmatterOf("﻿---\ndraft: true\n---\n"), { draft: true })
    const long = frontmatterOf(`---\nnote: ${"x".repeat(5000)}\ndraft: true\n---\nBody\n`)
    assert.strictEqual(long?.draft, true)
  })

  test("an empty block does not swallow the body up to the next rule", () => {
    const note = "---\n---\nBody: [[unclosed\n\tTabbed: {x\n\n---\nmore\n"
    assert.deepStrictEqual(frontmatterOf(note), {})
    assert.deepStrictEqual(frontmatterOf("---\ntype: post\n---\ndraft: true\n\n---\n"), {
      type: "post",
    })
  })

  test("a note without frontmatter, or with a list for one, has an empty one", () => {
    for (const note of ["", "Body\n---\ntype: x\n---\n", "----\ntype: x\n----\n", "---"]) {
      assert.deepStrictEqual(frontmatterOf(note), {})
    }
    assert.deepStrictEqual(frontmatterOf("---\n- a\n- b\n---\n"), {})
  })

  test("the file is trimmed first, as the build trims it", () => {
    for (const lead of ["\n", " ", "\u00a0", "\r\n", "\ufeff\n", "\t\n\n"]) {
      assert.deepStrictEqual(frontmatterOf(`${lead}---\ndraft: true\n---\nBody\n`), {
        draft: true,
      })
    }
  })

  test("a YAML or JSON tag after the opening rule is read; another language is unreadable", () => {
    assert.deepStrictEqual(frontmatterOf("---yaml\ndraft: true\n---\n"), { draft: true })
    assert.deepStrictEqual(frontmatterOf('---json\n{ "draft": true }\n---\n'), { draft: true })
    assert.deepStrictEqual(frontmatterOf("--- \ndraft: true\n---\n"), { draft: true })
    assert.strictEqual(frontmatterOf("---toml\ndraft = true\n---\n"), undefined)
    assert.strictEqual(frontmatterOf("---js\nmodule.exports = {}\n---\n"), undefined)
  })

  test("YAML this parser rejects is unreadable, not empty", () => {
    for (const block of REJECTED) {
      assert.strictEqual(frontmatterOf(`---\ndraft: true\n${block}\n---\nBody\n`), undefined)
    }
    assert.strictEqual(frontmatterOf("---\nkey: [unclosed\n---\n"), undefined)
    assert.strictEqual(frontmatterOf("---\nkey: [unclosed\n"), undefined)
  })

  test("parsing prints nothing, whatever the block says", (t) => {
    const out: unknown[] = []
    for (const stream of [process.stdout, process.stderr]) {
      t.mock.method(stream, "write", (chunk: unknown) => out.push(chunk))
    }
    for (const method of ["log", "warn", "error"] as const) {
      t.mock.method(console, method, (...args: unknown[]) => out.push(args))
    }
    t.mock.method(process, "emitWarning", (warning: unknown) => out.push(warning))
    const fm = frontmatterOf("---\n::error::pwned: !foo bar\ndraft: true\n---\n")
    t.mock.restoreAll()
    assert.deepStrictEqual(out, [])
    assert.strictEqual(fm?.draft, true)
  })
})

describe("a draft, as the stock filter sees it", () => {
  const draft = (line: string) => isDraft(frontmatterOf(`---\n${line}\n---\n`) ?? {})

  test("the boolean in any YAML spelling and the string `true`", () => {
    for (const line of [
      "draft: true",
      "draft: True",
      "draft: TRUE",
      "draft: 'true'",
      'draft: "true"',
      "draft: true # not yet",
    ]) {
      assert.strictEqual(draft(line), true, line)
    }
  })

  test("anything else is published", () => {
    for (const line of [
      "draft: false",
      "draft: yes",
      'draft: "True"',
      "draft: 1",
      "draft:",
      "title: x",
      "drafts: true",
    ]) {
      assert.strictEqual(draft(line), false, line)
    }
  })
})
