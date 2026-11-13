// =============================================================================
//  daten.js – Freigabestufen, Erklärtexte und Prüfungsaufgaben
// =============================================================================
//  Jede Stufe hat einen Rang (Freigabestufe), Texte für das Stellwerk und
//  einen Aufgabengenerator für die Freigabeprüfung.
//  Eine neue Aufgabenart lässt sich ergänzen, indem man in der passenden
//  Funktion aufgabeXxx() einen weiteren Fall hinzufügt.
// =============================================================================

// Wie viele richtige Antworten in Folge für das Prüfsiegel nötig sind
const SERIE_ZIEL = 5;

const STUFEN = [
  {
    id: "binaer",
    name: "Binär",
    rang: "Rangierer",
    bits: 8,
    untertitel: "Stufe 1 · Dualzahlen lesen und bilden",
    gleisTitel: "Gleis 1 · Ein Zug, acht Waggons",
    ziel: "Waggons beladen und lesen: Jeder volle Waggon steht für eine 1, jeder leere für eine 0.",
  },
  {
    id: "hex",
    name: "Hexadezimal",
    rang: "Weichensteller",
    bits: 8,
    untertitel: "Stufe 2 · Je vier Waggons ergeben eine Hex-Ziffer",
    gleisTitel: "Gleis 2 · Zwei Halbzüge à vier Waggons",
    ziel: "Je vier Waggons (ein Halbzug, ein Nibble) ergeben genau eine Hexadezimalziffer 0 … F.",
  },
  {
    id: "addition",
    name: "Addition",
    rang: "Lokführer",
    bits: 8,
    untertitel: "Stufe 3 · Zwei Züge zusammenrechnen, Übertrag für Übertrag",
    gleisTitel: "Gleise A, B und Ergebnis",
    ziel: "Spalte für Spalte von rechts addieren. Ein Übertrag rollt als kleine Kiste eine Spalte nach links.",
  },
  {
    id: "zweier",
    name: "Zweierkomplement",
    rang: "Fahrdienstleiter",
    bits: 8,
    untertitel: "Stufe 4 · Negative Zahlen: umdrehen und +1",
    gleisTitel: "Gleis 4 · Zug mit Vorzeichen-Waggon",
    ziel: "Vorzeichen-Waggon (VZ) beladen → Zahl negativ. Betrag finden: alle Waggons umdrehen, dann +1.",
  },
  {
    id: "subtraktion",
    name: "Subtraktion",
    rang: "Stellwerksmeister",
    bits: 8,
    untertitel: "Stufe 5 · Subtrahieren durch Addieren des Zweierkomplements",
    gleisTitel: "Gleise A, B, −B und Ergebnis",
    ziel: "A − B = A + (−B): Zug B fährt durch die Umkehrschleife und wird dann zu A addiert.",
  },
  {
    id: "gleitpunkt",
    name: "Gleitpunkt",
    rang: "Bahnhofsvorsteher",
    bits: 32,
    untertitel: "Stufe 6 · Gleitpunktzahlen nach IEEE 754 (32 Bit, float)",
    gleisTitel: "Gleis 6 · Langer Zug mit 32 Waggons",
    ziel: "1 Vorzeichen-Waggon, 8 Exponent-Waggons, 23 Mantissen-Waggons: so reisen Kommazahlen.",
  },
];

// -----------------------------------------------------------------------------
// Messwerte aus dem Labor – damit jede Aufgabe einen Anlass hat
// -----------------------------------------------------------------------------
const SENSOREN_POSITIV = [
  { ort: "Labortisch 1", groesse: "Helligkeitsstufe", einheit: "" },
  { ort: "Labortisch 2", groesse: "Füllstand des Wassertanks", einheit: " %" },
  { ort: "Labortisch 3", groesse: "Rohwert des Drucksensors", einheit: "" },
  { ort: "Labortisch 4", groesse: "Drehzahlstufe des Lüfters", einheit: "" },
  { ort: "Werkstatt", groesse: "Anzahl gezählter Werkstücke", einheit: " Stück" },
  { ort: "Serverschrank", groesse: "Lüfter-PWM-Wert", einheit: "" },
];

const SENSOREN_VORZEICHEN = [
  { ort: "Kühlraum", groesse: "Temperatur", einheit: " °C" },
  { ort: "Außenfühler", groesse: "Temperatur", einheit: " °C" },
  { ort: "Labortisch 3", groesse: "Abweichung vom Sollwert", einheit: " mV" },
  { ort: "Waage", groesse: "Nullpunktfehler", einheit: " g" },
  { ort: "Förderband", groesse: "Positionsfehler", einheit: " mm" },
];

