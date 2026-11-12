// =============================================================================
//  ui.js – HTML-Bedienelemente über der Zeichenfläche
// =============================================================================
//  Alle Positionen werden im logischen 1600×900-Raster angegeben und beim
//  Ändern der Fenstergröße mitskaliert (siehe layoutUi).
// =============================================================================

const ui = {};
const uiPositionen = [];
let huelle;

function platziere(el, x, y, w, ...klassen) {
  el.addClass("ui");
  for (const k of klassen) {
    el.addClass(k);
  }
  el.parent(huelle);
  const pos = { el, x, y, w };
  uiPositionen.push(pos);
  el._pos = pos;
  return el;
}

function layoutUi() {
  huelle.style("width", width + "px");
  huelle.style("font-size", 15 * S + "px");
  for (const p of uiPositionen) {
    // alles unterhalb der Kopfzeile rutscht um die Stufen-Leiste nach unten
    const y = p.y >= 56 && !p.el.hasClass("beispiel") ? p.y + LEISTE : p.y;
    p.el.position(p.x * S, y * S);
    if (p.w) {
      p.el.style("width", p.w * S + "px");
    }
  }
}

// Element im Raster verschieben (nur wenn sich wirklich etwas ändert)
function setzeX(el, x) {
  if (el._pos.x !== x) {
    el._pos.x = x;
    el.position(x * S, (el._pos.y >= 56 ? el._pos.y + LEISTE : el._pos.y) * S);
  }
}

function zeige(el, sichtbar) {
  const soll = sichtbar ? "" : "none";
  if (el.elt.style.display !== soll) {
    el.elt.style.display = soll;
  }
}

// Eingabefeld, das bei Enter eine Aktion auslöst
function eingabefeld(platzhalter, beiEnter) {
  const el = createInput("");
  el.attribute("placeholder", platzhalter);
  el.attribute("autocomplete", "off");
  el.attribute("spellcheck", "false");
  el.elt.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      beiEnter();
    }
  });
  return el;
}

