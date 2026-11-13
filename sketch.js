// =============================================================================
//  Bit-Bahnhof · Zahlensysteme im Laborserver
//  Messwerte reisen als Güterzüge zum Laborserver: Jeder Waggon ist ein Bit –
//  beladen = 1, leer = 0. Sechs Freigabestufen vom Rangierer bis zum
//  Bahnhofsvorsteher:
//    1 Binär · 2 Hexadezimal · 3 Addition · 4 Zweierkomplement ·
//    5 Subtraktion durch Addition · 6 Gleitpunkt (IEEE 754)
// =============================================================================
//
//  Dateien
//    bits.js    Rechnen mit Bits (Umrechnen, Addieren, Zweierkomplement, float)
//    daten.js   Freigabestufen, Texte und Aufgaben der Freigabeprüfung
//    ui.js      Knöpfe, Eingabefelder
//    sketch.js  Ablauf, Zeichnen, Erklärungen (diese Datei)
//
//  Bedienung
//    Klick auf einen Waggon   beladen / entladen
//    Enter                    Eingabe übernehmen bzw. Antwort prüfen
//    →                        nächster Rechenschritt (Addition, Subtraktion)
//
//  Läuft mit p5.js 1.x und 2.x.
//  Hinweis: Alle Schleifen haben geschweifte Klammern – der p5-Web-Editor
//  kommt mit Schleifen ohne Klammern nicht zurecht.
// =============================================================================

// -----------------------------------------------------------------------------
// Layout (logisches Raster 1600 × 900, wird auf die Fenstergröße skaliert)
// -----------------------------------------------------------------------------
const W = 1600;
const LEISTE = 48;
const H_INHALT = 900;
const H = H_INHALT + LEISTE;
let S = 1;

const SCHRIFTEN = {
  titel: ["Quicksand", "Arial"],
  text: ["Inter", "Arial"],
  mono: ["JetBrains Mono", "monospace"],
};
const schriftGeladen = { titel: false, text: false, mono: false };
let TITEL = "Arial";
let SCHRIFT = "Arial";
let MONO = "monospace";

function ladeSchriften() {
  if (!document.fonts || !document.fonts.load) {
    return;
  }
  for (const art of Object.keys(SCHRIFTEN)) {
    const name = SCHRIFTEN[art][0];
    Promise.all([document.fonts.load(`400 16px "${name}"`), document.fonts.load(`700 16px "${name}"`)])
      .then((ergebnis) => {
        if (ergebnis[0].length > 0 && ergebnis[1].length > 0) {
          schriftGeladen[art] = true;
          TITEL = schriftGeladen.titel ? SCHRIFTEN.titel[0] : SCHRIFTEN.titel[1];
          SCHRIFT = schriftGeladen.text ? SCHRIFTEN.text[0] : SCHRIFTEN.text[1];
          MONO = schriftGeladen.mono ? SCHRIFTEN.mono[0] : SCHRIFTEN.mono[1];
        }
      })
      .catch(() => {});
  }
}

const P_GLEIS = { x: 24, y: 84, w: 1060, h: 520, titel: "" };
const P_STELL = { x: 1100, y: 84, w: 476, h: 520, titel: "Stellwerk · Messwert-Monitor" };
const P_AUFTRAG = { x: 24, y: 620, w: 1060, h: 264, titel: "" };
const P_FREIGABE = { x: 1100, y: 620, w: 476, h: 264, titel: "Freigaben" };
const KOPF_H = 34;

// Farben nach dem Corporate Design der Jakob-Preh-Schule (bsnes.de)
const FARBE = {
  papier: [251, 249, 245],
  flaeche: [255, 255, 255],
  flaeche2: [243, 238, 230],
  linie: [231, 225, 214],
  text: [29, 29, 28],
  grau: [91, 88, 82],
  blass: [125, 122, 114],
  akzent: [200, 30, 58],
  akzentHell: [228, 0, 43],
  senf: [184, 122, 28],
  gruen: [52, 128, 84],
  blau: [44, 92, 150],
  holz: [160, 112, 62],
  schiene: [120, 116, 108],
};

// Gruppenfarben beim Gleitpunkt-Zug
const FLOAT_FARBE = { v: [200, 30, 58], e: [44, 92, 150], m: [52, 128, 84] };

// -----------------------------------------------------------------------------
// Zustand
// -----------------------------------------------------------------------------
let stufe = 0; // Index in STUFEN
let modus = "ueben"; // "ueben" (Rangieren) oder "pruefung" (Freigabeprüfung)

// Die Züge: A, B (Summanden), M (−B), E (Ergebnis bzw. Hauptzug), F (float)
const zuege = { A: [], B: [], M: [], E: [], F: [] };
const geaendert = { A: [], B: [], M: [], E: [], F: [] }; // Zeitpunkt je Waggon

// Rechnung bei Addition und Subtraktion (Schritt für Schritt)
let rechnung = null;
let rechnenAuto = false;
let letzterSchritt = 0;

// Animation der Umkehrschleife: {zug, von, nach, t0, dauer}
let umkehr = null;
// Entgleisen des 9. Waggons: Startzeit
let entgleisT0 = -1;

// Gleitpunkt: eingegebener Wert (zum Vergleich mit dem gespeicherten)
let floatEingabe = null;

// Freigabeprüfung
let aufgabe = null;
let serie = 0;
let rueckmeldung = null; // {ok, text, loesung}
let ueberlaufLampe = false;
let freigaben = [false, false, false, false, false, false];
let stempel = null; // {stufe, t0}

let fehlerMeldung = null;
let hinweis = null; // {text, t0}
let cnv;

// =============================================================================
// Start
// =============================================================================
function setup() {
  ladeSchriften();
  const [cw, ch] = zeichenflaeche();
  cnv = createCanvas(cw, ch);
  S = width / W;
  ladeFreigaben();
  erstelleUi();
  cnv.parent(huelle);
  stufeWechseln(0, true);
  layoutUi();
}

function zeichenflaeche() {
  const cw = Math.max(800, Math.min(1600, windowWidth - 24, ((windowHeight - 24) * W) / H));
  return [Math.round(cw), Math.round((cw * H) / W)];
}

function windowResized() {
  const [cw, ch] = zeichenflaeche();
  resizeCanvas(cw, ch);
  S = width / W;
  layoutUi();
}

// =============================================================================
// Hauptschleife – Fehler werden abgefangen, damit nie alles einfriert
// =============================================================================
function draw() {
  try {
    logik();
    background(...FARBE.papier);
    push();
    scale(S);
    zeichneKopf();
    zeichneStufenLeiste();
    push();
    translate(0, LEISTE);
    zeichneStatus();
    zeichneGleisPanel();
    zeichneStellwerk();
    zeichneAuftrag();
    zeichneFreigaben();
    zeichneStempel();
    zeichneTooltip();
    zeichneFehlerMeldung();
    pop();
    pop();
    aktualisiereUi();
  } catch (err) {
    behandleFehler(err);
  }
}

function behandleFehler(err) {
  console.error(err);
  fehlerMeldung = { text: String((err && err.message) || err), t0: millis() };
  rechnenAuto = false;
  umkehr = null;
}

function logik() {
  if (umkehr && millis() - umkehr.t0 > umkehr.dauer) {
    zuege[umkehr.zug] = umkehr.nach.slice();
    umkehr = null;
  }
  if (rechnenAuto && !umkehr && millis() - letzterSchritt > 450) {
    rechenSchritt();
    if (!rechnung || rechnung.phase === "fertig") {
      rechnenAuto = false;
    }
  }
}

// =============================================================================
// Stufe und Modus wechseln
// =============================================================================
function stufeWechseln(neu, erzwingen) {
  if (!erzwingen && neu === stufe) {
    return;
  }
  stufe = neu;
  zuruecksetzen();
}

function modusWechseln(neu) {
  if (neu === modus) {
    return;
  }
  modus = neu;
  zuruecksetzen();
}

function zuruecksetzen() {
  const n = STUFEN[stufe].bits;
  for (const k of Object.keys(zuege)) {
    zuege[k] = new Array(k === "F" ? 32 : 8).fill(0);
    geaendert[k] = new Array(k === "F" ? 32 : 8).fill(-9999);
  }
  rechnung = null;
  rechnenAuto = false;
  umkehr = null;
  entgleisT0 = -1;
  floatEingabe = null;
  serie = 0;
  rueckmeldung = null;
  ueberlaufLampe = false;
  aufgabe = null;
  hinweis = null;

  if (modus === "pruefung") {
    naechsteAufgabe();
  } else {
    // ein freundlicher Startzug zum Ausprobieren
    if (STUFEN[stufe].id === "addition") {
      zuege.A = zuBits(45, 8);
      zuege.B = zuBits(30, 8);
    } else if (STUFEN[stufe].id === "subtraktion") {
      zuege.A = zuBitsVorzeichen(25, 8);
      zuege.B = zuBitsVorzeichen(40, 8);
    } else if (STUFEN[stufe].id === "gleitpunkt") {
      zuege.F = floatZuBits(12.5);
      floatEingabe = 12.5;
    } else if (STUFEN[stufe].id === "zweier") {
      zuege.E = zuBitsVorzeichen(-12, 8);
    } else {
      zuege.E = zuBits(n === 8 ? 169 : 0, 8);
    }
    if (istRechenStufe()) {
      neueRechnung();
    }
  }
  if (typeof leereEingaben === "function") {
    leereEingaben();
  }
}

