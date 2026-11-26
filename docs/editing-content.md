# Editing the map's content

Everything players see comes from the Markdown files in `content/`. You can edit them right on github.com: open a file, click the pencil icon, make your change and commit. The site rebuilds itself within a minute or two.

Each file has two parts:

1. **A fields block** between two `---` lines at the top. These are short facts the map uses: names, links, positions. Spacing and punctuation matter here.
2. **The body** below it: ordinary Markdown prose. Write as much as you like.

The **file name is the entry's id**. Other files link to an entry by its id, so `the-stellar-burn.md` is linked as `the-stellar-burn`. Use lowercase letters, numbers and dashes only.

## Locations: `content/locations/`

```markdown
---
name: The Stellar Burn
number: 2
area: outer-ring
summary: The bar everyone ends up at. Drinks, rumors and R&R.
map: { x: 707, y: 205 }
connects_to: [the-chop-shop, canyonheavy-market]
factions: [teamsters]
---
A loud, crowded club stacked over several floors...
```

| Field | Required | What it does |
|---|---|---|
| `name` | yes | The name shown on the map and in the panel. |
| `number` | no | The number on the map marker. Locations are listed in this order. |
| `area` | yes | One of `outer-ring`, `ring-structures`, `center-spire`, `the-choke`. Places in `the-choke` are drawn in red. |
| `summary` | no | One line, shown in the hover tooltip and under the title. |
| `map` | yes | Marker position. The map is 1000 × 1000: `x` goes left to right, `y` goes top to bottom, and the center of the station is `{ x: 500, y: 500 }`. |
| `connects_to` | no | Ids of locations you can travel to directly. You only need to list a connection in **one** of the two files; it's shown on both. |
| `factions` | no | Ids of factions present here. |
| `inside` | no | Id of a larger location this one sits within (Doptown uses `inside: the-choke`). |

**The current map positions and connections are placeholders.** Adjust them to match your campaign's map.

## People: `content/people/`

```markdown
---
name: Sem
role: Bartender
location: the-stellar-burn
factions: []
---
Pours the drinks at The Stellar Burn and hears everything said over them.
```

`location` is where they're usually found. Leave it out if their whereabouts are unknown.

## Factions: `content/factions/`

```markdown
---
name: Tempest Company
summary: The mercenary company that serves as the station's security force.
base: tempest-co-hq
---
Elite, well-armed and expensive...
```

`base` is the faction's headquarters (optional). The map works out which locations a faction is present at, and who its members are, from the location and people files.

## Station overview: `content/station.md`

The text and stats shown before anyone clicks a location.

## When something goes wrong

If a file has a mistake, such as a typo in an id, a missing `name`, or bad spacing in the fields block, the build stops and **the live site keeps showing the last good version**. Open the repository's **Actions** tab, click the failed run, and the log lists each problem with the file it's in, for example:

```
content/people/sem.md: `location` lists "stellar-burn", but there is no location file named stellar-burn.md
```

## Remember

The repository is public. Keep everything player-facing and in your own words.
