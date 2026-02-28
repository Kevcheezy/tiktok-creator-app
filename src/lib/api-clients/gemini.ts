import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { createLogger } from '@/lib/logger';

const logger = createLogger({ agentName: 'GeminiClient' });

export class GeminiClient {
  private genAI: GoogleGenerativeAI;
  private fileManager: GoogleAIFileManager;
  private model: string;

  constructor(apiKey?: string, model = 'gemini-2.5-flash') {
    const key = apiKey || process.env.GOOGLE_API_KEY || '';
    if (!key) {
      logger.warn('No GOOGLE_API_KEY provided');
    }
    this.genAI = new GoogleGenerativeAI(key);
    this.fileManager = new GoogleAIFileManager(key);
    this.model = model;
  }

  async analyzeVideo(
    filePath: string,
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxTokens?: number }
  ): Promise<string> {
    const start = Date.now();
    const UPLOAD_TIMEOUT_MS = 60_000;
    const GENERATE_TIMEOUT_MS = 180_000;

    // 1. Upload the video file (with 60s timeout)
    logger.info({ filePath }, 'Uploading video to Gemini File API');
    const uploadResult = await Promise.race([
      this.fileManager.uploadFile(filePath, {
        mimeType: 'video/mp4',
        displayName: filePath.split('/').pop() || 'reference-video',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini file upload timed out after ${UPLOAD_TIMEOUT_MS / 1000}s`)), UPLOAD_TIMEOUT_MS)
      ),
    ]);

    let file = uploadResult.file;
    const uploadMs = Date.now() - start;
    logger.info({ fileName: file.name, state: file.state, uploadMs }, 'File uploaded, waiting for processing');

    // 2. Poll until file is ACTIVE (processed)
    const pollStart = Date.now();
    const maxPollMs = 120_000;
    while (file.state === FileState.PROCESSING) {
      if (Date.now() - pollStart > maxPollMs) {
        throw new Error(`Gemini file processing timed out after ${maxPollMs / 1000}s`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const result = await this.fileManager.getFile(file.name);
      file = result;
    }

    if (file.state === FileState.FAILED) {
      throw new Error(`Gemini file processing failed for ${file.name}`);
    }

    logger.info({ fileName: file.name, processingMs: Date.now() - pollStart }, 'File ready for analysis');

    // 3. Send to generateContent with video + text (with 180s timeout)
    const model = this.genAI.getGenerativeModel({
      model: this.model,
      systemInstruction: systemPrompt,
    });

    logger.info('Starting generateContent call');
    const result = await Promise.race([
      model.generateContent([
        {
          fileData: {
            mimeType: file.mimeType,
            fileUri: file.uri,
          },
        },
        { text: userPrompt },
      ]),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Gemini generateContent timed out after ${GENERATE_TIMEOUT_MS / 1000}s`)), GENERATE_TIMEOUT_MS)
      ),
    ]);

    const responseText = result.response.text();
    const totalMs = Date.now() - start;
    logger.info({ totalMs, responseLength: responseText.length }, 'Video analysis complete');

    // 4. Clean up the uploaded file (fire-and-forget)
    this.fileManager.deleteFile(file.name).catch((err) => {
      logger.warn({ fileName: file.name, err }, 'Failed to delete uploaded file from Gemini');
    });

    return responseText;
  }
}
