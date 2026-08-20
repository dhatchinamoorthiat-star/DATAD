import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon,
  Sparkles, Cake, Briefcase, Bell, Clock,
} from 'lucide-react';
import { getHolidays, getEvents, createEvent, deleteEvent } from '../../api/calendar';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Page } from '../../components/common/motion';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import DateInput from '../../components/common/DateInput';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const TYPE_STYLES = {
  birthday: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  meeting: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  reminder: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  event: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

const TYPE_ICONS = {
  birthday: Cake,
  meeting: Briefcase,
  reminder: Bell,
  event: CalendarIcon,
  other: CalendarIcon,
};

function buildCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days = [];
  for (let i = 0; i < startPad; i++) days.push(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function sameDay(a, b) {
  return a && b && a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function CalendarPage() {
  useDocumentTitle('Calendar');
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today);
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', time: '', type: 'event', description: '' });
  const [error, setError] = useState('');

  const days = useMemo(() => buildCalendarDays(year, month), [year, month]);

  const dateKey = (d) => d && `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const selKey = dateKey(selectedDate);

  const holidaysForDate = useMemo(
    () => holidays.filter((h) => h.date === selKey),
    [holidays, selKey]
  );

  const eventsForDate = useMemo(
    () => events.filter((e) => e.date === selKey),
    [events, selKey]
  );

  const eventsMap = useMemo(() => {
    const map = {};
    for (const h of holidays) {
      if (!map[h.date]) map[h.date] = [];
      map[h.date].push({ ...h, _isHoliday: true });
    }
    for (const e of events) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [holidays, events]);

  // Holidays are fetched a year at a time, so this must not depend on `month`
  // — it was refiring the same request on every arrow click.
  useEffect(() => {
    let cancelled = false;
    getHolidays(year)
      .then((res) => { if (!cancelled) setHolidays(res.data.holidays || []); })
      .catch(() => { if (!cancelled) setHolidays([]); });
    return () => { cancelled = true; };
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    // Drop the old month's events up front: without this, a slow or failed
    // fetch left the previous month's list rendered under the new heading.
    setEvents([]);
    setError('');
    getEvents(year, month + 1)
      .then((res) => { if (!cancelled) setEvents(res.data.events || []); })
      .catch(() => { if (!cancelled) setError('Could not load events for this month.'); });
    return () => { cancelled = true; };
  }, [year, month]);

  // Moving months has to carry the selection with it. Leaving `selectedDate`
  // behind meant the grid showed one month while the side panel was still
  // headed with a day from another, and no cell appeared selected at all.
  function goToMonth(y, m) {
    setYear(y);
    setMonth(m);
    setSelectedDate((cur) => {
      const lastDay = new Date(y, m + 1, 0).getDate();
      return new Date(y, m, Math.min(cur.getDate(), lastDay));
    });
  }

  function prev() {
    goToMonth(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1);
  }
  function next() {
    goToMonth(month === 11 ? year + 1 : year, month === 11 ? 0 : month + 1);
  }

  function openForm(d) {
    setForm({ title: '', date: dateKey(d), time: '', type: 'event', description: '' });
    setShowForm(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.title || !form.date) return;
    try {
      const res = await createEvent(form);
      const created = res.data.event;
      // `events` only ever holds the visible month. Appending an event dated
      // outside it put a row in state that no cell could render and that the
      // next fetch would drop, so only keep it when it belongs here.
      const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
      if (created?.date?.startsWith(monthPrefix)) {
        setEvents((prev) => [...prev, created]);
      }
      setError('');
      setShowForm(false);
    } catch {
      setError('Could not save that event. Please try again.');
    }
  }

  async function handleDelete(id) {
    try {
      await deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e._id !== id));
      setError('');
    } catch {
      setError('Could not delete that event. Please try again.');
    }
  }

  const hasEvents = (d) => {
    const k = dateKey(d);
    return eventsMap[k] && eventsMap[k].length > 0;
  };

  return (
    <Page overview={{
      pageKey: 'life-calendar',
      title: 'Everything dated, in one grid',
      blurb: 'Assignment deadlines, events and your own entries on a single month view.',
      takeaway: 'Check the week ahead on Sunday so nothing lands as a surprise.',
    }}>
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-16">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Calendar</h1>
        </div>

        {error && (
          <p className="rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger-700 dark:bg-danger-950/30 dark:text-danger-300">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Calendar grid */}
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              {/* Month header */}
              <div className="mb-4 flex items-center justify-between">
                <button onClick={prev} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                  {MONTHS[month]} {year}
                </h2>
                <button onClick={next} className="rounded-full p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {/* Weekday headers */}
              <div className="mb-1 grid grid-cols-7">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1 text-center text-xs font-medium text-gray-400">
                    {w}
                  </div>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7">
                {days.map((d, i) => {
                  const isToday = sameDay(d, today);
                  const isSelected = sameDay(d, selectedDate);
                  const has = d && hasEvents(d);
                  return (
                    <div key={i} className="aspect-square p-0.5">
                      {d ? (
                        <button
                          onClick={() => setSelectedDate(d)}
                          className={`
                            flex h-full w-full flex-col items-center justify-center rounded-xl text-sm
                            transition-all
                            ${isSelected
                              ? 'bg-primary-500 text-white shadow-sm'
                              : isToday
                              ? 'border border-primary-300 text-primary-700 dark:border-primary-600 dark:text-primary-300'
                              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}
                          `}
                        >
                          <span className="text-sm font-medium">{d.getDate()}</span>
                          {has && (
                            <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? 'bg-white' : 'bg-primary-500 dark:bg-primary-400'}`} />
                          )}
                        </button>
                      ) : (
                        <div />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Event panel */}
          <div className="w-full lg:w-80 shrink-0">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </h3>
                <button
                  onClick={() => openForm(selectedDate)}
                  className="flex items-center gap-1 rounded-full bg-primary-500 px-3 py-1 text-xs font-medium text-white hover:bg-primary-600"
                >
                  <Plus className="h-3 w-3" /> Add
                </button>
              </div>

              {holidaysForDate.length === 0 && eventsForDate.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No events for this day
                </p>
              )}

              <div className="space-y-2">
                {holidaysForDate.map((h, i) => (
                  <div key={`hol-${i}`} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 dark:bg-amber-950/20">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-200">{h.name}</p>
                      <p className="text-[10px] text-amber-600 dark:text-amber-400">Public holiday</p>
                    </div>
                  </div>
                ))}
                {eventsForDate.map((ev) => {
                  const Icon = TYPE_ICONS[ev.type] || CalendarIcon;
                  const style = TYPE_STYLES[ev.type] || TYPE_STYLES.other;
                  return (
                    <div key={ev._id} className={`flex items-start gap-2 rounded-lg p-2.5 ${style}`}>
                      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{ev.title}</p>
                        {ev.time && (
                          <p className="mt-0.5 flex items-center gap-1 text-[10px] opacity-70">
                            <Clock className="h-3 w-3" /> {ev.time}
                          </p>
                        )}
                        {ev.description && (
                          <p className="mt-0.5 text-[10px] opacity-70">{ev.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(ev._id)}
                        className="shrink-0 rounded p-1 opacity-50 hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Add event modal */}
        <Modal open={showForm} onClose={() => setShowForm(false)} title="Add event">
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label htmlFor="calendar-title" className="mb-1 block text-xs font-medium text-gray-500">Title *</label>
              <input id="calendar-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Event title"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DateInput
                label="Date *"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
              <div>
                <label htmlFor="calendar-time" className="mb-1 block text-xs font-medium text-gray-500">Time</label>
                <input id="calendar-time"
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </div>
            </div>
            <div>
              <label htmlFor="calendar-type" className="mb-1 block text-xs font-medium text-gray-500">Type</label>
              <select id="calendar-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
              >
                <option value="event">Event</option>
                <option value="birthday">Birthday</option>
                <option value="meeting">Meeting</option>
                <option value="reminder">Reminder</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label htmlFor="calendar-description" className="mb-1 block text-xs font-medium text-gray-500">Description</label>
              <textarea id="calendar-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm">Save</Button>
            </div>
          </form>
        </Modal>
      </div>
    </Page>
  );
}
