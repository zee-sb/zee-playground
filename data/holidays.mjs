// Public holiday calendar by region — Acme Corp.
// Used to demo region-aware Navigator answers ("when is the next holiday?").
// Dates are illustrative for 2026.

import { pick } from './languages.mjs';

const H = (date, key, names) => ({ date, key, names });

export const HOLIDAYS = {
  US: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-01-19', 'mlk_day',          { en: 'Martin Luther King Jr. Day', de: 'Martin-Luther-King-Tag', fr: 'Jour de Martin Luther King', es: 'Día de Martin Luther King', it: 'Martin Luther King Day', nl: 'Martin Luther King Day', pl: 'Dzień Martina Luthera Kinga' }),
    H('2026-05-25', 'memorial_day',     { en: 'Memorial Day',            de: 'Memorial Day',             fr: 'Memorial Day',                es: 'Memorial Day',          it: 'Memorial Day',         nl: 'Memorial Day',      pl: 'Memorial Day' }),
    H('2026-07-03', 'independence_day', { en: 'Independence Day (observed)', de: 'Unabhängigkeitstag', fr: 'Fête de l\'indépendance', es: 'Día de la Independencia', it: 'Giorno dell\'Indipendenza', nl: 'Onafhankelijkheidsdag', pl: 'Dzień Niepodległości USA' }),
    H('2026-09-07', 'labor_day',        { en: 'Labor Day',               de: 'Tag der Arbeit (US)',      fr: 'Fête du Travail (US)',       es: 'Día del Trabajo (EE. UU.)', it: 'Festa del Lavoro (USA)', nl: 'Dag van de Arbeid (VS)', pl: 'Święto Pracy (USA)' }),
    H('2026-11-26', 'thanksgiving',     { en: 'Thanksgiving',            de: 'Thanksgiving',             fr: 'Thanksgiving',                es: 'Acción de Gracias',     it: 'Ringraziamento',       nl: 'Thanksgiving',      pl: 'Święto Dziękczynienia' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
  ],
  DE: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-04-03', 'good_friday',      { en: 'Good Friday',             de: 'Karfreitag',               fr: 'Vendredi saint',              es: 'Viernes Santo',         it: 'Venerdì Santo',       nl: 'Goede Vrijdag',     pl: 'Wielki Piątek' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-05-01', 'labor_day_de',     { en: 'Labour Day',              de: 'Tag der Arbeit',           fr: 'Fête du Travail',             es: 'Día del Trabajo',       it: 'Festa del Lavoro',    nl: 'Dag van de Arbeid', pl: 'Święto Pracy' }),
    H('2026-05-14', 'ascension',        { en: 'Ascension Day',           de: 'Christi Himmelfahrt',      fr: 'Ascension',                   es: 'Ascensión',             it: 'Ascensione',          nl: 'Hemelvaartsdag',    pl: 'Wniebowstąpienie' }),
    H('2026-05-25', 'whit_monday',      { en: 'Whit Monday',             de: 'Pfingstmontag',            fr: 'Lundi de Pentecôte',          es: 'Lunes de Pentecostés',  it: 'Lunedì di Pentecoste',nl: 'Pinkstermaandag',   pl: 'Drugi dzień Zielonych Świątek' }),
    H('2026-10-03', 'german_unity',     { en: 'German Unity Day',        de: 'Tag der Deutschen Einheit', fr: 'Jour de l\'Unité allemande', es: 'Día de la Unidad Alemana', it: 'Giorno dell\'Unità Tedesca', nl: 'Duitse Eenheidsdag', pl: 'Dzień Jedności Niemiec' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
    H('2026-12-26', 'st_stephen',       { en: 'Boxing Day',              de: '2. Weihnachtsfeiertag',    fr: 'Saint-Étienne',               es: 'San Esteban',           it: 'Santo Stefano',       nl: 'Tweede Kerstdag',   pl: 'Drugi dzień Świąt' }),
  ],
  FR: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-05-01', 'labor_day_fr',     { en: 'Labour Day',              de: 'Tag der Arbeit',           fr: 'Fête du Travail',             es: 'Día del Trabajo',       it: 'Festa del Lavoro',    nl: 'Dag van de Arbeid', pl: 'Święto Pracy' }),
    H('2026-05-08', 've_day',           { en: 'Victory in Europe Day',   de: 'Tag des Sieges (FR)',      fr: 'Fête de la Victoire',         es: 'Día de la Victoria',    it: 'Giorno della Vittoria', nl: 'Bevrijdingsdag (FR)', pl: 'Dzień Zwycięstwa (FR)' }),
    H('2026-07-14', 'bastille',         { en: 'Bastille Day',            de: 'Französischer Nationalfeiertag', fr: 'Fête nationale',         es: 'Fiesta Nacional Francesa', it: 'Festa nazionale francese', nl: 'Quatorze juillet', pl: 'Święto Narodowe (FR)' }),
    H('2026-08-15', 'assumption',       { en: 'Assumption Day',          de: 'Mariä Himmelfahrt',        fr: 'Assomption',                  es: 'Asunción',              it: 'Assunzione',          nl: 'Maria-Tenhemelopneming', pl: 'Wniebowzięcie NMP' }),
    H('2026-11-01', 'all_saints',       { en: "All Saints' Day",         de: 'Allerheiligen',            fr: 'Toussaint',                   es: 'Todos los Santos',      it: 'Ognissanti',          nl: 'Allerheiligen',     pl: 'Wszystkich Świętych' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
  ],
  ES: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-01-06', 'epiphany',         { en: 'Epiphany',                de: 'Heilige Drei Könige',      fr: 'Épiphanie',                   es: 'Día de Reyes',          it: 'Epifania',            nl: 'Driekoningen',      pl: 'Trzech Króli' }),
    H('2026-04-03', 'good_friday',      { en: 'Good Friday',             de: 'Karfreitag',               fr: 'Vendredi saint',              es: 'Viernes Santo',         it: 'Venerdì Santo',       nl: 'Goede Vrijdag',     pl: 'Wielki Piątek' }),
    H('2026-05-01', 'labor_day_es',     { en: 'Labour Day',              de: 'Tag der Arbeit',           fr: 'Fête du Travail',             es: 'Día del Trabajo',       it: 'Festa del Lavoro',    nl: 'Dag van de Arbeid', pl: 'Święto Pracy' }),
    H('2026-08-15', 'assumption',       { en: 'Assumption Day',          de: 'Mariä Himmelfahrt',        fr: 'Assomption',                  es: 'Asunción',              it: 'Assunzione',          nl: 'Maria-Tenhemelopneming', pl: 'Wniebowzięcie NMP' }),
    H('2026-10-12', 'hispanic',         { en: 'National Day of Spain',   de: 'Spanischer Nationalfeiertag', fr: 'Fête nationale espagnole', es: 'Fiesta Nacional',     it: 'Festa nazionale spagnola', nl: 'Nationale Feestdag (ES)', pl: 'Święto Narodowe Hiszpanii' }),
    H('2026-12-06', 'constitution',     { en: 'Constitution Day',        de: 'Tag der Verfassung',       fr: 'Jour de la Constitution',     es: 'Día de la Constitución', it: 'Giorno della Costituzione', nl: 'Constitutiedag', pl: 'Dzień Konstytucji (ES)' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
  ],
  IT: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-01-06', 'epiphany',         { en: 'Epiphany',                de: 'Heilige Drei Könige',      fr: 'Épiphanie',                   es: 'Día de Reyes',          it: 'Epifania',            nl: 'Driekoningen',      pl: 'Trzech Króli' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-04-25', 'liberation_it',    { en: 'Liberation Day',          de: 'Tag der Befreiung',        fr: 'Jour de la libération',       es: 'Día de la Liberación',  it: 'Festa della Liberazione', nl: 'Bevrijdingsdag (IT)', pl: 'Dzień Wyzwolenia' }),
    H('2026-05-01', 'labor_day_it',     { en: 'Labour Day',              de: 'Tag der Arbeit',           fr: 'Fête du Travail',             es: 'Día del Trabajo',       it: 'Festa del Lavoro',    nl: 'Dag van de Arbeid', pl: 'Święto Pracy' }),
    H('2026-06-02', 'republic_it',      { en: 'Republic Day',            de: 'Tag der Republik',         fr: 'Jour de la République',       es: 'Día de la República',   it: 'Festa della Repubblica', nl: 'Dag van de Republiek', pl: 'Dzień Republiki' }),
    H('2026-08-15', 'ferragosto',       { en: 'Ferragosto',              de: 'Mariä Himmelfahrt',        fr: 'Assomption',                  es: 'Asunción',              it: 'Ferragosto',          nl: 'Ferragosto',        pl: 'Wniebowzięcie NMP' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
    H('2026-12-26', 'st_stephen',       { en: 'Boxing Day',              de: '2. Weihnachtsfeiertag',    fr: 'Saint-Étienne',               es: 'San Esteban',           it: 'Santo Stefano',       nl: 'Tweede Kerstdag',   pl: 'Drugi dzień Świąt' }),
  ],
  NL: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-04-27', 'kings_day',        { en: "King's Day",              de: 'Königstag',                fr: 'Jour du Roi',                 es: 'Día del Rey',           it: 'Giorno del Re',       nl: 'Koningsdag',        pl: 'Dzień Króla' }),
    H('2026-05-05', 'liberation_nl',    { en: 'Liberation Day',          de: 'Befreiungstag',            fr: 'Jour de la libération',       es: 'Día de la Liberación',  it: 'Giorno della Liberazione', nl: 'Bevrijdingsdag', pl: 'Dzień Wyzwolenia (NL)' }),
    H('2026-05-14', 'ascension',        { en: 'Ascension Day',           de: 'Christi Himmelfahrt',      fr: 'Ascension',                   es: 'Ascensión',             it: 'Ascensione',          nl: 'Hemelvaartsdag',    pl: 'Wniebowstąpienie' }),
    H('2026-05-25', 'whit_monday',      { en: 'Whit Monday',             de: 'Pfingstmontag',            fr: 'Lundi de Pentecôte',          es: 'Lunes de Pentecostés',  it: 'Lunedì di Pentecoste',nl: 'Pinkstermaandag',   pl: 'Drugi dzień Zielonych Świątek' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
    H('2026-12-26', 'st_stephen',       { en: 'Boxing Day',              de: '2. Weihnachtsfeiertag',    fr: 'Saint-Étienne',               es: 'San Esteban',           it: 'Santo Stefano',       nl: 'Tweede Kerstdag',   pl: 'Drugi dzień Świąt' }),
  ],
  PL: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-01-06', 'epiphany',         { en: 'Epiphany',                de: 'Heilige Drei Könige',      fr: 'Épiphanie',                   es: 'Día de Reyes',          it: 'Epifania',            nl: 'Driekoningen',      pl: 'Trzech Króli' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-05-01', 'labor_day_pl',     { en: 'Labour Day',              de: 'Tag der Arbeit',           fr: 'Fête du Travail',             es: 'Día del Trabajo',       it: 'Festa del Lavoro',    nl: 'Dag van de Arbeid', pl: 'Święto Pracy' }),
    H('2026-05-03', 'constitution_pl',  { en: 'Constitution Day',        de: 'Verfassungstag',           fr: 'Fête de la Constitution',     es: 'Día de la Constitución (PL)', it: 'Giorno della Costituzione (PL)', nl: 'Grondwetsdag (PL)', pl: 'Święto Konstytucji 3 Maja' }),
    H('2026-08-15', 'assumption',       { en: 'Assumption Day',          de: 'Mariä Himmelfahrt',        fr: 'Assomption',                  es: 'Asunción',              it: 'Assunzione',          nl: 'Maria-Tenhemelopneming', pl: 'Wniebowzięcie NMP' }),
    H('2026-11-11', 'independence_pl',  { en: 'Independence Day',        de: 'Unabhängigkeitstag (PL)',  fr: 'Fête de l\'Indépendance (PL)', es: 'Día de la Independencia (PL)', it: 'Giorno dell\'Indipendenza (PL)', nl: 'Onafhankelijkheidsdag (PL)', pl: 'Święto Niepodległości' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
    H('2026-12-26', 'st_stephen',       { en: 'Boxing Day',              de: '2. Weihnachtsfeiertag',    fr: 'Saint-Étienne',               es: 'San Esteban',           it: 'Santo Stefano',       nl: 'Tweede Kerstdag',   pl: 'Drugi dzień Świąt' }),
  ],
  UK: [
    H('2026-01-01', 'new_year',         { en: "New Year's Day",          de: 'Neujahr',                  fr: 'Jour de l\'an',              es: 'Año Nuevo',              it: 'Capodanno',           nl: 'Nieuwjaarsdag',     pl: 'Nowy Rok' }),
    H('2026-04-03', 'good_friday',      { en: 'Good Friday',             de: 'Karfreitag',               fr: 'Vendredi saint',              es: 'Viernes Santo',         it: 'Venerdì Santo',       nl: 'Goede Vrijdag',     pl: 'Wielki Piątek' }),
    H('2026-04-06', 'easter_monday',    { en: 'Easter Monday',           de: 'Ostermontag',              fr: 'Lundi de Pâques',             es: 'Lunes de Pascua',       it: 'Pasquetta',           nl: 'Paasmaandag',       pl: 'Drugi dzień Wielkanocy' }),
    H('2026-05-04', 'early_may',        { en: 'Early May Bank Holiday',  de: 'Frühlingsfeiertag (UK)',   fr: 'Jour férié de mai (UK)',     es: 'Festivo de mayo (UK)',  it: 'Festa di maggio (UK)',nl: 'Mei-feestdag (UK)', pl: 'Majowy dzień (UK)' }),
    H('2026-08-31', 'summer_bank',      { en: 'Summer Bank Holiday',     de: 'Sommerferiertag (UK)',     fr: 'Jour férié d\'été (UK)',     es: 'Festivo de verano (UK)', it: 'Festa estiva (UK)',   nl: 'Zomerfeestdag (UK)',pl: 'Wakacyjny dzień (UK)' }),
    H('2026-12-25', 'christmas_day',    { en: 'Christmas Day',           de: '1. Weihnachtsfeiertag',    fr: 'Noël',                        es: 'Navidad',                it: 'Natale',               nl: 'Eerste Kerstdag',   pl: 'Boże Narodzenie' }),
    H('2026-12-28', 'boxing_observed',  { en: 'Boxing Day (observed)',   de: '2. Weihnachtsfeiertag (UK)', fr: 'Saint-Étienne (observé)', es: 'San Esteban (observado)', it: 'Santo Stefano (osservato)', nl: 'Tweede Kerstdag (UK)', pl: 'Drugi dzień Świąt (UK)' }),
  ],
};

export const REGIONS = Object.keys(HOLIDAYS);

export function getHolidays(region, lang) {
  const list = HOLIDAYS[region] || [];
  return list.map(h => ({ date: h.date, name: pick(h.names, lang), key: h.key }));
}

export function nextHoliday(region, lang, today = new Date()) {
  const list = HOLIDAYS[region] || [];
  const todayStr = today.toISOString().slice(0, 10);
  const upcoming = list.filter(h => h.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!upcoming) return null;
  const days = Math.ceil((new Date(upcoming.date) - today) / (1000 * 60 * 60 * 24));
  return { date: upcoming.date, name: pick(upcoming.names, lang), region, daysAway: days };
}
