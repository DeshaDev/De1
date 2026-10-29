/**
 * Pre-launch content review (opened with ?review=1; not linked from the product).
 * A specialist goes through every word, picture, item, exercise, passage, report text and
 * audio clip exactly as the child sees and hears it, marks each one correct or needing a
 * change with a note, and exports the decisions for the development team.
 * Decisions are kept in this browser until exported; nothing is sent anywhere.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, Download, Pencil, Upload, Volume2 } from 'lucide-react';
import { buildReviewUnits, SECTION_META, type ReviewSection, type ReviewUnit } from '../../review/itemBank';
import machineFlags from '../../review/machineFlags.json';
import { speak, stopSpeech } from '../profile/audio';

type Verdict = 'ok' | 'fix';
interface Decision { verdict: Verdict; note: string; at: string; reviewer: string }
type Decisions = Record<string, Decision>;

const STORE_KEY = 'baseera.contentReview.v1';
const PAGE_SIZE = 20;
const ar = (v: number | string) => String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
const SECTIONS = Object.keys(SECTION_META) as ReviewSection[];
type Filter = 'all' | 'todo' | 'fix' | 'flagged';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: decisions stay in memory until exported */
  }
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export const ContentReviewView: React.FC = () => {
  const [units, setUnits] = useState<ReviewUnit[] | null>(null);
  const [section, setSection] = useState<ReviewSection>('battery');
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(0);
  const [decisions, setDecisions] = useState<Decisions>(() => load(STORE_KEY, {}));
  const [reviewer, setReviewer] = useState<string>(() => load(`${STORE_KEY}.reviewer`, ''));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/audio/v1/manifest.json')
      .then((r) => (r.ok ? r.json() : undefined))
      .catch(() => undefined)
      .then((manifest) => {
        const built = buildReviewUnits(manifest);
        const extra = machineFlags as Record<string, string[]>;
        setUnits(built.map((u) => ({ ...u, flagsAr: [...u.flagsAr, ...(extra[u.id] ?? [])] })));
      });
    return () => stopSpeech();
  }, []);
  useEffect(() => save(STORE_KEY, decisions), [decisions]);
  useEffect(() => save(`${STORE_KEY}.reviewer`, reviewer), [reviewer]);

  const inSection = useMemo(() => (units ?? []).filter((u) => u.section === section), [units, section]);
  const visible = useMemo(
    () =>
      inSection.filter((u) =>
        filter === 'all' ? true : filter === 'todo' ? !decisions[u.id] : filter === 'fix' ? decisions[u.id]?.verdict === 'fix' : u.flagsAr.length > 0
      ),
    [inSection, filter, decisions]
  );
  const pageUnits = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));

  const decide = (unit: ReviewUnit, verdict: Verdict) => {
    const note = (drafts[unit.id] ?? decisions[unit.id]?.note ?? '').trim();
    if (verdict === 'fix' && !note) return;
    setDecisions((d) => ({ ...d, [unit.id]: { verdict, note, at: new Date().toISOString(), reviewer: reviewer.trim() } }));
  };

  const total = units?.length ?? 0;
  const done = Object.keys(decisions).length;
  const toFix = Object.values(decisions).filter((d) => d.verdict === 'fix').length;
  const sectionDone = (s: ReviewSection) => (units ?? []).filter((u) => u.section === s && decisions[u.id]).length;
  const sectionTotal = (s: ReviewSection) => (units ?? []).filter((u) => u.section === s).length;

  const exportJson = () =>
    download(
      `baseera-content-review-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), reviewer, total, decisions }, null, 2),
      'application/json'
    );
  const exportCsv = () => {
    const byId = new Map((units ?? []).map((u) => [u.id, u]));
    const rows = [['المعرّف', 'القسم', 'العنوان', 'القرار', 'الملاحظة', 'المراجع', 'التاريخ']];
    for (const [id, d] of Object.entries(decisions)) {
      const u = byId.get(id);
      rows.push([id, u ? SECTION_META[u.section].titleAr : '', u?.titleAr ?? '', d.verdict === 'ok' ? 'صحيح' : 'يحتاج تعديلًا', d.note, d.reviewer, d.at]);
    }
    const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    download(`baseera-content-review-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  };
  const importJson = (file: File) => {
    file.text().then((t) => {
      try {
        const data = JSON.parse(t) as { decisions?: Decisions; reviewer?: string };
        if (data.decisions) setDecisions((d) => ({ ...d, ...data.decisions }));
        if (data.reviewer && !reviewer) setReviewer(data.reviewer);
      } catch {
        /* not a review export */
      }
    });
  };

  if (!units) return <p className="py-24 text-center bz-muted" role="status">جارٍ تحميل المحتوى…</p>;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="space-y-3">
        <span className="bz-eyebrow">قبل الإطلاق · للمراجع المتخصص</span>
        <h1 className="bz-h2">مراجعة محتوى بصيرة</h1>
        <p className="bz-body max-w-3xl">
          كل كلمة وصورة وبند وتمرين ونص ومقطع صوتي، كما يراه الطفل ويسمعه. علّم كل وحدة «صحيح» أو «يحتاج تعديلًا» مع ملاحظة، ثم صدّر القرارات وأرسلها لفريق التطوير. تُحفظ القرارات في هذا المتصفح فقط حتى تصدّرها.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="bz-field">
            <span className="bz-label">اسم المراجع وتخصصه</span>
            <input className="bz-input" value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="مثال: د. … — أخصائية تخاطب" />
          </label>
          <div className="bz-small text-ink-2 pb-2">
            رُوجع <strong className="bz-num">{ar(done)}</strong> من <strong className="bz-num">{ar(total)}</strong> · يحتاج تعديلًا <strong className="bz-num">{ar(toFix)}</strong>
          </div>
          <div className="flex flex-wrap gap-2 ms-auto">
            <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" onClick={exportJson} disabled={done === 0}><Download className="w-4 h-4" /> تصدير القرارات</button>
            <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" onClick={exportCsv} disabled={done === 0}><Download className="w-4 h-4" /> جدول للطباعة</button>
            <label className="bz-btn bz-btn-ghost bz-btn-sm cursor-pointer">
              <Upload className="w-4 h-4" /> متابعة مراجعة سابقة
              <input type="file" accept="application/json" className="sr-only" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </label>
          </div>
        </div>
        <div className="bz-progress" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
      </header>

      <div className="bz-segment" role="tablist" aria-label="أقسام المراجعة">
        {SECTIONS.map((s) => (
          <button key={s} type="button" role="tab" aria-selected={section === s} onClick={() => { setSection(s); setPage(0); }}>
            {SECTION_META[s].titleAr} <span className="bz-num bz-muted">{ar(sectionDone(s))}/{ar(sectionTotal(s))}</span>
          </button>
        ))}
      </div>

      <div className="bz-card bz-card-pad space-y-3">
        <p className="text-ink"><strong>ما الذي نتحقق منه هنا؟</strong> {SECTION_META[section].questionAr}</p>
        <div className="bz-segment" role="radiogroup" aria-label="عرض">
          {([['all', 'الكل'], ['todo', 'لم يُراجع'], ['flagged', 'نبّه إليه الفحص الآلي'], ['fix', 'يحتاج تعديلًا']] as Array<[Filter, string]>).map(([f, label]) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} aria-pressed={filter === f} onClick={() => { setFilter(f); setPage(0); }}>{label}</button>
          ))}
        </div>
        <p className="bz-small bz-muted">المعروض: {ar(visible.length)} وحدة.</p>
      </div>

      <div className="space-y-4">
        {pageUnits.map((u) => {
          const d = decisions[u.id];
          const note = drafts[u.id] ?? d?.note ?? '';
          return (
            <article key={u.id} className={`bz-card bz-card-pad space-y-4 ${d?.verdict === 'fix' ? 'border-warn' : d?.verdict === 'ok' ? 'border-brand' : ''}`} style={{ borderWidth: d ? 2 : undefined }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="bz-h3" style={{ fontSize: 20 }}>{u.titleAr}</h2>
                  {u.subtitleAr && <p className="bz-small bz-muted mt-1">{u.subtitleAr}</p>}
                </div>
                <code className="bz-small bz-muted" dir="ltr">{u.id}</code>
              </div>

              {u.flagsAr.length > 0 && (
                <ul className="rounded-xl bg-warn-soft p-3 bz-small text-ink-2 space-y-1">
                  {u.flagsAr.map((f) => <li key={f} className="flex gap-2"><AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" /> {f}</li>)}
                </ul>
              )}

              <dl className="divide-y divide-line">
                {u.fields.map((f, i) => (
                  <div key={i} className="grid grid-cols-[8.5rem_1fr] gap-3 py-2 items-center">
                    <dt className="bz-small bz-muted">{f.labelAr}</dt>
                    <dd className={`flex items-center gap-3 ${f.correct ? 'font-semibold text-brand' : 'text-ink'}`}>
                      {f.picture && <span className="text-4xl leading-none" aria-hidden="true">{f.picture}</span>}
                      <span className="text-lg leading-loose">{f.text}</span>
                      {f.correct && <Check className="w-4 h-4 shrink-0" aria-label="الإجابة الصحيحة" />}
                      {f.audio && (
                        <button type="button" className="bz-icon-btn shrink-0" aria-label={`استمع: ${f.audio}`} onClick={() => { stopSpeech(); void speak(f.audio!); }}>
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="space-y-2">
                <textarea
                  className="bz-input"
                  rows={2}
                  value={note}
                  onChange={(e) => setDrafts((x) => ({ ...x, [u.id]: e.target.value }))}
                  placeholder="الملاحظة: ما الخطأ، وما البديل المقترح؟ (مطلوبة عند «يحتاج تعديلًا»)"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="bz-btn bz-btn-primary bz-btn-sm" aria-pressed={d?.verdict === 'ok'} onClick={() => decide(u, 'ok')}><Check className="w-4 h-4" /> صحيح</button>
                  <button type="button" className="bz-btn bz-btn-secondary bz-btn-sm" aria-pressed={d?.verdict === 'fix'} disabled={!note.trim()} onClick={() => decide(u, 'fix')}><Pencil className="w-4 h-4" /> يحتاج تعديلًا</button>
                  {d && <span className="bz-small bz-muted">{d.verdict === 'ok' ? 'عُلّم صحيحًا' : 'عُلّم للتعديل'}{d.reviewer ? ` — ${d.reviewer}` : ''}</span>}
                </div>
              </div>
            </article>
          );
        })}
        {pageUnits.length === 0 && <p className="bz-card bz-card-pad text-center bz-muted">لا توجد وحدات في هذا العرض.</p>}
      </div>

      {pages > 1 && (
        <nav className="flex items-center justify-center gap-3" aria-label="الصفحات">
          <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" disabled={page === 0} onClick={() => { setPage((p) => p - 1); window.scrollTo(0, 0); }}>السابق</button>
          <span className="bz-small bz-num">صفحة {ar(page + 1)} من {ar(pages)}</span>
          <button type="button" className="bz-btn bz-btn-ghost bz-btn-sm" disabled={page >= pages - 1} onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}>التالي</button>
        </nav>
      )}
    </div>
  );
};

export default ContentReviewView;
