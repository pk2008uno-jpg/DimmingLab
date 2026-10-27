/**
 * DimmingLab - IndexedDB Local Persistence via Dexie
 * Saves active student investigation state, evidence reports, and offline datasets.
 */

import Dexie, { type Table } from 'dexie';
import { InvestigationProject, LightCurveData } from '../domain/types';

export class DimmingLabDatabase extends Dexie {
  projects!: Table<InvestigationProject, string>;
  cachedDatasets!: Table<LightCurveData, string>;

  constructor() {
    super('DimmingLabDB');

    this.version(1).stores({
      projects: 'datasetId, updatedAt',
      cachedDatasets: 'manifest.id, manifest.version',
    });
  }
}

export const db = new DimmingLabDatabase();

/**
 * Saves current investigation state
 */
export async function saveActiveProject(project: InvestigationProject): Promise<void> {
  project.updatedAt = new Date().toISOString();
  await db.projects.put(project);
}

/**
 * Loads project for a specific dataset
 */
export async function loadActiveProject(datasetId: string): Promise<InvestigationProject | undefined> {
  return await db.projects.get(datasetId);
}

/**
 * Lists all saved investigations
 */
export async function listAllProjects(): Promise<InvestigationProject[]> {
  return await db.projects.orderBy('updatedAt').reverse().toArray();
}

/**
 * Deletes a specific saved project
 */
export async function deleteProject(datasetId: string): Promise<void> {
  await db.projects.delete(datasetId);
}

/**
 * Caches dataset points locally for offline use
 */
export async function cacheDatasetLocally(data: LightCurveData): Promise<void> {
  await db.cachedDatasets.put(data);
}

/**
 * Retrieves locally cached dataset
 */
export async function getCachedDataset(datasetId: string): Promise<LightCurveData | undefined> {
  return await db.cachedDatasets.get(datasetId);
}

/**
 * Clears all local investigations and cached datasets
 */
export async function clearAllLocalData(): Promise<void> {
  await db.projects.clear();
  await db.cachedDatasets.clear();
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    for (const name of cacheNames) {
      if (name.startsWith('dimminglab-')) {
        await caches.delete(name);
      }
    }
  }
}
