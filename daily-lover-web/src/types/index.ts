export interface DailyLoverEvent {
  id: string;
  title: string;
  subtitle?: string;
  city: 'colombia' | 'miami' | 'madrid' | 'cdmx';
  cityName: string;
  date: string;
  isoDate?: string;
  time: string;
  location: string;
  address?: string;
  price?: string;
  image: string;
  badge?: string;
  description: string;
  highlights?: string[];
  ctaLabel: string;
  ctaUrl: string;
  status: 'available' | 'sold_out' | 'few_spots';
}

export interface CityConfig {
  id: 'colombia' | 'miami' | 'madrid' | 'cdmx';
  name: string;
  tagline: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  ctaText: string;
  ctaUrl: string;
  currency: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category?: string;
}

export interface TestimonialItem {
  id: string;
  quote: string;
  author: string;
  detail: string;
  city: string;
  avatar?: string;
}
