// One guard per route view, shared by every bag and preparation button.
export const createPreparationClickGuard = (now = () => performance.now()) => {
  let blockedUntil = 0;
  let saving = false;
  return {
    tryStart: () => {
      if (saving || now() < blockedUntil) return false;
      blockedUntil = now() + 3000;
      saving = true;
      return true;
    },
    finish: () => { saving = false; },
    remainingSeconds: () => Math.max(0, Math.ceil((blockedUntil - now()) / 1000)),
  };
};
