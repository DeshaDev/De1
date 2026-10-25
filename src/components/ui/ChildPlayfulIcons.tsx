import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

// 1. Golden Star with 3D Depth
export const IconStar: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M16 2.5L20.12 11.24L29.5 12.63L22.75 19.46L24.35 29.1L16 24.55L7.65 29.1L9.25 19.46L2.5 12.63L11.88 11.24L16 2.5Z"
      fill="#FFC800"
      stroke="#E5A500"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M16 4.5L19.2 11.5L26.8 12.6L21.4 18.2L22.7 26L16 22.3V4.5Z"
      fill="#FFE066"
    />
  </svg>
);

// 2. Flame Streak
export const IconFlame: React.FC<IconProps> = ({ className = 'w-5 h-5', size = 24 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M16.5 2C16.5 2 25 9.5 25 18C25 23.5 20.7 28 16 28C11.3 28 7 23.5 7 18C7 11.5 13 6 16.5 2Z"
      fill="#FF9600"
      stroke="#CC7900"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M16 11C16 11 20.5 15.5 20.5 19.5C20.5 22.5 18.5 25 16 25C13.5 25 11.5 22.5 11.5 19.5C11.5 15.5 14.5 13 16 11Z"
      fill="#FFC800"
    />
  </svg>
);

// 3. Golden Trophy
export const IconTrophy: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M9 5H23V14C23 17.866 19.866 21 16 21C12.134 21 9 17.866 9 14V5Z"
      fill="#FFC800"
      stroke="#E5A500"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M9 7H4C4 11 7 13 9 13V7Z"
      fill="#FFE066"
      stroke="#E5A500"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M23 7H28C28 11 25 13 23 13V7Z"
      fill="#FFC800"
      stroke="#E5A500"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M13 21H19V25H13V21Z"
      fill="#E5A500"
    />
    <rect
      x="10"
      y="25"
      width="12"
      height="4"
      rx="2"
      fill="#FF9600"
      stroke="#CC7900"
      strokeWidth="1.5"
    />
  </svg>
);

// 4. Illustrated Storybook
export const IconStoryBook: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M5 8C5 6.34315 6.34315 5 8 5H24C25.6569 5 27 6.34315 27 8V24C27 25.6569 25.6569 27 24 27H8C6.34315 27 5 25.6569 5 24V8Z"
      fill="#1CB0F6"
      stroke="#1899D6"
      strokeWidth="2"
    />
    <path
      d="M5 23C7 22 10 22 16 23C22 22 25 22 27 23V8C25 7 22 7 16 8C10 7 7 7 5 8V23Z"
      fill="#FFFFFF"
    />
    <line x1="16" y1="8" x2="16" y2="23" stroke="#CBD5E1" strokeWidth="2" />
    <path d="M19 5V12L21.5 10L24 12V5H19Z" fill="#FF4B4B" />
  </svg>
);

// 5. Studio Microphone with Sound Waves
export const IconMicGlow: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="11"
      y="4"
      width="10"
      height="16"
      rx="5"
      fill="#58CC02"
      stroke="#46A302"
      strokeWidth="2"
    />
    <path
      d="M6 14C6 19.5228 10.4772 24 16 24C21.5228 24 26 19.5228 26 14"
      stroke="#46A302"
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <line x1="16" y1="24" x2="16" y2="28" stroke="#46A302" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="11" y1="28" x2="21" y2="28" stroke="#46A302" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);

// 6. Alphabet Letters Block (Arabic س & ص)
export const IconLettersBlock: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="4"
      y="7"
      width="14"
      height="14"
      rx="4"
      fill="#58CC02"
      stroke="#46A302"
      strokeWidth="2"
    />
    <text x="11" y="18" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
      س
    </text>
    <rect
      x="14"
      y="11"
      width="14"
      height="14"
      rx="4"
      fill="#1CB0F6"
      stroke="#1899D6"
      strokeWidth="2"
    />
    <text x="21" y="22" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
      ص
    </text>
  </svg>
);

// 7. Puzzle Pieces (Syllables)
export const IconPuzzlePieces: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M7 6H13V8C13 9.1 13.9 10 15 10C16.1 10 17 9.1 17 8V6H23C24.1 6 25 6.9 25 8V14H23C21.9 14 21 14.9 21 16C21 17.1 21.9 18 23 18H25V24C25 25.1 24.1 26 23 26H17V24C17 22.9 16.1 22 15 22C13.9 22 13 22.9 13 24V26H7C5.9 26 5 25.1 5 24V8C5 6.9 5.9 6 7 6Z"
      fill="#CE82FF"
      stroke="#A568CC"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

// 8. Superhero Lightning Bolt
export const IconLightningBolt: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M18 2L6 18H16L14 30L26 14H16L18 2Z"
      fill="#FFC800"
      stroke="#E5A500"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

