import {
  PLANNING_DRAFT_KEY_PREFIX,
  draftContentFingerprint,
  draftStorageKey,
  listDrafts,
  readDraft,
  removeDraft,
  writeDraft,
  type DraftIdentity,
  type DraftRemoveResult,
  type DraftStorage,
  type DraftSummary,
  type DraftWriteFailure,
  type PlanningDraftContent,
  type PlanningDraftRecord,
} from './planningDraftStore';

export type DraftSaveState = 'idle' | 'pending' | 'saved' | 'failed';
export type DraftFailure = DraftWriteFailure | 'unsupported';

/** Lo que la interfaz necesita saber de un borrador. Se sustituye entero al cambiar. */
export interface DraftView {
  /** Borrador encontrado en el almacenamiento para esta identidad. */
  stored: PlanningDraftRecord | null;
  /** `foreign`: hay un borrador que esta pantalla no ha aceptado; no se escribe hasta que el usuario elija. */
  decision: 'none' | 'foreign';
  /** Otra pestaña eliminó el borrador mientras se editaba: no se vuelve a crear sin que el usuario lo pida. */
  removedElsewhere: boolean;
  /** Había un borrador ilegible y se retiró. */
  corruptRemoved: boolean;
  /** Existe un borrador de una versión futura de la app: no se lee ni se sobrescribe. */
  unsupported: boolean;
  storageAvailable: boolean;
  saveState: DraftSaveState;
  /** Fecha de la última escritura confirmada. */
  savedAt: string | null;
  failure: DraftFailure | null;
  /** Borradores de otros días de este usuario y sede. */
  others: DraftSummary[];
}

export const EMPTY_DRAFT_VIEW: DraftView = {
  stored: null,
  decision: 'none',
  removedElsewhere: false,
  corruptRemoved: false,
  unsupported: false,
  storageAvailable: true,
  saveState: 'idle',
  savedAt: null,
  failure: null,
  others: [],
};

interface Slot {
  identity: DraftIdentity;
  /** Revisión que esta pantalla escribió o aceptó. `null`: no hay ninguna. `undefined`: aún sin leer. */
  known: number | null | undefined;
  lastContent: string | null;
  payload: PlanningDraftContent | null;
  timer: unknown;
  closed: boolean;
  view: DraftView;
}

export interface PlanningDraftManagerOptions {
  storage: DraftStorage | null;
  writerId?: string;
  debounceMs?: number;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  eventTarget?: Pick<Window, 'addEventListener' | 'removeEventListener'> | null;
  visibilityTarget?: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'> | null;
}

const sameView = (left: DraftView, right: DraftView): boolean => (
  (Object.keys(left) as Array<keyof DraftView>).every((key) => (
    key === 'others' ? JSON.stringify(left.others) === JSON.stringify(right.others)
      : key === 'stored' ? left.stored?.revision === right.stored?.revision && left.stored?.writerId === right.stored?.writerId
        : left[key] === right[key]
  ))
);

/**
 * Escribe el borrador en el navegador de forma segura frente a carreras:
 * - cada escritura comprueba que lo almacenado sigue siendo la revisión que esta pantalla conoce;
 * - si otra pestaña o una sesión anterior dejó un borrador distinto, se detiene y pide una elección;
 * - descartar o guardar «cierra» el borrador, así una escritura retrasada no lo resucita;
 * - un fallo de almacenamiento nunca lanza: queda reflejado en la vista.
 */
