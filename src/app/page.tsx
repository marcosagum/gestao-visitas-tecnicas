"use client";

import VTDashboard from '@/components/VTDashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#03050c] flex items-center justify-center p-4 md:p-8">
      <div className="w-full">
        <VTDashboard />
      </div>
    </main>
  );
}
