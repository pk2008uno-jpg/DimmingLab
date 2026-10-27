/**
 * DimmingLab - Periodic Search Web Worker
 * Runs computationally intensive frequency scans off the main UI thread.
 * Supports cancellation and live progress updates.
 */

import { LightCurvePoint, SearchCandidate } from '../domain/types';
import { runPeriodicSearch, SearchConfig } from '../engine/search';

export type WorkerInMessage =
  | {
      type: 'START_SEARCH';
      jobId: string;
      points: readonly LightCurvePoint[];
      config: SearchConfig;
    }
  | {
      type: 'CANCEL_SEARCH';
      jobId: string;
    };

export type WorkerOutMessage =
  | {
      type: 'PROGRESS';
      jobId: string;
      progressPercent: number;
      trialCount: number;
      bestCandidateSoFar?: SearchCandidate;
    }
  | {
      type: 'DONE';
      jobId: string;
      candidates: SearchCandidate[];
      elapsedMs: number;
    }
  | {
      type: 'ERROR';
      jobId: string;
      error: string;
    };

let activeJobId: string | null = null;
let cancelRequested = false;

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const msg = e.data;

  if (msg.type === 'CANCEL_SEARCH') {
    if (activeJobId === msg.jobId) {
      cancelRequested = true;
    }
    return;
  }

  if (msg.type === 'START_SEARCH') {
    activeJobId = msg.jobId;
    cancelRequested = false;
    const startTime = performance.now();

    try {
      const candidates = runPeriodicSearch(
        msg.points,
        msg.config,
        (progressPercent, trialCount, bestCandidate) => {
          if (cancelRequested || activeJobId !== msg.jobId) {
            return true; // abort search
          }

          const progressMsg: WorkerOutMessage = {
            type: 'PROGRESS',
            jobId: msg.jobId,
            progressPercent,
            trialCount,
            bestCandidateSoFar: bestCandidate,
          };
          self.postMessage(progressMsg);
          return false;
        }
      );

      if (cancelRequested || activeJobId !== msg.jobId) {
        return; // Stale or cancelled job, do not post DONE
      }

      const elapsedMs = performance.now() - startTime;
      const doneMsg: WorkerOutMessage = {
        type: 'DONE',
        jobId: msg.jobId,
        candidates,
        elapsedMs,
      };
      self.postMessage(doneMsg);
    } catch (err: unknown) {
      const errorStr = err instanceof Error ? err.message : String(err);
      const errorMsg: WorkerOutMessage = {
        type: 'ERROR',
        jobId: msg.jobId,
        error: errorStr,
      };
      self.postMessage(errorMsg);
    } finally {
      if (activeJobId === msg.jobId) {
        activeJobId = null;
      }
    }
  }
};
