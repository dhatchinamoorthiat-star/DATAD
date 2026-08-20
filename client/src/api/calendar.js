import api from './axios';

export function getHolidays(year, country = 'IN') {
  return api.get('/calendar/holidays', { params: { year, country } });
}

export function getEvents(year, month) {
  return api.get('/calendar/events', { params: { year, month } });
}

export function createEvent(data) {
  return api.post('/calendar/events', data);
}

export function updateEvent(id, data) {
  return api.put(`/calendar/events/${id}`, data);
}

export function deleteEvent(id) {
  return api.delete(`/calendar/events/${id}`);
}
