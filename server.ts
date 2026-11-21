import express from 'express';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { GoogleGenAI } from '@google/genai';
import multer from 'multer';
import mammoth from 'mammoth';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Multer memory storage for Word (.docx, .doc), PDF (.pdf), and Text (.txt) files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB maximum
});

// Dynamic Gemini client getter that always reads the latest environment variable
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1alpha',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Studio Audio DSP: Clean PCM by trimming leading/trailing breath/wind noise & applying micro-fades
function cleanPcmBuffer(pcm: Buffer): Buffer {
  if (pcm.length < 960) return pcm; // Less than 20ms, skip
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.byteLength / 2));
  const total = samples.length;
  const maxScan = Math.min(6000, Math.floor(total / 4)); // Up to 250ms scan
  const threshold = 400; // Threshold to detect voice vs ambient breath/air hiss

  let start = 0;
  for (let i = 0; i < maxScan; i++) {
    if (Math.abs(samples[i]) > threshold) {
      start = Math.max(0, i - 360); // 15ms headroom for consonant attack
      break;
    }
  }

  let end = total;
  for (let i = total - 1; i >= total - maxScan; i--) {
    if (Math.abs(samples[i]) > threshold) {
      end = Math.min(total, i + 480); // 20ms headroom for vowel decay
      break;
    }
  }

  if (end <= start + 480) {
    start = 0;
    end = total;
  }

  const len = end - start;
  const out = new Int16Array(len);
  out.set(samples.subarray(start, end));

  // 12ms Hann curve fade-in to remove click / air pop
  const fadeIn = Math.min(288, Math.floor(len / 4));
  for (let i = 0; i < fadeIn; i++) {
    const f = 0.5 * (1 - Math.cos((Math.PI * i) / fadeIn));
    out[i] = Math.round(out[i] * f);
  }

  // 18ms Hann curve fade-out to remove trailing breath / wind noise
  const fadeOut = Math.min(432, Math.floor(len / 4));
  for (let i = 0; i < fadeOut; i++) {
    const f = 0.5 * (1 + Math.cos((Math.PI * i) / fadeOut));
    const idx = len - fadeOut + i;
    out[idx] = Math.round(out[idx] * f);
  }

  return Buffer.from(out.buffer, out.byteOffset, out.byteLength);
}

// Losslessly concatenate multiple 24kHz 16-bit mono WAV buffers with clean silence (no wind or breath)
function concatWavBuffers(wavBuffers: Buffer[], pauseMs = 120): Buffer {
  if (wavBuffers.length === 0) return Buffer.alloc(0);
  if (wavBuffers.length === 1 && pauseMs === 0) return wavBuffers[0];

  const pauseBytes = pauseMs > 0 ? Math.round((48000 * pauseMs) / 1000) : 0;
  const alignedPause = pauseBytes > 0 ? Buffer.alloc(pauseBytes - (pauseBytes % 2)) : null;

  const pcmList: Buffer[] = [];
  for (let i = 0; i < wavBuffers.length; i++) {
    const wav = wavBuffers[i];
    if (wav.length > 44) {
      const rawPcm = wav.subarray(44);
      const cleanedPcm = cleanPcmBuffer(rawPcm);
      pcmList.push(cleanedPcm);
      if (alignedPause && i < wavBuffers.length - 1) {
        pcmList.push(alignedPause);
      }
    }
  }

  const totalPcm = Buffer.concat(pcmList);
  const masterHeader = Buffer.from(wavBuffers[0].subarray(0, 44));
  masterHeader.writeUInt32LE(36 + totalPcm.length, 4);
  masterHeader.writeUInt32LE(totalPcm.length, 40);

  return Buffer.concat([masterHeader, totalPcm]);
}

// Convert WAV Buffer to high-quality MP3 using FFmpeg (with safe fallback)
function convertWavToMp3(wavBuffer: Buffer): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const ffmpeg = spawn('ffmpeg', [
        '-i', 'pipe:0',
        '-f', 'mp3',
        '-b:a', '192k',
        '-y',
        'pipe:1',
      ]);

      const chunks: Buffer[] = [];
      let stderr = '';

      ffmpeg.stdout.on('data', (data: Buffer) => chunks.push(data));
      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0 && chunks.length > 0) {
          resolve(Buffer.concat(chunks));
        } else {
          console.warn(`FFmpeg warning (code ${code}): ${stderr.slice(0, 150)}`);
          resolve(null);
        }
      });

      ffmpeg.on('error', (err) => {
        console.warn('FFmpeg spawn warning:', err.message);
        resolve(null);
      });

      ffmpeg.stdin.end(wavBuffer);
    } catch (err) {
      console.warn('FFmpeg invocation error:', err);
      resolve(null);
    }
  });
}

