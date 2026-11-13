// =============================================================================
//  bits.js – Rechnen mit Bits (reines JavaScript, ohne p5)
// =============================================================================
//  Ein Zug ist ein Array aus 0 und 1. Index 0 ist der vorderste Waggon links
//  und damit das höchstwertige Bit (MSB), der letzte Index ist das LSB.
// =============================================================================

// Zahl (0 … 2^n − 1) → Bits
function zuBits(zahl, n) {
  const bits = [];
  for (let i = n - 1; i >= 0; i--) {
    bits.push(Math.floor(zahl / Math.pow(2, i)) % 2);
  }
  return bits;
}

// Bits → vorzeichenlose Zahl
function ausBits(bits) {
  let wert = 0;
  for (let i = 0; i < bits.length; i++) {
    wert = wert * 2 + bits[i];
  }
  return wert;
}

// Bits → Zahl im Zweierkomplement (MSB zählt negativ)
function ausBitsVorzeichen(bits) {
  const n = bits.length;
  const ohne = ausBits(bits);
  return bits[0] === 1 ? ohne - Math.pow(2, n) : ohne;
}

// Zahl im Zweierkomplement (−2^(n−1) … 2^(n−1) − 1) → Bits
function zuBitsVorzeichen(zahl, n) {
  const modul = Math.pow(2, n);
  return zuBits(((zahl % modul) + modul) % modul, n);
}

// Wertigkeit des Bits an Position i (vorzeichenlos)
function wertigkeit(i, n) {
  return Math.pow(2, n - 1 - i);
}

// Wertigkeit im Zweierkomplement: das MSB zählt −2^(n−1)
function wertigkeitVorzeichen(i, n) {
  return i === 0 ? -Math.pow(2, n - 1) : wertigkeit(i, n);
}

// Bits → Hex-Text, z. B. [1,0,1,1, 0,1,0,0] → "B4"
function zuHex(bits) {
  let txt = "";
  for (let i = 0; i < bits.length; i += 4) {
    txt += ausBits(bits.slice(i, i + 4)).toString(16).toUpperCase();
  }
  return txt;
}

// Hex-Text → Bits (Länge n), "0x" und Leerzeichen werden ignoriert
function hexZuBits(hex, n) {
  const sauber = String(hex).replace(/^0x/i, "").replace(/\s/g, "");
  return zuBits(parseInt(sauber, 16), n);
}

// Alle Bits umdrehen (Einerkomplement)
function invertiere(bits) {
  return bits.map((b) => 1 - b);
}

// Addition Spalte für Spalte von rechts, liefert auch alle Überträge.
// uebertrag[i] = Übertrag, der IN Spalte i hineinkommt (von rechts).
// uebertragAus = Übertrag aus der höchsten Spalte (9. Bit).
function addiere(a, b) {
  const n = a.length;
  const summe = new Array(n).fill(0);
  const uebertrag = new Array(n).fill(0);
  let c = 0;
  for (let i = n - 1; i >= 0; i--) {
    uebertrag[i] = c;
    const s = a[i] + b[i] + c;
    summe[i] = s % 2;
    c = s >= 2 ? 1 : 0;
  }
  return { summe, uebertrag, uebertragAus: c };
}

// Zweierkomplement: invertieren, dann +1
function zweierkomplement(bits) {
  const eins = new Array(bits.length).fill(0);
  eins[bits.length - 1] = 1;
  return addiere(invertiere(bits), eins).summe;
}

// Überlauf im Zweierkomplement: zwei gleiche Vorzeichen, Ergebnis anderes
function vorzeichenUeberlauf(a, b, summe) {
  return a[0] === b[0] && summe[0] !== a[0];
}

// -----------------------------------------------------------------------------
// Gleitpunktzahlen nach IEEE 754 (32 Bit, "float")
// -----------------------------------------------------------------------------
// Zahl → 32 Bits
function floatZuBits(zahl) {
  const puffer = new DataView(new ArrayBuffer(4));
  puffer.setFloat32(0, zahl);
  return zuBits(puffer.getUint32(0), 32);
}

// 32 Bits → Zahl (so, wie sie tatsächlich gespeichert ist)
function bitsZuFloat(bits) {
  const puffer = new DataView(new ArrayBuffer(4));
  puffer.setUint32(0, ausBits(bits));
  return puffer.getFloat32(0);
}

