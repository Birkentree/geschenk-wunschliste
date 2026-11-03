# ✦ Wunschfunken – gemeinsame Geschenkwunschliste

Eine schöne, mobilfreundliche Geschenkwunschliste für Freunde und Bekannte.

**Das kann die Seite:**

- Nur die Verwaltung meldet sich an und fügt Geschenkideen mit Shop-Link, Beschreibung und optionalem Foto-Link hinzu.
- Besucher brauchen **kein Konto**. Sie sehen freie, reservierte und bestellte Geschenke.
- Ein Besucher reserviert ein Geschenk **vor dem Kauf**. Danach kann es keine zweite Person reservieren.
- Nach dem Kauf klickt die reservierende Person auf **„Ich habe es bestellt“**. Das Geschenk wird als **„Bestellt“** angezeigt.
- Wer es sich anders überlegt, kann seine Reservierung wieder freigeben.
- Die Verwaltung kann Geschenke entfernen und versehentlich reservierte/bestellte Geschenke wieder freigeben.
- Änderungen werden live und spätestens nach etwa 20 Sekunden bei anderen geöffneten Seiten sichtbar.

## Warum nicht nur GitHub?

GitHub Pages veröffentlicht die Webseite kostenlos bzw. entsprechend deinem GitHub-Tarif, stellt aber **keine gemeinsame Datenbank** für Reservierungen bereit. Dafür nutzt diese Vorlage zusätzlich **Supabase**. Dank einer atomaren Datenbankoperation kann ein Geschenk nicht zweimal gleichzeitig reserviert werden.

## 1. Supabase-Datenbank anlegen

