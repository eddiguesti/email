-- ============================================================
-- LB-BOT Seed Data for Beta Testing
-- Run SUPABASE-SETUP.sql first, then paste this
-- ============================================================

-- 1. Test lawyer (updated with real data on first OAuth login)
INSERT INTO lawyers (microsoft_id, email, display_name, is_active, last_login_at)
VALUES (
  'dev-placeholder-00000000',
  'laurence@lbrosset.com',
  'Laurence Brosset',
  true,
  now()
) ON CONFLICT (microsoft_id) DO NOTHING;

-- 2. Match logs (correct column names matching SUPABASE-SETUP.sql schema)
INSERT INTO match_logs (
  email_id, mailbox, sender_email, sender_name, sender_domain,
  subject_hash, received_at, has_attachments,
  matched, dossier_id, dossier_ref, dossier_name,
  confidence, match_source, action_taken, lawyer,
  category_label, category_color
) VALUES
(
  'MSG-001', 'laurence@lbrosset.com',
  'jdupont@gmail.com', 'Jean Dupont', 'gmail.com',
  'dupont-martin-pieces-justificatives', now() - interval '2 hours', true,
  true, 100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',
  0.95, 'exact_ref', 'dry_run', 'Laurence BROSSET',
  'Matched', '#22c55e'
),
(
  'MSG-002', 'laurence@lbrosset.com',
  'greffe@tj-paris.justice.fr', 'Greffe TJ Paris', 'justice.fr',
  'notification-rg-23-04567-audience', now() - interval '3 hours', true,
  true, 100002, '2023/0089', 'MARTIN c/ SCI LES OLIVIERS - Bail commercial',
  0.88, 'ai_classifier_global', 'dry_run', 'Laurence BROSSET',
  'Matched', '#22c55e'
),
(
  'MSG-003', 'laurence@lbrosset.com',
  'contact@assurance-axa.fr', 'AXA Assurances', 'assurance-axa.fr',
  'axa-proposition-indemnisation-sin-2025', now() - interval '5 hours', true,
  true, 100003, '2025/0023', 'BERNARD - Accident de la route',
  0.72, 'ai_classifier_global', 'dry_run', 'Laurence BROSSET',
  'Low Confidence', '#f59e0b'
),
(
  'MSG-004', 'laurence@lbrosset.com',
  'secretariat@barreau-paris.fr', 'Ordre des Avocats', 'barreau-paris.fr',
  'convocation-assemblee-generale-mars-2026', now() - interval '6 hours', false,
  false, NULL, NULL, NULL,
  0.15, NULL, 'dry_run', NULL,
  'No Match', '#ef4444'
),
(
  'MSG-005', 'laurence@lbrosset.com',
  'mlemaire@cabinet-lemaire.fr', 'Me Lemaire', 'cabinet-lemaire.fr',
  're-protocole-accord-dupont', now() - interval '1 day', false,
  true, 100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',
  0.91, 'conversation_thread', 'dry_run', 'Laurence BROSSET',
  'Matched', '#22c55e'
),
(
  'MSG-006', 'laurence@lbrosset.com',
  'expert@expert-comptable-paris.fr', 'Cabinet Expert Comptable', 'expert-comptable-paris.fr',
  'rapport-expertise-evaluation-patrimoine', now() - interval '1 day' - interval '3 hours', true,
  true, 100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',
  0.85, 'sender_history', 'dry_run', 'Laurence BROSSET',
  'Matched', '#22c55e'
),
(
  'MSG-007', 'laurence@lbrosset.com',
  'huissier@scp-durand.fr', 'SCP Durand Huissiers', 'scp-durand.fr',
  'pv-signification-assignation-bernard', now() - interval '2 days', true,
  true, 100003, '2025/0023', 'BERNARD - Accident de la route',
  0.92, 'exact_ref', 'dry_run', 'Laurence BROSSET',
  'Matched', '#22c55e'
),
(
  'MSG-008', 'laurence@lbrosset.com',
  'client.nouveau@orange.fr', 'Sophie Laurent', 'orange.fr',
  'demande-rendez-vous-probleme-voisinage', now() - interval '2 days' - interval '5 hours', false,
  false, NULL, NULL, NULL,
  0.10, NULL, 'dry_run', NULL,
  'No Match', '#ef4444'
)
ON CONFLICT (email_id, mailbox) DO NOTHING;

