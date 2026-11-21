export type VoiceGender = 'female' | 'male';

export type SpeechLanguage = 'km' | 'en' | 'auto';

export interface VoiceOption {
  id: string; // 'Kore' | 'Zephyr' | 'Puck' | 'Charon' | 'Fenrir' | 'Orus' | 'Aoede' | 'Gacrux' | 'Schedar' | 'Leda' | 'Alnilam' | 'Sulafat'
  gender: VoiceGender;
  nameKh: string;
  nameEn: string;
  descKh: string;
  badge: string;
  avatarColor: string;
  recommendedStyle?: SpeechStyle;
}

export type SpeechStyle =
  | 'natural'
  | 'marketing'
  | 'podcast'
  | 'analyst'
  | 'news'
  | 'story'
  | 'cheerful'
  | 'calm'
  | 'formal';

export interface StyleOption {
  id: SpeechStyle;
  labelKh: string;
  labelEn: string;
  descKh: string;
  icon: string;
}

export interface SubtitleCue {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

export interface GeneratedSpeech {
  id: string;
  text: string;
  voice: string;
  gender: VoiceGender;
  style: SpeechStyle;
  language?: SpeechLanguage;
  timestamp: number;
  durationSeconds: number;
  wavBase64: string;
  mp3Base64: string;
  wavSize: number;
  mp3Size: number;
  isDialogue?: boolean;
  cloudSynced?: boolean;
  subtitleCues?: SubtitleCue[];
}

export type DialogueCharacterId =
  | 'ក្មេងប្រុស'
  | 'ក្មេងស្រី'
  | 'មនុស្សចាស់ប្រុស'
  | 'មនុស្សចាស់ស្រី'
  | 'ប្រុស'
  | 'ស្រី'
  | 'ពិធីករ Podcast'
  | 'អ្នកវិភាគ';

export interface DialogueCharacter {
  id: DialogueCharacterId;
  labelKh: string;
  nameEn: string;
  icon: string;
  badge: string;
  defaultVoice: string;
  colorClass: string;
  bgClass: string;
}

export interface DialogueTurn {
  id: string;
  speaker: DialogueCharacterId | string;
  voice?: string;
  text: string;
}

export interface DocumentParseResult {
  fileName: string;
  fileType: string;
  rawText: string;
  storyText: string;
  charCount: number;
  originalCharCount: number;
}

export interface TextChunk {
  index: number;
  text: string;
  charCount: number;
  estimatedSeconds: number;
  status: 'idle' | 'loading' | 'completed' | 'error';
  wavBase64?: string;
  mp3Base64?: string;
  durationSeconds?: number;
  error?: string;
}
