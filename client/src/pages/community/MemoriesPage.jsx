import useViewSwitch from '../../hooks/useViewSwitch';
import AlbumsListPage from '../AlbumsListPage';
import EntertainmentPage from '../EntertainmentPage';
import { Page } from '../../components/common/motion';

// "Memories" = the batch's shared history: photo albums + the nostalgia archive.
export default function MemoriesPage() {
  const { active, switcher } = useViewSwitch(
    [
      { key: 'gallery', label: 'Gallery' },
      { key: 'archive', label: 'Archive' },
    ],
    'gallery'
  );

  return (
    <Page overview={{
      pageKey: 'community-memories',
      title: 'BatchVault — your batch, preserved',
      blurb: 'Shared photo albums plus a nostalgia archive of throwbacks and batch milestones.',
      takeaway: 'Switch between Gallery and Archive with the tabs above.',
    }}>
      {switcher}
      {active === 'archive' ? <EntertainmentPage /> : <AlbumsListPage />}
    </Page>
  );
}
