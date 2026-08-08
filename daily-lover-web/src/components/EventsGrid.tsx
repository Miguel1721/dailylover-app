"use client";

import React, { useState } from "react";
import EventCard from "./EventCard";
import eventsData from "@/data/events.json";
import { DailyLoverEvent } from "@/types";
import { Calendar, Filter } from "lucide-react";

interface EventsGridProps {
  initialCity?: string;
  title?: string;
  subtitle?: string;
}

export default function EventsGrid({
  initialCity = "all",
  title = "Próximos Eventos & Experiencias",
  subtitle = "Encuentros diseñados para fomentar conexiones auténticas en un ambiente exclusivo.",
}: EventsGridProps) {
  const [selectedCity, setSelectedCity] = useState<string>(initialCity);

  const events = eventsData as DailyLoverEvent[];

  const filteredEvents =
    selectedCity === "all"
      ? events
      : events.filter((e) => e.city === selectedCity);

  const cityFilters = [
    { id: "all", label: "Todas las Ciudades" },
    { id: "colombia", label: "Colombia" },
    { id: "miami", label: "Miami" },
    { id: "madrid", label: "Madrid" },
  ];

  return (
    <section id="eventos" className="py-20 bg-neutral-50 border-t border-neutral-200/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-12">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#961500] bg-[#961500]/10 px-3.5 py-1.5 rounded-full">
            <Calendar className="w-3.5 h-3.5" />
            <span>AGENDA EXCLUSIVA</span>
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-extrabold text-neutral-900 tracking-tight">
            {title}
          </h2>
          <p className="text-neutral-600 text-base sm:text-lg">
            {subtitle}
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
          {cityFilters.map((filter) => {
            const isActive = selectedCity === filter.id;
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedCity(filter.id)}
                className={`px-5 py-2.5 rounded-full text-xs md:text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-[#961500] text-white shadow-md"
                    : "bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-200"
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-2xl border border-neutral-200 p-8 max-w-md mx-auto">
            <p className="text-neutral-600 font-medium mb-4">
              Pronto anunciaremos nuevas fechas en esta ciudad.
            </p>
            <a
              href="https://tally.so/r/wQQ0zg"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center px-6 py-3 text-xs md:text-sm font-bold text-white bg-[#961500] rounded-full"
            >
              Inscribirme a Lista de Espera
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
