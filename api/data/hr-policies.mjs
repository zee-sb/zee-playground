// HR policy library — Acme Corp.
// Each policy has multilingual title + summary + category, full EN content,
// and selected DE content for flagship policies. The orchestrator can rely on
// the LLM to translate EN content on the fly into other languages at runtime.

export const HR_POLICIES = [
  // ─────────────────────────────── 1. PTO ───────────────────────────────
  {
    id: 'pto',
    categoryKey: 'time_off',
    owner: 'People Operations',
    contact: 'people@acme.com',
    lastUpdated: '2026-01-15',
    version: '4.2',
    effectiveDate: '2026-02-01',
    regions: ['US', 'EU', 'UK', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL'],
    related: ['parental-leave', 'sick-leave', 'public-holidays'],
    tags: ['pto', 'vacation', 'leave', 'time off', 'holiday', 'urlaub', 'urlaubstage', 'congés', 'vacaciones', 'ferie', 'verlof', 'urlop'],
    title: {
      en: 'Paid Time Off (PTO) Policy',
      de: 'Urlaubsregelung',
      fr: 'Politique de congés payés',
      es: 'Política de vacaciones pagadas',
      it: 'Politica ferie retribuite',
      nl: 'Vakantieregeling',
      pl: 'Polityka urlopu wypoczynkowego',
    },
    summary: {
      en: 'Annual leave entitlement, accrual, request process, rollover limits, and payout on exit.',
      de: 'Urlaubsanspruch, Aufbau, Antragsverfahren, Übertrag und Auszahlung beim Austritt.',
      fr: 'Droits aux congés, acquisition, demande, report et paiement au départ.',
      es: 'Derechos de vacaciones, acumulación, solicitud, traspaso y liquidación a la salida.',
      it: 'Diritti alle ferie, maturazione, richiesta, riporto e liquidazione in uscita.',
      nl: 'Vakantierechten, opbouw, aanvraag, overdracht en uitbetaling bij vertrek.',
      pl: 'Wymiar urlopu, naliczanie, wniosek, przeniesienie i wypłata przy odejściu.',
    },
    content: {
      en: `# Paid Time Off (PTO) Policy

## Entitlement
All full-time employees accrue **25 working days** of paid annual leave per calendar year (US: 20 days; UK & EU: 25 days; DE: 30 days statutory minimum), prorated for partial years and part-time schedules. New hires accrue from their first day.

## Accrual
PTO accrues monthly at 1/12 of the annual entitlement. Newly accrued days become available on the first working day of each month. Negative balances are not permitted except in pre-approved emergencies.

## Requesting time off
Submit requests via the People app at least **two weeks in advance** for absences of three or more days, or **48 hours in advance** for one or two days. Manager approval is required and is normally granted within two business days. For absences longer than 10 working days, VP approval is also required.

## Carry-over
Up to **10 unused days** may be carried into the following calendar year and must be taken by **March 31**. Unused days beyond that cap expire on December 31.

## Payout
Accrued, unused PTO is paid out at the employee's base daily rate upon termination, redundancy, or end of contract, in line with local statutory minimums.

## Public holidays
Public holidays observed at the employee's primary work location are paid days off and **do not** count against PTO balance. See the *Public Holidays* policy for the country list.

## Sickness during PTO
If an employee falls ill during a scheduled PTO absence and provides a medical certificate, the affected days are converted to sick leave and credited back to the PTO balance.

## Contact
Questions to People Operations at people@acme.com or your local HRBP.`,
      de: `# Urlaubsregelung

## Anspruch
Alle Vollzeitmitarbeitenden erhalten **25 Arbeitstage** bezahlten Jahresurlaub pro Kalenderjahr (Deutschland: 30 Tage gesetzlicher Mindestanspruch; UK & EU: 25 Tage; US: 20 Tage), anteilig für unterjährige Eintritte und Teilzeit. Neue Mitarbeitende erwerben den Anspruch ab dem ersten Arbeitstag.

## Aufbau
Der Urlaubsanspruch wird monatlich zu 1/12 des Jahresanspruchs aufgebaut. Neu erworbene Tage stehen am ersten Werktag des Monats zur Verfügung. Negative Salden sind nur in genehmigten Notfällen zulässig.

## Antragstellung
Anträge sind über die People-App **mindestens zwei Wochen** im Voraus für Abwesenheiten von drei oder mehr Tagen einzureichen, bzw. **48 Stunden** im Voraus für ein bis zwei Tage. Die Genehmigung durch die Führungskraft erfolgt in der Regel innerhalb von zwei Werktagen. Für Abwesenheiten über 10 Arbeitstage ist zusätzlich die Genehmigung des VP erforderlich.

## Übertrag
Bis zu **10 nicht genommene Tage** können ins Folgejahr übertragen werden und müssen bis zum **31. März** genommen werden. Darüber hinausgehende Tage verfallen am 31. Dezember.

## Auszahlung
Aufgelaufener, nicht genommener Urlaub wird bei Beendigung des Arbeitsverhältnisses zum täglichen Grundgehalt ausgezahlt, mindestens nach den örtlichen gesetzlichen Vorgaben.

## Feiertage
Gesetzliche Feiertage am Hauptarbeitsort sind bezahlte freie Tage und **werden nicht** auf das Urlaubskonto angerechnet. Siehe *Feiertagsregelung* für die Länderliste.

## Krankheit im Urlaub
Bei Erkrankung während eines geplanten Urlaubs werden die betroffenen Tage gegen Vorlage eines ärztlichen Attests in Krankheitstage umgewandelt und dem Urlaubskonto gutgeschrieben.

## Kontakt
Fragen an People Operations unter people@acme.com oder den lokalen HRBP.`,
    },
  },

  // ───────────────────────────── 2. Parental leave ─────────────────────────────
  {
    id: 'parental-leave',
    categoryKey: 'time_off',
    owner: 'People Operations',
    contact: 'people@acme.com',
    lastUpdated: '2026-04-01',
    version: '3.0',
    effectiveDate: '2026-06-01',
    regions: ['US', 'EU', 'UK', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL'],
    related: ['pto', 'sick-leave'],
    tags: ['parental', 'maternity', 'paternity', 'baby', 'eltern', 'elternzeit', 'congé parental', 'permiso parental', 'congedo parentale', 'ouderschapsverlof', 'urlop rodzicielski'],
    title: {
      en: 'Parental Leave Policy',
      de: 'Elternzeitregelung',
      fr: 'Politique de congé parental',
      es: 'Política de permiso parental',
      it: 'Politica di congedo parentale',
      nl: 'Beleid Ouderschapsverlof',
      pl: 'Polityka urlopu rodzicielskiego',
    },
    summary: {
      en: '16 weeks fully paid for primary caregivers, 6 weeks for secondary, with flexible scheduling and gradual return-to-work options.',
      de: '16 Wochen voll bezahlt für die Hauptbezugsperson, 6 Wochen für die zweite Bezugsperson, mit flexibler Planung und schrittweiser Rückkehr.',
      fr: '16 semaines à plein salaire pour le parent principal, 6 semaines pour le second, avec planning flexible et reprise progressive.',
      es: '16 semanas totalmente remuneradas para cuidador principal, 6 para secundario, con planificación flexible y reincorporación gradual.',
      it: '16 settimane retribuite per il caregiver principale, 6 per il secondario, con pianificazione flessibile e rientro graduale.',
      nl: '16 weken volledig betaald voor primaire verzorger, 6 weken voor secundaire, met flexibele planning en geleidelijke terugkeer.',
      pl: '16 tygodni w pełni płatnych dla głównego opiekuna, 6 tygodni dla drugiego, z elastycznym harmonogramem i stopniowym powrotem.',
    },
    content: {
      en: `# Parental Leave Policy

## Eligibility
All employees who have been with Acme Corp for **6 months or more** at the expected birth, adoption, or fostering date are eligible. Applies regardless of gender, marital status, or family structure.

## Duration & pay
- **Primary caregivers**: 16 weeks fully paid leave.
- **Secondary caregivers**: 6 weeks fully paid leave.
- Statutory entitlements in Germany, France, Spain, Italy, Netherlands, Poland, and the UK are layered on top where they exceed Acme's policy. Employees never receive less than the statutory minimum.

## Timing
Leave must commence within **12 months** of the birth, adoption, or fostering placement and may be taken in up to two blocks. The first block must include the day of birth/placement (or the immediate medical/adoption period that follows).

## Notification
Notify your manager and People Operations at least **8 weeks** before the planned start date. Earlier notice is welcome and helps with cover planning.

## Return to work
A gradual return is supported: up to 4 weeks at 60–80% of normal hours, fully paid. Returning employees may also request a permanent reduced-hours arrangement subject to manager approval.

## Bonding leave for non-birth parents
Non-birth parents are entitled to a **2-week bonding leave** at full pay within the first 6 months, in addition to the 6-week secondary caregiver leave.

## Adoption & fostering
Same entitlements apply to legal adoption and long-term fostering placements (12 months or more).

## Stillbirth & loss
Employees who experience a stillbirth, late-term loss, or the death of a child within the first year of life are entitled to the **full primary caregiver leave** plus an additional 4 weeks of bereavement leave, fully paid.`,
      de: `# Elternzeitregelung

## Berechtigung
Alle Mitarbeitenden, die bei der erwarteten Geburt, Adoption oder Pflegeaufnahme **mindestens 6 Monate** bei Acme Corp beschäftigt sind. Gilt unabhängig von Geschlecht, Familienstand oder Familienform.

## Dauer & Bezahlung
- **Hauptbezugsperson**: 16 Wochen voll bezahlt.
- **Zweite Bezugsperson**: 6 Wochen voll bezahlt.
- Gesetzliche Ansprüche in Deutschland (Elternzeit/Elterngeld), Frankreich, Spanien, Italien, Niederlande, Polen und UK werden zusätzlich gewährt, sofern sie über die Acme-Regelung hinausgehen. Mitarbeitende erhalten nie weniger als das gesetzliche Minimum.

## Zeitliche Lage
Die Elternzeit muss innerhalb von **12 Monaten** nach Geburt, Adoption oder Pflegeaufnahme beginnen und kann in bis zu zwei Blöcken genommen werden. Der erste Block muss den Tag der Geburt/Aufnahme (oder die unmittelbare medizinische/adoptionsbedingte Phase) umfassen.

## Mitteilung
Informieren Sie Ihre Führungskraft und People Operations spätestens **8 Wochen** vor dem geplanten Beginn. Frühere Mitteilungen sind willkommen.

## Rückkehr in den Beruf
Ein schrittweiser Wiedereinstieg wird unterstützt: bis zu 4 Wochen bei 60–80 % der regulären Stunden, voll bezahlt. Rückkehrende Mitarbeitende können zudem eine dauerhafte Teilzeitvereinbarung beantragen.

## Bonding-Zeit für nicht gebärende Elternteile
Nicht gebärende Elternteile haben Anspruch auf eine **2-wöchige Bonding-Zeit** bei voller Bezahlung innerhalb der ersten 6 Monate, zusätzlich zu den 6 Wochen für die zweite Bezugsperson.

## Adoption & Pflege
Die gleichen Ansprüche gelten für rechtliche Adoption und langfristige Pflege (12 Monate oder länger).

## Totgeburt & Verlust
Mitarbeitende mit einer Totgeburt, einem späten Verlust oder dem Tod eines Kindes im ersten Lebensjahr haben Anspruch auf die **volle Elternzeit der Hauptbezugsperson** plus 4 Wochen zusätzliche Trauerzeit bei voller Bezahlung.`,
    },
  },

  // ───────────────────────────── 3. Sick leave ─────────────────────────────
  {
    id: 'sick-leave',
    categoryKey: 'time_off',
    owner: 'People Operations',
    contact: 'people@acme.com',
    lastUpdated: '2025-09-12',
    version: '2.4',
    effectiveDate: '2025-10-01',
    regions: ['US', 'EU', 'UK', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL'],
    related: ['pto', 'parental-leave'],
    tags: ['sick', 'medical', 'illness', 'krank', 'krankheit', 'malade', 'enfermedad', 'malattia', 'ziek', 'choroba'],
    title: {
      en: 'Sick Leave & Medical Absence',
      de: 'Krankheits- und Genesungsurlaub',
      fr: 'Arrêt maladie et absences médicales',
      es: 'Baja por enfermedad y ausencia médica',
      it: 'Congedo per malattia e assenze mediche',
      nl: 'Ziekteverlof en medisch verlof',
      pl: 'Zwolnienie lekarskie i nieobecność medyczna',
    },
    summary: {
      en: 'Up to 10 days self-certified sick leave per year; longer absences require a medical certificate. Full pay for first 6 weeks.',
      de: 'Bis zu 10 selbsterklärte Krankheitstage pro Jahr; längere Abwesenheiten erfordern ein ärztliches Attest. Volle Bezahlung für die ersten 6 Wochen.',
      fr: "Jusqu'à 10 jours d'arrêt maladie auto-déclarés par an ; au-delà, certificat médical requis. Plein salaire pendant les 6 premières semaines.",
      es: 'Hasta 10 días de baja autocertificada al año; más allá se requiere certificado médico. Salario completo durante las primeras 6 semanas.',
      it: 'Fino a 10 giorni di malattia autocertificata all\'anno; oltre serve certificato medico. Retribuzione piena per le prime 6 settimane.',
      nl: 'Tot 10 zelfgerapporteerde ziektedagen per jaar; bij langere afwezigheid is een medisch attest vereist. Volledig loon de eerste 6 weken.',
      pl: 'Do 10 dni samocertyfikowanego zwolnienia rocznie; dłuższa nieobecność wymaga zaświadczenia lekarskiego. Pełne wynagrodzenie przez pierwsze 6 tygodni.',
    },
    content: {
      en: `# Sick Leave & Medical Absence

## Reporting
Notify your manager as soon as possible on the first day of illness — by phone or chat is preferred. Log the absence in the People app the same day.

## Self-certification
Up to **10 working days** of self-certified sick leave per calendar year, taken as single days or short consecutive periods. No medical certificate required.

## Medical certification
Absences longer than 3 consecutive working days, or any single-day absence on a Monday/Friday/working day adjacent to a public holiday, require a medical certificate from a qualified practitioner. Submit the certificate to People Operations within 5 working days.

## Pay during sickness
- Weeks 1–6: 100% of normal pay.
- Weeks 7–26: 80% of normal pay (or statutory rate, whichever is higher).
- Beyond 26 weeks: subject to long-term disability insurance and a return-to-work plan with People Operations.

## Mental health
Mental health conditions are treated identically to physical illness under this policy. Acme provides confidential access to the Employee Assistance Programme (EAP) at no cost — see the *Wellbeing* page in the People app.

## Doctor's appointments
Routine appointments should be scheduled outside working hours where possible. Where this is not possible, up to 4 hours per appointment may be taken as paid leave with manager notice.

## Return to work
After absences of 5 or more working days, a brief return-to-work conversation with the manager is required. People Operations can support phased returns and reasonable adjustments.`,
    },
  },

  // ───────────────────────────── 4. Remote work ─────────────────────────────
  {
    id: 'remote-work',
    categoryKey: 'work_arrangements',
    owner: 'People Operations',
    contact: 'people@acme.com',
    lastUpdated: '2026-03-01',
    version: '5.1',
    effectiveDate: '2026-04-01',
    regions: ['US', 'EU', 'UK'],
    related: ['business-travel', 'workplace-conduct'],
    tags: ['remote', 'hybrid', 'home office', 'wfh', 'fernarbeit', 'homeoffice', 'télétravail', 'teletrabajo', 'lavoro remoto', 'thuiswerken', 'praca zdalna'],
    title: {
      en: 'Remote & Hybrid Work Policy',
      de: 'Regelung für Remote- und Hybridarbeit',
      fr: 'Politique de télétravail et travail hybride',
      es: 'Política de trabajo remoto e híbrido',
      it: 'Politica del lavoro da remoto e ibrido',
      nl: 'Beleid Thuiswerken & Hybride Werken',
      pl: 'Polityka pracy zdalnej i hybrydowej',
    },
    summary: {
      en: 'Hybrid by default — up to 3 remote days per week with manager approval. Full-remote requires VP approval and a 6-month review.',
      de: 'Hybrid als Standard — bis zu 3 Remote-Tage pro Woche mit Genehmigung der Führungskraft. Vollständig remote erfordert VP-Genehmigung und eine Bewertung nach 6 Monaten.',
      fr: 'Hybride par défaut — jusqu\'à 3 jours en télétravail par semaine avec accord du manager. Le télétravail complet exige l\'accord VP et une revue à 6 mois.',
      es: 'Híbrido por defecto — hasta 3 días remotos a la semana con aprobación del manager. El remoto total requiere aprobación de VP y revisión a los 6 meses.',
      it: 'Ibrido per default — fino a 3 giorni in remoto a settimana con approvazione del manager. Full-remote richiede approvazione VP e revisione a 6 mesi.',
      nl: 'Standaard hybride — tot 3 thuiswerkdagen per week met goedkeuring manager. Volledig op afstand vereist VP-goedkeuring en evaluatie na 6 maanden.',
      pl: 'Domyślnie hybrydowo — do 3 dni zdalnych tygodniowo za zgodą menedżera. Praca w pełni zdalna wymaga zgody VP i przeglądu po 6 miesiącach.',
    },
    content: {
      en: `# Remote & Hybrid Work Policy

## Default model
Acme operates as a hybrid-first company. Most employees are expected to work from their assigned office **at least 2 days per week**, ideally including team anchor days set by their function lead.

## Remote days
Up to **3 remote working days per week** are available with manager approval and a stable home setup. The standard expectation is core hours (10:00–16:00 local time) with reasonable response time on Slack and email.

## Full-remote
Full-remote arrangements are exceptional and require:
1. VP-level approval after a written business case.
2. A demonstrated track record of independent delivery (typically 12 months in role).
3. A 6-month review with the manager and HRBP.
4. A documented work location compliant with local employment law and Acme's data security policy.

## Equipment & home office stipend
- One-off home office stipend: **€500 / $500** (or local equivalent), claimable via Expensify with receipts.
- Annual top-up: €100 for ergonomic accessories.
- Acme-issued laptop, monitor, and accessories remain Acme property and must be returned on exit.

## Cross-border remote work
Remote work from a country other than your contracted country is permitted for up to **30 calendar days per year**, subject to manager approval and notification of People Operations at least 2 weeks in advance. Permanent relocations are handled separately under the *Relocation* policy.

## Health, safety & compliance
Employees are responsible for a safe, ergonomic, and confidential home workspace. Acme will provide a self-assessment checklist and reasonable accommodations on request.

## Reverting to office
Acme reserves the right to revert any remote arrangement to in-office work if performance, collaboration, or compliance concerns arise, with at least 4 weeks' notice.`,
    },
  },

  // ───────────────────────────── 5. Business travel ─────────────────────────────
  {
    id: 'business-travel',
    categoryKey: 'travel',
    owner: 'Finance',
    contact: 'travel@acme.com',
    lastUpdated: '2026-02-20',
    version: '6.0',
    effectiveDate: '2026-03-01',
    regions: ['US', 'EU', 'UK'],
    related: ['expense-reimbursement', 'remote-work'],
    tags: ['travel', 'flight', 'hotel', 'expense', 'per diem', 'reise', 'spesen', 'voyage', 'frais', 'viaje', 'viaggio', 'reizen', 'podróż'],
    title: {
      en: 'Business Travel & Expense Policy',
      de: 'Reise- und Spesenrichtlinie',
      fr: 'Politique des voyages d\'affaires et des frais',
      es: 'Política de viajes de negocios y gastos',
      it: 'Politica viaggi di lavoro e spese',
      nl: 'Beleid Zakenreizen & Onkosten',
      pl: 'Polityka podróży służbowych i wydatków',
    },
    summary: {
      en: 'Pre-approval for trips >$1,000. Economy class for flights under 6 hours; business class for longer or red-eye flights. Per diem covers meals.',
      de: 'Vorabgenehmigung für Reisen über 1.000 €. Economy bei Flügen unter 6 Stunden, Business bei längeren oder Nachtflügen. Tagespauschale deckt Mahlzeiten ab.',
      fr: 'Accord préalable pour voyages > 1 000 €. Économique pour vols < 6 h ; affaires au-delà ou vols de nuit. Indemnité journalière pour les repas.',
      es: 'Aprobación previa para viajes > 1.000 €. Económica para vuelos < 6 h; ejecutiva para más largos o nocturnos. Dieta diaria para comidas.',
      it: 'Approvazione preventiva per viaggi > 1.000 €. Economy per voli < 6 ore; Business per voli più lunghi o notturni. Diaria per i pasti.',
      nl: 'Vooraf goedkeuring voor reizen > €1.000. Economy voor vluchten < 6 uur; business voor langere/nachtvluchten. Dagvergoeding voor maaltijden.',
      pl: 'Wymagana zgoda na podróże > 1000 €. Ekonomiczna dla lotów < 6h; klasa biznes dla dłuższych lub nocnych. Dieta dzienna na posiłki.',
    },
    content: {
      en: `# Business Travel & Expense Policy

## Pre-approval
Any trip with total expected cost above **$1,000 / €1,000** requires written manager approval before booking. International trips additionally require notification of People Operations for duty-of-care purposes.

## Booking
- Use Acme's preferred travel platform (TravelPerk).
- Book at least **14 days** in advance where possible.
- Choose the lowest reasonable fare; refundable fares only when plans are uncertain.

## Flights
- **Economy** for flights under 6 hours.
- **Premium economy** allowed for flights 6–10 hours.
- **Business class** for flights over 10 hours, overnight (red-eye) flights, or where required by medical accommodation.
- Loyalty programme rewards may be retained by the employee but must not influence booking choices.

## Lodging
Reasonable mid-tier hotels (typically up to **$250 / €230 per night**, higher in tier-1 cities). Acme does not reimburse minibar, in-room movies, or non-business spa charges.

## Meals & per diem
- Standard per diem: **$70 / €65 per day** (€90 in Switzerland, Norway, and tier-1 cities).
- Receipts required for any single meal over €40.
- Alcohol is reimbursable only at moderate levels with clients/customers.

## Ground transport
Public transport, taxis, and rideshare are reimbursable. Use of personal vehicles is reimbursed at local statutory mileage rates.

## Bleisure (combined business + personal)
Adding personal days to a business trip is permitted as long as Acme's costs are not increased. Personal lodging, meals, and onward travel are at the employee's expense.

## Submitting expenses
Submit via Expensify within **30 days** of return. Receipts required for any expense over €25. Late submissions may not be reimbursed.`,
    },
  },

  // ───────────────────────────── 6. Code of conduct ─────────────────────────────
  {
    id: 'code-of-conduct',
    categoryKey: 'conduct',
    owner: 'Legal & People',
    contact: 'ethics@acme.com',
    lastUpdated: '2025-11-01',
    version: '7.1',
    effectiveDate: '2025-11-15',
    regions: ['Global'],
    related: ['anti-harassment', 'whistleblower'],
    tags: ['conduct', 'ethics', 'harassment', 'verhalten', 'ethik', 'belästigung', 'conduite', 'éthique', 'conducta', 'condotta', 'gedrag', 'kodeks'],
    title: {
      en: 'Code of Conduct',
      de: 'Verhaltenskodex',
      fr: 'Code de conduite',
      es: 'Código de conducta',
      it: 'Codice di condotta',
      nl: 'Gedragscode',
      pl: 'Kodeks postępowania',
    },
    summary: {
      en: 'Standards for respectful behavior, conflict-of-interest disclosure, and reporting channels including a confidential whistleblower hotline.',
      de: 'Standards für respektvolles Verhalten, Offenlegung von Interessenkonflikten und Meldewege einschließlich vertraulicher Whistleblower-Hotline.',
      fr: 'Normes de comportement respectueux, déclaration des conflits d\'intérêts et canaux de signalement, y compris une ligne lanceur d\'alerte.',
      es: 'Normas de respeto, declaración de conflictos de interés y canales de denuncia, incluido un canal confidencial.',
      it: 'Standard di rispetto, dichiarazione conflitti d\'interesse e canali di segnalazione, inclusa una hotline whistleblower riservata.',
      nl: 'Standaarden voor respectvol gedrag, melding van belangenverstrengeling en kanalen waaronder een vertrouwelijke klokkenluiderslijn.',
      pl: 'Standardy szacunku, ujawnianie konfliktów interesów i kanały zgłaszania wraz z poufną infolinią dla sygnalistów.',
    },
    content: {
      en: `# Code of Conduct

## Respect & inclusion
Acme expects all employees, contractors, and visitors to treat each other with dignity. Discrimination, harassment, bullying, or retaliation of any kind — based on race, ethnicity, gender identity, sexual orientation, religion, age, disability, nationality, or any other protected characteristic — is strictly prohibited and grounds for termination.

## Anti-harassment
Sexual harassment, including unwelcome advances, requests for favors, and inappropriate verbal or physical conduct, is never tolerated. Managers receive mandatory annual training and must address issues promptly.

## Conflicts of interest
Disclose any outside business interest, board seat, family relationship with a vendor, or financial position in a competitor that could create a conflict — actual or perceived. Use the *Conflicts Disclosure* form in the People app.

## Gifts & hospitality
You may accept business-meal hospitality of reasonable value. Gifts above **€50** must be declared. Cash, gift cards, and gifts to public officials are never permitted.

## Confidentiality
Treat customer data, employee data, financial information, product roadmaps, and unannounced strategic plans as confidential. Do not disclose to family, friends, or social media. Confidentiality obligations survive termination.

## Use of company assets
Company laptops, accounts, and credentials are for business use. Limited personal use is acceptable; commercial side ventures using company assets are not.

## Reporting concerns
- Speak to your manager or HRBP first where you feel safe doing so.
- Use the **EthicsPoint hotline** (independent, anonymous, multi-language) for serious concerns: ethics@acme.com or +1-800-555-0199.
- The Whistleblower Policy guarantees protection from retaliation for good-faith reports.

## Enforcement
Violations are investigated promptly and confidentially. Sanctions range from coaching and written warnings to termination of employment and legal action.`,
    },
  },

  // ───────────────────────────── 7. Performance & comp ─────────────────────────────
  {
    id: 'performance-reviews',
    categoryKey: 'performance',
    owner: 'People Operations',
    contact: 'people@acme.com',
    lastUpdated: '2026-01-10',
    version: '4.0',
    effectiveDate: '2026-02-01',
    regions: ['Global'],
    related: ['onboarding', 'learning-development'],
    tags: ['performance', 'review', 'salary', 'bonus', 'leistung', 'beurteilung', 'gehalt', 'évaluation', 'salaire', 'desempeño', 'salario', 'valutazione', 'beoordeling', 'ocena'],
    title: {
      en: 'Performance Reviews & Compensation',
      de: 'Leistungsbeurteilung und Vergütung',
      fr: 'Évaluations de performance et rémunération',
      es: 'Evaluación del desempeño y retribución',
      it: 'Valutazione delle performance e retribuzione',
      nl: 'Beoordelingen & Beloning',
      pl: 'Oceny wyników i wynagrodzenie',
    },
    summary: {
      en: 'Twice-yearly reviews (April & October), continuous feedback culture, annual salary review, and performance-linked bonus program.',
      de: 'Halbjährliche Beurteilungen (April & Oktober), Feedbackkultur, jährliche Gehaltsüberprüfung und leistungsabhängige Bonusregelung.',
      fr: 'Évaluations semestrielles (avril & octobre), culture du feedback, revue salariale annuelle, prime liée à la performance.',
      es: 'Evaluaciones semestrales (abril y octubre), cultura de feedback, revisión salarial anual y bono ligado al desempeño.',
      it: 'Valutazioni semestrali (aprile e ottobre), cultura del feedback, revisione salariale annuale e bonus legato alle performance.',
      nl: 'Halfjaarlijkse beoordelingen (april & oktober), feedbackcultuur, jaarlijkse salarisbeoordeling en prestatiegebonden bonus.',
      pl: 'Oceny półroczne (kwiecień i październik), kultura informacji zwrotnej, roczny przegląd wynagrodzeń i premia za wyniki.',
    },
    content: {
      en: `# Performance Reviews & Compensation

## Cadence
Acme runs **two formal performance cycles per year**, with calibration in April and October. Lightweight monthly check-ins between manager and employee are mandatory.

## What's reviewed
- **Outcomes**: progress against quarterly objectives.
- **Craft**: technical/functional excellence in role.
- **Values & collaboration**: how the work was done — feedback, ownership, customer focus.
- **Growth**: development against the career framework.

## Ratings
Five-point scale: *Below*, *Approaches*, *Meets*, *Exceeds*, *Far Exceeds*. Calibration ensures consistency across teams. Forced distributions are not used.

## Compensation review
A single annual compensation review takes place each **April**, informed by the H2 (October) and H1 (April) cycles. Reviews consider:
- Performance rating
- Market data from Radford and Mercer benchmarks
- Internal pay equity (gender, ethnicity, role, level)

## Bonus
- **Individual bonus**: 0–15% of base salary, depending on performance rating.
- **Company bonus**: 0–10% of base salary, tied to annual revenue and retention targets.
- Bonuses are paid in May for the prior fiscal year.

## Equity
RSU grants are reviewed annually. Top performers and critical roles receive additional retention grants on a 4-year vesting schedule with a 1-year cliff.

## Promotions
Promotion decisions happen at the April calibration. Promotion submissions are written by the manager, reviewed by the manager's manager, and calibrated cross-functionally before final approval.

## Pay transparency
Acme publishes salary bands by level and country to all employees. Pay equity audits are run twice yearly and the summary is shared with the company.`,
    },
  },

  // ───────────────────────────── 8. Onboarding ─────────────────────────────
  {
    id: 'onboarding',
    categoryKey: 'lifecycle',
    owner: 'People Operations',
    contact: 'onboarding@acme.com',
    lastUpdated: '2025-12-05',
    version: '3.3',
    effectiveDate: '2026-01-01',
    regions: ['Global'],
    related: ['performance-reviews', 'learning-development'],
    tags: ['onboarding', 'new hire', 'probation', 'einarbeitung', 'probezeit', 'intégration', 'incorporación', 'onboarding', 'inwerkperiode', 'wdrożenie', 'okres próbny'],
    title: {
      en: 'Onboarding & Probation Policy',
      de: 'Einarbeitung und Probezeit',
      fr: 'Intégration et période d\'essai',
      es: 'Incorporación y período de prueba',
      it: 'Onboarding e periodo di prova',
      nl: 'Inwerken & Proefperiode',
      pl: 'Wdrożenie i okres próbny',
    },
    summary: {
      en: '90-day onboarding program, paired buddy, structured 30-60-90 plan, end of probation review at day 90.',
      de: '90-Tage-Einarbeitungsprogramm, fester Buddy, strukturierter 30-60-90-Plan, Probezeit-Abschlussgespräch am Tag 90.',
      fr: 'Programme d\'intégration de 90 jours, buddy attribué, plan structuré 30-60-90, revue de fin de période d\'essai au jour 90.',
      es: 'Programa de incorporación de 90 días, buddy asignado, plan 30-60-90, revisión al final del período de prueba al día 90.',
      it: 'Programma di onboarding di 90 giorni, buddy dedicato, piano 30-60-90, revisione fine periodo di prova al giorno 90.',
      nl: 'Inwerkprogramma van 90 dagen, vaste buddy, 30-60-90-plan, evaluatie einde proeftijd op dag 90.',
      pl: 'Program wdrożenia na 90 dni, przypisany buddy, plan 30-60-90, ocena na koniec okresu próbnego w 90. dniu.',
    },
    content: {
      en: `# Onboarding & Probation Policy

## Pre-boarding (before day 1)
- Offer letter signed, background check completed.
- Welcome email with first-week schedule.
- Equipment shipped to home or office address.
- Acme accounts provisioned (Google, Slack, GitHub if applicable).

## Day 1
- Welcome session with People Operations.
- Buddy introduction (peer-level colleague, not the manager).
- Office tour or virtual office walkthrough.
- IT setup verification with the IT Helpdesk.

## Week 1
- Manager 1:1 to confirm 30-60-90 day plan.
- Mandatory training: Code of Conduct, Security Awareness, GDPR Basics, Anti-Harassment.
- Introductions to immediate team and key stakeholders.

## 30 days
- First skip-level conversation.
- Joining the team's recurring meetings and rituals.
- Initial project assignment.

## 60 days
- Mid-probation check-in with manager.
- Self-reflection: what's working, what isn't, what's needed.
- People Operations onboarding survey.

## 90 days — end of probation
- Formal end-of-probation review with manager.
- Confirmation of permanent status, extension, or non-confirmation.
- Country-specific notice rules apply (DE: 4 weeks notice during probation; UK: 1 week; etc.).

## Buddy program
Every new hire is paired with a buddy outside their direct reporting line for the first 90 days. Buddies receive a small monthly stipend and recognition in the half-year review.

## Manager responsibilities
- Weekly 1:1s for the first 90 days.
- Clear written goals at days 30, 60, and 90.
- Documented end-of-probation decision before day 90.`,
    },
  },

  // ───────────────────────────── 9. Benefits ─────────────────────────────
  {
    id: 'benefits-overview',
    categoryKey: 'benefits',
    owner: 'People Operations',
    contact: 'benefits@acme.com',
    lastUpdated: '2026-02-10',
    version: '8.0',
    effectiveDate: '2026-03-01',
    regions: ['US', 'EU', 'UK'],
    related: ['parental-leave', 'pto', 'learning-development'],
    tags: ['benefits', 'health', 'insurance', 'pension', '401k', 'leistungen', 'krankenversicherung', 'avantages', 'beneficios', 'benefit', 'voordelen', 'świadczenia'],
    title: {
      en: 'Employee Benefits Overview',
      de: 'Übersicht der Mitarbeiterleistungen',
      fr: 'Aperçu des avantages sociaux',
      es: 'Resumen de beneficios para empleados',
      it: 'Panoramica dei benefit dei dipendenti',
      nl: 'Overzicht arbeidsvoorwaarden',
      pl: 'Przegląd świadczeń pracowniczych',
    },
    summary: {
      en: 'Health, dental, vision, retirement, life insurance, wellness stipend, EAP and country-specific top-ups.',
      de: 'Kranken-, Zahn-, Sehversicherung, Altersvorsorge, Lebensversicherung, Wellness-Zuschuss, EAP und länderspezifische Zusatzleistungen.',
      fr: 'Santé, dentaire, optique, retraite, assurance vie, allocation bien-être, EAP et compléments par pays.',
      es: 'Salud, dental, óptica, jubilación, seguro de vida, ayuda bienestar, EAP y complementos por país.',
      it: 'Salute, dentistica, oculistica, pensione, assicurazione vita, contributo benessere, EAP e integrazioni per paese.',
      nl: 'Gezondheidszorg, tandheelkunde, optiek, pensioen, levensverzekering, wellness-vergoeding, EAP en landtoeslagen.',
      pl: 'Zdrowie, dentystyka, optyka, emerytura, ubezpieczenie na życie, dodatek wellness, EAP i bonusy krajowe.',
    },
    content: {
      en: `# Employee Benefits Overview

## Health insurance
- **US**: Medical, dental, and vision via United Healthcare. Acme pays 80% for employees and 60% for dependents.
- **UK & EU**: Private health top-up via AXA in addition to statutory health systems. Includes mental health, physiotherapy, and specialist consultations.
- **DE**: Optional Zusatzversicherung covering single-room hospital stays and chefärztliche Behandlung.

## Retirement & pension
- **US**: 401(k) with **4% company match**, Roth and traditional options, 2-year vesting.
- **UK**: Stakeholder pension at 5% employer / 5% employee minimum.
- **EU**: Country-specific schemes (e.g., bAV in Germany with 20% Acme contribution above statutory).

## Life & disability
- 4× annual salary group life insurance for all employees.
- Long-term disability cover at 60% of base salary up to retirement.

## Family
- 16 weeks parental leave (primary), 6 weeks secondary — see *Parental Leave* policy.
- Fertility support: up to **$15,000 lifetime** for IVF, adoption, or surrogacy costs.
- Backup childcare: 10 emergency days per year via Bright Horizons.

## Wellness
- Annual wellness stipend: **$500 / €450** for gym, mental health apps, or fitness equipment.
- Employee Assistance Programme: confidential counselling 24/7, multi-language.
- Headspace and Calm subscriptions free for all employees.

## Learning & growth
See the *Learning & Development* policy: **$2,000 / €1,800** annual stipend per employee for courses, conferences, and certifications.

## Commuter & transit
US: pre-tax transit benefit up to $315/month. UK: cycle-to-work scheme. DE: Jobticket option.

## Enrolment & changes
Open enrolment runs each November for the following year. Life events (marriage, birth, divorce) allow mid-year changes within 30 days. Use the Workday Benefits portal.`,
    },
  },

  // ───────────────────────────── 10. Learning & development ─────────────────────────────
  {
    id: 'learning-development',
    categoryKey: 'learning',
    owner: 'People Operations',
    contact: 'learning@acme.com',
    lastUpdated: '2025-10-22',
    version: '5.2',
    effectiveDate: '2025-11-01',
    regions: ['Global'],
    related: ['performance-reviews', 'benefits-overview'],
    tags: ['learning', 'training', 'l&d', 'course', 'conference', 'weiterbildung', 'fortbildung', 'formation', 'formación', 'formazione', 'leren', 'rozwój'],
    title: {
      en: 'Learning & Development Policy',
      de: 'Weiterbildungsrichtlinie',
      fr: 'Politique de formation et développement',
      es: 'Política de aprendizaje y desarrollo',
      it: 'Politica formazione e sviluppo',
      nl: 'Beleid Leren & Ontwikkelen',
      pl: 'Polityka rozwoju zawodowego',
    },
    summary: {
      en: '$2,000 annual learning stipend, internal mentorship, conference budget for senior roles, and dedicated learning days.',
      de: 'Jährliches Weiterbildungsbudget von 1.800 €, internes Mentoring, Konferenzbudget für Senior-Rollen und feste Lerntage.',
      fr: 'Budget formation annuel de 1 800 €, mentorat interne, budget conférences pour postes seniors et journées d\'apprentissage dédiées.',
      es: 'Presupuesto anual de aprendizaje de 1.800 €, mentoría interna, presupuesto de conferencias para puestos senior y jornadas de aprendizaje.',
      it: 'Budget formativo annuale di 1.800 €, mentoring interno, budget conferenze per ruoli senior e giornate di apprendimento.',
      nl: 'Jaarlijks leerbudget van €1.800, interne mentoring, conferentiebudget voor senior rollen en speciale leerdagen.',
      pl: 'Roczny budżet szkoleniowy 1800 €, mentoring wewnętrzny, budżet konferencyjny dla seniorów i dedykowane dni nauki.',
    },
    content: {
      en: `# Learning & Development Policy

## Annual learning stipend
Every employee receives **$2,000 / €1,800** per calendar year for:
- Online courses (Coursera, Udemy, LinkedIn Learning, Pluralsight)
- Books and audiobooks
- Professional certifications (AWS, GCP, PMP, CSM, etc.)
- Subscriptions (Substacks, industry research)

Submit receipts via Expensify under category *Learning*. Unused stipend does not roll over.

## Conference budget
- IC roles: up to **$2,500 / €2,300** per year (separate from the stipend) for one major industry conference, with manager approval.
- Manager and senior IC roles: up to **$5,000 / €4,500** per year.
- Travel and accommodation for conferences fall under the *Business Travel* policy.

## Learning days
Every quarter, all employees may take **two paid learning days** (8 hours total) for self-directed learning, courses, or independent project work. Block them in your calendar with the tag "[Learning Day]".

## Internal mentorship
- Acme runs a quarterly mentorship matching round.
- Both mentors and mentees commit to 6 fortnightly sessions of 45 minutes.
- Sign up via the People app.

## Tuition reimbursement
For role-relevant degrees and post-graduate certifications, Acme will reimburse up to **$10,000 / €9,000** per year for two years, subject to a service-back agreement of 24 months after course completion.

## Internal mobility
Employees with 12+ months in role may apply for any open Acme role. Internal applicants receive priority screening. Talk to your manager and HRBP before applying.

## Manager training
All new managers complete a mandatory 6-week management foundations programme within their first 90 days. Senior leaders receive an annual leadership offsite and access to executive coaching.`,
    },
  },
];

// Helper: localize a single policy for return to clients.
import { pick, categoryLabel } from './languages.mjs';

export function localizePolicy(policy, lang, includeContent = true) {
  return {
    id: policy.id,
    title: pick(policy.title, lang),
    category: categoryLabel(policy.categoryKey, lang),
    categoryKey: policy.categoryKey,
    summary: pick(policy.summary, lang),
    owner: policy.owner,
    contact: policy.contact,
    lastUpdated: policy.lastUpdated,
    version: policy.version,
    effectiveDate: policy.effectiveDate,
    regions: policy.regions,
    related: policy.related,
    uri: `acme://policies/${policy.id}`,
    ...(includeContent ? { content: pick(policy.content, lang) } : {}),
  };
}

// Helper: search policies by query, with multilingual matching.
export function searchPolicies(query, lang) {
  const q = (query || '').toLowerCase();
  if (!q) return HR_POLICIES.map(p => localizePolicy(p, lang, false));

  return HR_POLICIES
    .map(p => {
      const haystacks = [
        ...Object.values(p.title),
        ...Object.values(p.summary),
        ...(p.tags || []),
        p.id,
        p.categoryKey,
        ...Object.values(p.content || {}),
      ].join(' ').toLowerCase();
      const score = q.split(/\s+/).filter(Boolean).reduce((s, term) => s + (haystacks.includes(term) ? 1 : 0), 0);
      return { policy: p, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ policy }) => {
      const loc = localizePolicy(policy, lang, false);
      const fullContent = pick(policy.content, lang);
      return { ...loc, excerpt: fullContent.replace(/^#.*\n/, '').slice(0, 220).trim() + '…' };
    });
}
