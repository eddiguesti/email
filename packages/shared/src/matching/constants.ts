/**
 * Matching Engine Constants
 * Skip domains, common words, keyword noise, name blocklist.
 */

// System/notification senders to always skip
export const SKIP_SENDERS = new Set([
  'postmaster', 'mailer-daemon', 'noreply', 'no-reply', 'notifications-noreply',
  'messages-noreply', 'microsoftexchange',
]);

// Domains that are always spam/newsletter (never legal correspondence)
export const SKIP_DOMAINS = new Set([
  // Social media
  'linkedin.com', 'facebookmail.com', 'twitter.com', 'instagram.com',
  // Media/subscriptions
  'netflix.com', 'members.netflix.com', 'spotify.com', 'deezer.com',
  // Hotels/travel
  'oceaniahotels.com', 'mail.all.com', 'emails.lancel.com',
  // Newsletters/marketing
  'b2b.infopro-digital.com', 'lettres-infos.bercy.gouv.fr',
  'eactus.grdf.fr', 'callibri.fr', 'artistics.com',
  'geostrategia.fr', 'cv.winsearch.fr', 'netexplorer-mailer.com',
  'information.lefebvre-dalloz.fr', 'adverteo.fr', 'facilaw.fr',
  // Bar association newsletters/training
  'barreauparis.org', 'pro-barreau.com',
  // Fashion/retail
  'notshy.fr', 'absolutcashmere.com', 'infos.bycharlot.com',
  // Real estate marketing
  'breteuilhomes.com', 'bosetta-immobilier.com',
  // Pharmacy/health
  'nl.ipharm.fr',
  // Spam/promotional
  'easilyefficient.com', 'havenmoore.com', 'inciks.com',
  'dematis.com', 'cmap.fr', 'hubic.com',
  // Education/training (not legal correspondence)
  'escp.eu', 'side-quest.io', 'esas-formation.fr',
  // Activity reports / automated notifications
  'opalexe.fr',
  // Recruitment
  'indeed.com', 'monster.com', 'sbc-interim.fr',
  // Travel/transport
  'mail.sncf-connect.com', 'news.omio.com',
  // Real estate marketing
  'eosrv.net',
  // Retail/commercial
  'email.boulanger.com', 'boulanger.com', 'cosbutter.com',
  'donakinsca.com', 'citizenssa.com',
  // Telecom marketing (not legal)
  'pour-les-pro.fr', 'espacebusiness.pro',
  // Health insurance comparison spam
  'grysstudio.com',
  // Legal marketing/tools (not case correspondence)
  'justifit.fr', 'lexassist.fr', 'avocats.septeo.com',
  'avoloi.fr', 'email.hub-avocat.fr',
  // Telecom invoices
  'sfr.fr',
]);

// Names to NEVER match — the firm's own signatures, common legal terms, etc.
export const NAME_BLOCKLIST = new Set([
  'BROSSET', 'TECHER', 'BROSSET - TECHER AVOCATS ASSOCIES', 'SELARL BROSSET TECHER',
  'BROSSET - TECHER', 'AVOCATS ASSOCIES', 'LAURENCE BROSSET', 'STEPHANIE TECHER',
  'CABINET BROSSET', 'STÉPHANIE TECHER',
  // Common first names that are too short/generic
  'MARIE', 'PHILIPPE', 'JEAN', 'PIERRE', 'PAUL', 'JACQUES', 'ANNE', 'CLAIRE',
  'ERIC', 'PATRICK', 'NICOLAS', 'THOMAS', 'CHRISTOPHE', 'DAVID', 'LAURENT',
  'FABRICE', 'JUSTINE', 'EMELINE', 'CÉLINE', 'MARION', 'LUCIE', 'CAMILLE',
  'EMMANUELLE', 'NAIMA', 'KADIATOU', 'FREDERIC', 'SYLVIE', 'ISABELLE',
  'NATHALIE', 'VERONIQUE', 'SANDRINE', 'CAROLINE', 'VIRGINIE', 'SOPHIE',
  'FLORENCE', 'STEPHANIE', 'LAURENCE', 'CATHERINE', 'BERTRAND', 'FRANCOIS',
  'MATHIEU', 'SEBASTIEN', 'VINCENT', 'BENOIT', 'ARNAUD', 'JEROME',
  // Generic legal/construction terms that cause false matches
  'EXPERTISE', 'BATIMENT', 'GESTION', 'REFERE', 'CONTENTIEUX', 'TRIBUNAL',
  'BARREAU', 'MAIRIE', 'RECHERCHE', 'CERTIFICATION',
  // Firm mailbox aliases and full firm name variants
  'CABINET', 'CABINET BROSSET TECHER', 'INFO', 'CONTACT',
  'LAURENCE BROSSET AVOCATS ASSOCIES', 'LAURENCE BROSSET AVOCATS ASSOCIÉS',
  'SELARL BROSSET - TECHER', 'SELARL BROSSET-TECHER', 'BROSSET TECHER',
  'SELARL LAURENCE BROSSET AVOCATS', 'SELARL LAURENCE BROSSET',
].map(s => s.toUpperCase()));

