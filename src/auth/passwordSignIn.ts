export interface LoginError {
  code: string;
  message: string;
}

interface ErrorDetails {
  code?: string;
  name?: string;
  status?: number;
  message?: string;
}

export function describeLoginError(error: unknown): LoginError {
  const details = (error && typeof error === 'object' ? error : {}) as ErrorDetails;
  const message = typeof details.message === 'string' ? details.message : '';
  // A server/network failure must never be treated as a wrong password.
  if ((details.status && details.status >= 500) || details.status === 0 ||
      details.code === 'request_timeout' || details.name === 'AuthRetryableFetchError' ||
      details.name === 'AbortError' || /fetch|network|timeout|timed out/i.test(message)) {
    return { code: 'temporary_unavailable', message: 'No se ha podido conectar con el servicio de acceso. Comprueba tu conexión o espera un momento y vuelve a intentarlo.' };
  }
  if (details.status === 429 || details.code === 'over_request_rate_limit') {
    return { code: 'rate_limited', message: 'El servicio de acceso ha recibido demasiados intentos. Espera unos minutos antes de volver a intentarlo.' };
  }
  if (details.code === 'invalid_credentials' || details.name === 'AuthInvalidCredentialsError' ||
      ((!details.status || details.status === 400) && /invalid login credentials/i.test(message))) {
    return { code: 'invalid_credentials', message: 'Email o contraseña incorrectos' };
  }
  if (details.code === 'email_not_confirmed') {
    return { code: 'email_not_confirmed', message: 'Debes confirmar tu email antes de iniciar sesión.' };
  }
  return { code: 'login_failed', message: 'No se ha podido iniciar sesión. Vuelve a intentarlo; si el problema continúa, contacta con tu administrador.' };
}

// Old counters included service outages, so they cannot establish password failures.
const ATTEMPTS_KEY = 'login_credential_failures_v2';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000;
type Attempts = Record<string, { count: number; lastAttempt: number }>;
type AttemptStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readAttempts(storage: AttemptStorage): Attempts {
  try {
    const raw: unknown = JSON.parse(storage.getItem(ATTEMPTS_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const valid: Attempts = {};
    for (const [email, entry] of Object.entries(raw)) {
      if (entry && typeof entry === 'object' && Number.isInteger(entry.count) && entry.count >= 0 &&
          typeof entry.lastAttempt === 'number' && Number.isFinite(entry.lastAttempt)) {
        valid[email] = entry;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

function saveAttempts(storage: AttemptStorage, attempts: Attempts) {
  try {
    storage.setItem(ATTEMPTS_KEY, JSON.stringify(attempts));
  } catch {
    // Browser storage restrictions must not turn a successful login into a failure.
  }
}

export async function passwordSignIn(options: {
  email: string;
  storage: AttemptStorage;
  authenticate: () => Promise<{ error: unknown }>;
  setLoading: (loading: boolean) => void;
  now?: () => number;
}): Promise<{ error: LoginError | null }> {
  const { storage, authenticate, setLoading } = options;
  const email = options.email.trim().toLowerCase();
  const now = options.now ?? Date.now;
  setLoading(true);
  try {
    const attempts = readAttempts(storage);
    const previous = Object.prototype.hasOwnProperty.call(attempts, email) ? attempts[email] : undefined;
    if (previous && now() - previous.lastAttempt >= LOCKOUT_DURATION) {
      delete attempts[email];
      saveAttempts(storage, attempts);
    } else if (previous && previous.count >= MAX_ATTEMPTS) {
      return { error: { code: 'local_lockout', message: 'Has introducido credenciales incorrectas varias veces. Espera 15 minutos desde el último intento antes de volver a intentarlo.' } };
    }

    let error: unknown;
    try {
      ({ error } = await authenticate());
    } catch (caught) {
      // Even throwing a non-Error value must produce a safe failure.
      error = caught || { code: 'unknown' };
    }
    if (!error) {
      delete attempts[email];
      saveAttempts(storage, attempts);
      return { error: null };
    }
    const loginError = describeLoginError(error);
    if (loginError.code === 'invalid_credentials') {
      attempts[email] = { count: (attempts[email]?.count ?? 0) + 1, lastAttempt: now() };
      saveAttempts(storage, attempts);
    }
    return { error: loginError };
  } catch (error) {
    return { error: describeLoginError(error) };
  } finally {
    setLoading(false);
  }
}
