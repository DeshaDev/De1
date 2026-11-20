import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getIfmApiKey,
  transcribeArabicWithJaisAsr,
  diagnoseReadingErrorWithJais3,
  transliterateLatinToArabicWithJais,
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

  it('transliterateLatinToArabicWithJais returns clean text immediately if no Latin characters', async () => {
    const arabic = 'كَتَبَ التِّلْمِيذُ';
    const result = await transliterateLatinToArabicWithJais(arabic, 'fake-key');
    assert.equal(result, arabic);
  });
});
