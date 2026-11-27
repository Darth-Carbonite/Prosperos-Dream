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
placement: { angle: 228 }
module: block
connects_to: [the-farm]
factions: [teamsters]
---
A loud, crowded club stacked over several floors...
```

| Field | Required | What it does |
|---|---|---|
| `name` | yes | The name shown on the map and in the panel. |
| `number` | no | The number on the map marker. Locations are listed in this order. |
| `area` | yes | One of `outer-ring`, `spokes`, `hub`, `center-spire`, `the-choke`. Shown above the title; places in `the-choke` get amber hazard markers. |
| `summary` | no | One line, shown in the hover tooltip and under the title. |
| `placement` | yes | Where the location sits on the 3D map. See below. |
| `module` | no | The shape of the building drawn there: `block` (the default), `tower`, `cluster`, or `none`. |
| `connects_to` | no | Ids of locations you can travel to directly. You only need to list a connection in **one** of the two files; it's shown on both. |
| `factions` | no | Ids of factions present here. |
| `inside` | no | Id of a larger location this one sits within (Doptown uses `inside: the-choke`). |

### Placing a location on the map

`placement` takes up to three numbers:

- **`angle`**: where around the station, in degrees, as you look at the map. `0` is the front (nearest you), `90` the right, `180` the back, `270` the left.
- **`distance`** (optional, default `1`): how far out from the center. `1` puts it on the outer ring, `0.5` halfway along a spoke, and `0` at the center.
- **`level`** (optional, default `0`): only used at the center. `0` puts it on top of the central hub; a negative number puts it down the spire, from `-0.1` near the top to `-1` at the very bottom.

| Example | Where it ends up |
|---|---|
| `placement: { angle: 148 }` | On the ring, back-right (Tempest Co. HQ) |
| `placement: { angle: 64, distance: 0.55 }` | Partway along the right-front spoke (CANYONHEAVY.market) |
| `placement: { angle: 0, distance: 0 }` | On top of the central hub (The Court) |
| `placement: { angle: 0, distance: 0, level: -0.75 }` | Low on the spire (The Choke) |

Every location on the ring or a spoke gets a spoke drawn to it automatically. Locations on the spire don't get a building; instead each one owns a section of the spire around its level, split halfway between neighboring spire locations, and that section lights up when it's selected. Each module's exact shape is generated from the file name, so it stays the same every time; renaming the file gives it a new shape.

The positions follow the station illustration in *A Pound of Flesh*. The connections between locations are placeholders; adjust them to suit your campaign.

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

## Links to a specific entry

Every location, person and faction has its own link you can send to players: add `#the-court` (a location's id), `#person-sem` or `#faction-tempest-co` to the end of the site's address.

## Station overview: `content/station.md`

The text and stats shown before anyone clicks a location.

## When something goes wrong

If a file has a mistake, such as a typo in an id, a missing `name`, or bad spacing in the fields block, the build stops and **the live site keeps showing the last good version**. Open the repository's **Actions** tab, click the failed run, and the log lists each problem with the file it's in, for example:

```
content/people/sem.md: `location` lists "stellar-burn", but there is no location file named stellar-burn.md
```

## Remember

The repository is public. Keep everything player-facing and in your own words.
