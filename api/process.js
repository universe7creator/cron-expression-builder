/**
 * Cron Expression Builder API
 * Parse, validate, and explain cron expressions
 */

const CRON_PARTS = {
  minute: { min: 0, max: 59, name: 'minute' },
  hour: { min: 0, max: 23, name: 'hour' },
  day: { min: 1, max: 31, name: 'day of month' },
  month: { min: 1, max: 12, name: 'month', labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] },
  weekday: { min: 0, max: 6, name: 'day of week', labels: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseCronPart(value, part) {
  if (value === '*') return { type: 'any', values: [] };
  if (value === '?') return { type: 'any', values: [] };

  // Handle step values (*/5 or 1-10/2)
  if (value.includes('/')) {
    const [range, step] = value.split('/');
    const stepNum = parseInt(step);
    let start = part.min;
    let end = part.max;

    if (range !== '*') {
      if (range.includes('-')) {
        [start, end] = range.split('-').map(Number);
      } else {
        start = parseInt(range);
      }
    }

    const values = [];
    for (let i = start; i <= end; i += stepNum) {
      values.push(i);
    }
    return { type: 'step', step: stepNum, start, end, values };
  }

  // Handle ranges (1-5)
  if (value.includes('-')) {
    const [start, end] = value.split('-').map(Number);
    const values = [];
    for (let i = start; i <= end; i++) {
      values.push(i);
    }
    return { type: 'range', start, end, values };
  }

  // Handle lists (1,3,5)
  if (value.includes(',')) {
    const values = value.split(',').map(v => {
      // Handle month/weekday names
      if (part.labels) {
        const idx = part.labels.indexOf(v);
        if (idx !== -1) return idx + part.min;
      }
      return parseInt(v);
    });
    return { type: 'list', values };
  }

  // Handle last day of month (L)
  if (value === 'L') {
    return { type: 'last', values: ['last'] };
  }

  // Handle weekday nearest (W)
  if (value.includes('W')) {
    const day = parseInt(value.replace('W', ''));
    return { type: 'weekday', day, values: [day] };
  }

  // Single value
  let numValue = parseInt(value);
  if (part.labels && isNaN(numValue)) {
    const idx = part.labels.indexOf(value);
    if (idx !== -1) numValue = idx + part.min;
  }

  if (isNaN(numValue)) {
    throw new Error(`Invalid value "${value}" for ${part.name}`);
  }

  return { type: 'single', values: [numValue] };
}

function validateCron(parts) {
  if (parts.length < 5 || parts.length > 6) {
    throw new Error('Cron expression must have 5 or 6 parts (minute hour day month weekday [year])');
  }

  const parsed = {};
  const keys = ['minute', 'hour', 'day', 'month', 'weekday'];

  for (let i = 0; i < 5; i++) {
    const key = keys[i];
    const part = CRON_PARTS[key];
    parsed[key] = parseCronPart(parts[i], part);

    // Validate values are within bounds
    for (const val of parsed[key].values) {
      if (typeof val === 'number' && (val < part.min || val > part.max)) {
        throw new Error(`Value ${val} is out of range for ${part.name} (${part.min}-${part.max})`);
      }
    }
  }

  return parsed;
}

function generateHumanReadable(parsed) {
  const parts = [];

  // Minute
  if (parsed.minute.type === 'any') {
    parts.push('every minute');
  } else if (parsed.minute.type === 'step') {
    parts.push(`every ${parsed.minute.step} minutes`);
  } else if (parsed.minute.type === 'single') {
    parts.push(`at minute ${parsed.minute.values[0]}`);
  } else if (parsed.minute.type === 'list') {
    parts.push(`at minutes ${parsed.minute.values.join(', ')}`);
  } else if (parsed.minute.type === 'range') {
    parts.push(`every minute from ${parsed.minute.start} through ${parsed.minute.end}`);
  }

  // Hour
  if (parsed.hour.type === 'any') {
    parts.push('of every hour');
  } else if (parsed.hour.type === 'step') {
    parts.push(`every ${parsed.hour.step} hours`);
  } else if (parsed.hour.type === 'single') {
    parts.push(`at ${parsed.hour.values[0]}:${String(parsed.minute.values[0] || 0).padStart(2, '0')}`);
  } else if (parsed.hour.type === 'list') {
    parts.push(`at hours ${parsed.hour.values.join(', ')}`);
  }

  // Day of month
  if (parsed.day.type === 'any') {
    parts.push('every day');
  } else if (parsed.day.type === 'last') {
    parts.push('on the last day of the month');
  } else if (parsed.day.type === 'single') {
    parts.push(`on day ${parsed.day.values[0]} of the month`);
  } else if (parsed.day.type === 'list') {
    parts.push(`on days ${parsed.day.values.join(', ')} of the month`);
  }

  // Month
  if (parsed.month.type === 'any') {
    parts.push('of every month');
  } else if (parsed.month.type === 'single') {
    parts.push(`in ${MONTH_NAMES[parsed.month.values[0] - 1]}`);
  } else if (parsed.month.type === 'list') {
    const months = parsed.month.values.map(v => MONTH_NAMES[v - 1]);
    parts.push(`in ${months.join(', ')}`);
  } else if (parsed.month.type === 'range') {
    parts.push(`from ${MONTH_NAMES[parsed.month.start - 1]} through ${MONTH_NAMES[parsed.month.end - 1]}`);
  }

  // Day of week
  if (parsed.weekday.type === 'any') {
    // No specific weekday constraint
  } else if (parsed.weekday.type === 'single') {
    parts.push(`on ${WEEKDAY_NAMES[parsed.weekday.values[0]]}`);
  } else if (parsed.weekday.type === 'list') {
    const days = parsed.weekday.values.map(v => WEEKDAY_NAMES[v]);
    parts.push(`on ${days.join(', ')}`);
  } else if (parsed.weekday.type === 'range') {
    parts.push(`from ${WEEKDAY_NAMES[parsed.weekday.start]} through ${WEEKDAY_NAMES[parsed.weekday.end]}`);
  }

  return parts.join(', ').replace(/, at /g, ' at ').replace(/, on /g, ' on ').replace(/, in /g, ' in ');
}

function getNextRuns(parsed, count = 5) {
  const now = new Date();
  const runs = [];
  let current = new Date(now);
  current.setSeconds(0, 0);

  // Simple implementation - advance minute by minute
  let attempts = 0;
  const maxAttempts = 60 * 24 * 365; // One year in minutes

  while (runs.length < count && attempts < maxAttempts) {
    attempts++;
    current.setMinutes(current.getMinutes() + 1);

    const minute = current.getMinutes();
    const hour = current.getHours();
    const day = current.getDate();
    const month = current.getMonth() + 1;
    const weekday = current.getDay();

    // Check if this time matches the cron
    const matchesMinute = parsed.minute.type === 'any' || parsed.minute.values.includes(minute);
    const matchesHour = parsed.hour.type === 'any' || parsed.hour.values.includes(hour);
    const matchesDay = parsed.day.type === 'any' || parsed.day.values.includes(day);
    const matchesMonth = parsed.month.type === 'any' || parsed.month.values.includes(month);
    const matchesWeekday = parsed.weekday.type === 'any' || parsed.weekday.values.includes(weekday);

    if (matchesMinute && matchesHour && matchesDay && matchesMonth && matchesWeekday) {
      runs.push(new Date(current));
    }
  }

  return runs.map(d => ({
    iso: d.toISOString(),
    display: d.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    relative: getRelativeTime(d, now)
  }));
}

function getRelativeTime(future, now) {
  const diff = future - now;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (minutes < 60) return `in ${minutes} minutes`;
  if (hours < 24) return `in ${hours} hours`;
  if (days === 1) return 'tomorrow';
  return `in ${days} days`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', allowed: ['POST'] });
  }

  try {
    const { expression, action = 'parse' } = req.body;

    if (!expression || typeof expression !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid expression',
        message: 'Please provide a cron expression string (e.g., "0 9 * * 1")'
      });
    }

    // Normalize expression
    const normalizedExpr = expression.trim().replace(/\s+/g, ' ');
    const parts = normalizedExpr.split(' ');

    if (action === 'validate') {
      try {
        validateCron(parts);
        return res.status(200).json({
          valid: true,
          expression: normalizedExpr
        });
      } catch (e) {
        return res.status(200).json({
          valid: false,
          error: e.message,
          expression: normalizedExpr
        });
      }
    }

    // Parse the cron expression
    const parsed = validateCron(parts);
    const humanReadable = generateHumanReadable(parsed);
    const nextRuns = getNextRuns(parsed, 5);

    // Generate common variations
    const examples = generateExamples(normalizedExpr, parsed);

    return res.status(200).json({
      success: true,
      expression: normalizedExpr,
      valid: true,
      humanReadable,
      parts: {
        minute: { value: parts[0], ...parsed.minute },
        hour: { value: parts[1], ...parsed.hour },
        day: { value: parts[2], ...parsed.day },
        month: { value: parts[3], ...parsed.month },
        weekday: { value: parts[4], ...parsed.weekday }
      },
      nextRuns,
      examples,
      metadata: {
        timestamp: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    });

  } catch (error) {
    return res.status(400).json({
      error: 'Failed to parse cron expression',
      message: error.message,
      valid: false
    });
  }
};

function generateExamples(expr, parsed) {
  const examples = [];

  // Common presets
  const presets = [
    { expr: '0 0 * * *', desc: 'Daily at midnight' },
    { expr: '0 9 * * 1', desc: 'Every Monday at 9am' },
    { expr: '*/15 * * * *', desc: 'Every 15 minutes' },
    { expr: '0 */6 * * *', desc: 'Every 6 hours' },
    { expr: '0 0 1 * *', desc: 'First day of every month' },
    { expr: '0 0 * * 0', desc: 'Every Sunday at midnight' },
    { expr: '0 17 * * 5', desc: 'Every Friday at 5pm' },
    { expr: '0 8-17 * * 1-5', desc: 'Every hour during business hours on weekdays' }
  ];

  return presets;
}
