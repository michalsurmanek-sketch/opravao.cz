# Opravao.cz — provozní model

## Jak služba vydělává

- Zákazník zadá poptávku zdarma.
- Správce ověří, že kontakt funguje, oprava patří do nabízeného oboru a je v oblasti působnosti.
- Ověřený kontakt lze nabídnout nejvýše třem schváleným opravářům. Opravář před přijetím vidí základ zadání; předání kontaktu je nutné provést pouze při splnění podmínek uvedených ve smlouvě.
- Poplatek se účtuje opraváři až po jeho přijetí kvalifikované poptávky. Výchozí pilotní ceny jsou 149 Kč za běžnou a 249 Kč za urgentní poptávku; správce je může měnit.
- Neplatný kontakt, duplicitní žádost, poptávka mimo obor/oblast nebo požadavek, který opravář odmítne před převzetím kontaktu, se neúčtuje.
- Zákazník za zadání ani zprostředkování neplatí. Provize z ceny zakázky, předplatné a placené profily jsou vypnuté; lze je zapnout později, ale nemají se kombinovat s poplatkem za tentýž kontakt bez jasné volby partnera.

Ceny jsou počáteční testovací návrh, ne ověřená tržní sazba. Před ostrým účtováním je potřeba potvrdit je v partnerské smlouvě a na fakturačních dokladech.

## Denní postup

1. Nové poptávky se ukládají do společné databáze Plotao, ale jsou označené zdrojem `opravao.cz`. Opravao administrace načítá pouze tento zdroj.
2. Správce zavolá zákazníkovi nebo ověří e-mail, místo, typ opravy a naléhavost. Záznam doplní o odpovědnou osobu a další krok.
3. V sekci Opraváři zkontroluje schválení, obor, kraj a individuální sazbu.
4. V sekci Předání zapíše vybraného opraváře. Kontakt se předává podle dohodnutého postupu; systém zatím neodesílá automatickou nabídku opraváři.
5. Po potvrzení přijetí se vytvoří výnosová položka k ruční fakturaci. Správce označí fakturu a následně úhradu. Účetní doklad musí vystavit používaný fakturační/účetní systém.
6. Zákazník se může přihlásit do klientského účtu ověřeným e-mailem, který uvedl v poptávce, a sledovat stav a další krok.

## Přístup a bezpečnost

- `/admin.html` je dostupné pouze přihlášenému účtu `michalsurmanek@seznam.cz`; autorizaci znovu ověřuje serverová Edge Function.
- `/ucet.html` vyžaduje Supabase Auth a potvrzený e-mail. Serverová funkce vrací jen Opravao poptávky odpovídající ověřenému e-mailu.
- Tabulky administrace mají zapnuté RLS a přímý přístup rolí `anon` a `authenticated` je odebraný. Data čte a mění pouze kontrolovaná serverová funkce.
- Veřejný klíč Supabase v HTML je publishable/anon klíč; service-role klíč není ve webu.

## Co je nutné před plným ostrým provozem doplnit

- V Supabase Auth povolit redirect URL `https://opravao.cz/ucet.html` a `https://www.opravao.cz/ucet.html`, aby potvrzení registrace a obnovení hesla vracelo zákazníka na klientský účet.
- Doplnit ověřené údaje provozovatele, zásady ochrany osobních údajů a partnerskou smlouvu včetně definice kvalifikované poptávky, okamžiku účtování a reklamačního postupu.
- Otestovat potvrzení registrace, obnovu hesla, e-mailové notifikace a přesné chování klientského účtu na produkční doméně.
- Nastavit skutečné e-mailové oznámení zákazníkovi a interní upozornění; samotný záznam v administraci není potvrzovací e-mail.