function erstelleUi() {
  huelle = createDiv();
  huelle.addClass("huelle");

  // --- Kopfzeile -------------------------------------------------------------
  ui.logo = platziere(createImg("assets/logo-jps.png", "Logo der Jakob-Preh-Schule"), 14, 3, 122, "logo");

  ui.modusUeben = platziere(createButton("Rangieren · üben"), 1182, 12, 190, "kopf");
  ui.modusUeben.mousePressed(() => {
    modusWechseln("ueben");
    ui.modusUeben.elt.blur();
  });
  ui.modusPruef = platziere(createButton("Freigabeprüfung"), 1380, 12, 196, "kopf");
  ui.modusPruef.mousePressed(() => {
    modusWechseln("pruefung");
    ui.modusPruef.elt.blur();
  });

  // --- Stufen-Leiste: ein Reiter je Freigabestufe ----------------------------
  ui.stufen = [];
  let bx = 104;
  STUFEN.forEach((st, i) => {
    const text = `${i + 1} · ${st.name}`;
    const b = 48 + text.length * 8.4;
    const knopf = platziere(createButton(text), bx, 63, b, "beispiel");
    knopf.attribute("title", `Freigabestufe ${i + 1}: ${st.rang}`);
    knopf.mousePressed(() => {
      stufeWechseln(i);
      knopf.elt.blur();
    });
    ui.stufen.push(knopf);
    bx += b + 10;
  });

  // --- Üben: Eingaben und Rangier-Knöpfe -------------------------------------
  ui.labelA = platziere(createSpan("Zahl"), 46, 782, 64);
  ui.eingabeA = platziere(eingabefeld("z. B. 169", () => wertLaden(ui.eingabeA.value(), STUFEN[stufe].id === "gleitpunkt" ? "F" : istRechenStufe() ? "A" : "E")), 112, 782, 170, "feld");
  ui.labelB = platziere(createSpan("B"), 300, 782, 26);
  ui.eingabeB = platziere(eingabefeld("z. B. 30", () => wertLaden(ui.eingabeB.value(), "B")), 328, 782, 170, "feld");
  ui.laden = platziere(createButton("Zug beladen ⏎"), 300, 780, 176, "dunkel");
  ui.laden.mousePressed(() => {
    if (istRechenStufe()) {
      wertLaden(ui.eingabeA.value(), "A");
      wertLaden(ui.eingabeB.value(), "B");
    } else {
      wertLaden(ui.eingabeA.value(), STUFEN[stufe].id === "gleitpunkt" ? "F" : "E");
    }
    ui.laden.elt.blur();
  });

  ui.zufall = platziere(createButton("Zufallszug"), 46, 834, 150);
  ui.zufall.mousePressed(() => {
    zufallsZug();
    ui.zufall.elt.blur();
  });
  ui.leeren = platziere(createButton("Zug leeren"), 206, 834, 150);
  ui.leeren.mousePressed(() => {
    zugLeeren();
    ui.leeren.elt.blur();
  });
  ui.umkehr = platziere(createButton("↻ Umkehrschleife · (−1)"), 366, 834, 250, "primaer");
  ui.umkehr.mousePressed(() => {
    umkehrschleife();
    ui.umkehr.elt.blur();
  });
  ui.schritt = platziere(createButton("Schritt ▶ (→)"), 366, 834, 170, "dunkel");
  ui.schritt.mousePressed(() => {
    if (rechnung && rechnung.phase === "fertig") {
      neueRechnung();
    }
    rechenSchritt();
    ui.schritt.elt.blur();
  });
  ui.alles = platziere(createButton("▶ Alles rechnen"), 546, 834, 180, "primaer");
  ui.alles.mousePressed(() => {
    allesRechnen();
    ui.alles.elt.blur();
  });

  // --- Prüfung ----------------------------------------------------------------
  ui.antwort = platziere(eingabefeld("Antwort", () => pruefAktion()), 46, 812, 230, "feld");
  ui.lampe = platziere(createButton("Überlauf-Lampe: aus"), 46, 810, 230);
  ui.lampe.mousePressed(() => {
    if (!rueckmeldung) {
      ueberlaufLampe = !ueberlaufLampe;
    }
    ui.lampe.elt.blur();
  });
  ui.aktion = platziere(createButton("Prüfen ✓"), 288, 810, 230, "primaer");
  ui.aktion.mousePressed(() => {
    pruefAktion();
    ui.aktion.elt.blur();
  });
  ui.andere = platziere(createButton("Andere Aufgabe"), 900, 838, 164, "klein");
  ui.andere.attribute("title", "Neue Aufgabe – die Serie beginnt dabei von vorn");
  ui.andere.mousePressed(() => {
    serie = 0;
    naechsteAufgabe();
    ui.andere.elt.blur();
  });

  // --- Freigaben ---------------------------------------------------------------
  ui.reset = platziere(createButton("zurücksetzen"), 1452, 625, 112, "klein");
  ui.reset.attribute("title", "Alle Prüfsiegel löschen (z. B. für die nächste Klasse)");
  ui.reset.mousePressed(() => {
    if (window.confirm("Alle Prüfsiegel löschen?")) {
      freigabenZuruecksetzen();
    }
    ui.reset.elt.blur();
  });
}

function pruefAktion() {
  if (rueckmeldung) {
    naechsteAufgabe();
    ui.antwort.elt.focus();
    return;
  }
  pruefen(ui.antwort.value());
}

function leereEingaben() {
  if (!ui.antwort) {
    return;
  }
  ui.antwort.value("");
  ui.eingabeA.value("");
  ui.eingabeB.value("");
}

// --- kleine Helfer, damit das DOM nur bei echten Änderungen angefasst wird ---
function beschrifte(el, html) {
  if (el._html !== html) {
    el.html(html);
    el._html = html;
  }
}

function sperre(el, gesperrt) {
  if (el.elt.disabled !== gesperrt) {
    el.elt.disabled = gesperrt;
  }
}

