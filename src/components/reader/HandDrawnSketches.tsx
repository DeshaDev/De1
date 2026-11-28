import React from 'react';

export type SketchSceneId =
  | 'seed-cover'
  | 'seed-pot'
  | 'watering-can'
  | 'morning-sun'
  | 'red-rose'
  | 'compass-cover'
  | 'wooden-box-compass'
  | 'north-needle'
  | 'hand-drawn-map'
  | 'garden-notebook-map'
  | 'olive-orchard-path'
  | 'garden-brook-stones'
  | 'fig-tree-keepsake';

/**
 * Hand-drawn colored-pencil & sepia-ink SVG scene illustrations on warm cream cotton paper.
 * Styled to complement the watercolor/colored-pencil illustrations in public/stories/paper-bird/.
 */
export const HandDrawnSketchScene: React.FC<{ scene: SketchSceneId; className?: string }> = ({
  scene,
  className = '',
}) => {
  return (
    <svg
      viewBox="0 0 640 360"
      className={`h-full w-full select-none ${className}`}
      role="img"
      aria-label={scene}
    >
      <defs>
        <filter id="de1-pencil-grain" x="-4%" y="-4%" width="108%" height="108%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" />
        </filter>
        <pattern id="de1-pencil-hatch" width="8" height="8" patternTransform="rotate(35)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="8" stroke="#6B5A49" strokeOpacity="0.16" strokeWidth="1.2" />
        </pattern>
        <radialGradient id="de1-paper-glow" cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFFDF7" />
          <stop offset="100%" stopColor="#F5ECD8" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="640" height="360" rx="18" fill="url(#de1-paper-glow)" />
      <rect
        x="14"
        y="14"
        width="612"
        height="332"
        rx="12"
        fill="none"
        stroke="#B8A389"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        opacity="0.65"
      />

      <g filter="url(#de1-pencil-grain)" strokeLinecap="round" strokeLinejoin="round">
        {renderArtwork(scene)}
      </g>
    </svg>
  );
};

