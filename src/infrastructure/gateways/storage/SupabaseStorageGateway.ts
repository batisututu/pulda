/**
 * Supabase Storage implementation of IStorageGateway.
 * Manages exam image uploads in the "exam-images" bucket.
 *
 * File path convention: {userId}/{examId}/{filename}
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { IStorageGateway } from '@/domain/ports/gateways/IStorageGateway';

const BUCKET = 'exam-images';
const DEFAULT_SIGNED_URL_EXPIRY = 3600; // 1 hour

export class SupabaseStorageGateway implements IStorageGateway {
  constructor(private readonly db: SupabaseClient) {}

  async upload(userId: string, examId: string, file: File): Promise<string> {
    const path = `${userId}/${examId}/${file.name}`;

    const { data, error } = await this.db.storage
      .from(BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Return the full storage path for later retrieval
    return data.path;
  }

  async delete(path: string): Promise<void> {
    const { error } = await this.db.storage.from(BUCKET).remove([path]);

    if (error) {
      throw new Error(`Storage delete failed: ${error.message}`);
    }
  }

  async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
    const { data, error } = await this.db.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresIn ?? DEFAULT_SIGNED_URL_EXPIRY);

    if (error) {
      throw new Error(`Storage getSignedUrl failed: ${error.message}`);
    }

    return data.signedUrl;
  }
}