// 9. Number Ruler (Math)
export const IconNumberRuler: React.FC<IconProps> = ({ className = 'w-6 h-6', size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <rect
      x="4"
      y="11"
      width="24"
      height="10"
      rx="3"
      fill="#1CB0F6"
      stroke="#1899D6"
      strokeWidth="2"
    />
    <line x1="8" y1="11" x2="8" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <line x1="12" y1="11" x2="12" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="16" y1="11" x2="16" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <line x1="20" y1="11" x2="20" y2="14" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="24" y1="11" x2="24" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// 10. Friendly Baseera Falcon Mascot («صقر بصيرة الذكي»)
export const IconBaseeraFalcon: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 32 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 40 40"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <circle cx="20" cy="20" r="18" fill="#58CC02" stroke="#46A302" strokeWidth="2" />
    {/* Body & Feathers */}
    <ellipse cx="20" cy="22" rx="12" ry="10" fill="#FFFFFF" />
    {/* Eyes */}
    <circle cx="15" cy="17" r="3.5" fill="#1E293B" />
    <circle cx="16" cy="16" r="1.2" fill="#FFFFFF" />
    <circle cx="25" cy="17" r="3.5" fill="#1E293B" />
    <circle cx="26" cy="16" r="1.2" fill="#FFFFFF" />
    {/* Cute Beak */}
    <path d="M18 20L20 25L22 20H18Z" fill="#FF9600" />
    {/* Head Tuft */}
    <path d="M19 4C19 4 22 2 24 5C22 6 20 6 19 4Z" fill="#46A302" />
  </svg>
);

// 11. Story Cover Badges (Vector Illustrations instead of emojis)
export const StoryIcons = {
  cat: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#FFF7ED" stroke="#FDBA74" strokeWidth="2" />
      <polygon points="10,13 14,7 16,13" fill="#FB923C" />
      <polygon points="26,13 22,7 20,13" fill="#FB923C" />
      <circle cx="18" cy="20" r="9" fill="#FED7AA" />
      <circle cx="15" cy="19" r="1.5" fill="#431407" />
      <circle cx="21" cy="19" r="1.5" fill="#431407" />
      <polygon points="17,22 19,22 18,23.5" fill="#EA580C" />
    </svg>
  ),
  fruit: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
      <circle cx="18" cy="21" r="9" fill="#EF4444" />
      <path d="M18 12C18 9 20 8 22 8" stroke="#047857" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="21" cy="10" rx="3" ry="1.5" fill="#10B981" />
    </svg>
  ),
  space: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="2" />
      <path d="M14 26L22 10L24 11L16 27L14 26Z" fill="#0284C7" />
      <circle cx="22" cy="10" r="3.5" fill="#38BDF8" />
      <line x1="12" y1="28" x2="16" y2="28" stroke="#0369A1" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  castle: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#FAF5FF" stroke="#E9D5FF" strokeWidth="2" />
      <rect x="10" y="15" width="16" height="12" fill="#A855F7" rx="1" />
      <rect x="8" y="11" width="5" height="16" fill="#9333EA" rx="1" />
      <rect x="23" y="11" width="5" height="16" fill="#9333EA" rx="1" />
      <path d="M15 27V21C15 19.5 16.5 19.5 18 19.5C19.5 19.5 21 19.5 21 21V27H15Z" fill="#F3E8FF" />
    </svg>
  ),
  sea: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#ECFEFF" stroke="#A5F3FC" strokeWidth="2" />
      <path d="M8 20C11 18 13 22 16 20C19 18 21 22 24 20C26 19 27 20 28 20" stroke="#0891B2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M8 24C11 22 13 26 16 24C19 22 21 26 24 24C26 23 27 24 28 24" stroke="#06B6D4" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="21" cy="14" r="3" fill="#F59E0B" />
    </svg>
  ),
  eagle: () => (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="18" cy="18" r="16" fill="#FEFCE8" stroke="#FEF08A" strokeWidth="2" />
      <path d="M9 16C13 14 16 17 18 19C20 17 23 14 27 16C25 21 20 24 18 24C16 24 11 21 9 16Z" fill="#CA8A04" />
      <polygon points="16,19 20,19 18,22" fill="#EAB308" />
    </svg>
  ),
};

// 12. StoryGen Theme Vector Icons
export const IconSpaceRocket: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="18" cy="18" r="16" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="2" />
    <path d="M18 7C14 13 13 18 13 22H23C23 18 22 13 18 7Z" fill="#6366F1" stroke="#4F46E5" strokeWidth="1.5" />
    <circle cx="18" cy="15" r="2.5" fill="#E0E7FF" />
    <path d="M13 22L9 26V23L13 20V22Z" fill="#A5B4FC" />
    <path d="M23 22L27 26V23L23 20V22Z" fill="#A5B4FC" />
    <polygon points="16,22 20,22 18,27" fill="#F43F5E" />
  </svg>
);

