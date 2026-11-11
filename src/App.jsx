import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Home from './screens/Home';
import SessionSetup from './screens/SessionSetup';
import SessionView from './screens/SessionView';
import HandRecorder from './screens/HandRecorder';
import QuickHandEntry from './screens/QuickHandEntry';
import HandDetail from './screens/HandDetail';
import History from './screens/History';
import Players from './screens/Players';
import Backup from './screens/Backup';
import UpdateBanner from './components/UpdateBanner';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}

function PlayersIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <UpdateBanner />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/session/new" element={<SessionSetup />} />
        <Route path="/session/:id" element={<SessionView />} />
        <Route path="/session/:id/record" element={<HandRecorder />} />
        <Route path="/session/:id/record/:resumeId" element={<HandRecorder />} />
        <Route path="/session/:id/quick" element={<QuickHandEntry />} />
        <Route path="/hand/:id" element={<HandDetail />} />
        <Route path="/hand/:handId/edit" element={<HandRecorder />} />
        <Route path="/history" element={<History />} />
        <Route path="/players" element={<Players />} />
        <Route path="/backup" element={<Backup />} />
      </Routes>
      <nav className="bottom-nav">
        <NavLink to="/" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')} end>
          <HomeIcon />
          Home
        </NavLink>
        <NavLink to="/history" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <HistoryIcon />
          History
        </NavLink>
        <NavLink to="/players" className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
          <PlayersIcon />
          Players
        </NavLink>
      </nav>
    </BrowserRouter>
  );
}
