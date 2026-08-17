import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { CalendarRange, MapPin, Video, Users, Clock, Plus } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listEvents, createEvent, rsvpEvent, getMyRSVPs, getEventAttendees } from '../../api/events';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import DateInput from '../../components/common/DateInput';
import { Page } from '../../components/common/motion';

const CAT_COLORS = {
  academic: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  social: 'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  career: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  sports: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  other: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const RSVP_LABELS = { going: 'Going ✓', maybe: 'Maybe', 'not-going': 'Not Going' };

function EventCard({ event, myRsvp, onRsvp, onViewAttendees }) {
  const date = new Date(event.date);
  const [rsvp, setRsvp] = useState(myRsvp);

  const handleRsvp = async (status) => {
    try {
      await onRsvp(event._id, status);
      setRsvp(status);
    } catch { toast.error('Could not RSVP'); }
  };

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white p-5 dark:border-gray-800/80 dark:bg-gray-900">
        <div className="mb-3 flex gap-4">
        <div className="flex-shrink-0 text-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-medium text-gray-400 uppercase">{date.toLocaleDateString('en', { month: 'short' })}</p>
          <p className="text-2xl font-bold">{date.getDate()}</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold truncate">{event.title}</p>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CAT_COLORS[event.category]}`}>{event.category}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            {event.online ? (
              <span className="flex items-center gap-1"><Video className="h-3.5 w-3.5" /> Online</span>
            ) : event.location ? (
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>
            ) : null}
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </div>

      {event.description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{event.description}</p>}

      <div className="flex items-center justify-between gap-3">
        <button onClick={() => onViewAttendees(event._id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600">
          <Users className="h-3.5 w-3.5" /> Attendees
        </button>
        <div className="flex gap-1">
          {['going', 'maybe', 'not-going'].map((s) => (
            <button key={s} onClick={() => handleRsvp(s)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                rsvp === s ? 'bg-indigo-600 text-white' : 'border border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800'
              }`}>
              {RSVP_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function EventsPage() {
  useDocumentTitle('Events');
  const [tab, setTab] = useState('upcoming');
  const [events, setEvents] = useState(null);
  const [myRsvps, setMyRsvps] = useState([]);
  const [catFilter, setCatFilter] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [attendeesModal, setAttendeesModal] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    const params = { upcoming: tab === 'upcoming' ? 'true' : 'false' };
    if (catFilter) params.category = catFilter;
    listEvents(params).then((r) => setEvents(r.data)).catch(() => setEvents([]));
    getMyRSVPs().then((r) => setMyRsvps(r.data)).catch(() => {});
  }, [tab, catFilter]);

  const onAdd = async (data) => {
    try {
      await createEvent(data);
      toast.success('Event created');
      setShowAdd(false);
      reset();
      listEvents({ upcoming: 'true' }).then((r) => setEvents(r.data)).catch(() => {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create event');
    }
  };

  const handleRsvp = async (eventId, status) => {
    await rsvpEvent(eventId, status);
    setMyRsvps((prev) => {
      const idx = prev.findIndex((r) => r.event?._id === eventId || r.event === eventId);
      if (idx >= 0) return prev.map((r, i) => i === idx ? { ...r, status } : r);
      return [...prev, { event: { _id: eventId }, status }];
    });
  };

  const viewAttendees = async (eventId) => {
    try {
      const res = await getEventAttendees(eventId);
      setAttendees(res.data);
      setAttendeesModal(eventId);
    } catch { toast.error('Could not load attendees'); }
  };

  const getRsvpStatus = (eventId) => myRsvps.find((r) => (r.event?._id || r.event) === eventId)?.status || null;

  const myRsvpEvents = myRsvps.filter((r) => r.status !== 'not-going' && r.event);

  return (
    <Page>
      <PageHeader
        icon={CalendarRange}
        title="Events"
        subtitle="Campus events with RSVP — never miss one"
        action={{ label: 'Create Event', onClick: () => setShowAdd(true), icon: Plus }}
      />

      <div className="mb-4 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-900/50 w-fit">
        {[['upcoming', 'Upcoming'], ['past', 'Past'], ['my-rsvps', 'My RSVPs']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium ${tab === key ? 'bg-white shadow-sm dark:bg-gray-800' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2 flex-wrap">
        {['', 'academic', 'social', 'career', 'sports', 'other'].map((c) => (
          <button key={c || 'all'} onClick={() => setCatFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${catFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}>
            {c || 'All'}
          </button>
        ))}
      </div>

      {tab === 'my-rsvps' ? (
        myRsvpEvents.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No RSVPs" description="RSVP to events to see them here" />
        ) : (
          <div className="space-y-4">
            {myRsvpEvents.map((r) => (
              <EventCard key={r._id} event={r.event} myRsvp={r.status} onRsvp={handleRsvp} onViewAttendees={viewAttendees} />
            ))}
          </div>
        )
      ) : (
        events === null ? <FeedSkeleton count={3} /> : events.length === 0 ? (
          <EmptyState icon={CalendarRange} title="No events" description="Create the first event for the batch" cta={{ label: 'Create Event', onClick: () => setShowAdd(true) }} />
        ) : (
          <div className="space-y-4">
            {events.map((e) => <EventCard key={e._id} event={e} myRsvp={getRsvpStatus(e._id)} onRsvp={handleRsvp} onViewAttendees={viewAttendees} />)}
          </div>
        )
      )}

      {/* Attendees Modal */}
      <Modal open={!!attendeesModal} onClose={() => setAttendeesModal(null)} title="Attendees">
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {attendees.length === 0 ? <p className="text-sm text-gray-400">No attendees yet</p> :
            attendees.map((a) => (
              <div key={a._id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 flex items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {a.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <p className="text-sm">{a.user?.name}</p>
                </div>
                <span className={`text-xs font-medium ${a.status === 'going' ? 'text-emerald-600' : 'text-amber-600'}`}>{a.status}</span>
              </div>
            ))}
        </div>
      </Modal>

      {/* Create Event Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="Create Event">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <input {...register('title', { required: true })} placeholder="Event title *" className="input" />
          <textarea {...register('description')} placeholder="Description" rows={2} className="input" />
          <div className="grid grid-cols-2 gap-2">
            <DateInput type="datetime-local" {...register('date', { required: true })} />
            <DateInput type="datetime-local" {...register('endDate')} />
          </div>
          <select {...register('category')} className="input">
            {['academic', 'social', 'career', 'sports', 'other'].map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
          </select>
          <input {...register('location')} placeholder="Location" className="input" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register('online')} className="rounded" /> Online event</label>
          <input {...register('meetLink')} placeholder="Meet / Zoom link (if online)" className="input" />
          <input {...register('organizer')} placeholder="Organizer name / club" className="input" />
          <input type="number" {...register('maxAttendees')} placeholder="Max attendees (optional)" className="input" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">Create</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
