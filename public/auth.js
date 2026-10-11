// ============================================================================
// WELCOME SCREEN: SIGN UP / LOG IN BEFORE ENTERING THE MULTIVERSE
// ============================================================================
// With the Node server, accounts live on the server (scrypt-hashed passwords,
// session tokens). On static hosts without a server (solo mode), the account
// is kept only in this browser, and the screen says so.
const Auth = (() => {
  const TOKEN_KEY = 'github-multiverse-session';
  const LOCAL_ACCOUNTS_KEY = 'github-multiverse-local-accounts';
  const hasServer = typeof io === 'function';
  const screen = document.getElementById('auth-screen');
  const form = document.getElementById('auth-form');
  const tabs = document.querySelectorAll('#auth-tabs button');
  const usernameInput = document.getElementById('auth-username');
  const passwordInput = document.getElementById('auth-password');
  const confirmRow = document.getElementById('auth-confirm-row');
  const confirmInput = document.getElementById('auth-confirm');
  const submitButton = document.getElementById('auth-submit');
  const errorBox = document.getElementById('auth-error');
  const note = document.getElementById('auth-note');
  let mode = 'signup';
  let resolveLogin;

  function storage(action, key, value) {
    try {
      if (action === 'get') return localStorage.getItem(key);
      if (action === 'set') localStorage.setItem(key, value);
      if (action === 'remove') localStorage.removeItem(key);
    } catch (error) {
      return null;
    }
    return null;
  }

  function setMode(nextMode) {
    mode = nextMode;
    tabs.forEach((tab) => tab.classList.toggle('active', tab.dataset.mode === mode));
    confirmRow.style.display = mode === 'signup' ? 'block' : 'none';
    confirmInput.required = mode === 'signup';
    passwordInput.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
    submitButton.textContent = mode === 'signup' ? 'Create account & enter' : 'Log in';
    errorBox.textContent = '';
  }

  async function hashLocally(password, salt) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  // Solo mode: accounts saved in this browser only
  async function localAuth(username, password) {
    let local = {};
    try { local = JSON.parse(storage('get', LOCAL_ACCOUNTS_KEY) || '{}'); } catch (error) { local = {}; }
    const key = username.toLowerCase();
    if (mode === 'signup') {
      if (local[key]) throw new Error('That username already exists in this browser. Log in instead?');
      const salt = Math.random().toString(36).slice(2);
      local[key] = { username, salt, hash: await hashLocally(password, salt) };
      storage('set', LOCAL_ACCOUNTS_KEY, JSON.stringify(local));
    } else if (!local[key] || local[key].hash !== await hashLocally(password, local[key].salt)) {
      throw new Error('Wrong username or password.');
    }
    return { token: `local:${key}`, username: local[key].username };
  }

  async function serverAuth(username, password) {
    const response = await fetch(mode === 'signup' ? '/api/signup' : '/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Something went wrong. Try again.');
    return body;
  }

  function enter(session) {
    storage('set', TOKEN_KEY, JSON.stringify(session));
    screen.classList.add('leaving');
    setTimeout(() => { screen.style.display = 'none'; }, 600);
    resolveLogin(session);
  }

  async function onSubmit(event) {
    event.preventDefault();
    errorBox.textContent = '';
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) { errorBox.textContent = 'Usernames have 3-16 letters, numbers or _.'; return; }
    if (password.length < 8) { errorBox.textContent = 'Passwords need at least 8 characters.'; return; }
    if (mode === 'signup' && password !== confirmInput.value) { errorBox.textContent = 'The passwords do not match.'; return; }
    submitButton.disabled = true;
    try {
      enter(hasServer ? await serverAuth(username, password) : await localAuth(username, password));
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      submitButton.disabled = false;
    }
  }

  // Resolves with { token, username } once the developer is signed in
  function signIn() {
    return new Promise(async (resolve) => {
      resolveLogin = resolve;
      tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.mode)));
      form.addEventListener('submit', onSubmit);
      note.textContent = hasServer
        ? 'Your password is hashed on the server and never stored in plain text.'
        : 'Solo mode: no multiplayer server found, so this account is saved only in this browser.';

      let saved = null;
      try { saved = JSON.parse(storage('get', TOKEN_KEY)); } catch (error) { saved = null; }
      if (saved && saved.token) {
        // Already signed in: skip straight into the world
        const stillValid = hasServer
          ? await fetch('/api/session', { headers: { 'x-session-token': saved.token } }).then((response) => response.ok).catch(() => false)
          : saved.token.startsWith('local:');
        if (stillValid) { enter(saved); return; }
        storage('remove', TOKEN_KEY);
        setMode('login');
        errorBox.textContent = 'Your session expired. Please log in again.';
      } else {
        setMode('signup');
      }
      screen.style.display = 'flex';
      usernameInput.focus();
    });
  }

  async function signOut() {
    let saved = null;
    try { saved = JSON.parse(storage('get', TOKEN_KEY)); } catch (error) { saved = null; }
    if (saved && hasServer) await fetch('/api/logout', { method: 'POST', headers: { 'x-session-token': saved.token } }).catch(() => {});
    storage('remove', TOKEN_KEY);
    location.reload();
  }

  return { signIn, signOut, hasServer };
})();
