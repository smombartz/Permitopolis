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
import { newCase } from "./newCase";
import { buildSeed } from "./seed";
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
        const draft = newCase({ id, applicantId, createdAt: `${state.demoToday}T09:00`, answers });
        set({ cases: [...state.cases, draft] });
        return id;
      },

      updateDraft(caseId: string, patch: Partial<EventAnswers> & { wizardStep?: WizardStep }) {
        set((state: DemoStore) => ({
          cases: state.cases.map((c: EventCase) => (c.id === caseId && c.state === "draft" ? { ...c, ...patch } : c)),
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
      version: 1,
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

/** Rehydrates from localStorage once on the client; true immediately when storage is unavailable. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => !storageAvailable());
  useEffect(() => {
    if (!storageAvailable()) return;
    let active = true;
    Promise.resolve(useDemo.persist.rehydrate()).then(() => {
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
