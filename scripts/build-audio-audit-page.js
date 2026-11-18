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
      primaryText: clip.text,
      categoryKey,
      categoryLabel,
      voice: clip.voice || 'صوت بشري طبيعي',
      sizeKb: clip.bytes ? Math.round(clip.bytes / 1024) : null,
      audioUrl: `/audio/v1/${fileName}`,
      aliases: new Set([clip.text, key]),
    });
  } else {
    const existing = fileMap.get(fileName);
    existing.aliases.add(clip.text);
    existing.aliases.add(key);
    // If current text has better diacritics, prefer it as primaryText
    if (clip.text && clip.text.length >= existing.primaryText.length && /[\u064B-\u0652]/.test(clip.text)) {
      existing.primaryText = clip.text;
    }
  }
}

const entries = Array.from(fileMap.values()).map(e => ({
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
      padding: 2rem 1.5rem;
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      color: white;
      border-radius: 1.5rem;
      box-shadow: 0 10px 25px -5px rgba(13, 148, 136, 0.25);
    }
    header h1 {
      font-size: 2rem;
      font-weight: 900;
      margin-bottom: 0.5rem;
    }
    header p {
      font-size: 1.05rem;
      opacity: 0.95;
      max-width: 650px;
      margin: 0 auto;
    }
    .stats-bar {
      margin-top: 1.25rem;
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 0.5rem;
    }
    .stat-pill {
      background: rgba(255, 255, 255, 0.2);
      backdrop-filter: blur(8px);
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .controls {
      background: var(--card-bg);
      border-radius: var(--radius);
      padding: 1.25rem;
      border: 1px solid var(--border);
      margin-bottom: 2rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .search-box {
      width: 100%;
      padding: 0.85rem 1.25rem;
      font-size: 1.1rem;
      font-family: 'Tajawal', sans-serif;
      border: 2px solid var(--border);
      border-radius: 0.75rem;
      outline: none;
      transition: all 0.2s;
      margin-bottom: 1rem;
    }
    .search-box:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(13, 148, 136, 0.15);
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .filter-btn {
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      font-size: 0.9rem;
      font-family: 'Tajawal', sans-serif;
      cursor: pointer;
      font-weight: 600;
      color: #475569;
      transition: all 0.2s;
    }
    .filter-btn:hover {
      background: #e2e8f0;
      color: #1e293b;
    }
    .filter-btn.active {
      background: var(--primary);
      color: white;
      border-color: var(--primary-dark);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 1.25rem;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.25rem;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.04);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px -2px rgba(0, 0, 0, 0.08);
      border-color: #cbd5e1;
    }
    .card-category {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      display: inline-block;
      margin-bottom: 0.75rem;
    }
    .card-category.single_word { background: #dcfce7; color: #166534; }
    .card-category.phoneme { background: #e0f2fe; color: #075985; }
    .card-category.instruction { background: #fef3c7; color: #92400e; }
    .card-category.praise { background: #fce7f3; color: #9d174d; }
    .card-category.pal { background: #f3e8ff; color: #6b21a8; }
    .card-category.other { background: #f1f5f9; color: #475569; }

    .card-text {
      font-size: 1.6rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.5;
      margin-bottom: 0.5rem;
      min-height: 2.4rem;
    }
    .card-aliases {
      font-size: 0.8rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      line-height: 1.4;
    }
    .card-meta {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .audio-player {
      width: 100%;
      height: 40px;
      outline: none;
      border-radius: 0.5rem;
    }
    .counter {
      font-weight: bold;
      color: var(--primary-dark);
      margin-top: 0.5rem;
      font-size: 0.9rem;
    }
    .download-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.75rem;
      transition: color 0.2s;
    }
    .download-link:hover {
      color: var(--primary);
    }
    .live-tester {
      background: #f0fdfa;
      border: 2px dashed #0d9488;
      border-radius: 1rem;
      padding: 1.25rem;
      margin-bottom: 2rem;
    }
    .live-tester h3 {
      font-size: 1.15rem;
      color: #0f766e;
      margin-bottom: 0.5rem;
    }
    .tester-row {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }
    .tester-input {
      flex: 1;
      padding: 0.65rem 1rem;
      font-size: 1.2rem;
      border: 1px solid #99f6e4;
      border-radius: 0.5rem;
    }
    .tester-btn {
      padding: 0.65rem 1.5rem;
      background: #0d9488;
      color: white;
      border: none;
      border-radius: 0.5rem;
      font-weight: bold;
      cursor: pointer;
      transition: background 0.2s;
    }
    .tester-btn:hover { background: #0f766e; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🎙️ مختبر مراجعة واستماع المقاطع الصوتية</h1>
      <p>هذه الصفحة تتيح لك الاستماع المباشر لكل المقاطع الصوتية الأصلية المعتمدة في منصة «هَيَّا نَقْرَأْ»، مع فحص مخارج الحروف، الكلمات المبتكرة، وبنود الفحص والتدريب دون أي تكرار.</p>
      <div class="stats-bar">
        <span class="stat-pill">📊 إجمالي المقاطع الصوتية الفريدة: ${entries.length} مقطعًا</span>
        <span class="stat-pill">✨ كلمات الفحص والقراءة: ${singleWordCount}</span>
        <span class="stat-pill">📖 أصوات ومقاطع الحروف: ${phonemeCount}</span>
        <span class="stat-pill">🎯 التوجيهات والتعليمات: ${instructionCount}</span>
        <span class="stat-pill">🌟 عبارات التشجيع: ${praiseCount}</span>
      </div>
    </header>

    <div class="live-tester">
      <h3>🔍 اختبار فوري لأي كلمة أو عبارة جديدة (Live Preview)</h3>
      <p style="font-size: 0.85rem; color: #115e59;">اكتب أي كلمة بتشكيلها (مثل: فُوبُو أو إِلَيْهِ) واضغط "استمع فورًا" لاختبار مخارج حروفها مباشرة:</p>
      <div class="tester-row">
        <input type="text" id="liveInput" class="tester-input arabic-text" value="فُوبُو" placeholder="اكتب الكلمة هنا...">
        <button type="button" class="tester-btn" onclick="playLiveCustom()">▶ استمع فورًا</button>
      </div>
      <audio id="livePlayer" style="display: none;"></audio>
    </div>

    <div class="controls">
      <input type="text" id="searchInput" class="search-box" placeholder="🔎 ابحث عن أي كلمة أو عبارة (مثال: فوب، سامي، إليه، أبيه، باك، جمل، دجاجة)..." oninput="filterClips()">
      <div class="filters">
        <button class="filter-btn active" onclick="setCategory('all', this)">الكل (${entries.length})</button>
        <button class="filter-btn" onclick="setCategory('single_word', this)">كلمات الفحص والقراءة (${singleWordCount})</button>
        <button class="filter-btn" onclick="setCategory('praise', this)">عبارات التشجيع (${praiseCount})</button>
        <button class="filter-btn" onclick="setCategory('instruction', this)">تعليمات الألعاب والفحص (${instructionCount})</button>
        <button class="filter-btn" onclick="setCategory('phoneme', this)">أصوات الحروف والمقاطع (${phonemeCount})</button>
        <button class="filter-btn" onclick="setCategory('pal', this)">التعلم المقترن (${palCount})</button>
      </div>
      <div class="counter" id="counterText">عرض ${entries.length} مقطعًا صوتيًا</div>
    </div>

    <div class="grid" id="clipsGrid">
      ${entries.map((c) => `
        <div class="card" data-category="${c.categoryKey}" data-search="${c.searchTerms.replace(/"/g, '&quot;')}">
          <div>
            <span class="card-category ${c.categoryKey}">${c.categoryLabel}</span>
            <div class="card-text arabic-text" lang="ar">${c.primaryText}</div>
            ${c.aliasesList.length > 0 ? `<div class="card-aliases">صيغ مطابقة: ${c.aliasesList.slice(0, 3).join(' ، ')}</div>` : ''}
          </div>
          <div>
            <div class="card-meta">
              <span>ملف: ${c.file}</span>
              <a href="${c.audioUrl}" download class="download-link" title="تنزيل الملف الصوتي">⬇ تنزيل</a>
            </div>
            <audio class="audio-player" controls preload="none">
              <source src="${c.audioUrl}" type="audio/mpeg">
              متصفحك لا يدعم مشغل الصوت.
            </audio>
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <script>
    let activeCategory = 'all';
    const grid = document.getElementById('clipsGrid');
    const cards = Array.from(grid.getElementsByClassName('card'));
    const counterText = document.getElementById('counterText');

    function filterClips() {
      const query = document.getElementById('searchInput').value.trim().toLowerCase();
      let visible = 0;

      cards.forEach(card => {
        const search = (card.getAttribute('data-search') || '').toLowerCase();
        const cat = card.getAttribute('data-category');
        const matchCat = activeCategory === 'all' || cat === activeCategory;
        const matchQuery = !query || search.includes(query);

        if (matchCat && matchQuery) {
          card.style.display = 'flex';
          visible++;
        } else {
          card.style.display = 'none';
        }
      });

      counterText.textContent = 'عرض ' + visible + ' من إجمالي ' + cards.length + ' مقطعًا صوتيًا';
    }

    function setCategory(cat, btn) {
      activeCategory = cat;
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterClips();
    }

    async function playLiveCustom() {
      const text = document.getElementById('liveInput').value.trim();
      if (!text) return;
      try {
        const res = await fetch('/api/ai/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.audioBase64) {
            const player = document.getElementById('livePlayer');
            player.src = 'data:audio/mp3;base64,' + data.audioBase64;
            player.play();
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.resolve('public/audio-audit.html'), html, 'utf8');
fs.writeFileSync(path.resolve('dist/audio-audit.html'), html, 'utf8');
console.log('Successfully generated deduplicated public/audio-audit.html and dist/audio-audit.html');
console.log(`Total unique audio clips displayed: ${entries.length}`);