1. Öffne [supabase.com](https://supabase.com/) und erstelle ein Projekt.
2. Öffne im Projekt den **SQL Editor**.
3. Öffne die Datei [`schema.sql`](schema.sql), kopiere den **gesamten Inhalt** und führe ihn im SQL Editor aus.
4. Lass das Schema **`private`** in den API-Einstellungen **nicht** als „Exposed schema“ freigeben. Für die API genügt `public`.

> Hinweis: Die SQL-Datei ist für ein neues Projekt gedacht. Bei bereits bestehenden Tabellen oder erneutem Ausführen können bereits vorhandene Policies gemeldet werden.

## 2. Administrator-Konto einrichten

1. In Supabase gehe zu **Authentication → Users**.
2. Lege mit **Add user** einen Nutzer mit deiner E-Mail-Adresse und einem sicheren Passwort an. Falls Supabase eine Option für die E-Mail-Bestätigung anbietet, bestätige die Adresse bzw. markiere sie als bestätigt.
3. Kopiere die **User UID**, eine lange Zeichenfolge mit Bindestrichen.
4. Führe im **SQL Editor** folgenden Befehl aus; ersetze dabei die Beispiel-UUID durch die echte User UID:

```sql
insert into public.admins (id)
values ('00000000-0000-0000-0000-000000000000');
```

Nur Benutzer, deren UUID in `public.admins` steht, dürfen die Wunschliste bearbeiten. Bitte aktiviere möglichst keine öffentlichen Benutzerregistrierungen unter **Authentication → Providers → Email**, falls du nur diesen Admin benötigst.

## 3. Öffentliche Verbindung in `config.js` eintragen

Gehe in Supabase zu den **Project Settings** bzw. zur API-/Connect-Ansicht und kopiere:

- **Project URL** (beginnt meist mit `https://`)
- **Publishable Key** (`sb_publishable_...`) oder gegebenenfalls den **anon Key** aus einem älteren Projekt

Öffne `config.js` und ersetze die beiden Beispielwerte:

```js
window.WISHLIST_CONFIG = {
  supabaseUrl: 'https://DEIN-PROJEKT.supabase.co',
  supabasePublishableKey: 'HIER-DEIN-PUBLISHABLE-KEY',
  listName: 'Unsere Geschenkwunschliste',
  intro: 'Hier findest du Geschenkideen, über die wir uns freuen. ...'
};
```

**Wichtig:** Diese beiden Werte dürfen bei einer Browser-Webseite öffentlich sein. **Niemals** `service_role`, `sb_secret_...`, Datenbankpasswörter oder dein Admin-Passwort hier eintragen!

## 4. Auf GitHub Pages veröffentlichen

1. Lade dieses Projekt als ZIP herunter und entpacke es.
2. Erstelle unter [github.com/new](https://github.com/new) ein neues Repository, z. B. `geschenk-wunschliste`.
3. Lade über **Add file → Upload files** die Dateien **aus dem entpackten Ordner** direkt ins **Hauptverzeichnis** des Repositorys (nicht nur die ZIP-Datei). `index.html` muss im Hauptverzeichnis liegen.
4. Klicke **Commit changes**.
5. Öffne **Settings → Pages**.
6. Wähle bei **Build and deployment**: **Deploy from a branch**; als Branch **main** und als Ordner **/(root)**. Speichere.
7. Deine Adresse ist üblicherweise `https://DEIN-GITHUB-NAME.github.io/geschenk-wunschliste/`.

Unter *Settings → Pages* erscheint nach erfolgreicher Veröffentlichung ein Link zur Seite. Sende **diesen Link** deinen Bekannten.

## 5. Geschenke hinzufügen und testen

1. Öffne die veröffentlichte Seite.
2. Klicke rechts oben auf **„Verwalten“** und melde dich mit deinem Supabase-Administrator-Konto an.
3. Trage einen Geschenknamen, die Shop-URL und optional Bild-URL und Beschreibung ein. Klicke auf **„Geschenk hinzufügen“**.
4. Öffne die Seite gleichzeitig auf einem anderen Gerät oder in einem privaten Browserfenster.
5. Reserviere dort das Geschenk. Auf allen Geräten erscheint es als **„Reserviert“**. Nur in dem Browser, der es reserviert hat, erscheinen **„Ich habe es bestellt“** und **„Reservierung freigeben“**.
6. Markiere den tatsächlichen Kauf als bestellt; der Status wird für alle zu **„Bestellt“**.

## Wichtig zu wissen

- **Bestellungen werden nicht automatisch aus Online-Shops erkannt.** Der Käufer muss das Geschenk nach der Bestellung selbst als „Bestellt“ markieren. Der entscheidende Schutz gegen Doppelkäufe beginnt bereits mit dem Reservieren **vorher**.
- Die Reservierungsberechtigung wird nur im **aktuellen Browser** gespeichert. Wenn jemand Browserdaten löscht oder ein anderes Gerät nutzt, kann er die eigene Reservierung nicht mehr selbst ändern; die Verwaltung kann sie zurücksetzen.
- Jeder, der die öffentliche URL kennt, kann die Liste öffnen und freie Geschenke reservieren. Eine echte Passwortsperre für Besucher ist **nicht** eingebaut. Ein `noindex`-Hinweis schützt nicht vor Personen, die den Link haben.
- Für Geschenkfotos muss eine direkte, öffentlich erreichbare `https://`-Bildadresse angegeben werden. Einige Shops verbieten die Einbindung ihrer Bilder; dann wird stattdessen ein Platzhalter angezeigt.
- Für eine öffentlich betriebene Seite können Datenschutz- und rechtliche Informationspflichten relevant sein. Insbesondere sollten keine sensiblen oder persönlichen Angaben in die Geschenktexte geschrieben werden.
- **Sicherheit:** Die Datenbank arbeitet mit Row Level Security; geheime Reservierungsschlüssel liegen nicht in der öffentlich lesbaren Tabelle. Anonyme Reservierungen sind bewusst erlaubt, daher sind absichtliche Spaß-Reservierungen nicht vollständig auszuschließen. Die Verwaltung kann sie wieder aufheben.

## Projektdateien

| Datei | Zweck |
|---|---|
| `index.html` | Webseite und Bedienoberfläche |
| `style.css` | Gestaltung inkl. Handyansicht |
| `app.js` | Anzeige, Anmeldung, Reservierung und Verwaltung |
| `config.js` | Öffentliche Supabase-Projektangaben und Wunschlistentext |
| `schema.sql` | Datenbanktabellen, Zugriffsrechte und sichere Reservierungsfunktionen |
| `README.md` | Diese Anleitung |

Die Demo funktioniert ohne Supabase als **Vorschau**, aber darin können Geschenkideen **noch nicht wirklich reserviert** werden.

## Technische Hinweise

Die Website benötigt zum Betrieb nur einen statischen Webserver wie GitHub Pages und die Supabase-API. Es gibt keine eigenen Server oder Build-Schritte. Sie verwendet [supabase-js v2](https://supabase.com/docs/reference/javascript/introduction) über ein CDN. Das Reservieren ist eine einzelne Datenbanktransaktion mit bedingtem `UPDATE` und einem geheimen Browser-Schlüssel. Die Tabellen haben RLS und explizite Berechtigungen; privilegierte SQL-Funktionen liegen im nicht exponierten Schema `private`.

**Referenzen:** [GitHub Pages – Publishing Source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [Supabase – Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase – Database Functions](https://supabase.com/docs/guides/database/functions).