function renderArtwork(scene: SketchSceneId) {
  switch (scene) {
    case 'seed-cover':
    case 'seed-pot':
      return (
        <g>
          <path d="M40,290 Q180,255 320,278 T600,275" fill="none" stroke="#C7B299" strokeWidth="2.5" />
          <path d="M75,288 L565,288 L545,322 L95,322 Z" fill="#EAD5B5" stroke="#4B3B2B" strokeWidth="2.5" />
          <path d="M235,180 L405,180 L382,288 L258,288 Z" fill="#D97848" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M235,180 L405,180 L382,288 L258,288 Z" fill="url(#de1-pencil-hatch)" />
          <rect x="220" y="158" width="200" height="26" rx="8" fill="#E68B5A" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M242,158 Q320,132 398,158 Z" fill="#6E4E34" stroke="#3D2B1D" strokeWidth="2.5" />
          <ellipse cx="320" cy="144" rx="14" ry="9" fill="#B87D38" stroke="#3D2B1D" strokeWidth="2.5" />
          <path d="M320,138 Q320,112 318,98" fill="none" stroke="#1E7E62" strokeWidth="3.5" />
          <path d="M318,110 Q288,88 278,104 Q292,122 318,112 Z" fill="#65B88E" stroke="#1E7E62" strokeWidth="2.5" />
          <path d="M319,105 Q352,82 362,98 Q348,118 319,108 Z" fill="#77CCA0" stroke="#1E7E62" strokeWidth="2.5" />
        </g>
      );

    case 'watering-can':
      return (
        <g>
          <path d="M90,295 Q320,265 550,295" fill="#E6D8B8" stroke="#5C4A38" strokeWidth="2.5" />
          <path d="M160,218 L272,218 L256,294 L176,294 Z" fill="#D97848" stroke="#4B3B2B" strokeWidth="3" />
          <rect x="150" y="200" width="132" height="20" rx="6" fill="#E68B5A" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M216,200 Q216,158 216,142" fill="none" stroke="#1E7E62" strokeWidth="3.5" />
          <path d="M216,162 Q185,142 178,158 Q195,174 216,164 Z" fill="#65B88E" stroke="#1E7E62" strokeWidth="2.5" />
          <path d="M216,155 Q248,136 254,152 Q238,168 216,157 Z" fill="#77CCA0" stroke="#1E7E62" strokeWidth="2.5" />
          <g transform="translate(330, 82) rotate(-18)">
            <rect x="42" y="34" width="105" height="78" rx="14" fill="#6BB6B0" stroke="#354642" strokeWidth="3" />
            <rect x="42" y="34" width="105" height="78" rx="14" fill="url(#de1-pencil-hatch)" />
            <path d="M147,54 Q188,52 184,84 Q180,104 147,100" fill="none" stroke="#354642" strokeWidth="3.5" />
            <path d="M42,88 L-28,62 L-22,46 L42,66 Z" fill="#82C9C3" stroke="#354642" strokeWidth="3" />
            <ellipse cx="-28" cy="54" rx="7" ry="14" fill="#F3B73F" stroke="#354642" strokeWidth="2.5" />
          </g>
          <path d="M275,145 Q265,162 275,168 Q285,162 275,145 Z" fill="#7AC3DF" stroke="#2D5772" strokeWidth="2" />
          <path d="M248,166 Q239,182 248,187 Q257,182 248,166 Z" fill="#7AC3DF" stroke="#2D5772" strokeWidth="2" />
          <path d="M294,174 Q286,188 294,193 Q302,188 294,174 Z" fill="#7AC3DF" stroke="#2D5772" strokeWidth="2" />
        </g>
      );

    case 'morning-sun':
      return (
        <g>
          <rect x="70" y="255" width="500" height="22" rx="6" fill="#D5B285" stroke="#4B3B2B" strokeWidth="3" />
          {[110, 190, 270, 350, 430, 510].map((x) => (
            <rect key={x} x={x} y="277" width="16" height="58" fill="#C79F70" stroke="#4B3B2B" strokeWidth="2.5" />
          ))}
          <circle cx="465" cy="110" r="48" fill="#F6C851" stroke="#6E4B1A" strokeWidth="3" />
          <circle cx="465" cy="110" r="48" fill="url(#de1-pencil-hatch)" />
          {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
            <line
              key={deg}
              x1={465 + Math.cos((deg * Math.PI) / 180) * 58}
              y1={110 + Math.sin((deg * Math.PI) / 180) * 58}
              x2={465 + Math.cos((deg * Math.PI) / 180) * 76}
              y2={110 + Math.sin((deg * Math.PI) / 180) * 76}
              stroke="#D98B1E"
              strokeWidth="3.5"
            />
          ))}
          <path d="M180,192 L292,192 L278,255 L194,255 Z" fill="#D97848" stroke="#4B3B2B" strokeWidth="3" />
          <rect x="172" y="175" width="128" height="18" rx="6" fill="#E68B5A" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M236,175 Q236,115 242,96" fill="none" stroke="#1E7E62" strokeWidth="4" />
          <path d="M237,138 Q195,118 190,136 Q208,154 237,140 Z" fill="#65B88E" stroke="#1E7E62" strokeWidth="2.5" />
          <path d="M239,124 Q282,102 288,120 Q270,138 239,127 Z" fill="#77CCA0" stroke="#1E7E62" strokeWidth="2.5" />
          <circle cx="242" cy="94" r="11" fill="#7AC88E" stroke="#1E7E62" strokeWidth="2.5" />
        </g>
      );

    case 'red-rose':
      return (
        <g>
          <ellipse cx="320" cy="306" rx="160" ry="18" fill="#E8D8BE" stroke="#8A745C" strokeWidth="1.5" strokeDasharray="5 4" />
          <path d="M250,218 L390,218 L374,304 L266,304 Z" fill="#D97848" stroke="#4B3B2B" strokeWidth="3" />
          <rect x="240" y="198" width="160" height="22" rx="6" fill="#E68B5A" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M320,198 Q314,142 320,104" fill="none" stroke="#1E7E62" strokeWidth="4.5" />
          <path d="M318,162 Q268,142 260,162 Q284,182 318,165 Z" fill="#5CB588" stroke="#1E7E62" strokeWidth="2.8" />
          <path d="M318,148 Q372,126 378,146 Q356,168 318,151 Z" fill="#73CAA0" stroke="#1E7E62" strokeWidth="2.8" />
          <circle cx="320" cy="88" r="36" fill="#D94B43" stroke="#4A1D1B" strokeWidth="3" />
          <path d="M294,88 Q308,58 320,66 Q336,56 346,88 Q334,114 320,110 Q304,114 294,88 Z" fill="#E8655B" stroke="#4A1D1B" strokeWidth="2.2" />
          <path d="M308,82 Q320,70 332,82 Q324,96 312,92 Z" fill="#F2857C" stroke="#4A1D1B" strokeWidth="2" />
        </g>
      );

    case 'compass-cover':
    case 'wooden-box-compass':
      return (
        <g>
          <path d="M165,175 L475,175 L455,295 L185,295 Z" fill="#B9824D" stroke="#452E1A" strokeWidth="3" />
          <path d="M165,175 L475,175 L455,295 L185,295 Z" fill="url(#de1-pencil-hatch)" />
          <path d="M180,175 L200,90 L440,90 L460,175 Z" fill="#D49D66" stroke="#452E1A" strokeWidth="3" />
          <ellipse cx="320" cy="215" rx="95" ry="52" fill="#2A5B4E" stroke="#193A31" strokeWidth="2.5" />
          <circle cx="320" cy="215" r="46" fill="#E8B948" stroke="#452E1A" strokeWidth="3" />
          <circle cx="320" cy="215" r="36" fill="#FFFDF6" stroke="#6E4E24" strokeWidth="2" />
          <polygon points="320,185 327,215 320,215" fill="#C85528" />
          <polygon points="320,245 313,215 320,215" fill="#3E4C7A" />
          <circle cx="320" cy="215" r="4.5" fill="#452E1A" />
        </g>
      );

    case 'north-needle':
      return (
        <g>
          <circle cx="320" cy="180" r="118" fill="#F5ECD6" stroke="#452E1A" strokeWidth="4" />
          <circle cx="320" cy="180" r="102" fill="#FFFDF8" stroke="#8C7355" strokeWidth="2" strokeDasharray="4 4" />
          <polygon points="320,72 336,164 320,180 304,164" fill="#C85528" stroke="#452E1A" strokeWidth="2.5" />
          <polygon points="320,288 336,196 320,180 304,196" fill="#5D7496" stroke="#452E1A" strokeWidth="2.5" />
          <polygon points="428,180 336,196 320,180 336,164" fill="#E8C67D" stroke="#452E1A" strokeWidth="2.5" />
          <polygon points="212,180 304,196 320,180 304,164" fill="#D5B267" stroke="#452E1A" strokeWidth="2.5" />
          <circle cx="320" cy="180" r="10" fill="#F3B73F" stroke="#452E1A" strokeWidth="2.5" />
          <text x="320" y="54" textAnchor="middle" fill="#C85528" fontSize="22" fontWeight="900">شَمَالٌ</text>
          <text x="320" y="324" textAnchor="middle" fill="#3E4C7A" fontSize="20" fontWeight="800">جَنُوبٌ</text>
          <text x="468" y="187" textAnchor="middle" fill="#4B3B2B" fontSize="20" fontWeight="800">شَرْقٌ</text>
          <text x="172" y="187" textAnchor="middle" fill="#4B3B2B" fontSize="20" fontWeight="800">غَرْبٌ</text>
        </g>
      );

    case 'hand-drawn-map':
      return (
        <g>
          <path d="M95,75 Q320,58 545,75 L530,295 Q320,310 110,295 Z" fill="#F4E3C1" stroke="#4B3B2B" strokeWidth="3" />
          <path d="M95,75 Q320,58 545,75 L530,295 Q320,310 110,295 Z" fill="url(#de1-pencil-hatch)" opacity="0.5" />
          <path d="M175,245 Q245,195 315,210 T465,132" fill="none" stroke="#8B4B28" strokeWidth="3.5" strokeDasharray="9 7" />
          <path d="M148,262 L148,225 Q172,202 196,225 L196,262 Z" fill="#C8935B" stroke="#452E1A" strokeWidth="2.5" />
          <line x1="468" y1="158" x2="468" y2="122" stroke="#5A3D22" strokeWidth="5" />
          <circle cx="468" cy="108" r="28" fill="#5CA87E" stroke="#1E5A3E" strokeWidth="2.5" />
          <circle cx="458" cy="104" r="6" fill="#C84638" />
          <circle cx="478" cy="112" r="6" fill="#C84638" />
          <circle cx="468" cy="96" r="5.5" fill="#C84638" />
        </g>
      );

    case 'garden-notebook-map':
      return (
        <g>
          <rect x="115" y="72" width="205" height="220" rx="8" fill="#FFFDF5" stroke="#4B3B2B" strokeWidth="3" />
          <rect x="320" y="72" width="205" height="220" rx="8" fill="#FFFDF5" stroke="#4B3B2B" strokeWidth="3" />
          <line x1="320" y1="74" x2="320" y2="290" stroke="#9B8366" strokeWidth="3" strokeDasharray="4 4" />
          <line x1="145" y1="120" x2="290" y2="120" stroke="#D8C8AE" strokeWidth="2" />
          <line x1="145" y1="152" x2="290" y2="152" stroke="#D8C8AE" strokeWidth="2" />
          <line x1="145" y1="184" x2="290" y2="184" stroke="#D8C8AE" strokeWidth="2" />
          <circle cx="422" cy="162" r="46" fill="#F9EBC8" stroke="#5A4228" strokeWidth="2.5" />
          <polygon points="422,126 430,154 458,162 430,170 422,198 414,170 386,162 414,154" fill="#F3B73F" stroke="#5A4228" strokeWidth="2" />
          <g transform="translate(470, 215) rotate(-32)">
            <rect x="0" y="0" width="90" height="14" rx="3" fill="#C85528" stroke="#3D2B1D" strokeWidth="2" />
            <polygon points="0,0 -18,7 0,14" fill="#F2D2A9" stroke="#3D2B1D" strokeWidth="2" />
          </g>
        </g>
      );

    case 'olive-orchard-path':
      return (
        <g>
          <path d="M24,250 Q180,210 340,228 T616,216 L616,342 L24,342 Z" fill="#DDE6C7" stroke="#5E7344" strokeWidth="2" opacity="0.85" />
          <path d="M165,342 Q265,260 325,245 Q385,228 455,212 L485,216 Q418,248 378,282 T305,342 Z" fill="#E8D8B9" stroke="#7A6549" strokeWidth="2.2" />
          {[
            [240, 315, 22, 11],
            [282, 294, 18, 9],
            [328, 272, 16, 8],
            [374, 250, 14, 7],
            [420, 232, 12, 6],
          ].map(([cx, cy, rx, ry], idx) => (
            <ellipse key={idx} cx={cx} cy={cy} rx={rx} ry={ry} fill="#D5BE98" stroke="#6B563B" strokeWidth="1.8" />
          ))}
          <path d="M448,220 Q456,162 436,126 Q422,96 445,86 Q470,96 472,148 Q476,184 484,220 Z" fill="#8C6B47" stroke="#452E1A" strokeWidth="3" />
          <path d="M452,135 Q405,104 378,108" fill="none" stroke="#8C6B47" strokeWidth="8" />
          <path d="M466,128 Q514,96 544,104" fill="none" stroke="#8C6B47" strokeWidth="8" />
          <ellipse cx="456" cy="92" rx="108" ry="52" fill="#8BAE74" stroke="#395932" strokeWidth="2.5" opacity="0.92" />
          <ellipse cx="385" cy="108" rx="54" ry="30" fill="#9BBF82" stroke="#395932" strokeWidth="2.2" opacity="0.9" />
          <ellipse cx="526" cy="106" rx="56" ry="32" fill="#7FA168" stroke="#395932" strokeWidth="2.2" opacity="0.9" />
          <ellipse cx="456" cy="92" rx="108" ry="52" fill="url(#de1-pencil-hatch)" opacity="0.4" />
          <g transform="translate(88, 125) rotate(-5)">
            <rect x="0" y="0" width="128" height="92" rx="6" fill="#F6E5C4" stroke="#4B3B2B" strokeWidth="2.5" />
            <path d="M18,70 Q52,42 74,54 T110,24" fill="none" stroke="#C85528" strokeWidth="2.5" strokeDasharray="6 5" />
            <circle cx="110" cy="24" r="5" fill="#C85528" />
          </g>
        </g>
      );

    case 'garden-brook-stones':
      return (
        <g>
          <path d="M24,185 Q180,165 330,192 T616,178 L616,342 L24,342 Z" fill="#D5E3BC" stroke="#5A7342" strokeWidth="2" />
          <path d="M24,250 Q190,218 335,235 T616,220 L616,282 Q440,305 295,286 T24,315 Z" fill="#8EC5D6" stroke="#2D5C70" strokeWidth="2.5" />
          <path d="M85,266 Q165,254 245,264" fill="none" stroke="#EAF7FB" strokeWidth="2.2" opacity="0.8" />
          <path d="M365,252 Q455,240 545,252" fill="none" stroke="#EAF7FB" strokeWidth="2.2" opacity="0.8" />
          {[
            [175, 276, 34, 15],
            [262, 265, 36, 16],
            [355, 260, 34, 15],
            [448, 250, 32, 14],
          ].map(([cx, cy, rx, ry], idx) => (
            <g key={idx}>
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#D9C6A5" stroke="#4E3F2F" strokeWidth="2.5" />
              <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#de1-pencil-hatch)" opacity="0.4" />
            </g>
          ))}
          <path d="M90,224 Q78,185 68,168 M96,224 Q96,176 98,154 M102,224 Q116,184 128,166" fill="none" stroke="#396D48" strokeWidth="2.8" />
          <path d="M530,206 Q518,168 510,152 M536,206 Q538,162 540,142 M542,206 Q556,172 566,154" fill="none" stroke="#396D48" strokeWidth="2.8" />
          <g transform="translate(510, 96)">
            <circle cx="0" cy="0" r="40" fill="#E8B948" stroke="#452E1A" strokeWidth="2.8" />
            <circle cx="0" cy="0" r="30" fill="#FFFDF6" stroke="#6E4E24" strokeWidth="1.8" />
            <polygon points="0,-24 6,0 0,0" fill="#C85528" />
            <polygon points="0,24 -6,0 0,0" fill="#3E4C7A" />
            <circle cx="0" cy="0" r="4" fill="#452E1A" />
          </g>
        </g>
      );

    case 'fig-tree-keepsake':
      return (
        <g>
          <path d="M24,195 L616,195 L616,272 L24,272 Z" fill="#CBB699" stroke="#5A4734" strokeWidth="2.5" />
          <line x1="24" y1="232" x2="616" y2="232" stroke="#7A6248" strokeWidth="2" />
          {[110, 210, 320, 430, 530].map((x) => (
            <line key={x} x1={x} y1="195" x2={x} y2="232" stroke="#7A6248" strokeWidth="2" />
          ))}
          {[160, 270, 380, 490].map((x) => (
            <line key={x} x1={x} y1="232" x2={x} y2="272" stroke="#7A6248" strokeWidth="2" />
          ))}
          <path d="M24,272 L616,272 L616,342 L24,342 Z" fill="#D5E3BC" stroke="#5A7342" strokeWidth="2" />
          <path d="M105,65 Q160,120 140,195" fill="none" stroke="#6E5238" strokeWidth="12" />
          <ellipse cx="145" cy="82" rx="95" ry="44" fill="#77A362" stroke="#2D5229" strokeWidth="2.5" />
          <ellipse cx="220" cy="108" rx="65" ry="34" fill="#89B672" stroke="#2D5229" strokeWidth="2.2" />
          <ellipse cx="242" cy="136" rx="11" ry="14" fill="#705478" stroke="#3D2642" strokeWidth="2" />
          <ellipse cx="182" cy="130" rx="10" ry="13" fill="#705478" stroke="#3D2642" strokeWidth="2" />
          <g transform="translate(278, 224)">
            <rect x="0" y="20" width="142" height="68" rx="10" fill="#B5C4BE" stroke="#374843" strokeWidth="3" />
            <rect x="0" y="20" width="142" height="68" rx="10" fill="url(#de1-pencil-hatch)" opacity="0.45" />
            <rect x="-4" y="10" width="150" height="18" rx="6" fill="#CEDAD5" stroke="#374843" strokeWidth="3" />
            <line x1="52" y1="10" x2="52" y2="88" stroke="#9C7A4C" strokeWidth="4" />
            <line x1="90" y1="10" x2="90" y2="88" stroke="#9C7A4C" strokeWidth="4" />
          </g>
          <path d="M262,295 Q225,258 205,274 Q228,300 264,302 Z" fill="#5CB07A" stroke="#245736" strokeWidth="2.2" />
          <path d="M432,296 Q470,256 492,274 Q468,300 430,302 Z" fill="#5CB07A" stroke="#245736" strokeWidth="2.2" />
        </g>
      );
  }
}
