export function getToken() {
  return localStorage.getItem('accessToken');
}

export function isLoggedIn() {
  return !!getToken();
}

export function logout() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('username');
  localStorage.removeItem('role');
  window.dispatchEvent(new Event("theme_update"));
  window.location.href = '/login';
}
