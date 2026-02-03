'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HeroCarousel from '@/components/HeroCarousel';
import IgnitionForm from '@/components/IgnitionForm';

export default function LandingPage() {
  const router = useRouter();
  const [showHeader, setShowHeader] = useState(true);

  // Auto-hide header after 2 seconds as per requirements
  useEffect(() => {
    const timer = setTimeout(() => setShowHeader(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Back Button Trap: If user has key, send them to Engine automatically
  // We check directly against LocalStorage here for speed, matching the Store key.
  useEffect(() => {
    // Use the STORE_KEY defined in useAppStore (cubit_api_key)
    if (typeof window !== 'undefined' && localStorage.getItem('cubit_api_key')) {
      router.push('/engine');
    }
  }, [router]);

  // Re-show header on scroll? User said "header will appear whenever someone is scrolling up or down"
  // Implementing simple scroll listener for re-appearance
  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      if (window.scrollY < lastScrollY || window.scrollY < 50) {
        setShowHeader(true);
      } else {
        setShowHeader(false);
      }
      lastScrollY = window.scrollY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="min-h-[100dvh] bg-[#FAFAFA] text-[#111111] flex flex-col font-sans overflow-x-hidden">
      {/* 1. Header (Sticky/Auto-Hide) */}
      <header
        className={`sticky top-0 z-50 h-[60px] flex items-center justify-center bg-[#FAFAFA]/95 border-b border-black transition-transform duration-500 ${showHeader ? 'translate-y-0' : '-translate-y-full'}`}
      >
        <h1 className="font-serif text-xl font-bold tracking-tight">Recipes for Life</h1>
      </header>

      {/* 2. Headline */}
      <section className="text-center py-12 px-4 bg-[#FAFAFA]">
        <h2 className="text-3xl md:text-5xl font-serif font-black mb-4 tracking-tight leading-tight">
          Turn doom scrolling
          <br />
          into micro learning
        </h2>
      </section>

      {/* 3. Hero Carousel (The Hook) */}
      <section className="flex-1 w-full max-w-7xl mx-auto border-y border-black bg-[#FAFAFA] min-h-[500px] relative overflow-hidden">
        <HeroCarousel />
      </section>

      {/* 4. The Steps (The Process) */}
      <section className="py-12 bg-white border-b border-black">
        <div className="max-w-4xl mx-auto px-6 font-mono text-sm space-y-4">
          <p>STEP ONE – HELP ME SEARCH FOR AN INSTAGRAM TOPIC AND POSTS</p>
          <p>STEP TWO – USE THE POSTS TO CREATE RECIPES</p>
          <p>STEP THREE – USE YOUR RECIPE TO INTERACT WITH OTHERS</p>
          <p>STEP FOUR – CREATE AN ORIGINAL POST WITH YOUR IMPROVEMENTS</p>
          <p className="pt-4 font-sans text-lg italic">
            Use social media to learn and add value to the social media space
          </p>
        </div>
      </section>

      {/* 5. Ignition (Input) */}
      <section className="bg-white text-[#111111] py-24 px-6 text-center border-t border-black">
        <div className="max-w-xl mx-auto">
          <p className="font-mono text-xs uppercase tracking-widest mb-4 text-zinc-500">Ignition</p>
          <IgnitionForm />
        </div>
      </section>
    </main>
  );
}
