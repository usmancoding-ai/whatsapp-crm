import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import path from 'path';
import fs from 'fs';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

export const convertToWhatsAppVoiceNote = (inputPath) => {
  return new Promise((resolve, reject) => {
    const outputPath = path.join(
      path.dirname(inputPath),
      `ptt_${Date.now()}.ogg`
    );

    ffmpeg(inputPath)
      .toFormat('ogg')
      .audioCodec('libopus')
      .audioChannels(1) // WhatsApp voice notes must be mono.
      .audioFrequency(16000) // Use the standard 16 kHz PTT sample rate.
      .addOutputOption('-application', 'voip') // Use VOIP mode to generate a PTT waveform.
      .on('end', () => {
        if (fs.existsSync(inputPath)) {
          fs.unlinkSync(inputPath);
        }
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('Audio conversion error:', err);
        reject(err);
      })
      .save(outputPath);
  });
};