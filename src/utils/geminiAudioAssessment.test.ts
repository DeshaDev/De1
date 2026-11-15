import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getGeminiApiKey, assessReadingAudioWithGemini } from './geminiAudioAssessment';

describe('Gemini Audio Assessment Unit Tests', () => {
  it('getGeminiApiKey reads from process.env and ignores placeholders', () => {
    const orig = process.env.GEMINI_API_KEY;
    try {
      process.env.GEMINI_API_KEY = '  AIzaSyTest123  ';
      assert.equal(getGeminiApiKey(), 'AIzaSyTest123');

      process.env.GEMINI_API_KEY = 'MY_GEMINI_API_KEY';
      assert.equal(getGeminiApiKey(), null);

      process.env.GEMINI_API_KEY = '';
      assert.equal(getGeminiApiKey(), null);
    } finally {
      process.env.GEMINI_API_KEY = orig;
    }
  });

  it('rejects empty reference text or empty audio payload before calling network', async () => {
    await assert.rejects(
      () => assessReadingAudioWithGemini({
        referenceText: '',
        audioWavBase64: 'AAAA',
      }),
      /INVALID_REFERENCE_TEXT/
    );

    await assert.rejects(
      () => assessReadingAudioWithGemini({
        referenceText: 'كِتَابْ',
        audioWavBase64: '',
      }),
      /INVALID_AUDIO_PAYLOAD/
    );
  });
});
