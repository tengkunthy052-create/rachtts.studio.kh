import { Document, Packer, Paragraph, TextRun, HeadingLevel, BorderStyle } from 'docx';
import type { SubtitleCue } from '../types';

export function sanitizeFileName(name: string): string {
  return (name || '')
    .replace(/[\\/:*?"<>|#%&{}\\$!'@+`=]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();
}

export function getDefaultExportFileName(
  text: string,
  voice = 'voice',
  isDialogue = false
): string {
  if (isDialogue) {
    return `khmer_dialogue_${Date.now().toString().slice(-4)}`;
  }
  const snippet = (text || '')
    .replace(/\[.*?\]/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .trim();
  const cleaned = sanitizeFileName(snippet.slice(0, 32));
  if (cleaned && cleaned.length >= 2) {
    return cleaned;
  }
  return `khmer_tts_${(voice || 'voice').toLowerCase().replace(/\s+/g, '_')}`;
}

function formatSrtTimestamp(seconds: number): string {
  const safeMs = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const secs = Math.floor((safeMs % 60_000) / 1000);
  const ms = safeMs % 1000;

  const pad2 = (n: number) => String(n).padStart(2, '0');
  const pad3 = (n: number) => String(n).padStart(3, '0');
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(secs)},${pad3(ms)}`;
}

/**
 * Splits Khmer & English text into natural subtitle-sized lines (~75 chars max)
 * without breaking Latin words or leaving dangling punctuation.
 */
export function segmentTextForSubtitles(rawText: string, maxCueLength = 80): string[] {
  const normalized = (rawText || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\s*\|\s*/g, '\n')
    .trim();

  if (!normalized) return [];

  const blocks = normalized
    .split(/\n+/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cues: string[] = [];

  for (const block of blocks) {
    // Split on sentence boundaries while keeping trailing punctuation
    const sentences = block
      .split(/(?<=[។៕.!?])\s*/)
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sentence of sentences) {
      if (sentence.length <= maxCueLength) {
        cues.push(sentence);
        continue;
      }

      // Break long sentences cleanly along commas, colons, spaces, or Khmer zero-width spaces
      let remaining = sentence;
      while (remaining.length > maxCueLength) {
        const slice = remaining.slice(0, maxCueLength);
        let splitAt = -1;

        for (let i = slice.length - 1; i >= Math.floor(maxCueLength * 0.45); i--) {
          const ch = slice[i];
          if (
            ch === '។' ||
            ch === '៕' ||
            ch === '៖' ||
            ch === ',' ||
            ch === ';' ||
            ch === ' ' ||
            ch === '\u200b'
          ) {
            splitAt = i + 1;
            break;
          }
        }

        if (splitAt <= 0) {
          splitAt = maxCueLength;
        }

        const part = remaining.slice(0, splitAt).trim();
        if (part) cues.push(part);
        remaining = remaining.slice(splitAt).trim();
      }

      if (remaining) {
        cues.push(remaining);
      }
    }
  }

  return cues;
}

/**
 * Computes synchronized SubtitleCues within [startOffset, startOffset + segmentDuration]
 */
export function buildCuesForSegment(
  text: string,
  segmentDurationSeconds: number,
  startOffsetSeconds = 0
): SubtitleCue[] {
  const lines = segmentTextForSubtitles(text);
  if (lines.length === 0) return [];

  const totalDur = Math.max(0.5, segmentDurationSeconds);
  const weights = lines.map((line) => {
    const cleanLen = line.replace(/[\s\u200b។៕.,!?៖;]+/g, '').length;
    return Math.max(1, cleanLen);
  });
  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  const cues: SubtitleCue[] = [];
  let cursor = startOffsetSeconds;

  for (let i = 0; i < lines.length; i++) {
    const portion = (weights[i] / totalWeight) * totalDur;
    const end =
      i === lines.length - 1
        ? startOffsetSeconds + totalDur
        : Math.min(startOffsetSeconds + totalDur, cursor + Math.max(0.35, portion));

    cues.push({
      startSeconds: cursor,
      endSeconds: Math.max(cursor + 0.2, end),
      text: lines[i],
    });
    cursor = end;
  }

  return cues;
}

export function buildSrtContent(
  text: string,
  totalDurationSeconds: number,
  precomputedCues?: SubtitleCue[]
): string {
  const cues =
    precomputedCues && precomputedCues.length > 0
      ? precomputedCues
      : buildCuesForSegment(text, Math.max(1, totalDurationSeconds), 0);

  if (cues.length === 0) {
    return `1\n00:00:00,000 --> ${formatSrtTimestamp(Math.max(1, totalDurationSeconds))}\n${(text || '').trim()}\n`;
  }

  return cues
    .map((cue, index) => {
      const start = formatSrtTimestamp(cue.startSeconds);
      const end = formatSrtTimestamp(Math.max(cue.startSeconds + 0.2, cue.endSeconds));
      return `${index + 1}\n${start} --> ${end}\n${cue.text}`;
    })
    .join('\n\n')
    .concat('\n');
}

function triggerBlobDownload(blob: Blob, fullFileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fullFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadSrtFile(params: {
  text: string;
  durationSeconds: number;
  fileName?: string;
  cues?: SubtitleCue[];
}): void {
  const srt = buildSrtContent(params.text, params.durationSeconds, params.cues);
  const safeBase =
    sanitizeFileName(params.fileName || '') ||
    getDefaultExportFileName(params.text);
  const blob = new Blob([srt], { type: 'application/x-subrip;charset=utf-8' });
  triggerBlobDownload(blob, `${safeBase}.srt`);
}

export async function downloadWordFile(params: {
  text: string;
  fileName?: string;
  title?: string;
  voice?: string;
  styleLabel?: string;
  durationSeconds?: number;
  isDialogue?: boolean;
}): Promise<void> {
  const cleanText = (params.text || '').trim();
  const safeBase =
    sanitizeFileName(params.fileName || '') ||
    getDefaultExportFileName(cleanText, params.voice, params.isDialogue);

  const fontSpec = {
    name: 'Khmer OS Siemreap',
    eastAsia: 'Khmer OS Siemreap',
    cs: 'Khmer OS Siemreap',
  };

  const docParagraphs: Paragraph[] = [];

  // Header Title
  docParagraphs.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: params.title || 'rachtts.studio.kh - អត្ថបទសំឡេង',
          bold: true,
          size: 30,
          color: '1E293B',
          font: fontSpec,
        }),
      ],
    })
  );

  // Metadata bar if details available
  const metaParts: string[] = [];
  if (params.voice) metaParts.push(`សំឡេង៖ ${params.voice}`);
  if (params.styleLabel) metaParts.push(`រចនាប័ទ្ម៖ ${params.styleLabel}`);
  if (params.durationSeconds && params.durationSeconds > 0) {
    metaParts.push(`រយៈពេល៖ ${params.durationSeconds}s`);
  }

  if (metaParts.length > 0) {
    docParagraphs.push(
      new Paragraph({
        spacing: { after: 220 },
        border: {
          bottom: {
            color: 'CBD5E1',
            space: 6,
            style: BorderStyle.SINGLE,
            size: 6,
          },
        },
        children: [
          new TextRun({
            text: metaParts.join('   •   '),
            size: 20,
            color: '64748B',
            font: fontSpec,
          }),
        ],
      })
    );
  }

  // Body lines / dialogue turns
  const rawLines = params.isDialogue
    ? cleanText.split(/\s*\|\s*|\r?\n/)
    : cleanText.split(/\r?\n/);

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      docParagraphs.push(new Paragraph({ spacing: { after: 100 } }));
      continue;
    }

    if (params.isDialogue && trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':');
      const speaker = trimmed.slice(0, colonIdx + 1);
      const dialogueBody = trimmed.slice(colonIdx + 1).trim();
      docParagraphs.push(
        new Paragraph({
          spacing: { after: 140, line: 340 },
          children: [
            new TextRun({
              text: `${speaker} `,
              bold: true,
              size: 24,
              color: '0F172A',
              font: fontSpec,
            }),
            new TextRun({
              text: dialogueBody,
              size: 24,
              color: '1E293B',
              font: fontSpec,
            }),
          ],
        })
      );
    } else {
      docParagraphs.push(
        new Paragraph({
          spacing: { after: 140, line: 340 },
          children: [
            new TextRun({
              text: trimmed,
              size: 24,
              color: '1E293B',
              font: fontSpec,
            }),
          ],
        })
      );
    }
  }

  const doc = new Document({
    creator: 'rachtts.studio.kh',
    title: safeBase,
    sections: [
      {
        properties: {},
        children: docParagraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  triggerBlobDownload(blob, `${safeBase}.docx`);
}
