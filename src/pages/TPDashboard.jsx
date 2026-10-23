import React from 'react';
import ModuleSwitcher from '../components/ModuleSwitcher';

const TPDashboard = () => (
  <div className="min-h-screen bg-[#F7F9FB] text-slate-900">
    <ModuleSwitcher />
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#005F56]">Third Party</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">TP Dashboard</h2>
        <p className="mt-4 max-w-2xl text-slate-600">
          Placeholder for Third Party insurance claims management.
        </p>
      </div>
    </main>
  </div>
);

export default TPDashboard;