function istRechenStufe() {
  const id = STUFEN[stufe].id;
  return id === "addition" || id === "subtraktion";
}

// =============================================================================
// Rechnen Schritt für Schritt (Addition / Subtraktion)
// =============================================================================
function neueRechnung() {
  rechnung = {
    phase: STUFEN[stufe].id === "subtraktion" ? "komplement" : "spalten",
    spalte: 7,
    summe: new Array(8).fill(null),
    uebertrag: new Array(8).fill(null),
    uebertragAus: null,
    info: "",
  };
  if (STUFEN[stufe].id === "subtraktion") {
    zuege.M = new Array(8).fill(0);
    rechnung.mSichtbar = false;
  }
  rechnenAuto = false;
  entgleisT0 = -1;
}

function rechenSchritt() {
  if (!rechnung || umkehr) {
    return;
  }
  letzterSchritt = millis();
  if (rechnung.phase === "komplement") {
    // B fährt durch die Umkehrschleife und wird zu −B
    const nach = zweierkomplement(zuege.B);
    starteUmkehr("M", zuege.B.slice(), nach);
    rechnung.mSichtbar = true;
    rechnung.phase = "spalten";
    const b = ausBitsVorzeichen(zuege.B);
    rechnung.info = `Umkehrschleife: B = ${vz(b)} wird umgedreht (${bitText(invertiere(zuege.B))}) und +1 gerechnet → −B = ${bitText(nach)} = ${vz(ausBitsVorzeichen(nach))}.`;
    return;
  }
  if (rechnung.phase === "spalten") {
    const a = zuege.A;
    const b = STUFEN[stufe].id === "subtraktion" ? zuege.M : zuege.B;
    const i = rechnung.spalte;
    const c = i === 7 ? 0 : rechnung.uebertragNeu;
    rechnung.uebertrag[i] = c;
    const s = a[i] + b[i] + c;
    rechnung.summe[i] = s % 2;
    rechnung.uebertragNeu = s >= 2 ? 1 : 0;
    const spaltenNr = 8 - i;
    rechnung.info = `Spalte ${spaltenNr} (Wertigkeit ${wertigkeit(i, 8)}): ${a[i]} + ${b[i]} + Übertrag ${c} = ${s >= 2 ? (s === 2 ? "10₂" : "11₂") : s} → Waggon ${s % 2 ? "beladen" : "leer"}, Übertrag ${s >= 2 ? 1 : 0} nach links.`;
    rechnung.spalte--;
    if (rechnung.spalte < 0) {
      rechnung.uebertragAus = rechnung.uebertragNeu;
      rechnung.phase = "fertig";
      zuege.E = rechnung.summe.slice();
      if (rechnung.uebertragAus === 1) {
        entgleisT0 = millis();
      }
      rechnung.info += rechnung.uebertragAus === 1 ? " Der Übertrag aus der letzten Spalte hat keinen Platz mehr: Der 9. Waggon entgleist!" : "";
    }
  }
}

function allesRechnen() {
  if (!rechnung) {
    return;
  }
  if (rechnung.phase === "fertig") {
    neueRechnung();
  }
  rechnenAuto = true;
  letzterSchritt = 0;
}

// =============================================================================
// Umkehrschleife (Zweierkomplement) als Animation
// =============================================================================
function starteUmkehr(zug, von, nach) {
  umkehr = { zug, von, nach, t0: millis(), dauer: 1800 };
}

function umkehrschleife() {
  if (umkehr) {
    return;
  }
  const von = zuege.E.slice();
  const nach = zweierkomplement(von);
  const wert = ausBitsVorzeichen(von);
  starteUmkehr("E", von, nach);
  if (wert === -128) {
    zeigeHinweis("−128 hat kein positives Gegenstück in 8 Bit: Nach der Umkehrschleife steht wieder −128 im Zug!");
  } else {
    zeigeHinweis(`Umdrehen und +1: aus ${vz(wert)} wird ${vz(-wert)}.`);
  }
}

// Bits eines Zuges, wie sie gerade (auch während der Animation) zu sehen sind
function sichtbareBits(zug) {
  if (umkehr && umkehr.zug === zug) {
    const p = (millis() - umkehr.t0) / umkehr.dauer;
    const n = umkehr.von.length;
    if (p < 0.65) {
      // Waggon für Waggon wird umgedreht (von links nach rechts)
      const bis = Math.floor((p / 0.65) * (n + 1));
      return umkehr.von.map((b, i) => (i < bis ? 1 - b : b));
    }
    return umkehr.nach.slice();
  }
  return zuege[zug];
}

function umkehrPhase(zug) {
  if (!umkehr || umkehr.zug !== zug) {
    return null;
  }
  const p = (millis() - umkehr.t0) / umkehr.dauer;
  return p < 0.65 ? "umdrehen" : "plus1";
}

// =============================================================================
// Eingaben im Übungsmodus
// =============================================================================
function wertLaden(txt, zug) {
  const id = STUFEN[stufe].id;
  const roh = String(txt).trim();
  if (roh === "") {
    return;
  }
  if (id === "gleitpunkt") {
    const z = leseZahl(roh);
    if (isNaN(z)) {
      zeigeHinweis("Bitte eine Zahl eingeben, z. B. 12,5 oder −0,1.");
      return;
    }
    zuege.F = floatZuBits(z);
    floatEingabe = z;
    markiereAlle("F");
    return;
  }
  let z;
  if (/^0x/i.test(roh) || (id === "hex" && /[a-f]/i.test(roh))) {
    z = parseInt(roh.replace(/^0x/i, ""), 16);
  } else {
    z = leseZahl(roh);
  }
  const vorzeichen = id === "zweier" || id === "subtraktion";
  const min = vorzeichen ? -128 : 0;
  const max = vorzeichen ? 127 : 255;
  if (isNaN(z) || z !== Math.floor(z) || z < min || z > max) {
    zeigeHinweis(`Ein Zug mit 8 Waggons transportiert ganze Zahlen von ${vz(min)} bis ${max}.`);
    return;
  }
  zuege[zug] = vorzeichen ? zuBitsVorzeichen(z, 8) : zuBits(z, 8);
  markiereAlle(zug);
  if (istRechenStufe()) {
    neueRechnung();
  }
}

function zufallsZug() {
  const id = STUFEN[stufe].id;
  if (id === "gleitpunkt") {
    const werte = [0.1, 3.14159, -273.15, 230, 0.5, 1e-3, 9.81, -42.75, 1 / 3, 65504];
    const z = werte[Math.floor(Math.random() * werte.length)];
    zuege.F = floatZuBits(z);
    floatEingabe = z;
    markiereAlle("F");
    return;
  }
  if (istRechenStufe()) {
    zuege.A = zuBits(Math.floor(Math.random() * 256), 8);
    zuege.B = zuBits(Math.floor(Math.random() * 256), 8);
    markiereAlle("A");
    markiereAlle("B");
    neueRechnung();
    return;
  }
  zuege.E = zuBits(Math.floor(Math.random() * 256), 8);
  markiereAlle("E");
}

function zugLeeren() {
  if (STUFEN[stufe].id === "gleitpunkt") {
    zuege.F = new Array(32).fill(0);
    floatEingabe = null;
    markiereAlle("F");
    return;
  }
  if (istRechenStufe() && modus === "ueben") {
    zuege.A = new Array(8).fill(0);
    zuege.B = new Array(8).fill(0);
    neueRechnung();
    return;
  }
  zuege.E = new Array(8).fill(0);
  markiereAlle("E");
  if (STUFEN[stufe].id === "subtraktion") {
    zuege.M = new Array(8).fill(0);
  }
}

function markiereAlle(zug) {
  geaendert[zug] = geaendert[zug].map(() => millis());
}

// =============================================================================
// Freigabeprüfung
// =============================================================================
function naechsteAufgabe() {
  const letzte = aufgabe ? aufgabe.artIntern : null;
  aufgabe = neueAufgabe(stufe, letzte);
  aufgabe.artIntern = aufgabe.art + (aufgabe.frage.indexOf("Hex-Wert") >= 0 ? "Hex" : "") + (aufgabe.frage.indexOf("Dezimalzahl ist") >= 0 ? "Dez" : "");
  if (aufgabe.art === "laden" && aufgabe.vorgabe.E && STUFEN[stufe].id !== "addition" && STUFEN[stufe].id !== "subtraktion") {
    aufgabe.artIntern = "laden";
  }
  rueckmeldung = null;
  ueberlaufLampe = false;
  entgleisT0 = -1;
  for (const k of Object.keys(aufgabe.vorgabe)) {
    zuege[k] = aufgabe.vorgabe[k].slice();
    markiereAlle(k);
  }
  if (STUFEN[stufe].id === "subtraktion") {
    zuege.M = new Array(8).fill(0);
  }
  rechnung = null;
  if (typeof leereEingaben === "function") {
    leereEingaben();
  }
}