// Zerlegung in Vorzeichen, Exponent und Mantisse
function floatTeile(bits) {
  const s = bits[0];
  const e = ausBits(bits.slice(1, 9));
  const mBits = bits.slice(9);
  let m = 0;
  for (let i = 0; i < mBits.length; i++) {
    m += mBits[i] * Math.pow(2, -(i + 1));
  }
  let art = "normal";
  if (e === 0) {
    art = ausBits(mBits) === 0 ? "null" : "denormal";
  } else if (e === 255) {
    art = ausBits(mBits) === 0 ? "unendlich" : "nan";
  }
  return { s, e, m, art, exponent: e - 127 };
}

// Betrag einer (normalen) float-Zahl als Dualzahl mit Komma, zum Erklären:
//   ganz      Ziffern links vom Komma, z. B. [1,1,0,0] bei 12,5
//   nach      Ziffern rechts vom Komma, z. B. [1]
//   mantisse  gespeicherte Nachkommastellen ohne Nullen am Ende, z. B. [1,0,0,1]
//   exponent  um wie viele Stellen das Komma verschoben wird (z. B. 3)
// Für Null, sehr kleine Zahlen, ∞ und NaN gibt es keine solche Zerlegung → null
function floatDual(bits) {
  const t = floatTeile(bits);
  if (t.art !== "normal") {
    return null;
  }
  const mBits = bits.slice(9);
  const mantisse = mBits.slice(0, mBits.lastIndexOf(1) + 1);
  const ziffern = [1].concat(mantisse);
  const e = t.exponent;
  let ganz;
  let nach;
  if (e >= 0) {
    ganz = ziffern.slice(0, e + 1);
    while (ganz.length < e + 1) {
      ganz.push(0);
    }
    nach = ziffern.slice(e + 1);
  } else {
    ganz = [0];
    nach = new Array(-e - 1).fill(0).concat(ziffern);
  }
  return { ganz, nach, mantisse, exponent: e };
}

// Gleitpunktwert lesbar machen, ohne wissenschaftliche Schreibweise bei
// "normalen" Größen; exakte Dezimaldarstellung bis 20 Nachkommastellen
function floatText(wert, stellen) {
  if (!isFinite(wert)) {
    return isNaN(wert) ? "NaN" : wert > 0 ? "+∞" : "−∞";
  }
  if (wert === 0) {
    return Object.is(wert, -0) ? "−0" : "0";
  }
  const betrag = Math.abs(wert);
  if (betrag >= 1e7 || betrag < 1e-6) {
    return wert.toExponential(stellen || 6).replace("-", "−");
  }
  let txt = wert.toFixed(stellen === undefined ? 20 : stellen);
  if (txt.indexOf(".") >= 0) {
    txt = txt.replace(/0+$/, "").replace(/\.$/, "");
  }
  return txt.replace("-", "−").replace(".", ",");
}

// Zahleingabe aus einem Textfeld: Komma oder Punkt, Minus auch als "−"
function leseZahl(txt) {
  const sauber = String(txt).trim().replace(/\s/g, "").replace("−", "-").replace(",", ".");
  if (sauber === "" || !/^[-+]?(\d+\.?\d*|\.\d+)$/.test(sauber)) {
    return NaN;
  }
  return parseFloat(sauber);
}

// Bits als Text mit Leerzeichen alle 4 Stellen
function bitText(bits, gruppe) {
  const g = gruppe || 4;
  let txt = "";
  for (let i = 0; i < bits.length; i++) {
    if (i > 0 && i % g === 0) {
      txt += " ";
    }
    txt += bits[i];
  }
  return txt;
}

// für Tests mit Node.js
if (typeof module !== "undefined") {
  module.exports = {
    zuBits, ausBits, ausBitsVorzeichen, zuBitsVorzeichen, wertigkeit, wertigkeitVorzeichen,
    zuHex, hexZuBits, invertiere, addiere, zweierkomplement, vorzeichenUeberlauf, floatDual,
    floatZuBits, bitsZuFloat, floatTeile, floatText, leseZahl, bitText,
  };
}
