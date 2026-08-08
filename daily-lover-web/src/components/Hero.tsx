"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Sparkles, ShieldCheck, Users } from "lucide-react";
import { CityConfig } from "@/types";

interface HeroProps {
  city: CityConfig;
}

export default function Hero({ city }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-neutral-50 via-white to-white py-16 md:py-24">
      {/* Background Subtle Gradient Blobs */}
      <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 w-96 h-96 rounded-full bg-[#961500]/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 translate-y-12 -translate-x-12 w-96 h-96 rounded-full bg-[#961500]/5 blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Content */}
          <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
            {/* City Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#961500]/10 text-[#961500] text-xs md:text-sm font-semibold tracking-wide uppercase border border-[#961500]/20">
              <Sparkles className="w-4 h-4" />
              <span>{city.heroBadge}</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight text-neutral-900 leading-[1.15]">
              {city.heroTitle}
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg md:text-xl text-neutral-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {city.heroSubtitle}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-2">
              <a
                href={city.ctaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-bold text-white bg-[#961500] hover:bg-[#731000] rounded-full transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                <span>{city.ctaText}</span>
                <ArrowRight className="w-5 h-5" />
              </a>

              <Link
                href="/eventos"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 text-base font-semibold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 rounded-full transition-all border border-neutral-200"
              >
                Ver Eventos
              </Link>
            </div>

            {/* Trust Markers */}
            <div className="pt-6 border-t border-neutral-100 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-xs md:text-sm text-neutral-500 font-medium">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#961500]" />
                <span>100% Curado por Humanos</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#961500]" />
                <span>Solteros Verificados</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Image */}
          <div className="lg:col-span-5 relative">
            <div className="relative mx-auto max-w-md lg:max-w-none">
              {/* Decorative Accent Card Behind */}
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[#961500]/20 to-neutral-200 blur-lg transform rotate-2" />

              {/* Main Image Frame */}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-white aspect-[4/5] bg-neutral-100">
                <Image
                  src={city.heroImage}
                  alt={city.heroTitle}
                  fill
                  priority
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                />

                {/* Floating Overlay Badge */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md p-4 rounded-xl shadow-lg border border-white/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#961500] text-white flex items-center justify-center shrink-0 font-bold text-xs">
                      DL
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-900">
                        Club Privado de Solteros
                      </p>
                      <p className="text-[11px] text-neutral-500">
                        Filtro de privacidad &amp; selección personalizada
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
