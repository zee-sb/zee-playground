// IT & Security policy library — Acme Corp.
// Same shape as HR policies for consistent localization.

import { pick, categoryLabel } from './languages.mjs';

export const IT_POLICIES = [
  // ───────────────────────── 1. Acceptable Use ─────────────────────────
  {
    id: 'acceptable-use',
    categoryKey: 'security',
    owner: 'IT & Security',
    contact: 'security@acme.com',
    lastUpdated: '2026-01-20',
    version: '6.0',
    effectiveDate: '2026-02-01',
    regions: ['Global'],
    related: ['data-classification', 'byod', 'ai-tool-usage'],
    tags: ['acceptable use', 'aup', 'computer use', 'company device', 'akzeptable nutzung', 'utilisation acceptable', 'uso aceptable', 'uso accettabile', 'aanvaardbaar gebruik', 'akceptowalne użycie'],
    title: {
      en: 'Acceptable Use Policy',
      de: 'Richtlinie zur akzeptablen Nutzung',
      fr: 'Politique d\'utilisation acceptable',
      es: 'Política de uso aceptable',
      it: 'Politica di utilizzo accettabile',
      nl: 'Beleid Aanvaardbaar Gebruik',
      pl: 'Polityka akceptowalnego użytkowania',
    },
    summary: {
      en: 'Rules for using Acme laptops, accounts, and networks — including limited personal use, prohibited activities, and monitoring rights.',
      de: 'Regeln für die Nutzung von Acme-Laptops, -Konten und -Netzwerken, einschließlich begrenzter privater Nutzung, untersagter Aktivitäten und Überwachungsrechte.',
      fr: 'Règles d\'utilisation des ordinateurs, comptes et réseaux Acme — usage personnel limité, activités interdites, droit de surveillance.',
      es: 'Reglas para el uso de portátiles, cuentas y redes de Acme: uso personal limitado, actividades prohibidas y derechos de supervisión.',
      it: 'Regole per l\'uso di laptop, account e reti Acme — uso personale limitato, attività vietate e diritti di monitoraggio.',
      nl: 'Regels voor gebruik van Acme-laptops, accounts en netwerken — beperkt privégebruik, verboden activiteiten en toezichtsrechten.',
      pl: 'Zasady korzystania z laptopów, kont i sieci Acme — ograniczone użycie prywatne, zabronione działania i prawa do monitorowania.',
    },
    content: {
      en: `# Acceptable Use Policy

## Scope
This policy applies to all Acme-issued devices, user accounts, networks, cloud services, and any personal device used to access Acme systems.

## Acceptable use
- Use Acme systems primarily for legitimate business activities.
- **Limited personal use** is acceptable: occasional banking, news, light browsing — provided it does not interfere with work or violate this policy.
- All work product created on Acme systems is Acme intellectual property.

## Prohibited activities
You must not:
- Install pirated, unlicensed, or unauthorized software.
- Use Acme systems to access, store, or distribute illegal, obscene, or harassing material.
- Run side-business commercial activities on Acme assets.
- Bypass network filters, VPNs, or security tools.
- Share account credentials with anyone — including assistants, family, or other employees.

## Network use
Connect to Acme networks via approved channels. Public Wi-Fi requires the Acme VPN. Personal hotspots are acceptable only when business need outweighs the risk.

## Encryption
All Acme laptops have full-disk encryption (FileVault/BitLocker) enabled by default. Tampering with encryption settings is prohibited.

## Monitoring
Acme reserves the right to monitor logs, network traffic, endpoint telemetry, and email for security and compliance purposes. Reviews are limited to authorized personnel and follow local privacy laws (incl. GDPR / works council agreements where applicable).

## Reporting issues
Report suspected security incidents, lost devices, or compromised accounts immediately via the IT Helpdesk or security@acme.com. See the *Incident Response* policy for what counts as an incident.

## Consequences
Violations may result in disciplinary action up to and including termination, and where applicable, civil or criminal proceedings.`,
    },
  },

  // ───────────────────────── 2. Password & MFA ─────────────────────────
  {
    id: 'password-mfa',
    categoryKey: 'access',
    owner: 'IT & Security',
    contact: 'security@acme.com',
    lastUpdated: '2025-11-10',
    version: '4.3',
    effectiveDate: '2025-12-01',
    regions: ['Global'],
    related: ['acceptable-use', 'incident-response'],
    tags: ['password', 'mfa', '2fa', 'authentication', 'sso', 'passwort', 'mot de passe', 'contraseña', 'wachtwoord', 'hasło', 'authentifizierung', 'autenticación'],
    title: {
      en: 'Passwords & Multi-Factor Authentication',
      de: 'Passwörter und Multi-Faktor-Authentifizierung',
      fr: 'Mots de passe et authentification multifacteur',
      es: 'Contraseñas y autenticación multifactor',
      it: 'Password e autenticazione a più fattori',
      nl: 'Wachtwoorden en multifactor-authenticatie',
      pl: 'Hasła i uwierzytelnianie wieloskładnikowe',
    },
    summary: {
      en: 'Strong unique passwords via 1Password, mandatory MFA on all Acme accounts, hardware keys for admins.',
      de: 'Starke, einzigartige Passwörter via 1Password, MFA-Pflicht für alle Acme-Konten, Hardware-Schlüssel für Admins.',
      fr: 'Mots de passe forts et uniques via 1Password, MFA obligatoire sur tous les comptes Acme, clés matérielles pour les admins.',
      es: 'Contraseñas fuertes y únicas con 1Password, MFA obligatoria en todas las cuentas Acme, llaves físicas para admins.',
      it: 'Password robuste e uniche con 1Password, MFA obbligatoria su tutti gli account Acme, chiavi hardware per gli admin.',
      nl: 'Sterke unieke wachtwoorden via 1Password, MFA verplicht op alle Acme-accounts, hardware-keys voor admins.',
      pl: 'Silne unikalne hasła w 1Password, obowiązkowe MFA na wszystkich kontach Acme, klucze sprzętowe dla adminów.',
    },
    content: {
      en: `# Passwords & Multi-Factor Authentication

## Password manager
All employees use **1Password Business**, provisioned via SSO. Personal vaults are also available at no cost.

## Password requirements
- Minimum **14 characters** (16 for admin accounts).
- Unique per system — no reuse across services.
- Never written down, emailed, or shared.
- Generated by 1Password where the system permits.

## Multi-factor authentication
MFA is mandatory on:
- Google Workspace
- Slack
- GitHub
- AWS Console
- Salesforce
- Any system holding customer data or financial information

Approved MFA methods, in order of preference:
1. **Hardware security key** (YubiKey or Google Titan) — required for admins.
2. **Authenticator app** (Microsoft Authenticator, Google Authenticator, 1Password OTP).
3. **Push notification** (Okta Verify, Duo).
4. **SMS** — discouraged; only as a last resort and never for admins.

## Lost or stolen MFA device
Report immediately to security@acme.com. IT will revoke sessions and reset MFA enrolment within 1 business hour. A backup method (printed recovery codes stored securely, or a second hardware key) is required for all admins.

## Session timeouts
- Workstation lock after 5 minutes of inactivity.
- SSO re-authentication every 8 hours.
- Sensitive admin consoles re-prompt for MFA every 4 hours.

## Service accounts
Service / non-human accounts must use OAuth or short-lived API tokens stored in Vault. Never embed long-lived secrets in code. See the *Secrets Management* runbook for details.`,
    },
  },

  // ───────────────────────── 3. Data classification ─────────────────────────
  {
    id: 'data-classification',
    categoryKey: 'data_privacy',
    owner: 'IT & Security',
    contact: 'security@acme.com',
    lastUpdated: '2025-08-30',
    version: '3.1',
    effectiveDate: '2025-09-15',
    regions: ['Global'],
    related: ['acceptable-use', 'gdpr-data-requests'],
    tags: ['data classification', 'confidential', 'pii', 'sensitive', 'datenklassifizierung', 'classification des données', 'clasificación', 'classificazione', 'gegevensclassificatie', 'klasyfikacja danych'],
    title: {
      en: 'Data Classification & Handling',
      de: 'Datenklassifizierung und -handhabung',
      fr: 'Classification et gestion des données',
      es: 'Clasificación y manejo de datos',
      it: 'Classificazione e gestione dei dati',
      nl: 'Gegevensclassificatie en -beheer',
      pl: 'Klasyfikacja i obsługa danych',
    },
    summary: {
      en: 'Four data tiers — Public, Internal, Confidential, Restricted — with handling rules for storage, sharing, and disposal.',
      de: 'Vier Datenstufen — Öffentlich, Intern, Vertraulich, Streng vertraulich — mit Regeln für Speicherung, Weitergabe und Entsorgung.',
      fr: 'Quatre niveaux de données — Public, Interne, Confidentiel, Restreint — avec règles de stockage, partage et destruction.',
      es: 'Cuatro niveles de datos — Público, Interno, Confidencial, Restringido — con reglas de almacenamiento, intercambio y eliminación.',
      it: 'Quattro livelli — Pubblico, Interno, Confidenziale, Riservato — con regole su archiviazione, condivisione e smaltimento.',
      nl: 'Vier dataclassificaties — Public, Intern, Vertrouwelijk, Beperkt — met regels voor opslag, delen en verwijderen.',
      pl: 'Cztery poziomy danych — Publiczne, Wewnętrzne, Poufne, Ograniczone — z zasadami przechowywania, udostępniania i usuwania.',
    },
    content: {
      en: `# Data Classification & Handling

## The four tiers

### 1. Public
Information explicitly approved for public release: marketing collateral, blog posts, published API docs, public job ads.
**Handling**: no restrictions.

### 2. Internal
Day-to-day Acme business information not intended for outsiders: meeting notes, internal wikis, non-customer-impacting roadmaps.
**Handling**: store on Acme-managed Google Drive or Notion. Do not forward to personal accounts.

### 3. Confidential
Information whose unauthorized disclosure could harm Acme: customer lists, unannounced product launches, legal matters, internal financials, employee compensation.
**Handling**: encrypt in transit and at rest. Share only via Acme-managed services with named recipients. No printing without approval.

### 4. Restricted
Highly sensitive: PII, payment data, source code with secrets, M&A material, security vulnerabilities.
**Handling**: encrypted, role-based access, access logs reviewed quarterly. Never on personal devices, never on USB drives, never via personal email.

## Tagging
Documents in Google Drive should carry a tier label in the filename or document properties (e.g., "[Confidential]").

## Storage
- Restricted data: Vault, AWS S3 with KMS, or approved customer-data systems only.
- Confidential data: Acme Google Drive or Notion with restricted-share settings.
- Personal cloud accounts (iCloud Drive, Dropbox personal, etc.) are prohibited for any classified data.

## Sharing externally
External sharing of Confidential or Restricted data requires:
- A signed NDA on file with the recipient.
- Manager approval for Restricted.
- A logged share event in Drive (not link sharing).

## Retention & disposal
- PII follows the *Data Retention* schedule (typically 30/60/365 days depending on type).
- Hardware containing Restricted data is wiped using cryptographic erase + a second pass at end-of-life.
- Paper documents are shredded with cross-cut shredders.`,
    },
  },

  // ───────────────────────── 4. BYOD ─────────────────────────
  {
    id: 'byod',
    categoryKey: 'security',
    owner: 'IT & Security',
    contact: 'it@acme.com',
    lastUpdated: '2025-07-15',
    version: '2.6',
    effectiveDate: '2025-08-01',
    regions: ['Global'],
    related: ['acceptable-use', 'mobile-device', 'data-classification'],
    tags: ['byod', 'personal device', 'phone', 'tablet', 'eigenes gerät', 'appareil personnel', 'dispositivo personal', 'dispositivo personale', 'eigen apparaat', 'własne urządzenie'],
    title: {
      en: 'Bring Your Own Device (BYOD) Policy',
      de: 'BYOD-Richtlinie (Eigenes Gerät)',
      fr: 'Politique BYOD (apportez votre propre appareil)',
      es: 'Política BYOD (trae tu propio dispositivo)',
      it: 'Politica BYOD (porta il tuo dispositivo)',
      nl: 'BYOD-beleid (eigen apparaat)',
      pl: 'Polityka BYOD (własne urządzenie)',
    },
    summary: {
      en: 'Personal devices may access email, Slack, and calendar via MDM enrollment. No customer data, no source code on personal devices.',
      de: 'Persönliche Geräte dürfen via MDM auf E-Mail, Slack und Kalender zugreifen. Keine Kundendaten oder Quellcode auf privaten Geräten.',
      fr: 'Les appareils personnels peuvent accéder à l\'e-mail, Slack et au calendrier via MDM. Aucune donnée client ni code source.',
      es: 'Dispositivos personales pueden acceder a email, Slack y calendario vía MDM. Sin datos de clientes ni código fuente.',
      it: 'Dispositivi personali possono accedere a email, Slack e calendario tramite MDM. Niente dati cliente o codice sorgente.',
      nl: 'Persoonlijke apparaten mogen via MDM toegang tot e-mail, Slack en agenda. Geen klantgegevens of broncode.',
      pl: 'Urządzenia osobiste mogą uzyskać dostęp do e-maila, Slacka i kalendarza przez MDM. Bez danych klientów i kodu źródłowego.',
    },
    content: {
      en: `# Bring Your Own Device (BYOD) Policy

## What's allowed
You may use a personal phone or tablet to access:
- Acme email and calendar (Google Workspace mobile)
- Slack
- 1Password
- Approved authenticator apps for MFA

## Mandatory enrollment
Before any access, the device must be enrolled in Acme's MDM (Jamf for iOS/macOS personal Macs, Microsoft Intune for Android/Windows). Enrollment installs:
- A separate work profile (Android Work Profile / iOS managed apps).
- A device passcode requirement (6+ digit numeric or alphanumeric).
- Remote-wipe capability — limited to the work profile, not the full device.

## What's not allowed
Personal devices must not be used to:
- Store, edit, or transfer customer data.
- Access source code repositories or production systems.
- Hold Restricted-tier data of any kind.
- Connect to Acme's wired or admin networks.

## Personal laptops
Personal laptops are not permitted for Acme work. Engineering and customer-facing roles are issued an Acme laptop. Limited exceptions for short-term contractors require Security approval.

## Loss or theft
Report immediately. IT can wipe the work profile remotely, leaving personal data intact.

## Departure
On exit, the work profile is removed automatically; personal data and apps are unaffected.

## Stipend
Acme does not subsidize personal device purchases. Mobile data plans are not reimbursed unless the role requires extensive on-call or field work.`,
    },
  },

  // ───────────────────────── 5. VPN & remote access ─────────────────────────
  {
    id: 'vpn-remote-access',
    categoryKey: 'access',
    owner: 'IT & Security',
    contact: 'it@acme.com',
    lastUpdated: '2026-02-05',
    version: '5.0',
    effectiveDate: '2026-02-15',
    regions: ['Global'],
    related: ['acceptable-use', 'password-mfa'],
    tags: ['vpn', 'remote access', 'zerotrust', 'fernzugriff', 'accès distant', 'acceso remoto', 'accesso remoto', 'externe toegang', 'dostęp zdalny'],
    title: {
      en: 'VPN & Remote Access Policy',
      de: 'VPN- und Fernzugriffsrichtlinie',
      fr: 'Politique VPN et accès distant',
      es: 'Política de VPN y acceso remoto',
      it: 'Politica VPN e accesso remoto',
      nl: 'VPN- en Externe-toegangsbeleid',
      pl: 'Polityka VPN i dostępu zdalnego',
    },
    summary: {
      en: 'Tailscale ZeroTrust for production access; legacy WireGuard VPN for office network resources. MFA required.',
      de: 'Tailscale ZeroTrust für Produktionszugriff; klassisches WireGuard-VPN für Büro-Ressourcen. MFA erforderlich.',
      fr: 'Tailscale ZeroTrust pour la production ; WireGuard VPN pour les ressources de bureau. MFA obligatoire.',
      es: 'Tailscale ZeroTrust para acceso a producción; WireGuard VPN para recursos de oficina. MFA obligatoria.',
      it: 'Tailscale ZeroTrust per la produzione; WireGuard VPN per risorse d\'ufficio. MFA obbligatoria.',
      nl: 'Tailscale ZeroTrust voor productiesystemen; WireGuard VPN voor kantoorbronnen. MFA verplicht.',
      pl: 'Tailscale ZeroTrust do produkcji; WireGuard VPN do zasobów biurowych. MFA wymagane.',
    },
    content: {
      en: `# VPN & Remote Access Policy

## Two access paths
- **Tailscale (ZeroTrust)**: default path for production systems, internal services, and engineering tools. Per-user, per-device, MFA-bound.
- **WireGuard VPN**: legacy path for a small set of office-network resources. Being phased out in 2026.

## Connection requirements
- Acme-managed device with current OS and EDR agent (CrowdStrike).
- Active SSO session and MFA.
- No connection from public Wi-Fi without VPN.

## Connecting from abroad
Connections from countries on the OFAC sanctions list are blocked at the gateway. Notify Security at security@acme.com if travelling to such regions.

## Always-on
For roles handling customer data, Tailscale is configured **always-on** with a kill-switch that drops traffic if the tunnel is interrupted.

## Split tunneling
Disabled by default. Personal traffic does not route through Acme's network. Exceptions require Security approval.

## Troubleshooting
1. Check the Tailscale agent status in your menu bar.
2. Re-authenticate via SSO if the device shows as expired.
3. Open an IT ticket if the issue persists. Tag *VPN* and include the diagnostic log.

## Account expiry
VPN access is automatically revoked 24 hours after termination, role change to a non-eligible role, or 60 days of inactivity.`,
    },
  },

  // ───────────────────────── 6. AI tool usage ─────────────────────────
  {
    id: 'ai-tool-usage',
    categoryKey: 'security',
    owner: 'IT & Security + Legal',
    contact: 'ai-policy@acme.com',
    lastUpdated: '2026-04-15',
    version: '2.0',
    effectiveDate: '2026-05-01',
    regions: ['Global'],
    related: ['data-classification', 'acceptable-use'],
    tags: ['ai', 'chatgpt', 'copilot', 'llm', 'genai', 'künstliche intelligenz', 'intelligence artificielle', 'inteligencia artificial', 'intelligenza artificiale', 'kunstmatige intelligentie', 'sztuczna inteligencja'],
    title: {
      en: 'AI Tool Usage Policy',
      de: 'Richtlinie zur Nutzung von KI-Tools',
      fr: 'Politique d\'utilisation des outils d\'IA',
      es: 'Política de uso de herramientas de IA',
      it: 'Politica sull\'uso degli strumenti di IA',
      nl: 'Beleid Gebruik AI-tools',
      pl: 'Polityka korzystania z narzędzi AI',
    },
    summary: {
      en: 'Approved AI tools list, what data may go in, attribution rules for AI-generated work, and prohibited uses.',
      de: 'Liste freigegebener KI-Tools, erlaubte Eingabedaten, Kennzeichnungsregeln für KI-Inhalte und verbotene Nutzungen.',
      fr: 'Liste des outils d\'IA approuvés, données autorisées en entrée, règles d\'attribution et usages interdits.',
      es: 'Lista de herramientas de IA aprobadas, datos permitidos, normas de atribución y usos prohibidos.',
      it: 'Elenco di strumenti IA approvati, dati ammessi, regole di attribuzione e usi vietati.',
      nl: 'Lijst goedgekeurde AI-tools, toegestane invoer, attributieregels en verboden gebruik.',
      pl: 'Lista zatwierdzonych narzędzi AI, dozwolone dane, zasady oznaczania i zakazy.',
    },
    content: {
      en: `# AI Tool Usage Policy

## Approved tools (Tier 1 — enterprise, DPA in place)
- **ChatGPT Enterprise** (provisioned via SSO; data not used for training)
- **GitHub Copilot Business** (engineering only)
- **Claude for Work** (provisioned via SSO)
- **Microsoft 365 Copilot** (in pilot for selected teams)
- **Glean** (enterprise search)

## Conditionally approved (Tier 2 — public web tools)
- ChatGPT free / Plus, Claude.ai consumer, Gemini, Perplexity:
  - Permitted only with **Public** or **Internal** data.
  - Disable training/data sharing in settings where the option exists.
  - Never paste customer data, source code containing secrets, financial details, or unannounced strategy.

## Prohibited
- Restricted data in any AI tool, including Tier 1.
- Generating content that misrepresents Acme or impersonates real people.
- Submitting AI-generated code to production without human review and tests.
- Using AI to draft legally binding contracts, pricing commitments, or HR decisions without human review.

## Attribution
- Mark customer-facing material that is substantially AI-generated as such where required by local law (EU AI Act provisions take effect August 2026).
- Internal wiki pages may add a "[AI-assisted]" footer.

## Code review
AI-suggested code is treated like code from any contributor: it must pass review, tests, and the security checklist.

## License & IP
Verify that AI-generated content does not reproduce third-party copyrighted material verbatim. Be cautious with image, music, and long-form text generation.

## Reporting concerns
Suspected leak of confidential data into a public AI tool: report immediately to security@acme.com. The tool's data-deletion process will be initiated and the incident logged.`,
    },
  },

  // ───────────────────────── 7. Software approval ─────────────────────────
  {
    id: 'software-approval',
    categoryKey: 'it_ops',
    owner: 'IT & Security',
    contact: 'it@acme.com',
    lastUpdated: '2025-09-01',
    version: '3.4',
    effectiveDate: '2025-09-15',
    regions: ['Global'],
    related: ['acceptable-use', 'ai-tool-usage'],
    tags: ['software', 'license', 'app catalog', 'shadow it', 'genehmigung', 'lizenz', 'logiciel', 'licence', 'software', 'licencia', 'oprogramowanie', 'licencja'],
    title: {
      en: 'Software Approval & Licensing',
      de: 'Software-Freigabe und Lizenzierung',
      fr: 'Approbation et licences logicielles',
      es: 'Aprobación y licencias de software',
      it: 'Approvazione e licenze software',
      nl: 'Softwaregoedkeuring en licenties',
      pl: 'Zatwierdzanie i licencje oprogramowania',
    },
    summary: {
      en: 'How to request a new tool, how the security and DPA review works, and the standard software catalog.',
      de: 'Anfrage neuer Tools, Ablauf der Sicherheits- und DPA-Prüfung sowie der Standard-Softwarekatalog.',
      fr: 'Comment demander un nouvel outil, déroulé de la revue sécurité/DPA et catalogue logiciel standard.',
      es: 'Cómo solicitar una nueva herramienta, revisión de seguridad/DPA y catálogo de software estándar.',
      it: 'Come richiedere un nuovo tool, processo di revisione sicurezza/DPA e catalogo software standard.',
      nl: 'Hoe een nieuwe tool aanvragen, security/DPA-review en standaard softwarecatalogus.',
      pl: 'Jak zgłosić nowe narzędzie, przegląd bezpieczeństwa/DPA i standardowy katalog oprogramowania.',
    },
    content: {
      en: `# Software Approval & Licensing

## Standard catalog
The Acme app catalog (in Okta) lists all pre-approved tools, available without further approval. Examples: Slack, Notion, Figma, Jira, GitHub, Salesforce.

## Requesting a new tool
1. Search the catalog first.
2. If the tool is not present, raise an IT ticket of type *Software Request*.
3. IT will review for: existing alternatives, license cost, data exposure, vendor security posture (SOC 2 / ISO 27001 / Cloud Security Alliance), GDPR DPA, and admin SSO support.
4. Decision target: 5 business days for low-risk tools, 15 for tools that touch customer data.

## License management
- Annual license review every January.
- Unused licenses (no login in 60 days) are reclaimed automatically.
- License costs charged back to the requesting team's cost center.

## Free / freemium tools
Even free tools require approval. The trigger is **data exposure**, not cost.

## Browser extensions
Treated as software. Allowed extensions are pushed through the managed Chrome/Edge profile. Personal extensions on work browsers are blocked.

## Self-developed tools
Internal scripts, dashboards, and small services that handle Internal-tier data only do not need approval if hosted on Acme infrastructure. Anything that touches customer data follows the standard review.

## Sunsetting
When a tool is sunset, IT will provide at least 60 days' notice and a migration path. Data export is the team's responsibility.`,
    },
  },

  // ───────────────────────── 8. Phishing & email security ─────────────────────────
  {
    id: 'phishing-email-security',
    categoryKey: 'security',
    owner: 'IT & Security',
    contact: 'security@acme.com',
    lastUpdated: '2025-12-12',
    version: '4.5',
    effectiveDate: '2026-01-01',
    regions: ['Global'],
    related: ['incident-response', 'password-mfa'],
    tags: ['phishing', 'email', 'spam', 'social engineering', 'phishing', 'hameçonnage', 'suplantación', 'phishing', 'phishing', 'wyłudzenie'],
    title: {
      en: 'Phishing & Email Security',
      de: 'Phishing und E-Mail-Sicherheit',
      fr: 'Hameçonnage et sécurité e-mail',
      es: 'Phishing y seguridad del correo',
      it: 'Phishing e sicurezza email',
      nl: 'Phishing en e-mailbeveiliging',
      pl: 'Phishing i bezpieczeństwo e-mail',
    },
    summary: {
      en: 'How to spot phishing, how to report it (Phish Alert button), and quarterly simulated phishing exercises.',
      de: 'Phishing erkennen, melden (Phish-Alert-Button) und quartalsweise simulierte Phishing-Übungen.',
      fr: 'Reconnaître le phishing, signaler (bouton Phish Alert), exercices trimestriels.',
      es: 'Detectar phishing, denunciar (botón Phish Alert) y simulacros trimestrales.',
      it: 'Riconoscere phishing, segnalare (pulsante Phish Alert) ed esercitazioni trimestrali.',
      nl: 'Phishing herkennen, melden (Phish Alert-knop) en kwartaalsimulaties.',
      pl: 'Rozpoznawanie phishingu, zgłaszanie (przycisk Phish Alert) i ćwiczenia kwartalne.',
    },
    content: {
      en: `# Phishing & Email Security

## How to spot phishing
- Sender address looks similar but not identical to a real domain (e.g., \`paypa1.com\`).
- Urgency or fear ("your account will be suspended in 24 hours").
- Unexpected attachments or links.
- Requests for credentials, MFA codes, or wire transfers.
- Mismatched greetings ("Dear Customer" from someone who knows you).

## Reporting
Use the **Phish Alert button** in Gmail to forward suspected messages to security@acme.com. The Security team reviews within 1 hour during business hours and 4 hours otherwise.

## Quarterly simulations
Acme runs quarterly simulated phishing campaigns. Falling for a simulation triggers a short refresher module — not disciplinary action. Repeated failures are coached.

## What to do if you clicked
1. Disconnect from the network (turn off Wi-Fi).
2. Notify security@acme.com immediately.
3. Run the CrowdStrike on-demand scan.
4. Reset the affected account password and revoke active sessions.

## Wire fraud / CEO fraud
Any email asking you to:
- Buy gift cards
- Wire money
- Change payment details for a vendor
- Send sensitive HR data
must be **verified out of band** (phone or in-person) before action, even if the sender appears to be a senior leader.

## Email retention
Acme retains email per the *Data Retention* policy. Personal use should be minimized; do not use Acme email for personal financial or legal correspondence.`,
    },
  },

  // ───────────────────────── 9. Incident response ─────────────────────────
  {
    id: 'incident-response',
    categoryKey: 'security',
    owner: 'IT & Security',
    contact: 'security@acme.com',
    lastUpdated: '2025-10-05',
    version: '6.2',
    effectiveDate: '2025-10-15',
    regions: ['Global'],
    related: ['phishing-email-security', 'data-classification'],
    tags: ['incident', 'breach', 'response', 'sirt', 'sicherheitsvorfall', 'incident', 'incidente', 'incidente', 'incident', 'incydent'],
    title: {
      en: 'Security Incident Response',
      de: 'Reaktion auf Sicherheitsvorfälle',
      fr: 'Réponse aux incidents de sécurité',
      es: 'Respuesta a incidentes de seguridad',
      it: 'Risposta agli incidenti di sicurezza',
      nl: 'Beveiligingsincident-response',
      pl: 'Reagowanie na incydenty bezpieczeństwa',
    },
    summary: {
      en: 'What to report, how to report, severity levels, and the on-call SIRT process. Customer breach notification within 72 hours.',
      de: 'Was zu melden ist, Meldeweg, Schweregrade und der SIRT-Bereitschaftsdienst. Kundenmeldung bei Datenschutzverletzungen binnen 72 Stunden.',
      fr: 'Quoi signaler, comment, niveaux de gravité et processus SIRT. Notification client en cas de violation sous 72 heures.',
      es: 'Qué reportar, cómo, niveles de severidad y el proceso SIRT. Notificación a clientes en 72 horas en caso de brecha.',
      it: 'Cosa segnalare, come, livelli di gravità e il processo SIRT. Notifica al cliente entro 72 ore in caso di breach.',
      nl: 'Wat melden, hoe, severity-niveaus en het SIRT-proces. Klantmelding bij datalek binnen 72 uur.',
      pl: 'Co zgłaszać, jak, poziomy ważności i proces SIRT. Powiadomienie klienta w ciągu 72 godzin w razie naruszenia.',
    },
    content: {
      en: `# Security Incident Response

## What counts as an incident
- Lost or stolen Acme device.
- Suspected account compromise (unusual logins, MFA prompts you didn't initiate).
- Confirmed phishing click or credential disclosure.
- Customer data exposure (even short-lived).
- Malware detected by CrowdStrike or any unusual EDR alerts.
- Vulnerabilities reported by external researchers.

## How to report
Two equivalent channels:
- Email **security@acme.com** (monitored 24/7).
- Call the security on-call: **+1-800-555-0188** (US) / **+49-30-555-0199** (DE).

## Severity levels
| Severity | Definition | Target acknowledgement |
|---|---|---|
| **SEV-1** | Active breach or live exfiltration | 15 minutes |
| **SEV-2** | Confirmed compromise, contained | 1 hour |
| **SEV-3** | Suspected compromise under investigation | 4 hours |
| **SEV-4** | Vulnerability or near-miss | 1 business day |

## Roles in an incident
- **Incident Commander**: a senior security engineer; runs the response.
- **Communications Lead**: drafts updates for customers, employees, regulators.
- **Scribe**: timestamps every decision in the incident channel.
- **Subject-matter experts**: pulled in as needed.

## Customer notification
For incidents affecting customer data, Acme follows the **GDPR 72-hour notification rule** and the equivalent SOC 2 / contractual commitments. Notification is signed off by the General Counsel.

## Post-incident review
Every SEV-1 and SEV-2 receives a blameless post-incident review within 10 business days. Outputs: corrective actions, owner, due date — tracked in Jira.

## Confidentiality
Do not discuss active incidents on social media or with the press. Direct all media inquiries to communications@acme.com.`,
    },
  },

  // ───────────────────────── 10. Mobile device ─────────────────────────
  {
    id: 'mobile-device',
    categoryKey: 'security',
    owner: 'IT & Security',
    contact: 'it@acme.com',
    lastUpdated: '2025-11-25',
    version: '3.0',
    effectiveDate: '2025-12-15',
    regions: ['Global'],
    related: ['byod', 'acceptable-use'],
    tags: ['mobile', 'phone', 'iphone', 'android', 'mdm', 'mobiltelefon', 'téléphone', 'móvil', 'cellulare', 'mobiel', 'telefon'],
    title: {
      en: 'Mobile Device Policy',
      de: 'Richtlinie für Mobilgeräte',
      fr: 'Politique des appareils mobiles',
      es: 'Política de dispositivos móviles',
      it: 'Politica sui dispositivi mobili',
      nl: 'Beleid Mobiele Apparaten',
      pl: 'Polityka urządzeń mobilnych',
    },
    summary: {
      en: 'Acme-issued phones for select roles. MDM-managed. Encryption, passcode, and remote wipe required.',
      de: 'Acme-Telefone für ausgewählte Rollen. MDM-verwaltet. Verschlüsselung, Passcode und Remote-Löschung erforderlich.',
      fr: 'Téléphones Acme pour rôles sélectionnés. Gérés via MDM. Chiffrement, code et effacement à distance requis.',
      es: 'Teléfonos Acme para roles seleccionados. Gestionados por MDM. Cifrado, código y borrado remoto obligatorios.',
      it: 'Telefoni Acme per ruoli selezionati. Gestiti via MDM. Crittografia, passcode e wipe remoto obbligatori.',
      nl: 'Acme-telefoons voor select rollen. MDM-beheerd. Encryptie, code en remote wipe vereist.',
      pl: 'Telefony Acme dla wybranych ról. Zarządzane przez MDM. Szyfrowanie, kod i zdalne czyszczenie wymagane.',
    },
    content: {
      en: `# Mobile Device Policy

## Eligibility for an Acme-issued phone
- Customer-facing roles (Sales, CS, Field, Solutions Engineering).
- On-call engineering and SRE.
- Senior leadership (VP+).
Other roles may use a personal device under the *BYOD* policy.

## Device standards
- iPhone (latest -2 generations) or Samsung Galaxy S/A series.
- Latest two major OS versions supported.
- Acme MDM (Jamf for iOS, Intune for Android) enrolled before first use.

## Required settings
- Device passcode: 6+ digits or biometric.
- Auto-lock: 5 minutes max.
- Encryption: enabled (default on supported devices).
- Find My: enabled and tied to Acme account.

## What you can install
- Apps from the official App Store / Play Store only.
- Acme catalog apps via the work profile.
- Personal apps in the personal profile are not visible to IT.

## Loss or theft
Report to it@acme.com immediately. IT can wipe the work profile (BYOD) or the entire device (Acme-issued) within minutes.

## Travel
- Outside the EU/US/UK, switch to a "travel device" if available, especially when entering high-risk regions.
- Avoid charging on untrusted USB ports.
- Do not connect to public Wi-Fi without VPN.

## End of life
Acme-issued devices: returned via Equipment Return ticket. Personal devices on BYOD: work profile is automatically removed on offboarding.`,
    },
  },

  // ───────────────────────── 11. GDPR / data subject requests ─────────────────────────
  {
    id: 'gdpr-data-requests',
    categoryKey: 'data_privacy',
    owner: 'Privacy Office',
    contact: 'privacy@acme.com',
    lastUpdated: '2025-06-01',
    version: '4.1',
    effectiveDate: '2025-07-01',
    regions: ['EU', 'UK', 'DE', 'FR', 'ES', 'IT', 'NL', 'PL'],
    related: ['data-classification', 'incident-response'],
    tags: ['gdpr', 'dsar', 'privacy', 'datenschutz', 'rgpd', 'lopd', 'avg', 'rodo', 'privacidad', 'privacy'],
    title: {
      en: 'GDPR & Data Subject Requests',
      de: 'DSGVO & Betroffenenanfragen',
      fr: 'RGPD et demandes des personnes concernées',
      es: 'RGPD y solicitudes de los interesados',
      it: 'GDPR e richieste degli interessati',
      nl: 'AVG en verzoeken van betrokkenen',
      pl: 'RODO i wnioski osób, których dane dotyczą',
    },
    summary: {
      en: 'How Acme handles DSARs (access, deletion, portability) within statutory timelines, and the role of the DPO.',
      de: 'Bearbeitung von Auskunfts-, Lösch- und Übertragbarkeitsanfragen innerhalb der gesetzlichen Fristen sowie Rolle des DSB.',
      fr: 'Traitement des demandes (accès, suppression, portabilité) dans les délais légaux et rôle du DPO.',
      es: 'Tramitación de solicitudes (acceso, supresión, portabilidad) en los plazos legales y papel del DPD.',
      it: 'Gestione richieste (accesso, cancellazione, portabilità) nei termini di legge e ruolo del DPO.',
      nl: 'Afhandeling DSARs (inzage, verwijdering, portabiliteit) binnen wettelijke termijnen en de rol van de FG.',
      pl: 'Obsługa wniosków (dostęp, usunięcie, przenoszenie) w terminach ustawowych i rola IOD.',
    },
    content: {
      en: `# GDPR & Data Subject Requests

## Scope
This policy covers data subject requests (DSARs) submitted by employees, customers' end users, prospects, and visitors to Acme websites.

## Who handles them
The **Data Protection Officer (DPO)** at privacy@acme.com is the single intake. Internal teams support the DPO with searches across systems.

## Timelines
- Acknowledgement: within 5 business days.
- Substantive response: within **30 calendar days** of the request.
- Extension: up to a further 60 days for complex requests, with notification.

## Rights covered
- Right of access (Art. 15)
- Right to rectification (Art. 16)
- Right to erasure / "right to be forgotten" (Art. 17)
- Right to restriction (Art. 18)
- Right to data portability (Art. 20)
- Right to object (Art. 21)

## What employees should do
- If you receive what looks like a DSAR by any channel — email, support ticket, in-product message — forward it to privacy@acme.com immediately. Do not respond yourself.
- The DPO will coordinate searches across the necessary systems.

## Cross-border transfers
Acme uses EU Standard Contractual Clauses for transfers outside the EEA. The list of approved sub-processors is published at acme.com/legal/subprocessors.

## Records
The DPO maintains a record of all DSARs, including timing, scope, and outcome, for 5 years.`,
    },
  },

  // ───────────────────────── 12. Hardware lifecycle ─────────────────────────
  {
    id: 'hardware-lifecycle',
    categoryKey: 'it_ops',
    owner: 'IT Operations',
    contact: 'it@acme.com',
    lastUpdated: '2025-08-18',
    version: '3.0',
    effectiveDate: '2025-09-01',
    regions: ['Global'],
    related: ['mobile-device', 'acceptable-use'],
    tags: ['hardware', 'laptop', 'refresh', 'return', 'rma', 'gerät', 'matériel', 'hardware', 'hardware', 'hardware', 'sprzęt'],
    title: {
      en: 'Hardware Lifecycle & Replacement',
      de: 'Hardware-Lebenszyklus und Austausch',
      fr: 'Cycle de vie et remplacement du matériel',
      es: 'Ciclo de vida y reemplazo de hardware',
      it: 'Ciclo di vita e sostituzione hardware',
      nl: 'Hardware-levenscyclus en vervanging',
      pl: 'Cykl życia i wymiana sprzętu',
    },
    summary: {
      en: '4-year refresh on laptops, RMA process for failures, return process on departure, and donation of older equipment.',
      de: '4-Jahres-Refresh für Laptops, RMA-Prozess bei Defekten, Rückgabeverfahren beim Austritt und Spenden alter Geräte.',
      fr: 'Renouvellement à 4 ans, processus RMA, restitution au départ, dons de matériel plus ancien.',
      es: 'Renovación a 4 años, proceso RMA, devolución al salir, donación de equipo antiguo.',
      it: 'Rinnovo a 4 anni, processo RMA, restituzione al rientro/uscita e donazione attrezzature.',
      nl: 'Vernieuwing na 4 jaar, RMA-proces, retour bij vertrek en donatie van oudere apparatuur.',
      pl: 'Wymiana po 4 latach, proces RMA, zwrot przy odejściu, darowizny starszego sprzętu.',
    },
    content: {
      en: `# Hardware Lifecycle & Replacement

## Standard kit
- **MacBook Pro 14"** (engineering and design): refreshed every 3 years.
- **MacBook Air 13"** (most other roles): refreshed every 4 years.
- One external monitor (27" 4K) — every 5 years or as needed for ergonomic reasons.
- Headset and webcam on request.

## Replacement triggers
- Scheduled refresh.
- Hardware failure (open an IT ticket of type *Hardware*).
- Performance complaint with diagnostic evidence — IT triages first.
- Loss or theft (insurance covers most cases; police report required for theft).

## RMA process
For Apple devices under AppleCare, IT coordinates depot or local Apple Store repair. Loaners are available for the duration.

## Departure return
- IT issues a return shipping kit 5 business days before last day.
- All Acme equipment must arrive within 7 days of last day.
- Failure to return: cost is deducted from final paycheck per local employment law.

## Damage charge
Negligent damage may be charged at depreciated book value. Normal wear-and-tear is not.

## Re-use & donation
End-of-life devices are wiped and either redeployed for testing or donated to non-profit partners (Computers for Schools, Mada Tech). Personally-buying back your old laptop is not currently offered.

## Accessibility
Reasonable accommodations (split keyboards, vertical mice, large monitors, sit/stand desks, document cameras) are available without manager approval — open an IT ticket and tag *Accessibility*.`,
    },
  },
];

// Localize a single IT policy.
export function localizeITPolicy(policy, lang, includeContent = true) {
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
    uri: `acme://it-policies/${policy.id}`,
    ...(includeContent ? { content: pick(policy.content, lang) } : {}),
  };
}

// Search IT policies.
export function searchITPolicies(query, lang) {
  const q = (query || '').toLowerCase();
  if (!q) return IT_POLICIES.map(p => localizeITPolicy(p, lang, false));

  return IT_POLICIES
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
      const loc = localizeITPolicy(policy, lang, false);
      const fullContent = pick(policy.content, lang);
      return { ...loc, excerpt: fullContent.replace(/^#.*\n/, '').slice(0, 220).trim() + '…' };
    });
}
