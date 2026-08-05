import { getInitData } from './telegram';
import type { ActivityPatch, CuratorState, HabitDraft, Settings, State } from './types';

/** Код ошибки, а не текст: экран сам решает, что показать и на каком языке. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`${status} ${code}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, method = 'GET', payload?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        'content-type': 'application/json',
        Authorization: `tma ${getInitData()}`,
      },
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
    });
  } catch {
    // Сети нет вообще — статуса не будет.
    throw new ApiError(0, 'network');
  }

  if (!response.ok) {
    let code = 'generic';
    try {
      const body = (await response.json()) as { error?: string };
      if (body?.error) code = body.error;
    } catch {
      /* тело не JSON — остаётся generic */
    }
    throw new ApiError(response.status, code);
  }

  return (await response.json()) as T;
}

/** Мутации отвечают целым состоянием, поэтому сливать его вручную не нужно. */
const mutate = (path: string, method: string, payload?: unknown): Promise<State> =>
  request<{ state: State }>(path, method, payload).then((body) => body.state);

export interface ApiClient {
  load(): Promise<State>;
  startActivity(kind: string): Promise<State>;
  stopActivity(id: string): Promise<State>;
  checkin(id: string, text: string): Promise<State>;
  patchActivity(id: string, patch: ActivityPatch): Promise<State>;
  deleteActivity(id: string): Promise<State>;
  createHabit(draft: HabitDraft): Promise<State>;
  updateHabit(id: string, draft: HabitDraft): Promise<State>;
  deleteHabit(id: string): Promise<State>;
  relapse(id: string): Promise<State>;
  /** Отметить или снять день полезной привычки. */
  toggleDay(id: string, day: string): Promise<State>;
  addFocus(payload: {
    habitId: string | null;
    durationMs: number;
    completed: boolean;
  }): Promise<State>;
  updateSettings(patch: Partial<Settings>): Promise<State>;
  curator(): Promise<CuratorState>;
}

export const api: ApiClient = {
  load: () => request<{ state: State }>('/api/state').then((body) => body.state),

  startActivity: (kind) => mutate('/api/activities/start', 'POST', { kind }),
  stopActivity: (id) => mutate(`/api/activities/${id}/stop`, 'POST'),
  checkin: (id, text) => mutate(`/api/activities/${id}/checkin`, 'POST', { text }),
  patchActivity: (id, patch) => mutate(`/api/activities/${id}`, 'PATCH', patch),
  deleteActivity: (id) => mutate(`/api/activities/${id}`, 'DELETE'),

  createHabit: (draft) => mutate('/api/habits', 'POST', draft),
  updateHabit: (id, draft) => mutate(`/api/habits/${id}`, 'PATCH', draft),
  deleteHabit: (id) => mutate(`/api/habits/${id}`, 'DELETE'),
  relapse: (id) => mutate(`/api/habits/${id}/relapse`, 'POST'),
  toggleDay: (id, day) => mutate(`/api/habits/${id}/day`, 'POST', { day }),

  addFocus: (payload) => mutate('/api/focus', 'POST', payload),
  updateSettings: (patch) => mutate('/api/settings', 'PATCH', patch),

  curator: () => request<CuratorState>('/api/curator'),
};