// Robust generateContent with transient retry
async function generateContentWithRetry(params: any, maxRetries = 2): Promise<any> {
  const client = getGeminiClient();
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await client.models.generateContent(params);
    } catch (err: any) {
      lastError = err;
      const msg = err?.message || String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('fetch failed') ||
        msg.includes('ETIMEDOUT');
      if (attempt < maxRetries && isTransient) {
        const backoffMs = (attempt + 1) * 2500;
        console.log(`TTS Retry attempt ${attempt + 1}/${maxRetries} after transient issue (wait ${backoffMs}ms): ${msg.slice(0, 80)}`);
        await new Promise((r) => setTimeout(r, backoffMs));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

// Clean user-friendly error formatting in Khmer with clear diagnostic guidance
function formatGeminiError(error: any): string {
  const msg = error?.message || String(error);
  console.error('[Gemini TTS Technical Error]:', error);

  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    if (msg.includes('Requests per day') || msg.includes('PerDay')) {
      return 'កូតាប្រចាំថ្ងៃរបស់ Google Gemini API Key ឥតគិតថ្លៃបានអស់ហើយ (Google Daily Token Limit)។ សូមប្តូរប្រើ API Key ថ្មី ឬរង់ចាំដល់ថ្ងៃស្អែក។';
    }
    return 'Google Gemini API កំពុងសម្រាកល្បឿនបណ្តោះអាសន្នក្នុងមួយនាទី (Per-minute Rate limit Cooldown)។ មិនមែនអស់កូតាអត្ថបទឡើយ សូមរង់ចាំប្រហែល ១៥ ទៅ ២០ វិនាទី វានឹងដំណើរការវិញដោយស្វ័យប្រវត្តិ។';
  }
  if (
    msg.includes('PERMISSION_DENIED') ||
    msg.includes('403') ||
    msg.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') ||
    msg.includes("Method doesn't allow unregistered callers")
  ) {
    return 'មិនទាន់មានសិទ្ធិចូលប្រើប្រាស់ ឬ GEMINI_API_KEY មិនត្រឹមត្រូវ។ សូមពិនិត្យមើល Settings > Secrets។';
  }
  if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
    return 'GEMINI_API_KEY មិនត្រឹមត្រូវ (Invalid API Key)។ សូមពិនិត្យមើល Key ក្នុង Settings > Secrets។';
  }
  if (msg.includes('the number of speaker_voice_configs must equal 2')) {
    return 'កិច្ចសន្ទនាតម្រូវឱ្យមានការកំណត់តួអង្គច្បាស់លាស់ (២ នាក់)។';
  }
  if (msg.includes('INVALID_ARGUMENT') || msg.includes('400')) {
    return 'ទិន្នន័យស្នើសុំមានទម្រង់មិនត្រឹមត្រូវ។ សូមពិនិត្យមើលអត្ថបទខ្មែរដែលបានបញ្ចូលម្តងទៀត។';
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
    return 'សេវាកម្ម Google Gemini TTS កំពុងមមាញឹកបណ្ដោះអាសន្ន (503 Service Unavailable)។ សូមរង់ចាំ ៥ វិនាទី រួចចុចម្តងទៀត។';
  }
  if (msg.includes('500') || msg.includes('INTERNAL')) {
    return 'ម៉ាស៊ីនបម្រើសេវាជួបបញ្ហាបណ្ដោះអាសន្នពី Google (500 Internal Error)។ សូមព្យាយាមម្តងទៀត។';
  }
  if (msg.includes('fetch failed') || msg.includes('ENOTFOUND') || msg.includes('ETIMEDOUT')) {
    return 'មិនអាចភ្ជាប់ទៅកាន់ Google API បានទេ (Network error)។ សូមពិនិត្យមើលការភ្ជាប់អ៊ីនធឺណិត។';
  }

  // Provide clear readable snippet
  const snippet = msg.length > 70 ? msg.slice(0, 70) + '...' : msg;
  return `កំហុសបច្ចេកទេសក្នុងការបង្កើតសំឡេង [${snippet}]។ សូមព្យាយាមម្តងទៀត។`;
}