function pruefen(eingabe) {
  if (!aufgabe || rueckmeldung) {
    return;
  }
  let ok;
  if (aufgabe.art === "lesen") {
    if (String(eingabe).trim() === "") {
      zeigeHinweis("Erst eine Antwort ins Feld schreiben.");
      return;
    }
    ok = aufgabe.pruefe(eingabe);
  } else {
    const zug = STUFEN[stufe].id === "gleitpunkt" ? zuege.F : zuege.E;
    ok = zug.every((b, i) => b === aufgabe.soll[i]);
    if (aufgabe.ueberlauf !== undefined && ueberlaufLampe !== aufgabe.ueberlauf) {
      ok = false;
    }
  }
  if (ok) {
    serie++;
    rueckmeldung = { ok: true, text: "Richtig – der Zug darf abfahren!", loesung: aufgabe.loesung };
    if (serie >= SERIE_ZIEL) {
      if (!freigaben[stufe]) {
        freigaben[stufe] = true;
        speichereFreigaben();
      }
      stempel = { stufe, t0: millis() };
      rueckmeldung.text = `Prüfsiegel erteilt: Freigabe als ${STUFEN[stufe].rang}!`;
      serie = 0;
    }
  } else {
    serie = 0;
    let text = "Leider falsch – die Serie beginnt von vorn.";
    if (aufgabe.art === "laden" && aufgabe.ueberlauf !== undefined) {
      const zug = zuege.E;
      const bitsOk = zug.every((b, i) => b === aufgabe.soll[i]);
      if (bitsOk && ueberlaufLampe !== aufgabe.ueberlauf) {
        text = `Der Zug stimmt, aber die Überlauf-Lampe müsste ${aufgabe.ueberlauf ? "an" : "aus"} sein.`;
      }
    }
    rueckmeldung = { ok: false, text, loesung: aufgabe.loesung };
    if (aufgabe.art === "laden" && STUFEN[stufe].id === "addition" && aufgabe.ueberlauf) {
      entgleisT0 = millis();
    }
  }
}

function ladeFreigaben() {
  try {
    const roh = window.localStorage.getItem("bitbahnhof-freigaben");
    if (roh) {
      const liste = JSON.parse(roh);
      if (Array.isArray(liste) && liste.length === 6) {
        freigaben = liste.map((x) => x === true);
      }
    }
  } catch (e) {
    // Speicher nicht verfügbar (z. B. im p5-Web-Editor): einfach weitermachen
  }
}

function speichereFreigaben() {
  try {
    window.localStorage.setItem("bitbahnhof-freigaben", JSON.stringify(freigaben));
  } catch (e) {
    // kein Speicher – Freigaben gelten dann nur bis zum Neuladen
  }
}

function freigabenZuruecksetzen() {
  freigaben = [false, false, false, false, false, false];
  speichereFreigaben();
}

// =============================================================================
// Gleise: wo stehen welche Züge?
// =============================================================================
//  Rückgabe: Liste von {zug, label, y, x0, w, h, gap, editierbar, vorzeichen}
function gleise() {
  const id = STUFEN[stufe].id;
  const pruef = modus === "pruefung";
  if (id === "gleitpunkt") {
    return [{ zug: "F", label: "", y: 340, x0: 60, w: 25, h: 50, gap: 4, editierbar: !pruef || aufgabe.art === "laden", vorzeichen: false, float: true }];
  }
  if (id === "addition") {
    return [
      { zug: "A", label: "A", y: 232, x0: 214, w: 78, h: 54, gap: 14, editierbar: !pruef, vorzeichen: false },
      { zug: "B", label: "B", y: 350, x0: 214, w: 78, h: 54, gap: 14, editierbar: !pruef, vorzeichen: false },
      { zug: "E", label: "A + B", y: 540, x0: 214, w: 78, h: 54, gap: 14, editierbar: pruef, vorzeichen: false, ergebnis: true },
    ];
  }
  if (id === "subtraktion") {
    return [
      { zug: "A", label: "A", y: 214, x0: 214, w: 78, h: 44, gap: 14, editierbar: !pruef, vorzeichen: true },
      { zug: "B", label: "B", y: 304, x0: 214, w: 78, h: 44, gap: 14, editierbar: !pruef, vorzeichen: true },
      { zug: "M", label: "−B", y: 394, x0: 214, w: 78, h: 44, gap: 14, editierbar: pruef, vorzeichen: true, notiz: pruef },
      { zug: "E", label: "A − B", y: 548, x0: 214, w: 78, h: 44, gap: 14, editierbar: pruef, vorzeichen: true, ergebnis: true },
    ];
  }
  return [
    {
      zug: "E",
      label: "",
      y: 410,
      x0: 62,
      w: 96,
      h: 84,
      gap: 16,
      editierbar: !pruef || aufgabe.art === "laden" || !!aufgabe.notiz,
      vorzeichen: id === "zweier",
      hex: id === "hex",
    },
  ];
}

// Position eines Waggons (y ist die Schienenoberkante)
function waggonRechteck(g, i) {
  return { x: g.x0 + i * (g.w + g.gap), y: g.y - g.h - 14, w: g.w, h: g.h };
}

function waggonUnterMaus() {
  const mx = mouseX / S;
  const my = mouseY / S - LEISTE;
  for (const g of gleise()) {
    const n = zuege[g.zug].length;
    for (let i = 0; i < n; i++) {
      const r = waggonRechteck(g, i);
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y - 6 && my <= r.y + r.h + 18) {
        return { g, i };
      }
    }
  }
  return null;
}

function mousePressed() {
  try {
    const t = waggonUnterMaus();
    if (!t || !t.g.editierbar || (umkehr && umkehr.zug === t.g.zug)) {
      return;
    }
    if (modus === "pruefung" && rueckmeldung) {
      return;
    }
    if (!istGueltigeErgebnisAnsicht(t.g)) {
      return;
    }
    const zug = zuege[t.g.zug];
    zug[t.i] = 1 - zug[t.i];
    geaendert[t.g.zug][t.i] = millis();
    if (t.g.zug === "F") {
      floatEingabe = null;
    }
    if (modus === "ueben" && istRechenStufe() && (t.g.zug === "A" || t.g.zug === "B")) {
      neueRechnung();
    }
  } catch (err) {
    behandleFehler(err);
  }
}

function istGueltigeErgebnisAnsicht(g) {
  return !(modus === "ueben" && g.ergebnis);
}

function keyPressed() {
  if (document.activeElement && document.activeElement.tagName === "INPUT") {
    return;
  }
  if (keyCode === RIGHT_ARROW && modus === "ueben" && istRechenStufe()) {
    if (rechnung && rechnung.phase === "fertig") {
      neueRechnung();
    }
    rechenSchritt();
    return false;
  }
  if (keyCode === ENTER && modus === "pruefung") {
    if (rueckmeldung) {
      naechsteAufgabe();
    } else if (aufgabe && aufgabe.art === "laden") {
      pruefen("");
    }
    return false;
  }
}

function zeigeHinweis(text) {
  hinweis = { text, t0: millis() };
}

// =============================================================================
// Zeichnen: Grundbausteine
// =============================================================================
function panel(p) {
  noStroke();
  fill(29, 29, 28, 10);
  rect(p.x + 1, p.y + 3, p.w, p.h, 12);
  fill(...FARBE.flaeche);
  stroke(...FARBE.linie);
  strokeWeight(1);
  rect(p.x, p.y, p.w, p.h, 12);
  stroke(...FARBE.linie);
  line(p.x + 12, p.y + KOPF_H, p.x + p.w - 12, p.y + KOPF_H);
  if (p.titel) {
    noStroke();
    fill(...FARBE.akzentHell);
    circle(p.x + 19, p.y + KOPF_H / 2 + 1, 7);
    fill(...FARBE.text);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(16);
    textAlign(LEFT, CENTER);
    text(p.titel, p.x + 30, p.y + KOPF_H / 2 + 1);
    textStyle(NORMAL);
  }
}

function hell(farbe, anteil) {
  return [lerp(farbe[0], 255, anteil), lerp(farbe[1], 255, anteil), lerp(farbe[2], 255, anteil)];
}

function umbrechen(txt, maxBreite) {
  const zeilen = [];
  for (const absatz of String(txt).split("\n")) {
    const woerter = absatz.split(" ");
    let akt = "";
    for (const wort of woerter) {
      const probe = akt ? akt + " " + wort : wort;
      if (textWidth(probe) > maxBreite && akt) {
        zeilen.push(akt);
        akt = wort;
      } else {
        akt = probe;
      }
    }
    zeilen.push(akt);
  }
  return zeilen;
}

