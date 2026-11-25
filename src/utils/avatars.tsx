import React, { useState } from 'react';
import { Crown, Shield } from 'lucide-react';
import type { AvatarId } from '../shared/types.ts';

export const AVATAR_OPTIONS: { id: AvatarId; label: string }[] = [
  { id: 'lantern', label: 'Agent' },
  { id: 'fedora', label: 'Syndicate' },
  { id: 'magnifying', label: 'Inspector' },
  { id: 'shield', label: 'Guardian' },
  { id: 'rose', label: 'Crimson' },
  { id: 'pocketwatch', label: 'Broker' },
  { id: 'key', label: 'Locksmith' },
  { id: 'raven', label: 'Shadow' },
  { id: 'compass', label: 'Navigator' },
  { id: 'quill', label: 'Chronicler' },
  { id: 'chalice', label: 'Socialite' },
  { id: 'mask', label: 'Phantom' },
];

export const TITLE_BACKDROP_URL =
  '/src/assets/images/title_parlor_backdrop_1795616774379.jpg';

export const PARLOR_TABLE_URL =
  '/src/assets/images/mafia_parlor_table_1795618672733.jpg';

export const RAINY_PARLOR_URL =
  '/src/assets/images/mafia_rainy_parlor_1795618673082.jpg';

export const ROLE_CARD_IMAGES: Record<string, string> = {
  Mafia: '/src/assets/images/role_card_mafia_1795616774815.jpg',
  Detective: '/src/assets/images/role_card_detective_1795616775649.jpg',
  Bodyguard: '/src/assets/images/role_card_bodyguard_1795616775293.jpg',
  Villager: '/src/assets/images/role_card_villager_1795616775837.jpg',
};

const AVATAR_PALETTES: Record<
  AvatarId,
  { bg1: string; bg2: string; coat: string; skin: string; hat?: string; hair: string; tie: string }
> = {
  lantern: { bg1: '#1E293B', bg2: '#0F172A', coat: '#334155', skin: '#E2B89B', hair: '#1E1B18', tie: '#F59E0B' },
  fedora: { bg1: '#3B0D14', bg2: '#14080C', coat: '#1E2430', skin: '#D9A78A', hat: '#27272A', hair: '#18181B', tie: '#DC2626' },
  magnifying: { bg1: '#172554', bg2: '#0B1120', coat: '#3F2E21', skin: '#E8C3A8', hat: '#4A3728', hair: '#292018', tie: '#38BDF8' },
  shield: { bg1: '#0C2D48', bg2: '#091526', coat: '#1E3A5F', skin: '#D4A383', hair: '#1F2937', tie: '#60A5FA' },
  rose: { bg1: '#4C0519', bg2: '#1A0610', coat: '#311020', skin: '#F0C7B1', hair: '#2D161E', tie: '#F43F5E' },
  pocketwatch: { bg1: '#292524', bg2: '#0C0A09', coat: '#44403C', skin: '#C68B6B', hair: '#1C1917', tie: '#EAB308' },
  key: { bg1: '#164E63', bg2: '#08202B', coat: '#1E293B', skin: '#E6BFA5', hair: '#451A03', tie: '#2DD4BF' },
  raven: { bg1: '#1E1B4B', bg2: '#09091A', coat: '#18181B', skin: '#DDB49B', hat: '#18181B', hair: '#09090B', tie: '#A78BFA' },
  compass: { bg1: '#064E3B', bg2: '#041C16', coat: '#1F2937', skin: '#D5A07D', hair: '#27272A', tie: '#34D399' },
  quill: { bg1: '#312E81', bg2: '#0F102B', coat: '#334155', skin: '#F1CBB5', hair: '#78350F', tie: '#FBBF24' },
  chalice: { bg1: '#701A75', bg2: '#1C0720', coat: '#3B0764', skin: '#E8BC9F', hair: '#1E1B18', tie: '#E879F9' },
  mask: { bg1: '#3F3F46', bg2: '#121216', coat: '#27272A', skin: '#D8A689', hat: '#18181B', hair: '#09090B', tie: '#EF4444' },
};

