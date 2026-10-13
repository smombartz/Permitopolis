/**
 * The one Zustand store behind the whole demo. Every mutation goes through dispatch(), which
 * calls transition() and never touches a case directly. Persisted to localStorage through the
 * guarded helpers in ./storage, with skipHydration so server rendering and node tests never
 * read it implicitly.
 *
 * The stored demo is read once per page load (hydrateDemoStore(), started by useHydrated() and
 * by the <StoreHydrator /> in the root layout, so it happens on every route). Until it has been
 * read nothing is written: see `storageAdapter`.
 */
import { useEffect, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { DEFAULT_CONFIG, DEFAULT_DEMO_TODAY, STORAGE_KEY } from "@/lib/rules";
import type { Actor, EventAnswers, EventCase, ISODate, Party, WizardStep } from "@/lib/types";
import { advanceClock, computeNow } from "./clock";
import { nextCaseId } from "./selectors";
import { newCase, syncDraft } from "./newCase";
import { buildSeed, seedFingerprint } from "./seed";
import { safeGet, safeRemove, safeSet, storageAvailable } from "./storage";
import { transition } from "./transition";
import type { Action } from "./actions";
import type { DemoStore } from "./types";

/** True once the stored demo has been read on this page load. */
let storageRead = false;

/**
 * persist writes the whole demo on every set(), whether or not it has hydrated. A change made
 * before the stored demo was read (a landing-page door that sets the role, say) would therefore
 * save this page load's in-memory seed over the presenter's demo. So a write waits for the read:
 * until then it is dropped, and the read that follows brings the stored demo in.
 */
const storageAdapter: StateStorage = {
  getItem: (name) => {
    const value = safeGet(name);
    storageRead = true;
    return value;
  },
  setItem: (name, value) => {
    if (!storageRead) return;
    safeSet(name, value);
  },
  removeItem: (name) => {
    safeRemove(name);
  },
};

function initialState() {
  return {
    cases: buildSeed(),
    demoToday: DEFAULT_DEMO_TODAY,
    cfg: DEFAULT_CONFIG,
    role: "applicant" as Party,
    personaId: "new",
    hints: true,
    lastPathByRole: {},
    storageOk: storageAvailable(),
  };
}

export const useDemo = create<DemoStore>()(
  persist(
    (set, get) => ({
      ...initialState(),

      dispatch(caseId: string, action: Action, actor?: Actor) {
        const state = get();
        const index = state.cases.findIndex((c) => c.id === caseId);
        if (index === -1) return { ok: false, reason: "Case not found." };
        const target = state.cases[index];
        const now = computeNow(target, state.demoToday);
        const result = transition(target, action, actor ?? state.role, { today: state.demoToday, now, cases: state.cases, cfg: state.cfg });
        if (!result.ok) return { ok: false, reason: result.reason };
        const spawned = result.spawned ?? [];
        set({ cases: [...state.cases.slice(0, index), result.case, ...state.cases.slice(index + 1), ...spawned] });
        return { ok: true, spawnedIds: spawned.map((s) => s.id) };
      },

      createDraft(applicantId: string, answers?: Partial<EventAnswers>) {
        const state = get();
        const id = nextCaseId(state.cases);
        const blank = newCase({ id, applicantId, createdAt: `${state.demoToday}T09:00`, answers });
        const draft = syncDraft(blank, { today: state.demoToday, cases: state.cases, cfg: state.cfg });
        set({ cases: [...state.cases, draft] });
        return id;
      },

      updateDraft(caseId: string, patch: Partial<EventAnswers> & { wizardStep?: WizardStep; lateFee?: boolean }) {
        set((state: DemoStore) => ({
          cases: state.cases.map((c: EventCase) => {
            if (c.id !== caseId || c.state !== "draft") return c;
            // `lateFee` is the applicant's choice at the date gate; it lives in flags, not in the answers.
            const { lateFee, ...answers } = patch;
            const flags = lateFee === undefined ? c.flags : { ...c.flags, lateFee };
            // Sessions, tier and triggers follow every edit (see syncDraft).
            return syncDraft({ ...c, ...answers, flags }, { today: state.demoToday, cases: state.cases, cfg: state.cfg });
          }),
        }));
      },

      setRole(role: Party) {
        set({ role });
      },

      setPersona(personaId: string) {
        set({ personaId });
      },

      setDemoToday(date: ISODate) {
        const state = get();
        if (date > state.demoToday) {
          set({ cases: advanceClock(state.cases, state.demoToday, date, state.cfg), demoToday: date });
        } else {
          set({ demoToday: date });
        }
      },

      setConfig(patch) {
        set((state: DemoStore) => ({ cfg: { ...state.cfg, ...patch } }));
      },

      rememberPath(role: Party, path: string) {
        set((state: DemoStore) => ({ lastPathByRole: { ...state.lastPathByRole, [role]: path } }));
      },

      toggleHints() {
        set((state: DemoStore) => ({ hints: !state.hints }));
      },

      reset() {
        set(initialState());
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => storageAdapter),
      skipHydration: true,
      // A stored demo belongs to the seed it grew from. The version is the seed's fingerprint,
      // so a demo saved by an earlier build (other scripts, or an engine that seeded a case
      // differently) is dropped on load: the store keeps the fresh seed and saves it back.
      version: seedFingerprint(),
      migrate: () => ({}),
      partialize: (state) => ({
        cases: state.cases,
        demoToday: state.demoToday,
        cfg: state.cfg,
        role: state.role,
        personaId: state.personaId,
        hints: state.hints,
        lastPathByRole: state.lastPathByRole,
      }),
    },
  ),
);

/* ---------- hydration: once per page load, shared by every mount ---------- */

let hydrated = false;
let hydration: Promise<void> | null = null;
/** Counts page loads, so a read still in flight when a test starts over cannot mark the next one hydrated. */
let pageLoad = 0;
const hydrationListeners = new Set<() => void>();

function subscribeToHydration(listener: () => void): () => void {
  hydrationListeners.add(listener);
  return () => {
    hydrationListeners.delete(listener);
  };
}

function setHydrated(value: boolean): void {
  hydrated = value;
  for (const listener of hydrationListeners) listener();
}

/**
 * Reads the stored demo into the store. The first call does the work; every later one gets the
 * same promise, so a second shell mounting (the applicant's and the city's layouts are separate)
 * does not read localStorage again. With storage blocked there is nothing to read.
 */
export function hydrateDemoStore(): Promise<void> {
  if (!hydration) {
    const load = pageLoad;
    hydration = Promise.resolve(storageAvailable() ? useDemo.persist.rehydrate() : undefined).then(() => {
      if (load === pageLoad) setHydrated(true);
    });
  }
  return hydration;
}

/**
 * True once the stored demo has been read on the client. Always false on the server and on the
 * first client render of a page load, so the two agree: a page that shows a skeleton until this
 * is true never hydrates against different HTML. (Starting from `storageAvailable()` would not
 * do: the server has no window, so it would render content where the browser's first render
 * shows a skeleton.) With storage blocked there is nothing to read and it turns true right
 * after mount. Anything that differs between server and client, `storageOk` included, belongs
 * behind this gate.
 *
 * The flag is the module's, not the component's: once the demo has been read, a component that
 * mounts later (a client-side navigation to another layout) starts true and shows no skeleton.
 */
export function useHydrated(): boolean {
  useEffect(() => {
    void hydrateDemoStore();
  }, []);
  return useSyncExternalStore(
    subscribeToHydration,
    () => hydrated,
    () => false,
  );
}

export function demoToday(): ISODate {
  return useDemo.getState().demoToday;
}

/**
 * A fresh page load, for test setup: the store back on the seed and the defaults, nothing in
 * storage, and the stored demo not read yet. Bypasses React.
 */
export function resetDemoStoreForTests(): void {
  pageLoad++;
  hydration = null;
  storageRead = false;
  safeRemove(STORAGE_KEY);
  useDemo.setState(initialState());
  setHydrated(false);
}