// Fließtext mit Umbruch, gibt die Höhe zurück
function absatz(txt, x, y, breite, groesse, farbe, zeilenAbstand) {
  textFont(SCHRIFT);
  textSize(groesse);
  textAlign(LEFT, TOP);
  fill(...(farbe || FARBE.text));
  noStroke();
  const zeilen = umbrechen(txt, breite);
  const za = zeilenAbstand || groesse * 1.45;
  for (let i = 0; i < zeilen.length; i++) {
    text(zeilen[i], x, y + i * za);
  }
  return zeilen.length * za;
}

function weich(t) {
  const u = constrain(t, 0, 1);
  return u * u * (3 - 2 * u);
}

// =============================================================================
// Kopfzeile und Stufen-Leiste
// =============================================================================
function zeichneKopf() {
  noStroke();
  fill(...FARBE.flaeche);
  rect(0, 0, W, 56);
  stroke(...FARBE.linie);
  strokeWeight(1);
  line(0, 56, W, 56);

  noStroke();
  fill(...FARBE.akzentHell);
  circle(160, 28, 6);
  stroke(...FARBE.akzentHell);
  strokeWeight(3);
  line(170, 34, 180, 22);

  noStroke();
  fill(...FARBE.text);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(21);
  textAlign(LEFT, CENTER);
  text("Bit-Bahnhof", 194, 21);
  textStyle(NORMAL);
  textFont(SCHRIFT);
  textSize(13);
  fill(...FARBE.blass);
  text(STUFEN[stufe].untertitel, 194, 41);
}

function zeichneStufenLeiste() {
  noStroke();
  fill(253, 240, 242);
  rect(0, 56, W, LEISTE);
  stroke(240, 200, 208);
  strokeWeight(1);
  line(0, 56 + LEISTE, W, 56 + LEISTE);
  noStroke();
  fill(...FARBE.akzent);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(15);
  textAlign(LEFT, CENTER);
  text("Stufe", 26, 56 + LEISTE / 2);
  textStyle(NORMAL);
  stroke(...FARBE.akzent);
  strokeWeight(2);
  const px = 26 + textWidth("Stufe") + 10;
  const py = 56 + LEISTE / 2;
  line(px, py - 5, px + 5, py);
  line(px + 5, py, px, py + 5);
  noStroke();
}

function zeichneStatus() {
  noStroke();
  fill(...FARBE.grau);
  textFont(SCHRIFT);
  textSize(13);
  textAlign(LEFT, CENTER);
  text(statusText(), 26, 70);
}

function statusText() {
  if (modus === "pruefung") {
    return `Freigabeprüfung „${STUFEN[stufe].rang}“: ${SERIE_ZIEL} richtige Antworten in Folge ergeben das Prüfsiegel. Das Stellwerk ist während der Prüfung abgeschaltet.`;
  }
  if (STUFEN[stufe].id === "gleitpunkt") {
    return "Klick auf einen Waggon: beladen / entladen · Zahl unten eingeben und „Zug beladen“ drücken · Rot = Vorzeichen, Blau = Exponent, Grün = Mantisse";
  }
  if (istRechenStufe()) {
    return "Züge A und B beladen (Klick oder Eingabe) · „Schritt“ bzw. Taste → rechnet eine Spalte · „Alles rechnen“ läuft bis zum Ende";
  }
  return "Klick auf einen Waggon: beladen / entladen · oder eine Zahl unten eingeben und „Zug beladen“ drücken";
}

// =============================================================================
// Gleisanlage
// =============================================================================
function zeichneGleisPanel() {
  const p = P_GLEIS;
  p.titel = STUFEN[stufe].gleisTitel;
  panel(p);
  // Bahnsteig-Schild „Laborserver“
  bahnhofsSchild(p.x + p.w - 222, p.y + 8);

  const liste = gleise();
  for (const g of liste) {
    zeichneGleis(g);
  }
  if (STUFEN[stufe].id === "addition" || STUFEN[stufe].id === "subtraktion") {
    zeichneUebertraege(liste);
    zeichneUeberlaufSignal(liste[liste.length - 1]);
  }
  if (STUFEN[stufe].id === "gleitpunkt") {
    zeichneFloatGruppen(liste[0]);
  }
  if (hinweis && millis() - hinweis.t0 < 4500) {
    zeichneHinweisBanner();
  }
}

function bahnhofsSchild(x, y) {
  noStroke();
  fill(...FARBE.blau);
  rect(x, y, 206, 20, 4);
  fill(255);
  textFont(SCHRIFT);
  textStyle(BOLD);
  textSize(11);
  textAlign(CENTER, CENTER);
  text("Laborserver · Hbf", x + 103, y + 10.5);
  textStyle(NORMAL);
}

function zeichneSchienen(x1, x2, y) {
  // Schwellen
  stroke(...FARBE.holz);
  strokeWeight(5);
  for (let x = x1 + 6; x < x2; x += 18) {
    line(x, y + 2, x, y + 11);
  }
  // Schienen
  stroke(...FARBE.schiene);
  strokeWeight(2.5);
  line(x1, y + 3, x2, y + 3);
  line(x1, y + 9, x2, y + 9);
  // Prellbock links
  noStroke();
  fill(...FARBE.akzent);
  rect(x1 - 8, y - 12, 8, 22, 2);
}

function zeichneGleis(g) {
  const bits = sichtbareBits(g.zug);
  const n = bits.length;
  const letzte = waggonRechteck(g, n - 1);
  const xEnde = letzte.x + letzte.w + (g.float ? 70 : 120);
  zeichneSchienen(g.x0 - 30, Math.min(xEnde + 20, P_GLEIS.x + P_GLEIS.w - 14), g.y);

  // Gleisbezeichnung links
  if (g.label) {
    noStroke();
    fill(...(g.ergebnis ? FARBE.akzent : FARBE.text));
    textFont(TITEL);
    textStyle(BOLD);
    textSize(20);
    textAlign(RIGHT, CENTER);
    text(g.label, g.x0 - 44, g.y - g.h / 2 - 12);
    textStyle(NORMAL);
    if (STUFEN[stufe].id !== "gleitpunkt") {
      const wert = g.vorzeichen ? ausBitsVorzeichen(zuege[g.zug]) : ausBits(zuege[g.zug]);
      const zeigen = modus === "ueben" || (!g.ergebnis && !g.notiz);
      const leer = modus === "ueben" && g.ergebnis && rechnung && rechnung.phase !== "fertig";
      const mLeer = g.zug === "M" && modus === "ueben" && rechnung && !rechnung.mSichtbar;
      if (zeigen && !leer && !mLeer) {
        textFont(MONO);
        textSize(13);
        fill(...FARBE.blass);
        text(`= ${vz(wert)}`, g.x0 - 44, g.y - g.h / 2 + 10);
      }
      if (g.notiz) {
        textFont(SCHRIFT);
        textSize(11);
        fill(...FARBE.blass);
        text("Notizgleis", g.x0 - 44, g.y - g.h / 2 + 10);
      }
    }
  }

  // Wertigkeits-Schilder über dem obersten bzw. einzigen Zug
  const oben = gleise()[0];
  if (g === oben || g.zug === oben.zug) {
    if (!g.float) {
      for (let i = 0; i < n; i++) {
        const r = waggonRechteck(g, i);
        const w = g.vorzeichen ? wertigkeitVorzeichen(i, n) : wertigkeit(i, n);
        wertSchild(r.x + r.w / 2, r.y - (n === 8 && !istRechenStufe() ? 46 : 26), w, g.vorzeichen && i === 0, !istRechenStufe());
      }
    }
  }

  // Waggons
  const mLeer = g.zug === "M" && modus === "ueben" && rechnung && !rechnung.mSichtbar;
  for (let i = 0; i < n; i++) {
    const r = waggonRechteck(g, i);
    let bit = bits[i];
    let unbekannt = false;
    if (modus === "ueben" && g.ergebnis && rechnung) {
      bit = rechnung.summe[i];
      unbekannt = bit === null;
    }
    if (mLeer) {
      unbekannt = true;
    }
    const hover = !umkehr && g.editierbar && istUnterMaus(r);
    const neu = millis() - geaendert[g.zug][i];
    const aktiv = modus === "ueben" && rechnung && rechnung.phase !== "komplement" && istRechenStufe() && (g.zug !== "E") && i === rechnung.spalte && rechnung.phase === "spalten";
    if (g.float) {
      zeichneFloatWaggon(r, bit, floatGruppe(i), hover, neu);
    } else {
      zeichneWaggon(r, bit, { hover, neu, unbekannt, aktiv, vorzeichen: g.vorzeichen && i === 0, editierbar: g.editierbar });
    }
    // Kupplung zum nächsten Waggon
    if (i < n - 1) {
      stroke(...FARBE.text);
      strokeWeight(2);
      line(r.x + r.w, r.y + r.h - 6, r.x + r.w + g.gap, r.y + r.h - 6);
    }
    // Bit-Ziffer unter dem Waggon
    if (!g.float) {
      noStroke();
      fill(...(unbekannt ? FARBE.blass : FARBE.text));
      textFont(MONO);
      textStyle(BOLD);
      textSize(istRechenStufe() ? 15 : 20);
      textAlign(CENTER, TOP);
      text(unbekannt ? "?" : String(bit), r.x + r.w / 2, g.y + 16);
      textStyle(NORMAL);
    }
  }
  // Lok rechts
  const lx = letzte.x + letzte.w + g.gap;
  stroke(...FARBE.text);
  strokeWeight(2);
  line(letzte.x + letzte.w, letzte.y + letzte.h - 6, lx, letzte.y + letzte.h - 6);
  zeichneLok(lx, g.y, g.float ? 52 : istRechenStufe() ? 82 : 100, g.float ? 50 : g.h + 4, g.label || "LS");

  // Halbzüge (Nibbles) mit Hex-Ziffer
  if (g.hex) {
    zeichneNibbles(g, bits);
  }
  // Umkehrschleife: Hinweis über dem Zug
  const ph = umkehrPhase(g.zug);
  if (ph) {
    noStroke();
    fill(...FARBE.akzent);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(16);
    textAlign(LEFT, CENTER);
    text(ph === "umdrehen" ? "↻ Umkehrschleife: alle Waggons umdrehen …" : "… und +1", g.x0, g.y - g.h - 30 - (g.zug === "E" && !istRechenStufe() ? 70 : 0));
    textStyle(NORMAL);
  }
}