const SENSOREN_FLOAT = [
  { ort: "Labortisch 2", groesse: "Spannung", einheit: " V" },
  { ort: "Klimasensor", groesse: "Temperatur", einheit: " °C" },
  { ort: "Labortisch 4", groesse: "Strom", einheit: " A" },
  { ort: "Durchflussmesser", groesse: "Durchfluss", einheit: " l/min" },
];

// Gleitpunktwerte, die sich exakt darstellen lassen (zum Lesen)
const FLOAT_LESEN = [0.5, 0.75, 1.5, 2.5, 3.25, 6.5, 10, 12.5, 25, -0.375, -6.5, 100, 0.125, -2.75, 21.5, -12];
// … und solche mit kurzer Mantisse (zum selbst Beladen)
const FLOAT_LADEN = [0.5, 1.5, 2.5, 6.5, -3, 10, 0.75, -0.375, 12, -1.25];

function zufall(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function waehle(liste) {
  return liste[zufall(0, liste.length - 1)];
}

// Antwortvergleich für Dezimalzahlen ("−45", "-45", " 45 ")
function gleicheZahl(eingabe, soll) {
  const z = leseZahl(eingabe);
  return !isNaN(z) && Math.abs(z - soll) < 1e-9;
}

// Antwortvergleich für Hex ("B4", "0xb4", "b4")
function gleichesHex(eingabe, soll) {
  const sauber = String(eingabe).trim().replace(/^0x/i, "").replace(/\s/g, "").toUpperCase();
  return sauber !== "" && /^[0-9A-F]+$/.test(sauber) && parseInt(sauber, 16) === parseInt(soll, 16);
}

// Rechenweg einer vorzeichenlosen Dualzahl, z. B. "128 + 32 + 8 + 1 = 169"
function rechenweg(bits) {
  const teile = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i]) {
      teile.push(String(wertigkeit(i, bits.length)));
    }
  }
  return teile.length ? `${teile.join(" + ")} = ${ausBits(bits)}` : "kein Waggon beladen = 0";
}

// Rechenweg im Zweierkomplement als einzelne Schritte:
//   positiv: Vorzeichen-Waggon leer, Rest normal lesen
//   negativ: Vorzeichen-Waggon beladen → umdrehen, +1, Betrag lesen, Minus davor
function rechenwegZweierSchritte(bits) {
  const erg = ausBitsVorzeichen(bits);
  if (bits[0] === 0) {
    return ["Vorzeichen-Waggon leer → positiv", `${rechenweg(bits)}`];
  }
  const um = invertiere(bits);
  const betrag = zweierkomplement(bits);
  return [
    "Vorzeichen-Waggon beladen → negativ",
    `umdrehen: ${bitText(um)}`,
    `+1:       ${bitText(betrag)} = ${ausBits(betrag)}`,
    `Minus davor → ${vz(erg)}`,
  ];
}

// Rechenweg im Zweierkomplement in einer Zeile
function rechenwegVorzeichen(bits) {
  return rechenwegZweierSchritte(bits)
    .map((s) => s.replace(/\s+/g, " "))
    .join(", ");
}

// Zahl mit echtem Minuszeichen
function vz(z) {
  return z < 0 ? `−${-z}` : String(z);
}

// =============================================================================
// Aufgabengeneratoren
// =============================================================================
//  Rückgabe:
//    art       "laden" (Zug beladen, dann „Abfahrt melden“) oder
//              "lesen" (Antwort ins Textfeld schreiben)
//    kontext   Anlass aus dem Labor
//    frage     Arbeitsauftrag
//    vorgabe   Züge, die schon auf den Gleisen stehen: {A, B, E, F}
//    soll      Sollbits (laden) bzw. Sollwert (lesen)
//    ueberlauf true/false, wenn zusätzlich die Überlauf-Lampe gesetzt werden muss
//    pruefe    Funktion(eingabe) → true/false (nur lesen)
//    loesung   Rechenweg für die Rückmeldung
// =============================================================================
function neueAufgabe(stufenIndex, letzteArt) {
  const id = STUFEN[stufenIndex].id;
  if (id === "binaer") {
    return aufgabeBinaer(letzteArt);
  }
  if (id === "hex") {
    return aufgabeHex(letzteArt);
  }
  if (id === "addition") {
    return aufgabeAddition();
  }
  if (id === "zweier") {
    return aufgabeZweier(letzteArt);
  }
  if (id === "subtraktion") {
    return aufgabeSubtraktion();
  }
  return aufgabeGleitpunkt(letzteArt);
}

// Art abwechseln, damit nicht dreimal hintereinander dasselbe kommt
function andereArt(letzte, arten) {
  const moeglich = arten.filter((a) => a !== letzte);
  return waehle(moeglich.length ? moeglich : arten);
}

