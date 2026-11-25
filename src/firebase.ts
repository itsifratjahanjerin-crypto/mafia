import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { AvatarId } from './shared/types.ts';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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

export function formatFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): { friendlyMessage: string; serialized: string } {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
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
  const serialized = JSON.stringify(errInfo);
  console.error('Firestore Error: ', serialized);

  let friendlyMessage = 'Unable to sync account data right now.';
  if (rawMessage.includes('Quota exceeded')) {
    friendlyMessage = 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow.';
  } else if (rawMessage.includes('Missing or insufficient permissions')) {
    friendlyMessage =
      'Account permission check failed. Please sign out and sign in again with a verified Google account.';
  } else if (rawMessage.includes('the client is offline') || rawMessage.includes('unavailable')) {
    friendlyMessage = 'Database connection temporarily unavailable. Check your internet connection.';
  }

  return { friendlyMessage, serialized };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const { serialized } = formatFirestoreError(error, operationType, path);
  throw new Error(serialized);
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

// ------------------------------------------------------------------
// Blueprint-Synchronized Sanitization & Regex Constants
// ------------------------------------------------------------------
export const BLUEPRINT_LIMITS = {
  DISPLAY_NAME_MAX: 24,
  ROOM_NAME_MAX: 40,
  ROOM_CODE_MAX: 12,
  FRIEND_CODE_MAX: 16,
  ROLE_NAME_MAX: 32,
  ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
  FRIEND_CODE_REGEX: /^[A-Z0-9\-]+$/,
  ROOM_CODE_REGEX: /^[A-Z0-9]+$/,
} as const;

const VALID_AVATARS: readonly AvatarId[] = [
  'lantern',
  'fedora',
  'magnifying',
  'shield',
  'rose',
  'pocketwatch',
  'key',
  'raven',
  'compass',
  'quill',
  'chalice',
  'mask',
];

export function sanitizeDisplayName(raw: string, fallback = 'Player'): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function sanitizeRoomName(raw: string, fallback = 'Midnight Parlor'): string {
  const cleaned = raw.trim().replace(/\s+/g, ' ').slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX);
  return cleaned.length >= 1 ? cleaned : fallback;
}

export function sanitizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, BLUEPRINT_LIMITS.ROOM_CODE_MAX);
}

export function sanitizeFriendCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-]/g, '')
    .slice(0, BLUEPRINT_LIMITS.FRIEND_CODE_MAX);
}

export function sanitizeAvatarId(raw: string | null | undefined): AvatarId {
  if (raw && VALID_AVATARS.includes(raw as AvatarId)) {
    return raw as AvatarId;
  }
  return 'fedora';
}

export function generateFriendCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `MAF-${suffix}`;
}
