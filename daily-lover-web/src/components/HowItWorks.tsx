"use client";

import React from "react";
import {
  FileText,
  Video,
  UserCheck,
  Search,
  Sparkles,
  UtensilsCrossed,
  CheckCircle2,
} from "lucide-react";

export default function HowItWorks() {
  const steps = [
    {
      number: "01",
      icon: FileText,
      title: "Te inscribes",
      description: "",
      badge: "Paso 1",
    },
    {
      number: "02",
      icon: Video,
      title: "Agenda una videollamada 1:1 con nosotros (obligatoria)",
      description:
        "• Conocemos tu vibe real.\n• Validamos identidad.\n• Aclaramos qué buscas y tus límites.\n• Ajustamos tu perfil para maximizar compatibilidad.",
      badge: "Paso 2",
    },
    {
      number: "03",
      icon: UserCheck,
      title: "Analizamos tu perfil y tu energía",
      description: "",
      badge: "Paso 3",
    },
    {
      number: "04",
      icon: Search,
      title: "Buscamos un match compatible en tu ciudad",
      description: "",
      badge: "Paso 4",
    },
    {
      number: "05",
      icon: Sparkles,
      title: "Te proponemos una cita con detalles",
      description: "Lugar, hora, recordatorios, soporte.",
      badge: "Paso 5",
    },
    {
      number: "06",
      icon: UtensilsCrossed,
      title: "Hacemos la reserva por ti",
      description: "Tú solo tienes que llegar.",
      badge: "Paso 6",
    },
  ];

  return (
    <section
      id="como-funciona"
      className="py-20 bg-neutral-900 text-white relative overflow-hidden"
    >
      {/* Background Subtle Gradient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-7xl h-96 bg-[#961500]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[#961500] bg-[#961500]/10 px-3.5 py-1.5 rounded-full border border-[#961500]/30">
            ¿CÓMO FUNCIONA EL PROCESO?
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
            Nuestro proceso tiene 6 pasos:
          </h2>
        </div>

        {/* 6 Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className="relative bg-neutral-800/80 backdrop-blur-md rounded-2xl p-6 border border-neutral-700/60 hover:border-[#961500]/50 transition-all duration-300 group hover:-translate-y-1 shadow-xl flex flex-col justify-between"
              >
                <div>
                  {/* Step Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#961500]/20 text-[#961500] group-hover:bg-[#961500] group-hover:text-white transition-colors duration-300 flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-heading text-2xl font-black text-neutral-600 group-hover:text-[#961500]/60 transition-colors">
                      {step.number}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="font-heading text-lg font-bold text-white mb-2 group-hover:text-red-400 transition-colors">
                    {step.title}
                  </h3>

                  {/* Optional Description */}
                  {step.description ? (
                    <div className="text-neutral-300 text-xs sm:text-sm leading-relaxed mb-4 whitespace-pre-line">
                      {step.description}
                    </div>
                  ) : (
                    <div className="mb-4" />
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-700/40 flex items-center justify-between text-xs text-neutral-400">
                  <span className="font-semibold text-[#961500]">
                    {step.badge}
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-neutral-500 group-hover:text-[#961500]" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <a
            href="https://tally.so/r/wQQ0zg"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-8 py-4 text-base font-bold text-white bg-[#961500] hover:bg-[#731000] rounded-full transition-all shadow-lg hover:shadow-red-900/30"
          >
            Reserva tu Cita a Ciegas
          </a>
        </div>
      </div>
    </section>
  );
}
