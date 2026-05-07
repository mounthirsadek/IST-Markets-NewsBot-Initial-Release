/**
 * Firebase has been fully removed.
 * Authentication is now handled via JWT + MySQL.
 * Storage is now local disk via multer.
 *
 * This file is kept as a compatibility shim so any stray imports don't crash.
 * All references to firebase should be replaced with API calls.
 */

export const auth = null;
export const db = null;
export const storage = null;
export const googleProvider = null;

export const loginWithGoogle = async (): Promise<never> => {
  throw new Error('Google login has been removed. Use username/password instead.');
};

export const logout = (): void => {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
};
