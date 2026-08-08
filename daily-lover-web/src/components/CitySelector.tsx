"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, MapPin, Check } from "lucide-react";
import citiesData from "@/data/cities.json";

interface CitySelectorProps {
  currentCityId?: string;
  variant?: "header" | "hero";
}

export default function CitySelector({
  currentCityId = "colombia",
  variant = "header",
}: CitySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const currentCity =
    citiesData.find((c) => c.id === currentCityId) || citiesData[0];

  const getCityPath = (id: string) => {
    switch (id) {
      case "miami":
        return "/miami";
      case "madrid":
        return "/madrid";
      case "cdmx":
        return "/cdmx";
      case "colombia":
      default:
        return "/";
    }
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs md:text-sm font-medium transition-all ${
          variant === "header"
            ? "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 border border-neutral-200"
            : "bg-white/90 text-neutral-900 hover:bg-white shadow-md border border-neutral-200/80 backdrop-blur-sm"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <MapPin className="w-3.5 h-3.5 text-[#961500]" />
        <span>{currentCity.name}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-neutral-500 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-xl border border-neutral-100 py-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-neutral-400 uppercase">
            Selecciona tu Ciudad
          </div>
          {citiesData.map((city) => {
            const isSelected = city.id === currentCityId;
            return (
              <Link
                key={city.id}
                href={getCityPath(city.id)}
                className={`flex items-center justify-between px-3 py-2 text-xs md:text-sm transition-colors ${
                  isSelected
                    ? "bg-neutral-50 text-[#961500] font-semibold"
                    : "text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900"
                }`}
                onClick={() => setIsOpen(false)}
              >
                <div className="flex flex-col">
                  <span>{city.name}</span>
                  <span className="text-[10px] text-neutral-400 font-normal">
                    {city.tagline}
                  </span>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 text-[#961500]" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