// Common words that should NOT trigger surname-only matching
export const COMMON_WORDS = new Set([
  'PARIS', 'FRANCE', 'LYON', 'MARSEILLE', 'BORDEAUX', 'TOULOUSE', 'NANTES',
  'DALLOZ', 'IMMOBILIER', 'ASSURANCE', 'CONSTRUCTION', 'TRAVAUX', 'BATIMENT',
  'NATIONAL', 'GENERAL', 'INTERNATIONAL', 'EXPERT', 'CONSEIL', 'CABINET',
  'SERVICES', 'GROUPE', 'SOCIETE', 'COMPAGNIE', 'JURIDIQUE', 'AVOCAT',
  'MONTREUIL', 'SEINE', 'NEUILLY', 'GENTILLY', 'COLOMBES', 'BOBIGNY',
  'GESTION', 'EXPERTISE', 'ACCESSION', 'PROMOTION', 'ARCHITECTURE',
  'ASSOCIES', 'ASSOCIÉS', 'AVOCATS', 'INGENIERIE', 'CONSULTING', 'REFERENCES',
  'ENTREPRISES', 'ENTREPRISE', 'RESIDENCE', 'RÉSIDENCE', 'HABITAT',
  'GROUP', 'INDUSTRIE', 'INDUSTRIES', 'MANAGEMENT', 'HOLDING',
  'ÉLECTRIQUE', 'ELECTRIQUE', 'TECHNIQUE', 'TECHNOLOGIE', 'FORMATION',
  'ÉQUIPEMENT', 'EQUIPEMENT', 'INSTALLATION', 'INFORMATIQUE', 'DESIGN',
  'AUTRES', 'DIVERS', 'PROJET', 'PROGRAMME', 'OPERATION', 'OPÉRATION',
  'PATRIMOINE', 'INVESTISSEMENT', 'DIAGNOSTIC', 'PROTECTION', 'SOLUTION',
  // Common French surnames — too generic for surname-only matching
  'MARTIN', 'BERNARD', 'PETIT', 'ROBERT', 'RICHARD', 'DURAND', 'MOREAU',
  'SIMON', 'LAURENT', 'MICHEL', 'LEFEBVRE', 'LEROY', 'ROUX', 'DAVID',
  'BERTRAND', 'MOREL', 'GIRARD', 'LAMBERT', 'BONNET', 'DUPONT', 'FONTAINE',
  'ROUSSEAU', 'VINCENT', 'MULLER', 'MERCIER', 'BLANC', 'GUERIN', 'BOYER',
  'GARNIER', 'CHEVALIER', 'FRANCOIS', 'LEGRAND', 'GAUTHIER', 'GARCIA',
  'PERRIN', 'ROBIN', 'CLEMENT', 'MORIN', 'NICOLAS', 'HENRY', 'ROUSSEL',
  'MATHIEU', 'GAUTIER', 'MASSON', 'MARCHAND', 'DUVAL', 'DENIS', 'DUMONT',
  'MARTINEZ', 'BLANCHARD', 'BARBIER', 'BRUNET', 'SCHMITT', 'LEROUX',
  'COLIN', 'FERNANDEZ', 'PIERRE', 'RENARD', 'ARNAUD', 'ROLLAND', 'CARON',
  'AUBERT', 'GIRAUD', 'LECLERC', 'VIDAL', 'BOURGEOIS', 'RENAUD', 'LEMAIRE',
  'LOPEZ', 'PICARD', 'ROGER', 'FAURE', 'NOEL', 'MARIE', 'MOULIN',
  // Common French first names that appear as last words
  'STEPHANE', 'JACQUES', 'PHILIPPE', 'CHRISTIAN', 'DOMINIQUE', 'FREDERIC',
  'OLIVIER', 'THIERRY', 'ALAIN', 'DANIEL', 'PASCAL', 'MICHEL', 'ANDRE',
  'FRANCOISE', 'MONIQUE', 'SYLVIE', 'NATHALIE', 'ISABELLE', 'VERONIQUE',
]);

// Keyword noise — additional terms to ignore in keyword (Tier 6) matching
export const KEYWORD_NOISE = new Set([
  ...COMMON_WORDS,
  'REFERE', 'PREVENTIF', 'ORDONNANCE', 'AFFAIRE', 'DOSSIER', 'SOCIETE',
  'TRIBUNAL', 'COURRIER', 'URGENT', 'NOUVELLE', 'DEMANDE', 'FACTURE',
  'RECOUVREMENT', 'ASSIGNATION', 'SINISTRE', 'CONCLUSIONS', 'RAPPORT',
  'VILLA', 'NUEVA', 'SAINT', 'PARIS',
]);

// Firm admin dossier — Grok maps generic firm emails here, must be filtered
export const FIRM_ADMIN_DOSSIER_REF = '202257';
