/**
 * The one Zustand store behind the whole demo. Every mutation goes through dispatch(), which
 * calls transition() and never touches a case directly. Persisted to localStorage through the
 * guarded helpers in ./storage, with skipHydration so server rendering and node tests never
 * read it implicitly.
 */
import { useEffect, useState } from "react";
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

const storageAdapter: StateStorage = {
  getItem: (name) => safeGet(name),
  setItem: (name, value) => {
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

/**
 * True once the stored demo has been read on the client. Always false on the server and on the
 * first client render, so the two agree: a page that shows a skeleton until this is true never
 * hydrates against different HTML. (Starting from `storageAvailable()` would not do: the server
 * has no window, so it would render content where the browser's first render shows a skeleton.)
 * With storage blocked there is nothing to read and it turns true right after mount. Anything
 * that differs between server and client, `storageOk` included, belongs behind this gate.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.resolve(storageAvailable() ? useDemo.persist.rehydrate() : undefined).then(() => {
      if (active) setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);
  return hydrated;
}

export function demoToday(): ISODate {
  return useDemo.getState().demoToday;
}

/** Restores the store to the seed and the defaults, bypassing React, for test setup. */
export function resetDemoStoreForTests(): void {
  useDemo.setState(initialState());
}
