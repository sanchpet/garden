# garden

The engine behind [sanch.pet](https://sanch.pet), a bilingual digital garden: posts, evergreen notes, a library, a tech radar and a race calendar. The texts live in [sanchpet/garden-texts](https://github.com/sanchpet/garden-texts); this repo turns them into the site.

## Layout

Built on [Quartz](https://github.com/jackyzha0/quartz) v5. The garden's own code:

- `quartz.config.yaml`, `quartz.ts`: which plugins run, in what order;
- `local-plugins/`: the garden's components and emitters (languages, note header, bookcase, radar, races, feeds, analytics);
- `scripts/`: self-hosting of third-party assets and the Telegram announcer;
- `DESIGN.md`, `PRODUCT.md`: the look and who it's for.

`quartz/` is the Quartz engine. A few core files carry the garden's own changes; the rest is as upstream left it.

## Running locally

```sh
mise install
npm ci
git clone https://github.com/sanchpet/garden-texts ../garden-texts
npx quartz build -d ../garden-texts --serve
```

Without the race feed at `races-feed/events.json` (branch `public` of [sanchpet/races](https://github.com/sanchpet/races)) the race calendar builds empty. Checks: `npm test`, `npm run check`.

## Publishing

A push to `main`, or a `repository_dispatch` from garden-texts, runs the Publish workflow: it builds the site, replaces CDN assets with self-hosted copies and force-pushes the result to the `public` branch as one commit. The server pulls that branch every minute.

## Upstream

Quartz changes come in as patches, not merges. `UPSTREAM` holds the last commit of `jackyzha0/quartz` (branch `v5`) that was reviewed. To see what is new since then:

```sh
git remote add upstream https://github.com/jackyzha0/quartz.git
git fetch upstream v5
git log --oneline "$(cat UPSTREAM)..upstream/v5"
```

Every Monday the Upstream watch workflow does this and keeps one issue labelled `upstream` with the list; it closes once `UPSTREAM` catches up.

Take what the garden needs with `git diff <from> <to> -- <paths> | git apply -3`, then move `UPSTREAM` to the commit you reviewed up to.

## Credits

Everything a reader meets on the site that comes from someone else is credited in the colophon, with a link to the original ([ru](https://sanch.pet/ru/colophon), [en](https://sanch.pet/en/colophon)).

Quartz is by Jacky Zhao and contributors, MIT licensed (`LICENSE.txt`).