function istUnterMaus(r) {
  const mx = mouseX / S;
  const my = mouseY / S - LEISTE;
  return mx >= r.x && mx <= r.x + r.w && my >= r.y - 6 && my <= r.y + r.h + 18;
}

function wertSchild(x, y, w, negativ, gross) {
  // Der Vorzeichen-Waggon bekommt das Schild „VZ“ statt einer Wertigkeit
  const txt = negativ ? "VZ" : w < 0 ? `−${-w}` : String(w);
  textFont(MONO);
  textStyle(BOLD);
  textSize(gross ? 15 : 12);
  const b = textWidth(txt) + 16;
  const h = gross ? 26 : 20;
  noStroke();
  fill(...(negativ ? FARBE.akzent : FARBE.blau));
  rect(x - b / 2, y - h / 2, b, h, 4);
  fill(255);
  textAlign(CENTER, CENTER);
  text(txt, x, y + 1);
  textStyle(NORMAL);
  // Pfosten
  stroke(...FARBE.schiene);
  strokeWeight(2);
  line(x, y + h / 2, x, y + h / 2 + (gross ? 10 : 4));
}

// Ein Waggon: offener Güterwagen, beladen mit Kisten (1) oder leer (0)
function zeichneWaggon(r, bit, o) {
  const { x, y, w, h } = r;
  // Fahrgestell und Räder
  noStroke();
  fill(...FARBE.text);
  rect(x + 4, y + h - 8, w - 8, 8, 2);
  const radY = y + h + 4;
  fill(60, 58, 54);
  circle(x + w * 0.24, radY, 15);
  circle(x + w * 0.76, radY, 15);
  fill(...FARBE.flaeche2);
  circle(x + w * 0.24, radY, 5);
  circle(x + w * 0.76, radY, 5);

  // Ladung: Kisten stapeln sich mit kleiner Fall-Animation
  if (bit === 1) {
    const fall = 1 - weich(o.neu / 260);
    const kisteW = (w - 18) / 2;
    const kisteH = Math.min(22, (h - 14) / 2);
    const farbe = o.vorzeichen ? FARBE.akzent : FARBE.senf;
    for (let reihe = 0; reihe < 2; reihe++) {
      for (let spalte = 0; spalte < 2; spalte++) {
        const kx = x + 7 + spalte * (kisteW + 4);
        const ky = y + h - 10 - (reihe + 1) * (kisteH + 2) - fall * 40;
        fill(...farbe);
        stroke(...hell(farbe, -0.3).map((v) => Math.max(0, v - 40)));
        strokeWeight(1);
        rect(kx, ky, kisteW, kisteH, 2);
        stroke(255, 255, 255, 90);
        line(kx + 3, ky + kisteH / 2, kx + kisteW - 3, ky + kisteH / 2);
      }
    }
  }

  // Wagenkasten (offen, nur die Bordwände)
  const kastenY = y + h * 0.42;
  const kastenH = h - 8 - h * 0.42;
  stroke(...FARBE.text);
  strokeWeight(o.aktiv ? 3 : 1.5);
  if (o.unbekannt) {
    fill(...FARBE.flaeche);
    drawingContext.setLineDash([5, 4]);
  } else {
    fill(...(o.hover ? hell(FARBE.akzent, 0.85) : o.aktiv ? hell(FARBE.senf, 0.75) : FARBE.flaeche2));
  }
  rect(x, kastenY, w, kastenH, 3);
  drawingContext.setLineDash([]);
  // Bordwand-Streben
  stroke(...FARBE.linie);
  strokeWeight(1);
  if (!o.unbekannt) {
    line(x + w / 3, kastenY + 3, x + w / 3, kastenY + kastenH - 3);
    line(x + (2 * w) / 3, kastenY + 3, x + (2 * w) / 3, kastenY + kastenH - 3);
  }
  if (o.aktiv) {
    noFill();
    stroke(...FARBE.senf);
    strokeWeight(3);
    rect(x - 5, y - 4, w + 10, h + 16, 6);
  }
}

// kleiner Waggon im langen Gleitpunkt-Zug: farbig gefüllt = 1
function zeichneFloatWaggon(r, bit, gruppe, hover, neu) {
  const { x, y, w, h } = r;
  const farbe = FLOAT_FARBE[gruppe];
  noStroke();
  fill(60, 58, 54);
  circle(x + w * 0.28, y + h + 4, 9);
  circle(x + w * 0.72, y + h + 4, 9);
  const blink = 1 - weich(neu / 260);
  stroke(...farbe);
  strokeWeight(hover ? 2.5 : 1.5);
  fill(...(bit ? farbe : hover ? hell(farbe, 0.8) : FARBE.flaeche));
  rect(x, y + 6 - blink * 6, w, h - 6, 3);
  noStroke();
  fill(...(bit ? [255, 255, 255] : farbe));
  textFont(MONO);
  textStyle(BOLD);
  textSize(13);
  textAlign(CENTER, CENTER);
  text(String(bit), x + w / 2, y + h / 2 + 3);
  textStyle(NORMAL);
}

function floatGruppe(i) {
  return i === 0 ? "v" : i <= 8 ? "e" : "m";
}

// Elektrolok in Schul-Rot, Führerstand rechts
function zeichneLok(x, yGleis, w, h, beschriftung) {
  const y = yGleis - h - 14;
  noStroke();
  fill(...FARBE.text);
  rect(x + 4, y + h - 8, w - 8, 8, 2);
  fill(60, 58, 54);
  circle(x + w * 0.22, y + h + 4, 15);
  circle(x + w * 0.5, y + h + 4, 15);
  circle(x + w * 0.78, y + h + 4, 15);
  fill(...FARBE.akzent);
  rect(x, y + h * 0.18, w, h * 0.82 - 8, 6, 14, 3, 3);
  // Stromabnehmer
  stroke(...FARBE.text);
  strokeWeight(1.5);
  line(x + w * 0.35, y + h * 0.18, x + w * 0.5, y + 2);
  line(x + w * 0.65, y + h * 0.18, x + w * 0.5, y + 2);
  line(x + w * 0.38, y + 2, x + w * 0.62, y + 2);
  // Fenster
  noStroke();
  fill(220, 232, 240);
  rect(x + w - 26, y + h * 0.26, 18, h * 0.24, 3);
  rect(x + 10, y + h * 0.26, 18, h * 0.24, 3);
  fill(255);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(Math.min(14, w / 6));
  textAlign(CENTER, CENTER);
  text(beschriftung, x + w / 2 - 2, y + h * 0.62);
  textStyle(NORMAL);
}

function zeichneNibbles(g, bits) {
  for (let k = 0; k < 2; k++) {
    const r1 = waggonRechteck(g, k * 4);
    const r2 = waggonRechteck(g, k * 4 + 3);
    const yk = g.y + 50;
    stroke(...FARBE.blau);
    strokeWeight(2);
    noFill();
    line(r1.x + 4, yk, r1.x + 4, yk + 8);
    line(r1.x + 4, yk + 8, r2.x + r2.w - 4, yk + 8);
    line(r2.x + r2.w - 4, yk, r2.x + r2.w - 4, yk + 8);
    const mitte = (r1.x + r2.x + r2.w) / 2;
    const zeigen = modus === "ueben";
    const vorgabeHex = modus === "pruefung" && aufgabe && aufgabe.hexAnzeige ? aufgabe.hexAnzeige[k] : null;
    noStroke();
    fill(...FARBE.blau);
    rect(mitte - 46, yk + 16, 92, 44, 8);
    fill(255);
    textFont(MONO);
    textStyle(BOLD);
    textSize(26);
    textAlign(CENTER, CENTER);
    const ziffer = zuHex(bits.slice(k * 4, k * 4 + 4));
    text(zeigen ? ziffer : vorgabeHex || "?", mitte, yk + 38);
    textStyle(NORMAL);
    if (zeigen) {
      textFont(MONO);
      textSize(12);
      fill(...FARBE.blass);
      text(`${bitText(bits.slice(k * 4, k * 4 + 4))} = ${ausBits(bits.slice(k * 4, k * 4 + 4))}`, mitte, yk + 72);
    }
  }
}

