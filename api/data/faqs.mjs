// FAQ corpus — common employee questions with multiple natural phrasings.
// Each FAQ links back to the canonical policy that should be cited.

import { pick } from './languages.mjs';

export const FAQS = [
  // HR
  { id: 'how-many-vacation-days', topic: 'pto', policyId: 'pto', tags: ['pto', 'vacation', 'leave'],
    questions: {
      en: ['How many vacation days do I get?', 'What is my annual leave entitlement?', 'How much PTO do I have?'],
      de: ['Wie viele Urlaubstage habe ich?', 'Wie viel Jahresurlaub steht mir zu?', 'Wie viel Urlaub bekomme ich?'],
      fr: ['Combien de jours de congés ai-je ?', 'Quel est mon droit aux congés annuels ?'],
      es: ['¿Cuántos días de vacaciones tengo?', '¿Cuál es mi derecho a vacaciones anuales?'],
      it: ['Quanti giorni di ferie ho?', 'A quante ferie ho diritto all\'anno?'],
      nl: ['Hoeveel vakantiedagen heb ik?', 'Wat zijn mijn jaarlijkse verlofrechten?'],
      pl: ['Ile mam dni urlopu?', 'Jaki jest mój roczny wymiar urlopu?'],
    },
    answer: {
      en: 'Acme provides 25 working days of paid annual leave per year for most employees, with 30 days statutory minimum in Germany and 20 in the US. See the *Paid Time Off* policy for accrual details.',
      de: 'Acme gewährt 25 Arbeitstage bezahlten Jahresurlaub für die meisten Mitarbeitenden; in Deutschland gilt der gesetzliche Mindestanspruch von 30 Tagen. Details siehe Urlaubsregelung.',
      fr: 'Acme accorde 25 jours ouvrés de congés payés par an pour la plupart des employés. Voir la politique des congés payés pour les détails.',
      es: 'Acme ofrece 25 días laborables de vacaciones pagadas al año para la mayoría de los empleados. Consulte la política de vacaciones para más detalles.',
      it: 'Acme offre 25 giorni lavorativi di ferie retribuite all\'anno per la maggior parte dei dipendenti. Vedere la policy ferie per i dettagli.',
      nl: 'Acme biedt 25 werkdagen betaald jaarlijks verlof voor de meeste medewerkers. Zie het PTO-beleid voor details.',
      pl: 'Acme oferuje 25 dni roboczych płatnego urlopu rocznie dla większości pracowników. Szczegóły w polityce urlopowej.',
    },
  },
  { id: 'remote-from-abroad', topic: 'remote', policyId: 'remote-work', tags: ['remote', 'workation', 'travel'],
    questions: {
      en: ['Can I work from another country?', 'Can I do a workation?', 'How long can I work abroad?'],
      de: ['Darf ich aus einem anderen Land arbeiten?', 'Kann ich eine Workation machen?', 'Wie lange darf ich aus dem Ausland arbeiten?'],
      fr: ['Puis-je travailler depuis un autre pays ?', 'Combien de temps puis-je faire du télétravail à l\'étranger ?'],
      es: ['¿Puedo trabajar desde otro país?', '¿Cuánto tiempo puedo teletrabajar desde el extranjero?'],
      it: ['Posso lavorare dall\'estero?', 'Per quanto tempo posso fare workation?'],
      nl: ['Mag ik vanuit het buitenland werken?', 'Hoe lang mag ik vanuit het buitenland werken?'],
      pl: ['Czy mogę pracować z innego kraju?', 'Jak długo mogę pracować z zagranicy?'],
    },
    answer: {
      en: 'Up to 30 calendar days per year from another country, with manager approval and 2 weeks\' notice to People Operations. See the *Remote & Hybrid Work* policy.',
      de: 'Bis zu 30 Kalendertage pro Jahr aus dem Ausland, mit Genehmigung der Führungskraft und 2 Wochen Vorlauf an People Operations. Siehe Remote- & Hybrid-Regelung.',
      fr: "Jusqu'à 30 jours civils par an depuis l'étranger, avec accord du manager et préavis de 2 semaines à People Operations. Voir la politique télétravail.",
      es: 'Hasta 30 días naturales al año desde otro país, con aprobación del manager y 2 semanas de aviso a People Operations. Ver la política de trabajo remoto.',
      it: 'Fino a 30 giorni di calendario all\'anno dall\'estero, con approvazione del manager e preavviso di 2 settimane a People Operations. Vedere la policy del lavoro remoto.',
      nl: 'Tot 30 kalenderdagen per jaar vanuit het buitenland, met goedkeuring van de manager en 2 weken aankondiging aan People Operations. Zie het remote-beleid.',
      pl: 'Do 30 dni kalendarzowych rocznie z zagranicy, za zgodą menedżera i z 2-tygodniowym wyprzedzeniem do People Operations. Zobacz politykę pracy zdalnej.',
    },
  },
  { id: 'sick-day-process', topic: 'sick', policyId: 'sick-leave', tags: ['sick', 'illness', 'medical'],
    questions: {
      en: ['What do I do if I\'m sick?', 'How do I call in sick?', 'Do I need a doctor\'s note?'],
      de: ['Was tue ich, wenn ich krank bin?', 'Wie melde ich mich krank?', 'Brauche ich ein Attest?'],
      fr: ['Que faire en cas de maladie ?', 'Comment me déclarer malade ? Faut-il un certificat médical ?'],
      es: ['¿Qué hago si estoy enfermo?', '¿Necesito justificante médico?'],
      it: ['Cosa faccio se sono malato?', 'Serve il certificato medico?'],
      nl: ['Wat doe ik als ik ziek ben?', 'Heb ik een doktersbriefje nodig?'],
      pl: ['Co zrobić, gdy jestem chory?', 'Czy potrzebuję zwolnienia lekarskiego?'],
    },
    answer: {
      en: 'Notify your manager on day 1 (Slack or phone) and log the absence in the People app. Up to 10 days/year can be self-certified. Absences longer than 3 days need a medical certificate.',
      de: 'Melde dich am ersten Tag bei deiner Führungskraft (Slack oder Telefon) und trage die Abwesenheit in der People-App ein. Bis zu 10 Tage/Jahr sind Selbstauskunft, danach ist ein Attest nötig.',
      fr: "Prévenez votre manager dès le 1er jour et enregistrez l'absence dans l'app People. Jusqu'à 10 jours/an en auto-déclaration ; au-delà de 3 jours, certificat médical requis.",
      es: 'Avise a su manager el primer día y registre la ausencia en la app de People. Hasta 10 días/año autocertificados; más de 3 días seguidos requiere certificado médico.',
      it: 'Avvisa il manager il primo giorno e registra l\'assenza nell\'app People. Fino a 10 giorni/anno autocertificati; oltre 3 giorni serve il certificato medico.',
      nl: 'Meld je op dag 1 bij je manager en registreer de afwezigheid in de People-app. Tot 10 dagen/jaar zelfgemeld; bij meer dan 3 aaneengesloten dagen is een medische verklaring vereist.',
      pl: 'Powiadom menedżera pierwszego dnia i zarejestruj nieobecność w aplikacji People. Do 10 dni/rok samodeklaracja; powyżej 3 dni potrzebne zwolnienie lekarskie.',
    },
  },

  // IT
  { id: 'lost-laptop', topic: 'lost-device', policyId: 'incident-response', tags: ['lost', 'stolen', 'laptop', 'phone'],
    questions: {
      en: ['I lost my laptop, what do I do?', 'My phone was stolen, how do I report it?', 'Stolen device.'],
      de: ['Ich habe meinen Laptop verloren, was nun?', 'Mein Handy wurde gestohlen, wie melde ich das?'],
      fr: ["J'ai perdu mon ordinateur portable, que faire ?", 'Mon téléphone a été volé, comment le signaler ?'],
      es: ['He perdido mi portátil, ¿qué hago?', 'Me robaron el móvil, ¿cómo lo reporto?'],
      it: ['Ho perso il laptop, cosa faccio?', 'Mi hanno rubato il telefono, come lo segnalo?'],
      nl: ['Ik ben mijn laptop kwijt, wat nu?', 'Mijn telefoon is gestolen, hoe meld ik dat?'],
      pl: ['Zgubiłem laptop, co teraz?', 'Skradziono mi telefon, jak to zgłosić?'],
    },
    answer: {
      en: 'Email security@acme.com or call the security on-call (+1-800-555-0188 / +49-30-555-0199) immediately. IT can wipe the device remotely. File a police report for stolen items and forward it to security.',
      de: 'Sofort E-Mail an security@acme.com oder Anruf an die Sicherheits-Hotline (+1-800-555-0188 / +49-30-555-0199). IT kann das Gerät aus der Ferne löschen. Bei Diebstahl Polizeibericht erstatten und an Security senden.',
      fr: 'Envoyez immédiatement un e-mail à security@acme.com ou appelez la hotline (+1-800-555-0188 / +49-30-555-0199). L\'IT peut effacer l\'appareil à distance. En cas de vol, déposez plainte et transmettez le rapport à Security.',
      es: 'Envíe email a security@acme.com o llame a la guardia de seguridad (+1-800-555-0188 / +49-30-555-0199) de inmediato. TI puede borrar el dispositivo remotamente. En caso de robo, presente denuncia y envíela a Security.',
      it: 'Invia subito una email a security@acme.com o chiama la reperibilità (+1-800-555-0188 / +49-30-555-0199). L\'IT può cancellare il dispositivo da remoto. In caso di furto, presenta denuncia e inoltrala al Security.',
      nl: 'Stuur direct een e-mail naar security@acme.com of bel de security on-call (+1-800-555-0188 / +49-30-555-0199). IT kan het apparaat op afstand wissen. Bij diefstal aangifte doen en doorsturen naar Security.',
      pl: 'Natychmiast wyślij e-mail na security@acme.com lub zadzwoń na dyżur (+1-800-555-0188 / +49-30-555-0199). IT może zdalnie wyczyścić urządzenie. W razie kradzieży zgłoś sprawę policji i prześlij raport do Security.',
    },
  },
  { id: 'request-software', topic: 'software', policyId: 'software-approval', tags: ['software', 'license', 'app', 'access'],
    questions: {
      en: ['How do I request access to a tool?', 'I need a Figma license, how do I get one?', 'Can I get GitHub access?'],
      de: ['Wie bekomme ich Zugriff auf ein Tool?', 'Ich brauche eine Figma-Lizenz, wie?', 'Kann ich GitHub-Zugriff bekommen?'],
      fr: ['Comment demander l\'accès à un outil ?', 'J\'ai besoin d\'une licence Figma, comment faire ?'],
      es: ['¿Cómo solicito acceso a una herramienta?', 'Necesito licencia de Figma, ¿cómo la obtengo?'],
      it: ['Come richiedo l\'accesso a un tool?', 'Mi serve una licenza Figma, come la ottengo?'],
      nl: ['Hoe vraag ik toegang tot een tool aan?', 'Ik heb een Figma-licentie nodig, hoe krijg ik die?'],
      pl: ['Jak poprosić o dostęp do narzędzia?', 'Potrzebuję licencji Figma, jak ją uzyskać?'],
    },
    answer: {
      en: 'Check the Acme app catalog in Okta first. If your tool isn\'t there, raise an IT ticket of type *Software Request*. Approval typically takes 5 business days for low-risk tools.',
      de: 'Schaue zuerst im Acme-App-Katalog in Okta. Falls das Tool nicht enthalten ist, eröffne ein IT-Ticket vom Typ *Software-Anfrage*. Genehmigung dauert typischerweise 5 Werktage.',
      fr: "Consultez d'abord le catalogue Acme dans Okta. Sinon, ouvrez un ticket IT de type *Software Request*. L'approbation prend généralement 5 jours ouvrés.",
      es: 'Revise primero el catálogo Acme en Okta. Si no está, abra un ticket de TI tipo *Software Request*. La aprobación suele tardar 5 días laborables.',
      it: 'Controlla prima il catalogo Acme in Okta. Se non c\'è, apri un ticket IT di tipo *Software Request*. L\'approvazione richiede tipicamente 5 giorni lavorativi.',
      nl: 'Kijk eerst in de Acme-appcatalogus in Okta. Anders open een IT-ticket *Software Request*. Goedkeuring duurt meestal 5 werkdagen.',
      pl: 'Najpierw sprawdź katalog Acme w Okta. Jeśli nie ma narzędzia, otwórz zgłoszenie IT typu *Software Request*. Zatwierdzenie trwa zwykle 5 dni roboczych.',
    },
  },
  { id: 'mfa-setup', topic: 'mfa', policyId: 'password-mfa', tags: ['mfa', '2fa', 'authentication', 'setup'],
    questions: {
      en: ['How do I set up MFA?', 'Where do I get a YubiKey?', 'My MFA isn\'t working.'],
      de: ['Wie richte ich MFA ein?', 'Woher bekomme ich einen YubiKey?', 'Mein MFA funktioniert nicht.'],
      fr: ['Comment configurer la MFA ?', 'Où récupérer une YubiKey ?'],
      es: ['¿Cómo configuro la MFA?', '¿Dónde obtengo una YubiKey?'],
      it: ['Come configuro l\'MFA?', 'Dove richiedo una YubiKey?'],
      nl: ['Hoe stel ik MFA in?', 'Waar krijg ik een YubiKey?'],
      pl: ['Jak skonfigurować MFA?', 'Gdzie dostanę YubiKey?'],
    },
    answer: {
      en: 'Use Microsoft Authenticator or 1Password OTP for most apps. Hardware keys (YubiKey) are required for admins — open an IT ticket type *Equipment Request* to receive one. See the *Passwords & MFA* policy for details.',
      de: 'Für die meisten Apps Microsoft Authenticator oder 1Password OTP. Hardware-Schlüssel (YubiKey) sind für Admins Pflicht — IT-Ticket vom Typ *Equipment Request*. Siehe Passwort- & MFA-Richtlinie.',
      fr: "Utilisez Microsoft Authenticator ou 1Password OTP. Les clés matérielles (YubiKey) sont obligatoires pour les admins — ouvrez un ticket IT *Equipment Request*. Voir la politique mots de passe & MFA.",
      es: 'Use Microsoft Authenticator o 1Password OTP. Las llaves físicas (YubiKey) son obligatorias para administradores: abra un ticket de TI *Equipment Request*. Consulte la política de contraseñas y MFA.',
      it: 'Usa Microsoft Authenticator o 1Password OTP. Le chiavi hardware (YubiKey) sono obbligatorie per gli admin — apri un ticket IT *Equipment Request*. Vedere la policy password e MFA.',
      nl: 'Gebruik Microsoft Authenticator of 1Password OTP. Hardware-keys (YubiKey) zijn verplicht voor admins — open een IT-ticket *Equipment Request*. Zie het wachtwoord- en MFA-beleid.',
      pl: 'Używaj Microsoft Authenticator lub 1Password OTP. Klucze sprzętowe (YubiKey) są wymagane dla adminów — otwórz zgłoszenie IT *Equipment Request*. Zob. polityka haseł i MFA.',
    },
  },
];

// Search FAQs by question text in any language.
export function searchFAQs(query, lang) {
  const q = (query || '').toLowerCase().trim();
  if (!q) return [];
  return FAQS
    .map(f => {
      const allQuestions = Object.values(f.questions).flat().join(' ').toLowerCase();
      const haystack = `${allQuestions} ${(f.tags || []).join(' ')} ${f.topic}`.toLowerCase();
      const score = q.split(/\s+/).filter(Boolean).reduce((s, term) => s + (haystack.includes(term) ? 1 : 0), 0);
      return { faq: f, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ faq }) => ({
      id: faq.id,
      topic: faq.topic,
      question: pick(faq.questions, lang)?.[0] ?? Object.values(faq.questions)[0][0],
      answer: pick(faq.answer, lang),
      relatedPolicy: faq.policyId,
    }));
}
