import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })));
const Campaigns = lazy(() => import('./pages/Campaigns').then((m) => ({ default: m.Campaigns })));
const CampaignWizard = lazy(() => import('./pages/CampaignWizard').then((m) => ({ default: m.CampaignWizard })));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail').then((m) => ({ default: m.CampaignDetail })));
const Optimization = lazy(() => import('./pages/Optimization').then((m) => ({ default: m.Optimization })));
const Conversions = lazy(() => import('./pages/Conversions').then((m) => ({ default: m.Conversions })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="campaigns" element={<Campaigns />} />
            <Route path="campaigns/new" element={<CampaignWizard />} />
            <Route path="campaigns/:id" element={<CampaignDetail />} />
            <Route path="optimization" element={<Optimization />} />
            <Route path="conversions" element={<Conversions />} />
            <Route path="*" element={<p className="text-slate-500">Page not found.</p>} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