// Available voice profiles
const VOICES = [
  {
    id: 'Kore',
    gender: 'female',
    nameKh: 'កូរ៉េ (សំឡេងស្រី - ស្រទន់ ពិរោះ)',
    nameEn: 'Kore (Female - Warm & Natural)',
    descKh: 'សំឡេងស្រីស្រទន់ ស័ក្តិសមសម្រាប់អានអត្ថបទ រឿង និងព័ត៌មានទូទៅ',
    badge: 'ពេញនិយម',
  },
  {
    id: 'Zephyr',
    gender: 'female',
    nameKh: 'សេហ្វៀ (សំឡេងស្រី - ស្រស់ថ្លា រស់រវើក)',
    nameEn: 'Zephyr (Female - Bright & Cheerful)',
    descKh: 'សំឡេងស្រីវ័យក្មេង ស្រស់ថ្លា ស័ក្តិសមសម្រាប់ការផ្សាយពាណិជ្ជកម្ម និងស្វាគមន៍',
    badge: 'ស្រស់ថ្លា',
  },
  {
    id: 'Puck',
    gender: 'male',
    nameKh: 'ផាក់ (សំឡេងប្រុស - ច្បាស់ រឹងមាំ)',
    nameEn: 'Puck (Male - Clear & Energetic)',
    descKh: 'សំឡេងប្រុសច្បាស់ មានថាមពល ល្អសម្រាប់អានព័ត៌មាន និងការបង្រៀន',
    badge: 'ពេញនិយម',
  },
  {
    id: 'Charon',
    gender: 'male',
    nameKh: 'ការ៉ុន (សំឡេងប្រុស - ជ្រៅ សុភាព)',
    nameEn: 'Charon (Male - Deep & Calm)',
    descKh: 'សំឡេងប្រុសទន់ភ្លន់ ជ្រៅ មានភាពស្ងប់ស្ងាត់ ល្អសម្រាប់រឿងនិទាន និងសម្រង់គំនិត',
    badge: 'សុភាព',
  },
  {
    id: 'Fenrir',
    gender: 'male',
    nameKh: 'ហ្វេនរីរ (សំឡេងប្រុស - ផ្លូវការ វិទ្យុ)',
    nameEn: 'Fenrir (Male - Authoritative Broadcaster)',
    descKh: 'សំឡេងប្រុសផ្លូវការ ដូចពិធីករវិទ្យុ ឬទូរទស្សន៍អាជីព',
    badge: 'ផ្លូវការ',
  },
  {
    id: 'Orus',
    gender: 'male',
    nameKh: 'អូរឹស (Orus • អ្នកវិភាគប្រុស)',
    nameEn: 'Orus (Male - Firm & Analytical)',
    descKh: 'សំឡេងប្រុសម៉ឺងម៉ាត់ មានទម្ងន់ ស័ក្តិសមសម្រាប់អ្នកវិភាគសេដ្ឋកិច្ច នយោបាយ និងបច្ចេកវិទ្យា',
    badge: 'អ្នកវិភាគ',
  },
  {
    id: 'Aoede',
    gender: 'female',
    nameKh: 'អាអូដេ (Aoede • ពិធីករ Podcast ស្រី)',
    nameEn: 'Aoede (Female - Warm Podcast Host)',
    descKh: 'សំឡេងស្រីកក់ក្តៅ ស្និទ្ធស្នាល រស់រវើក ស័ក្តិសមសម្រាប់កម្មវិធី Podcast និង Talk Show',
    badge: 'Podcast',
  },
  {
    id: 'Gacrux',
    gender: 'female',
    nameKh: 'ហ្គាគ្រុស (Gacrux • អ្នកវិភាគស្រី)',
    nameEn: 'Gacrux (Female - Mature & Insightful)',
    descKh: 'សំឡេងស្រីចាស់ទុំ ស្ងប់ស្ងាត់ មានកិត្យានុភាព ស័ក្តិសមសម្រាប់វិភាគស៊ីជម្រៅ និង Podcast អប់រំ',
    badge: 'អ្នកវិភាគ',
  },
  {
    id: 'Schedar',
    gender: 'male',
    nameKh: 'ស្ឆេដា (Schedar • ពិធីករ Podcast ប្រុស)',
    nameEn: 'Schedar (Male - Smooth Podcast Host)',
    descKh: 'សំឡេងប្រុសរលូន កក់ក្តៅ ស្និទ្ធស្នាល ស័ក្តិសមសម្រាប់ Podcast ប្រវត្តិសាស្ត្រ និងជំនួញ',
    badge: 'Podcast',
  },
  {
    id: 'Leda',
    gender: 'female',
    nameKh: 'លេដា (Leda • ផ្សព្វផ្សាយ/ទីផ្សារ)',
    nameEn: 'Leda (Female - Youthful Promo & Ads)',
    descKh: 'សំឡេងស្រីយុវវ័យ ស្រស់ស្រាយ ទាក់ទាញ សម្រាប់វីដេអូពាណិជ្ជកម្ម និងលក់ផលិតផល',
    badge: 'ទីផ្សារ',
  },
  {
    id: 'Alnilam',
    gender: 'male',
    nameKh: 'អាល់នីឡាម (Alnilam • ពាណិជ្ជកម្ម)',
    nameEn: 'Alnilam (Male - Energetic Commercial Ad)',
    descKh: 'សំឡេងប្រុសមានថាមពល ជឿជាក់ និងបញ្ចុះបញ្ចូល សម្រាប់ផ្សាយប្រូម៉ូសិន',
    badge: 'ទីផ្សារ',
  },
  {
    id: 'Sulafat',
    gender: 'female',
    nameKh: 'ស៊ូឡាហ្វាត (Sulafat • ផ្សព្វផ្សាយម៉ាក)',
    nameEn: 'Sulafat (Female - Warm Brand Marketing)',
    descKh: 'សំឡេងស្រីកក់ក្តៅ ទុកចិត្តបាន សម្រាប់ផ្សព្វផ្សាយម៉ាកយីហោ និងយុទ្ធនាការទីផ្សារ',
    badge: 'ទីផ្សារ',
  },
];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
  });
});

// Download full project code as ZIP for GitHub / Render deployment
app.get('/api/download-project', (req, res) => {
  const zipPath = path.resolve(__dirname, 'public', 'rachtts-studio-code.zip');
  res.download(zipPath, 'rachtts-studio-code.zip');
});

// List available voices
app.get('/api/voices', (req, res) => {
  res.json(VOICES);
});

