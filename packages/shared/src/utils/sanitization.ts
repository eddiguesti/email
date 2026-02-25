/**
 * Sanitization Utilities
 * Security-focused text sanitization to prevent prompt injection and XSS
 */

/**
 * Characters and patterns that could be used for prompt injection
 */
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/gi,
  /disregard\s+(previous|above|all)/gi,
  /forget\s+(everything|previous|above)/gi,
  /new\s+instructions?:/gi,
  /system\s*:/gi,
  /assistant\s*:/gi,
  /human\s*:/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
  /```system/gi,
  /OVERRIDE:/gi,
  /BYPASS:/gi,
];

/**
 * Check if text contains potential prompt injection
 */
export function containsPromptInjection(text: string): boolean {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return true;
    }
  }
  return false;
}

/**
 * Sanitize text for safe use in LLM prompts
 * Removes or escapes potential injection attempts
 */
export function sanitizeForPrompt(text: string): string {
  let sanitized = text;

  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Escape special prompt markers
  sanitized = sanitized
    .replace(/\[INST\]/gi, '[FILTERED]')
    .replace(/\[\/INST\]/gi, '[/FILTERED]')
    .replace(/<\|im_start\|>/gi, '<FILTERED>')
    .replace(/<\|im_end\|>/gi, '</FILTERED>');

  // Add markers around user content to make injection harder
  // The actual template should wrap this content

  return sanitized.trim();
}

/**
 * Sanitize HTML content for display
 */
export function sanitizeHtml(html: string): string {
  // Basic HTML entity encoding for display
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Strip all HTML tags from content
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize filename for safe storage
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .trim()
    .slice(0, 255);
}

/**
 * Sanitize email address
 */
export function sanitizeEmail(email: string): string {
  // Basic email sanitization - remove anything that's not a valid email character
  return email
    .toLowerCase()
    .trim()
    .replace(/[^\w.@+-]/g, '')
    .slice(0, 254);
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Safe JSON stringify that handles circular references
 */
export function safeStringify(obj: unknown, space?: number): string {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    },
    space
  );
}

/**
 * Mask sensitive data in logs
 */
export function maskSensitive(text: string): string {
  return text
    // Mask email addresses partially
    .replace(/([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, (_, local, domain) => {
      const maskedLocal = local.slice(0, 2) + '***';
      return `${maskedLocal}@${domain}`;
    })
    // Mask API keys (common patterns)
    .replace(/([a-zA-Z_]+[Kk]ey['":\s=]+)['"]?([a-zA-Z0-9_-]{8})[a-zA-Z0-9_-]+['"]?/g, '$1$2***')
    // Mask bearer tokens
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1***');
}

/**
 * Validate that text doesn't exceed safe limits
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTextLimits(
  text: string,
  options: {
    maxLength?: number;
    maxLines?: number;
    allowHtml?: boolean;
    checkInjection?: boolean;
  } = {}
): ValidationResult {
  const errors: string[] = [];

  const maxLength = options.maxLength ?? 100000;
  const maxLines = options.maxLines ?? 10000;

  if (text.length > maxLength) {
    errors.push(`Text exceeds maximum length of ${maxLength} characters`);
  }

  const lineCount = text.split('\n').length;
  if (lineCount > maxLines) {
    errors.push(`Text exceeds maximum of ${maxLines} lines`);
  }

  if (!options.allowHtml && /<[^>]+>/.test(text)) {
    errors.push('HTML tags are not allowed');
  }

  if (options.checkInjection !== false && containsPromptInjection(text)) {
    errors.push('Text contains potentially unsafe patterns');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
