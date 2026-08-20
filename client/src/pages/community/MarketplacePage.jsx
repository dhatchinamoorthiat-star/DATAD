import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from '../../utils/toast';
import { ShoppingBag, Tag, Search, Plus, Phone } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import { listListings, createListing, markSold, deleteListing } from '../../api/marketplace';
import { FeedSkeleton } from '../../components/common/Skeleton';
import EmptyState from '../../components/common/EmptyState';
import Modal from '../../components/common/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { Page } from '../../components/common/motion';

const CATEGORIES = ['books', 'electronics', 'stationery', 'clothing', 'prep-material', 'other'];
const CONDITIONS = ['new', 'like-new', 'good', 'fair'];

const COND_COLORS = {
  new: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  'like-new': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  good: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  fair: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function MarketplacePage() {
  useDocumentTitle('Marketplace');
  const { user } = useAuth();
  const [items, setItems] = useState(null);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showSold, setShowSold] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [contactItem, setContactItem] = useState(null);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = useCallback(() => {
    const params = {};
    if (catFilter) params.category = catFilter;
    if (search) params.search = search;
    if (showSold) params.showSold = 'true';
    listListings(params).then((r) => setItems(r.data)).catch(() => setItems([]));
  }, [catFilter, search, showSold]);

  useEffect(() => { load(); }, [load]);

  const onAdd = async (data) => {
    try {
      const tags = data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
      await createListing({ ...data, price: parseFloat(data.price), tags });
      toast.success('Listed!');
      setShowAdd(false);
      reset();
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const onMarkSold = async (id) => {
    try {
      await markSold(id);
      setItems((prev) => prev.map((i) => i._id === id ? { ...i, sold: true } : i));
      toast.success('Marked as sold');
    } catch { toast.error('Could not mark as sold'); }
  };

  const onDelete = async (id) => {
    try {
      await deleteListing(id);
      setItems((prev) => prev.filter((i) => i._id !== id));
    } catch { toast.error('Could not delete listing'); }
  };

  return (
    <Page overview={{
      pageKey: 'community-marketplace',
      title: 'Buy and sell within the batch',
      blurb: 'Books, electronics, prep material — zero commission, zero hassle.',
      takeaway: "List what you don't need; check here before buying new.",
    }}>
      <PageHeader
        icon={ShoppingBag}
        title="Marketplace"
        subtitle="Buy and sell within the batch — zero commission"
        action={{ label: 'List Item', onClick: () => setShowAdd(true), icon: Plus }}
      />

      <div className="mb-4 flex gap-2 flex-wrap">
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} onClick={() => setCatFilter(c)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${catFilter === c ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'}`}>
            {c || 'All'}{c === 'prep-material' ? '' : ''}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700">
          <input type="checkbox" checked={showSold} onChange={(e) => setShowSold(e.target.checked)} className="rounded" /> Show sold
        </label>
      </div>

      {items === null ? <FeedSkeleton count={4} /> : items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No listings yet" description="List something to sell — books, electronics, prep material" cta={{ label: 'List Item', onClick: () => setShowAdd(true) }} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <div key={item._id} className={`rounded-2xl border bg-white dark:bg-gray-900 ${item.sold ? 'border-gray-200 opacity-60 dark:border-gray-800' : 'border-gray-200/80 dark:border-gray-800/80'}`}>
              <div className="flex h-32 items-center justify-center rounded-t-2xl bg-gray-50 dark:bg-gray-800">
                <ShoppingBag className="h-12 w-12 text-gray-300 dark:text-gray-600" />
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <p className="font-semibold">{item.title}</p>
                  <p className="shrink-0 text-lg font-bold text-indigo-600 dark:text-indigo-400">₹{item.price.toLocaleString()}</p>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs capitalize dark:bg-gray-800">{item.category}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${COND_COLORS[item.condition]}`}>{item.condition}</span>
                  {item.sold && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/40 dark:text-red-400">Sold</span>}
                </div>
                {item.description && <p className="mb-2 text-xs text-gray-500 line-clamp-2">{item.description}</p>}
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.tags?.map((t) => <span key={t} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"><Tag className="mr-0.5 inline h-2.5 w-2.5" />{t}</span>)}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-400">{item.seller?.name}</p>
                  <div className="flex gap-1">
                    {!item.sold && user?._id === item.seller?._id && (
                      <>
                        <button onClick={() => onMarkSold(item._id)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">Sold</button>
                        <button onClick={() => onDelete(item._id)} className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:border-red-800">Delete</button>
                      </>
                    )}
                    {!item.sold && user?._id !== item.seller?._id && (
                      <button onClick={() => setContactItem(item)} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
                        <Phone className="h-3.5 w-3.5" /> Contact
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact Modal */}
      <Modal open={!!contactItem} onClose={() => setContactItem(null)} title={contactItem?.title}>
        <div className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
            <p className="text-xs text-gray-500 mb-1">Seller</p>
            <p className="font-medium">{contactItem?.seller?.name}</p>
            {contactItem?.contact && (
              <>
                <p className="mt-2 text-xs text-gray-500">Contact</p>
                <p className="font-medium break-all">{contactItem.contact}</p>
              </>
            )}
          </div>
          <div className="flex gap-3 text-sm">
            <div><span className="text-gray-500">Price:</span> <span className="font-bold text-indigo-600">₹{contactItem?.price?.toLocaleString()}</span></div>
            <div><span className="text-gray-500">Condition:</span> <span className="font-medium capitalize">{contactItem?.condition}</span></div>
          </div>
        </div>
      </Modal>

      {/* Add Listing Modal */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); reset(); }} title="List an Item">
        <form onSubmit={handleSubmit(onAdd)} className="space-y-3">
          <input {...register('title', { required: true })} placeholder="Item title *" className="input" />
          <textarea {...register('description')} placeholder="Description" rows={2} className="input" />
          <input type="number" {...register('price', { required: true })} placeholder="Price (₹) *" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <select {...register('category')} className="input">
              {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c.replace('-', ' ')}</option>)}
            </select>
            <select {...register('condition')} className="input">
              {CONDITIONS.map((c) => <option key={c} value={c} className="capitalize">{c.replace('-', ' ')}</option>)}
            </select>
          </div>
          <input {...register('contact')} placeholder="Your contact (WhatsApp / email / insta)" className="input" />
          <input {...register('tags')} placeholder="Tags (comma-separated: CMAT, Notes)" className="input" />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setShowAdd(false); reset(); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-700">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">List</button>
          </div>
        </form>
      </Modal>
    </Page>
  );
}
