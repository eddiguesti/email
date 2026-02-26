/**
 * Azure Functions API Entry Point
 *
 * This file registers all HTTP functions for the API.
 * Each function is defined in its own file in the functions/ directory.
 */

// Import all functions to register them

// Auth endpoints
import './functions/auth-login.js';
import './functions/auth-callback.js';
import './functions/auth-me.js';
import './functions/auth-refresh.js';

// Core API endpoints
import './functions/webhook-graph.js';
import './functions/get-status.js';
import './functions/approve-dossier.js';
import './functions/file-to-kleos.js';
import './functions/search.js';
import './functions/ai-search.js';
import './functions/chat.js';
import './functions/generate-drafts.js';
import './functions/insert-draft.js';
import './functions/subscription-manage.js';
import './functions/todos.js';
import './functions/kleos.js';
import './functions/calendar.js';
import './functions/invoices.js';
import './functions/pipeline-backfill.js';

console.log('LB-BOT API Functions loaded');
