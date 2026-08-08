"use client";

import React from "react";
import Hero from "./Hero";
import EventsGrid from "./EventsGrid";
import HowItWorks from "./HowItWorks";
import FounderSection from "./FounderSection";
import FAQAccordion from "./FAQAccordion";
import Newsletter from "./Newsletter";
import citiesData from "@/data/cities.json";
import { CityConfig } from "@/types";

interface CityLandingProps {
  cityId: 'colombia' | 'miami' | 'madrid' | 'cdmx';
}

export default function CityLanding({ cityId }: CityLandingProps) {
  const city =
    (citiesData as CityConfig[]).find((c) => c.id === cityId) ||
    (citiesData[0] as CityConfig);

  return (
    <>
      <Hero city={city} />
      <EventsGrid
        initialCity={cityId === "colombia" ? "all" : cityId}
        title={`Eventos & Experiencias en ${city.name}`}
        subtitle={`Sumate a los próximos encuentros sociales curados en ${city.name}`}
      />
      <Newsletter />
    </>
  );
}
