# Abandoned but not Forgotten

A local NASA exhibit of discarded space hardware on the Moon and Mars —
every mission’s journey, its clickable machinery parts, and its final coordinates.

## What this folder is

A self-contained exhibit site:

- `index.html` — app shell, navigation, mission slides, SOS game, footage,
  narrator bar, and part popup.
- `assets/` — mission and planet-map images plus app icons.
- `css/` — `styles.css`, `game.css`, `footage.css`.
- `js/` — `data.js`, `manifest.js`, `vehicles.js`, `app.js`, `game.js`,
  `footage.js`, `narrator.js`.
- `manifest.webmanifest` + `sw.js` — installable-app / offline shell assets.

The exhibit is edited as local files and viewed through a local web server.

## Local preview

From the project folder:

```bash
cd "<this folder>"
python -m http.server 8080 --bind 127.0.0.1
```

Then open:

```
http://127.0.0.1:8080/index.html
```

If you edit `js/*.js` or `css/*.css`, restart the server or hard-reload the
browser with a cache-busting query (for example `?v=2`), because the browser
can otherwise keep serving a stale copy.

## What’s clickable

- **Mission timeline** — click a mission card to jump to its slide.
- **Journey phases** — on each mission slide, click the 5 phase tabs
  (Launch, Cruise, Arrival, On the surface, End of life) to update the
  phase card, vehicle diagram, and caption.
- **Vehicle parts** — click any highlighted part in the vehicle diagram or
  in the machinery manifest to read that part’s fate in the popup inspector.
- **6th strip — PICK OF THE JOURNEY** — each mission has a full-width panel
  after the machinery manifest with 5 picture cards, one per phase, in order.
  Clicking a card opens that mission’s slide and switches to that phase, so
  the picture and the phase stay in sync.

## 6th strip — picture choices

The strip picks a picture for each phase from `assets/` when the mission has
one that fits, otherwise it builds the matching vehicle diagram for that phase
(the diagrammatic structure of the vehicle at that point in the journey).

- **Launch** — real mission photo only for Apollo 11/12/17, where
  `assets/apollo11.jpg / apollo12.jpg / apollo17.jpg` shows the stack on the
  pad; otherwise the launch-vehicle diagram.
- **Cruise / Arrival** — the phase vehicle diagram when one exists; the mission
  photo only as a last fallback.
- **On the surface / End of life** — a real landed-hardware photo when the
  mission has one in `assets/`; otherwise the matching vehicle diagram.

Only images already in `assets/` are used.

## SOS mini-game

The `Stranded` section is a playable survival puzzle: pick a real landing site,
scavenge the mission’s abandoned hardware, and wire up a transmitter to reach
Earth. It runs on top of the same mission data and uses the browser’s speech
synthesis for narration.

## Gemini voice

The Gemini/Puter voice path has been removed from this exhibit. The narrator bar
still has pause, stop, and auto-toggle controls, and narration uses the browser’s
built-in speech synthesis. There is no “enable Gemini voice” button anymore.

## Clean tree

The project root contains only the exhibit files and `assets/`, `css/`, `js/`,
`tools/`, plus `manifest.webmanifest` and `sw.js`. Debug screenshots and
scratch files are not part of the exhibit.
