import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DaxApp } from '../dax';
// While DAX_MAINTENANCE is on the page stays fully open, but the chat is
// served by the local canned-reply adapter instead of the streaming backend,
// so no model call is made from this page.
import { createDaxChatAdapter } from '../api/daxChatAdapter';
import { createDaxMaintenanceAdapter } from '../api/daxMaintenanceAdapter';
import { DAX_MAINTENANCE } from '../dax/maintenance';
import { useAuth } from '../context/AuthContext';
import { DAX, DAX_WELCOME } from '../utils/dax';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function DaxPage() {
  useDocumentTitle(DAX);
  const { user } = useAuth();
  const adapter = useMemo(
    () => (DAX_MAINTENANCE ? createDaxMaintenanceAdapter() : createDaxChatAdapter()),
    []
  );
  const [searchParams] = useSearchParams();
  const isHome = searchParams.has('home');

  return (
    <DaxApp
      adapter={adapter}
      config={{
        brandName: DAX,
        greeting: DAX_WELCOME.split('\n\n')[0],
        subtitle: DAX_WELCOME.split('\n\n')[1],
        userName: user?.name,
        userId: user?.id,
        exitHref: '/dashboard',
        defaultMode: isHome ? 'home' : 'workspace',
        maintenance: DAX_MAINTENANCE,
      }}
    />
  );
}
