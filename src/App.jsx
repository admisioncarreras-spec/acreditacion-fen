import { Routes, Route } from 'react-router-dom';
import Totem from './pages/Totem.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Totem />} />
      <Route path="*" element={<Totem />} />
    </Routes>
  );
}
