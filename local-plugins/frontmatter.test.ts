import test, { describe } from "node:test"
import assert from "node:assert"
import { frontmatterOf, isDraft } from "./frontmatter"

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
    assert.strictEqual(long.draft, true)
  })

  test("an empty block does not swallow the body up to the next rule", () => {
    const note = "---\n---\nBody: [[unclosed\n\tTabbed: {x\n\n---\nmore\n"
    assert.deepStrictEqual(frontmatterOf(note), {})
    assert.deepStrictEqual(frontmatterOf("---\ntype: post\n---\ndraft: true\n\n---\n"), {
      type: "post",
    })
  })

  test("a note without frontmatter, with broken YAML or with a list has none", () => {
    for (const note of ["", "Body\n---\ntype: x\n---\n", "----\ntype: x\n----\n", "---"]) {
      assert.deepStrictEqual(frontmatterOf(note), {})
    }
    assert.deepStrictEqual(frontmatterOf("---\nkey: [unclosed\n---\n"), {})
    assert.deepStrictEqual(frontmatterOf("---\n- a\n- b\n---\n"), {})
  })
})

describe("a draft, as the stock filter sees it", () => {
  const draft = (line: string) => isDraft(frontmatterOf(`---\n${line}\n---\n`))

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
