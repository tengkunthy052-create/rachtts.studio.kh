import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { GeneratedSpeech, SpeechLanguage, SpeechStyle, VoiceGender } from './types';

// Initialize Firebase App, Auth, and Firestore (explicitly passing provisioned firestoreDatabaseId)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Blueprint-synchronized validation constants
export const BLUEPRINT_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
export const BLUEPRINT_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_TEXT_LENGTH = 50000;
export const MAX_TITLE_LENGTH = 160;
export const MAX_VOICE_LENGTH = 100;
export const MAX_DISPLAY_NAME_LENGTH = 120;
export const MAX_PHOTO_URL_LENGTH = 500;
export const MAX_EMAIL_LENGTH = 254;

const VALID_STYLES: SpeechStyle[] = [
  'natural',
  'marketing',
  'podcast',
  'analyst',
  'news',
  'story',
  'cheerful',
  'calm',
  'formal',
];
const VALID_LANGUAGES: SpeechLanguage[] = ['km', 'en', 'auto'];
const VALID_GENDERS: VoiceGender[] = ['female', 'male'];

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate live connection to Firestore on startup
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

export function sanitizeId(raw: string): string {
  const cleaned = (raw || '').replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  return cleaned || `id_${Date.now()}`;
}

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function signInWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

export interface CloudUserProfileData {
  dailyDate: string;
  dailyCount: number;
  preferredVoice?: string;
  preferredStyle?: SpeechStyle;
  preferredLanguage?: SpeechLanguage;
}

/**
 * Ensures `/users/{uid}` and isolated PII `/users/{uid}/private/info` exist cleanly
 * in strict compliance with firebase-blueprint.json & firestore.rules.
 */
