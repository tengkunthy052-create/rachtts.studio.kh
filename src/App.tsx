import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Music,
  Users,
  Sparkles,
  Download,
  Volume2,
  Settings2,
  Trash2,
  Copy,
  Check,
  FileAudio,
  Radio,
  BookOpen,
  Smile,
  Feather,
  ShieldCheck,
  RefreshCw,
  Info,
  Layers,
  Upload,
  BookMarked,
  ArrowRight,
  Wand2,
  FileText,
  Clock,
  Globe,
  Headphones,
  TrendingUp,
  Megaphone,
  Cloud,
  LogIn,
  LogOut,
  Captions,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  syncUserProfileOnSignIn,
  updateCloudQuota,
  saveSpeechToCloud,
  deleteSpeechFromCloud,
  clearCloudSpeeches,
  subscribeToUserProfile,
  subscribeToUserSpeeches,
  getTodayDateString,
} from './firebase';
import { VOICES, STYLES, SAMPLE_TEXTS } from './data/voices';
import {
  VoiceOption,
  SpeechStyle,
  GeneratedSpeech,
  DialogueTurn,
  SpeechLanguage,
  SubtitleCue,
} from './types';
import {
  buildCuesForSegment,
  downloadSrtFile,
  downloadWordFile,
} from './utils/exportFiles';
import { VoiceSelector } from './components/VoiceSelector';
import { AudioPlayer } from './components/AudioPlayer';
import { DialogueMode } from './components/DialogueMode';
import { HistoryDrawer } from './components/HistoryDrawer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import rachttsLogo from './assets/images/rachtts_logo_1794216810522.jpg';

// Resilient API Fetch + JSON Parser (prevents stale cache/SW intercepts, retries transient 200 HTML wakeups, and handles proxy errors)
async function apiFetchJson<T = any>(
  url: string,
  init: RequestInit = {},
  defaultMessage = 'កំហុសបច្ចេកទេសក្នុងការទទួលទិន្នន័យ'
): Promise<{ res: Response; data: T }> {
  const attemptFetch = async () => {
    const headers = new Headers(init.headers || {});
    if (!headers.has('Accept')) {
      headers.set('Accept', 'application/json');
    }
    return fetch(url, {
      ...init,
      headers,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  };

  const isHtmlResponse = (text: string) =>
    text.includes('<html') || text.includes('<!DOCTYPE') || text.trimStart().startsWith('<');

  let res = await attemptFetch();
  let rawText = await res.text();

  // If proxy/SW/container wake-up returned HTML with HTTP 200, clear stale SW/retry once automatically
  if (res.status === 200 && isHtmlResponse(rawText)) {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update().catch(() => {})));
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1200));
    res = await attemptFetch();
    rawText = await res.text();
  }

  try {
    const data = JSON.parse(rawText);
    return { res, data };
  } catch {
    if (res.status === 504 || rawText.includes('504 Gateway Time-out') || rawText.includes('Gateway Timeout')) {
      throw new Error('ម៉ាស៊ីនបម្រើសេវាឆ្លើយតបយឺតបណ្តោះអាសន្ន (504 Gateway Timeout)។ សូមព្យាយាមបម្លែងម្តងទៀត។');
    }
    if (res.status === 502 || rawText.includes('502 Bad Gateway')) {
      throw new Error('ម៉ាស៊ីនបម្រើសេវាកំពុងមមាញឹក (502 Bad Gateway)។ សូមរង់ចាំ ៥ វិនាទីរួចចុចម្តងទៀត។');
    }
    if (res.status === 413 || rawText.includes('Payload Too Large') || rawText.includes('Request Entity Too Large')) {
      throw new Error('ទិន្នន័យមានទំហំធំលើសកំណត់ (413 Payload Too Large)។');
    }
    if (isHtmlResponse(rawText)) {
      if (res.status === 200 || res.redirected) {
        throw new Error(
          'សម័យប្រើប្រាស់ត្រូវបានផ្អាកបណ្ដោះអាសន្ន ឬម៉ាស៊ីនបម្រើសេវាកំពុងចាប់ផ្ដើមឡើងវិញ។ សូមផ្ទុកទំព័រនេះឡើងវិញ (Refresh) រួចព្យាយាមម្ដងទៀត។'
        );
      }
      throw new Error(`ម៉ាស៊ីនបម្រើសេវាបានបញ្ជូនកូដកំហុស ${res.status}។ សូមព្យាយាមម្តងទៀត។`);
    }
    throw new Error(rawText.slice(0, 120) || defaultMessage);
  }
}

// Audio DSP: Clean PCM by trimming leading/trailing breath/wind noise and smoothing boundaries
function cleanClientPcm(pcmBytes: Uint8Array): Uint8Array {
  if (pcmBytes.length < 960) return pcmBytes;
  const sampleCount = Math.floor(pcmBytes.length / 2);
  const samples = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount);

  // Scan up to 250ms (3000 samples at 24kHz) for speech start and end
  const maxScan = Math.min(3000, Math.floor(sampleCount / 4));
  const threshold = 400; // Threshold distinguishing vocal cords from microphone air/breathing

  let start = 0;
  for (let i = 0; i < maxScan; i++) {
    if (Math.abs(samples[i]) > threshold) {
      start = Math.max(0, i - 360); // 15ms attack headroom
      break;
    }
  }

  let end = sampleCount;
  for (let i = sampleCount - 1; i >= sampleCount - maxScan; i--) {
    if (Math.abs(samples[i]) > threshold) {
      end = Math.min(sampleCount, i + 480); // 20ms decay headroom
      break;
    }
  }

  if (end <= start + 480) {
    start = 0;
    end = sampleCount;
  }

  const trimmedLen = end - start;
  const out = new Int16Array(trimmedLen);
  out.set(samples.subarray(start, end));

  // 12ms Hann fade-in to eliminate air puff / DC offset click
  const fadeIn = Math.min(288, Math.floor(trimmedLen / 4));
  for (let i = 0; i < fadeIn; i++) {
    const f = 0.5 * (1 - Math.cos((Math.PI * i) / fadeIn));
    out[i] = Math.round(out[i] * f);
  }

  // 18ms Hann fade-out to eliminate trailing exhalation / wind whoosh
  const fadeOut = Math.min(432, Math.floor(trimmedLen / 4));
  for (let i = 0; i < fadeOut; i++) {
    const f = 0.5 * (1 + Math.cos((Math.PI * i) / fadeOut));
    const idx = trimmedLen - fadeOut + i;
    out[idx] = Math.round(out[idx] * f);
  }

  return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
}

