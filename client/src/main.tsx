import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { AuthProvider, RequireAuth } from './auth';
import { Login } from './pages/Login';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Products = lazy(() => import('./pages/Products').then((m) => ({ default: m.Products })));
const Campaigns = lazy(() => import('./pages/Campaigns').then((m) => ({ default: m.Campaigns })));
const CampaignWizard = lazy(() => import('./pages/CampaignWizard').then((m) => ({ default: m.CampaignWizard })));
const CampaignDetail = lazy(() => import('./pages/CampaignDetail').then((m) => ({ default: m.CampaignDetail })));
const Optimization = lazy(() => import('./pages/Optimization').then((m) => ({ default: m.Optimization })));
const Users = lazy(() => import('./pages/Users').then((m) => ({ default: m.Users })));
const Security = lazy(() => import('./pages/Security').then((m) => ({ default: m.Security })));
const ChangePassword = lazy(() => import('./pages/ChangePassword').then((m) => ({ default: m.ChangePassword })));
const Conversions = lazy(() => import('./pages/Conversions').then((m) => ({ default: m.Conversions })));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<Spinner />}>
          <Routes>
            <Route path="login" element={<Login />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route
                path="campaigns/new"
                element={
                  <RequireAuth roles={['ADMIN', 'MARKETER']}>
                    <CampaignWizard />
                  </RequireAuth>
                }
              />
              <Route path="campaigns/:id" element={<CampaignDetail />} />
              <Route path="optimization" element={<Optimization />} />
              <Route path="conversions" element={<Conversions />} />
              <Route path="account/password" element={<ChangePassword />} />
              <Route path="account/security" element={<Security />} />
              <Route
                path="users"
                element={
                  <RequireAuth roles={['ADMIN']}>
                    <Users />
                  </RequireAuth>
                }
              />
              <Route path="*" element={<p className="text-slate-500">Page not found.</p>} />
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