export function AvatarEmblem({
  avatar,
  isGM,
  isAlive = true,
  size = 'md',
}: {
  avatar: AvatarId;
  isGM?: boolean;
  isAlive?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const dims =
    size === 'sm'
      ? 'w-8 h-8'
      : size === 'lg'
        ? 'w-14 h-14'
        : size === 'xl'
          ? 'w-16 h-16'
          : 'w-10 h-10';

  if (isGM) {
    return (
      <div
        className={`${dims} rounded-xl border border-amber-400/50 bg-gradient-to-b from-amber-500/25 to-amber-950/50 flex items-center justify-center shrink-0 text-amber-300`}
        aria-hidden="true"
      >
        <Crown size={size === 'sm' ? 15 : 20} />
      </div>
    );
  }

  const p = AVATAR_PALETTES[avatar] || AVATAR_PALETTES.lantern;

  return (
    <div
      className={`${dims} rounded-xl border overflow-hidden shrink-0 relative ${
        isAlive ? 'border-white/15' : 'border-white/10 grayscale opacity-60'
      }`}
      style={{
        background: `linear-gradient(160deg, ${p.bg1}, ${p.bg2})`,
      }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 64 64" className="w-full h-full">
        {/* Shoulders / Trench Coat */}
        <path d="M10 64 C12 46 22 42 32 42 C42 42 52 46 54 64 Z" fill={p.coat} />
        {/* Shirt V & Tie */}
        <path d="M27 43 L32 54 L37 43 Z" fill="#E2E8F0" opacity="0.9" />
        <path d="M30.5 45 L33.5 45 L32 58 Z" fill={p.tie} />
        {/* Neck */}
        <rect x="28" y="34" width="8" height="10" rx="3" fill={p.skin} />
        {/* Hair Back */}
        <circle cx="32" cy="24" r="11.5" fill={p.hair} />
        {/* Face */}
        <rect x="22" y="16" width="20" height="22" rx="9" fill={p.skin} />
        {/* Eyes */}
        <circle cx="27.5" cy="26" r="1.5" fill="#111827" />
        <circle cx="36.5" cy="26" r="1.5" fill="#111827" />
        {/* Noir Fedora if applicable */}
        {p.hat && (
          <g>
            <path d="M16 19 C22 15 42 15 48 19 L45 21 C38 19 26 19 19 21 Z" fill={p.hat} />
            <path d="M22 17 L25 9 C30 8 34 8 39 9 L42 17 Z" fill={p.hat} />
            <rect x="22.5" y="15" width="19" height="2" fill={p.tie} opacity="0.85" />
          </g>
        )}
      </svg>
    </div>
  );
}

export function RoleCardArtwork({
  role,
  className = '',
}: {
  role: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = ROLE_CARD_IMAGES[role];

  if (!src || failed) {
    const gradient =
      role === 'Mafia'
        ? 'from-[#2A0E14] to-[#0E1118] text-[#F87171]'
        : role === 'Detective'
          ? 'from-[#231C0E] to-[#0E1118] text-[#E5A93C]'
          : role === 'Bodyguard'
            ? 'from-[#0D1E2E] to-[#0E1118] text-[#38BDF8]'
            : 'from-[#16201B] to-[#0E1118] text-[#34D399]';

    return (
      <div
        className={`rounded-xl border border-white/10 bg-gradient-to-b ${gradient} flex flex-col items-center justify-center p-4 text-center ${className}`}
      >
        <Shield size={32} className="mb-2 opacity-80" />
        <span className="font-display text-lg font-semibold tracking-wide">
          {role}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${role} role card`}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`rounded-xl border border-white/10 object-cover ${className}`}
    />
  );
}

export function getRoleDescription(role: string | null): string {
  switch (role) {
    case 'Mafia':
      return 'You are a member of the Mafia. Eliminate Townspeople under cover of night and blend in by day.';
    case 'Detective':
      return 'Investigate one living player each night when called by the Game Master to uncover Mafia members.';
    case 'Bodyguard':
      return 'Protect one living player each night when called by the Game Master to stop Mafia eliminations.';
    case 'Villager':
      return 'Discuss suspicious behavior by day and vote out the Mafia to save the Town.';
    case 'Game Master':
      return 'Assign roles, call each role privately at night, announce results, and control the match.';
    default:
      return 'Follow the Game Master’s instructions and fulfill your custom role objective.';
  }
}

export function getRoleTextColor(role: string | null): string {
  switch (role) {
    case 'Mafia':
      return 'text-[#F87171]';
    case 'Detective':
      return 'text-[#60A5FA]';
    case 'Bodyguard':
      return 'text-[#38BDF8]';
    case 'Villager':
      return 'text-[#34D399]';
    case 'Game Master':
      return 'text-[#FBBF24]';
    default:
      return 'text-slate-200';
  }
}
