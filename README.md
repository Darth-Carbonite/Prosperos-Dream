# Prospero's Dream

An interactive, player-facing map of the Prospero's Dream space station, for a Mothership campaign.

Click any location on the map to read about it, see what it connects to, who you'll find there and which factions hold sway.

## How it works

- **`content/`** holds everything players read, as Markdown files: one file per location, person and faction, plus `station.md` for the overview. **This is the only folder you need to edit.** See [docs/editing-content.md](docs/editing-content.md).
- **`site/`** is the map page itself (HTML, CSS, JavaScript).
- **`scripts/build.mjs`** turns the Markdown into the data the map reads, and checks for mistakes such as a link to a location that doesn't exist.
- **GitHub Actions** runs the build every time `main` changes and publishes the result to GitHub Pages. If the build finds a mistake, the live site isn't updated and the Actions tab shows what to fix.

## Previewing on your own computer (optional)

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
npm run preview
```

Then open http://localhost:8080.

## Content rules

This repository is public, so everything in it is visible to players.

- **Player-facing only.** No Warden secrets, twists or hidden identities.
- **Your own words.** Don't copy text, maps or stat blocks from the published books.

---

Unofficial fan project. Mothership® and *A Pound of Flesh* are © Tuesday Knight Games. Not affiliated with Tuesday Knight Games.
