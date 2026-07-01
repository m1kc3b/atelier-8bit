/* ─────────────────────────────────────────────────────────────
   Tests — features/challenges/challenges-service.ts + tracks-service.ts
   Couvre : getAll (mapping, defaults, cache, [] sur error), getById,
   clearCache ; et pour les parcours : getTracks, getAllSteps (arena_name
   = nom de track, locked=true, stepIndex), getStepsByTrack, lookups
   synchrones getTrackById/ByName.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { makeSupabaseMock } from './helpers/supabase-mocks';

let sb = makeSupabaseMock();

vi.mock('../features/auth/auth-service.js', () => ({
  supabase: new Proxy({}, { get: (_t, p) => (sb.supabase as any)[p] }),
  authService: { getUser: () => null, isAuthenticated: () => false, onChange: () => () => {} },
}));

import { challengesService } from '../features/challenges/challenges-service.js';
import { tracksService } from '../features/challenges/tracks-service.js';

describe('ChallengesService', () => {
  beforeEach(() => challengesService.clearCache());

  it('mappe les lignes DB → Challenge avec defaults', async () => {
    sb = makeSupabaseMock({
      tables: {
        challenges: {
          data: [
            { id: 1, title: 'Hello', description: 'desc', template: 'LDA #1', assertions: [], max_cycles: 50, hints: [], meta: null, locked: false },
            { id: 2, title: 'Bare' },
          ],
        },
      },
    });
    const all = await challengesService.getAll();
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ id: 1, title: 'Hello', description: 'desc', template: 'LDA #1', maxCycles: 50, locked: false });
    // defaults sur la ligne minimale
    expect(all[1]).toMatchObject({ id: 2, description: '', template: '', locked: false });
    expect(all[1].assertions).toEqual([]);
    expect(all[1].hints).toEqual([]);
  });

  it('met en cache (un seul appel réseau)', async () => {
    sb = makeSupabaseMock({ tables: { challenges: { data: [{ id: 1, title: 'A' }] } } });
    await challengesService.getAll();
    await challengesService.getAll();
    expect(sb.supabase.from).toHaveBeenCalledTimes(1);
  });

  it('renvoie [] en cas d’erreur (sans throw)', async () => {
    sb = makeSupabaseMock({ tables: { challenges: { error: { message: 'x' } } } });
    expect(await challengesService.getAll()).toEqual([]);
  });

  it('getById trouve un défi par id, null sinon', async () => {
    sb = makeSupabaseMock({ tables: { challenges: { data: [{ id: 5, title: 'Five' }] } } });
    expect((await challengesService.getById(5))?.title).toBe('Five');
    expect(await challengesService.getById(999)).toBeNull();
  });

  it('clearCache force une relecture', async () => {
    sb = makeSupabaseMock({ tables: { challenges: { data: [{ id: 1, title: 'A' }] } } });
    await challengesService.getAll();
    challengesService.clearCache();
    await challengesService.getAll();
    expect(sb.supabase.from).toHaveBeenCalledTimes(2);
  });
});

describe('TracksService', () => {
  beforeEach(() => tracksService.clearCache());

  it('getTracks mappe + applique les defaults icon/subtitle', async () => {
    sb = makeSupabaseMock({
      tables: {
        tracks: {
          data: [
            { id: 'pong', name: 'Projet Pong', position: 1, icon: '🏓', subtitle: 'Construis Pong' },
            { id: 'snake', name: 'Projet Snake', position: null, icon: null, subtitle: null },
          ],
        },
      },
    });
    const tracks = await tracksService.getTracks();
    expect(tracks[0]).toMatchObject({ id: 'pong', name: 'Projet Pong', position: 1, icon: '🏓' });
    expect(tracks[1]).toMatchObject({ id: 'snake', position: 0, icon: null, subtitle: null });
  });

  it('getTracks renvoie [] en erreur', async () => {
    sb = makeSupabaseMock({ tables: { tracks: { error: { message: 'x' } } } });
    expect(await tracksService.getTracks()).toEqual([]);
  });

  it('getAllSteps convertit en Challenge (arena_name=nom track, locked=true, stepIndex)', async () => {
    sb = makeSupabaseMock({
      tables: {
        tracks: { data: [{ id: 'pong', name: 'Projet Pong', position: 1, icon: null, subtitle: null }] },
        track_steps: {
          data: [
            { id: 10, track_id: 'pong', step_index: 0, title: 'Étape 1', description: 'd', template: 't', assertions: [], max_cycles: 99, hints: [], meta: null },
            { id: 11, track_id: 'pong', step_index: 1, title: 'Étape 2' },
          ],
        },
      },
    });
    const steps = await tracksService.getAllSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({ id: 10, arena_name: 'Projet Pong', locked: true, stepIndex: 0, maxCycles: 99 });
    expect(steps[1]).toMatchObject({ id: 11, arena_name: 'Projet Pong', stepIndex: 1, description: '', template: '' });
  });

  it('arena_name retombe sur le track_id si la track est inconnue', async () => {
    sb = makeSupabaseMock({
      tables: {
        tracks: { data: [] },
        track_steps: { data: [{ id: 1, track_id: 'ghost', step_index: 0, title: 'X' }] },
      },
    });
    const steps = await tracksService.getAllSteps();
    expect(steps[0].arena_name).toBe('ghost');
  });

  it('getStepsByTrack filtre par parcours', async () => {
    sb = makeSupabaseMock({
      tables: {
        tracks: {
          data: [
            { id: 'pong', name: 'Projet Pong', position: 1, icon: null, subtitle: null },
            { id: 'snake', name: 'Projet Snake', position: 2, icon: null, subtitle: null },
          ],
        },
        track_steps: {
          data: [
            { id: 1, track_id: 'pong', step_index: 0, title: 'P1' },
            { id: 2, track_id: 'snake', step_index: 0, title: 'S1' },
          ],
        },
      },
    });
    const pong = await tracksService.getStepsByTrack('pong');
    expect(pong).toHaveLength(1);
    expect(pong[0].title).toBe('P1');
  });

  it('getStepsByTrack renvoie [] pour un slug inconnu', async () => {
    sb = makeSupabaseMock({ tables: { tracks: { data: [] }, track_steps: { data: [] } } });
    expect(await tracksService.getStepsByTrack('nope')).toEqual([]);
  });

  it('lookups synchrones nuls tant que le cache n’est pas peuplé', () => {
    tracksService.clearCache();
    expect(tracksService.getTrackById('pong')).toBeNull();
    expect(tracksService.getTrackByName('Projet Pong')).toBeNull();
  });

  it('lookups synchrones après peuplement du cache', async () => {
    sb = makeSupabaseMock({
      tables: { tracks: { data: [{ id: 'pong', name: 'Projet Pong', position: 1, icon: null, subtitle: null }] } },
    });
    await tracksService.getTracks();
    expect(tracksService.getTrackById('pong')?.name).toBe('Projet Pong');
    expect(tracksService.getTrackByName('Projet Pong')?.id).toBe('pong');
  });
});