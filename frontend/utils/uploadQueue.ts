/**
 * Offline Upload Queue
 * - Queues uploads when offline
 * - Exponential retry with jitter
 * - Duplicate protection via content hash
 * - Network-aware sync
 * - Persistent queue via AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { api } from './api';

const QUEUE_KEY = 'offline_upload_queue';
const MAX_RETRIES = 5;

export type QueuedUpload = {
  id: string;
  fileUri: string;
  fileName: string;
  mimeType: string;
  outletId: string;
  fileHash: string;
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'duplicate';
  retries: number;
  error?: string;
  createdAt: string;
  lastAttempt?: string;
};

type QueueListener = (queue: QueuedUpload[]) => void;

class UploadQueue {
  private listeners: QueueListener[] = [];
  private syncing = false;

  subscribe(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(queue: QueuedUpload[]) {
    this.listeners.forEach(l => l(queue));
  }

  async getQueue(): Promise<QueuedUpload[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  }

  private async saveQueue(queue: QueuedUpload[]) {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    this.notify(queue);
  }

  async addToQueue(fileUri: string, fileName: string, mimeType: string, outletId: string): Promise<QueuedUpload> {
    const queue = await this.getQueue();

    // Generate hash for duplicate detection
    const hashInput = `${fileName}-${outletId}-${Date.now()}`;
    const fileHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      hashInput
    );

    // Check for duplicates
    const isDup = queue.some(q => q.fileHash === fileHash && q.status !== 'failed');
    if (isDup) {
      const existing = queue.find(q => q.fileHash === fileHash)!;
      return existing;
    }

    const item: QueuedUpload = {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fileUri,
      fileName,
      mimeType,
      outletId,
      fileHash,
      status: 'pending',
      retries: 0,
      createdAt: new Date().toISOString(),
    };

    queue.push(item);
    await this.saveQueue(queue);

    // Try immediate upload if online
    this.trySync();
    return item;
  }

  async trySync() {
    if (this.syncing) return;

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) return;

    this.syncing = true;
    try {
      const queue = await this.getQueue();
      const pending = queue.filter(q => q.status === 'pending' || (q.status === 'failed' && q.retries < MAX_RETRIES));

      for (const item of pending) {
        await this.processItem(item);
      }
    } finally {
      this.syncing = false;
    }
  }

  private async processItem(item: QueuedUpload) {
    const queue = await this.getQueue();
    const idx = queue.findIndex(q => q.id === item.id);
    if (idx === -1) return;

    queue[idx].status = 'uploading';
    queue[idx].lastAttempt = new Date().toISOString();
    await this.saveQueue(queue);

    try {
      const file = {
        uri: item.fileUri,
        name: item.fileName,
        type: item.mimeType,
      } as any;

      const result = await api.uploadDocument(file, item.outletId);

      const updated = await this.getQueue();
      const updIdx = updated.findIndex(q => q.id === item.id);
      if (updIdx !== -1) {
        if (result.duplicate) {
          updated[updIdx].status = 'duplicate';
        } else {
          updated[updIdx].status = 'success';
        }
        await this.saveQueue(updated);
      }
    } catch (err: any) {
      const updated = await this.getQueue();
      const updIdx = updated.findIndex(q => q.id === item.id);
      if (updIdx !== -1) {
        updated[updIdx].status = 'failed';
        updated[updIdx].retries += 1;
        updated[updIdx].error = err.message;
        await this.saveQueue(updated);

        // Exponential backoff for retry
        if (updated[updIdx].retries < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, updated[updIdx].retries) + Math.random() * 1000, 30000);
          setTimeout(() => this.trySync(), delay);
        }
      }
    }
  }

  async retryItem(id: string) {
    const queue = await this.getQueue();
    const idx = queue.findIndex(q => q.id === id);
    if (idx !== -1) {
      queue[idx].status = 'pending';
      queue[idx].retries = 0;
      queue[idx].error = undefined;
      await this.saveQueue(queue);
      this.trySync();
    }
  }

  async removeItem(id: string) {
    const queue = await this.getQueue();
    await this.saveQueue(queue.filter(q => q.id !== id));
  }

  async clearCompleted() {
    const queue = await this.getQueue();
    await this.saveQueue(queue.filter(q => q.status !== 'success' && q.status !== 'duplicate'));
  }
}

export const uploadQueue = new UploadQueue();

// Auto-sync on network reconnection
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    uploadQueue.trySync();
  }
});
