/**
 * DimmingLab - Search Worker Client
 * Ergonomic wrapper for managing search worker lifecycle, job cancellation,
 * and promise-based execution.
 * 
 * Settle promise exactly once, detach listeners, terminate worker on cancel,
 * and spawn fresh worker so running synchronous loops abort instantly.
 */

import { LightCurvePoint, SearchCandidate, SearchProgress } from '../domain/types';
import { SearchConfig } from '../engine/search';
import { WorkerInMessage, WorkerOutMessage } from './searchWorker';

export interface SearchTaskHandlers {
  onProgress?: (progress: SearchProgress) => void;
}

export class SearchWorkerClient {
  private worker: Worker | null = null;
  private currentJobId: string | null = null;
  private rejectCurrent: ((reason: Error) => void) | null = null;
  private activeMessageHandler: ((e: MessageEvent<WorkerOutMessage>) => void) | null = null;

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    try {
      this.worker = new Worker(new URL('./searchWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      // In SSR or non-worker test environments, worker may fail to construct
      this.worker = null;
    }
  }

  /**
   * Cancels any active search job, immediately terminating the worker thread
   * and settling the promise.
   */
  public cancelActiveSearch() {
    if (this.currentJobId) {
      const cancelledId = this.currentJobId;
      this.currentJobId = null;

      // Settle promise once with an explicit cancellation error
      if (this.rejectCurrent) {
        const rejectFn = this.rejectCurrent;
        this.rejectCurrent = null;
        rejectFn(new Error('Search was cancelled by user'));
      }

      // Detach listeners and terminate worker immediately so ongoing computations abort
      if (this.worker) {
        if (this.activeMessageHandler) {
          this.worker.removeEventListener('message', this.activeMessageHandler);
          this.activeMessageHandler = null;
        }
        try {
          const msg: WorkerInMessage = {
            type: 'CANCEL_SEARCH',
            jobId: cancelledId,
          };
          this.worker.postMessage(msg);
        } catch {
          // ignore error if worker is already shutting down
        }
        this.worker.terminate();
        this.worker = null;
      }

      // Recreate fresh worker for subsequent searches
      this.initWorker();
    }
  }

  /**
   * Starts a new periodic search job. Cancels any currently running job.
   */
  public startSearch(
    points: readonly LightCurvePoint[],
    config: SearchConfig,
    handlers?: SearchTaskHandlers
  ): Promise<SearchCandidate[]> {
    // Cancel any previous search before starting new one
    this.cancelActiveSearch();

    const jobId = 'job_' + Math.random().toString(36).substring(2, 9);
    this.currentJobId = jobId;

    return new Promise<SearchCandidate[]>((resolve, reject) => {
      this.rejectCurrent = reject;

      if (!this.worker) {
        // Fallback: run synchronously if workers not supported in environment
        try {
          import('../engine/search').then(({ runPeriodicSearch }) => {
            if (this.currentJobId !== jobId) return; // cancelled during import
            const results = runPeriodicSearch(points, config);
            this.currentJobId = null;
            this.rejectCurrent = null;
            resolve(results);
          }).catch((err) => {
            if (this.currentJobId !== jobId) return;
            this.currentJobId = null;
            this.rejectCurrent = null;
            reject(err);
          });
        } catch (e) {
          this.currentJobId = null;
          this.rejectCurrent = null;
          reject(e instanceof Error ? e : new Error(String(e)));
        }
        return;
      }

      const messageHandler = (e: MessageEvent<WorkerOutMessage>) => {
        const data = e.data;
        if (data.jobId !== jobId || this.currentJobId !== jobId) return;

        if (data.type === 'PROGRESS') {
          if (handlers?.onProgress) {
            handlers.onProgress({
              jobId: data.jobId,
              progressPercent: data.progressPercent,
              trialCount: data.trialCount,
              totalTrials: config.periodSteps,
              bestCandidateSoFar: data.bestCandidateSoFar,
            });
          }
        } else if (data.type === 'DONE') {
          this.cleanup();
          resolve(data.candidates);
        } else if (data.type === 'ERROR') {
          this.cleanup();
          reject(new Error(data.error));
        }
      };

      this.activeMessageHandler = messageHandler;
      this.worker.addEventListener('message', messageHandler);

      const startMsg: WorkerInMessage = {
        type: 'START_SEARCH',
        jobId,
        points,
        config,
      };

      this.worker.postMessage(startMsg);
    });
  }

  private cleanup() {
    if (this.worker && this.activeMessageHandler) {
      this.worker.removeEventListener('message', this.activeMessageHandler);
      this.activeMessageHandler = null;
    }
    this.currentJobId = null;
    this.rejectCurrent = null;
  }

  /**
   * Destroys client and terminates any worker thread
   */
  public destroy() {
    this.cancelActiveSearch();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
