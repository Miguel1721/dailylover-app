"use client";

import React from "react";
import Image from "next/image";
import { Calendar, MapPin, Clock, ArrowUpRight, Check } from "lucide-react";
import { DailyLoverEvent } from "@/types";

interface EventCardProps {
  event: DailyLoverEvent;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden border border-neutral-200/80 shadow-md hover:shadow-xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1">
      {/* Image Header */}
      <div className="relative h-56 w-full overflow-hidden bg-neutral-100">
        <Image
          src={event.image}
          alt={event.title}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />

        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Badge */}
        {event.badge && (
          <div className="absolute top-3 left-3 bg-[#961500] text-white text-[11px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            {event.badge}
          </div>
        )}

        {/* City Tag */}
        <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
          <MapPin className="w-3 h-3 text-[#961500]" />
          <span>{event.cityName}</span>
        </div>

        {/* Date on image bottom */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
            <Calendar className="w-3.5 h-3.5 text-red-400" />
            <span>{event.date}</span>
          </div>
          {event.price && (
            <div className="bg-[#961500] px-2.5 py-1 rounded-lg font-bold">
              {event.price}
            </div>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Title & Subtitle */}
          <h3 className="font-heading text-xl font-bold text-neutral-900 group-hover:text-[#961500] transition-colors leading-snug">
            {event.title}
          </h3>
          {event.subtitle && (
            <p className="text-xs font-semibold text-[#961500] mt-0.5">
              {event.subtitle}
            </p>
          )}

          {/* Time & Location Details */}
          <div className="mt-3 space-y-1.5 text-xs text-neutral-500">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-neutral-400" />
              <span>{event.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-neutral-400" />
              <span>{event.location}</span>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm text-neutral-600 mt-3 line-clamp-2 leading-relaxed">
            {event.description}
          </p>

          {/* Highlights */}
          {event.highlights && event.highlights.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-100 space-y-1.5">
              {event.highlights.map((item, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-xs text-neutral-700">
                  <Check className="w-3.5 h-3.5 text-[#961500] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA Button */}
        <div className="pt-2">
          <a
            href={event.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-[#961500] hover:bg-[#731000] rounded-xl transition-all shadow-sm hover:shadow"
          >
            <span>{event.ctaLabel}</span>
            <ArrowUpRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
