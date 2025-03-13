/**
 * @function bufferToWave
 * @description 将 AudioBuffer 转换为 Blob
 * @param {AudioBuffer} audioBuffer
 * @param {number} len
 */
export function bufferToWave(audioBuffer: AudioBuffer, len: number): Blob {
  let numOfChan = audioBuffer.numberOfChannels,
    length = len * numOfChan * 2 + 44,
    buffer = new ArrayBuffer(length),
    view = new DataView(buffer),
    channels = [],
    i,
    sample,
    offset = 0,
    pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(audioBuffer.sampleRate);
  setUint32(audioBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this demo)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < audioBuffer.numberOfChannels; i++)
    channels.push(audioBuffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) {
      // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++; // next source sample
  }

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
  // create Blob
  return new Blob([buffer], { type: 'audio/wav' });
}

interface AudioBufferInfo {
  audioBuffer: AudioBuffer;
  frameCount: number;
}

export async function toAudioBuffer(
  buffer: ArrayBuffer,
  startTime: number,
  endTime: number
): Promise<AudioBufferInfo> {
  const audioContext = new window.AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(buffer); // ArrayBuffer转AudioBuffer[1,8](@ref)
  const channels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const startOffset = Math.floor(startTime * sampleRate);
  const endOffset = Math.floor(endTime * sampleRate);

  const frameCount = endOffset - startOffset;
  const newAudioBuffer = audioContext.createBuffer(
    channels,
    frameCount,
    sampleRate
  );
  const anotherArray = new Float32Array(frameCount);
  for (let channel = 0; channel < channels; channel++) {
    audioBuffer.copyFromChannel(anotherArray, channel, startOffset);
    newAudioBuffer.copyToChannel(anotherArray, channel, 0);
  }
  return { audioBuffer: newAudioBuffer, frameCount };
}
