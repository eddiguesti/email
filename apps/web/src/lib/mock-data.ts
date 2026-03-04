/**
 * Mock in-memory database for demo mode.
 * All data is hotel-themed and realistic. No real backend required.
 */

// ─── Helper ───────────────────────────────────────────────────────────────────

function daysAgo(d: number, offsetHours = 0): string {
  return new Date(Date.now() - d * 86_400_000 - offsetHours * 3_600_000).toISOString();
}

// ─── Match Logs ───────────────────────────────────────────────────────────────

export const MATCH_LOGS: Record<string, unknown>[] = [
  // Day 0 (today)
  {
    id: 'ml-001', created_at: daysAgo(0, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-001', conversation_id: 'cv-001',
    sender_email: 'james.wilson@gmail.com', sender_name: 'James Wilson', sender_domain: 'gmail.com',
    subject_hash: 'x1', received_at: daysAgo(0, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1042, dossier_ref: 'BKG-2025-0042', dossier_name: 'Wilson, James & Sarah — Suite 405',
    confidence: 0.94, match_source: 'sender_history',
    match_reasons: ['Known guest email — 3 previous stays linked to this booking', 'Booking reference BKG-2025-0042 found in email thread', 'Routed to: Concierge'],
    handler: 'Concierge', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-002', created_at: daysAgo(0, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-002', conversation_id: 'cv-002',
    sender_email: 'noreply@booking.com', sender_name: 'Booking.com', sender_domain: 'booking.com',
    subject_hash: 'x2', received_at: daysAgo(0, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1187, dossier_ref: 'BKG-2025-0187', dossier_name: 'Thompson, Emma — Room 201 (Deluxe)',
    confidence: 0.98, match_source: 'reference_exact',
    match_reasons: ['Booking reference BKG-2025-0187 in subject line', 'OTA confirmation from Booking.com', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-003', created_at: daysAgo(0, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-003', conversation_id: 'cv-003',
    sender_email: 'emma.thompson92@hotmail.com', sender_name: 'Emma Thompson', sender_domain: 'hotmail.com',
    subject_hash: 'x3', received_at: daysAgo(0, 5),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1203, dossier_ref: 'BKG-2025-0203', dossier_name: 'Thompson, Emma — Room 201 (Deluxe)',
    confidence: 0.72, match_source: 'kb_party_fuzzy',
    match_reasons: ['Guest name fuzzy match — email differs from booking email', 'Check-in date overlaps with reservation', 'Routed to: Front Desk'],
    handler: 'Front Desk', action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'To Review', category_color: 'orange', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 1
  {
    id: 'ml-004', created_at: daysAgo(1, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-004', conversation_id: 'cv-004',
    sender_email: 'banqueting@azureweddings.co.uk', sender_name: 'Azure Weddings & Events', sender_domain: 'azureweddings.co.uk',
    subject_hash: 'x4', received_at: daysAgo(1, 1),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1156, dossier_ref: 'EVT-2025-0156', dossier_name: 'Azure Weddings — Grand Ballroom (June 14)',
    confidence: 0.68, match_source: 'kb_keyword',
    match_reasons: ['Event keyword match: wedding reception, catering', 'F&B department routing triggered', 'Routed to: F&B'],
    handler: 'F&B', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(0, 20), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-005', created_at: daysAgo(1, 3), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-005', conversation_id: 'cv-005',
    sender_email: 'corporate.travel@hartmann-group.de', sender_name: 'Hartmann Group Travel', sender_domain: 'hartmann-group.de',
    subject_hash: 'x5', received_at: daysAgo(1, 3),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1094, dossier_ref: 'BKG-2024-0094', dossier_name: 'Hartmann Group — Block Booking (12 rooms)',
    confidence: 0.91, match_source: 'sender_history',
    match_reasons: ['Corporate account — 4 previous group bookings', 'Group booking reference in body', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-006', created_at: daysAgo(1, 6), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-006', conversation_id: 'cv-006',
    sender_email: 'maintenance@premium-lifts.co.uk', sender_name: 'Premium Lifts Ltd', sender_domain: 'premium-lifts.co.uk',
    subject_hash: 'x6', received_at: daysAgo(1, 6),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1011, dossier_ref: 'MNT-2025-0011', dossier_name: 'Maintenance — Elevator 2, Floor 3',
    confidence: 0.88, match_source: 'kb_party_exact',
    match_reasons: ['Registered supplier: Premium Lifts Ltd', 'Maintenance keyword routing triggered', 'Routed to: Maintenance'],
    handler: 'Maintenance', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },

  // Day 2
  {
    id: 'ml-007', created_at: daysAgo(2, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-007', conversation_id: 'cv-007',
    sender_email: 'reservations@expedia.com', sender_name: 'Expedia Partner', sender_domain: 'expedia.com',
    subject_hash: 'x7', received_at: daysAgo(2, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1221, dossier_ref: 'BKG-2025-0221', dossier_name: 'Chen, Li — Standard Double (Rm 118)',
    confidence: 0.97, match_source: 'reference_exact',
    match_reasons: ['Expedia booking ID found in subject', 'OTA confirmation pattern matched', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-008', created_at: daysAgo(2, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-008', conversation_id: 'cv-008',
    sender_email: 'j.patel@techcorp.com', sender_name: 'Jay Patel', sender_domain: 'techcorp.com',
    subject_hash: 'x8', received_at: daysAgo(2, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1088, dossier_ref: 'BKG-2025-0088', dossier_name: 'TechCorp — Annual Conference Block',
    confidence: 0.86, match_source: 'sender_history',
    match_reasons: ['Known corporate account — 2 previous block bookings', 'Company domain techcorp.com matched', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-009', created_at: daysAgo(2, 7), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-009', conversation_id: 'cv-009',
    sender_email: 'info@azureflorists.com', sender_name: 'Azure Florists', sender_domain: 'azureflorists.com',
    subject_hash: 'x9', received_at: daysAgo(2, 7),
    has_attachments: false, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null,
    match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'low', reply_sent: false, reply_sent_at: null,
  },

  // Day 3
  {
    id: 'ml-010', created_at: daysAgo(3, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-010', conversation_id: 'cv-010',
    sender_email: 'gm@grandspa.co.uk', sender_name: 'Grand Spa & Wellness', sender_domain: 'grandspa.co.uk',
    subject_hash: 'x10', received_at: daysAgo(3, 1),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1301, dossier_ref: 'SVC-2025-0301', dossier_name: 'Grand Spa — Wellness Package Partnership',
    confidence: 0.79, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI classified as spa partnership enquiry', 'Company name matched supplier directory', 'Routed to: Concierge'],
    handler: 'Concierge', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(2, 18), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'normal', reply_sent: true, reply_sent_at: daysAgo(2, 16),
  },
  {
    id: 'ml-011', created_at: daysAgo(3, 3), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-011', conversation_id: 'cv-011',
    sender_email: 'catering@citydelights.com', sender_name: 'City Delights Catering', sender_domain: 'citydelights.com',
    subject_hash: 'x11', received_at: daysAgo(3, 3),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1412, dossier_ref: 'EVT-2025-0412', dossier_name: 'City Delights — Private Dining Rm C (March 20)',
    confidence: 0.93, match_source: 'sender_history',
    match_reasons: ['Known catering partner — 5 previous events', 'Invoice reference matched EVT-2025-0412', 'Routed to: F&B'],
    handler: 'F&B', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-012', created_at: daysAgo(3, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-012', conversation_id: 'cv-012',
    sender_email: 'r.dubois@consulting-paris.fr', sender_name: 'René Dubois', sender_domain: 'consulting-paris.fr',
    subject_hash: 'x12', received_at: daysAgo(3, 5),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1178, dossier_ref: 'BKG-2025-0178', dossier_name: 'Dubois, René — Executive Suite 701',
    confidence: 0.63, match_source: 'kb_party_fuzzy',
    match_reasons: ['Guest surname match (Dubois)', 'Language detection: French guest', 'Routed to: Front Desk'],
    handler: 'Front Desk', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(2, 22), review_approved: false,
    category_label: 'Rejected', category_color: 'red', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 4
  {
    id: 'ml-013', created_at: daysAgo(4, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-013', conversation_id: 'cv-013',
    sender_email: 'housekeeping@cleanpro.com', sender_name: 'CleanPro Services', sender_domain: 'cleanpro.com',
    subject_hash: 'x13', received_at: daysAgo(4, 2),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1055, dossier_ref: 'SVC-2025-0055', dossier_name: 'CleanPro — Monthly Housekeeping Contract',
    confidence: 0.95, match_source: 'kb_party_exact',
    match_reasons: ['Registered supplier: CleanPro Services', 'Invoice #CP-2025-045 matched contract record', 'Routed to: Housekeeping'],
    handler: 'Housekeeping', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-014', created_at: daysAgo(4, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-014', conversation_id: 'cv-014',
    sender_email: 'sophie.martin@orange.fr', sender_name: 'Sophie Martin', sender_domain: 'orange.fr',
    subject_hash: 'x14', received_at: daysAgo(4, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1192, dossier_ref: 'BKG-2025-0192', dossier_name: 'Martin, Sophie — Junior Suite 304',
    confidence: 0.89, match_source: 'sender_history',
    match_reasons: ['Return guest — 2 previous stays', 'Membership number GA-8823 found in email', 'Routed to: Concierge'],
    handler: 'Concierge', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-015', created_at: daysAgo(4, 8), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-015', conversation_id: 'cv-015',
    sender_email: 'accounts@globalinsurance.com', sender_name: 'Global Insurance Ltd', sender_domain: 'globalinsurance.com',
    subject_hash: 'x15', received_at: daysAgo(4, 8),
    has_attachments: true, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null, match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 5
  {
    id: 'ml-016', created_at: daysAgo(5, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-016', conversation_id: 'cv-016',
    sender_email: 'reservations@airbnb.com', sender_name: 'Airbnb', sender_domain: 'airbnb.com',
    subject_hash: 'x16', received_at: daysAgo(5, 1),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1244, dossier_ref: 'BKG-2025-0244', dossier_name: 'Nakamura, Yuki — Penthouse Suite',
    confidence: 0.96, match_source: 'reference_exact',
    match_reasons: ['Airbnb confirmation ID found in email body', 'OTA pattern: check-in/check-out dates matched', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-017', created_at: daysAgo(5, 3), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-017', conversation_id: 'cv-017',
    sender_email: 'events@metropolitan-arts.org', sender_name: 'Metropolitan Arts Foundation', sender_domain: 'metropolitan-arts.org',
    subject_hash: 'x17', received_at: daysAgo(5, 3),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1388, dossier_ref: 'EVT-2025-0388', dossier_name: 'Metro Arts — Gala Dinner (April 5)',
    confidence: 0.82, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: event planning enquiry for gala dinner', 'Grand Ballroom keyword matched', 'Routed to: Events & Banqueting'],
    handler: 'Events & Banqueting', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(4, 20), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'high', reply_sent: true, reply_sent_at: daysAgo(4, 18),
  },
  {
    id: 'ml-018', created_at: daysAgo(5, 6), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-018', conversation_id: 'cv-018',
    sender_email: 'noreply@tripadvisor.com', sender_name: 'TripAdvisor', sender_domain: 'tripadvisor.com',
    subject_hash: 'x18', received_at: daysAgo(5, 6),
    has_attachments: false, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null, match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'low', reply_sent: false, reply_sent_at: null,
  },

  // Day 7
  {
    id: 'ml-019', created_at: daysAgo(7, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-019', conversation_id: 'cv-019',
    sender_email: 'finance@gastrocorp.com', sender_name: 'GastroCorp Finance', sender_domain: 'gastrocorp.com',
    subject_hash: 'x19', received_at: daysAgo(7, 2),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1067, dossier_ref: 'FIN-2025-0067', dossier_name: 'GastroCorp — F&B Supply Agreement',
    confidence: 0.91, match_source: 'kb_party_exact',
    match_reasons: ['Registered supplier: GastroCorp Finance', 'Purchase order PO-9934 matched', 'Routed to: Finance'],
    handler: 'Finance', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-020', created_at: daysAgo(7, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-020', conversation_id: 'cv-020',
    sender_email: 'a.kowalski@warsaw-imports.pl', sender_name: 'Anna Kowalski', sender_domain: 'warsaw-imports.pl',
    subject_hash: 'x20', received_at: daysAgo(7, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1319, dossier_ref: 'BKG-2025-0319', dossier_name: 'Kowalski, Anna — Room 309 (Superior)',
    confidence: 0.75, match_source: 'kb_party_fuzzy',
    match_reasons: ['Guest surname match: Kowalski', 'Arrival date confirmed in email', 'Routed to: Front Desk'],
    handler: 'Front Desk', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(6, 22), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-021', created_at: daysAgo(7, 7), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-021', conversation_id: 'cv-021',
    sender_email: 'p.okonkwo@ngbusiness.com', sender_name: 'Peter Okonkwo', sender_domain: 'ngbusiness.com',
    subject_hash: 'x21', received_at: daysAgo(7, 7),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1445, dossier_ref: 'BKG-2025-0445', dossier_name: 'Okonkwo, Peter — Business Room 215',
    confidence: 0.87, match_source: 'sender_history',
    match_reasons: ['Known guest — 1 previous stay', 'Business account corporate rate applied', 'Routed to: Front Desk'],
    handler: 'Front Desk', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 9
  {
    id: 'ml-022', created_at: daysAgo(9, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-022', conversation_id: 'cv-022',
    sender_email: 'security@azure-events.com', sender_name: 'Azure Security Ltd', sender_domain: 'azure-events.com',
    subject_hash: 'x22', received_at: daysAgo(9, 1),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1022, dossier_ref: 'SVC-2025-0022', dossier_name: 'Azure Security — Event Security Contract',
    confidence: 0.93, match_source: 'kb_party_exact',
    match_reasons: ['Supplier exact match: Azure Security Ltd', 'Service contract SVC-2025-0022 referenced', 'Routed to: Events & Banqueting'],
    handler: 'Events & Banqueting', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-023', created_at: daysAgo(9, 3), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-023', conversation_id: 'cv-023',
    sender_email: 'info@luxurylinen.co.uk', sender_name: 'Luxury Linen Co.', sender_domain: 'luxurylinen.co.uk',
    subject_hash: 'x23', received_at: daysAgo(9, 3),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1034, dossier_ref: 'SVC-2025-0034', dossier_name: 'Luxury Linen — Linen Supply Contract',
    confidence: 0.96, match_source: 'sender_history',
    match_reasons: ['Recurring supplier — 12 previous invoices', 'Invoice LLU-2025-089 matched contract', 'Routed to: Housekeeping'],
    handler: 'Housekeeping', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 11
  {
    id: 'ml-024', created_at: daysAgo(11, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-024', conversation_id: 'cv-024',
    sender_email: 'noreply@hotels.com', sender_name: 'Hotels.com', sender_domain: 'hotels.com',
    subject_hash: 'x24', received_at: daysAgo(11, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1267, dossier_ref: 'BKG-2025-0267', dossier_name: 'Bernstein, Claire — Classic Room 112',
    confidence: 0.97, match_source: 'reference_exact',
    match_reasons: ['Hotels.com reservation ID found in subject', 'Check-in/out dates confirmed', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-025', created_at: daysAgo(11, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-025', conversation_id: 'cv-025',
    sender_email: 'david.lee@yahoo.com', sender_name: 'David Lee', sender_domain: 'yahoo.com',
    subject_hash: 'x25', received_at: daysAgo(11, 5),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1299, dossier_ref: 'BKG-2025-0299', dossier_name: 'Lee, David — Family Room 502',
    confidence: 0.66, match_source: 'kb_party_fuzzy',
    match_reasons: ['Guest name partial match', 'Arrival window overlaps with booking', 'Routed to: Front Desk'],
    handler: 'Front Desk', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(10, 18), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 13
  {
    id: 'ml-026', created_at: daysAgo(13, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-026', conversation_id: 'cv-026',
    sender_email: 'pa@sterling-investments.com', sender_name: 'Sterling Investments PA', sender_domain: 'sterling-investments.com',
    subject_hash: 'x26', received_at: daysAgo(13, 1),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1358, dossier_ref: 'BKG-2025-0358', dossier_name: 'Sterling Investments — Director Suite (4 nights)',
    confidence: 0.85, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: corporate VIP booking inquiry', 'Company matched existing corporate account', 'Routed to: Concierge'],
    handler: 'Concierge', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-027', created_at: daysAgo(13, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-027', conversation_id: 'cv-027',
    sender_email: 'info@freshflowers.co.uk', sender_name: 'Fresh Flowers Co.', sender_domain: 'freshflowers.co.uk',
    subject_hash: 'x27', received_at: daysAgo(13, 4),
    has_attachments: false, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null, match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'low', reply_sent: false, reply_sent_at: null,
  },

  // Day 15
  {
    id: 'ml-028', created_at: daysAgo(15, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-028', conversation_id: 'cv-028',
    sender_email: 'noreply@booking.com', sender_name: 'Booking.com', sender_domain: 'booking.com',
    subject_hash: 'x28', received_at: daysAgo(15, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1376, dossier_ref: 'BKG-2025-0376', dossier_name: 'García, Carlos — Superior Double (Rm 214)',
    confidence: 0.98, match_source: 'reference_exact',
    match_reasons: ['Booking.com reservation number in subject', 'Automated OTA confirmation', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-029', created_at: daysAgo(15, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-029', conversation_id: 'cv-029',
    sender_email: 'hvac@cooltech-systems.com', sender_name: 'CoolTech HVAC Systems', sender_domain: 'cooltech-systems.com',
    subject_hash: 'x29', received_at: daysAgo(15, 5),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1018, dossier_ref: 'MNT-2025-0018', dossier_name: 'CoolTech — HVAC Annual Service',
    confidence: 0.90, match_source: 'kb_party_exact',
    match_reasons: ['Supplier match: CoolTech HVAC Systems', 'Service visit scheduled in email body', 'Routed to: Maintenance'],
    handler: 'Maintenance', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-030', created_at: daysAgo(15, 8), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-030', conversation_id: 'cv-030',
    sender_email: 'm.ferrari@fiat.it', sender_name: 'Marco Ferrari', sender_domain: 'fiat.it',
    subject_hash: 'x30', received_at: daysAgo(15, 8),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1411, dossier_ref: 'BKG-2025-0411', dossier_name: 'Ferrari, Marco — Classic Room 119',
    confidence: 0.73, match_source: 'kb_party_fuzzy',
    match_reasons: ['Guest surname match: Ferrari', 'Italian email domain matched guest nationality', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(14, 20), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 17
  {
    id: 'ml-031', created_at: daysAgo(17, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-031', conversation_id: 'cv-031',
    sender_email: 'events@oxford-conference.ac.uk', sender_name: 'Oxford Conference Centre', sender_domain: 'oxford-conference.ac.uk',
    subject_hash: 'x31', received_at: daysAgo(17, 1),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1477, dossier_ref: 'EVT-2025-0477', dossier_name: 'Oxford Conference — Annual Symposium Block',
    confidence: 0.88, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: academic conference group booking', 'Block of 18 rooms requested', 'Routed to: Events & Banqueting'],
    handler: 'Events & Banqueting', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-032', created_at: daysAgo(17, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-032', conversation_id: 'cv-032',
    sender_email: 'f.huang@globaltrade.cn', sender_name: 'Fang Huang', sender_domain: 'globaltrade.cn',
    subject_hash: 'x32', received_at: daysAgo(17, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1352, dossier_ref: 'BKG-2025-0352', dossier_name: 'Huang, Fang — Superior Room 417',
    confidence: 0.61, match_source: 'kb_keyword',
    match_reasons: ['Booking keyword: reservation enquiry, room preference', 'Check-in date in body', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(16, 16), review_approved: false,
    category_label: 'Rejected', category_color: 'red', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 20
  {
    id: 'ml-033', created_at: daysAgo(20, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-033', conversation_id: 'cv-033',
    sender_email: 'wine@bordeaux-select.fr', sender_name: 'Bordeaux Select', sender_domain: 'bordeaux-select.fr',
    subject_hash: 'x33', received_at: daysAgo(20, 2),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1070, dossier_ref: 'FIN-2025-0070', dossier_name: 'Bordeaux Select — Wine Cellar Restocking',
    confidence: 0.93, match_source: 'sender_history',
    match_reasons: ['Known supplier — 8 previous wine orders', 'Invoice BS-2025-034 matched', 'Routed to: F&B'],
    handler: 'F&B', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-034', created_at: daysAgo(20, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-034', conversation_id: 'cv-034',
    sender_email: 'noreply@expedia.com', sender_name: 'Expedia', sender_domain: 'expedia.com',
    subject_hash: 'x34', received_at: daysAgo(20, 5),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1488, dossier_ref: 'BKG-2025-0488', dossier_name: 'Santos, Miguel — Deluxe Room 321',
    confidence: 0.97, match_source: 'reference_exact',
    match_reasons: ['Expedia confirmation EXP-7823 in subject', 'OTA booking confirmed', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 22
  {
    id: 'ml-035', created_at: daysAgo(22, 3), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-035', conversation_id: 'cv-035',
    sender_email: 'marketing@luxurymagazine.co.uk', sender_name: 'Luxury Magazine', sender_domain: 'luxurymagazine.co.uk',
    subject_hash: 'x35', received_at: daysAgo(22, 3),
    has_attachments: false, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null, match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'low', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-036', created_at: daysAgo(22, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-036', conversation_id: 'cv-036',
    sender_email: 'k.andersen@nordic-travel.dk', sender_name: 'Kirsten Andersen', sender_domain: 'nordic-travel.dk',
    subject_hash: 'x36', received_at: daysAgo(22, 5),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1399, dossier_ref: 'BKG-2025-0399', dossier_name: 'Andersen, Kirsten — Junior Suite 305',
    confidence: 0.86, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: direct booking inquiry for named guest', 'Guest database match: Kirsten Andersen', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 24
  {
    id: 'ml-037', created_at: daysAgo(24, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-037', conversation_id: 'cv-037',
    sender_email: 'gm.office@grandazurehotel.com', sender_name: 'GM Office Internal', sender_domain: 'grandazurehotel.com',
    subject_hash: 'x37', received_at: daysAgo(24, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1001, dossier_ref: 'INT-2025-0001', dossier_name: 'Internal — Q1 Performance Review',
    confidence: 0.92, match_source: 'kb_party_exact',
    match_reasons: ['Internal domain match: grandazurehotel.com', 'Subject keyword: performance review, Q1', 'Routed to: General Manager'],
    handler: 'General Manager', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-038', created_at: daysAgo(24, 6), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-038', conversation_id: 'cv-038',
    sender_email: 'noreply@booking.com', sender_name: 'Booking.com', sender_domain: 'booking.com',
    subject_hash: 'x38', received_at: daysAgo(24, 6),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1492, dossier_ref: 'BKG-2025-0492', dossier_name: 'O\'Brien, Siobhán — Classic Double (Rm 106)',
    confidence: 0.98, match_source: 'reference_exact',
    match_reasons: ['Booking.com confirmation in subject line', 'Reservation BKG-2025-0492 confirmed', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },

  // Day 27
  {
    id: 'ml-039', created_at: daysAgo(27, 1), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-039', conversation_id: 'cv-039',
    sender_email: 'audio@soundscape-av.com', sender_name: 'Soundscape AV', sender_domain: 'soundscape-av.com',
    subject_hash: 'x39', received_at: daysAgo(27, 1),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1039, dossier_ref: 'SVC-2025-0039', dossier_name: 'Soundscape AV — Grand Ballroom A/V Setup',
    confidence: 0.91, match_source: 'sender_history',
    match_reasons: ['Repeat supplier — 3 previous events served', 'Event reference SVC-2025-0039 in email', 'Routed to: Events & Banqueting'],
    handler: 'Events & Banqueting', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-040', created_at: daysAgo(27, 4), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-040', conversation_id: 'cv-040',
    sender_email: 'ivan.petrov@gazprom.ru', sender_name: 'Ivan Petrov', sender_domain: 'gazprom.ru',
    subject_hash: 'x40', received_at: daysAgo(27, 4),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1500, dossier_ref: 'BKG-2025-0500', dossier_name: 'Petrov, Ivan — Presidential Suite (3 nights)',
    confidence: 0.77, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: VIP booking for senior executive', 'Presidential Suite availability checked', 'Routed to: Concierge'],
    handler: 'Concierge', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(26, 20), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'high', reply_sent: true, reply_sent_at: daysAgo(26, 18),
  },
  {
    id: 'ml-041', created_at: daysAgo(27, 7), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-041', conversation_id: 'cv-041',
    sender_email: 'subscriptions@hospitalitynews.com', sender_name: 'Hospitality News', sender_domain: 'hospitalitynews.com',
    subject_hash: 'x41', received_at: daysAgo(27, 7),
    has_attachments: false, is_ebarreau: false, matched: false,
    dossier_id: null, dossier_ref: null, dossier_name: null,
    confidence: 0.0, match_source: null, match_reasons: [],
    handler: null, action_taken: null, reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Unmatched', category_color: 'gray', email_importance: 'low', reply_sent: false, reply_sent_at: null,
  },

  // Day 29
  {
    id: 'ml-042', created_at: daysAgo(29, 2), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-042', conversation_id: 'cv-042',
    sender_email: 'noreply@hotels.com', sender_name: 'Hotels.com', sender_domain: 'hotels.com',
    subject_hash: 'x42', received_at: daysAgo(29, 2),
    has_attachments: false, is_ebarreau: false, matched: true,
    dossier_id: 1461, dossier_ref: 'BKG-2025-0461', dossier_name: 'Müller, Hans-Georg — Superior Twin (Rm 308)',
    confidence: 0.97, match_source: 'reference_exact',
    match_reasons: ['Hotels.com confirmation HC-44921 in subject', 'OTA booking auto-matched', 'Routed to: Reservations'],
    handler: 'Reservations', action_taken: 'auto_filed', reviewed_by: null, reviewed_at: null, review_approved: null,
    category_label: 'Routed', category_color: 'green', email_importance: 'normal', reply_sent: false, reply_sent_at: null,
  },
  {
    id: 'ml-043', created_at: daysAgo(29, 5), mailbox: 'demo@grandazurehotel.com',
    email_id: 'em-043', conversation_id: 'cv-043',
    sender_email: 'finance@royalmint-events.co.uk', sender_name: 'Royal Mint Events', sender_domain: 'royalmint-events.co.uk',
    subject_hash: 'x43', received_at: daysAgo(29, 5),
    has_attachments: true, is_ebarreau: false, matched: true,
    dossier_id: 1498, dossier_ref: 'EVT-2025-0498', dossier_name: 'Royal Mint Events — Charity Gala (May 3)',
    confidence: 0.84, match_source: 'ai_classifier_scoped',
    match_reasons: ['AI: large event booking enquiry', 'Grand Ballroom & terrace mentioned', 'Routed to: Events & Banqueting'],
    handler: 'Events & Banqueting', action_taken: null, reviewed_by: 'Demo User', reviewed_at: daysAgo(28, 22), review_approved: true,
    category_label: 'Approved', category_color: 'green', email_importance: 'high', reply_sent: false, reply_sent_at: null,
  },
];

// ─── Pipeline Runs ─────────────────────────────────────────────────────────────

export const PIPELINE_RUNS: Record<string, unknown>[] = [
  {
    id: 'run-001', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(0, 2), completed_at: daysAgo(0, 1),
    emails_fetched: 3, emails_processed: 3, emails_matched: 2, emails_auto_filed: 2,
    emails_review: 1, emails_error: 0, duration_ms: 4210, status: 'completed',
  },
  {
    id: 'run-002', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(1, 4), completed_at: daysAgo(1, 3),
    emails_fetched: 4, emails_processed: 4, emails_matched: 3, emails_auto_filed: 3,
    emails_review: 0, emails_error: 0, duration_ms: 5830, status: 'completed',
  },
  {
    id: 'run-003', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(2, 3), completed_at: daysAgo(2, 2),
    emails_fetched: 5, emails_processed: 5, emails_matched: 4, emails_auto_filed: 3,
    emails_review: 1, emails_error: 0, duration_ms: 6120, status: 'completed',
  },
  {
    id: 'run-004', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(3, 2), completed_at: daysAgo(3, 1),
    emails_fetched: 6, emails_processed: 6, emails_matched: 5, emails_auto_filed: 4,
    emails_review: 1, emails_error: 0, duration_ms: 7490, status: 'completed',
  },
  {
    id: 'run-005', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(5, 3), completed_at: daysAgo(5, 2),
    emails_fetched: 5, emails_processed: 5, emails_matched: 4, emails_auto_filed: 3,
    emails_review: 1, emails_error: 0, duration_ms: 5920, status: 'completed',
  },
  {
    id: 'run-006', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(7, 2), completed_at: daysAgo(7, 1),
    emails_fetched: 7, emails_processed: 7, emails_matched: 6, emails_auto_filed: 5,
    emails_review: 1, emails_error: 0, duration_ms: 8340, status: 'completed',
  },
  {
    id: 'run-007', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(9, 2), completed_at: daysAgo(9, 1),
    emails_fetched: 4, emails_processed: 4, emails_matched: 4, emails_auto_filed: 4,
    emails_review: 0, emails_error: 0, duration_ms: 4780, status: 'completed',
  },
  {
    id: 'run-008', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(13, 2), completed_at: daysAgo(13, 1),
    emails_fetched: 5, emails_processed: 5, emails_matched: 4, emails_auto_filed: 3,
    emails_review: 1, emails_error: 0, duration_ms: 6110, status: 'completed',
  },
  {
    id: 'run-009', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(20, 2), completed_at: daysAgo(20, 1),
    emails_fetched: 6, emails_processed: 6, emails_matched: 5, emails_auto_filed: 5,
    emails_review: 0, emails_error: 0, duration_ms: 7200, status: 'completed',
  },
  {
    id: 'run-010', mailbox: 'demo@grandazurehotel.com',
    started_at: daysAgo(27, 2), completed_at: daysAgo(27, 1),
    emails_fetched: 8, emails_processed: 8, emails_matched: 6, emails_auto_filed: 5,
    emails_review: 1, emails_error: 0, duration_ms: 9410, status: 'completed',
  },
];

// ─── Sender History ────────────────────────────────────────────────────────────

export const SENDER_HISTORY: Record<string, unknown>[] = [
  { id: 'sh-001', sender_email: 'noreply@booking.com', sender_name: 'Booking.com', sender_domain: 'booking.com', match_count: 18, last_match_at: daysAgo(0, 4), dossier_id: 1376, dossier_ref: 'BKG-2025-0376', avg_confidence: 0.97, last_dossier_name: 'OTA Reservations' },
  { id: 'sh-002', sender_email: 'noreply@expedia.com', sender_name: 'Expedia', sender_domain: 'expedia.com', match_count: 12, last_match_at: daysAgo(2, 2), dossier_id: 1221, dossier_ref: 'BKG-2025-0221', avg_confidence: 0.96, last_dossier_name: 'Chen, Li — Standard Double' },
  { id: 'sh-003', sender_email: 'james.wilson@gmail.com', sender_name: 'James Wilson', sender_domain: 'gmail.com', match_count: 4, last_match_at: daysAgo(0, 2), dossier_id: 1042, dossier_ref: 'BKG-2025-0042', avg_confidence: 0.93, last_dossier_name: 'Wilson, James & Sarah — Suite 405' },
  { id: 'sh-004', sender_email: 'corporate.travel@hartmann-group.de', sender_name: 'Hartmann Group Travel', sender_domain: 'hartmann-group.de', match_count: 5, last_match_at: daysAgo(1, 3), dossier_id: 1094, dossier_ref: 'BKG-2024-0094', avg_confidence: 0.90, last_dossier_name: 'Hartmann Group — Block Booking' },
  { id: 'sh-005', sender_email: 'noreply@hotels.com', sender_name: 'Hotels.com', sender_domain: 'hotels.com', match_count: 9, last_match_at: daysAgo(11, 2), dossier_id: 1267, dossier_ref: 'BKG-2025-0267', avg_confidence: 0.97, last_dossier_name: 'Bernstein, Claire — Classic Room 112' },
  { id: 'sh-006', sender_email: 'info@luxurylinen.co.uk', sender_name: 'Luxury Linen Co.', sender_domain: 'luxurylinen.co.uk', match_count: 13, last_match_at: daysAgo(9, 3), dossier_id: 1034, dossier_ref: 'SVC-2025-0034', avg_confidence: 0.95, last_dossier_name: 'Luxury Linen — Linen Supply Contract' },
  { id: 'sh-007', sender_email: 'catering@citydelights.com', sender_name: 'City Delights Catering', sender_domain: 'citydelights.com', match_count: 6, last_match_at: daysAgo(3, 3), dossier_id: 1412, dossier_ref: 'EVT-2025-0412', avg_confidence: 0.92, last_dossier_name: 'City Delights — Private Dining Rm C' },
  { id: 'sh-008', sender_email: 'housekeeping@cleanpro.com', sender_name: 'CleanPro Services', sender_domain: 'cleanpro.com', match_count: 8, last_match_at: daysAgo(4, 2), dossier_id: 1055, dossier_ref: 'SVC-2025-0055', avg_confidence: 0.94, last_dossier_name: 'CleanPro — Monthly Housekeeping Contract' },
  { id: 'sh-009', sender_email: 'sophie.martin@orange.fr', sender_name: 'Sophie Martin', sender_domain: 'orange.fr', match_count: 3, last_match_at: daysAgo(4, 4), dossier_id: 1192, dossier_ref: 'BKG-2025-0192', avg_confidence: 0.89, last_dossier_name: 'Martin, Sophie — Junior Suite 304' },
  { id: 'sh-010', sender_email: 'wine@bordeaux-select.fr', sender_name: 'Bordeaux Select', sender_domain: 'bordeaux-select.fr', match_count: 9, last_match_at: daysAgo(20, 2), dossier_id: 1070, dossier_ref: 'FIN-2025-0070', avg_confidence: 0.93, last_dossier_name: 'Bordeaux Select — Wine Cellar Restocking' },
  { id: 'sh-011', sender_email: 'maintenance@premium-lifts.co.uk', sender_name: 'Premium Lifts Ltd', sender_domain: 'premium-lifts.co.uk', match_count: 4, last_match_at: daysAgo(1, 6), dossier_id: 1011, dossier_ref: 'MNT-2025-0011', avg_confidence: 0.88, last_dossier_name: 'Maintenance — Elevator 2, Floor 3' },
  { id: 'sh-012', sender_email: 'audio@soundscape-av.com', sender_name: 'Soundscape AV', sender_domain: 'soundscape-av.com', match_count: 4, last_match_at: daysAgo(27, 1), dossier_id: 1039, dossier_ref: 'SVC-2025-0039', avg_confidence: 0.91, last_dossier_name: 'Soundscape AV — Grand Ballroom A/V Setup' },
  { id: 'sh-013', sender_email: 'reservations@airbnb.com', sender_name: 'Airbnb', sender_domain: 'airbnb.com', match_count: 7, last_match_at: daysAgo(5, 1), dossier_id: 1244, dossier_ref: 'BKG-2025-0244', avg_confidence: 0.96, last_dossier_name: 'Nakamura, Yuki — Penthouse Suite' },
  { id: 'sh-014', sender_email: 'finance@gastrocorp.com', sender_name: 'GastroCorp Finance', sender_domain: 'gastrocorp.com', match_count: 5, last_match_at: daysAgo(7, 2), dossier_id: 1067, dossier_ref: 'FIN-2025-0067', avg_confidence: 0.91, last_dossier_name: 'GastroCorp — F&B Supply Agreement' },
  { id: 'sh-015', sender_email: 'banqueting@azureweddings.co.uk', sender_name: 'Azure Weddings & Events', sender_domain: 'azureweddings.co.uk', match_count: 2, last_match_at: daysAgo(1, 1), dossier_id: 1156, dossier_ref: 'EVT-2025-0156', avg_confidence: 0.68, last_dossier_name: 'Azure Weddings — Grand Ballroom (June 14)' },
];

// ─── User Preferences ─────────────────────────────────────────────────────────

export const USER_PREFERENCES: Record<string, unknown>[] = [
  {
    id: 'pref-001', user_id: 'demo-user-1', email: 'demo@grandazurehotel.com',
    display_name: 'Demo User', email_notifications: true, urgent_alerts: true,
    language: 'en', onboarded: true, onboarded_at: daysAgo(30),
    bot_mode: 'observation', email_filter: 'smart', updated_at: daysAgo(5),
  },
];

// ─── Activity Logs ─────────────────────────────────────────────────────────────

export const ACTIVITY_LOGS: Record<string, unknown>[] = [
  { id: 'al-001', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'EVT-2025-0156', confidence: 0.68 }, resource_type: 'match_log', resource_id: 'ml-004', created_at: daysAgo(0, 20) },
  { id: 'al-002', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'SVC-2025-0301', confidence: 0.79 }, resource_type: 'match_log', resource_id: 'ml-010', created_at: daysAgo(2, 18) },
  { id: 'al-003', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_rejected', details: { dossier_ref: 'BKG-2025-0178', confidence: 0.63 }, resource_type: 'match_log', resource_id: 'ml-012', created_at: daysAgo(2, 22) },
  { id: 'al-004', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'EVT-2025-0388', confidence: 0.82 }, resource_type: 'match_log', resource_id: 'ml-017', created_at: daysAgo(4, 20) },
  { id: 'al-005', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'BKG-2025-0319', confidence: 0.75 }, resource_type: 'match_log', resource_id: 'ml-020', created_at: daysAgo(6, 22) },
  { id: 'al-006', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'draft_generated', details: { dossier_ref: 'SVC-2025-0301', confidence: 0.9 }, resource_type: 'match_log', resource_id: 'ml-010', created_at: daysAgo(2, 16) },
  { id: 'al-007', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'reply_sent', details: null, resource_type: 'match_log', resource_id: 'ml-010', created_at: daysAgo(2, 16) },
  { id: 'al-008', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_rejected', details: { dossier_ref: 'BKG-2025-0352', confidence: 0.61 }, resource_type: 'match_log', resource_id: 'ml-032', created_at: daysAgo(16, 16) },
  { id: 'al-009', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'BKG-2025-0299', confidence: 0.66 }, resource_type: 'match_log', resource_id: 'ml-025', created_at: daysAgo(10, 18) },
  { id: 'al-010', user_id: 'demo-user-1', user_email: 'demo@grandazurehotel.com', user_name: 'Demo User', action: 'match_approved', details: { dossier_ref: 'BKG-2025-0500', confidence: 0.77 }, resource_type: 'match_log', resource_id: 'ml-040', created_at: daysAgo(26, 20) },
];

// ─── Calendar Suggestions ─────────────────────────────────────────────────────

export const CALENDAR_SUGGESTIONS: Record<string, unknown>[] = [
  {
    id: 'cs-001', mailbox: 'demo@grandazurehotel.com', user_id: 'demo-user-1',
    title: 'Follow-up: Hartmann Group Block Booking', status: 'pending',
    start_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
    end_at: new Date(Date.now() + 2 * 86_400_000 + 3_600_000).toISOString(),
    description: 'Confirm final room allocation for 12-room block booking (March 15-18)',
    attendees: [{ name: 'Hartmann Group Travel', email: 'corporate.travel@hartmann-group.de' }],
    confidence: 0.88, created_at: daysAgo(1, 3),
  },
  {
    id: 'cs-002', mailbox: 'demo@grandazurehotel.com', user_id: 'demo-user-1',
    title: 'Site Visit: Metropolitan Arts Foundation Gala', status: 'accepted',
    start_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    end_at: new Date(Date.now() + 5 * 86_400_000 + 5_400_000).toISOString(),
    description: 'Walk-through of Grand Ballroom setup for April 5 Gala Dinner (200 covers)',
    attendees: [{ name: 'Metropolitan Arts Foundation', email: 'events@metropolitan-arts.org' }],
    confidence: 0.92, created_at: daysAgo(4, 20),
  },
  {
    id: 'cs-003', mailbox: 'demo@grandazurehotel.com', user_id: 'demo-user-1',
    title: 'Sterling Investments VIP Check-in', status: 'pending',
    start_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    end_at: new Date(Date.now() + 7 * 86_400_000 + 1_800_000).toISOString(),
    description: 'Director-level VIP check-in preparation for 4-night stay in Director Suite',
    attendees: [],
    confidence: 0.85, created_at: daysAgo(13, 1),
  },
];

// ─── Handlers (Hotel Staff) ─────────────────────────────────────────────────────

export const HOTEL_STAFF: Record<string, unknown>[] = [
  {
    id: 'demo-user-1', email: 'demo@grandazurehotel.com',
    display_name: 'Demo User', is_active: true, microsoft_id: 'demo-user-1',
    access_token: null, role: 'staff',
  },
];

// ─── Handler Style Profiles ─────────────────────────────────────────────────────

export const HANDLER_STYLE_PROFILES: Record<string, unknown>[] = [];

// ─── Consolidated Mock Database ───────────────────────────────────────────────

export const MOCK_DATA: Record<string, Record<string, unknown>[]> = {
  match_logs: MATCH_LOGS,
  pipeline_runs: PIPELINE_RUNS,
  sender_history: SENDER_HISTORY,
  user_preferences: USER_PREFERENCES,
  activity_logs: ACTIVITY_LOGS,
  calendar_suggestions: CALENDAR_SUGGESTIONS,
  hotel_staff: HOTEL_STAFF,
  handler_style_profiles: HANDLER_STYLE_PROFILES,
};
