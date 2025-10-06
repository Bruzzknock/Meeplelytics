import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import PlayersPage from './pages/PlayersPage';
import TeamsPage from './pages/TeamsPage';
import GamesPage from './pages/GamesPage';
import TournamentsPage from './pages/TournamentsPage';
import ImportPage from './pages/ImportPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/games" element={<GamesPage />} />
        <Route path="/tournaments" element={<TournamentsPage />} />
        <Route path="/import" element={<ImportPage />} />
      </Routes>
    </Layout>
  );
}
