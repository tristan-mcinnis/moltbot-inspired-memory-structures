/**
 * Markdown utility functions
 */

/**
 * Parse a Markdown file into sections by heading
 */
export function parseSections(content: string): Map<string, string> {
  const sections = new Map<string, string>();
  const lines = content.split('\n');

  let currentSection = '';
  let currentContent: string[] = [];

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

    if (headingMatch) {
      // Save previous section
      if (currentSection || currentContent.length > 0) {
        sections.set(currentSection, currentContent.join('\n').trim());
      }
      currentSection = headingMatch[2].trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection || currentContent.length > 0) {
    sections.set(currentSection, currentContent.join('\n').trim());
  }

  return sections;
}

/**
 * Extract bullet points from Markdown content
 */
export function extractBulletPoints(content: string): string[] {
  const lines = content.split('\n');
  return lines
    .filter((line) => line.match(/^\s*[-*+]\s+/))
    .map((line) => line.replace(/^\s*[-*+]\s+/, '').trim());
}

/**
 * Format a timestamp for daily notes
 */
export function formatTime(date: Date = new Date()): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Format a date for daily note filenames
 */
export function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Create a Markdown section header
 */
export function createSection(title: string, level: number = 2): string {
  const hashes = '#'.repeat(level);
  return `${hashes} ${title}`;
}

/**
 * Create a timestamped entry for daily notes
 */
export function createTimestampedEntry(
  content: string,
  date: Date = new Date()
): string {
  return `- [${formatTime(date)}] ${content}`;
}

/**
 * Append content to a specific section in Markdown
 * If section doesn't exist, creates it at the end
 */
export function appendToSection(
  markdown: string,
  sectionTitle: string,
  content: string,
  createIfMissing: boolean = true
): string {
  const lines = markdown.split('\n');
  const sectionPattern = new RegExp(`^##\\s+${escapeRegex(sectionTitle)}\\s*$`);

  let sectionStart = -1;
  let sectionEnd = lines.length;

  for (let i = 0; i < lines.length; i++) {
    if (sectionPattern.test(lines[i])) {
      sectionStart = i;
      // Find the end of this section (next ## heading or end of file)
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^##\s+/)) {
          sectionEnd = j;
          break;
        }
      }
      break;
    }
  }

  if (sectionStart === -1) {
    if (createIfMissing) {
      // Add new section at the end
      return markdown.trimEnd() + `\n\n## ${sectionTitle}\n${content}\n`;
    }
    return markdown;
  }

  // Insert content at the end of the section
  const before = lines.slice(0, sectionEnd);
  const after = lines.slice(sectionEnd);

  // Remove trailing empty lines from before
  while (before.length > 0 && before[before.length - 1].trim() === '') {
    before.pop();
  }

  return [...before, content, '', ...after].join('\n');
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