-- 3. Sender history
INSERT INTO sender_history (sender_email, dossier_id, dossier_ref, dossier_name, match_count, avg_confidence, last_seen)
VALUES
('jdupont@gmail.com',                100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',                   12, 0.93, now() - interval '2 hours'),
('greffe@tj-paris.justice.fr',       100002, '2023/0089', 'MARTIN c/ SCI LES OLIVIERS - Bail commercial',  5, 0.86, now() - interval '3 hours'),
('mlemaire@cabinet-lemaire.fr',      100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',                    8, 0.90, now() - interval '1 day'),
('expert@expert-comptable-paris.fr', 100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',                    3, 0.84, now() - interval '1 day'),
('huissier@scp-durand.fr',           100003, '2025/0023', 'BERNARD - Accident de la route',                4, 0.91, now() - interval '2 days'),
('contact@assurance-axa.fr',         100003, '2025/0023', 'BERNARD - Accident de la route',                6, 0.74, now() - interval '5 hours')
ON CONFLICT (sender_email, dossier_id) DO NOTHING;

-- 4. Conversation threads
INSERT INTO conversation_threads (conversation_id, dossier_id, dossier_ref, dossier_name, confidence, match_source, lawyer, email_count, last_email_at)
VALUES
('thread-dupont-divorce',   100001, '2024/0142', 'DUPONT c/ MARTIN - Divorce',                   0.92, 'conversation_thread',  'Laurence BROSSET', 15, now() - interval '1 day'),
('thread-bernard-accident', 100003, '2025/0023', 'BERNARD - Accident de la route',               0.91, 'exact_ref',            'Laurence BROSSET',  8, now() - interval '2 days'),
('thread-martin-bail',      100002, '2023/0089', 'MARTIN c/ SCI LES OLIVIERS - Bail commercial', 0.88, 'ai_classifier_global', 'Laurence BROSSET',  6, now() - interval '3 hours')
ON CONFLICT (conversation_id) DO NOTHING;

-- 5. Pipeline runs
INSERT INTO pipeline_runs (started_at, finished_at, mailbox, status, emails_fetched, emails_matched, emails_skipped, emails_processed, error_count)
VALUES
(now() - interval '2 hours', now() - interval '2 hours' + interval '45 seconds', 'laurence@lbrosset.com', 'completed',  8,  6, 1,  7, 0),
(now() - interval '1 day',   now() - interval '1 day'   + interval '38 seconds', 'laurence@lbrosset.com', 'completed',  5,  4, 1,  4, 0),
(now() - interval '2 days',  now() - interval '2 days'  + interval '52 seconds', 'laurence@lbrosset.com', 'completed', 12, 10, 2, 10, 0);

-- 6. Activity logs
INSERT INTO activity_logs (user_id, user_email, user_name, action, details, resource_type, resource_id)
VALUES
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'login',           '{"method": "microsoft_oauth"}'::jsonb,                                                                                         NULL,               NULL),
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'match_approved',  '{"dossier_ref": "2024/0142", "dossier_name": "DUPONT c/ MARTIN", "sender": "mlemaire@cabinet-lemaire.fr"}'::jsonb,            'match_log',        'MSG-005'),
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'match_approved',  '{"dossier_ref": "2024/0142", "dossier_name": "DUPONT c/ MARTIN", "sender": "expert@expert-comptable-paris.fr"}'::jsonb,       'match_log',        'MSG-006'),
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'match_approved',  '{"dossier_ref": "2025/0023", "dossier_name": "BERNARD - Accident", "sender": "huissier@scp-durand.fr"}'::jsonb,               'match_log',        'MSG-007'),
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'draft_generated', '{"dossier_ref": "2024/0142", "type": "reply", "confidence": 0.95}'::jsonb,                                                   'match_log',        'MSG-001'),
('laurence-dev', 'laurence@lbrosset.com', 'Laurence Brosset', 'settings_updated','{"changed_fields": ["language", "email_notifications"]}'::jsonb,                                                             'user_preferences',  NULL);

-- Done! Dashboard should show:
-- Stats: 8 emails, 6 matched (5 high confidence + 1 low), 2 no-match
-- 3 pipeline runs, 6 activity events, 6 known senders, 3 conversation threads
