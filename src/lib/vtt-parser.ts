/**
 * VTT/SRT Parser with Loose Regex Strategy
 * 
 * Designed to handle non-standard formats like MacWhisper output.
 * Tolerates both . and , for milliseconds, ignores headers/metadata.
 */

import { sanitizeInput } from './safety';

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Convert timestamp string to seconds
 * Handles formats:
 * - 00:00:01.500 (VTT standard with .)
 * - 00:00:01,500 (SRT standard with ,)
 * - 00:01.500 (short format without hours)
 */
function parseTimestamp(timestamp: string): number {
  // Normalize: replace comma with dot
  const normalized = timestamp.trim().replace(',', '.');
  
  // Match HH:MM:SS.mmm or MM:SS.mmm
  const fullMatch = normalized.match(/^(\d+):(\d+):(\d+)(?:\.(\d+))?$/);
  if (fullMatch) {
    const [, hours, minutes, seconds, ms] = fullMatch;
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10) +
      (ms ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) / 1000 : 0)
    );
  }

  // Short format MM:SS.mmm
  const shortMatch = normalized.match(/^(\d+):(\d+)(?:\.(\d+))?$/);
  if (shortMatch) {
    const [, minutes, seconds, ms] = shortMatch;
    return (
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10) +
      (ms ? parseInt(ms.padEnd(3, '0').slice(0, 3), 10) / 1000 : 0)
    );
  }

  return 0;
}

/**
 * Parse VTT or SRT transcript text
 * Returns array of segments with start time and text
 */
export function parseVTT(rawText: string): TranscriptSegment[] {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  // Sanitize input first
  const sanitized = sanitizeInput(rawText);
  
  // Split into lines and normalize line endings
  const lines = sanitized
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  const segments: TranscriptSegment[] = [];
  
  // Loose regex for timestamp line
  // Matches: 00:00:01.500 --> 00:00:05.000
  // Also matches: 00:01.500 --> 00:05.000 (no hours)
  // Handles both . and , for milliseconds
  const timestampRegex = /^(\d{1,2}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-->\s*(\d{1,2}:)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    
    // Skip empty lines, WEBVTT header, NOTE comments, numeric cue identifiers
    if (
      !line ||
      line.startsWith('WEBVTT') ||
      line.startsWith('NOTE') ||
      line.startsWith('STYLE') ||
      line.startsWith('REGION') ||
      /^\d+$/.test(line) // SRT cue numbers like "1", "2", etc.
    ) {
      i++;
      continue;
    }

    // Check if this is a timestamp line
    const timestampMatch = line.match(timestampRegex);
    if (timestampMatch) {
      // Extract start and end timestamps from the original line
      const arrowIndex = line.indexOf('-->');
      if (arrowIndex !== -1) {
        const startStr = line.substring(0, arrowIndex).trim();
        const endPart = line.substring(arrowIndex + 3).trim();
        // End timestamp might have position info after it, extract just the time
        const endStr = endPart.split(/\s/)[0];
        
        const startTime = parseTimestamp(startStr);
        const endTime = parseTimestamp(endStr);

        // Collect text lines until next timestamp or empty line
        const textLines: string[] = [];
        i++;
        
        while (i < lines.length) {
          const textLine = lines[i].trim();
          
          // Stop at empty line or next timestamp
          if (!textLine || timestampRegex.test(textLine)) {
            break;
          }
          
          // Skip cue identifiers (pure numbers)
          if (!/^\d+$/.test(textLine)) {
            textLines.push(textLine);
          }
          
          i++;
        }

        // Only add segment if we have text
        if (textLines.length > 0) {
          segments.push({
            startTime,
            endTime,
            text: textLines.join(' ').trim(),
          });
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return segments;
}

/**
 * Get the full transcript text (all segments combined)
 */
export function getFullTranscriptText(segments: TranscriptSegment[]): string {
  return segments.map(s => s.text).join(' ');
}

/**
 * Get transcript context around a specific timestamp
 * Returns text from segments within the time window
 */
export function getContextAroundTimestamp(
  segments: TranscriptSegment[],
  timestamp: number,
  windowSeconds: number = 30
): string {
  const halfWindow = windowSeconds / 2;
  const startWindow = Math.max(0, timestamp - halfWindow);
  const endWindow = timestamp + halfWindow;

  const relevantSegments = segments.filter(
    s => s.startTime >= startWindow && s.startTime <= endWindow
  );

  return relevantSegments.map(s => s.text).join(' ');
}