function aufgabeBinaer(letzte) {
  const art = andereArt(letzte, ["laden", "lesen"]);
  const s = waehle(SENSOREN_POSITIV);
  const n = zufall(1, 255);
  const bits = zuBits(n, 8);
  if (art === "laden") {
    return {
      art,
      kontext: `${s.ort} meldet: ${s.groesse} ${n}${s.einheit}.`,
      frage: `Belade den Zug so, dass er die Zahl ${n} zum Laborserver bringt.`,
      vorgabe: { E: zuBits(0, 8) },
      soll: bits,
      loesung: `${n} = ${bitText(bits)}₂, denn ${rechenweg(bits)}.`,
    };
  }
  return {
    art,
    kontext: `Von ${s.ort} rollt ein Zug ein (${s.groesse}).`,
    frage: "Welche Dezimalzahl transportiert dieser Zug?",
    vorgabe: { E: bits },
    soll: n,
    pruefe: (e) => gleicheZahl(e, n),
    loesung: `${bitText(bits)}₂ = ${rechenweg(bits)}.`,
  };
}

function aufgabeHex(letzte) {
  const art = andereArt(letzte, ["laden", "lesenHex", "lesenDez"]);
  const s = waehle(SENSOREN_POSITIV);
  const n = zufall(1, 255);
  const bits = zuBits(n, 8);
  const hex = zuHex(bits);
  const halb = `${bitText(bits.slice(0, 4))} = ${hex[0]} und ${bitText(bits.slice(4))} = ${hex[1]}`;
  if (art === "laden") {
    return {
      art: "laden",
      kontext: `Das Protokoll von ${s.ort} zeigt den Wert 0x${hex}.`,
      frage: `Belade den Zug mit 0x${hex}.`,
      vorgabe: { E: zuBits(0, 8) },
      soll: bits,
      loesung: `Jede Hex-Ziffer ergibt einen Halbzug: ${halb}.`,
    };
  }
  if (art === "lesenHex") {
    return {
      art: "lesen",
      kontext: `Von ${s.ort} rollt ein Zug ein (${s.groesse}).`,
      frage: "Welchen Hex-Wert transportiert dieser Zug? (z. B. 3F)",
      vorgabe: { E: bits },
      soll: hex,
      pruefe: (e) => gleichesHex(e, hex),
      loesung: `Halbzüge einzeln lesen: ${halb} → 0x${hex}.`,
    };
  }
  return {
    art: "lesen",
    kontext: `Das Protokoll von ${s.ort} zeigt den Wert 0x${hex}.`,
    frage: `Welche Dezimalzahl ist 0x${hex}? (Der Zug ist dein Notizgleis.)`,
    vorgabe: { E: zuBits(0, 8) },
    hexAnzeige: hex,
    notiz: true,
    soll: n,
    pruefe: (e) => gleicheZahl(e, n),
    loesung: `0x${hex} = ${parseInt(hex[0], 16)} · 16 + ${parseInt(hex[1], 16)} = ${n}.`,
  };
}

function aufgabeAddition() {
  // in etwa jeder dritten Aufgabe entsteht ein Überlauf
  const mitUeberlauf = Math.random() < 0.33;
  let a;
  let b;
  do {
    a = zufall(10, 245);
    b = zufall(5, 245);
  } while (mitUeberlauf ? a + b <= 255 : a + b > 255);
  const A = zuBits(a, 8);
  const B = zuBits(b, 8);
  const r = addiere(A, B);
  const s = waehle(SENSOREN_POSITIV);
  return {
    art: "laden",
    kontext: `Der Laborserver addiert zwei Zählerstände aus „${s.ort}“.`,
    frage: "Belade den Ergebniszug mit A + B. Gibt es einen Überlauf über 8 Bit, schalte die Überlauf-Lampe ein.",
    vorgabe: { A, B, E: zuBits(0, 8) },
    soll: r.summe,
    ueberlauf: r.uebertragAus === 1,
    loesung:
      r.uebertragAus === 1
        ? `${a} + ${b} = ${a + b} passt nicht in 8 Bit (max. 255). Der 9. Waggon entgleist, im Zug bleibt ${ausBits(r.summe)}.`
        : `${a} + ${b} = ${a + b} = ${bitText(r.summe)}₂, kein Überlauf.`,
  };
}

