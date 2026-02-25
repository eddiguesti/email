/**
 * Azure Functions Worker Entry Point
 *
 * This file registers all Service Bus triggered functions for the worker.
 */

// Import all functions to register them
import './functions/process-email.js';
import './functions/auto-send.js';

console.log('LB-BOT Worker Functions loaded');