function klasse(el, name, an) {
  if (an) {
    el.addClass(name);
  } else {
    el.removeClass(name);
  }
}

// wird in jedem Frame aufgerufen
function aktualisiereUi() {
  const id = STUFEN[stufe].id;
  const ueben = modus === "ueben";
  const rechen = istRechenStufe();

  klasse(ui.modusUeben, "aktiv", ueben);
  klasse(ui.modusPruef, "aktiv", !ueben);
  ui.stufen.forEach((k, i) => {
    klasse(k, "aktiv", i === stufe);
    beschrifte(k, `${i + 1} · ${STUFEN[i].name}${freigaben[i] ? " ✓" : ""}`);
  });

  // Üben
  zeige(ui.labelA, ueben);
  zeige(ui.eingabeA, ueben);
  zeige(ui.labelB, ueben && rechen);
  zeige(ui.eingabeB, ueben && rechen);
  zeige(ui.laden, ueben);
  zeige(ui.zufall, ueben);
  zeige(ui.leeren, ueben);
  zeige(ui.umkehr, ueben && id === "zweier");
  zeige(ui.schritt, ueben && rechen);
  zeige(ui.alles, ueben && rechen);
  if (ueben) {
    beschrifte(ui.labelA, rechen ? "A" : "Zahl");
    setzeX(ui.labelA, rechen ? 70 : 46);
    setzeX(ui.laden, rechen ? 512 : 296);
    const platz = {
      binaer: "0 … 255",
      hex: "z. B. 0xB4 oder 180",
      addition: "z. B. 45",
      zweier: "−128 … 127",
      subtraktion: "z. B. 25",
      gleitpunkt: "z. B. 0,1",
    };
    if (ui.eingabeA.elt.placeholder !== platz[id]) {
      ui.eingabeA.attribute("placeholder", platz[id]);
    }
    if (ui.eingabeB.elt.placeholder !== (id === "subtraktion" ? "z. B. 40" : "z. B. 30")) {
      ui.eingabeB.attribute("placeholder", id === "subtraktion" ? "z. B. 40" : "z. B. 30");
    }
    beschrifte(ui.leeren, rechen ? "Züge leeren" : "Zug leeren");
    beschrifte(ui.zufall, rechen ? "Zufallszüge" : "Zufallszug");
    sperre(ui.umkehr, !!umkehr);
    sperre(ui.schritt, rechnenAuto || !!umkehr);
    beschrifte(ui.schritt, rechnung && rechnung.phase === "fertig" ? "↺ Neu rechnen" : rechnung && rechnung.phase === "komplement" ? "Umkehrschleife ▶" : "Schritt ▶ (→)");
    sperre(ui.alles, rechnenAuto);
  }

  // Prüfung
  const lesen = !ueben && aufgabe && aufgabe.art === "lesen";
  const lampe = !ueben && aufgabe && aufgabe.ueberlauf !== undefined;
  zeige(ui.antwort, lesen);
  zeige(ui.lampe, lampe);
  zeige(ui.aktion, !ueben);
  zeige(ui.andere, !ueben);
  if (!ueben && aufgabe) {
    setzeX(ui.aktion, lesen || lampe ? 288 : 46);
    if (rueckmeldung) {
      beschrifte(ui.aktion, "Nächste Aufgabe ▶ (Enter)");
      klasse(ui.aktion, "primaer", false);
      klasse(ui.aktion, "dunkel", true);
    } else {
      beschrifte(ui.aktion, lesen ? "Prüfen ✓ (Enter)" : "Abfahrt melden ✓");
      klasse(ui.aktion, "primaer", true);
      klasse(ui.aktion, "dunkel", false);
    }
    beschrifte(ui.lampe, ueberlaufLampe ? "Überlauf-Lampe: <b>AN</b>" : "Überlauf-Lampe: aus");
    klasse(ui.lampe, "kopf", true);
    klasse(ui.lampe, "aktiv", ueberlaufLampe);
    sperre(ui.antwort, !!rueckmeldung);
  }
}