// Clean story narrative text: strips page numbers, scene headings, stage directions, metadata, and speaker tags
function cleanStoryText(raw: string): string {
  if (!raw) return '';
  let text = raw;

  // Remove common PDF page footers/headers like '-- 1 of 5 --', 'Page 1 of 10', 'ទំព័រទី ១'
  text = text.replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '');
  text = text.replace(/(?:Page|ទំព័រ(?:\s*ទី)?)\s*[:.]?\s*\d+/gi, '');

  const lines = text.split(/\r?\n/);
  const cleanedLines: string[] = [];

  for (let line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // Skip standalone numbers (page numbers, section numbers)
    if (/^\d+$/.test(trimmed)) continue;
    if (/^[IVXLCDMivxlcdm]+$/.test(trimmed)) continue;

    // Skip scene/chapter/act headers: 'ឈុតទី...', 'វគ្គទី...', 'ជំពូកទី...', 'ភាគទី...', 'Scene...', 'Chapter...'
    if (/^(?:ឈុត(?:\s*ទី)?|វគ្គ(?:\s*ទី)?|ភាគ(?:\s*ទី)?|ជំពូក(?:\s*ទី)?|Scene|Chapter|Act)\s*[:.\-]?\s*[\d\wក-អ]+/i.test(trimmed)) {
      continue;
    }

    // Skip metadata lines: 'និពន្ធដោយ...', 'អ្នកនិពន្ធ:', 'កាលបរិច្ឆេទ:', 'រក្សាសិទ្ធិ:', 'Author:', 'Publisher:'
    if (/^(?:អ្នកនិពន្ធ|និពន្ធ(?:ដោយ)?|កាលបរិច្ឆេទ|បោះពុម្ព|រក្សាសិទ្ធិ|Author|Publisher|Published|Copyright|ISBN)\s*[:.-]/i.test(trimmed)) {
      continue;
    }

    // Strip stage directions in parentheses or brackets e.g. (សើច), (ដើរចូល), (ក្រៀមក្រំ), [សើច]
    trimmed = trimmed.replace(/\([^)]*?(?:សើច|យំ|ដើរ|ឈរ|ស្រែក|និយាយ|ក្រឡេក|សម្លឹង|ញញឹម|pause|whisper|laugh|cry|enter|exit|bgm|sfx)[^)]*?\)/gi, '');
    trimmed = trimmed.replace(/\[[^\]]*?(?:សើច|យំ|ដើរ|ឈរ|ស្រែក|និយាយ|ក្រឡេក|សម្លឹង|ញញឹម|pause|whisper|laugh|cry|enter|exit|bgm|sfx)[^\]]*?\]/gi, '');

    // Strip dialogue speaker prefix if present (e.g. 'លោកតា: ', 'ចៅប្រុស៖ ') so it reads as pure story prose
    trimmed = trimmed.replace(/^[\u1780-\u17D3\s\w]+(?:[:៖])\s*/i, '');

    trimmed = trimmed.trim();
    if (trimmed) {
      cleanedLines.push(trimmed);
    }
  }

  return cleanedLines.join('\n\n');
}

// Parse uploaded Word (.docx, .doc), PDF (.pdf), and Text (.txt) files
app.post('/api/documents/parse', upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'សូមជ្រើសរើសឯកសារ Word (.docx, .doc), PDF (.pdf) ឬ អត្ថបទ (.txt)' });
    }

    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(originalName).toLowerCase();
    let rawText = '';
    let fileType = 'text';

    if (ext === '.docx' || ext === '.doc') {
      fileType = 'Word (.docx)';
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      rawText = result.value || '';
    } else if (ext === '.pdf') {
      fileType = 'PDF (.pdf)';
      const parser = new PDFParse({ data: file.buffer });
      await parser.load();
      const pdfData = await parser.getText();
      await parser.destroy();
      rawText = pdfData?.text || '';
    } else {
      fileType = 'Text (.txt)';
      rawText = file.buffer.toString('utf-8');
    }

    if (!rawText.trim()) {
      return res.status(400).json({ error: 'មិនអាចស្រង់អត្ថបទចេញពីឯកសារនេះបានឡើយ (ឯកសារទទេ ឬជារូបភាពស្កេន)' });
    }

    // Clean story text (removes scene tags, stage directions, headers, page numbers)
    const storyText = cleanStoryText(rawText);

    return res.json({
      success: true,
      fileName: originalName,
      fileType,
      rawText,
      storyText: storyText || rawText,
      charCount: (storyText || rawText).length,
      originalCharCount: rawText.length,
    });
  } catch (err: any) {
    console.error('Document Parse Error:', err);
    return res.status(500).json({
      error: `កំហុសក្នុងការអានឯកសារ: ${err?.message || 'សូមពិនិត្យមើលទម្រង់ឯកសារ Word ឬ PDF របស់អ្នក'}`,
    });
  }
});

// Clean story endpoint (for already pasted text)
app.post('/api/documents/clean-story', (req, res) => {
  const { text } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'សូមបញ្ចូលអត្ថបទ' });
  }
  const storyText = cleanStoryText(text);
  return res.json({
    success: true,
    storyText,
    charCount: storyText.length,
    originalCharCount: text.length,
  });
});

