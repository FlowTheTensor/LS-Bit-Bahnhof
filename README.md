# Bit-Bahnhof · Zahlensysteme

Messwerte reisen als Güterzüge zum Laborserver: Jeder Waggon ist ein Bit, **beladen = 1, leer = 0**. In sechs Freigabestufen geht es vom Lesen einer Dualzahl über Hexadezimal, Addition und Zweierkomplement bis zu Gleitpunktzahlen nach IEEE 754. Wer eine Stufe beherrscht, holt sich in der Freigabeprüfung das Prüfsiegel und steigt vom *Rangierer* bis zum *Bahnhofsvorsteher* auf.

Erstellt für den Unterricht an der Jakob-Preh-Schule ([bsnes.de](https://www.bsnes.de)), Fachschule für Elektrotechnik, Fach Informationstechnik, 1. Schuljahr.

**Live-Version:** [Hier direkt anschauen](https://flowthetensor.github.io/LS-Bit-Bahnhof/)

---

## Worum geht es?

Der Laborserver sammelt Messwerte von den Labortischen: Helligkeit, Füllstände, Temperaturen, Spannungen. Was über die Leitung kommt, sind aber keine Zahlen, sondern Bits. Erst wenn klar ist, *wie* die Bits zu lesen sind, wird daraus ein Messwert. Liest man ein Register falsch, zeigt der Monitor statt −12 °C plötzlich 65 524.

Genau das wird im 2. Schuljahr wichtig: Dann liest ein Raspberry Pi per OPC UA die Daten der Industrie-4.0-Modellanlage aus – als `UInt16`, `Int16` oder `Float`, verteilt auf 16-Bit-Register. Der Bit-Bahnhof bereitet darauf vor.

> Alle Messwerte in den Aufgaben sind erfunden und nur Anlass für die Umrechnung.

## Die sechs Freigabestufen

| Stufe | Thema | Freigabe als | Was man sieht |
|---|---|---|---|
| 1 | Binär (Dualsystem) | Rangierer | Ein Zug mit 8 Waggons, darüber die Wertigkeiten 128 … 1 |
| 2 | Hexadezimal | Weichensteller | Zwei Halbzüge (Nibbles) à 4 Waggons, darunter je eine Hex-Ziffer |
| 3 | Addition | Lokführer | Züge A und B, Überträge als kleine Kisten, Ergebniszug; bei Überlauf entgleist der 9. Waggon |
| 4 | Zweierkomplement | Fahrdienstleiter | Der vorderste Waggon zählt −128; die Umkehrschleife dreht alle Waggons um und rechnet +1 |
| 5 | Subtraktion durch Addition | Stellwerksmeister | A − B = A + (−B): B fährt durch die Umkehrschleife, dann wird addiert |
| 6 | Gleitpunkt (IEEE 754, 32 Bit) | Bahnhofsvorsteher | Langer Zug: 1 Vorzeichen-, 8 Exponent-, 23 Mantissen-Waggons |

### 1. Binär

Von rechts nach links verdoppelt sich die Wertigkeit:

| Waggon | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Wertigkeit | 128 | 64 | 32 | 16 | 8 | 4 | 2 | 1 |

Beispiel: 1010 1001₂ = 128 + 32 + 8 + 1 = 169. Mit 8 Waggons lassen sich 2⁸ = 256 Werte transportieren, also 0 … 255.

### 2. Hexadezimal

Vier Waggons können 16 verschiedene Ladungen tragen (0 … 15). Dafür gibt es genau eine Hex-Ziffer 0 … 9, A … F. Deshalb ist Hex die Kurzschrift für Dualzahlen:

1011 0100₂ → 1011 = B, 0100 = 4 → **0xB4** = 11 · 16 + 4 = 180

### 3. Addition

Wie schriftliches Addieren, nur mit zwei Ziffern:

```
0 + 0     = 0
0 + 1     = 1
1 + 1     = 10₂   (0 hinschreiben, Übertrag 1)
1 + 1 + 1 = 11₂   (1 hinschreiben, Übertrag 1)
```

Mit „Schritt“ (oder Taste →) wird Spalte für Spalte von rechts gerechnet, das Stellwerk erklärt jede Spalte. Ist das Ergebnis größer als 255, bleibt ein Übertrag aus der 8. Spalte übrig: Der 9. Waggon findet kein Gleis mehr und entgleist, das Überlauf-Signal springt auf Rot. Im Zug steht dann das Ergebnis minus 256.

### 4. Zweierkomplement

Vereinbarung: Der vorderste Waggon zählt **−128** statt +128. So reichen 8 Waggons für −128 … +127.

| Zahl | Zug |
|---|---|
| +12 | 0000 1100 |
| −12 | 1111 0100 |
| −128 | 1000 0000 |
| −1 | 1111 1111 |

Eine Zahl negieren (Umkehrschleife): **alle Waggons umdrehen, dann +1**.
+12 = 0000 1100 → umdrehen: 1111 0011 → +1: 1111 0100 = −12.

Sonderfall: −128 hat in 8 Bit kein positives Gegenstück. Schickt man −128 durch die Umkehrschleife, kommt wieder −128 heraus.

### 5. Subtraktion durch Addition

Ein Rechenwerk kann nur addieren. Aus A − B wird deshalb A + (−B). Der Ablauf im Programm:

```
① Umkehrschleife: B → −B (umdrehen, +1)
② A + (−B) Spalte für Spalte addieren
③ Übertrag aus der 8. Spalte ignorieren
```

Ein **Überlauf** liegt vor, wenn das richtige Ergebnis außerhalb von −128 … 127 liegt. Man erkennt ihn daran, dass zwei Zahlen mit gleichem Vorzeichen addiert werden und das Ergebnis das andere Vorzeichen hat (z. B. 100 − (−50) = 150 → im Zug steht −106).

### 6. Gleitpunktzahlen (IEEE 754, float)

Eine Kommazahl wird wie in der wissenschaftlichen Schreibweise gespeichert, nur zur Basis 2:

$$\text{Wert} = (-1)^V \cdot (1 + \text{Mantisse}) \cdot 2^{\,\text{Exponent} - 127}$$

| Teil | Waggons | Farbe |
|---|---|---|
| Vorzeichen V | 1 | rot |
| Exponent (um 127 verschoben) | 8 | blau |
| Mantisse (Nachkommastellen, die führende 1 wird nicht gespeichert) | 23 | grün |

Beispiel: 12,5 = 1,5625 · 2³ → V = 0, Exponent 3 + 127 = 130 = 1000 0010, Mantisse 1001 0000 … → **0x41480000**.

Unter dem Zug steht der Speicherinhalt auch als zwei 16-Bit-Register (0x4148 | 0x0000) – so kommt ein `Float` per Modbus oder OPC UA oft an.

Gibt man 0,1 ein, zeigt das Stellwerk den tatsächlich gespeicherten Wert 0,100000001490116… und den Rundungsfehler: 0,1 hat im Dualsystem unendlich viele Nachkommastellen, so wie 1/3 im Zehnersystem.

## Rangieren und Freigabeprüfung

**Rangieren · üben** (Kopfzeile links): Freies Ausprobieren. Waggons per Klick beladen, Zahlen eintippen, Zufallszüge erzeugen. Das Stellwerk rechts zeigt alle Umrechnungen und Rechenwege.

**Freigabeprüfung** (Kopfzeile rechts): Das Stellwerk wird abgeschaltet. Es kommen Fahraufträge mit einem Anlass aus dem Labor, z. B. „Kühlraum meldet: Temperatur −12 °C. Belade den Zug mit −12 im Zweierkomplement.“

- **5 richtige Antworten in Folge** ergeben das Prüfsiegel der Stufe.
- Ein Fehler setzt die Serie zurück, ebenso „Andere Aufgabe“.
- Nach jeder Antwort erscheint der Rechenweg.
- Die Prüfsiegel werden im Browser gespeichert (localStorage) und bleiben nach dem Neuladen erhalten. Mit „zurücksetzen“ im Feld *Freigaben* lassen sie sich löschen.

Aufgabenarten je Stufe:

| Stufe | Aufgaben |
|---|---|
| 1 | Dezimal → Zug beladen · Zug → Dezimal |
| 2 | Hex → Zug beladen · Zug → Hex · Hex → Dezimal (mit Notizgleis) |
| 3 | A + B beladen, Überlauf-Lampe richtig setzen (etwa jede dritte Aufgabe läuft über) |
| 4 | negative Zahl → Zug beladen · Zug → Zahl mit Vorzeichen |
| 5 | A − B beladen (Gleis −B als Notizgleis), Überlauf-Lampe richtig setzen |
| 6 | Register-Hex → Wert · Wert → 32-Waggon-Zug beladen (nur Zahlen mit kurzer Mantisse) |

## Bedienung

| Aktion | Wirkung |
|---|---|
| Stufen-Leiste (Reiter 1–6) | Freigabestufe wechseln, ✓ = Prüfsiegel vorhanden |
| Klick auf einen Waggon | beladen / entladen |
| Zahl eingeben + Enter oder „Zug beladen“ | Zug mit dieser Zahl beladen (Stufe 2 auch als 0xB4) |
| „Zufallszug“ / „Zug leeren“ | neuer zufälliger Zug / alle Waggons leer |
| „Umkehrschleife“ (Stufe 4) | Zahl negieren: umdrehen und +1, als Animation |
| „Schritt“ oder **→** (Stufen 3 und 5) | eine Spalte addieren (bei Stufe 5 zuerst die Umkehrschleife) |
| „Alles rechnen“ | bis zum Ende durchrechnen |
| Maus über einem Waggon | Nummer und Wertigkeit |
| **Enter** in der Prüfung | Antwort prüfen bzw. nächste Aufgabe |

## Ideen für den Unterricht

- **Einstieg ohne Erklärung:** Stufe 1 öffnen, Waggons anklicken lassen. Wer findet heraus, wie das Stellwerk auf 169 kommt? Wie viele verschiedene Ladungen sind möglich?
- **Größte Zahl:** Welche Zahl transportiert ein voll beladener Zug? Was würde ein 9. Waggon bringen?
- **Hex als Kurzschrift:** Warum stehen in Fehlermeldungen, MAC-Adressen und im Hex-Editor Hex-Zahlen und keine Dualzahlen? (Vergleich mit dem Netzwerk-Dojo: MAC-Adressen.)
- **Überlauf erleben:** 200 + 100 rechnen lassen. Warum zeigt der Zug 44? Wo kommt ein solcher Fehler in der Praxis vor (Zählerstände, Ariane 5)?
- **Brücke zu C++:** `unsigned char x = 200 + 100;` und `char y = 127 + 1;` ausgeben lassen. Das Ergebnis mit Stufe 3 bzw. 4 erklären.
- **−128-Rätsel:** −128 durch die Umkehrschleife schicken. Warum klappt das nicht?
- **Subtraktion:** 25 − 40 Schritt für Schritt. Was passiert mit dem Übertrag aus der 8. Spalte – und warum ist das bei der Subtraktion kein Fehler?
- **Gleitpunkt-Rundung:** 0,1 eingeben und den gespeicherten Wert ansehen. In C++ `0.1 + 0.2 == 0.3` prüfen lassen.
- **Register lesen:** 0x41C80000 in Stufe 6 decodieren. Was würde ein Programm anzeigen, das dieselben 32 Bit als Ganzzahl liest? (Vorbereitung OPC UA im 2. Schuljahr.)
- **Freigabeprüfung als Wettbewerb:** Wer hat zuerst alle sechs Siegel? Geeignet als Wiederholung vor der Stegreifaufgabe.

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Seite, bindet Schriften, p5.js und die Skripte ein |
| `style.css` | Gestaltung im Corporate Design der Schule |
| `bits.js` | Rechnen mit Bits: Umrechnen, Addieren, Zweierkomplement, IEEE 754 – reines JavaScript, ohne p5 |
| `daten.js` | Freigabestufen, Texte und Aufgabengeneratoren der Freigabeprüfung |
| `ui.js` | Knöpfe und Eingabefelder |
| `sketch.js` | Ablauf, Zeichnen (Gleise, Waggons, Stellwerk), Erklärtexte |
| `assets/logo-jps.png` | Logo der Jakob-Preh-Schule |
| `libraries/p5.min.js` | p5.js (lokal, damit die Seite auch offline läuft) |

Eine neue Aufgabenart lässt sich in `daten.js` ergänzen: in der passenden Funktion `aufgabeXxx()` einen weiteren Fall anlegen. Die Anlässe aus dem Labor stehen in den Listen `SENSOREN_POSITIV`, `SENSOREN_VORZEICHEN` und `SENSOREN_FLOAT`. Die Zahl der nötigen richtigen Antworten in Folge steht in `SERIE_ZIEL`.

## Lokal starten

Am einfachsten in VS Code mit der Erweiterung **Live Server**: Rechtsklick auf `index.html` → „Open with Live Server“.

## Technische Hinweise

- Läuft mit **p5.js 1.x** (lokal mitgeliefert) und **p5.js 2.x**. Dafür verzichtet der Code bewusst auf Funktionen, die sich zwischen den Versionen geändert haben (z. B. `preload`, `loadFont`).
- Die Schriften (Quicksand, Inter, JetBrains Mono) kommen von Google Fonts. Ohne Internet weicht die Seite automatisch auf Systemschriften aus.
- Alle Schleifen haben geschweifte Klammern: Der p5-Web-Editor baut in Schleifen eine Endlosschleifen-Sicherung ein, die bei Schleifen ohne Klammern fehlschlägt.
- Fehler in `draw()` werden abgefangen und als Hinweis angezeigt, statt das Programm einzufrieren.
- Die Gleitpunkt-Umrechnung nutzt `DataView.setFloat32` und zeigt damit genau den Wert, den auch ein C++-`float` speichert.
- Die Prüfsiegel liegen im `localStorage` des Browsers. Wo das nicht verfügbar ist, gelten sie nur bis zum Neuladen.
