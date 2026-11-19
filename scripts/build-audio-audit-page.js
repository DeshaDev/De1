import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('public/audio/v1/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Group manifest entries by unique audio file to prevent duplicate cards
const fileMap = new Map();

for (const [key, clip] of Object.entries(manifest.clips)) {
  const fileName = clip.file;
  if (!fileName) continue;

  if (!fileMap.has(fileName)) {
    let categoryLabel = 'أخرى';
    let categoryKey = clip.context || 'other';
    if (categoryKey === 'single_word') categoryLabel = 'كلمات الفحص والقراءة';
    else if (categoryKey === 'instruction') categoryLabel = 'تعليمات الألعاب والفحص';
    else if (categoryKey === 'phoneme') categoryLabel = 'أصوات الحروف والمقاطع الفونيمية';
    else if (categoryKey === 'praise') categoryLabel = 'عبارات المديح والتشجيع';
    else if (categoryKey === 'pal') categoryLabel = 'التعلم المقترن (تسمية الكائنات)';

    fileMap.set(fileName, {
      file: fileName,
      primaryText: clip.text || key,
      categoryKey,
      categoryLabel,
      voice: clip.voice || 'صوت بشري طبيعي',
      sizeKb: clip.bytes ? Math.round(clip.bytes / 1024) : null,
      audioUrl: `/audio/v1/${fileName}`,
      aliases: new Set([clip.text, key]),
    });
  } else {
    const existing = fileMap.get(fileName);
    if (clip.text) existing.aliases.add(clip.text);
    existing.aliases.add(key);
    // If current text has better diacritics, prefer it as primaryText
    if (clip.text && clip.text.length >= existing.primaryText.length && /[\u064B-\u0652]/.test(clip.text)) {
      existing.primaryText = clip.text;
    }
  }
}

// Deduplicate identical texts within the same category (e.g. two files for the same exact word)
const textMap = new Map();
for (const entry of fileMap.values()) {
  const textKey = `${entry.categoryKey}:${entry.primaryText.trim()}`;
  if (!textMap.has(textKey)) {
    textMap.set(textKey, entry);
  } else {
    const existing = textMap.get(textKey);
    // Prefer authentic studio voice ML7jGRDg4E9hIl5qEm1Z
    if (entry.voice && entry.voice.includes('ML7jGRDg4E9hIl5qEm1Z') && (!existing.voice || !existing.voice.includes('ML7jGRDg4E9hIl5qEm1Z'))) {
      textMap.set(textKey, entry);
      for (const a of existing.aliases) entry.aliases.add(a);
    } else {
      for (const a of entry.aliases) existing.aliases.add(a);
    }
  }
}

const entries = Array.from(textMap.values()).map(e => ({
  ...e,
  aliasesList: Array.from(e.aliases).filter(a => a && a !== e.primaryText && a !== e.file && !a.endsWith('.mp3')),
  searchTerms: Array.from(e.aliases).join(' ') + ' ' + e.file,
}));

// Compute dynamic counts based on unique clips
const singleWordCount = entries.filter(e => e.categoryKey === 'single_word').length;
const phonemeCount = entries.filter(e => e.categoryKey === 'phoneme').length;
const instructionCount = entries.filter(e => e.categoryKey === 'instruction').length;
const praiseCount = entries.filter(e => e.categoryKey === 'praise').length;
const palCount = entries.filter(e => e.categoryKey === 'pal').length;

// Sort with priority: single_word and praise first, then instruction, then pal, then phoneme
const categoryOrder = { single_word: 1, praise: 2, instruction: 3, pal: 4, phoneme: 5, other: 6 };
entries.sort((a, b) => {
  const diff = (categoryOrder[a.categoryKey] || 9) - (categoryOrder[b.categoryKey] || 9);
  if (diff !== 0) return diff;
  return a.primaryText.localeCompare(b.primaryText, 'ar');
});

const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>مختبر مراجعة واستماع المقاطع الصوتية — هَيَّا نَقْرَأْ</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f8fafc;
      --card-bg: #ffffff;
      --border: #e2e8f0;
      --text: #0f172a;
      --text-muted: #64748b;
      --primary: #0d9488;
      --primary-dark: #0f766e;
      --primary-light: #ccfbf1;
      --accent: #f59e0b;
      --radius: 1rem;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Tajawal', sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
      padding: 1.5rem 1rem 4rem;
    }
    .arabic-text {
      font-family: 'Amiri', serif;
    }
    .container {
      max-width: 1100px;
      margin: 0 auto;
    }
    header {
      text-align: center;
      margin-bottom: 2rem;
      padding: 1.5rem 1rem;
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    h1 {
      font-size: 1.85rem;
      color: var(--primary-dark);
      margin-bottom: 0.5rem;
      font-weight: 800;
    }
    .subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 650px;
      margin: 0 auto 1.25rem;
    }
    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1.25rem;
      margin-top: 1rem;
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--text-muted);
    }
    .stats-item {
      background: var(--bg);
      padding: 0.4rem 0.85rem;
      border-radius: 9999px;
      border: 1px solid var(--border);
    }
    .stats-item strong {
      color: var(--primary);
      margin-left: 0.25rem;
    }
    .controls {
      position: sticky;
      top: 1rem;
      z-index: 50;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      padding: 1rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.07);
      margin-bottom: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .search-input {
      width: 100%;
      padding: 0.75rem 1rem;
      font-size: 1rem;
      font-family: inherit;
      border: 2px solid var(--border);
      border-radius: 0.75rem;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-input:focus {
      border-color: var(--primary);
    }
    .filter-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .filter-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 0.4rem 0.85rem;
      border-radius: 0.5rem;
      font-size: 0.85rem;
      font-family: inherit;
      font-weight: 600;
      cursor: pointer;
      color: var(--text-muted);
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: #e2e8f0;
      color: var(--text);
    }
    .filter-btn.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 0.75rem;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px -2px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      font-size: 0.7rem;
      padding: 0.2rem 0.5rem;
      border-radius: 0.35rem;
      font-weight: 700;
    }
    .badge-single_word { background: #dcfce7; color: #15803d; }
    .badge-instruction { background: #e0e7ff; color: #4338ca; }
    .badge-phoneme { background: #fef3c7; color: #b45309; }
    .badge-praise { background: #fce7f3; color: #be185d; }
    .badge-pal { background: #ccfbf1; color: #0f766e; }
    .badge-other { background: #f1f5f9; color: #475569; }
    .file-name {
      font-size: 0.75rem;
      color: var(--text-muted);
      font-family: monospace;
      direction: ltr;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 140px;
    }
    .card-body {
      min-height: 4.5rem;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .card-text {
      font-size: 1.45rem;
      line-height: 1.4;
      font-weight: 700;
      color: var(--text);
      word-break: break-word;
    }
    .card-aliases {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.35rem;
      line-height: 1.3;
    }
    .card-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      display: flex;
      justify-content: space-between;
      border-top: 1px dashed var(--border);
      padding-top: 0.5rem;
      margin-top: 0.25rem;
    }
    audio {
      width: 100%;
      height: 38px;
      margin-top: 0.25rem;
      outline: none;
    }
    .download-link {
      font-size: 0.75rem;
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
    }
    .download-link:hover {
      text-decoration: underline;
    }
    .empty-state {
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1rem;
      color: var(--text-muted);
      font-size: 1.1rem;
    }
    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }
      h1 {
        font-size: 1.45rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>مختبر مراجعة واستماع المقاطع الصوتية — هَيَّا نَقْرَأْ</h1>
      <p class="subtitle">
        صفحة شاملة لتدقيق واستماع كافة المقاطع الصوتية المعتمدة في المشروع. يمكنك الاستماع، البحث، وتنزيل أي ملف لمراجعته مع النص المصاحب بدقة.
      </p>
      <div class="stats-bar">
        <span class="stats-item">إجمالي المقاطع المتاحة: <strong>${entries.length}</strong></span>
        <span class="stats-item">كلمات القراءة: <strong>${singleWordCount}</strong></span>
        <span class="stats-item">أصوات الفونيمات: <strong>${phonemeCount}</strong></span>
        <span class="stats-item">التعليمات: <strong>${instructionCount}</strong></span>
        <span class="stats-item">المديح والتشجيع: <strong>${praiseCount}</strong></span>
        <span class="stats-item">التعلم المقترن: <strong>${palCount}</strong></span>
      </div>
    </header>

    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="ابحث عن أي كلمة أو عبارة (مثال: فُوب، سامي، إليه، شمس، أحسنت)..." autocomplete="off" />
      <div class="filter-tabs">
        <button class="filter-btn active" data-filter="all">الكل (${entries.length})</button>
        <button class="filter-btn" data-filter="single_word">كلمات الفحص والقراءة (${singleWordCount})</button>
        <button class="filter-btn" data-filter="praise">عبارات التشجيع (${praiseCount})</button>
        <button class="filter-btn" data-filter="instruction">تعليمات الألعاب والفحص (${instructionCount})</button>
        <button class="filter-btn" data-filter="phoneme">أصوات الحروف والمقاطع (${phonemeCount})</button>
        <button class="filter-btn" data-filter="pal">التعلم المقترن (${palCount})</button>
      </div>
      <div id="resultCount" style="font-size: 0.85rem; color: var(--text-muted); text-align: left; margin-top: -0.25rem;">
        عرض ${entries.length} مقطعًا صوتيًا
      </div>
    </div>

    <main class="grid" id="clipsGrid">
      ${entries.map(e => `
        <div class="card" data-category="${e.categoryKey}" data-search="${e.searchTerms}">
          <div class="card-header">
            <span class="badge badge-${e.categoryKey}">${e.categoryLabel}</span>
            <span class="file-name" title="${e.file}">ملف: ${e.file}</span>
          </div>
          <div class="card-body">
            <div class="card-text arabic-text" lang="ar">${e.primaryText}</div>
            ${e.aliasesList.length > 0 ? `<div class="card-aliases">مرادفات/أشكال: ${e.aliasesList.slice(0, 3).join(' • ')}</div>` : ''}
          </div>
          <div class="card-meta">
            <span>${e.voice}</span>
            <a href="${e.audioUrl}" download class="download-link">⬇ تنزيل</a>
          </div>
          <audio controls preload="none">
            <source src="${e.audioUrl}" type="audio/mpeg">
            متصفحك لا يدعم تشغيل هذا المقطع.
          </audio>
        </div>
      `).join('')}
      <div id="emptyState" class="empty-state" style="display: none;">
        لم نعثر على أي مقطع صوتي يطابق بحثك. جرّب كلمة أخرى.
      </div>
    </main>
  </div>

  <script>
    const searchInput = document.getElementById('searchInput');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const cards = Array.from(document.querySelectorAll('.card'));
    const resultCount = document.getElementById('resultCount');
    const emptyState = document.getElementById('emptyState');

    let currentCategory = 'all';
    let searchQuery = '';

    function normalizeAr(str) {
      if (!str) return '';
      return str
        .normalize('NFC')
        .replace(/[\\u064B-\\u065F\\u0670\\u0640]/g, '')
        .replace(/[.,!?،؟؛:"«»()[\\]{}]/g, '')
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .trim()
        .toLowerCase();
    }

    function applyFilters() {
      const q = normalizeAr(searchQuery);
      let visible = 0;

      cards.forEach(card => {
        const cat = card.getAttribute('data-category');
        const rawSearch = card.getAttribute('data-search') || '';
        const searchNormalized = normalizeAr(rawSearch);

        const matchesCat = (currentCategory === 'all' || cat === currentCategory);
        const matchesQuery = !q || searchNormalized.includes(q) || rawSearch.includes(searchQuery);

        if (matchesCat && matchesQuery) {
          card.style.display = 'flex';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });

      resultCount.textContent = 'عرض ' + visible + ' مقطعًا صوتيًا';
      emptyState.style.display = visible === 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      applyFilters();
    });

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.getAttribute('data-filter');
        applyFilters();
      });
    });

    // Pause other audio players when one starts
    document.addEventListener('play', (e) => {
      const audios = document.getElementsByTagName('audio');
      for (let i = 0; i < audios.length; i++) {
        if (audios[i] !== e.target) {
          audios[i].pause();
        }
      }
    }, true);
  </script>
</body>
</html>
`;

fs.writeFileSync(path.resolve('public/audio-audit.html'), html, 'utf8');
if (fs.existsSync(path.resolve('dist'))) {
  fs.writeFileSync(path.resolve('dist/audio-audit.html'), html, 'utf8');
}
console.log(`Successfully generated deduplicated public/audio-audit.html and dist/audio-audit.html`);
console.log(`Total unique audio clips displayed: ${entries.length}`);