// AI Smart Story Extractor (extracts pure storytelling prose using Gemini 2.5 Flash)
app.post('/api/documents/extract-story-ai', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'សូមបញ្ចូលអត្ថបទដែលចង់សម្រាំង' });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: 'ត្រូវការ GEMINI_API_KEY ដើម្បីប្រើប្រាស់មុខងារសម្រាំងសាច់រឿងដោយ AI',
      });
    }

    const client = getGeminiClient();
    const prompt = `You are a professional literary and script editor fluent in both Cambodian Khmer and English.
Extract ONLY the pure narrative story prose in the SAME language as the source document below (do not translate Khmer to English or English to Khmer).
Follow these strict rules:
1. Remove completely: page headers/footers, page numbers, scene/chapter headings (ឈុតទី..., វគ្គទី..., ភាគទី..., Scene..., Chapter...), stage directions in parentheses or brackets ((សើច), [sighs], (walks away), etc.), speaker prefixes (លោកតា:, Narrator:, etc.), and copyright/author/publisher metadata.
2. Keep only smooth, natural, engaging narrative prose ready for voiceover reading.
3. Do not add any commentary or intro text of your own. Output ONLY the clean narrative text.

Source Text:
${text.slice(0, 15000)}`;

    const response = await client.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const storyText = response.text || '';
    return res.json({
      success: true,
      storyText: storyText.trim(),
      charCount: storyText.trim().length,
      originalCharCount: text.length,
    });
  } catch (err: any) {
    console.error('AI Story Extraction Error:', err);
    return res.status(500).json({
      error: formatGeminiError(err),
    });
  }
});

// Helper to cleanly segment Khmer and English text into logical paragraphs/sentences
function splitMultilingualText(text: string, maxChunkLen = 1200): string[] {
  if (text.length <= maxChunkLen) return [text.trim()];
  const paragraphs = text.split(/\n\s*\n/);
  const chunks: string[] = [];
  let currentChunk = '';

  const pushSentenceWithWordFallback = (sent: string) => {
    if (sent.length <= maxChunkLen) {
      if (currentChunk.length + sent.length + 1 <= maxChunkLen) {
        currentChunk += (currentChunk ? ' ' : '') + sent;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = sent;
      }
      return;
    }

    // Fallback for extra-long single sentences without punctuation
    const words = sent.split(/\s+/);
    for (const word of words) {
      if (!word) continue;
      if (currentChunk.length + word.length + 1 <= maxChunkLen) {
        currentChunk += (currentChunk ? ' ' : '') + word;
      } else {
        if (currentChunk) chunks.push(currentChunk);
        currentChunk = word;
      }
    }
  };

  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;

    if (currentChunk.length + trimmedPara.length + 2 <= maxChunkLen) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedPara;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }

      if (trimmedPara.length <= maxChunkLen) {
        currentChunk = trimmedPara;
      } else {
        // Split by Khmer (៕, ។) and English (. ! ? ;) sentence delimiters or newlines
        const sentences = trimmedPara.split(/(?<=[៕។.!?\n])\s*/);
        for (const sent of sentences) {
          const trimmedSent = sent.trim();
          if (!trimmedSent) continue;
          pushSentenceWithWordFallback(trimmedSent);
        }
      }
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks.filter((c) => c.trim().length > 0);
}

// Split Long Text (up to 50,000+ characters) into manageable chunks
app.post('/api/tts/split-chunks', (req, res) => {
  const { text, maxChunkLength = 1200, language = 'auto' } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'អត្ថបទត្រូវការជាចាំបាច់ (Text required)' });
  }

  const hasKhmer = /[\u1780-\u17FF]/.test(text);
  const charsPerSec = language === 'en' || (language === 'auto' && !hasKhmer) ? 15 : 18;

  const chunks = splitMultilingualText(text, maxChunkLength);
  const chunkDetails = chunks.map((chunk, index) => ({
    index: index + 1,
    text: chunk,
    charCount: chunk.length,
    estimatedSeconds: Math.max(1, Math.round(chunk.length / charsPerSec)),
  }));

  return res.json({
    totalLength: text.length,
    totalChunks: chunks.length,
    chunks: chunkDetails,
  });
});

// Merge multiple generated WAV chunks into one unified master WAV & MP3
app.post('/api/tts/merge', async (req, res) => {
  try {
    const { wavChunks, text = '', voice = 'Kore', gender = 'female', style = 'natural' } = req.body;
    if (!Array.isArray(wavChunks) || wavChunks.length === 0) {
      return res.status(400).json({ error: 'បញ្ជីសំឡេងមិនទាន់ត្រឹមត្រូវ (wavChunks required)' });
    }

    const buffers = wavChunks.map((b64: string) => Buffer.from(b64, 'base64'));
    const mergedWav = concatWavBuffers(buffers);
    const mergedMp3 = await convertWavToMp3(mergedWav);
    const durationSeconds = Math.max(0.1, Number(((mergedWav.length - 44) / 48000).toFixed(2)));

    return res.json({
      success: true,
      text,
      voice,
      gender,
      style,
      durationSeconds,
      wavBase64: mergedWav.toString('base64'),
      mp3Base64: mergedMp3 ? mergedMp3.toString('base64') : '',
      wavSize: mergedWav.length,
      mp3Size: mergedMp3 ? mergedMp3.length : 0,
    });
  } catch (err: any) {
    console.error('Audio Merge Error:', err);
    return res.status(500).json({ error: 'បរាជ័យក្នុងការផ្គុំឯកសារសំឡេង' });
  }
});

