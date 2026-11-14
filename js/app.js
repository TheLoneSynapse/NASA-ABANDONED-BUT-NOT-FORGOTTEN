/* =========================================================================
   app.js — renders the timeline, mission slides, diagrams, maps & nav
   ========================================================================= */

/* ------------------------------------------------------------- utilities */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const lonNorm = (lon) => (lon > 180 ? lon - 360 : lon);
const fmtLat = (lat) => `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
const fmtLon = (lon) => {
  const n = lonNorm(lon);
  return `${Math.abs(n).toFixed(4)}° ${n >= 0 ? "E" : "W"}`;
};
const projX = (lon) => Math.min(98, Math.max(2, ((lonNorm(lon) + 180) / 360) * 100));
const projY = (lat) => ((90 - lat) / 180) * 100;

const STATUS_CLASS = { gone: "gone", crash: "crash", live: "live" };

/* --------------------------------------------------- diagram part lookup */
function partsFor(mission, kind) {
  const v = VEHICLES[kind];
  if (!v) return [];
  const extras = (mission.extraParts || []).map((p) => [p.id, p]);
  const base = v.parts.map((p) => [p.id, p]);
  return [...base, ...extras].map(([id, p]) => ({
    ...p,
    fate: (mission.fates && mission.fates[id]) || p.fate || null
  }));
}

/* every piece of machinery a mission owns — diagram parts, shared extras
   (orbiters, experiment stations), and mission-specific add-ons */
function allPartsFor(mission) {
  const seen = new Map();
  (typeof EXTRA_PARTS !== "undefined" ? EXTRA_PARTS : []).forEach((p) =>
    seen.set(p.id, { ...p, fate: (mission.fates && mission.fates[p.id]) || null })
  );
  const kinds = [...new Set(mission.phases.map((p) => p.diagram))];
  kinds.forEach((k) =>
    partsFor(mission, k).forEach((p) => {
      if (!seen.has(p.id)) seen.set(p.id, { ...p, source: VEHICLES[k]?.label });
    })
  );
  return [...seen.values()];
}

/* ----------------------------------------------------------- mission list */
const sortedMissions = [...MISSIONS].sort((a, b) => a.year - b.year);

/* ------------------------------------------------------------- timeline */
function renderTimeline() {
  const track = $("#timelineTrack");
  track.innerHTML = sortedMissions
    .map((m, i) => {
      const kind = m.target === "moon" ? "moon" : "mars";
      return `
      <button class="t-card target-${kind}" data-jump="${m.id}">
        <div class="t-year">${m.year}</div>
        <div class="t-name">${m.name}</div>
        <div class="t-sub">${m.subtitle}</div>
        <div class="t-foot">
          <span class="chip mini ${kind}">${kind.toUpperCase()}</span>
          <span class="t-num">${String(i + 1).padStart(2, "0")}</span>
        </div>
      </button>`;
    })
    .join("");

  /* drag to scroll */
  let down = false, startX = 0, startL = 0, moved = false;
  track.addEventListener("pointerdown", (e) => {
    down = true; moved = false;
    startX = e.clientX; startL = track.scrollLeft;
    track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    track.scrollLeft = startL - dx;
  });
  const up = () => { down = false; };
  track.addEventListener("pointerup", up);
  track.addEventListener("pointercancel", up);
  /* a drag must not activate the card under the cursor on release —
     stopPropagation (not just preventDefault) so the document-level
     delegated [data-jump] handler never sees the click */
  track.addEventListener("click", (e) => {
    if (moved) { e.preventDefault(); e.stopPropagation(); }
  }, true);
  /* vertical wheel over the track scrolls it sideways — but once the
     track reaches either end, let the wheel scroll the page again so
     the section can never trap the visitor's scroll */
  track.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; /* native horizontal */
    const max = track.scrollWidth - track.clientWidth;
    /* scroll-snap parks the track at the first card (padding-left), never
       at 0 — so "at start" must include that resting position, otherwise
       wheel-up at the left edge is swallowed forever */
    const startEdge = (parseFloat(getComputedStyle(track).paddingLeft) || 0) + 1;
    const atStart = track.scrollLeft <= startEdge;
    const atEnd = track.scrollLeft >= max - 1;
    if ((e.deltaY < 0 && atStart) || (e.deltaY > 0 && atEnd)) return;
    track.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

/* ------------------------------------------------ mission side boxes */
function missionSides(m) {
  const kind = m.target === "moon" ? "moon" : "mars";
  const planetMap = `assets/${kind}-map.jpg`;
  const missionPhoto = m.photo || null;

  /* Build a compact list of the real machines/objects this mission flew or
     left behind — one box per "side": launch vehicle, spacecraft/lander/rover,
     descent hardware, satellite/helicopter, impactor, etc. */
  const sides = [];
  const added = new Set();

  function add(side) {
    if (added.has(side.key)) return;
    added.add(side.key);
    sides.push(side);
  }

  /* Launch vehicle / the ship that gets to the pad and leaves it */
  if (m.launchVehicle) {
    let label = m.launchVehicle;
    let note = "The rocket that sent this mission toward its target.";
    let img = missionPhoto || planetMap;
    if (/Saturn V/i.test(m.launchVehicle)) {
      label = "Saturn V — the Moon rocket";
      note = "Five F-1 engines, three stages, one stack on the pad.";
    } else if (/Titan/i.test(m.launchVehicle)) {
      label = "Titan IIIE–Centaur — the rocket";
      note = "The launch vehicle that lifted Viking off Earth.";
    } else if (/Delta II/i.test(m.launchVehicle)) {
      label = "Delta II — the rocket";
      note = "The launch vehicle for these Mars missions.";
    } else if (/Atlas V/i.test(m.launchVehicle)) {
      label = "Atlas V — the rocket";
      note = "The launch vehicle for this mission.";
    } else if (/Atlas.Centaur/i.test(m.launchVehicle)) {
      label = "Atlas–Centaur — the rocket";
      note = "The launch vehicle that lifted Surveyor 1.";
    }
    add({ key: "launch", eyebrow: "LAUNCH VEHICLE", name: label, note, img });
  }

  /* Collect which vehicle diagrams this mission uses */
  const diagramKinds = [...new Set(m.phases.map((p) => p.diagram))];

  /* Moon missions: show the Lunar Module as its own side when the mission
     used one (Apollo landings). */
  if (diagramKinds.includes("lm") && m.target === "moon") {
    let label = "Lunar Module";
    let note = "The spacecraft that landed on the Moon — and the part that did not come home.";
    if (/Apollo 11/i.test(m.name)) { label = 'LM \"Eagle\"'; }
    if (/Apollo 12/i.test(m.name)) { label = 'LM \"Intrepid\"'; }
    if (/Apollo 14/i.test(m.name)) { label = 'LM \"Antares\"'; }
    if (/Apollo 15/i.test(m.name)) { label = 'LM \"Falcon\" + lunar rover'; }
    if (/Apollo 16/i.test(m.name)) { label = 'LM \"Orion\" + lunar rover'; }
    if (/Apollo 17/i.test(m.name)) { label = 'LM \"Challenger\" + lunar rover'; }
    add({
      key: "lm",
      eyebrow: "SPACECRAFT — LUNAR MODULE",
      name: label,
      note,
      img: missionPhoto || planetMap
    });
  }

  /* Mars lander missions: show the lander itself */
  if (diagramKinds.includes("marsLander")) {
    let label = "Mars Lander";
    let note = "The spacecraft that landed on Mars.";
    if (/Viking 1/i.test(m.name)) { label = "Viking 1 Lander"; note = "The first successful U.S. landing on Mars, on Chryse Planitia."; }
    if (/Phoenix/i.test(m.name)) { label = "Phoenix Lander"; note = "The first landing in Mars' northern arctic."; }
    if (/InSight/i.test(m.name)) { label = "InSight Lander"; note = "The lander that listened to Mars' heartbeat."; }
    if (/Mars Polar Lander/i.test(m.name)) { label = "Mars Polar Lander"; note = "Lost during descent, December 1999 — no wreckage ever found."; }
    add({ key: "lander", eyebrow: "SPACECRAFT — LANDER", name: label, note, img: missionPhoto || planetMap });
  }

  /* Airbag landers / Pathfinder-class: show the lander + rover side */
  if (diagramKinds.includes("airbagEDL")) {
    let label = "Lander + Rover";
    let note = "Airbag landing and the little rover that rode inside.";
    if (/Mars Pathfinder/i.test(m.name)) { label = "Mars Pathfinder + Sojourner"; note = "A tetrahedron of airbags, a petal lander, and the first Mars rover."; }
    if (/Spirit/i.test(m.name)) { label = "Spirit + petal lander"; note = "The rover that refused to die, inside an airbag cocoon."; }
    if (/Opportunity/i.test(m.name)) { label = "Opportunity + petal lander"; note = "90 sols that turned into 14 years."; }
    add({ key: "airbag", eyebrow: "SPACECRAFT — AIRBAG LANDER", name: label, note, img: missionPhoto || planetMap });
  }

  /* Sky-crane rover missions: show rover + helicopter where relevant */
  if (diagramKinds.includes("roverEDL")) {
    let label = "Rover + descent hardware";
    let note = "The rover and the bits dropped on the way down.";
    if (/Perseverance/i.test(m.name)) {
      label = "Perseverance + Ingenuity";
      note = "The rover, the sky crane, the parachute, the heat shield — and a little helicopter.";
    }
    add({ key: "rover", eyebrow: "SPACECRAFT — ROVER", name: label, note, img: missionPhoto || planetMap });
  }

  /* Surveyor: show the robotic scout itself */
  if (diagramKinds.includes("surveyor")) {
    add({
      key: "surveyor",
      eyebrow: "SPACECRAFT — SURVEYOR",
      name: "Surveyor 1",
      note: "America's first soft landing — a tripod of camera, engine and legs.",
      img: missionPhoto || planetMap
    });
  }

  /* Impact missions: the spent stage / crater side */
  if (diagramKinds.includes("impact")) {
    add({
      key: "impact",
      eyebrow: "IMPACTOR / CRATER",
      name: "The discarded stage that became an experiment",
      note: "A spent rocket stage deliberately crashed into the Moon — and the crater it left.",
      img: missionPhoto || planetMap
    });
  }

  /* If the mission left a dedicated rover picture that is not already the
     only spacecraft side, add an explicit rover side for missions that carried
     one (Apollo 15/16/17). */
  if (/Apollo (15|16|17)/i.test(m.name)) {
    add({
      key: "rover-" + m.id,
      eyebrow: "MACHINE — LUNAR ROVER",
      name: "Lunar Roving Vehicle",
      note: "The electric car left on the Moon — parked so its camera could film liftoff.",
      img: missionPhoto || planetMap
    });
  }

  /* Decorate each side with a real picture selector.
     - real mission photo first (the spacecraft / landed hardware / scene we have)
     - otherwise the planet map, used as a live geographic picture of where it is
     - never an invented image */
  return sides.map((s) => ({
    ...s,
    img: s.img ||
      (missionPhoto ||
        (diagramKinds.includes("marsRocket") ? "assets/mars-map.jpg" : planetMap))
  }));
}

/* ----------------------------------------------- pick-of-the-journey strip */
function journeyPickStrip(m) {
  const kind = m.target === "moon" ? "moon" : "mars";
  const planetMap = `assets/${kind}-map.jpg`;
  const missionPhoto = m.photo || null;

  /* Real surface/lander/rover photos the exhibit actually has in assets/.
     These are reused for the "On the surface" and "End of life" cards where
     they belong, and for the Launch card only when the photo is one of the
     iconic Apollo stack/journey pictures (apollo11/12/17.jpg). */
  const SURFACE_PHOTOS = /apollo1[127]\.jpg$|viking\.jpg|pathfinder\.jpg|opportunity\.jpg|spirit\.jpg|perseverance\.jpg|insight\.jpg|phoenix\.jpg|mpl\.png/i;
  const isApolloStackPhoto =
    missionPhoto && /apollo1[127]\.jpg$/i.test(missionPhoto) &&
    /Apollo (11|12|17)/i.test(m.name);

  /* Pick the picture for one journey phase: prefer a real photo when the phase
     is one that a real mission photo clearly belongs to, otherwise the matching
     vehicle diagram for that phase, otherwise the planet map. Only images that
     already exist in assets/ are used. */
  function diagramForPhase(p) {
    if (p.diagram) return p.diagram;
    const prefs = [
      "lm", "marsLander", "roverEDL", "airbagEDL", "surveyor", "impact", "marsRocket", "saturnV"
    ];
    const candidates = m.phases.map((pp) => pp.diagram).filter(Boolean);
    const preferred = candidates.find((d) => prefs.includes(d));
    return preferred || candidates[0] || null;
  }

  function diagramCaption(p, v) {
    if (!v) return p.label;
    const n = v.label.toLowerCase();
    if (p.label === "Launch") return `The ${n} that sent ${m.name} toward its target.`;
    if (p.label === "Cruise") return `Cruising toward the target — the ${n} in flight.`;
    if (p.label === "Arrival") return `Arrival — the ${n} hitting the target.`;
    if (p.label === "On the surface") return `On the surface — the ${n}.`;
    if (p.label === "End of life") return `End of life — the ${n} today.`;
    /* other phase labels (for example Braking, Touchdown, Stripped Down) get
       a caption that still names the vehicle but follows the phase, not the
       end-of-life line. */
    return `${p.label} — the ${n}.`;
  }

  function pictureFor(p) {
    /* Launch: real mission photo only for the iconic Apollo stack photos,
       because those photos show the stack on the pad rather than a separate
       vehicle beside an astronaut. */
    if (p.label === "Launch" && isApolloStackPhoto) {
      return { photoSrc: missionPhoto, caption: "The stack on the pad — the journey begins." };
    }

    /* On the surface / End of life: when the mission actually has a clean
       landed-hardware photo in assets/, use it for those two phases only.
       Every other phase, and every mission without such a photo, uses the
       vehicle diagram so a missing picture never becomes a repeated photo. */
    if ((p.label === "On the surface" || p.label === "End of life") &&
        SURFACE_PHOTOS.test(missionPhoto)) {
      const caption =
        p.label === "On the surface"
          ? "On the surface — the machine that stayed."
          : "End of life — what was left behind.";
      return { photoSrc: missionPhoto, caption };
    }

    const diagramId = diagramForPhase(p);
    if (diagramId) {
      const v = VEHICLES[diagramId];
      const hide = (m.hide && m.hide[diagramId]) || [];
      const focus = p.focus || null;
      return {
        diagramHTML: buildDiagram(diagramId, focus, hide),
        caption: diagramCaption(p, v)
      };
    }
    if (p.label === "Launch") {
      return { photoSrc: planetMap, caption: "The launch that started the journey." };
    }
    return { photoSrc: planetMap, caption: p.label };
  }

  const cards = m.phases.map((p, i) => {
    const phaseNum = i + 1;
    const { photoSrc, diagramHTML, caption } = pictureFor(p);
    return `
      <button class="jp-card" data-jp-mission="${m.id}" data-jp-phase="${i}" type="button">
        <div class="jp-photo">
          ${photoSrc
            ? `<div class="jp-img" style="background-image:url('${photoSrc}')"></div>`
            : diagramHTML
              ? `<div class="jp-svg">${diagramHTML}</div>`
              : `<div class="jp-img" style="background-image:url('${planetMap}')"></div>`}
          <div class="jp-overlay"></div>
          <div class="jp-phase-badge">${String(phaseNum).padStart(2, "0")} / 5</div>
        </div>
        <div class="jp-label">
          <div class="jp-phase">${p.label}</div>
          <div class="jp-dates">${p.date}</div>
          <div class="jp-title">${p.title}</div>
          <div class="jp-caption">${caption}</div>
        </div>
      </button>`;
  }).join("");

  return `
  <div class="panel p-journey-strip">
    <div class="p-title">PICK OF THE JOURNEY <span>${m.name} — from 1 to 5, live pictures</span></div>
    <div class="journey-strip">${cards}</div>
  </div>`;
}

/* ------------------------------------------------------- mission slides */
function missionHTML(m, idx) {
  const kind = m.target === "moon" ? "moon" : "mars";
  const x = projX(m.coords.lon).toFixed(2);
  const y = projY(m.coords.lat).toFixed(2);
  const photoStyle = m.photo
    ? `style="background-image:url('${m.photo}')"`
    : `style="background-image:url('assets/${kind}-map.jpg');background-size:cover;filter:saturate(.4)"`;

  const steps = m.phases
    .map((p, i) => `
      <button class="step" data-phase="${i}" role="tab">
        <span class="step-n">${String(i + 1).padStart(2, "0")}</span>
        <span class="step-l">${p.label}</span>
      </button>`)
    .join("");

  const facts = m.facts.map((f) => `<li>${f}</li>`).join("");

  const chips = (m.manifest || [])
    .map(
      (c) => `
      <button class="mchip" data-mission="${m.id}" data-chip="${c.p}">
        <i class="tag-${c.t}"></i><span>${c.n}</span>
      </button>`
    )
    .join("");

  const sides = missionSides(m);
  const sidesHTML = sides
    .map(
      (s) => `
      <div class="side-box">
        <div class="side-photo" style="background-image:url('${s.img}')"></div>
        <div class="side-body">
          <div class="side-eyebrow">${s.eyebrow}</div>
          <div class="side-name">${s.name}</div>
          <div class="side-note">${s.note}</div>
        </div>
      </div>`
    )
    .join("");

  const planetMap = m.photo
    ? null
    : `assets/${kind}-map.jpg`;

  return `
  <section class="mission" id="m-${m.id}" data-nav="${m.name}" data-target="${kind}">
    <div class="mission-photo" ${photoStyle}></div>
    <div class="mission-scrim"></div>
    <div class="mission-inner">
      <header class="m-head">
        <div class="m-idx">MISSION <b>${String(idx + 1).padStart(2, "0")}</b> / ${MISSIONS.length}</div>
        <h2>${m.name}<span class="m-sub">${m.subtitle}</span></h2>
        <div class="m-badges">
          <span class="chip ${kind}">${kind.toUpperCase()}</span>
          <span class="chip status ${STATUS_CLASS[m.statusKind]}">${m.status}</span>
          <span class="chip">${m.launchVehicle}</span>
          <button class="story-btn" data-story="${m.id}">▶ tell the story</button>
        </div>
      </header>

      <div class="m-grid">
        <div class="panel p-journey">
          <div class="p-title">THE JOURNEY <span>pick a phase</span></div>
          <div class="stepper" role="tablist">${steps}</div>
          <div class="phase-card" data-mission="${m.id}">
            <button class="narrate-btn" data-narrate="${m.id}">▶ listen</button>
            <div class="phase-date"></div>
            <h4 class="phase-title"></h4>
            <p class="phase-body"></p>
          </div>
          <div class="p-title mt">FIELD NOTES</div>
          <ul class="facts">${facts}</ul>
        </div>

        <div class="panel p-veh">
          <div class="p-title">VEHICLE ANATOMY <span>click any part</span></div>
          <div class="veh-stage" data-mission="${m.id}"></div>
          <div class="veh-caption" data-mission="${m.id}"></div>
        </div>

        <div class="panel p-site">
          <div class="p-title">FINAL RESTING PLACE</div>
          <div class="map-box" data-target="${kind}">
            <img src="assets/${kind}-map.jpg" alt="${kind} map" />
            <div class="map-grid" aria-hidden="true"></div>
            <div class="site-marker" data-lat="${m.coords.lat}" data-lon="${m.coords.lon}" style="left:${x}%;top:${y}%">
              <span class="pin"></span><span class="ring"></span>
            </div>
          </div>
          <div class="coords">
            <span class="c-lat">${fmtLat(m.coords.lat)}</span>
            <span class="c-lon">${fmtLon(m.coords.lon)}</span>
          </div>
          <div class="site-region">${m.coords.region}</div>
          <p class="site-note">${m.coords.note}</p>
          <div class="end-state ${STATUS_CLASS[m.statusKind]}">
            <span>END STATE</span>${m.status}
          </div>
        </div>
      </div>

      <div class="panel p-manifest">
        <div class="p-title">MACHINERY MANIFEST <span>${(m.manifest || []).length} pieces — click any</span></div>
        <div class="mchips">${chips}</div>
      </div>

      <div class="panel p-sides">
        <div class="p-title">EVERY MISSION SIDE <span>the machines, satellites, ships, landers, rovers & debris — live pictures</span></div>
        <div class="sides-grid">${sidesHTML}</div>
      </div>

      ${journeyPickStrip(m)}

      <div class="m-foot">
        <button class="m-nav" data-jump-idx="${idx - 1}" ${idx === 0 ? "disabled" : ""}>← previous</button>
        <div class="m-title-mini">${m.name} · ${m.subtitle}</div>
        <button class="m-nav" data-jump-idx="${idx + 1}" ${idx === sortedMissions.length - 1 ? "disabled" : ""}>next →</button>
      </div>
    </div>
  </section>`;
}

function renderMissions() {
  $("#missions").innerHTML = sortedMissions.map(missionHTML).join("");
}

/* -------------------------------------------------------- phase rendering */
const phaseState = new Map();

function showPhase(missionId, idx) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return;
  phaseState.set(missionId, idx);
  $("#partPop").hidden = true; /* part context changed */
  /* a manual phase change hands control to the narrator (auto mode) */
  if (window.Narrator && !Narrator.internal && Narrator.onManualPhase)
    Narrator.onManualPhase(missionId);

  const section = $("#m-" + missionId);
  const phase = m.phases[idx];

  /* stepper state */
  $$(".stepper .step", section).forEach((b) =>
    b.classList.toggle("active", +b.dataset.phase === idx)
  );

  /* phase card */
  const card = $(".phase-card", section);
  card.classList.remove("swap");
  void card.offsetWidth; /* restart animation */
  $(".phase-date", card).textContent = phase.date;
  $(".phase-title", card).textContent = phase.title;
  $(".phase-body", card).textContent = phase.body;
  card.classList.add("swap");

  /* diagram */
  const stage = $(".veh-stage", section);
  stage.innerHTML = buildDiagram(
    phase.diagram,
    phase.focus,
    (m.hide && m.hide[phase.diagram]) || []
  );
  stage.classList.remove("swap");
  void stage.offsetWidth;
  stage.classList.add("swap");

  const cap = $(".veh-caption", section);
  const v = VEHICLES[phase.diagram];
  cap.innerHTML = v
    ? `<b>${v.label}</b> — highlighted parts belong to this phase. Click any part to read its fate.`
    : "";
}

/* ------------------------------------------------------------ part popup */
function openPartPopup(missionId, partId) {
  const m = MISSIONS.find((x) => x.id === missionId);
  if (!m) return;
  const all = allPartsFor(m);
  const part = all.find((p) => p.id === partId);
  if (!part) return;

  const source =
    part.source ||
    (EXTRA_PARTS.find((e) => e.id === partId) || {}).label ||
    "Machinery";
  $("#partPop").dataset.target = m.target;
  $("#partPopKicker").textContent = `${m.name} · ${source}`;
  $("#partPopName").textContent = part.name;
  $("#partPopDesc").textContent = part.desc +
    (part.size ? ` (${part.size})` : "");
  $("#partPopFate").textContent =
    part.fate || "Not individually tracked — see this mission's end-of-life phase for the vehicle's overall fate.";
  $("#partPop").hidden = false;
  $("#partPop").classList.remove("pop-in");
  void $("#partPop").offsetWidth;
  $("#partPop").classList.add("pop-in");
}
$("#partPopClose").addEventListener("click", () => { $("#partPop").hidden = true; });
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#partPop").hidden = true;
});

/* ---------------------------------------------------------- graveyard map */
function renderGraveyard() {
  [["moon", "#moonGraveMap"], ["mars", "#marsGraveMap"]].forEach(([kind, sel]) => {
    const box = $(sel + " .map-markers");
    const list = sortedMissions.filter((m) => m.target === kind);
    $(kind === "moon" ? "#moonCount" : "#marsCount").textContent = `${list.length} SITES`;
    box.innerHTML = list
      .map((m) => `
        <button class="grave-marker status-${m.statusKind}"
                style="left:${projX(m.coords.lon)}%;top:${projY(m.coords.lat)}%"
                data-lat="${m.coords.lat}" data-lon="${m.coords.lon}"
                data-jump="${m.id}" title="${m.name} — ${m.coords.region}">
          <span></span>
        </button>`)
      .join("");
  });
}

/* --------------------------------------------- live coordinate crosshair */
/* A latitude/longitude cross that follows the cursor over any map, with a
   readout of the exact coords under the pointer. The mission maps use
   object-fit:cover, so the math undoes the center-crop first — the readout
   always matches the imagery beneath the cursor, even on narrow screens. */

/* Place a marker at its true geographic pixel, undoing object-fit:cover the
   same way the crosshair does — so hovering a marker reads back exactly the
   coordinate printed on its card. Runs on load, image load, and resize. */
function placeMarkers(box) {
  const img = box.querySelector("img");
  if (!img || !img.naturalWidth) return;
  const r = box.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const nw = img.naturalWidth, nh = img.naturalHeight;
  const s = Math.max(r.width / nw, r.height / nh);
  const ox = (r.width - nw * s) / 2;
  const oy = (r.height - nh * s) / 2;
  $$('[data-lat]', box).forEach((el) => {
    const lat = +el.dataset.lat, lon = +el.dataset.lon;
    const fx = (lonNorm(lon) + 180) / 360;
    const fy = (90 - lat) / 180;
    const x = ox + fx * nw * s;
    const y = oy + fy * nh * s;
    el.style.left = (x / r.width) * 100 + "%";
    el.style.top = (y / r.height) * 100 + "%";
  });
}

function placeAllMarkers() {
  $$(".map-box, .planet-map").forEach(placeMarkers);
}

function wireMapCross() {
  const HUD = `
    <div class="map-cross" aria-hidden="true">
      <i class="mx-v"></i><i class="mx-h"></i><i class="mx-dot"></i>
      <b class="mx-read"></b>
    </div>`;

  $$(".map-box, .planet-map").forEach((box) => {
    const img = box.querySelector("img");
    if (!img) return;
    box.insertAdjacentHTML("beforeend", HUD);
    const hud = box.lastElementChild;
    const v = $(".mx-v", hud), h = $(".mx-h", hud);
    const dot = $(".mx-dot", hud), read = $(".mx-read", hud);

    const move = (e) => {
      const r = box.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;

      /* inverse equirectangular, corrected for object-fit:cover */
      const nw = img.naturalWidth || 1024;
      const nh = img.naturalHeight || 512;
      const s = Math.max(r.width / nw, r.height / nh);
      const ox = (r.width - nw * s) / 2;
      const oy = (r.height - nh * s) / 2;
      const fx = Math.min(1, Math.max(0, (cx - ox) / (nw * s)));
      const fy = Math.min(1, Math.max(0, (cy - oy) / (nh * s)));
      const lat = 90 - fy * 180;
      const lon = fx * 360 - 180;

      v.style.left = cx + "px";
      h.style.top = cy + "px";
      dot.style.left = cx + "px";
      dot.style.top = cy + "px";
      read.textContent = `${fmtLat(lat)}  ·  ${fmtLon(lon)}`;

      /* flip the chip inward near the right/bottom edges */
      const flipX = cx > r.width - 200;
      const flipY = cy > r.height - 46;
      read.style.left = (flipX ? cx - 14 : cx + 14) + "px";
      read.style.top = (flipY ? cy - 12 : cy + 12) + "px";
      read.style.transform = `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`;
    };

    box.addEventListener("pointerenter", () => hud.classList.add("on"));
    box.addEventListener("pointermove", move);
    box.addEventListener("pointerleave", () => hud.classList.remove("on"));

    /* place markers once the image knows its size, and re-place on resize */
    const img2 = box.querySelector("img");
    if (img2 && !img2.complete) img2.addEventListener("load", () => placeMarkers(box), { once: true });
    placeMarkers(box);
  });

  let rz;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(placeAllMarkers, 150);
  });
}
/* Programmatic jump: keep auto-narration's own sentence-scroll dark while
   the page is flying — a fixed timer can't outlive a 48,000px smooth
   scroll, so the lock re-extends on every scroll event and expires once
   scrolling goes quiet. */
function lockScroll(ms) {
  const until = () => { window.__scrollLock = performance.now() + ms; };
  until();
  const onScroll = () => until();
  window.addEventListener("scroll", onScroll, { passive: true });
  setTimeout(() => window.removeEventListener("scroll", onScroll), ms + 8000);
}

/* --------------------------------------------------- app tab bar state */
/* which bottom tab owns which section — keeps the tab bar lit in step with
   the rail's IntersectionObserver as you scroll */
const TAB_FOR = [
  ["home", (id) => id === "hero" || id === "intro"],
  ["missions", (id) => id === "timeline" || id.startsWith("m-")],
  ["maps", (id) => id === "graveyard"],
  ["sos", (id) => id === "stranded"],
  ["video", (id) => id === "footage"],
  ["credits", (id) => id === "foot"],
];
function syncTab(section) {
  const hit = TAB_FOR.find(([, owns]) => owns(section.id || ""));
  if (!hit) return;
  $$("#tabbar .tab").forEach((t) => t.classList.toggle("on", t.dataset.tab === hit[0]));
}

function renderRail() {
  const secs = $$("[data-nav]");
  $("#rail").innerHTML = secs
    .map((s, i) => `<button class="rail-dot" data-idx="${i}" title="${s.dataset.nav}"><i></i><em>${s.dataset.nav}</em></button>`)
    .join("");
  $("#rail").addEventListener("click", (e) => {
    const b = e.target.closest(".rail-dot");
    if (!b) return;
    /* stop any playing narration — its sentence-scroll would pull the page
       back once the lock expires — then lock auto-narration's own
       scroll-into-view while the jump flies */
    if (window.Narrator) Narrator.stop();
    lockScroll(1400);
    secs[+b.dataset.idx].scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* A section is "current" when it crosses a thin band near the top-centre
     of the viewport. A bare threshold (e.g. 0.45) never fires for mission
     sections that are 3× taller than the window, so use a rootMargin band. */
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          const i = secs.indexOf(en.target);
          $$("#rail .rail-dot").forEach((d, di) => d.classList.toggle("on", di === i));
          syncTab(en.target);
        }
      });
    },
    { rootMargin: "-42% 0px -52% 0px", threshold: 0 }
  );
  secs.forEach((s) => io.observe(s));
}

function renderProgress() {
  const bar = $("#progressBar");
  const upd = () => {
    const h = document.documentElement;
    const p = h.scrollTop / (h.scrollHeight - h.clientHeight || 1);
    bar.style.width = `${Math.min(100, p * 100).toFixed(2)}%`;
  };
  document.addEventListener("scroll", upd, { passive: true });
  upd();
}

/* -------------------------------------------------------------- starfield */
function starfield() {
  const c = $("#starfield");
  if (!c) return;
  const ctx = c.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  let W = 0, H = 0;
  let stars = [], meteors = [], nebulae = [];
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let scrollY = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  /* stellar colour temperatures — blue-white, warm white, blue, amber, red-giant */
  const HUES = [
    [214, 226, 255], [255, 246, 232], [180, 202, 255],
    [255, 212, 121], [255, 178, 150]
  ];

  function build() {
    W = innerWidth; H = innerHeight;
    c.width = W * DPR; c.height = H * DPR;
    c.style.width = W + "px"; c.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    /* three parallax depths of stars */
    stars = [];
    const layers = [
      { n: 190, depth: 0.15, rMin: 0.2, rMax: 0.7, aMax: 0.55 },  // far
      { n: 120, depth: 0.45, rMin: 0.4, rMax: 1.1, aMax: 0.85 },  // mid
      { n: 55,  depth: 0.95, rMin: 0.6, rMax: 1.9, aMax: 1.0  }   // near
    ];
    for (const L of layers) {
      for (let i = 0; i < L.n; i++) {
        stars.push({
          x: Math.random() * W,
          y: Math.random() * H,
          r: rnd(L.rMin, L.rMax),
          depth: L.depth,
          a: rnd(0.25, L.aMax),
          tw: rnd(0.4, 2.2),                 // twinkle speed
          ph: Math.random() * Math.PI * 2,   // twinkle phase
          col: HUES[(Math.random() * HUES.length) | 0]
        });
      }
    }

    /* drifting nebula clouds — Moon-blue, Mars-amber, a violet core */
    nebulae = [
      { x: W * 0.18, y: H * 0.28, r: Math.max(W, H) * 0.55, col: [70, 110, 205], a: 0.10, dx:  0.02,  dy:  0.012, d: 0.05 },
      { x: W * 0.78, y: H * 0.62, r: Math.max(W, H) * 0.60, col: [226, 112, 58], a: 0.08, dx: -0.016, dy:  0.01,  d: 0.04 },
      { x: W * 0.50, y: H * 0.12, r: Math.max(W, H) * 0.45, col: [128, 84, 190], a: 0.07, dx:  0.01,  dy: -0.018, d: 0.06 }
    ];
  }

  function spawnMeteor(x, y) {
    const ang = Math.PI * rnd(0.12, 0.42);
    const sp = rnd(7, 13);
    meteors.push({
      x: x != null ? x : Math.random() * W,
      y: y != null ? y : Math.random() * H * 0.45,
      vx: -Math.cos(ang) * sp,
      vy:  Math.sin(ang) * sp,
      life: 0, max: rnd(50, 95), len: rnd(70, 150)
    });
  }

  /* exposed for testing + click interaction */
  window.__cosmos = { meteors, spawn: spawnMeteor };

  let nextMeteor = rnd(90, 260);

  function draw() {
    ctx.clearRect(0, 0, W, H);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;

    /* nebulae — additive glow, own drift + mouse parallax */
    ctx.globalCompositeOperation = "lighter";
    for (const n of nebulae) {
      n.x += n.dx; n.y += n.dy;
      if (n.x < -n.r) n.x = W + n.r; else if (n.x > W + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = H + n.r; else if (n.y > H + n.r) n.y = -n.r;
      const px = n.x + mouse.x * 40 * n.d * 12;
      const py = n.y + mouse.y * 30 * n.d * 12;
      const g = ctx.createRadialGradient(px, py, 0, px, py, n.r);
      g.addColorStop(0, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},${n.a})`);
      g.addColorStop(1, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, n.r, 0, Math.PI * 2); ctx.fill();
    }

    /* stars — twinkle + mouse parallax + scroll drift (wrapped) */
    for (const s of stars) {
      s.ph += s.tw * 0.02;
      const tw = 0.55 + Math.sin(s.ph) * 0.45;
      const px = s.x + mouse.x * 30 * s.depth;
      let py = s.y + mouse.y * 22 * s.depth - scrollY * s.depth * 0.12;
      py = ((py % H) + H) % H;              // seamless vertical wrap
      ctx.globalAlpha = Math.min(1, s.a * tw);
      ctx.fillStyle = `rgb(${s.col[0]},${s.col[1]},${s.col[2]})`;
      ctx.beginPath(); ctx.arc(px, py, s.r, 0, Math.PI * 2); ctx.fill();
      if (s.depth > 0.6 && s.a > 0.8) {     // soft halo on bright near stars
        ctx.globalAlpha = s.a * tw * 0.13;
        ctx.beginPath(); ctx.arc(px, py, s.r * 3.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    /* meteors — bright head with a fading trail */
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx; m.y += m.vy; m.life++;
      const t = m.life / m.max;
      const fade = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
      const d = Math.hypot(m.vx, m.vy) || 1;
      const tx = m.x - (m.vx / d) * m.len;
      const ty = m.y - (m.vy / d) * m.len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g; ctx.lineWidth = 1.6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      if (m.life >= m.max || m.y > H + 60 || m.x < -160) meteors.splice(i, 1);
    }

    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (--nextMeteor <= 0) { spawnMeteor(); nextMeteor = rnd(160, 440); }
    requestAnimationFrame(draw);
  }

  build();
  addEventListener("resize", build);
  addEventListener("scroll", () => { scrollY = window.scrollY; }, { passive: true });
  addEventListener("pointermove", (e) => {
    mouse.tx = (e.clientX / W - 0.5) * 2;
    mouse.ty = (e.clientY / H - 0.5) * 2;
  }, { passive: true });

  /* click the empty sky → launch a shooting star */
  addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input, textarea, select, .vpart, .mchip, " +
      ".grave-marker, .site-marker, .map-box, .planet-map, .narrator, .part-pop, .rail, " +
      ".tabbar, .stranded, .footage")) return;
    spawnMeteor(e.clientX, e.clientY);
  });

  /* reduced motion: paint one calm static frame */
  function paintStatic() {
    ctx.clearRect(0, 0, W, H);
    for (const n of nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},${n.a})`);
      g.addColorStop(1, `rgba(${n.col[0]},${n.col[1]},${n.col[2]},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of stars) {
      ctx.globalAlpha = s.a; ctx.fillStyle = `rgb(${s.col[0]},${s.col[1]},${s.col[2]})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (reduce) {
    paintStatic();
    /* repaint after resize — build() clears the canvas */
    addEventListener("resize", paintStatic);
    return;
  }
  requestAnimationFrame(draw);
}

/* ---------------------------------------------------------------- jumping */
function jumpTo(id) {
  const el = document.getElementById("m-" + id) || document.getElementById(id);
  if (el) {
    $("#partPop").hidden = true;
    if (window.Narrator) Narrator.stop();
    lockScroll(1400); /* see renderRail */
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------------------ boot */
function boot() {
  /* counters */
  $("#statMissions").textContent = MISSIONS.length;
  $("#statParts").textContent =
    MISSIONS.reduce((a, m) => a + (m.manifest || []).length, 0) + "+";

  renderTimeline();
  renderMissions();
  renderGraveyard();
  wireMapCross();
  renderRail();
  renderProgress();

  /* app tab bar — jump exactly like a rail dot */
  $("#tabbar").addEventListener("click", (e) => {
    const tab = e.target.closest(".tab");
    if (tab) jumpTo(tab.dataset.target);
  });

  /* sources */
  $("#footSources").innerHTML = SOURCES.map(
    (s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label}</a></li>`
  ).join("");

  /* global delegated clicks — attached before first render so a render
     error can never leave the page inert */
  document.addEventListener("click", (e) => {
    const step = e.target.closest(".step");
    if (step) {
      const section = step.closest(".mission");
      showPhase(section.id.slice(2), +step.dataset.phase);
      return;
    }
    const part = e.target.closest(".vpart");
    if (part) {
      const stage = part.closest(".veh-stage");
      if (stage) openPartPopup(stage.dataset.mission, part.getAttribute("data-part"));
      return;
    }
    const chip = e.target.closest(".mchip");
    if (chip) {
      openPartPopup(chip.dataset.mission, chip.dataset.chip);
      return;
    }
    const jp = e.target.closest("[data-jp-mission]");
    if (jp) {
      const missionId = jp.dataset.jpMission;
      const phaseIdx = +jp.dataset.jpPhase;
      const section = $(`#m-${missionId}`);
      if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      showPhase(missionId, phaseIdx);
      return;
    }

    const jump = e.target.closest("[data-jump]");
    if (jump) { jumpTo(jump.dataset.jump); return; }

    const jIdx = e.target.closest("[data-jump-idx]");
    if (jIdx && !jIdx.disabled) {
      const m = sortedMissions[+jIdx.dataset.jumpIdx];
      if (m) jumpTo(m.id);
    }
  });

  /* keyboard access for diagram parts */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const part = e.target.closest?.(".vpart");
    if (part) {
      e.preventDefault();
      const stage = part.closest(".veh-stage");
      if (stage) openPartPopup(stage.dataset.mission, part.getAttribute("data-part"));
    }
  });

  /* initial phase for every mission */
  sortedMissions.forEach((m) => showPhase(m.id, 0));

  starfield();
}

