# Návrh bezpečné optimalizace úvodní stránky

Zjištění: úvodní ilustrace `opravao-hero-v3.svg` má 159 094 B (přibližně 155 KiB) a obsahuje vložený WebP o velikosti 119 220 B. V `index.html` se používá jako CSS background (`.house-art`), takže prohlížeč se o ní dozví až po zpracování stylů.

Nejmenší změna ke zvážení: přidat do `<head>` přednačtení stejného URL přes `<link rel="preload" as="image" href="/opravao-hero-v3.svg" fetchpriority="high">`. Vzhled ani obrázek se tím nemění; žádné skripty se neodstraňují. Po nasazení je nutné porovnat měření LCP na mobilu a desktopu. Samotný preload nezaručuje LCP pod 2,5 s a před jeho přidáním je vhodné změřit, zda je právě ilustrace LCP element.

Tento návrh zatím nic nenasazuje ani nemění produkční HTML. Původní záznam DKIM/SPF report označuje za v pořádku; DMARC `p=none` se musí řešit zvlášť po kontrole autentizace všech odesílatelů.