// Concurrently process an array with an execution limit to prevent rate limits
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < items.length) {
      const idx = nextIdx++;
      results[idx] = await fn(items[idx], idx);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

const STUDIO_CLEAN_GUIDE = 'Studio isolation recording. Clean, crisp studio voice. STRICT REQUIREMENT: Absolutely DO NOT make any audible breathing sounds, sighs, gasps, inhaling air, exhaling air, or wind whooshing noise between words, sentences, or sections. Silent pauses only.';

// Resolve language-specific speech instruction (supports Khmer, English, and Bilingual/Auto)
function resolveLanguageGuide(sampleText: string, language: string = 'auto'): {
  detectedLang: 'km' | 'en' | 'bilingual';
  langInstruction: string;
} {
  const hasKhmer = /[\u1780-\u17FF]/.test(sampleText);
  const hasEnglish = /[A-Za-z]/.test(sampleText);

  if (language === 'en' || (language === 'auto' && hasEnglish && !hasKhmer)) {
    return {
      detectedLang: 'en',
      langInstruction:
        'Speak fluently and naturally in clear standard English with authentic native pronunciation, crisp articulation, and natural cadence.',
    };
  }

  if (language === 'auto' && hasKhmer && hasEnglish) {
    return {
      detectedLang: 'bilingual',
      langInstruction:
        'Speak fluently in both standard Cambodian Khmer (ភាសាខ្មែរ) and standard English, pronouncing Khmer text with an authentic native Khmer accent and English words with crisp, natural native English pronunciation.',
    };
  }

  return {
    detectedLang: 'km',
    langInstruction:
      'Speak fluently and naturally in standard Cambodian Khmer (ភាសាខ្មែរ) with accurate native pronunciation and natural cadence.',
  };
}

// Synthesize a single turn of speech with designated voice and style
async function generateTurnAudio(
  text: string,
  voiceName: string,
  styleGuide: string
): Promise<Buffer> {
  const models = ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts'];
  let lastErr: any;

  for (const model of models) {
    try {
      const response = await generateContentWithRetry({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text,
                speechMetadata: {
                  style: styleGuide,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        return Buffer.from(base64Audio, 'base64');
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`TTS turn model ${model} warning:`, err?.message?.slice(0, 80));
    }
  }

  throw lastErr || new Error('បរាជ័យក្នុងការបង្កើតសំឡេងសម្រាប់ឃ្លានេះ');
}

// Generate Single-Speaker Khmer & English TTS (Supports any text length up to 50,000+ characters)
app.post('/api/tts/generate', async (req, res) => {
  try {
    const {
      text,
      voice = 'Kore',
      gender = 'female',
      style = 'natural',
      language = 'auto',
      customInstruction = '',
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: 'មិនទាន់មាន GEMINI_API_KEY នៅក្នុងប្រព័ន្ធទេ។ សូមចូលទៅកាន់ Settings > Secrets រួចបន្ថែម GEMINI_API_KEY (យក Key ឥតគិតថ្លៃនៅ aistudio.google.com/app/apikey)។',
      });
    }

    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'សូមបញ្ចូលអត្ថបទដែលត្រូវនិយាយ (Text is required)' });
    }

    const trimmedText = text.trim();
    const { detectedLang, langInstruction } = resolveLanguageGuide(trimmedText, language);

    // Build style prompt tailored for resolved language with strict breath/wind suppression
    let stylePrompt = `${langInstruction} ${STUDIO_CLEAN_GUIDE}`;
    if (style === 'marketing') {
      stylePrompt +=
        ' Tone: High-energy commercial and marketing voiceover artist, persuasive, dynamic, enthusiastic, crisp punchy articulation, warm excitement that builds trust and drives customer action without harsh breath noise.';
    } else if (style === 'podcast') {
      stylePrompt +=
        ' Tone: Engaging modern podcast host, intimate close-mic studio presence, warm conversational rhythm, thoughtful emphasis, and captivating flow without breath noise.';
    } else if (style === 'analyst') {
      stylePrompt +=
        ' Tone: Insightful senior analyst and commentator, calm intellectual authority, measured deliberate cadence, crisp emphasis on logical arguments and key data points.';
    } else if (style === 'news') {
      stylePrompt += ' Tone: Professional news broadcaster, clear, articulate, and authoritative.';
    } else if (style === 'story') {
      stylePrompt += ' Tone: Expressive storyteller, warm, engaging, and emotional pacing.';
    } else if (style === 'cheerful') {
      stylePrompt += ' Tone: Cheerful, upbeat, friendly, and welcoming.';
    } else if (style === 'calm') {
      stylePrompt += ' Tone: Gentle, calming, peaceful, and soft-spoken.';
    } else if (style === 'formal') {
      stylePrompt += detectedLang === 'en'
        ? ' Tone: Formal, dignified, polite, and executive presentation style.'
        : ' Tone: Formal, dignified, and respectful Cambodian honorific style.';
    } else {
      stylePrompt += ' Tone: Clean, natural, and warm speaker.';
    }

    if (customInstruction && typeof customInstruction === 'string' && customInstruction.trim()) {
      stylePrompt += ` Additional guidance: ${customInstruction.trim()}`;
    }

    // Validate voice name
    const validVoices = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Aoede', 'Gacrux', 'Schedar', 'Leda', 'Alnilam', 'Sulafat'];
    const chosenVoice = validVoices.includes(voice) ? voice : (gender === 'male' ? 'Puck' : 'Kore');

    let wavBuffer: Buffer;

    // If text exceeds 2000 characters, automatically chunk and stitch so there is NO length limit
    if (trimmedText.length > 2000) {
      const chunks = splitMultilingualText(trimmedText, 1200);
      const chunkBuffers: Buffer[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const c = chunks[i];
        const b = await generateTurnAudio(c, chosenVoice, stylePrompt);
        chunkBuffers.push(b);
        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      wavBuffer = concatWavBuffers(chunkBuffers, 0);
    } else {
      wavBuffer = await generateTurnAudio(trimmedText, chosenVoice, stylePrompt);
    }

    // Convert WAV to MP3 using ffmpeg (safe fallback)
    const mp3Buffer = await convertWavToMp3(wavBuffer);

    // Calculate duration in seconds (24000Hz, 16-bit mono = 48,000 bytes/sec)
    const durationSeconds = Math.max(0.1, Number(((wavBuffer.length - 44) / 48000).toFixed(2)));

    return res.json({
      success: true,
      text: trimmedText,
      voice: chosenVoice,
      gender,
      style,
      language: detectedLang,
      durationSeconds,
      wavBase64: wavBuffer.toString('base64'),
      mp3Base64: mp3Buffer ? mp3Buffer.toString('base64') : '',
      wavSize: wavBuffer.length,
      mp3Size: mp3Buffer ? mp3Buffer.length : 0,
    });
  } catch (error: any) {
    console.error('TTS Generation Error:', error);
    const msg = error?.message || String(error);
    const isRateLimit = msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429');
    return res.status(isRateLimit ? 429 : 500).json({
      error: formatGeminiError(error),
      isRateLimit,
    });
  }
});

