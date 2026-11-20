import fs from "node:fs"

export type Channel = {
  chat: string
  // The chat name was never checked against Telegram; a send to it gets a warning.
  unverified?: boolean
}

export type Config = {
  // Relative to the build output. Only Russian by default: the channels are Russian, and
  // the English feed would announce every translation a second time.
  feeds: string[]
  // Must match SHARE_HOST in local-plugins/share.tsx, which cannot be imported outside the build.
  shareHost: string
  stateBranch: string
  stubTimeoutSeconds: number
  channels: Record<string, Channel>
}

export function loadConfig(file: string): Config {
  const config = JSON.parse(fs.readFileSync(file, "utf8")) as Config
  for (const key of ["feeds", "shareHost", "stateBranch", "stubTimeoutSeconds", "channels"]) {
    if (config[key as keyof Config] === undefined) throw new Error(`${file}: "${key}" is missing`)
  }
  return config
}
