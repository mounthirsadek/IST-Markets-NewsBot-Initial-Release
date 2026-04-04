import { useAuthStore } from '../store';

export async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const { user } = useAuthStore.getState();
  
  if (!user) {
    throw new Error('User not authenticated');
  }

  const token = await user.getIdToken();
  
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Handle unauthorized (e.g., token expired)
    // You might want to trigger a logout or token refresh here
    console.error('Unauthorized request');
  }

  return response;
}