// Überträge als kleine Kisten zwischen B (bzw. −B) und dem Ergebnis
function zeichneUebertraege(liste) {
  const e = liste[liste.length - 1];
  const yU = e.y - e.h - 54;
  noStroke();
  fill(...FARBE.blass);
  textFont(SCHRIFT);
  textSize(12);
  textAlign(RIGHT, CENTER);
  text("Übertrag", e.x0 - 44, yU + 9);

  let ueb = null;
  let aus = null;
  if (modus === "ueben" && rechnung) {
    ueb = rechnung.uebertrag;
    aus = rechnung.uebertragAus;
  }
  for (let i = 0; i < 8; i++) {
    const r = waggonRechteck(e, i);
    const cx = r.x + r.w / 2;
    const wert = ueb ? ueb[i] : null;
    if (wert === 1) {
      fill(...FARBE.senf);
      stroke(140, 90, 20);
      strokeWeight(1);
      rect(cx - 11, yU, 22, 18, 2);
      noStroke();
      fill(255);
      textFont(MONO);
      textStyle(BOLD);
      textSize(12);
      textAlign(CENTER, CENTER);
      text("1", cx, yU + 9.5);
      textStyle(NORMAL);
      // Pfeil: der Übertrag kam aus der Spalte rechts
      stroke(...FARBE.senf);
      strokeWeight(1.5);
      line(cx + 14, yU + 9, cx + 30, yU + 9);
      line(cx + 14, yU + 9, cx + 19, yU + 5);
      line(cx + 14, yU + 9, cx + 19, yU + 13);
    } else {
      noFill();
      stroke(...FARBE.linie);
      strokeWeight(1);
      drawingContext.setLineDash([3, 3]);
      rect(cx - 11, yU, 22, 18, 2);
      drawingContext.setLineDash([]);
      if (wert === 0) {
        noStroke();
        fill(...FARBE.blass);
        textFont(MONO);
        textSize(12);
        textAlign(CENTER, CENTER);
        text("0", cx, yU + 9.5);
      }
    }
  }
  // Der 9. Waggon: entgleist, wenn der Übertrag aus der letzten Spalte 1 ist
  const zeigeEntgleisen =
    entgleisT0 >= 0 && (STUFEN[stufe].id === "addition" || (modus === "ueben" && aus === 1));
  if (zeigeEntgleisen) {
    const r0 = waggonRechteck(e, 0);
    const r = { x: r0.x - e.w - e.gap, y: r0.y, w: e.w, h: e.h };
    const t = weich((millis() - entgleisT0) / 1400);
    push();
    translate(r.x + r.w / 2, r.y + r.h);
    rotate(t * 0.45);
    translate(-r.w / 2 - t * 6, -r.h + t * 26);
    zeichneWaggon({ x: 0, y: 0, w: r.w, h: r.h }, 1, { neu: 9999 });
    pop();
    noStroke();
    fill(...FARBE.akzent);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(13);
    textAlign(CENTER, TOP);
    text(STUFEN[stufe].id === "subtraktion" ? "9. Bit: wird ignoriert" : "9. Waggon entgleist!", r.x + r.w / 2 - 20, e.y + 38);
    textStyle(NORMAL);
  }
}

// Überlauf-Signal neben dem Ergebnisgleis
function zeichneUeberlaufSignal(e) {
  const r = waggonRechteck(e, 7);
  const x = r.x + r.w + 112;
  const y = e.y - 96;
  let an = false;
  if (modus === "pruefung") {
    an = ueberlaufLampe;
  } else if (rechnung && rechnung.phase === "fertig") {
    if (STUFEN[stufe].id === "addition") {
      an = rechnung.uebertragAus === 1;
    } else {
      an = vorzeichenUeberlauf(zuege.A, zuege.M, rechnung.summe);
    }
  }
  if (x + 30 > P_GLEIS.x + P_GLEIS.w) {
    return;
  }
  stroke(...FARBE.schiene);
  strokeWeight(3);
  line(x, y + 30, x, e.y);
  noStroke();
  fill(...FARBE.text);
  rect(x - 13, y - 8, 26, 40, 6);
  fill(...(an ? FARBE.akzentHell : [70, 68, 64]));
  circle(x, y + 3, 15);
  fill(...(an ? [70, 68, 64] : FARBE.gruen));
  circle(x, y + 21, 15);
  fill(...FARBE.grau);
  textFont(SCHRIFT);
  textSize(11);
  textAlign(CENTER, BOTTOM);
  text("Überlauf", x, y - 12);
}

function zeichneFloatGruppen(g) {
  const gruppen = [
    { von: 0, bis: 0, name: "V", farbe: FLOAT_FARBE.v },
    { von: 1, bis: 8, name: "Exponent (8 Bit)", farbe: FLOAT_FARBE.e },
    { von: 9, bis: 31, name: "Mantisse (23 Bit)", farbe: FLOAT_FARBE.m },
  ];
  const bits = zuege.F;
  const t = floatTeile(bits);
  for (const gr of gruppen) {
    const r1 = waggonRechteck(g, gr.von);
    const r2 = waggonRechteck(g, gr.bis);
    const yk = g.y + 22;
    stroke(...gr.farbe);
    strokeWeight(2);
    line(r1.x + 2, yk, r1.x + 2, yk + 8);
    line(r1.x + 2, yk + 8, r2.x + r2.w - 2, yk + 8);
    line(r2.x + r2.w - 2, yk, r2.x + r2.w - 2, yk + 8);
    noStroke();
    fill(...gr.farbe);
    textFont(SCHRIFT);
    textStyle(BOLD);
    textSize(13);
    textAlign(CENTER, TOP);
    text(gr.name, (r1.x + r2.x + r2.w) / 2, yk + 14);
    textStyle(NORMAL);
  }
  // Werte der Gruppen über dem Zug (nur beim Üben)
  if (modus === "ueben") {
    const ry = g.y - g.h - 40;
    const rV = waggonRechteck(g, 0);
    const rE1 = waggonRechteck(g, 1);
    const rE2 = waggonRechteck(g, 8);
    const rM1 = waggonRechteck(g, 9);
    const rM2 = waggonRechteck(g, 31);
    textFont(MONO);
    textSize(13);
    textAlign(CENTER, CENTER);
    noStroke();
    fill(...FLOAT_FARBE.v);
    text(t.s ? "−" : "+", rV.x + rV.w / 2, ry);
    fill(...FLOAT_FARBE.e);
    text(`${t.e} − 127 = ${t.exponent}  →  2^${t.exponent}`, (rE1.x + rE2.x + rE2.w) / 2, ry);
    fill(...FLOAT_FARBE.m);
    text(`1 + ${floatText(t.m, 8)} = ${floatText(1 + t.m, 8)}`, (rM1.x + rM2.x + rM2.w) / 2, ry);
    // Register-Aufteilung wie bei OPC UA / Modbus
    const hex = zuHex(bits);
    textFont(SCHRIFT);
    textSize(13);
    fill(...FARBE.grau);
    textAlign(LEFT, TOP);
    text(`Speicher: 0x${hex}  ·  als zwei 16-Bit-Register: 0x${hex.slice(0, 4)} | 0x${hex.slice(4)}`, g.x0, g.y + 70);
  }
}

function zeichneHinweisBanner() {
  const p = P_GLEIS;
  textFont(SCHRIFT);
  textSize(14);
  const breite = Math.min(p.w - 60, textWidth(hinweis.text) + 40);
  const x = p.x + (p.w - breite) / 2;
  const y = p.y + p.h - 52;
  noStroke();
  fill(29, 29, 28, 230);
  rect(x, y, breite, 36, 18);
  fill(255);
  textAlign(CENTER, CENTER);
  text(hinweis.text, x + breite / 2, y + 18);
}