export class PlanningDraftManager {
  private readonly storage: DraftStorage | null;
  private readonly writerId: string;
  private readonly debounceMs: number;
  private readonly now: () => number;
  private readonly setTimer: (callback: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly eventTarget: PlanningDraftManagerOptions['eventTarget'];
  private readonly visibilityTarget: PlanningDraftManagerOptions['visibilityTarget'];
  private slots: Record<string, Slot> = {};
  private listeners: Array<() => void> = [];
  private attachCount = 0;

  constructor(options: PlanningDraftManagerOptions) {
    this.storage = options.storage;
    this.writerId = options.writerId || `tab-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
    this.debounceMs = options.debounceMs ?? 500;
    this.now = options.now || Date.now;
    this.setTimer = options.setTimer || ((callback, ms) => setTimeout(callback, ms));
    this.clearTimer = options.clearTimer || ((handle) => clearTimeout(handle as ReturnType<typeof setTimeout>));
    this.eventTarget = options.eventTarget === undefined ? (typeof window === 'undefined' ? null : window) : options.eventTarget;
    this.visibilityTarget = options.visibilityTarget === undefined ? (typeof document === 'undefined' ? null : document) : options.visibilityTarget;
  }

  // --- suscripción (useSyncExternalStore) -------------------------------------------------------

  subscribe = (listener: () => void): (() => void) => {
    this.listeners = [...this.listeners, listener];
    return () => { this.listeners = this.listeners.filter((item) => item !== listener); };
  };

  getView = (identity: DraftIdentity): DraftView => this.slot(identity).view;

  private emit() {
    this.listeners.forEach((listener) => listener());
  }

  // --- ciclo de vida ----------------------------------------------------------------------------

  /** Empieza a escuchar cierre de pestaña y cambios de otras pestañas. Admite llamadas anidadas. */
  attach() {
    this.attachCount += 1;
    if (this.attachCount > 1) return;
    this.eventTarget?.addEventListener('storage', this.onStorage as EventListener);
    this.eventTarget?.addEventListener('pagehide', this.onLeave);
    this.visibilityTarget?.addEventListener('visibilitychange', this.onVisibility);
  }

  /** Vacía las escrituras pendientes (síncrono) y deja de escuchar. */
  detach() {
    this.flushAll();
    this.attachCount = Math.max(0, this.attachCount - 1);
    if (this.attachCount > 0) return;
    this.eventTarget?.removeEventListener('storage', this.onStorage as EventListener);
    this.eventTarget?.removeEventListener('pagehide', this.onLeave);
    this.visibilityTarget?.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(PLANNING_DRAFT_KEY_PREFIX)) this.refreshAll();
  };

  private onLeave = () => this.flushAll();

  private onVisibility = () => {
    if (this.visibilityTarget?.visibilityState === 'hidden') this.flushAll();
  };

  // --- lectura ----------------------------------------------------------------------------------

  /** Vuelve a leer el almacenamiento y decide si hay un borrador pendiente de elección. */
  refresh(identity: DraftIdentity) {
    const slot = this.slot(identity);
    const result = readDraft(this.storage, identity);
    const others = this.otherDrafts(identity);
    if (result.status === 'unavailable') {
      this.setView(slot, { storageAvailable: false, others: [] });
      return;
    }
    const patch: Partial<DraftView> = { storageAvailable: true, others, unsupported: false };
    if (result.status === 'none') {
      if (!slot.closed && typeof slot.known === 'number') patch.removedElsewhere = true;
      slot.known = null;
      Object.assign(patch, { stored: null, decision: 'none' });
    } else if (result.status === 'ok') {
      const own = slot.known === result.record.revision;
      Object.assign(patch, { stored: result.record, decision: own ? 'none' : 'foreign' });
      // La revisión que esta pantalla conoce está realmente en el almacenamiento: eso sí es una copia confirmada.
      if (own && slot.view.saveState !== 'pending' && slot.view.saveState !== 'failed') {
        Object.assign(patch, { saveState: 'saved', savedAt: result.record.updatedAt });
      }
    } else if (result.status === 'invalid') {
      try { this.storage?.removeItem(draftStorageKey(identity)); } catch { /* Se volverá a intentar en la próxima lectura. */ }
      slot.known = null;
      Object.assign(patch, { stored: null, decision: 'none', corruptRemoved: true });
    } else {
      Object.assign(patch, { stored: null, decision: 'none', unsupported: true });
    }
    this.setView(slot, patch);
    this.armIfReady(slot);
  }

  private refreshAll() {
    Object.values(this.slots).forEach((slot) => this.refresh(slot.identity));
  }

  private otherDrafts(identity: DraftIdentity): DraftSummary[] {
    return listDrafts(this.storage, identity.userId, identity.sedeId, { now: this.now(), cleanup: true }).drafts
      .filter((draft) => draft.identity.startDate !== identity.startDate || draft.identity.endDate !== identity.endDate);
  }

  // --- escritura --------------------------------------------------------------------------------

  /** Una pantalla de reparto empieza a editar este borrador: parte de cero y relee el almacenamiento. */
  begin(identity: DraftIdentity) {
    const slot = this.slot(identity);
    this.cancelTimer(slot);
    slot.closed = false;
    slot.payload = null;
    this.setView(slot, { removedElsewhere: false, saveState: 'idle', failure: null });
    this.refresh(identity);
  }

  /** Conserva el estado actual del borrador con un pequeño retardo; las ediciones seguidas se agrupan. */
  schedule(identity: DraftIdentity, content: PlanningDraftContent) {
    const slot = this.slot(identity);
    if (slot.closed) return;
    const previous = slot.payload;
    slot.payload = content;
    if (!this.storage) {
      this.setView(slot, { saveState: 'failed', failure: 'unavailable', storageAvailable: false });
      return;
    }
    if (slot.view.unsupported) {
      this.setView(slot, { saveState: 'failed', failure: 'unsupported' });
      return;
    }
    if (this.isPaused(slot)) return;
    // Lo mismo que ya espera escritura: no se reinicia el retardo (evita que renders repetidos la aplacen sin fin).
    if (slot.timer !== null && previous && draftContentFingerprint(previous) === draftContentFingerprint(content)) return;
    const unchanged = content.proposals.length === 0
      ? typeof slot.known !== 'number'
      : draftContentFingerprint(content) === slot.lastContent;
    if (unchanged) {
      this.cancelTimer(slot);
      slot.payload = null;
      if (slot.view.saveState === 'pending') this.setView(slot, { saveState: slot.view.savedAt ? 'saved' : 'idle' });
      return;
    }
    this.arm(slot);
  }

  /** Escribe ya lo pendiente. */
  flush(identity: DraftIdentity) {
    this.writePending(this.slot(identity));
  }

  flushAll() {
    Object.values(this.slots).forEach((slot) => this.writePending(slot));
  }

  /** Vacía lo pendiente y devuelve la revisión que corresponde a lo que se va a guardar de verdad. */
  checkpoint(identity: DraftIdentity): number | null {
    const slot = this.slot(identity);
    this.writePending(slot);
    return typeof slot.known === 'number' ? slot.known : null;
  }

  /** El usuario aceptó recuperar este borrador: pasa a ser la revisión conocida. */
  acceptRecord(identity: DraftIdentity, record: PlanningDraftRecord) {
    const slot = this.slot(identity);
    this.cancelTimer(slot);
    slot.payload = null;
    slot.known = record.revision;
    slot.lastContent = draftContentFingerprint(record);
    this.setView(slot, { stored: record, decision: 'none', removedElsewhere: false });
  }

  /** El usuario descartó el borrador mostrado. Solo se elimina esa revisión. */
  discard(identity: DraftIdentity): DraftRemoveResult {
    const slot = this.slot(identity);
    const stored = slot.view.stored;
    if (!stored) return { status: 'absent' };
    const result = removeDraft(this.storage, identity, stored.revision);
    if (result.status === 'removed' || result.status === 'absent') {
      slot.known = null;
      slot.lastContent = null;
      this.setView(slot, { stored: null, decision: 'none', removedElsewhere: false });
      this.armIfReady(slot);
    } else if (result.status === 'conflict') {
      this.refresh(identity);
    }
    return result;
  }

  /** Otra pestaña eliminó el borrador y el usuario quiere seguir conservando esta pantalla. */
  resume(identity: DraftIdentity) {
    const slot = this.slot(identity);
    this.setView(slot, { removedElsewhere: false });
    this.armIfReady(slot);
  }

  dismissCorruptNotice(identity: DraftIdentity) {
    this.setView(this.slot(identity), { corruptRemoved: false });
  }

  /** «Descartar propuesta»: elimina el borrador propio y cierra; nada pendiente puede resucitarlo. */
  drop(identity: DraftIdentity): DraftRemoveResult {
    const slot = this.slot(identity);
    this.cancelTimer(slot);
    slot.payload = null;
    slot.closed = true;
    return this.removeKnown(slot, slot.known);
  }

  /** Guardado real confirmado: elimina únicamente la revisión que se guardó y cierra. */
  completeSave(identity: DraftIdentity, savedRevision: number | null): DraftRemoveResult {
    const slot = this.slot(identity);
    this.cancelTimer(slot);
    slot.payload = null;
    slot.closed = true;
    return this.removeKnown(slot, savedRevision);
  }

  private removeKnown(slot: Slot, revision: number | null | undefined): DraftRemoveResult {
    if (typeof revision !== 'number') {
      this.setView(slot, { saveState: 'idle', savedAt: null, failure: null });
      return { status: 'absent' };
    }
    const result = removeDraft(this.storage, slot.identity, revision);
    if (result.status === 'removed' || result.status === 'absent') {
      slot.known = null;
      slot.lastContent = null;
      this.setView(slot, { stored: null, decision: 'none', saveState: 'idle', savedAt: null, failure: null });
    } else if (result.status === 'conflict') {
      // Otra pestaña guardó algo más reciente: no se toca y se ofrecerá en su momento.
      this.setView(slot, { saveState: 'idle', savedAt: null, failure: null });
      this.refresh(slot.identity);
    } else {
      this.setView(slot, { saveState: 'failed', failure: 'unavailable' });
    }
    return result;
  }

  // --- internos ---------------------------------------------------------------------------------

  private slot(identity: DraftIdentity): Slot {
    const key = draftStorageKey(identity);
    if (!this.slots[key]) {
      this.slots[key] = {
        identity: { ...identity },
        known: undefined,
        lastContent: null,
        payload: null,
        timer: null,
        closed: false,
        view: { ...EMPTY_DRAFT_VIEW, storageAvailable: this.storage !== null },
      };
    }
    return this.slots[key];
  }

  private isPaused(slot: Slot): boolean {
    return slot.view.decision === 'foreign' || slot.view.removedElsewhere;
  }

  private setView(slot: Slot, patch: Partial<DraftView>) {
    const next = { ...slot.view, ...patch };
    if (sameView(slot.view, next)) return;
    slot.view = next;
    this.emit();
  }

  private cancelTimer(slot: Slot) {
    if (slot.timer !== null) this.clearTimer(slot.timer);
    slot.timer = null;
  }

  private arm(slot: Slot) {
    this.cancelTimer(slot);
    slot.timer = this.setTimer(() => {
      slot.timer = null;
      this.writePending(slot);
    }, this.debounceMs);
    this.setView(slot, { saveState: 'pending' });
  }

  private armIfReady(slot: Slot) {
    if (slot.payload && !slot.closed && !this.isPaused(slot) && slot.timer === null) this.arm(slot);
  }

  private writePending(slot: Slot) {
    this.cancelTimer(slot);
    const payload = slot.payload;
    if (!payload || slot.closed || this.isPaused(slot)) return;
    if (payload.proposals.length === 0) {
      slot.payload = null;
      if (typeof slot.known !== 'number') {
        this.setView(slot, { saveState: 'idle' });
        return;
      }
      const removal = removeDraft(this.storage, slot.identity, slot.known);
      if (removal.status === 'removed' || removal.status === 'absent') {
        slot.known = null;
        slot.lastContent = null;
        this.setView(slot, { stored: null, saveState: 'idle', savedAt: null, failure: null });
      } else if (removal.status === 'conflict') {
        slot.payload = payload;
        this.refresh(slot.identity);
      } else {
        slot.payload = payload;
        this.setView(slot, { saveState: 'failed', failure: 'unavailable' });
      }
      return;
    }
    const result = writeDraft(this.storage, slot.identity, payload, {
      expectedRevision: typeof slot.known === 'number' ? slot.known : null,
      writerId: this.writerId,
      now: this.now(),
    });
    if (result.status === 'written') {
      slot.payload = null;
      slot.known = result.record.revision;
      slot.lastContent = draftContentFingerprint(payload);
      this.setView(slot, {
        stored: result.record, decision: 'none', removedElsewhere: false,
        saveState: 'saved', savedAt: result.record.updatedAt, failure: null, storageAvailable: true,
      });
      this.setView(slot, { others: this.otherDrafts(slot.identity) });
    } else if (result.status === 'conflict') {
      if (result.current) this.setView(slot, { stored: result.current, decision: 'foreign', saveState: 'idle' });
      else {
        slot.known = null;
        this.setView(slot, { stored: null, removedElsewhere: true, saveState: 'idle' });
      }
    } else if (result.status === 'unsupported') {
      this.setView(slot, { unsupported: true, saveState: 'failed', failure: 'unsupported' });
    } else {
      this.setView(slot, { saveState: 'failed', failure: result.reason, storageAvailable: result.reason !== 'unavailable' });
    }
  }
}

/** `localStorage` si el navegador lo permite; `null` si está bloqueado o no existe. */
export const getBrowserDraftStorage = (): DraftStorage | null => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    void window.localStorage.length;
    return window.localStorage;
  } catch {
    return null;
  }
};
