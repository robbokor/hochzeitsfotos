# Hochzeitsfotos – Setup

Eigenständige, schlanke Web-App für Gäste-Fotos per QR-Code. Kein Login für Gäste,
kein App-Store, kein Build-Schritt – reines HTML/CSS/JS + Supabase.

**Bewusst getrennt von der Planungsapp.** Eigenes Supabase-Projekt, eigenes Repo,
eigene Domain. Nichts wird gemeinsam genutzt.

**Warum Supabase statt Firebase:** Firebase verlangt inzwischen bei neu erstellten
Projekten ein verknüpftes Zahlungskonto (Blaze-Tarif) – sowohl für Firestore als
auch für Cloud Storage – bevor man die Dienste überhaupt aktivieren kann, auch wenn
man am Ende nichts zahlt. Supabase braucht dafür **keine Kreditkarte** im
kostenlosen Tarif. Technik: Postgres-Datenbank + Storage + Auth in einem Projekt.

## Wie das Limit funktioniert

Jede:r Gast gibt einmal seinen Namen ein. Die Datenbank-Funktion `submit_photo`
(siehe `supabase-schema.sql`) erhöht den Zähler für diesen Namen und legt den
Foto-Eintrag **in derselben Transaktion** an – erst ab 21 Fotos schlägt der Aufruf
fehl. Das ist serverseitig erzwungen (Postgres-Funktion mit `SECURITY DEFINER`,
Gäste haben keinen direkten Zugriff auf die Tabellen), nicht nur im JavaScript.
Wer einen anderen Namen eingibt, bekommt ein neues Kontingent – das ist die bewusst
gewählte, einfache Variante (kein Gast-Login, kein Gerätezwang).

## Wie "nur Kamera, keine Galerie-Auswahl" funktioniert

Der Datei-Upload nutzt `<input type="file" capture="environment">` **ohne**
`multiple`. Auf iOS öffnet das zuverlässig direkt die Kamera-App (keine
Galerie-Option). Auf Android ist es in den meisten aktuellen Chrome-Versionen
genauso, aber nicht zu 100 % garantiert – das ist eine Grenze des Web-Standards,
kein Bug hier. Gäste nehmen jeweils ein Foto auf, laden es hoch, und tippen für
das nächste erneut auf "Foto aufnehmen" (passend zum Einwegkamera-Gefühl).

## Sichtbarkeit

Die Galerie (`gallery.html`) ist **für alle Gäste öffentlich** – jede:r mit dem
Link/QR-Code kann alle hochgeladenen Fotos sehen. `admin.html` ist zusätzlich
passwortgeschützt und erlaubt euch beiden, einzelne Fotos zu löschen
(Moderation) und den QR-Code zum Drucken anzuzeigen.

## 1. Supabase-Projekt anlegen

1. [supabase.com](https://supabase.com) → "Start your project" → mit GitHub oder
   E-Mail anmelden (keine Kreditkarte nötig für den kostenlosen Tarif).
2. "New project" → Namen vergeben (z. B. `hochzeitsfotos`), Datenbank-Passwort
   generieren lassen und **sicher notieren**, Region z. B. `Central EU (Frankfurt)`.
3. Warten, bis das Projekt bereit ist (dauert 1–2 Minuten).

## 2. API-Werte eintragen

Dashboard → Zahnrad-Symbol **"Project Settings" → "API"**. Dort stehen:

- **Project URL** → in [`js/supabase-config.js`](js/supabase-config.js) als `SUPABASE_URL`
- **anon public key** → dort als `SUPABASE_ANON_KEY`

```js
export const SUPABASE_URL = "https://euerprojekt.supabase.co";
export const SUPABASE_ANON_KEY = "eyJ...";
```

Der `anon`-Key ist **absichtlich öffentlich** im Frontend sichtbar – das ist bei
Supabase Standard. Der eigentliche Schutz kommt über die Row-Level-Security-Regeln
in Schritt 3, nicht über Geheimhaltung dieses Keys.

## 3. Datenbank-Schema einspielen

1. Dashboard → **"SQL Editor"** → "New query".
2. Inhalt von [`supabase-schema.sql`](supabase-schema.sql) hineinkopieren.
3. **Vor dem Ausführen:** Den Storage-Bucket zuerst anlegen (nächster Schritt),
   sonst schlagen die Bucket-Policies am Ende des Skripts fehl.

## 4. Storage-Bucket anlegen

1. Dashboard → **"Storage"** → "New bucket".
2. Name: **genau** `photos` (wird im Code so erwartet).
3. **"Public bucket"** aktivieren (die Galerie lädt Bilder direkt über öffentliche URLs).
4. Erstellen.
5. Jetzt zurück zum SQL Editor (Schritt 3) und das komplette `supabase-schema.sql`
   ausführen ("Run").

## 5. Admin-Konto anlegen

Dashboard → **"Authentication" → "Users" → "Add user"** → E-Mail + Passwort für
euch beide (ein gemeinsames Konto reicht) → das sind die Zugangsdaten für
`admin.html`. **"Auto Confirm User"** aktivieren, damit ihr euch sofort einloggen
könnt.

## 6. Deploy auf Netlify

1. Repo auf GitHub pushen (oder Ordner direkt bei Netlify per Drag & Drop hochladen).
2. [app.netlify.com](https://app.netlify.com) → "Add new site" → Repo verbinden.
   Build-Einstellungen: kein Build-Command nötig, Publish-Directory `.`
   (steht schon in `netlify.toml`).
3. Optional: eigene Domain/Subdomain verbinden (z. B. `fotos-eurename.de`).

## 7. QR-Code

Nach dem Deploy: `admin.html` öffnen → anmelden → Tab "QR-Code drucken".
Der QR-Code zeigt automatisch auf die aktuelle Domain (`window.location.origin`) –
kein manuelles Eintragen einer URL nötig. Einfach ausdrucken und auf die Tische stellen.

## 8. Vor der Hochzeit testen

- Mit dem eigenen Handy die `index.html`-URL öffnen (nicht `admin.html`),
  Namen eingeben, 2–3 Testfotos aufnehmen und hochladen.
- Prüfen, ob die Kamera direkt aufgeht (nicht die Galerie) – iOS und Android testen,
  falls beide im Freundeskreis vorhanden.
- `gallery.html` öffnen, prüfen ob die Testfotos erscheinen.
- Zähler testen: 20 Testfotos mit demselben Namen hochladen, prüfen ob beim
  21. Foto "Limit erreicht" kommt.
- In `admin.html` einloggen, ein Testfoto löschen, prüfen ob es aus der Galerie
  verschwindet.
- Row-Level-Security kurz gegenlesen (Dashboard → Authentication → Policies) –
  falls sie fehlen, ist die Datenbank für jeden vollständig beschreibbar.

## Bewusst nicht enthalten (v1)

- **Sammel-Download / ZIP aller Fotos.** Für v1 reicht "Bild antippen → öffnet
  Originalgröße im neuen Tab → Rechtsklick/Teilen → Speichern".
- **Gäste-Login / Geräte-Bindung.** Das Limit ist an den eingegebenen Namen
  gebunden, nicht an ein Gerät. Bei einer Hochzeit im Vertrauenskreis ausreichend.
- **PWA/Installierbarkeit.** Reine Web-Seite reicht für den Zweck "einmal scannen,
  Fotos hochladen".
- **Hartes Kamera-only-Erzwingen.** Web-Standards erlauben nur einen Hinweis
  (`capture`-Attribut) an den Browser, keine echte Garantie gegen Datei-Auswahl.
