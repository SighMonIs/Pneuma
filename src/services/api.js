const BASE_URL = '/api';

async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `HTTP ${res.status}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// Auth / Setup
export const getAuthStatus = () => request('GET', '/auth');
export const saveCookies = (content) => request('POST', '/auth/cookies', { content });
export const deleteCookies = () => request('DELETE', '/auth/cookies');

// Subscriptions
export const getSubscriptions = () => request('GET', '/subscriptions');
export const syncSubscriptions = () => request('POST', '/subscriptions/sync');
export const addChannel = (url) => request('POST', '/subscriptions/add', { url });
export const importCsv = (csv) => request('POST', '/subscriptions/import-csv', { csv });
export const updateSubscription = (id, data) => request('PATCH', `/subscriptions/${id}`, data);
export const updateChannelCategories = (channelId, categoryIds) =>
  request('POST', `/subscriptions/${channelId}/categories`, { categoryIds });
export const deleteSubscription = (id) => request('DELETE', `/subscriptions/${id}`);

// Categories
export const getCategories = () => request('GET', '/categories');
export const createCategory = (data) => request('POST', '/categories', data);
export const updateCategory = (id, data) => request('PATCH', `/categories/${id}`, data);
export const deleteCategory = (id) => request('DELETE', `/categories/${id}`);
export const reorderCategory = (id, sort_order) =>
  request('POST', `/categories/${id}/reorder`, { sort_order });

// Videos
export const getVideos = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v);
  });
  const qs = query.toString();
  return request('GET', `/videos${qs ? '?' + qs : ''}`);
};
export const fetchVideos = () => request('POST', '/videos/fetch');
export const markWatched = (videoId) => request('POST', '/videos/watched', { videoId });
export const unmarkWatched = (videoId) => request('DELETE', `/videos/watched/${videoId}`);

// Scheduler
export const getJobs = () => request('GET', '/scheduler');
export const createJob = (data) => request('POST', '/scheduler', data);
export const updateJob = (id, data) => request('PATCH', `/scheduler/${id}`, data);
export const deleteJob = (id) => request('DELETE', `/scheduler/${id}`);
export const runJob = (id) => request('POST', `/scheduler/${id}/run`);
