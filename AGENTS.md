# Notes for agents

- The look is specified in `DESIGN.md`; read the section you touch before changing anything a reader sees.
- Upstream Quartz comes in as patches only, never as a merge (README, Upstream).
- Before a PR: `npm test`, `npm run check` and a local build with the texts (README, Running locally).
- Credit what you bring in. A change that adds a technique, an open-source component, a library, a font or a borrowed idea that readers meet on the site also adds it to the colophon in [sanchpet/garden-texts](https://github.com/sanchpet/garden-texts) (`ru/colophon.md` and `en/colophon.md`): what it is and a link to the original or its source (a repository or page where its author can be seen; name the author in the text only when the link doesn't show them). The change is not done without that line. Build tooling a reader never meets stays out.
- Links in the texts are written the way Obsidian writes them, since the texts are edited in a vault where they sit under `50-garden/`: a bare name when it is unique, the path from the vault root (`[[50-garden/ru/stream]]`) when it is not. The build drops that prefix (`local-plugins/vault-paths.ts`); a link from the texts' root (`[[ru/stream]]`) works on the site but not in Obsidian.
- What the site itself says around the texts lives in `<lang>/site.md` of the texts, one `## key` section per text (`## feed`, `## language`), never in frontmatter; a new text is a new section, not a new file. The build keeps the file out of the pages (`quartz.config.yaml`) and reads it in `local-plugins/site-texts.ts`.