// Client-Side WAV Concatenator: concatenates multiple 24kHz mono WAV base64 chunks with zero wind or breath noise
function concatClientWavs(wavBase64List: string[]): string {
  if (wavBase64List.length === 0) return '';
  if (wavBase64List.length === 1) return wavBase64List[0];

  const pcmArrays: Uint8Array[] = [];
  let totalPcmLength = 0;
  let masterHeader: Uint8Array | null = null;
  // 140ms pure digital silence between sections (140 * 48 = 6720 bytes)
  const interSectionSilence = new Uint8Array(6720);

  for (let idx = 0; idx < wavBase64List.length; idx++) {
    const b64 = wavBase64List[idx];
    const binaryStr = atob(b64);
    const len = binaryStr.length;
    if (len <= 44) continue;

    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    if (!masterHeader) {
      masterHeader = bytes.slice(0, 44);
    }

    const rawPcm = bytes.subarray(44);
    const cleanedPcm = cleanClientPcm(rawPcm);
    pcmArrays.push(cleanedPcm);
    totalPcmLength += cleanedPcm.length;

    // Insert clean digital silence between chunks (never on the final chunk)
    if (idx < wavBase64List.length - 1) {
      pcmArrays.push(interSectionSilence);
      totalPcmLength += interSectionSilence.length;
    }
  }

  if (!masterHeader || pcmArrays.length === 0) return '';

  const merged = new Uint8Array(44 + totalPcmLength);
  merged.set(masterHeader, 0);

  const chunkSize = 36 + totalPcmLength;
  merged[4] = chunkSize & 0xff;
  merged[5] = (chunkSize >> 8) & 0xff;
  merged[6] = (chunkSize >> 16) & 0xff;
  merged[7] = (chunkSize >> 24) & 0xff;

  merged[40] = totalPcmLength & 0xff;
  merged[41] = (totalPcmLength >> 8) & 0xff;
  merged[42] = (totalPcmLength >> 16) & 0xff;
  merged[43] = (totalPcmLength >> 24) & 0xff;

  let offset = 44;
  for (const pcm of pcmArrays) {
    merged.set(pcm, offset);
    offset += pcm.length;
  }

  let binary = '';
  const chunkSizeB64 = 32768;
  for (let i = 0; i < merged.length; i += chunkSizeB64) {
    const chunk = merged.subarray(i, Math.min(i + chunkSizeB64, merged.length));
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'tts' | 'dialogue'>('tts');

  // Firebase Auth & Cloud Sync State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [cloudSpeeches, setCloudSpeeches] = useState<GeneratedSpeech[] | null>(null);
  const hasRestoredCloudPrefsRef = useRef(false);

  // Daily quota tracker (Goal: 10 full articles per day, 15 to 30 minutes each)
  const [dailyArticlesCount, setDailyArticlesCount] = useState<number>(() => {
    const today = getTodayDateString();
    try {
      const saved = localStorage.getItem('khmer_tts_daily_articles');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.date === today && typeof data.count === 'number') {
          return data.count;
        }
      }
    } catch {}
    return 0;
  });

  const dailyArticlesCountRef = useRef(dailyArticlesCount);
  useEffect(() => {
    dailyArticlesCountRef.current = dailyArticlesCount;
  }, [dailyArticlesCount]);

  const handleIncrementDailyArticle = (
    voiceOverride?: string,
    styleOverride?: SpeechStyle,
    langOverride?: SpeechLanguage
  ) => {
    const today = getTodayDateString();
    const next = dailyArticlesCountRef.current + 1;
    setDailyArticlesCount(next);
    try {
      localStorage.setItem(
        'khmer_tts_daily_articles',
        JSON.stringify({ date: today, count: next })
      );
    } catch {}

    if (firebaseUser && firebaseUser.emailVerified) {
      void updateCloudQuota(firebaseUser.uid, today, next, {
        preferredVoice: voiceOverride || selectedVoice.id,
        preferredStyle: styleOverride || selectedStyle,
        preferredLanguage: langOverride || selectedLanguage,
      }).catch((err) => {
        console.error('Failed to sync quota to Firestore:', err);
      });
    }
  };

  const handleResetDailyArticles = () => {
    const today = getTodayDateString();
    setDailyArticlesCount(0);
    try {
      localStorage.setItem(
        'khmer_tts_daily_articles',
        JSON.stringify({ date: today, count: 0 })
      );
    } catch {}

    if (firebaseUser && firebaseUser.emailVerified) {
      void updateCloudQuota(firebaseUser.uid, today, 0).catch((err) => {
        console.error('Failed to reset cloud quota:', err);
      });
    }
  };

  // Voice, Language & Tone settings
  const [selectedLanguage, setSelectedLanguage] = useState<SpeechLanguage>('auto');
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>(VOICES[0]); // Default Kore (female)
  const [selectedStyle, setSelectedStyle] = useState<SpeechStyle>('natural');
  const [customInstruction, setCustomInstruction] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [text, setText] = useState('');

  const handleChangeLanguage = (lang: SpeechLanguage) => {
    setSelectedLanguage(lang);
  };

  // Status & Audio
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentSpeech, setCurrentSpeech] = useState<GeneratedSpeech | null>(null);
  const [copiedText, setCopiedText] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);

  // Unified Synthesis Progress Tracking
  const [processingProgress, setProcessingProgress] = useState<{
    current: number;
    total: number;
    percent: number;
    stage: string;
  } | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const isCancelledRef = useRef(false);

  // Document Upload & Story Extractor State
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isCleaningAI, setIsCleaningAI] = useState(false);
  const [docInfo, setDocInfo] = useState<{
    fileName: string;
    fileType: string;
    rawText: string;
    storyText: string;
    isStoryOnly: boolean;
  } | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then(async (res) => {
        if (!res.ok) return { hasApiKey: false };
        try {
          return await res.json();
        } catch {
          return { hasApiKey: false };
        }
      })
      .then((data) => {
        if (data && typeof data.hasApiKey === 'boolean') {
          setHasApiKey(data.hasApiKey);
        }
      })
      .catch(() => {});
  }, []);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // History state (stored in localStorage)
  const [history, setHistory] = useState<GeneratedSpeech[]>(() => {
    try {
      const saved = localStorage.getItem('khmer_tts_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('khmer_tts_history', JSON.stringify(history.slice(0, 15)));
    } catch {
      // storage quota
    }
  }, [history]);

  // Listen for Firebase Authentication changes and sync user profile
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);

      if (!user || !user.emailVerified) {
        setCloudSpeeches(null);
        hasRestoredCloudPrefsRef.current = false;
        return;
      }

      try {
        const profile = await syncUserProfileOnSignIn(user, dailyArticlesCountRef.current);
        if (profile) {
          const today = getTodayDateString();
          setDailyArticlesCount(profile.dailyCount);
          try {
            localStorage.setItem(
              'khmer_tts_daily_articles',
              JSON.stringify({ date: today, count: profile.dailyCount })
            );
          } catch {}
        }
      } catch (err) {
        console.error('Firebase user profile sync failed:', err);
      }
    });

    return () => unsubscribe();
  }, []);

  // Attach Firestore real-time listeners strictly after Auth is verified & ready
  useEffect(() => {
    if (!isAuthReady || !firebaseUser || !firebaseUser.emailVerified) return;

    const unsubProfile = subscribeToUserProfile(firebaseUser.uid, (profile) => {
      const today = getTodayDateString();
      setDailyArticlesCount(profile.dailyCount);
      try {
        localStorage.setItem(
          'khmer_tts_daily_articles',
          JSON.stringify({ date: today, count: profile.dailyCount })
        );
      } catch {}

      if (!hasRestoredCloudPrefsRef.current) {
        hasRestoredCloudPrefsRef.current = true;
        if (profile.preferredVoice) {
          const foundVoice = VOICES.find((v) => v.id === profile.preferredVoice);
          if (foundVoice) setSelectedVoice(foundVoice);
        }
        if (profile.preferredStyle) {
          setSelectedStyle(profile.preferredStyle);
        }
        if (profile.preferredLanguage) {
          setSelectedLanguage(profile.preferredLanguage);
        }
      }
    });

    const unsubSpeeches = subscribeToUserSpeeches(firebaseUser.uid, (records) => {
      setCloudSpeeches(records);
    });

    return () => {
      unsubProfile();
      unsubSpeeches();
    };
  }, [isAuthReady, firebaseUser]);

  const isCloudSignedIn = Boolean(firebaseUser && firebaseUser.emailVerified);

  // Merge cloud script history with cached local audio payloads
  const displayedHistory: GeneratedSpeech[] = React.useMemo(() => {
    if (!isCloudSignedIn || cloudSpeeches === null) {
      return history;
    }
    const localById = new Map<string, GeneratedSpeech>(history.map((item) => [item.id, item]));
    const cloudMerged = cloudSpeeches.map((cloudItem) => {
      const localMatch = localById.get(cloudItem.id);
      return {
        ...cloudItem,
        wavBase64: localMatch?.wavBase64 || '',
        mp3Base64: localMatch?.mp3Base64 || '',
        wavSize: localMatch?.wavSize || 0,
        mp3Size: localMatch?.mp3Size || 0,
        cloudSynced: true,
      };
    });
    const cloudIds = new Set(cloudMerged.map((item) => item.id));
    const localOnly = history.filter((item) => !cloudIds.has(item.id));
    return [...localOnly, ...cloudMerged].slice(0, 30);
  }, [isCloudSignedIn, cloudSpeeches, history]);

  const handleGoogleSignIn = async () => {
    setIsAuthLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      const code = err?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        console.error('Google Sign-In failed:', err);
        setErrorMessage('មិនអាចចូលគណនី Google បានទេ។ សូមពិនិត្យការកំណត់ Popup ឬព្យាយាមម្ដងទៀត។');
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleGoogleSignOut = async () => {
    setIsAuthLoading(true);
    try {
      await signOutUser();
      setCloudSpeeches(null);
      hasRestoredCloudPrefsRef.current = false;
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setIsAuthLoading(false);
    }
  };

  const persistGeneratedSpeech = (speech: GeneratedSpeech) => {
    setCurrentSpeech(speech);
    setHistory((prev) => [speech, ...prev.filter((item) => item.id !== speech.id)]);
    handleIncrementDailyArticle(selectedVoice.id, selectedStyle, selectedLanguage);

    if (firebaseUser && firebaseUser.emailVerified) {
      void saveSpeechToCloud(firebaseUser.uid, speech).catch((err) => {
        console.error('Failed to sync speech record to Firestore:', err);
      });
    }
  };

  const handleLoadScript = (speech: GeneratedSpeech) => {
    setActiveTab('tts');
    setText(speech.text);
    const matchedVoice = VOICES.find(
      (v) => v.id === speech.voice || v.nameKh === speech.voice || v.nameEn === speech.voice
    );
    if (matchedVoice) {
      setSelectedVoice(matchedVoice);
    }
    if (speech.style) {
      setSelectedStyle(speech.style);
    }
    if (speech.language) {
      setSelectedLanguage(speech.language);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteSpeech = (id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentSpeech?.id === id) {
      setCurrentSpeech(null);
    }
    if (firebaseUser && firebaseUser.emailVerified) {
      void deleteSpeechFromCloud(firebaseUser.uid, id).catch((err) => {
        console.error('Failed to delete cloud speech:', err);
      });
    }
  };

  const handleClearHistory = () => {
    const idsToDelete = displayedHistory.map((item) => item.id);
    setHistory([]);
    setCurrentSpeech(null);
    if (firebaseUser && firebaseUser.emailVerified && idsToDelete.length > 0) {
      void clearCloudSpeeches(firebaseUser.uid, idsToDelete).catch((err) => {
        console.error('Failed to clear cloud speeches:', err);
      });
    }
  };

  // Character and word counts
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charsPerSec = selectedLanguage === 'en' ? 15 : 18;
  const estimatedSeconds = charCount > 0 ? Math.max(1, Math.round(charCount / charsPerSec)) : 0;
  const estimatedMinutes = charCount > 0 ? Math.max(0.1, Number((charCount / charsPerSec / 60).toFixed(1))) : 0;

  // Handle Document Upload (Word .docx/.doc, PDF .pdf, and Text .txt)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    const validExtensions = ['.docx', '.doc', '.pdf', '.txt'];
    const isSupported = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!isSupported) {
      alert('សូមជ្រើសរើសឯកសារ Word (.docx, .doc), PDF (.pdf) ឬ Text (.txt)');
      return;
    }

    setIsParsingDoc(true);
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const { res, data } = await apiFetchJson(
        '/api/documents/parse',
        {
          method: 'POST',
          body: formData,
        },
        'បរាជ័យក្នុងការអានឯកសារ'
      );
      if (!res.ok) {
        throw new Error(data.error || 'បរាជ័យក្នុងការអានឯកសារ');
      }

      // Default to narrative story only (with scene tags and stage directions stripped)
      const storyText = (data.storyText || data.rawText).slice(0, 50000);
      setText(storyText);

      setDocInfo({
        fileName: data.fileName,
        fileType: data.fileType,
        rawText: data.rawText.slice(0, 50000),
        storyText,
        isStoryOnly: true,
      });

      if (data.originalCharCount > 50000) {
        alert('ឯកសាររបស់អ្នកមានប្រវែងលើស ៥០,០០០ តួអក្សរ។ ប្រព័ន្ធបានសម្រាំង និងកាត់ត្រឹម ៥០,០០០ តួអក្សរដំបូង។');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'កំហុសក្នុងការអានឯកសារ Word ឬ PDF');
    } finally {
      setIsParsingDoc(false);
      e.target.value = '';
    }
  };

  // Toggle between pure narrative story mode and raw complete text
  const handleToggleStoryMode = (storyOnly: boolean) => {
    if (!docInfo) return;
    setDocInfo({ ...docInfo, isStoryOnly: storyOnly });
    setText(storyOnly ? docInfo.storyText : docInfo.rawText);
  };

  // Extract pure storytelling prose using Gemini 2.5 Flash
  const handleCleanWithAI = async () => {
    if (!text.trim()) return;
    setIsCleaningAI(true);
    setErrorMessage(null);

    try {
      const { res, data } = await apiFetchJson(
        '/api/documents/extract-story-ai',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        },
        'បរាជ័យក្នុងការសម្រាំងសាច់រឿងដោយ AI'
      );
      if (!res.ok) {
        throw new Error(data.error || 'បរាជ័យក្នុងការសម្រាំងសាច់រឿងដោយ AI');
      }

      const aiStory = data.storyText.slice(0, 50000);
      setText(aiStory);

      if (docInfo) {
        setDocInfo({
          ...docInfo,
          storyText: aiStory,
          isStoryOnly: true,
        });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'កំហុសក្នុងការសម្រាំងសាច់រឿងដោយ AI');
    } finally {
      setIsCleaningAI(false);
    }
  };

  const handleCancelGeneration = () => {
    isCancelledRef.current = true;
    setIsLoading(false);
    setProcessingProgress(null);
    setRateLimitCountdown(null);
  };

  // Unified Text-to-Speech Generator (Single unified action for both short & long text up to 50,000 chars)
  const handleGenerateTTS = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim()) {
      setErrorMessage('សូមបញ្ចូលអត្ថបទរបស់អ្នកដែលចង់ឱ្យនិយាយ (ភាសាខ្មែរ ឬ English)');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    isCancelledRef.current = false;
    setRateLimitCountdown(null);

    const cleanInput = text.trim();

    try {
      // SCENARIO 1: SHORT TEXT (<= 1500 chars) -> Fast single-shot synthesis
      if (cleanInput.length <= 1500) {
        setProcessingProgress({
          current: 1,
          total: 1,
          percent: 60,
          stage: 'កំពុងបង្កើតសំឡេងនិយាយ...',
        });

        const { res, data } = await apiFetchJson(
          '/api/tts/generate',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: cleanInput,
              voice: selectedVoice.id,
              gender: selectedVoice.gender,
              style: selectedStyle,
              language: selectedLanguage,
              customInstruction: customInstruction.trim(),
            }),
          },
          'មានបញ្ហាក្នុងការបង្កើតសំឡេង'
        );
        if (!res.ok) {
          throw new Error(data.error || 'មានបញ្ហាក្នុងការបង្កើតសំឡេង');
        }

        const resolvedLang: SpeechLanguage =
          data.language === 'en' ? 'en' : data.language === 'bilingual' ? 'auto' : selectedLanguage;

        const newSpeech: GeneratedSpeech = {
          id: Date.now().toString(),
          text: cleanInput,
          voice: data.voice || selectedVoice.nameKh,
          gender: selectedVoice.gender,
          style: selectedStyle,
          language: resolvedLang,
          timestamp: Date.now(),
          durationSeconds: data.durationSeconds || estimatedSeconds,
          wavBase64: data.wavBase64,
          mp3Base64: data.mp3Base64,
          wavSize: data.wavSize || 0,
          mp3Size: data.mp3Size || 0,
        };

        persistGeneratedSpeech(newSpeech);
        return;
      }

      // SCENARIO 2: LONG TEXT (> 1500 chars, up to 50,000 chars / 15-30+ mins)
      // Automatically split into manageable chunks, synthesize sequentially, and merge into 1 master audio file
      setProcessingProgress({
        current: 0,
        total: 1,
        percent: 5,
        stage: 'កំពុងរៀបចំ និងបែងចែកកថាខណ្ឌអត្ថបទ...',
      });

      const { res: splitRes, data: splitData } = await apiFetchJson(
        '/api/tts/split-chunks',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: cleanInput, maxChunkLength: 1100, language: selectedLanguage }),
        },
        'មិនអាចបែងចែកកថាខណ្ឌអត្ថបទបានឡើយ'
      );
      if (!splitRes.ok) {
        throw new Error(splitData.error || 'មិនអាចបែងចែកកថាខណ្ឌអត្ថបទបានឡើយ');
      }

      if (!splitData.chunks || splitData.chunks.length === 0) {
        throw new Error('មិនអាចបែងចែកកថាខណ្ឌអត្ថបទបានឡើយ');
      }

      const chunks: { index: number; text: string; charCount: number; estimatedSeconds: number }[] = splitData.chunks;
      const wavBuffers: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        if (isCancelledRef.current) {
          throw new Error('ការបង្កើតសំឡេងត្រូវបានបោះបង់ដោយអ្នកប្រើប្រាស់');
        }

        const chunk = chunks[i];
        const progressPercent = Math.round(((i) / chunks.length) * 90);
        setProcessingProgress({
          current: i + 1,
          total: chunks.length,
          percent: progressPercent,
          stage: `កំពុងបម្លែងសំឡេង៖ ភាគទី ${i + 1} នៃ ${chunks.length} ភាគ (~${chunk.charCount} តួអក្សរ)...`,
        });

        // Synthesize chunk with automatic rate limit backoff & retry
        let retries = 0;
        const maxRetries = 8;
        let chunkWav: string | null = null;

        while (retries < maxRetries) {
          if (isCancelledRef.current) throw new Error('ការបង្កើតសំឡេងត្រូវបានបោះបង់');

          try {
            const { res, data } = await apiFetchJson(
              '/api/tts/generate',
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: chunk.text,
                  voice: selectedVoice.id,
                  gender: selectedVoice.gender,
                  style: selectedStyle,
                  language: selectedLanguage,
                  customInstruction: customInstruction.trim(),
                }),
              },
              'បរាជ័យក្នុងការបម្លែងភាគនេះ'
            );
            if (res.ok && data.wavBase64) {
              chunkWav = data.wavBase64;
              break;
            }

            const errMsg = data.error || '';
            const isRateLimit =
              res.status === 429 ||
              data.isRateLimit ||
              errMsg.includes('Rate limit') ||
              errMsg.includes('429') ||
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('សម្រាកល្បឿន');

            if (isRateLimit) {
              const cooldownSeconds = 18 + retries * 3;
              for (let s = cooldownSeconds; s > 0; s--) {
                if (isCancelledRef.current) throw new Error('ការបង្កើតសំឡេងត្រូវបានបោះបង់');
                setRateLimitCountdown(s);
                await new Promise((r) => setTimeout(r, 1000));
              }
              setRateLimitCountdown(null);
              retries++;
              continue;
            }

            throw new Error(errMsg || 'បរាជ័យក្នុងការបម្លែងភាគនេះ');
          } catch (err: any) {
            if (isCancelledRef.current) throw err;
            if (retries >= maxRetries - 1) throw err;
            retries++;
            await new Promise((r) => setTimeout(r, 3500));
          }
        }

        if (!chunkWav) {
          throw new Error(`បរាជ័យក្នុងការបម្លែងភាគទី ${i + 1}។ សូមព្យាយាមម្តងទៀត។`);
        }

        wavBuffers.push(chunkWav);

        // Safe pacing pause between chunks to protect API rate limit
        if (i < chunks.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      }

      // Step 3: Merge all WAV chunks instantly in browser (zero bandwidth upload, no 413 or 504 timeouts)
      setProcessingProgress({
        current: chunks.length,
        total: chunks.length,
        percent: 96,
        stage: 'កំពុងផ្គុំឯកសារសំឡេងពេញលេញ (Master Audio)...',
      });

      const masterWavBase64 = concatClientWavs(wavBuffers);
      if (!masterWavBase64) {
        throw new Error('បរាជ័យក្នុងការផ្គុំឯកសារសំឡេង');
      }

      const totalPcmBytes = atob(masterWavBase64).length - 44;
      const durationSeconds = Math.max(0.1, Number((totalPcmBytes / 48000).toFixed(2)));

      // Compute chunk-aligned subtitle cues scaled accurately to merged master duration
      const rawChunkDurations = wavBuffers.map((b64) =>
        Math.max(0.5, (atob(b64).length - 44) / 48000)
      );
      const rawSum = rawChunkDurations.reduce((a, b) => a + b, 0) || durationSeconds;
      const gapSeconds = 0.14;
      const totalGapSeconds = Math.max(0, (chunks.length - 1) * gapSeconds);
      const speechAudioBudget = Math.max(0.5, durationSeconds - totalGapSeconds);

      const subtitleCues: SubtitleCue[] = [];
      let cueCursor = 0;
      for (let i = 0; i < chunks.length; i++) {
        const scaledDur = (rawChunkDurations[i] / rawSum) * speechAudioBudget;
        subtitleCues.push(...buildCuesForSegment(chunks[i].text, scaledDur, cueCursor));
        cueCursor += scaledDur + (i < chunks.length - 1 ? gapSeconds : 0);
      }

      // Optional: If total size is reasonable (< 15MB), try requesting server MP3; if server times out, gracefully use master WAV
      let masterMp3Base64 = '';
      if (wavBuffers.length <= 6 && masterWavBase64.length < 15 * 1024 * 1024) {
        try {
          const { res: mergeRes, data: mergeData } = await apiFetchJson('/api/tts/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wavChunks: wavBuffers,
              text: cleanInput.slice(0, 150),
              voice: selectedVoice.nameKh,
              gender: selectedVoice.gender,
              style: selectedStyle,
            }),
          });
          if (mergeRes.ok && mergeData.mp3Base64) {
            masterMp3Base64 = mergeData.mp3Base64;
          }
        } catch (e) {
          console.warn('Server MP3 conversion skipped, using lossless WAV:', e);
        }
      }

      const masterSpeech: GeneratedSpeech = {
        id: Date.now().toString(),
        text: cleanInput,
        voice: selectedVoice.nameKh,
        gender: selectedVoice.gender,
        style: selectedStyle,
        language: selectedLanguage,
        timestamp: Date.now(),
        durationSeconds,
        wavBase64: masterWavBase64,
        mp3Base64: masterMp3Base64,
        wavSize: Math.round((masterWavBase64.length * 3) / 4),
        mp3Size: masterMp3Base64 ? Math.round((masterMp3Base64.length * 3) / 4) : 0,
        subtitleCues,
      };

      persistGeneratedSpeech(masterSpeech);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'មិនអាចបង្កើតសំឡេងបានទេ');
    } finally {
      setIsLoading(false);
      setProcessingProgress(null);
      setRateLimitCountdown(null);
    }
  };

  // Handle Generate Dialogue
  const handleGenerateDialogue = async (
    turns: DialogueTurn[],
    maleVoice: string,
    femaleVoice: string
  ) => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const { res, data } = await apiFetchJson(
        '/api/tts/dialogue',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            turns,
            speaker1Voice: maleVoice,
            speaker2Voice: femaleVoice,
            language: selectedLanguage,
          }),
        },
        'មានបញ្ហាក្នុងការបង្កើតកិច្ចសន្ទនា'
      );
      if (!res.ok) {
        throw new Error(data.error || 'មានបញ្ហាក្នុងការបង្កើតកិច្ចសន្ទនា');
      }

      const summaryText = turns.map((t) => `${t.speaker}: ${t.text}`).join(' | ');
      const speakerNames = Array.from(new Set(turns.map((t) => t.speaker))).join(', ');

      const newSpeech: GeneratedSpeech = {
        id: Date.now().toString(),
        text: summaryText,
        voice: speakerNames || `${maleVoice} & ${femaleVoice}`,
        gender: 'female',
        style: 'natural',
        language: selectedLanguage,
        timestamp: Date.now(),
        durationSeconds: data.durationSeconds || 5,
        wavBase64: data.wavBase64,
        mp3Base64: data.mp3Base64,
        wavSize: data.wavSize || 0,
        mp3Size: data.mp3Size || 0,
        isDialogue: true,
      };

      persistGeneratedSpeech(newSpeech);
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'មិនអាចបង្កើតកិច្ចសន្ទនាបានទេ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyPreset = (sample: (typeof SAMPLE_TEXTS)[0]) => {
    setText(sample.text);
    const foundVoice = VOICES.find((v) => v.id === sample.recommendedVoice);
    if (foundVoice) setSelectedVoice(foundVoice);
    setSelectedStyle(sample.recommendedStyle);
  };

  const handleCopyText = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  const handleClearText = () => {
    setText('');
  };

  const getStyleIcon = (iconName: string) => {
    switch (iconName) {
      case 'Megaphone':
        return <Megaphone className="w-3.5 h-3.5" />;
      case 'Headphones':
        return <Headphones className="w-3.5 h-3.5" />;
      case 'TrendingUp':
        return <TrendingUp className="w-3.5 h-3.5" />;
      case 'Radio':
        return <Radio className="w-3.5 h-3.5" />;
      case 'BookOpen':
        return <BookOpen className="w-3.5 h-3.5" />;
      case 'Smile':
        return <Smile className="w-3.5 h-3.5" />;
      case 'Feather':
        return <Feather className="w-3.5 h-3.5" />;
      case 'ShieldCheck':
        return <ShieldCheck className="w-3.5 h-3.5" />;
      default:
        return <Sparkles className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-between selection:bg-amber-500/30 selection:text-amber-200">
      {/* Top Banner & Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl overflow-hidden shadow-xl shadow-amber-500/20 border-2 border-amber-400/60 bg-slate-900 group-hover:scale-105 transition-transform duration-300">
                <img
                  src={rachttsLogo}
                  alt="rachtts.studio.kh Logo"
                  className="w-full h-full object-cover"
                />
              </div>
              <div
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-slate-950"
                title="Online & Ready"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 font-sans">
                  <span className="bg-gradient-to-r from-amber-300 via-amber-400 to-amber-200 bg-clip-text text-transparent">
                    rachtts.studio.kh
                  </span>
                </h1>
                <span className="text-[10px] font-semibold text-cyan-300 font-sans px-2 py-0.5 bg-cyan-950/60 border border-cyan-500/30 rounded-full">
                  TTS Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                បម្លែងអត្ថបទទៅជាសំឡេងនិយាយភាសាខ្មែរ &amp; English គាំទ្រដល់ ៥០,០០០ តួអក្សរ • MP3 &amp; WAV
              </p>
            </div>
          </div>

          {/* Feature Badges & Firebase Auth */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>អានបានដល់ ៥០,០០០ តួអក្សរ</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[11px] font-semibold">
              <span className="px-2 py-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-lg">
                MP3
              </span>
              <span className="px-2 py-1 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-lg">
                WAV
              </span>
            </div>

            {/* In-App PWA Install Button */}
            <PWAInstallButton />

            {/* Firebase Google Auth */}
            {isCloudSignedIn && firebaseUser ? (
              <div className="flex items-center gap-2 bg-slate-900/90 border border-cyan-500/30 rounded-xl px-2.5 py-1 shadow-sm">
                {firebaseUser.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt={firebaseUser.displayName || 'User'}
                    className="w-6 h-6 rounded-full border border-cyan-400/50 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-[10px] font-bold text-cyan-300">
                    {(firebaseUser.displayName || firebaseUser.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden md:block text-left leading-tight">
                  <div className="text-[11px] font-semibold text-slate-100 max-w-[110px] truncate">
                    {firebaseUser.displayName || 'User'}
                  </div>
                  <div className="text-[9px] text-cyan-400 flex items-center gap-0.5">
                    <Cloud className="w-2.5 h-2.5" />
                    <span>Cloud Sync</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogleSignOut}
                  disabled={isAuthLoading}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                  title="ចាកចេញពីគណនី (Sign Out)"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isAuthLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/35 hover:border-cyan-400/60 text-xs font-semibold transition-all shadow-sm disabled:opacity-50"
                title="ចូលគណនី Google ដើម្បីរក្សាទុកប្រវត្តិ និងកូតាក្នុង Cloud"
              >
                {isAuthLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogIn className="w-3.5 h-3.5" />
                )}
                <span>ចូលគណនី Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-4 py-6 sm:py-8 w-full flex-1 space-y-6">
        {/* Missing API Key Alert */}
        {hasApiKey === false && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-600/70 text-amber-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-2.5">
              <span className="text-amber-400 text-base">🔑</span>
              <div>
                <p className="font-semibold text-amber-300">ពុំទាន់បានកំណត់ GEMINI_API_KEY នៅឡើយទេ</p>
                <p className="text-xs text-amber-200/80 mt-0.5">
                  ដើម្បីបង្កើតសំឡេងបាន សូមបញ្ចូល GEMINI_API_KEY នៅក្នុង Render ➜ Environment (ឥតគិតថ្លៃ 100%)។
                </p>
              </div>
            </div>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs transition-all shadow-md flex items-center gap-1.5"
            >
              <span>យក Key ឥតគិតថ្លៃ</span>
              <span>↗</span>
            </a>
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/80 text-rose-200 text-sm flex items-start justify-between gap-3 shadow-lg">
            <div className="flex items-start gap-2.5">
              <span className="text-rose-400 text-base">⚠️</span>
              <div>
                <p className="font-semibold">កំហុសក្នុងការប្រតិបត្តិការ</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-xs text-rose-400 hover:text-white px-2 py-1 rounded bg-rose-900/40"
            >
              បិទ
            </button>
          </div>
        )}
        {/* 2 Main Studio Modes Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('tts')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'tts'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 shadow-md shadow-amber-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>បម្លែងអត្ថបទទៅជាសំឡេង (Text-to-Speech Studio)</span>
              <span className="text-[10px] px-2 py-0.5 bg-black/25 text-slate-950 font-bold rounded-full">
                ខ្លី & វែង ដល់ 50k
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dialogue')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                activeTab === 'dialogue'
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>កិច្ចសន្ទនាប្រុស-ស្រី (Dual-Speaker Dialogue)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="font-mono text-amber-400 font-bold">{charCount.toLocaleString()}</span>
            <span>/ 50,000 តួអក្សរ</span>
          </div>
        </div>

        {/* Speech Language Selector Bar (Khmer / English / Auto Bilingual) */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-3 sm:px-4 flex flex-wrap items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Globe className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-semibold text-slate-100 block">
                ជ្រើសរើសភាសានិយាយ (Speech Language)
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:block">
                គាំទ្រសំឡេងភាសាខ្មែរ ភាសាអង់គ្លេស (Native English) ឬលាយទាំងពីរភាសា
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => handleChangeLanguage('km')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedLanguage === 'km'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <span>🇰🇭</span>
              <span>ភាសាខ្មែរ (Khmer)</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeLanguage('en')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedLanguage === 'en'
                  ? 'bg-cyan-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <span>🇺🇸</span>
              <span>English (អង់គ្លេស)</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeLanguage('auto')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                selectedLanguage === 'auto'
                  ? 'bg-indigo-500 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <span>🌐</span>
              <span>ស្វ័យប្រវត្តិ (Auto / ខ្មែរ+EN)</span>
            </button>
          </div>
        </div>

        {/* Daily Quota Tracking Banner (10 full articles / day, 15 to 30 mins each) */}
        <div className="bg-gradient-to-r from-slate-900/95 via-slate-900/70 to-slate-900/95 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-lg shrink-0">
              📅
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs sm:text-sm font-bold text-white">
                  កូតាបង្កើតសំឡេងប្រចាំថ្ងៃ (Daily Studio Quota)
                </span>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold font-mono">
                  {dailyArticlesCount} / 10 អត្ថបទ
                </span>
                <span className="text-[11px] text-amber-300/90 font-medium">
                  • នៅសល់ {Math.max(0, 10 - dailyArticlesCount)} អត្ថបទថ្ងៃនេះ
                </span>
                {isCloudSignedIn && (
                  <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-semibold">
                    <Cloud className="w-3 h-3" />
                    <span>រក្សាទុកក្នុង Cloud</span>
                  </span>
                )}
                {dailyArticlesCount > 0 && (
                  <button
                    type="button"
                    onClick={handleResetDailyArticles}
                    className="text-[10px] text-slate-400 hover:text-amber-300 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-colors"
                    title="កំណត់ចំនួនអត្ថបទឡើងវិញជា ០"
                  >
                    កំណត់ឡើងវិញ (Reset)
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                គាំទ្ររហូតដល់ ១០ អត្ថបទពេញលេញក្នុង ១ថ្ងៃ (អត្ថបទនីមួយៗអាចមានប្រវែងពី ១៥ ទៅ ៣០+ នាទី ឬរហូតដល់ ៥០,០០០ តួអក្សរ)
              </p>
              <p className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                <span>💡</span>
                <span>ចំណាំ៖ ប្រសិនបើជួបសារ "Rate limit" នោះជាការសម្រាកល្បឿនបណ្តោះអាសន្នរបស់ Google ក្នុងមួយនាទី (RPM) មិនមែនអស់កូតាអត្ថបទឡើយ។</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 shrink-0">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                title={`អត្ថបទទី ${idx + 1}: ${idx < dailyArticlesCount ? 'បានបង្កើតរួច' : 'នៅទំនេរ'}`}
                className={`w-2.5 sm:w-3 h-5 sm:h-6 rounded-md transition-all ${
                  idx < dailyArticlesCount
                    ? 'bg-gradient-to-t from-amber-500 to-amber-300 shadow-sm shadow-amber-500/50'
                    : 'bg-slate-800/80 border border-slate-700/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Active Audio Player if any generated audio exists */}
        {currentSpeech && (
          <section className="animate-in fade-in slide-in-from-top-4 duration-300">
            <AudioPlayer speech={currentSpeech} />
          </section>
        )}

        {/* Global Voice Character Selection (Used for both Single and Long Text modes) */}
        {activeTab !== 'dialogue' && (
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl">
            <VoiceSelector
              selectedVoiceId={selectedVoice.id}
              onSelectVoice={(voice) => {
                setSelectedVoice(voice);
                if (voice.recommendedStyle) {
                  setSelectedStyle(voice.recommendedStyle);
                }
              }}
            />
          </section>
        )}

        {/* Global Speech Style / Emotion */}
        {activeTab !== 'dialogue' && (
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3">
            <label className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>រចនាប័ទ្មសំឡេង និងអារម្មណ៍ (Tone & Style)</span>
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STYLES.map((style) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/80 text-amber-200 shadow-sm'
                        : 'bg-slate-900/50 hover:bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 text-xs font-semibold">
                      {getStyleIcon(style.icon)}
                      <span className="truncate">{style.labelKh}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-sans block truncate">
                      {style.labelEn}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Advanced Guidance Toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>
                  {showAdvanced
                    ? 'លាក់ការកំណត់កម្រិតសំឡេងលម្អិត'
                    : 'ការណែនាំបន្ថែមលើសំឡេង (Optional Custom Guidance)'}
                </span>
              </button>

              {showAdvanced && (
                <div className="mt-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
                  <label className="text-xs text-slate-400 block mb-1">
                    សរសេរបញ្ជាក់ពីរបៀបបញ្ចេញសំឡេងបន្ថែម (ឧទាហរណ៍៖ និយាយយឺតៗច្បាស់ៗ, សំឡេងកក់ក្តៅ, លើកដាក់ចង្វាក់...)
                  </label>
                  <input
                    type="text"
                    value={customInstruction}
                    onChange={(e) => setCustomInstruction(e.target.value)}
                    placeholder="ឧ. និយាយយឺតៗ គួរសម និងបញ្ចេញសំឡេងច្បាស់ៗ"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Global Textarea with Upload button (for Single and Long Text) */}
        {activeTab !== 'dialogue' && (
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                <FileAudio className="w-4 h-4 text-amber-400" />
                <span>
                  {selectedLanguage === 'en'
                    ? 'អត្ថបទជាភាសាអង់គ្លេស - English Text (រហូតដល់ ៥០,០០០ តួអក្សរ)'
                    : selectedLanguage === 'auto'
                    ? 'អត្ថបទខ្មែរ ឬ English (រហូតដល់ ៥០,០០០ តួអក្សរ)'
                    : 'អត្ថបទជាភាសាខ្មែរ (រហូតដល់ ៥០,០០០ តួអក្សរ)'}
                </span>
              </label>

              {/* Upload file + Presets */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Hidden File Input (Word, PDF, TXT) */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".docx,.doc,.pdf,.txt"
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={isParsingDoc}
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600/30 to-indigo-600/30 hover:from-blue-600/40 hover:to-indigo-600/40 text-blue-200 border border-blue-500/40 flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50 font-medium"
                  title="ផ្ទុកឡើងឯកសារ Word (.docx, .doc), PDF (.pdf) ឬ Text (.txt) រហូតដល់ ៥០,០០០ តួអក្សរ"
                >
                  {isParsingDoc ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span>កំពុងអានឯកសារ...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      <span>ផ្ទុកឯកសារ Word / PDF / TXT</span>
                    </>
                  )}
                </button>

                {/* Presets */}
                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-slate-500 mr-0.5">គំរូសាកល្បង៖</span>
                  {SAMPLE_TEXTS.filter(
                    (sample) => selectedLanguage === 'auto' || sample.language === selectedLanguage
                  ).map((sample) => (
                    <button
                      key={sample.title}
                      type="button"
                      onClick={() => handleApplyPreset(sample)}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors"
                    >
                      {sample.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Document Info & Story Mode Bar */}
            {docInfo && (
              <div className="p-3 rounded-xl bg-indigo-950/30 border border-indigo-900/50 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-sm">📄</span>
                  <div>
                    <span className="font-semibold text-indigo-200">{docInfo.fileName}</span>
                    <span className="text-[10px] text-indigo-300/70 ml-2 bg-indigo-900/40 px-2 py-0.5 rounded-full border border-indigo-700/40">
                      {docInfo.fileType}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Story Only Mode Toggle */}
                  <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => handleToggleStoryMode(true)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        docInfo.isStoryOnly
                          ? 'bg-amber-500 text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="អានតែសាច់រឿងសុទ្ធ (លុបចោលឈុតរឿង វគ្គ លេខទំព័រ និងការណែនាំឆាក)"
                    >
                      <span>✨ ស្គាល់តែសាច់រឿង (Story Only)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleStoryMode(false)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        !docInfo.isStoryOnly
                          ? 'bg-slate-800 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                      title="បង្ហាញអត្ថបទទាំងមូលពីឯកសារដើម"
                    >
                      <span>ឯកសារដើម (Full)</span>
                    </button>
                  </div>

                  {/* AI Story Clean Button */}
                  <button
                    type="button"
                    disabled={isCleaningAI}
                    onClick={handleCleanWithAI}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                    title="ប្រើ AI (Gemini 2.5 Flash) ដើម្បីសម្រាំងយកតែសាច់រឿងនិទានសុទ្ធសាធ"
                  >
                    {isCleaningAI ? (
                      <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Wand2 className="w-3 h-3 text-amber-400" />
                    )}
                    <span>សម្រាំងដោយ AI</span>
                  </button>

                  {/* Close Document */}
                  <button
                    type="button"
                    onClick={() => setDocInfo(null)}
                    className="text-slate-500 hover:text-rose-400 px-1.5 py-1 rounded hover:bg-rose-500/10 transition-colors"
                    title="បិទព័ត៌មានឯកសារ"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}

            {/* Textarea */}
            <div className="relative">
              <textarea
                rows={charCount > 1200 ? 8 : 6}
                value={text}
                maxLength={50000}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  selectedLanguage === 'en'
                    ? 'Type or paste your English text here (supports up to 50,000 characters for articles, audiobooks, stories, or scripts)...'
                    : 'សូមវាយ ឬបិទភ្ជាប់ (Paste) អត្ថបទភាសាខ្មែរ ឬ English នៅទីនេះ (គាំទ្ររហូតដល់ ៥០,០០០ តួអក្សរ)...'
                }
                className="w-full bg-slate-950/90 border border-slate-800 rounded-xl p-4 text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all font-khmer leading-relaxed resize-y min-h-[160px]"
              />

              {/* Actions below textarea */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-slate-200 font-semibold">
                    {charCount.toLocaleString()} / 50,000 តួអក្សរ
                  </span>
                  <span className="text-slate-500">•</span>
                  <span>{wordCount.toLocaleString()} ពាក្យ</span>
                  <span className="text-slate-500">•</span>
                  <span>រយៈពេលប្រហាក់ប្រហែល: ~{estimatedMinutes} នាទី ({estimatedSeconds}s)</span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!text.trim()}
                    onClick={() =>
                      downloadSrtFile({
                        text,
                        durationSeconds:
                          currentSpeech && currentSpeech.text === text.trim()
                            ? currentSpeech.durationSeconds
                            : Math.max(1, estimatedSeconds),
                        cues:
                          currentSpeech && currentSpeech.text === text.trim()
                            ? currentSpeech.subtitleCues
                            : undefined,
                      })
                    }
                    className="hover:text-cyan-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="ទាញយកអត្ថបទនេះជាឯកសារអក្សររត់ (.srt)"
                  >
                    <Captions className="w-3.5 h-3.5 text-cyan-400" />
                    <span>ទាញ SRT</span>
                  </button>
                  <button
                    type="button"
                    disabled={!text.trim()}
                    onClick={() =>
                      void downloadWordFile({
                        text,
                        voice: selectedVoice.nameKh,
                        styleLabel: STYLES.find((s) => s.id === selectedStyle)?.labelKh || selectedStyle,
                        durationSeconds:
                          currentSpeech && currentSpeech.text === text.trim()
                            ? currentSpeech.durationSeconds
                            : estimatedSeconds,
                      })
                    }
                    className="hover:text-indigo-300 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    title="ទាញយកអត្ថបទនេះជាឯកសារ Word (.docx)"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ទាញ Word</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyText}
                    className="hover:text-slate-200 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    title="ចម្លងអត្ថបទ"
                  >
                    {copiedText ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">បានចម្លង</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>ចម្លង</span>
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearText}
                    className="hover:text-rose-400 flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-slate-800"
                    title="សម្អាតអត្ថបទ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>សម្អាត</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Unified One-Click Synthesis (Adaptive for both short & long text up to 50k chars with NO chunk list) */}
            {activeTab === 'tts' && (
              <div className="space-y-4 pt-3 border-t border-slate-800/80">
                {/* Generation Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span>សំឡេងដែលបានជ្រើស៖ </span>
                    <span className="font-semibold text-slate-200">
                      {selectedVoice.nameKh} ({selectedVoice.gender === 'female' ? 'សំឡេងស្រី' : 'សំឡេងប្រុស'})
                    </span>
                    <span className="text-slate-600 hidden sm:inline">•</span>
                    <span className="text-amber-400 font-medium">
                      {charCount <= 1500
                        ? `អត្ថបទខ្លី (~${charCount.toLocaleString()} តួអក្សរ)`
                        : `អត្ថបទវែង (~${charCount.toLocaleString()} តួអក្សរ • ~${estimatedMinutes} នាទី)`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isLoading && (
                      <button
                        type="button"
                        onClick={handleCancelGeneration}
                        className="px-3.5 py-2.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs font-semibold transition-colors"
                      >
                        បោះបង់ (Cancel)
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleGenerateTTS()}
                      disabled={isLoading || !text.trim()}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-sm shadow-xl shadow-amber-500/20 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                          <span>កំពុងបង្កើតសំឡេងនិយាយ...</span>
                        </>
                      ) : (
                        <>
                          <Mic className="w-4 h-4 text-slate-950" />
                          <span>
                            បម្លែងទៅជាសំឡេងនិយាយ (
                            {charCount > 1500 ? `~${estimatedMinutes} នាទី` : `~${estimatedSeconds}s`}
                            )
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Unified Live Progress Bar (NO individual chunk cards - pure master output) */}
                {isLoading && (
                  <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-2.5 shadow-lg animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="font-semibold text-amber-300">
                          {processingProgress?.stage || 'កំពុងបង្កើតសំឡេងនិយាយ...'}
                        </span>
                      </div>
                      <span className="font-mono text-slate-300 font-bold">
                        {processingProgress?.percent || 10}%
                        {processingProgress && processingProgress.total > 1 && (
                          <span className="text-amber-400 ml-1.5">
                            (ភាគទី {processingProgress.current} នៃ {processingProgress.total})
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-300 transition-all duration-300 rounded-full"
                        style={{ width: `${Math.max(5, processingProgress?.percent || 10)}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                      <span>
                        ដំណើរការបម្លែង និងផ្គុំជាឯកសារ MP3 & WAV ពេញលេញតែមួយដោយស្វ័យប្រវត្តិតាមវណ្ណយុត្តិខណ្ឌ
                      </span>
                      {rateLimitCountdown !== null && (
                        <span className="text-amber-300 font-medium animate-pulse flex items-center gap-1">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>សម្រាកសុវត្ថិភាព Rate limit: {rateLimitCountdown} វិនាទី...</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* TAB 3: DUAL-SPEAKER DIALOGUE */}
        {activeTab === 'dialogue' && (
          <section className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-400" />
                <span>បង្កើតកិច្ចសន្ទនាប្រុស-ស្រីជាសំឡេង (Dual-Speaker Dialogue)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                បច្ចេកវិទ្យា Gemini 3.8 Flash TTS គាំទ្រការសន្ទនាឆ្លើយឆ្លងគ្នារវាងតួអង្គប្រុស និងស្រីក្នុងឯកសារសំឡេងតែមួយ
              </p>
            </div>

            <DialogueMode
              language={selectedLanguage}
              isLoading={isLoading}
              onGenerateDialogue={handleGenerateDialogue}
            />
          </section>
        )}

        {/* History Drawer */}
        <section className="pt-4">
          <HistoryDrawer
            history={displayedHistory}
            onSelectSpeech={(speech) => setCurrentSpeech(speech)}
            onLoadScript={handleLoadScript}
            onDeleteSpeech={handleDeleteSpeech}
            onClearHistory={handleClearHistory}
            activeSpeechId={currentSpeech?.id}
            isCloudSignedIn={isCloudSignedIn}
          />
        </section>

        {/* Educational Info on Khmer 50,000 Chars & Audio Quality */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-sm">
              <BookMarked className="w-4 h-4 text-amber-400" />
              <span>ការអាន ៥០,០០០ តួអក្សរ</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              ប្រព័ន្ធធ្វើការបែងចែកអត្ថបទធំដោយស្វ័យប្រវត្តិតាមវណ្ណយុត្តិខណ្ឌ <strong className="text-amber-300">៕</strong> និង <strong className="text-amber-300">។</strong> ទៅជាភាគៗ ហើយផ្គុំជាឯកសារ MP3 & WAV ពេញលេញតែមួយ។
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-sm">
              <Users className="w-4 h-4 text-rose-400" />
              <span>សំឡេងប្រុស និងស្រី</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              ជ្រើសរើសសំឡេងស្រីស្រទន់ (Kore, Zephyr) ឬសំឡេងប្រុសច្បាស់មានថាមពល (Puck, Charon, Fenrir) សម្រាប់ការអានសៀវភៅ ឬព័ត៌មានវែងៗ។
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs text-slate-400 space-y-2">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-sm">
              <Download className="w-4 h-4 text-emerald-400" />
              <span>ទាញយក MP3 & WAV</span>
            </h4>
            <p className="text-slate-400 leading-relaxed">
              អាចទាញយកជាភាគៗ ឬទាញយកឯកសារមេពេញលេញ (Master Audio) ជា MP3 192k ឬ WAV 24kHz Lossless តាមតម្រូវការ។
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-950/80 py-5 mt-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2.5">
            <img
              src={rachttsLogo}
              alt="Logo"
              className="w-6 h-6 rounded-lg object-cover border border-amber-500/40"
            />
            <p>
              © {new Date().getFullYear()} <strong className="text-slate-200 font-sans">rachtts.studio.kh</strong> • សំឡេងខ្មែរ AI TTS Studio
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-slate-400">
            <a
              href="/api/download-project"
              download="rachtts-studio-code.zip"
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-850 text-amber-300 border border-slate-800 text-xs font-medium hover:border-amber-500/40 transition-colors shadow-sm"
              title="ទាញយកកូដគម្រោងទាំងអស់ជា ZIP ដើម្បីដាក់ចូល GitHub"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>ទាញយកកូដគម្រោង (Project ZIP)</span>
            </a>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">គាំទ្រ ៥០,០០០ តួអក្សរ</span>
            <span className="text-slate-600">•</span>
            <span className="text-slate-500">MP3 & WAV</span>
          </div>
        </div>
      </footer>

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