document.addEventListener("DOMContentLoaded", boot);

/* ------------------------------------------------------------ PWA stuff */
/* Deploy-safe service worker: the SW cache name includes a version derived
   from the actual deployed shell files, so a content change (CSS/JS/HTML)
   changes the version and forces returning visitors off the old cache on the
   next visit. The version is computed from the bytes the browser already
   loaded for the shell, with a safe fallback so registration never depends on
   a fresh network fetch.                              */
const SHELL_FOR_VERSION = [
  "index.html",
  "manifest.webmanifest",
  "css/styles.css",
  "css/game.css",
  "css/footage.css",
  "js/data.js",
  "js/manifest.js",
  "js/vehicles.js",
  "js/app.js",
  "js/game.js",
  "js/footage.js",
  "js/narrator.js",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/apple-touch-icon.png"
];
function deployVersion() {
  return new Promise((resolve) => {
    const parts = [];
    let pending = SHELL_FOR_VERSION.slice();
    let failed = false;
    let done = false;
    const started = performance.now();
    const TIMEOUT_MS = 1400;
    function hashStr(s) {
      let h = 2166136261 >>> 0;
      for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return (h >>> 0).toString(16).padStart(8, "0");
    }
    function finish(v) {
      if (done) return;
      done = true;
      resolve(v);
    }
    function step() {
      if (done) return;
      if (pending.length === 0 || performance.now() - started > TIMEOUT_MS) {
        if (failed || pending.length > 0) {
          const fallback = [document.documentElement.outerHTML];
          try {
            document.styleSheets.forEach((sheet) => {
              try { fallback.push(sheet.cssText || ""); } catch (_) {}
            });
          } catch (_) {}
          finish(hashStr(fallback.join("|")));
          return;
        }
        const url = pending.shift();
        fetch(url, { cache: "force-cache" })
          .then((r) => {
            if (!r.ok) { failed = true; step(); return; }
            return r.text();
          })
          .then((t) => {
            if (done) return;
            parts.push(url + ":" + t.length + ":" + hashStr(t).slice(0, 8));
            step();
          })
          .catch(() => { failed = true; step(); });
    }
    step();
  }
  });
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  addEventListener("load", () => {
    deployVersion().then((version) => {
      navigator.serviceWorker
        .register("sw.js?v=" + version, { scope: "./" })
        .then((reg) => {
          const activate = () => {
            if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
          };
          activate();
          reg.addEventListener("updatefound", () => {
            const nw = reg.installing;
            if (!nw) return;
            nw.addEventListener("statechange", () => {
              /* a fresh version finished installing → take over immediately so
                 exhibit edits are never served from the old cache */
              if (nw.state === "installed" && navigator.serviceWorker.controller)
                nw.postMessage("SKIP_WAITING");
            });
          });
        })
        .catch(() => {});
    });
  });
}

/* install prompt — shows the "install app" pill only when the browser
   actually offers it (Chrome/Edge/Android); iOS installs via Share sheet */
let installEvt = null;
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvt = e;
  const cta = $("#installCta");
  if (cta) cta.hidden = false;
});
addEventListener("appinstalled", () => {
  installEvt = null;
  const cta = $("#installCta");
  if (cta) cta.hidden = true;
});
document.addEventListener("click", (e) => {
  const cta = e.target.closest("#installCta");
  if (!cta || !installEvt) return;
  const evt = installEvt;
  installEvt = null;
  cta.hidden = true;
  evt.prompt();
  evt.userChoice && evt.userChoice.catch(() => {});
});
