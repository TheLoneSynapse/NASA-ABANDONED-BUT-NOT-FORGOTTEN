# Abandoned but not Forgotten

A local exhibit of NASA hardware left behind on the Moon and Mars — each
mission’s journey, its clickable parts, and its final coordinates.

This folder is a static website. It is edited as regular files and viewed
through a local web server.

## Folder layout

- `index.html` — the whole exhibit: pages, mission slides, SOS game, video
  section, narrator bar, part popup, and navigation.
- `assets/` — images used by the exhibit: mission photos, planet maps, and
  app icons. Add a new image here first if you want to use it on a page.
- `css/` — stylesheets: `styles.css`, `game.css`, `footage.css`.
- `js/` — scripts: `data.js`, `manifest.js`, `vehicles.js`, `app.js`,
  `game.js`, `footage.js`, `narrator.js`.
- `manifest.webmanifest` — app install info.
- `sw.js` — service worker for offline use.
- `tools/` — helper scripts for the project.

Files at the top level that are not folders: `index.html`,
`manifest.webmanifest`, `sw.js`. Nothing else should be at the top level.

## Where the content lives

Most of the exhibit content is in `js/data.js`. That is where missions,
phases, parts, coordinates, facts, and machinery manifests are edited.

- To change a mission’s name, year, subtitle, launch vehicle, status,
  coordinates, notes, facts, or parts, edit the mission object in
  `js/data.js`.
- To change a mission’s phases (label, date, title, body, diagram, focus),
  edit the `phases` array for that mission in `js/data.js`.
- To add a new real photo for a mission, put the image in `assets/` and
  point the mission’s `photo` field at it in `js/data.js`.

Do not edit `js/app.js`, `js/game.js`, `js/footage.js`, or `js/narrator.js`
unless you know what you are changing there. Those files are the exhibit’s
behavior, not its content.

## How to preview locally

From the folder that contains `index.html`:

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Then open:

```
http://127.0.0.1:8080/index.html
```

The exhibit only runs this way over HTTP. It does not run by double-clicking
`index.html` from a folder.

## How to hard-refresh after edits

After editing a file, the browser may keep showing the old version.

To force a fresh load:

- Hard-refresh the page.
- Or add a cache-busting query to the URL, for example:
  `http://127.0.0.1:8080/index.html?v=2`

If you change `js/*.js` or `css/*.css`, the exhibit may keep serving the old
copy until the browser is hard-refreshed or the page is opened with a new
query string. If something looks stale, hard-refresh first.

If the local server is already running and you change a file, it will usually
serve the new file on the next request. But the browser cache can still show
the old version, so hard-refresh.

## Editing content without breaking the exhibit

- Keep image paths relative to the folder, like `assets/name.jpg`.
- Only reference images that actually exist in `assets/`.
- If a mission has no real photo for a phase, the exhibit will use a vehicle
  diagram for that phase instead.
- The 6th strip on each mission shows one picture per phase, in order, and
  clicking a picture opens that mission’s slide and switches to that phase.
- The SOS section is a mini-game built from the same mission data.

## Short checklist before sharing or deploying

- Open the local preview and a few mission slides. Confirm the 5 journey
  phases, the vehicle diagrams, the maps, and the machinery manifest open and
  read normally.
- Open the 6th strip on one photo mission and one no-photo mission. Confirm
  the pictures are what you expect and that clicking them switches the phase.
- Open the SOS section. Confirm the site list and the game start.
- Confirm no file is missing: images in `assets/`, stylesheets in `css/`,
  scripts in `js/`, `manifest.webmanifest`, `sw.js`, `index.html`.
- Confirm no debug files, screenshots, or scratch files are sitting at the
  top level.
- If you changed behavior code in `js/`, confirm it still runs without errors
  in the local preview.
- If you publish it somewhere, hard-refresh once on the published page and
  confirm it looks the same as the local preview.

## Plain notes

- This folder is meant to be edited as files, not as a program to install or
  run as an app beyond the local web preview.
- The exhibit uses a local web server because it loads files over HTTP.
- The service worker (`sw.js`) is for offline use. If you do not want offline
  behavior, treat it as part of the normal static files and do not worry about
  it for basic editing and preview.
