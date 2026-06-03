import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import NPBPage from './pages/NPBPage';
import CPBLPage from './pages/CPBLPage';
import WBSCPage from './pages/WBSCPage';
import PlayersPage from './pages/PlayersPage';
import PollPage from './pages/PollPage';
import AdminPage from './pages/AdminPage';
import ArticlePage from './pages/ArticlePage';
import AthleticsPage from './pages/AthleticsPage';
import NpbGamePage from './pages/NpbGamePage';
import CpblGamePage from './pages/CpblGamePage';
import SoccerPage from './pages/SoccerPage';

export default function App() {
  return (
    <HelmetProvider>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          {/* NPB/CPBL 比賽獨立頁（無 Layout）*/}
          <Route path="/npb/game/:id" element={<NpbGamePage />} />
          <Route path="/cpbl/game/:id" element={<CpblGamePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/npb" element={<NPBPage />} />
            <Route path="/cpbl" element={<CPBLPage />} />
            <Route path="/wbsc" element={<WBSCPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/poll" element={<PollPage />} />
            <Route path="/athletics" element={<AthleticsPage />} />
            <Route path="/soccer" element={<SoccerPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/article" element={<ArticlePage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
    </HelmetProvider>
  );
}
