import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('public/audio/v1/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Group manifest entries by unique audio file to prevent duplicate cards
const fileMap = new Map();

for (const [key, clip] of Object.entries(manifest.clips)) {
  const fileName = clip.file;
  if (!fileName) continue;
  if (clip.context === 'phoneme') continue; // Purged from audit

  if (!fileMap.has(fileName)) {
    let categoryLabel = 'أخرى';
    let categoryKey = clip.context || 'other';
    if (categoryKey === 'single_word') categoryLabel = 'كلمات الفحص والقراءة';
    else if (categoryKey === 'instruction') categoryLabel = 'تعليمات الألعاب والفحص';
    else if (categoryKey === 'praise') categoryLabel = 'عبارات التشجيع والمديح';
    else if (categoryKey === 'pal') categoryLabel = 'التعلم المقترن (شخصيات الفضاء)';

    fileMap.set(fileName, {
      file: fileName,
      primaryText: clip.text || key,
      categoryKey,
      categoryLabel,
      voice: 'صوت طبيعي (سُهير الأبطح)',
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
    for (const a of entry.aliases) existing.aliases.add(a);
  }
}

const entries = Array.from(textMap.values()).map(e => ({
  ...e,
  aliasesList: Array.from(e.aliases).filter(a => a && a !== e.primaryText && a !== e.file && !a.endsWith('.mp3')),
  searchTerms: Array.from(e.aliases).join(' ') + ' ' + e.file,
}));

// Compute dynamic counts based on unique clips
const singleWordCount = entries.filter(e => e.categoryKey === 'single_word').length;
const instructionCount = entries.filter(e => e.categoryKey === 'instruction').length;
const praiseCount = entries.filter(e => e.categoryKey === 'praise').length;
const palCount = entries.filter(e => e.categoryKey === 'pal').length;

// Sort with priority: single_word and praise first, then instruction, then pal
const categoryOrder = { single_word: 1, praise: 2, instruction: 3, pal: 4, other: 5 };
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
  <title>مختبر مراجعة واستماع المقاطع الصوتية الطبيعية — هَيَّا نَقْرَأْ</title>
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
      background: #ffffff;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem 1.5rem;
      margin-bottom: 2rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
      text-align: center;
    }
    h1 {
      font-size: 1.8rem;
      font-weight: 800;
      color: var(--primary-dark);
      margin-bottom: 0.5rem;
    }
    p.subtitle {
      color: var(--text-muted);
      font-size: 0.95rem;
      max-width: 700px;
      margin: 0 auto 1.5rem;
    }
    .stats-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.9rem;
    }
    .stats-item {
      background: var(--bg);
      padding: 0.4rem 0.8rem;
      border-radius: 9999px;
      border: 1px solid var(--border);
    }
    .stats-item strong {
      color: var(--primary);
    }

    /* Controls */
    .controls {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 1.5rem;
      background: #ffffff;
      padding: 1.25rem;
      border-radius: var(--radius);
      border: 1px solid var(--border);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .search-input {
      width: 100%;
      padding: 0.75rem 1.25rem;
      border-radius: 0.75rem;
      border: 1.5px solid var(--border);
      font-size: 1rem;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .search-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
    }
    .filter-tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .filter-btn {
      background: var(--bg);
      border: 1px solid var(--border);
      padding: 0.45rem 0.9rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-family: inherit;
      cursor: pointer;
      color: var(--text);
      transition: all 0.15s ease;
      font-weight: 500;
    }
    .filter-btn:hover {
      background: #f1f5f9;
      border-color: #cbd5e1;
    }
    .filter-btn.active {
      background: var(--primary);
      color: #ffffff;
      border-color: var(--primary);
    }

    /* Grid */
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
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
    }
    .card:hover {
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08);
      border-color: #cbd5e1;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }
    .badge {
      font-size: 0.72rem;
      padding: 0.2rem 0.55rem;
      border-radius: 9999px;
      font-weight: 700;
    }
    .badge-single_word { background: #dcfce7; color: #15803d; }
    .badge-instruction { background: #e0f2fe; color: #0369a1; }
    .badge-praise { background: #fef3c7; color: #b45309; }
    .badge-pal { background: #ede9fe; color: #6d28d9; }
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
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }
    .card-text {
      font-size: 1.35rem;
      color: #0f172a;
      line-height: 1.5;
      font-weight: 700;
      word-break: break-word;
    }
    .card-aliases {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .card-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.75rem;
      color: #059669;
      font-weight: 600;
      padding-top: 0.5rem;
      border-top: 1px dashed var(--border);
    }
    .download-link {
      color: var(--primary);
      text-decoration: none;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
    }
    .download-link:hover {
      text-decoration: underline;
    }

    audio {
      width: 100%;
      height: 38px;
      border-radius: 0.5rem;
      outline: none;
    }

    .empty-state {
      grid-column: 1 / -1;
      background: #ffffff;
      border: 1px dashed var(--border);
      border-radius: var(--radius);
      padding: 3rem 1rem;
      text-align: center;
      color: var(--text-muted);
    }

    @media (max-width: 640px) {
      .grid {
        grid-template-columns: 1fr;
      }
      header {
        padding: 1.25rem 1rem;
      }
      h1 {
        font-size: 1.4rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>مختبر مراجعة واستماع المقاطع الصوتية — هَيَّا نَقْرَأْ</h1>
      <p class="subtitle">
        صفحة شاملة لتدقيق واستماع كافة المقاطع الصوتية الطبيعية المعتمدة بصوت معلمة اللغة العربية (سُهير الأبطح). يمكنك الاستماع، البحث، وتنزيل أي ملف لمراجعته مع النص المصاحب بدقة تامة.
      </p>
      <div class="stats-bar">
        <span class="stats-item">إجمالي المقاطع المتاحة: <strong>${entries.length}</strong></span>
        <span class="stats-item">كلمات الفحص والقراءة: <strong>${singleWordCount}</strong></span>
        <span class="stats-item">عبارات التشجيع: <strong>${praiseCount}</strong></span>
        <span class="stats-item">تعليمات الألعاب والفحص: <strong>${instructionCount}</strong></span>
        <span class="stats-item">أصدقاء الفضاء: <strong>${palCount}</strong></span>
      </div>
    </header>

    <div class="controls">
      <input type="text" id="searchInput" class="search-input" placeholder="ابحث عن أي كلمة أو عبارة (مثال: فُوب، سامي، شمس، أحسنت)..." autocomplete="off" />
      <div class="filter-tabs">
        <button class="filter-btn active" data-filter="all">الكل (${entries.length})</button>
        <button class="filter-btn" data-filter="single_word">كلمات الفحص والقراءة (${singleWordCount})</button>
        <button class="filter-btn" data-filter="praise">عبارات التشجيع (${praiseCount})</button>
        <button class="filter-btn" data-filter="instruction">تعليمات الألعاب والفحص (${instructionCount})</button>
        <button class="filter-btn" data-filter="pal">أصدقاء الفضاء (${palCount})</button>
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
    const emptyState = document.getElementById('emptyState');
    const resultCount = document.getElementById('resultCount');

    let currentFilter = 'all';
    let currentSearch = '';

    function normalizeArabic(text) {
      if (!text) return '';
      return text
        .replace(/[\\u064B-\\u065F\\u0670]/g, '') // remove tashkeel
        .replace(/[إأآا]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .toLowerCase()
        .trim();
    }

    function applyFilterAndSearch() {
      const query = normalizeArabic(currentSearch);
      let visibleCount = 0;

      cards.forEach(card => {
        const category = card.getAttribute('data-category');
        const rawSearch = card.getAttribute('data-search') || '';
        const searchTarget = normalizeArabic(rawSearch) + ' ' + rawSearch.toLowerCase();

        const matchesCategory = (currentFilter === 'all' || category === currentFilter);
        const matchesQuery = !query || searchTarget.includes(query);

        if (matchesCategory && matchesQuery) {
          card.style.display = 'flex';
          visibleCount++;
        } else {
          card.style.display = 'none';
        }
      });

      resultCount.textContent = 'عرض ' + visibleCount + ' مقطعًا صوتيًا';
      emptyState.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      applyFilterAndSearch();
    });

    filterButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.getAttribute('data-filter');
        applyFilterAndSearch();
      });
    });

    // Auto pause other audio when one plays
    document.addEventListener('play', function(e) {
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
console.log(`Generated audio audit lab with ${entries.length} authentic studio clips.`);