// =============================================================================
// Stellwerk (Erklärungen)
// =============================================================================
function zeichneStellwerk() {
  const p = P_STELL;
  panel(p);
  const x = p.x + 22;
  let y = p.y + KOPF_H + 18;
  const b = p.w - 44;

  if (modus === "pruefung") {
    zeichneSerie(x, y, b);
    return;
  }
  const id = STUFEN[stufe].id;
  y += absatz(STUFEN[stufe].ziel, x, y, b, 14, FARBE.grau) + 14;

  if (id === "binaer" || id === "hex" || id === "zweier") {
    const bits = sichtbareBits("E");
    const wert = id === "zweier" ? ausBitsVorzeichen(bits) : ausBits(bits);
    anzeigeZeile(x, y, b, "Dezimal", vz(wert), FARBE.akzent);
    y += 62;
    if (id === "hex") {
      anzeigeZeile(x, y, b, "Hexadezimal", "0x" + zuHex(bits), FARBE.blau);
      y += 62;
    }
    anzeigeZeile(x, y, b, "Dual", bitText(bits), FARBE.text, true);
    y += 62;
    textFont(MONO);
    if (id === "hex") {
      const h = zuHex(bits);
      y += absatz(`0x${h} = ${parseInt(h[0], 16)} · 16 + ${parseInt(h[1], 16)} = ${ausBits(bits)}`, x, y, b, 14, FARBE.text) + 12;
      zeichneHexTabelle(x, y, b);
    } else if (id === "zweier") {
      y += absatz("Rechenweg:", x, y, b, 14, FARBE.text) + 2;
      const schritte = rechenwegZweierSchritte(bits);
      // in Monospace, damit die Bitmuster genau untereinander stehen
      textFont(MONO);
      textSize(14);
      textAlign(LEFT, TOP);
      noStroke();
      for (let k = 0; k < schritte.length; k++) {
        const letzte = k === schritte.length - 1;
        fill(...(letzte ? FARBE.akzent : FARBE.text));
        textStyle(letzte ? BOLD : NORMAL);
        text(schritte[k], x + 12, y);
        y += 20;
      }
      textStyle(NORMAL);
      y += 10;
      y += absatz(`Ohne Vorzeichen (unsigned) gelesen wäre derselbe Zug ${ausBits(bits)}. Bereich mit Vorzeichen: −128 … +127.`, x, y, b, 13, FARBE.grau) + 8;
      absatz("Umkehrschleife: umdrehen und +1 macht aus +x ein −x und umgekehrt.", x, y, b, 13, FARBE.blass);
    } else {
      y += absatz("Rechenweg: " + rechenweg(bits), x, y, b, 14, FARBE.text) + 10;
      absatz("8 Waggons können 2⁸ = 256 verschiedene Ladungen transportieren: die Zahlen 0 … 255.", x, y, b, 13, FARBE.grau);
    }
    return;
  }

  if (id === "addition" || id === "subtraktion") {
    const sub = id === "subtraktion";
    const a = sub ? ausBitsVorzeichen(zuege.A) : ausBits(zuege.A);
    const bWert = sub ? ausBitsVorzeichen(zuege.B) : ausBits(zuege.B);
    const soll = sub ? a - bWert : a + bWert;
    anzeigeZeile(x, y, b, "Aufgabe", sub ? `${vz(a)} − ${vz(bWert)}` : `${a} + ${bWert}`, FARBE.text);
    y += 62;
    const fertig = rechnung && rechnung.phase === "fertig";
    const erg = fertig ? (sub ? ausBitsVorzeichen(rechnung.summe) : ausBits(rechnung.summe)) : null;
    anzeigeZeile(x, y, b, "Ergebniszug", fertig ? vz(erg) : "…", FARBE.akzent);
    y += 66;
    const info = rechnung && rechnung.info ? rechnung.info : sub ? "„Schritt“ drücken: Zuerst fährt B durch die Umkehrschleife." : "„Schritt“ drücken: Die Spalte ganz rechts wird zuerst addiert.";
    y += absatz(info, x, y, b, 14, FARBE.text) + 12;
    if (fertig) {
      let txt;
      if (!sub) {
        txt = rechnung.uebertragAus === 1
          ? `Richtig wäre ${soll}, aber 8 Waggons fassen höchstens 255. Der Zug zeigt ${erg} = ${soll} − 256. Das ist ein Überlauf.`
          : `${a} + ${bWert} = ${soll}: passt in 8 Bit, kein Überlauf.`;
      } else {
        const ueber = vorzeichenUeberlauf(zuege.A, zuege.M, rechnung.summe);
        txt = ueber
          ? `Richtig wäre ${vz(soll)}, das liegt außerhalb von −128 … 127. Der Zug zeigt ${vz(erg)}: Überlauf! (Zwei gleiche Vorzeichen addiert, Ergebnis hat das andere.)`
          : `${vz(a)} − ${vz(bWert)} = ${vz(soll)} ✓  Ein Übertrag aus der 8. Spalte wird bei der Subtraktion einfach ignoriert.`;
      }
      absatz(txt, x, y, b, 13, FARBE.grau);
    }
    return;
  }

  // Gleitpunkt
  const bits = zuege.F;
  const t = floatTeile(bits);
  const gespeichert = bitsZuFloat(bits);
  anzeigeZeile(x, y, b, "Gespeicherter Wert", floatText(gespeichert, 12), FARBE.akzent);
  y += 66;
  let formel;
  if (t.art === "normal") {
    formel = `(−1)^${t.s} · ${floatText(1 + t.m, 10)} · 2^${t.exponent}`;
  } else if (t.art === "null") {
    formel = "Exponent 0 und Mantisse 0: die Null";
  } else if (t.art === "denormal") {
    formel = "Exponent 0: sehr kleine Zahl ohne führende 1";
  } else if (t.art === "unendlich") {
    formel = "Exponent 255, Mantisse 0: unendlich";
  } else {
    formel = "Exponent 255, Mantisse ≠ 0: NaN (keine Zahl)";
  }
  y += absatz("= " + formel, x, y, b, 15, FARBE.text) + 12;
  y += absatz("Wert = (−1)^V · (1 + Mantisse) · 2^(Exponent − 127)", x, y, b, 13, FARBE.grau) + 14;
  if (floatEingabe !== null) {
    const fehler = gespeichert - floatEingabe;
    anzeigeZeile(x, y, b, "Eingegeben", floatText(floatEingabe, 12), FARBE.text);
    y += 62;
    if (fehler === 0) {
      absatz("Exakt darstellbar: Die Zahl lässt sich als Summe von Zweierpotenzen schreiben.", x, y, b, 13, FARBE.gruen);
    } else {
      absatz(`Nicht exakt darstellbar! Rundungsfehler: ${floatText(fehler, 12)}. Wie 1/3 im Zehnersystem hat diese Zahl im Dualsystem unendlich viele Nachkommastellen.`, x, y, b, 13, FARBE.akzent);
    }
  } else {
    absatz("Tipp: Unten eine Zahl eingeben, z. B. 0,1 – und vergleichen, was wirklich im Zug landet.", x, y, b, 13, FARBE.blass);
  }
}

function anzeigeZeile(x, y, b, titel, wert, farbe, klein) {
  noStroke();
  fill(...FARBE.flaeche2);
  rect(x, y, b, 52, 8);
  fill(...FARBE.blass);
  textFont(SCHRIFT);
  textSize(12);
  textAlign(LEFT, TOP);
  text(titel, x + 12, y + 7);
  fill(...farbe);
  textFont(MONO);
  textStyle(BOLD);
  textSize(klein ? 20 : 24);
  textAlign(LEFT, BOTTOM);
  text(wert, x + 12, y + 47);
  textStyle(NORMAL);
}

function zeichneHexTabelle(x, y, b) {
  const breite = b / 8;
  for (let i = 0; i < 16; i++) {
    const zx = x + (i % 8) * breite;
    const zy = y + Math.floor(i / 8) * 46;
    noStroke();
    fill(...(i % 2 === 0 ? FARBE.flaeche2 : FARBE.flaeche));
    rect(zx, zy, breite - 2, 42, 4);
    fill(...FARBE.blau);
    textFont(MONO);
    textStyle(BOLD);
    textSize(15);
    textAlign(CENTER, TOP);
    text(i.toString(16).toUpperCase(), zx + breite / 2 - 1, zy + 4);
    textStyle(NORMAL);
    fill(...FARBE.grau);
    textSize(10.5);
    text(bitText(zuBits(i, 4)), zx + breite / 2 - 1, zy + 24);
  }
}

// Serie in der Prüfung: fünf Signallampen
function zeichneSerie(x, y, b) {
  noStroke();
  fill(...FARBE.text);
  textFont(TITEL);
  textStyle(BOLD);
  textSize(18);
  textAlign(LEFT, TOP);
  text(`Freigabeprüfung · ${STUFEN[stufe].rang}`, x, y);
  textStyle(NORMAL);
  y += 34;
  absatz(`Das Stellwerk ist abgeschaltet – jetzt zählt, was du kannst. ${SERIE_ZIEL} richtige Antworten in Folge ergeben das Prüfsiegel. Ein Fehler setzt die Serie zurück.`, x, y, b, 14, FARBE.grau);
  y += 92;
  const abstand = b / SERIE_ZIEL;
  for (let i = 0; i < SERIE_ZIEL; i++) {
    const cx = x + abstand * (i + 0.5);
    noStroke();
    fill(...FARBE.text);
    rect(cx - 26, y, 52, 92, 10);
    fill(...(i < serie ? FARBE.gruen : [70, 68, 64]));
    circle(cx, y + 26, 34);
    fill(...(i < serie ? [70, 68, 64] : [110, 40, 46]));
    circle(cx, y + 66, 34);
    stroke(...FARBE.schiene);
    strokeWeight(4);
    line(cx, y + 92, cx, y + 130);
  }
  y += 150;
  noStroke();
  fill(...FARBE.text);
  textFont(MONO);
  textStyle(BOLD);
  textSize(22);
  textAlign(CENTER, TOP);
  text(`${serie} / ${SERIE_ZIEL}`, x + b / 2, y);
  textStyle(NORMAL);
  y += 44;
  if (freigaben[stufe]) {
    absatz("Diese Freigabe hast du schon. Weiter üben schadet nie!", x, y, b, 13, FARBE.gruen);
  }
}