export async function syncUserProfileOnSignIn(
  user: User,
  localDailyCount = 0
): Promise<CloudUserProfileData | null> {
  if (!user.uid || !user.emailVerified) return null;

  const uid = sanitizeId(user.uid);
  const today = getTodayDateString();
  const displayName = (user.displayName || 'User').trim().slice(0, MAX_DISPLAY_NAME_LENGTH) || 'User';
  const email = (user.email || '').trim().slice(0, MAX_EMAIL_LENGTH);
  const photoURL =
    typeof user.photoURL === 'string' && user.photoURL.trim().length > 0
      ? user.photoURL.trim().slice(0, MAX_PHOTO_URL_LENGTH)
      : undefined;

  const userRef = doc(db, 'users', uid);
  const privateRef = doc(db, 'users', uid, 'private', 'info');
  const userPath = `users/${uid}`;
  const privatePath = `users/${uid}/private/info`;

  let existingSnap;
  try {
    existingSnap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!existingSnap.exists()) {
    const safeCount = Math.max(0, Math.min(1000, Math.floor(localDailyCount)));
    const batch = writeBatch(db);
    const profilePayload: Record<string, any> = {
      uid,
      displayName,
      dailyDate: today,
      dailyCount: safeCount,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (photoURL) {
      profilePayload.photoURL = photoURL;
    }

    batch.set(userRef, profilePayload);

    if (email.length >= 3) {
      batch.set(privateRef, {
        uid,
        email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    return { dailyDate: today, dailyCount: safeCount };
  }

  // Existing profile: refresh displayName/photoURL cleanly (Action 2 keys only)
  const profileUpdates: Record<string, any> = {
    displayName,
    updatedAt: serverTimestamp(),
  };
  if (photoURL) {
    profileUpdates.photoURL = photoURL;
  }

  try {
    await updateDoc(userRef, profileUpdates);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }

  if (email.length >= 3) {
    try {
      const privateSnap = await getDoc(privateRef);
      if (!privateSnap.exists()) {
        await setDoc(privateRef, {
          uid,
          email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else if (privateSnap.data()?.email !== email) {
        await updateDoc(privateRef, {
          email,
          updatedAt: serverTimestamp(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, privatePath);
    }
  }

  const data = existingSnap.data();
  const cloudDate = typeof data?.dailyDate === 'string' && BLUEPRINT_DATE_REGEX.test(data.dailyDate)
    ? data.dailyDate
    : today;
  const cloudCount =
    cloudDate === today && typeof data?.dailyCount === 'number'
      ? Math.max(0, Math.min(1000, data.dailyCount))
      : 0;

  return {
    dailyDate: today,
    dailyCount: cloudCount,
    preferredVoice: typeof data?.preferredVoice === 'string' ? data.preferredVoice : undefined,
    preferredStyle: VALID_STYLES.includes(data?.preferredStyle) ? data.preferredStyle : undefined,
    preferredLanguage: VALID_LANGUAGES.includes(data?.preferredLanguage)
      ? data.preferredLanguage
      : undefined,
  };
}

export async function updateCloudQuota(
  uidRaw: string,
  dailyDate: string,
  dailyCount: number,
  prefs?: {
    preferredVoice?: string;
    preferredStyle?: SpeechStyle;
    preferredLanguage?: SpeechLanguage;
  }
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const safeDate = BLUEPRINT_DATE_REGEX.test(dailyDate) ? dailyDate : getTodayDateString();
  const safeCount = Math.max(0, Math.min(1000, Math.floor(dailyCount)));
  const path = `users/${uid}`;

  const payload: Record<string, any> = {
    dailyDate: safeDate,
    dailyCount: safeCount,
    updatedAt: serverTimestamp(),
  };

  if (prefs?.preferredVoice) {
    payload.preferredVoice = prefs.preferredVoice.slice(0, 40);
  }
  if (prefs?.preferredStyle && VALID_STYLES.includes(prefs.preferredStyle)) {
    payload.preferredStyle = prefs.preferredStyle;
  }
  if (prefs?.preferredLanguage && VALID_LANGUAGES.includes(prefs.preferredLanguage)) {
    payload.preferredLanguage = prefs.preferredLanguage;
  }

  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveSpeechToCloud(
  uidRaw: string,
  speech: GeneratedSpeech
): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const speechId = sanitizeId(speech.id);
  const path = `users/${uid}/speeches/${speechId}`;

  const cleanText = (speech.text || '').trim().slice(0, MAX_TEXT_LENGTH);
  if (!cleanText) return;

  const rawTitle = cleanText
    .replace(/[\r\n\t]+/g, ' ')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

  const safeStyle: SpeechStyle = VALID_STYLES.includes(speech.style) ? speech.style : 'natural';
  const safeLang: SpeechLanguage =
    speech.language && VALID_LANGUAGES.includes(speech.language) ? speech.language : 'auto';
  const safeGender: VoiceGender = VALID_GENDERS.includes(speech.gender) ? speech.gender : 'female';
  const safeVoice = (speech.voice || 'Kore').trim().slice(0, MAX_VOICE_LENGTH) || 'Kore';
  const safeDuration = Math.max(
    0,
    Math.min(86400, Number.isFinite(speech.durationSeconds) ? speech.durationSeconds : 0)
  );

  try {
    await setDoc(doc(db, 'users', uid, 'speeches', speechId), {
      id: speechId,
      userId: uid,
      title: rawTitle || 'Untitled Speech',
      text: cleanText,
      voice: safeVoice,
      gender: safeGender,
      style: safeStyle,
      language: safeLang,
      durationSeconds: safeDuration,
      isDialogue: Boolean(speech.isDialogue),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteSpeechFromCloud(uidRaw: string, speechIdRaw: string): Promise<void> {
  const uid = sanitizeId(uidRaw);
  const speechId = sanitizeId(speechIdRaw);
  const path = `users/${uid}/speeches/${speechId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'speeches', speechId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearCloudSpeeches(uidRaw: string, speechIds: string[]): Promise<void> {
  if (!speechIds.length) return;
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}/speeches`;
  const batch = writeBatch(db);
  for (const rawId of speechIds.slice(0, 100)) {
    const sid = sanitizeId(rawId);
    batch.delete(doc(db, 'users', uid, 'speeches', sid));
  }
  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserProfile(
  uidRaw: string,
  onUpdate: (profile: CloudUserProfileData) => void
): Unsubscribe {
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      const today = getTodayDateString();
      const cloudDate =
        typeof data?.dailyDate === 'string' && BLUEPRINT_DATE_REGEX.test(data.dailyDate)
          ? data.dailyDate
          : today;
      const cloudCount =
        cloudDate === today && typeof data?.dailyCount === 'number'
          ? Math.max(0, Math.min(1000, data.dailyCount))
          : 0;
      onUpdate({
        dailyDate: today,
        dailyCount: cloudCount,
        preferredVoice: typeof data?.preferredVoice === 'string' ? data.preferredVoice : undefined,
        preferredStyle: VALID_STYLES.includes(data?.preferredStyle)
          ? data.preferredStyle
          : undefined,
        preferredLanguage: VALID_LANGUAGES.includes(data?.preferredLanguage)
          ? data.preferredLanguage
          : undefined,
      });
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToUserSpeeches(
  uidRaw: string,
  onUpdate: (records: GeneratedSpeech[]) => void
): Unsubscribe {
  const uid = sanitizeId(uidRaw);
  const path = `users/${uid}/speeches`;
  const q = query(collection(db, 'users', uid, 'speeches'), orderBy('createdAt', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: GeneratedSpeech[] = snapshot.docs.map((d) => {
        const data = d.data();
        const tsMillis =
          data.createdAt && typeof data.createdAt.toMillis === 'function'
            ? data.createdAt.toMillis()
            : Date.now();
        return {
          id: typeof data.id === 'string' ? data.id : d.id,
          text: typeof data.text === 'string' ? data.text : '',
          voice: typeof data.voice === 'string' ? data.voice : 'Kore',
          gender: VALID_GENDERS.includes(data.gender) ? data.gender : 'female',
          style: VALID_STYLES.includes(data.style) ? data.style : 'natural',
          language: VALID_LANGUAGES.includes(data.language) ? data.language : 'auto',
          timestamp: tsMillis,
          durationSeconds: typeof data.durationSeconds === 'number' ? data.durationSeconds : 0,
          wavBase64: '',
          mp3Base64: '',
          wavSize: 0,
          mp3Size: 0,
          isDialogue: Boolean(data.isDialogue),
        };
      });
      onUpdate(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}