export const IconForestAnimals: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="18" cy="18" r="16" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
    <circle cx="18" cy="18" r="10" fill="#F59E0B" />
    <polygon points="11,12 14,8 16,12" fill="#D97706" />
    <polygon points="25,12 22,8 20,12" fill="#D97706" />
    <circle cx="15" cy="17" r="1.5" fill="#1E293B" />
    <circle cx="21" cy="17" r="1.5" fill="#1E293B" />
    <ellipse cx="18" cy="21" rx="3" ry="2" fill="#FEF3C7" />
    <polygon points="17.5,20.5 18.5,20.5 18,21.5" fill="#B45309" />
  </svg>
);

export const IconSportsBall: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="18" cy="18" r="16" fill="#FFFBEB" stroke="#FDE68A" strokeWidth="2" />
    <circle cx="18" cy="18" r="11" fill="#FFFFFF" stroke="#1E293B" strokeWidth="2" />
    <polygon points="18,13 21,16 20,19 16,19 15,16" fill="#1E293B" />
    <line x1="18" y1="13" x2="18" y2="7" stroke="#1E293B" strokeWidth="1.5" />
    <line x1="21" y1="16" x2="27" y2="14" stroke="#1E293B" strokeWidth="1.5" />
    <line x1="20" y1="19" x2="25" y2="24" stroke="#1E293B" strokeWidth="1.5" />
    <line x1="16" y1="19" x2="11" y2="24" stroke="#1E293B" strokeWidth="1.5" />
    <line x1="15" y1="16" x2="9" y2="14" stroke="#1E293B" strokeWidth="1.5" />
  </svg>
);

export const IconAdventureCompass: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <circle cx="18" cy="18" r="16" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="2" />
    <circle cx="18" cy="18" r="11" fill="#FFFFFF" stroke="#059669" strokeWidth="2" />
    <polygon points="18,10 20.5,18 18,17 15.5,18" fill="#EF4444" />
    <polygon points="18,26 20.5,18 18,19 15.5,18" fill="#3B82F6" />
    <circle cx="18" cy="18" r="1.5" fill="#1E293B" />
  </svg>
);

export const IconMagicWand: React.FC<IconProps> = ({ className = 'w-8 h-8', size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <line x1="9" y1="27" x2="24" y2="12" stroke="#8B5CF6" strokeWidth="3" strokeLinecap="round" />
    <line x1="20" y1="16" x2="24" y2="12" stroke="#C4B5FD" strokeWidth="3" strokeLinecap="round" />
    <path d="M26 8L27 6L28 8L30 9L28 10L27 12L26 10L24 9L26 8Z" fill="#F59E0B" />
    <path d="M15 8L15.5 7L16 8L17 8.5L16 9L15.5 10L15 9L14 8.5L15 8Z" fill="#FBBF24" />
    <path d="M28 20L28.5 19L29 20L30 20.5L29 21L28.5 22L28 21L27 20.5L28 20Z" fill="#FBBF24" />
  </svg>
);

// 13. RAN High-Contrast Object Vector Icons (Zero OS Emojis)
export const IconRanTree: React.FC<IconProps> = ({ className = 'w-10 h-10', size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M20 5L9 22H14L7 31H33L26 31H31L20 5Z" fill="#10B981" stroke="#047857" strokeWidth="2" strokeLinejoin="round" />
    <path d="M20 5L14 15H20L12 26H20L15 31H25L20 5Z" fill="#34D399" />
    <rect x="17" y="31" width="6" height="6" rx="1.5" fill="#854D0E" stroke="#713F12" strokeWidth="1.5" />
  </svg>
);

export const IconRanHand: React.FC<IconProps> = ({ className = 'w-10 h-10', size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M14 17V9.5C14 8.1 15.1 7 16.5 7C17.9 7 19 8.1 19 9.5V16M19 14V8.5C19 7.1 20.1 6 21.5 6C22.9 6 24 7.1 24 8.5V15M24 15V10.5C24 9.1 25.1 8 26.5 8C27.9 8 29 9.1 29 10.5V18.5M29 18.5V13.5C29 12.1 30.1 11 31.5 11C32.9 11 34 12.1 34 13.5V23C34 29.5 28.5 35 22 35C15.5 35 11 30.5 11 25V20.5C11 19.1 12.1 18 13.5 18C13.8 18 14 18.1 14 18.2V17Z"
      fill="#FBBF24"
      stroke="#D97706"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const IconRanDoor: React.FC<IconProps> = ({ className = 'w-10 h-10', size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <rect x="9" y="5" width="22" height="30" rx="3" fill="#D97706" stroke="#B45309" strokeWidth="2" />
    <rect x="12" y="8" width="16" height="11" rx="1.5" fill="#F59E0B" />
    <rect x="12" y="21" width="16" height="11" rx="1.5" fill="#F59E0B" />
    <circle cx="25" cy="21" r="2.5" fill="#FDE047" stroke="#CA8A04" strokeWidth="1.5" />
    <line x1="6" y1="36" x2="34" y2="36" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
  </svg>
);
