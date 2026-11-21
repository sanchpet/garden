// Blocks the stock js-yaml reads and the `yaml` library does not.
export const REJECTED = [
  "tags: [a,\nb]",
  "map: {a: 1,\nb: 2}",
  'description: "x\ny"',
  "description: 'x\ny'",
  'a: "b"#c',
  `${"k".repeat(1100)}: 1`,
  [
    "a: &a [x, x, x, x, x, x, x, x, x, x]",
    ...["b", "c", "d", "e"].map((key, i) => {
      const prev = "abcd"[i]
      return `${key}: &${key} [${Array(10).fill(`*${prev}`).join(", ")}]`
    }),
  ].join("\n"),
]