// Generate Multi-Character & Dual-Speaker Dialogue TTS
app.post('/api/tts/dialogue', async (req, res) => {
  try {
    const {
      turns, // Array of { id?: string; speaker: string; text: string; voice?: string }
      speaker1Voice = 'Fenrir', // Male default
      speaker2Voice = 'Kore', // Female default
      language = 'auto',
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: 'មិនទាន់មាន GEMINI_API_KEY នៅក្នុងប្រព័ន្ធទេ។ សូមចូលទៅកាន់ Settings > Secrets រួចបន្ថែម GEMINI_API_KEY (យក Key ឥតគិតថ្លៃនៅ aistudio.google.com/app/apikey)។',
      });
    }

    if (!Array.isArray(turns) || turns.length === 0) {
      return res.status(400).json({ error: 'សូមបញ្ចូលកិច្ចសន្ទនាយ៉ាងហោចណាស់មួយឃ្លា (Dialogue turns required)' });
    }

    const validTurns = turns.filter(
      (turn) => turn && typeof turn.text === 'string' && turn.text.trim().length > 0
    );

    if (validTurns.length === 0) {
      return res.status(400).json({ error: 'សូមបញ្ចូលអត្ថបទកិច្ចសន្ទនា (អត្ថបទមិនអាចទទេបានទេ)' });
    }

    const combinedDialogueText = validTurns.map((t) => t.text).join(' ');
    const { langInstruction } = resolveLanguageGuide(combinedDialogueText, language);

    const validVoices = ['Kore', 'Zephyr', 'Puck', 'Charon', 'Fenrir', 'Orus', 'Aoede', 'Gacrux', 'Schedar', 'Leda', 'Alnilam', 'Sulafat'];

    // Comprehensive character mapping for 8 rich character roles
    const ROLE_VOICES: Record<string, string> = {
      'ក្មេងប្រុស': 'Puck',
      'ក្មេងស្រី': 'Zephyr',
      'មនុស្សចាស់ប្រុស': 'Charon',
      'មនុស្សចាស់ស្រី': 'Kore',
      'ប្រុស': speaker1Voice || 'Fenrir',
      'ស្រី': speaker2Voice || 'Kore',
      'ពិធីករ Podcast': 'Aoede',
      'អ្នកវិភាគ': 'Orus',
      'Male': speaker1Voice || 'Fenrir',
      'Female': speaker2Voice || 'Kore',
    };

    // Group turns into 2 speaker channels (Speaker1 and Speaker2)
    // to leverage Gemini 3.8 Flash TTS's native multiSpeaker in a single call:
    const uniqueSpeakers = Array.from(new Set(validTurns.map((t) => t.speaker)));
    const speakerChannelMap: Record<string, 'Speaker1' | 'Speaker2'> = {};

    let voice1 = speaker1Voice || 'Fenrir';
    let voice2 = speaker2Voice || 'Kore';

    if (uniqueSpeakers.length === 1) {
      const spk = uniqueSpeakers[0];
      speakerChannelMap[spk] = 'Speaker1';
      voice1 = validVoices.includes(validTurns[0].voice) ? validTurns[0].voice : (ROLE_VOICES[spk] || 'Fenrir');
      voice2 = voice1 === 'Kore' ? 'Puck' : 'Kore';
    } else {
      const firstSpeaker = uniqueSpeakers[0];
      const secondSpeaker = uniqueSpeakers[1];

      speakerChannelMap[firstSpeaker] = 'Speaker1';
      speakerChannelMap[secondSpeaker] = 'Speaker2';

      for (let i = 2; i < uniqueSpeakers.length; i++) {
        const spk = uniqueSpeakers[i];
        if (spk.includes('ស្រី') || spk.includes('Female')) {
          speakerChannelMap[spk] = 'Speaker2';
        } else {
          speakerChannelMap[spk] = 'Speaker1';
        }
      }

      const turnWithSpk1 = validTurns.find((t) => speakerChannelMap[t.speaker] === 'Speaker1');
      const turnWithSpk2 = validTurns.find((t) => speakerChannelMap[t.speaker] === 'Speaker2');

      voice1 = (turnWithSpk1 && validVoices.includes(turnWithSpk1.voice))
        ? turnWithSpk1.voice
        : (ROLE_VOICES[firstSpeaker] || 'Charon');

      voice2 = (turnWithSpk2 && validVoices.includes(turnWithSpk2.voice))
        ? turnWithSpk2.voice
        : (ROLE_VOICES[secondSpeaker] || 'Zephyr');
    }

    if (!validVoices.includes(voice1)) voice1 = 'Fenrir';
    if (!validVoices.includes(voice2)) voice2 = 'Kore';

    // Format parts with strict Speaker1 / Speaker2 labels for native dual-speaker TTS
    const parts = validTurns.map((turn) => {
      const channel = speakerChannelMap[turn.speaker] || 'Speaker1';
      return {
        text: `${channel}: ${turn.text.trim()}`,
        speechMetadata: {
          speaker: channel,
          style: `${langInstruction} ${STUDIO_CLEAN_GUIDE}`,
        },
      };
    });

    let base64Audio: string | undefined;

    // Primary: Native single-call dual speaker generation via gemini-3.8-flash-tts
    try {
      const response = await generateContentWithRetry({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: 'Speaker1',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice1 },
                  },
                },
                {
                  speaker: 'Speaker2',
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice2 },
                  },
                },
              ],
            },
          },
        },
      });

      base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (err: any) {
      console.warn('Native multi-speaker call warning, falling back to sequential synthesis:', err?.message);
    }

    let wavBuffer: Buffer;

    if (base64Audio) {
      wavBuffer = Buffer.from(base64Audio, 'base64');
    } else {
      // Fallback: Synthesize turn-by-turn with a 150ms clean silence conversational pause
      const turnWavs: Buffer[] = [];
      for (let i = 0; i < validTurns.length; i++) {
        const turn = validTurns[i];
        const v = validVoices.includes(turn.voice) ? turn.voice : (ROLE_VOICES[turn.speaker] || 'Puck');
        const turnLangGuide = resolveLanguageGuide(turn.text, language).langInstruction;
        const b = await generateTurnAudio(turn.text.trim(), v, `${turnLangGuide} ${STUDIO_CLEAN_GUIDE}`);
        turnWavs.push(b);
        if (i < validTurns.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      wavBuffer = concatWavBuffers(turnWavs, 150);
    }

    const mp3Buffer = await convertWavToMp3(wavBuffer);
    const durationSeconds = Math.max(0.1, Number(((wavBuffer.length - 44) / 48000).toFixed(2)));

    return res.json({
      success: true,
      turnCount: validTurns.length,
      durationSeconds,
      wavBase64: wavBuffer.toString('base64'),
      mp3Base64: mp3Buffer ? mp3Buffer.toString('base64') : '',
      wavSize: wavBuffer.length,
      mp3Size: mp3Buffer ? mp3Buffer.length : 0,
    });
  } catch (error: any) {
    console.error('Dialogue TTS Generation Error:', error);
    return res.status(500).json({
      error: formatGeminiError(error),
    });
  }
});

// Setup Vite middleware or static serving
async function startServer() {
  // Global error handler so any Express error returns JSON, never HTML
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err) {
      console.error('Express Error:', err);
      if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'ទិន្នន័យមានទំហំធំលើសកំណត់ (413 Payload Too Large)' });
      }
      return res.status(500).json({ error: err.message || 'កំហុសបច្ចេកទេសក្នុងម៉ាស៊ីនបម្រើសេវា' });
    }
    next();
  });

  // Ensure unmatched /api routes ALWAYS return JSON (never HTML) in both dev and production
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `រកមិនឃើញសេវាកម្ម API: ${req.method} ${req.path}` });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'Endpoint not found' });
      }
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Khmer TTS Server running at http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
