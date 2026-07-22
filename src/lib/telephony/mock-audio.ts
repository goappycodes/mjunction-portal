/**
 * Generates a small, valid mono 16-bit PCM WAV as a placeholder VOC recording.
 * A faint multi-tone so the file is real audio, not empty bytes.
 */
export function generateMockWav(durationSeconds: number): Uint8Array {
  const sampleRate = 8000;
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate));
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // faint blend of tones so the placeholder reads as speech-ish audio
    const sample =
      0.06 * Math.sin(2 * Math.PI * 320 * t) +
      0.04 * Math.sin(2 * Math.PI * 540 * t);
    view.setInt16(44 + i * bytesPerSample, sample * 32767, true);
  }

  return new Uint8Array(buffer);
}
