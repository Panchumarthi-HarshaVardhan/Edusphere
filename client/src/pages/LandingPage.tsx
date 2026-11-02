import React, { lazy, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Hero } from './landing/Hero';
import { SiteHeader } from './landing/SiteHeader';
import { LazySection } from './landing/LazySection';
import { SiteFooter } from './landing/SiteFooter';
import { ExploreDemoModal } from '../components/ExploreDemoModal';

const TrustProblem = lazy(() => import('./landing/TrustProblem').then((module) => ({ default: module.TrustProblem })));
const PortalsSection = lazy(() => import('./landing/PortalsSection').then((module) => ({ default: module.PortalsSection })));
const FeaturesGrid = lazy(() => import('./landing/FeaturesGrid').then((module) => ({ default: module.FeaturesGrid })));
const HowItWorks = lazy(() => import('./landing/HowItWorks').then((module) => ({ default: module.HowItWorks })));
const SecuritySection = lazy(() => import('./landing/SecuritySection').then((module) => ({ default: module.SecuritySection })));
const RoadmapSection = lazy(() => import('./landing/RoadmapSection').then((module) => ({ default: module.RoadmapSection })));
const FAQSection = lazy(() => import('./landing/FAQSection').then((module) => ({ default: module.FAQSection })));
const DemoRequestSection = lazy(() => import('./landing/DemoRequestSection').then((module) => ({ default: module.DemoRequestSection })));

function destinationForRole(role: string): string {
  if (role === 'STUDENT') return '/student';
  if (['HOD', 'CLASS_INCHARGE', 'FACULTY'].includes(role)) return '/faculty';
  if (['ADMIN', 'SUPER_ADMIN'].includes(role)) return '/admin';
  return '/login';
}

export function LandingPageMarketing() {
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  return <div className="landing-page min-h-screen bg-white font-sans text-slate-900 antialiased dark:bg-slate-950 dark:text-white">
    <SiteHeader onOpenDemo={() => setDemoModalOpen(true)} />
    <main>
      <Hero onOpenDemo={() => setDemoModalOpen(true)} />
      <LazySection minHeight="18rem"><TrustProblem /></LazySection>
      <LazySection id="portals" minHeight="42rem"><PortalsSection /></LazySection>
      <LazySection id="features" minHeight="34rem"><FeaturesGrid /></LazySection>
      <LazySection id="how-it-works" minHeight="30rem"><HowItWorks /></LazySection>
      <LazySection minHeight="28rem"><SecuritySection /></LazySection>
      <LazySection minHeight="22rem"><RoadmapSection /></LazySection>
      <LazySection id="faq" minHeight="26rem"><FAQSection /></LazySection>
      <LazySection id="request-demo" minHeight="38rem"><DemoRequestSection /></LazySection>
    </main>
    <SiteFooter />
    {demoModalOpen && <ExploreDemoModal isOpen={demoModalOpen} onClose={() => setDemoModalOpen(false)} />}
  </div>;
}

export const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();
  if (loading) return <main className="grid min-h-screen place-items-center bg-white dark:bg-slate-950" aria-label="Loading EduSphere"><span className="size-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" /></main>;
  if (user) return <Navigate to={destinationForRole(user.role)} replace />;
  return <LandingPageMarketing />;
};
