import { useRegisterSW } from 'virtual:pwa-register/react';

// Shows a banner when a new build is waiting. The page only reloads when the
// user taps "Reload", so an update never interrupts hand entry.
export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="update-banner" role="status">
      <span>New version available</span>
      <div className="row gap-8">
        <button className="btn btn-ghost btn-sm" onClick={() => setNeedRefresh(false)}>Later</button>
        <button className="btn btn-primary btn-sm" onClick={() => updateServiceWorker(true)}>Reload</button>
      </div>
    </div>
  );
}
