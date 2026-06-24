import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AppProvider } from './context/AppContext';
import Layout from './components/Layout';
import SplashScreen from './components/SplashScreen';
import HomePage from './pages/HomePage';
import NPBPage from './pages/NpbPage';
import CPBLPage from './pages/CPBLPage';
import WBSCPage from './pages/WBSCPage';
import PlayersPage from './pages/PlayersPage';
import PollPage from './pages/PollPage';
import AdminPage from './pages/AdminPage';
import ArticlePage from './pages/ArticlePage';
import AthleticsPage from './pages/AthleticsPage';
import NpbGamePage from './pages/NpbGamePage';
import CpblGamePage from './pages/CpblGamePage';
import NbaGamePage from './pages/NbaGamePage';
import SoccerPage from './pages/SoccerPage';
import TaiwanBaseballPage from './pages/TaiwanBaseballPage';
import TPSLPage from './pages/TPSLPage';
import NBAPage from './pages/NBAPage';
import PLeaguePage from './pages/PLeaguePage';
import TPBLPage from './pages/TPBLPage';
import TaiwanBasketballPage from './pages/TaiwanBasketballPage';
import ProfilePage from './pages/ProfilePage';
import MLBPage from './pages/MLBPage';
import TableTennisPage from './pages/TableTennisPage';

export default function App() {
  return (
    <HelmetProvider>
    <BrowserRouter>
      <AppProvider>
        <SplashScreen />
        <Routes>
          {/* NPB/CPBL/NBA 比賽獨立頁（無 Layout）*/}
          <Route path="/npb/game/:id" element={<NpbGamePage />} />
          <Route path="/cpbl/game/:id" element={<CpblGamePage />} />
          <Route path="/nba/game/:gameId" element={<NbaGamePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/npb" element={<NPBPage />} />
            <Route path="/cpbl" element={<CPBLPage />} />
            <Route path="/wbsc" element={<WBSCPage />} />
            <Route path="/players" element={<PlayersPage />} />
            <Route path="/poll" element={<PollPage />} />
            <Route path="/athletics" element={<AthleticsPage />} />
            <Route path="/soccer" element={<SoccerPage />} />
            <Route path="/taiwan-baseball" element={<TaiwanBaseballPage />} />
            <Route path="/mlb" element={<MLBPage />} />
            <Route path="/tpsl" element={<TPSLPage />} />
            <Route path="/nba" element={<NBAPage />} />
            <Route path="/pleague" element={<PLeaguePage />} />
            <Route path="/tpbl" element={<TPBLPage />} />
            <Route path="/taiwan-basketball" element={<TaiwanBasketballPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/article" element={<ArticlePage />} />
            <Route path="/article/:slug" element={<ArticlePage />} />
            <Route path="/table-tennis" element={<TableTennisPage />} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
    </HelmetProvider>
  );
}