// =============================================================================
// Fahrauftrag (unten links)
// =============================================================================
function zeichneAuftrag() {
  const p = P_AUFTRAG;
  p.titel = modus === "pruefung" ? "Fahrauftrag" : "Rangieren · freies Üben";
  panel(p);
  const x = p.x + 22;
  const y = p.y + KOPF_H + 16;
  if (modus === "ueben") {
    zeichneUebenHilfe(x, y);
    return;
  }
  if (!aufgabe) {
    return;
  }
  const b = 610;
  let yy = y;
  yy += absatz(aufgabe.kontext, x, yy, b, 14, FARBE.grau) + 6;
  textStyle(BOLD);
  yy += absatz(aufgabe.frage, x, yy, b, 16, FARBE.text, 23);
  textStyle(NORMAL);

  // Rückmeldung rechts
  if (rueckmeldung) {
    const rx = p.x + 660;
    const rw = p.w - 680;
    const farbe = rueckmeldung.ok ? FARBE.gruen : FARBE.akzent;
    noStroke();
    fill(...hell(farbe, 0.88));
    rect(rx, y - 4, rw, 150, 10);
    fill(...farbe);
    textFont(TITEL);
    textStyle(BOLD);
    textSize(16);
    textAlign(LEFT, TOP);
    text(rueckmeldung.ok ? "✓ " + rueckmeldung.text : "✗ " + rueckmeldung.text, rx + 14, y + 8, rw - 28);
    textStyle(NORMAL);
    absatz(rueckmeldung.loesung, rx + 14, y + 56, rw - 28, 13, FARBE.text);
  }
}

function zeichneUebenHilfe(x, y) {
  const id = STUFEN[stufe].id;
  const tipps = {
    binaer: "Von rechts nach links verdoppelt sich die Wertigkeit: 1, 2, 4, 8 … 128. Eine Zahl beladen: die größte passende Wertigkeit nehmen, abziehen, weiter mit dem Rest.",
    hex: "Ein Halbzug aus vier Waggons kann 16 Ladungen tragen: 0 … 15, als Ziffer 0 … 9 und A … F. Deshalb ist Hex die Kurzschrift für Dualzahlen.",
    addition: "Wie schriftliches Addieren: 0 + 0 = 0, 0 + 1 = 1, 1 + 1 = 10₂ (0 hinschreiben, 1 merken), 1 + 1 + 1 = 11₂. Passt das Ergebnis nicht in 8 Waggons, entsteht ein Überlauf.",
    zweier: "Negative Zahl beladen: den Betrag als Dualzahl laden, dann die Umkehrschleife benutzen (alle Waggons umdrehen, +1). Ist der vorderste Waggon beladen, ist die Zahl negativ.",
    subtraktion: "Ein Rechenwerk kann nur addieren. Deshalb wird aus A − B die Aufgabe A + (−B). Achte darauf, was mit dem Übertrag aus der 8. Spalte passiert.",
    gleitpunkt: "Eine Kommazahl wird wie in der wissenschaftlichen Schreibweise gespeichert – nur zur Basis 2: 12,5 = 1,5625 · 2³. Der Exponent wird mit +127 verschoben gespeichert.",
  };
  absatz(tipps[id], x, y, 1010, 14, FARBE.grau);
}

// =============================================================================
// Freigaben (unten rechts)
// =============================================================================
function zeichneFreigaben() {
  const p = P_FREIGABE;
  panel(p);
  const x = p.x + 18;
  let y = p.y + KOPF_H + 10;
  const anzahl = freigaben.filter((f) => f).length;
  for (let i = 0; i < STUFEN.length; i++) {
    const zy = y + i * 34;
    const ok = freigaben[i];
    // Siegel
    if (ok) {
      noStroke();
      fill(...FARBE.akzent);
      circle(x + 13, zy + 13, 24);
      fill(255);
      textFont(SCHRIFT);
      textStyle(BOLD);
      textSize(13);
      textAlign(CENTER, CENTER);
      text("✓", x + 13, zy + 14);
      textStyle(NORMAL);
    } else {
      noFill();
      stroke(...FARBE.linie);
      strokeWeight(2);
      drawingContext.setLineDash([3, 3]);
      circle(x + 13, zy + 13, 24);
      drawingContext.setLineDash([]);
    }
    noStroke();
    fill(...(i === stufe ? FARBE.akzent : ok ? FARBE.text : FARBE.blass));
    textFont(SCHRIFT);
    textStyle(i === stufe ? BOLD : NORMAL);
    textSize(14);
    textAlign(LEFT, CENTER);
    text(`${i + 1} · ${STUFEN[i].name}`, x + 36, zy + 13);
    textStyle(NORMAL);
    fill(...(ok ? FARBE.grau : FARBE.blass));
    textSize(13);
    textAlign(RIGHT, CENTER);
    text(ok ? STUFEN[i].rang : `→ ${STUFEN[i].rang}`, p.x + p.w - 20, zy + 13);
  }
  y += STUFEN.length * 34 + 2;
  noStroke();
  textFont(SCHRIFT);
  textSize(12);
  textAlign(LEFT, TOP);
  if (anzahl === STUFEN.length) {
    fill(...FARBE.akzent);
    textStyle(BOLD);
    text("Alle Freigaben erteilt: Laborserver-Bahnhof in Betrieb genommen!", x, y);
    textStyle(NORMAL);
  } else {
    fill(...FARBE.blass);
    text(`${anzahl} von ${STUFEN.length} Prüfsiegeln · Prüfsiegel gibt es in der Freigabeprüfung`, x, y);
  }
}

// großer Stempel über der Gleisanlage, wenn ein Prüfsiegel erteilt wird
function zeichneStempel() {
  if (!stempel) {
    return;
  }
  const t = millis() - stempel.t0;
  if (t > 3200) {
    stempel = null;
    return;
  }
  const p = P_GLEIS;
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h / 2;
  const fall = 1 - weich(t / 300);
  const alpha = t > 2600 ? map(t, 2600, 3200, 255, 0) : 255;
  push();
  translate(cx, cy);
  rotate(-0.18);
  scale(1 + fall * 1.5);
  noFill();
  stroke(200, 30, 58, alpha);
  strokeWeight(7);
  circle(0, 0, 250);
  strokeWeight(2.5);
  circle(0, 0, 222);
  noStroke();
  fill(200, 30, 58, alpha);
  textFont(TITEL);
  textStyle(BOLD);
  textAlign(CENTER, CENTER);
  textSize(30);
  text("FREIGEGEBEN", 0, -8);
  textSize(16);
  text(STUFEN[stempel.stufe].rang.toUpperCase(), 0, 26);
  textSize(11);
  text("Laborserver · Bit-Bahnhof", 0, 56);
  textStyle(NORMAL);
  pop();
}

// =============================================================================
// Tooltip, Fehlermeldung
// =============================================================================
function zeichneTooltip() {
  const t = waggonUnterMaus();
  if (!t || umkehr) {
    return;
  }
  const g = t.g;
  const n = zuege[g.zug].length;
  let txt;
  if (g.float) {
    const gr = floatGruppe(t.i);
    const name = gr === "v" ? "Vorzeichen" : gr === "e" ? `Exponent, Wertigkeit ${Math.pow(2, 8 - t.i)}` : `Mantisse, Wertigkeit 2^−${t.i - 8}`;
    txt = `Waggon ${t.i + 1} · ${name}`;
  } else {
    txt = g.vorzeichen && t.i === 0
      ? `Waggon 1 · Vorzeichen (beladen = negativ)`
      : `Waggon ${t.i + 1} · Wertigkeit ${wertigkeit(t.i, n)}`;
  }
  if (!g.editierbar || !istGueltigeErgebnisAnsicht(g)) {
    txt += modus === "ueben" && g.ergebnis ? " · wird berechnet" : " · fest";
  } else {
    txt += " · Klick: beladen / entladen";
  }
  const mx = mouseX / S;
  const my = mouseY / S - LEISTE;
  textFont(SCHRIFT);
  textSize(13);
  const b = textWidth(txt) + 20;
  const x = Math.min(mx + 14, W - b - 10);
  noStroke();
  fill(29, 29, 28, 235);
  rect(x, my + 16, b, 26, 6);
  fill(255);
  textAlign(LEFT, CENTER);
  text(txt, x + 10, my + 29);
}

function zeichneFehlerMeldung() {
  if (!fehlerMeldung || millis() - fehlerMeldung.t0 > 8000) {
    return;
  }
  noStroke();
  fill(200, 30, 58, 235);
  rect(24, 846, 1060, 34, 8);
  fill(255);
  textFont(SCHRIFT);
  textSize(13);
  textAlign(LEFT, CENTER);
  text("Interner Fehler (bitte Seite neu laden): " + fehlerMeldung.text, 36, 863);
}
