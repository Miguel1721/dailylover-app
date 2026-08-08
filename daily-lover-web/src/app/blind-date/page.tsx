"use client";

import React from "react";
import Image from "next/image";
import { Sparkles, ShieldCheck, Heart, UserCheck, Calendar, MapPin, ArrowRight } from "lucide-react";
import FAQAccordion from "@/components/FAQAccordion";

export default function BlindDatePage() {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative py-16 md:py-24 bg-gradient-to-b from-neutral-900 via-neutral-900 to-black text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#961500]/20 blur-3xl rounded-full pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#961500]/20 text-red-400 text-xs font-bold uppercase tracking-wider border border-[#961500]/40">
                <Sparkles className="w-3.5 h-3.5" />
                <span>EXPERIENCIA EXCLUSIVA 1 A 1</span>
              </div>

              <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                Citas a Ciegas &amp; Experiencias Sociales
              </h1>

              <p className="text-lg text-neutral-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                Olvídate del swipe sin sentido. Coordinamos una velada perfecta en un restaurante seleccionado para ti con alguien que comparte tus valores, estilo de vida e intenciones.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <a
                  href="https://tally.so/r/wQQ0zg"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 text-base font-bold text-white bg-[#961500] hover:bg-[#731000] rounded-full transition-all shadow-lg hover:shadow-red-900/40"
                >
                  <span>Llenar Formulario de Match</span>
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>

              <div className="pt-6 flex items-center justify-center lg:justify-start gap-6 text-xs text-neutral-400 font-medium">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-red-400" />
                  <span>Confidencialidad Garantizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-400" />
                  <span>+90% Compatibilidad en 1ra Cita</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-neutral-800 aspect-[4/5] bg-neutral-800">
                <Image
                  src="/images/event_blind_date.jpeg"
                  alt="Experiencia Cita a Ciegas Daily Lover"
                  fill
                  priority
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form Embed Section */}
      <section id="formulario" className="py-20 bg-neutral-50 border-y border-neutral-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-[#961500] bg-[#961500]/10 px-3.5 py-1.5 rounded-full">
            FORMULARIO OFICIAL
          </span>
          <h2 className="font-heading text-3xl font-extrabold text-neutral-900">
            Aplica para tu próxima Cita a Ciegas
          </h2>
          <p className="text-neutral-600 text-sm sm:text-base max-w-xl mx-auto">
            Toma menos de 3 minutos. Toda la información es revisada exclusivamente por nuestro equipo de matchmaking.
          </p>

          <div className="pt-6">
            <div className="w-full bg-white rounded-3xl p-4 md:p-8 shadow-xl border border-neutral-200 min-h-[600px] flex items-center justify-center">
              <iframe
                src="https://tally.so/embed/wQQ0zg?alignLeft=1&hideTitle=1&transparentBackground=1&dynamicHeight=1"
                width="100%"
                height="600"
                frameBorder="0"
                title="Formulario Daily Lover"
                className="w-full rounded-2xl"
              ></iframe>
            </div>
          </div>
        </div>
      </section>

      <FAQAccordion />
    </div>
  );
}
