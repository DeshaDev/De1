import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getIfmApiKey,
  transcribeArabicWithJaisAsr,
  transliterateLatinToArabic,
  isAudioPracticallySilent,
  stripCarrierAndCollapseSingleWord,
  frameSingleWordWithCarrier,
} from './ifmAudioAssessment';

describe('IFM Audio Assessment Unit Tests', () => {
  it('getIfmApiKey reads from process.env and ignores placeholders', () => {
    const origIfm = process.env.IFM_API_KEY;
    const origVite = process.env.VITE_IFM_API_KEY;
    try {
      process.env.IFM_API_KEY = '  IFM-v1_TestKey123  ';
      delete process.env.VITE_IFM_API_KEY;
      assert.equal(getIfmApiKey(), 'IFM-v1_TestKey123');

      process.env.IFM_API_KEY = 'MY_IFM_API_KEY';
      assert.equal(getIfmApiKey(), null);

      process.env.IFM_API_KEY = 'YOUR_IFM_API_KEY';
      assert.equal(getIfmApiKey(), null);

      process.env.IFM_API_KEY = '';
      process.env.VITE_IFM_API_KEY = 'IFM-v1_ViteKey456';
      assert.equal(getIfmApiKey(), 'IFM-v1_ViteKey456');

      process.env.VITE_IFM_API_KEY = '';
      assert.equal(getIfmApiKey(), null);
    } finally {
      process.env.IFM_API_KEY = origIfm;
      process.env.VITE_IFM_API_KEY = origVite;
    }
  });

  it('rejects invalid or empty audio payloads before calling network', async () => {
    await assert.rejects(
      () => transcribeArabicWithJaisAsr({
        audioWavBase64: '',
      }),
      /INVALID_AUDIO_PAYLOAD/
    );

    await assert.rejects(
      () => transcribeArabicWithJaisAsr({
        audioWavBase64: 'A'.repeat(7_000_000),
      }),
      /INVALID_AUDIO_PAYLOAD/
    );
  });

  it('transliterateLatinToArabic translates phonetics to Arabic instantaneously', () => {
    assert.equal(transliterateLatinToArabic('كَتَبَ التِّلْمِيذُ'), 'كَتَبَ التِّلْمِيذُ');
    assert.equal(transliterateLatinToArabic('fob'), 'فُوب');
    assert.equal(transliterateLatinToArabic('foob'), 'فُوب');
    assert.equal(transliterateLatinToArabic('kataba'), 'كَتَبَ');
    assert.doesNotMatch(transliterateLatinToArabic('mate'), /[a-zA-Z]/);
    assert.doesNotMatch(transliterateLatinToArabic('wallet'), /[a-zA-Z]/);
    assert.doesNotMatch(transliterateLatinToArabic('capex'), /[a-zA-Z]/);
  });

  it('stripCarrierAndCollapseSingleWord removes carrier prefix and collapses 2x repetitions', () => {
    assert.equal(stripCarrierAndCollapseSingleWord('هَذِهِ بَابْ، بَابْ.'), 'بَابْ');
    assert.equal(stripCarrierAndCollapseSingleWord('هذه بيت، بَيْتْ.'), 'بَيْتْ');
    assert.equal(stripCarrierAndCollapseSingleWord('هَذِهِ يَدٌ، يَدٌ.'), 'يَدٌ');
    assert.equal(stripCarrierAndCollapseSingleWord('هذه:'), '');
    assert.equal(stripCarrierAndCollapseSingleWord('فُوب'), 'فُوب');
  });

  it('frameSingleWordWithCarrier produces a valid enlarged 16kHz PCM WAV', () => {
    const wordWav = Buffer.alloc(44 + 16000);
    wordWav.write('RIFF', 0);
    wordWav.write('WAVE', 8);
    wordWav.write('fmt ', 12);
    wordWav.write('data', 36);
    for (let i = 44; i < wordWav.length; i += 2) {
      wordWav.writeInt16LE(3000, i);
    }
    const framed = frameSingleWordWithCarrier(wordWav);
    assert.ok(framed.length > wordWav.length * 2);
    assert.equal(framed.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(framed.subarray(8, 12).toString('ascii'), 'WAVE');
  });

  it('isAudioPracticallySilent detects silent PCM WAV and distinguishes real audio', () => {
    // 0.5s of silent PCM audio
    const silentWav = Buffer.alloc(44 + 16000);
    silentWav.write('RIFF', 0);
    silentWav.write('WAVE', 8);
    silentWav.write('fmt ', 12);
    silentWav.write('data', 36);
    assert.equal(isAudioPracticallySilent(silentWav), true);

    // Audio with audible signal
    const loudWav = Buffer.from(silentWav);
    for (let i = 44; i < loudWav.length; i += 2) {
      loudWav.writeInt16LE(2500, i);
    }
    assert.equal(isAudioPracticallySilent(loudWav), false);
  });

  it('transcribeArabicWithJaisAsr returns isSilent=true immediately for silent audio without network call', async () => {
    const silentWav = Buffer.alloc(44 + 16000);
    silentWav.write('RIFF', 0);
    silentWav.write('WAVE', 8);
    silentWav.write('fmt ', 12);
    silentWav.write('data', 36);
    const base64 = silentWav.toString('base64');

    const res = await transcribeArabicWithJaisAsr({
      audioWavBase64: base64,
      apiKey: 'IFM-v1_test_dummy_key',
    });
    assert.equal(res.isSilent, true);
    assert.equal(res.transcript, '');
    assert.equal(res.sourceModel, 'ifm/jais-asr');
  });
});
