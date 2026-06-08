# 🤖 Katalog Robotů – Automatizovaná Správa

🔗 **[Zobrazit spuštěný katalog robotů](https://rbcx-best.github.io/katalog-robotu/)**

Tento projekt slouží jako přehledný webový katalog pro prezentaci robotů z našeho robotického kroužku. Celé řešení běží staticky na **GitHub Pages** a o veškerý backend se starají **GitHub Actions** ve spolupráci s **Python skriptem**.

---

## 🚀 Jak přidat nového robota do katalogu

Přidání nového robota je plně automatizované a nevyžaduje žádný přímý zápis do kódu.

1. **Vyplnění formuláře:**
   * Přejděte na stránku **Přidat robota** (kliknutím na tlačítko v záhlaví hlavní stránky nebo přímo na `docs/pridat.html`).
   * Zadejte název, rok a soutěž. Pokud rok nebo soutěž v seznamu chybí, zvolte možnost *"Nový rok..."* / *"Nová soutěž..."* a vyplňte název.
   * Přidejte členy týmu kliknutím na tlačítko **`+`** (můžete přidat libovolný počet polí).
   * Zaškrtněte hardware vybavení robota, případně pod mřížku dopište vlastní hardware (např. *Teploměr*) a stiskněte **`+ Přidat`**.
2. **Přesměrování na GitHub:**
   * Klikněte na tlačítko **Pokračovat na GitHub**.
   * Web vás přesměruje na vytvoření nového Issue na GitHubu s předvyplněným strukturovaným textem.
3. **Nahrání fotografie (DŮLEŽITÉ):**
   * Do textového pole na GitHubu **přetáhněte (Drag & Drop)** nebo vložte (Ctrl+V) **fotografii vašeho robota**.
   * Klikněte na **Submit new issue**.
4. **Schválení administrátorem:**
   * Administrátor (vedoucí kroužku) zkontroluje zadané informace a k danému Issue přidá štítek **`schvaleno`**.
   * GitHub Action automaticky stáhne nahranou fotku, uloží data do databáze, issue označí jako **`zpracovano`** a uzavře ji. Web se během chvíle sám zaktualizuje.

---

## 🗑️ Jak smazat robota z katalogu (Admin)

Odstranění robota probíhá bezpečně přes schvalovací proces na GitHubu, takže nemůže dojít k neoprávněnému smazání cizím uživatelem.

1. **Aktivace Admin režimu:**
   * Na hlavní stránce webu klikněte v záhlaví na tlačítko **Admin režim** (tlačítko zčervená s nápisem *Admin: Aktivní*).
   * U každé karty robota se vpravo dole zobrazí červená ikona koše (**Odstranit**).
2. **Vytvoření žádosti o smazání:**
   * Klikněte na ikonu koše u robota, kterého si přejete smazat.
   * Potvrďte výzvu v prohlížeči. Budete přesměrováni na předvyplněné GitHub Issue.
   * Klikněte na **Submit new issue**.
3. **Schválení smazání:**
   * Administrátor k tomuto Issue přidá štítek **`schvaleno`**.
   * GitHub Action automaticky **vymaže záznam robota** z databáze, **smaže jeho obrázek** ze složky `docs/images/`, issue označí jako **`zpracovano`** a uzavře ji.

---

## ⚙️ Technická struktura projektu

Projekt je postaven na jednoduché a čisté architektuře:

* **`docs/index.html`** – Hlavní stránka galerie robotů s responzivními a 100% dynamickými filtry.
* **`docs/app.js`** – Klientský JavaScript, který načítá data, vykresluje karty a spravuje dynamickou filtraci (podle roku, soutěže a hardware tagů).
* **`docs/pridat.html`** – Formulář pro vytvoření nového robota s dynamickým přidáváním členů a hardware komponent.
* **`docs/data/robots.json`** – **Hlavní databáze robotů**. Je to pole JSON objektů. Skript do něj bezpečně zapisuje (či z něj maže) bez přepsání ostatních dat.
* **`docs/images/`** – Složka, do které se automaticky ukládají stažené fotografie robotů.
* **`scripts/process_robot.py`** – Python skript běžící v GitHub Actions. Stará se o:
  * Stažení a uložení obrázků.
  * Robustní parsování klíčů z Issue.
  * Zápis / Mazání záznamů z `robots.json`.
  * Automatické zavírání a oštítkování GitHub Issues přes GitHub API / CLI.
* **`.github/workflows/process_issue.yml`** – CI/CD workflow, které spouští Python skript ve chvíli, kdy je k jakémukoliv issue přidán štítek `schvaleno`.