function aufgabeZweier(letzte) {
  const art = andereArt(letzte, ["laden", "lesen"]);
  const s = waehle(SENSOREN_VORZEICHEN);
  // meist negative Werte, ab und zu ein positiver zur Kontrolle
  const n = Math.random() < 0.8 ? -zufall(1, 128) : zufall(1, 127);
  const bits = zuBitsVorzeichen(n, 8);
  if (art === "laden") {
    const weg =
      n < 0
        ? `${vz(-n)} = ${bitText(zuBits(-n, 8))}₂ → umdrehen: ${bitText(invertiere(zuBits(-n, 8)))} → +1: ${bitText(bits)}`
        : `positive Zahl, Vorzeichen-Waggon bleibt leer: ${bitText(bits)}`;
    return {
      art,
      kontext: `${s.ort} meldet: ${s.groesse} ${vz(n)}${s.einheit}.`,
      frage: `Belade den Zug mit ${vz(n)} im Zweierkomplement.`,
      vorgabe: { E: zuBits(0, 8) },
      soll: bits,
      loesung: `${weg}.`,
    };
  }
  return {
    art,
    kontext: `Von ${s.ort} rollt ein Zug ein (${s.groesse}).`,
    frage: "Welche Zahl transportiert der Zug (Zweierkomplement)? Tipp: Vorzeichen-Waggon beladen → umdrehen, +1, Minus davor.",
    vorgabe: { E: bits },
    soll: n,
    pruefe: (e) => gleicheZahl(e, n),
    loesung: `${bitText(bits)}: ${rechenwegVorzeichen(bits)}.`,
  };
}

function aufgabeSubtraktion() {
  // meist ohne Überlauf, gelegentlich mit
  const mitUeberlauf = Math.random() < 0.2;
  let a;
  let b;
  do {
    a = zufall(-100, 120);
    b = zufall(-100, 120);
  } while (mitUeberlauf ? a - b >= -128 && a - b <= 127 : a - b < -128 || a - b > 127);
  const A = zuBitsVorzeichen(a, 8);
  const B = zuBitsVorzeichen(b, 8);
  const minusB = zweierkomplement(B);
  const r = addiere(A, minusB);
  const ueber = a - b < -128 || a - b > 127;
  const s = waehle(SENSOREN_VORZEICHEN);
  return {
    art: "laden",
    kontext: `Der Laborserver berechnet eine Differenz für „${s.ort}“: ${vz(a)} − ${vz(b)}.`,
    frage: "Belade den Ergebniszug mit A − B (8 Bit, Zweierkomplement). Liegt das Ergebnis außerhalb von −128 … 127, schalte die Überlauf-Lampe ein.",
    vorgabe: { A, B, E: zuBits(0, 8) },
    soll: r.summe,
    ueberlauf: ueber,
    loesung: ueber
      ? `${vz(a)} − ${vz(b)} = ${vz(a - b)} liegt außerhalb von −128 … 127: Überlauf! Im Zug steht ${bitText(r.summe)} = ${vz(ausBitsVorzeichen(r.summe))}.`
      : `−B = ${bitText(minusB)}, A + (−B) = ${bitText(r.summe)} = ${vz(a - b)}.`,
  };
}

function aufgabeGleitpunkt(letzte) {
  const art = andereArt(letzte, ["laden", "lesen"]);
  const s = waehle(SENSOREN_FLOAT);
  if (art === "lesen") {
    const w = waehle(FLOAT_LESEN);
    const bits = floatZuBits(w);
    const t = floatTeile(bits);
    return {
      art,
      kontext: `${s.ort} liefert per OPC UA einen float-Wert (${s.groesse}), Register 0x${zuHex(bits)}.`,
      frage: `Welcher Wert kommt an? (Einheit${s.einheit} weglassen, Komma erlaubt)`,
      vorgabe: { F: bits },
      soll: w,
      pruefe: (e) => gleicheZahl(e, w),
      loesung: `Vorzeichen ${t.s}, Exponent ${t.e} − 127 = ${t.exponent}, Mantisse 1 + ${floatText(t.m, 10)}: ${t.s ? "−" : ""}${floatText(1 + t.m, 10)} · 2^${t.exponent} = ${floatText(w, 10)}.`,
    };
  }
  const w = waehle(FLOAT_LADEN);
  const bits = floatZuBits(w);
  const t = floatTeile(bits);
  return {
    art,
    kontext: `${s.ort} soll den Wert ${floatText(w, 10)}${s.einheit} als float zum Laborserver schicken.`,
    frage: `Belade den 32-Waggon-Zug mit ${floatText(w, 10)}. Tipp: Zahl als 1,xxx · 2^n schreiben.`,
    vorgabe: { F: zuBits(0, 32) },
    soll: bits,
    loesung: `${floatText(w, 10)} = ${t.s ? "−" : ""}${floatText(1 + t.m, 10)} · 2^${t.exponent} → Vorzeichen ${t.s}, Exponent ${t.exponent} + 127 = ${t.e} = ${bitText(bits.slice(1, 9))}, Mantisse ${bitText(bits.slice(9, 17))} …`,
  };
}

// für Tests mit Node.js
if (typeof module !== "undefined") {
  module.exports = { STUFEN, SERIE_ZIEL, neueAufgabe, rechenweg, rechenwegVorzeichen, rechenwegZweierSchritte, gleicheZahl, gleichesHex, vz };
}
