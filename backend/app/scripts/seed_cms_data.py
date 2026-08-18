import asyncio
import json
import os
from sqlalchemy import text
from app.database import AsyncSessionLocal

CITIES_DATA = [
  {
    "id": "colombia",
    "name": "Colombia",
    "tagline": "Bogotá & Medellín",
    "hero_badge": "BOGOTÁ Y MEDELLÍN",
    "hero_title": "Nosotras hacemos el match. Nos encargamos del plan. Tú solo llegas",
    "hero_subtitle": "Eventos curados, catas de vino, toros de polo y citas a ciegas diseñadas para solteros que buscan relaciones reales.",
    "hero_image_url": "/images/hero_colombia.png",
    "cta_text": "Únete al Club",
    "cta_url": "/blind-date",
    "currency": "COP",
    "whatsapp_number": "573000000000",
    "whatsapp_message": "Hola! Quiero información sobre los eventos de Daily Lover en Colombia."
  },
  {
    "id": "miami",
    "name": "Miami",
    "tagline": "Florida, EE. UU.",
    "hero_badge": "MIAMI, FLORIDA",
    "hero_title": "The Most Exclusive Social Club for Singles in Miami",
    "hero_subtitle": "Curated experiences, rooftop mixers, and blind dates for high-intent singles looking for authentic connections.",
    "hero_image_url": "/images/event_rooftop.jpeg",
    "cta_text": "Apply for Membership",
    "cta_url": "https://tally.so/r/wQQ0zg",
    "currency": "USD",
    "whatsapp_number": "13050000000",
    "whatsapp_message": "Hi! I'm interested in Daily Lover Miami events."
  },
  {
    "id": "madrid",
    "name": "Madrid",
    "tagline": "España",
    "hero_badge": "MADRID, ESPAÑA",
    "hero_title": "El club social de solteros en el corazón de Madrid",
    "hero_subtitle": "Cenas exclusivas, catas maridaje y encuentros diseñados para profesionales que prefieren la química real sobre las pantallas.",
    "hero_image_url": "/images/hero_madrid.jpeg",
    "cta_text": "Reserva tu Experiencia",
    "cta_url": "https://tally.so/r/wQQ0zg",
    "currency": "EUR",
    "whatsapp_number": "34600000000",
    "whatsapp_message": "Hola! Quiero sumarme a la comunidad de Daily Lover Madrid."
  },
  {
    "id": "cdmx",
    "name": "CDMX",
    "tagline": "Ciudad de México",
    "hero_badge": "CIUDAD DE MÉXICO",
    "hero_title": "Citas a Ciegas y Experiencias Curadas en CDMX",
    "hero_subtitle": "El espacio donde la química sucede cara a cara. Eventos sociales y match manual curado.",
    "hero_image_url": "/images/event_cdmx.jpg",
    "cta_text": "Aplica Hoy",
    "cta_url": "https://tally.so/r/wQQ0zg",
    "currency": "MXN",
    "whatsapp_number": "525500000000",
    "whatsapp_message": "Hola! Me interesa la experiencia Blind Date CDMX."
  }
]

EVENTS_DATA = [
  {
    "title": "Polo Classics 2026",
    "subtitle": "Edición Especial",
    "city_id": "colombia",
    "venue": "Club de Polo de Bogotá",
    "image_url": "/images/event_polo.jpeg",
    "cta_label": "Comprar en Ticketmaster",
    "cta_url": "https://www.ticketmaster.co/event/polo-classics-2026-10-off",
    "provider": "ticketmaster",
    "status": "published",
    "description": "Evento de Polo y encuentro social curado. Daily Lover va a tener un Singles Tent."
  },
  {
    "title": "Dance Marathon Presents: A Paso by Sinego",
    "subtitle": "Encuentro Musical & Fiesta Social",
    "city_id": "colombia",
    "event_date": "2026-08-29",
    "event_time": "8:00 PM",
    "venue": "Venue Bogotá",
    "image_url": "/images/event_wine.jpeg",
    "cta_label": "Reservar en Fourvenues",
    "cta_url": "https://site.fourvenues.com/es/dailylover/events/dance-marathon-presents-a-paso-by-sinego-29-08-2026-LYRY",
    "provider": "fourvenues",
    "status": "published",
    "description": "Fiesta y encuentro social con show en vivo de Sinego. Báilate media maratón."
  },
  {
    "title": "Dance Marathon 14 Feb",
    "subtitle": "Edición Especial Febrero",
    "city_id": "colombia",
    "event_date": "2026-02-14",
    "event_time": "8:00 PM",
    "venue": "Venue Bogotá",
    "image_url": "/images/event_wine.jpeg",
    "cta_label": "Reservar en Fourvenues (14 Feb)",
    "cta_url": "https://web.fourvenues.com/es/maria-salinas1/events/dance-marathon-14-02-2026-A6QD",
    "provider": "fourvenues",
    "status": "published",
    "description": "Encuentro social y baile en Bogotá."
  },
  {
    "title": "El Tardeo Bogotano Color Party",
    "subtitle": "Experiencia Tardeo",
    "city_id": "colombia",
    "event_date": "2026-03-21",
    "event_time": "4:00 PM",
    "venue": "Bogotá",
    "image_url": "/images/hero_colombia.png",
    "cta_label": "Reservar en Fourvenues (Color Party)",
    "cta_url": "https://web.fourvenues.com/es/maria-paula-salinas/events/el-tardeo-bogotano-color-party-21-03-2026-UZQA",
    "provider": "fourvenues",
    "status": "published",
    "description": "Tardeo social y fiesta de color en Bogotá."
  },
  {
    "title": "Blind Date Match — Plan 1",
    "subtitle": "Stripe Checkout Directo",
    "city_id": "colombia",
    "event_time": "Horario Flexible",
    "venue": "Restaurante Aliado Bogotá / Medellín",
    "image_url": "/images/event_blind_date.jpeg",
    "cta_label": "Pagar en Stripe (Link 1)",
    "cta_url": "https://buy.stripe.com/3cI9ASbuM4Vd6vwbkA8EM0K",
    "provider": "stripe",
    "status": "published",
    "description": "Reserva de match directo vía checkout seguro de Stripe."
  },
  {
    "title": "Blind Date Match — Plan 2",
    "subtitle": "Stripe Checkout Directo",
    "city_id": "colombia",
    "event_time": "Horario Flexible",
    "venue": "Restaurante Aliado Bogotá / Medellín",
    "image_url": "/images/event_blind_date.jpeg",
    "cta_label": "Pagar en Stripe (Link 2)",
    "cta_url": "https://buy.stripe.com/5kQeVcaqIdrJ1bcbkA8EM0I",
    "provider": "stripe",
    "status": "published",
    "description": "Reserva de match directo vía checkout seguro de Stripe."
  },
  {
    "title": "Blind Date Match Miami",
    "subtitle": "Stripe Checkout Miami",
    "city_id": "miami",
    "event_time": "Personalized Time",
    "venue": "Miami Partner Venue",
    "image_url": "/images/event_rooftop.jpeg",
    "cta_label": "Pay with Stripe (Miami USD)",
    "cta_url": "https://buy.stripe.com/00w5kCbuMevN1bcdsI8EM0N",
    "provider": "stripe",
    "status": "published",
    "description": "Direct Stripe checkout for Miami Blind Date experience."
  }
]

DEFAULT_FORM_FIELDS = [
  {
    "field_key": "nombre_completo",
    "label": "Nombre Completo",
    "field_type": "text",
    "is_required": True,
    "sort_order": 1
  },
  {
    "field_key": "edad",
    "label": "Edad",
    "field_type": "number",
    "is_required": True,
    "sort_order": 2
  },
  {
    "field_key": "email",
    "label": "Correo Electrónico de Contacto",
    "field_type": "text",
    "is_required": True,
    "sort_order": 3
  },
  {
    "field_key": "telefono",
    "label": "Teléfono / WhatsApp",
    "field_type": "text",
    "is_required": True,
    "sort_order": 4
  },
  {
    "field_key": "ciudad_residencia",
    "label": "Ciudad de Residencia",
    "field_type": "select",
    "options": ["Bogotá", "Medellín", "Miami", "Madrid", "Ciudad de México", "Otra"],
    "is_required": True,
    "sort_order": 5
  },
  {
    "field_key": "que_buscas",
    "label": "¿Qué buscas en una pareja o cita?",
    "field_type": "textarea",
    "is_required": True,
    "sort_order": 6
  },
  {
    "field_key": "foto_personal",
    "label": "Foto Personal (Opcional)",
    "field_type": "photo_upload",
    "is_required": False,
    "sort_order": 7
  }
]

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Seeding cities...")
        for city in CITIES_DATA:
            await db.execute(text("""
                INSERT INTO cities (id, name, tagline, hero_badge, hero_title, hero_subtitle, hero_image_url, cta_text, cta_url, currency, whatsapp_number, whatsapp_message)
                VALUES (:id, :name, :tagline, :hero_badge, :hero_title, :hero_subtitle, :hero_image_url, :cta_text, :cta_url, :currency, :whatsapp_number, :whatsapp_message)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    tagline = EXCLUDED.tagline,
                    hero_badge = EXCLUDED.hero_badge,
                    hero_title = EXCLUDED.hero_title,
                    hero_subtitle = EXCLUDED.hero_subtitle,
                    hero_image_url = EXCLUDED.hero_image_url,
                    cta_text = EXCLUDED.cta_text,
                    cta_url = EXCLUDED.cta_url,
                    currency = EXCLUDED.currency,
                    whatsapp_number = EXCLUDED.whatsapp_number,
                    whatsapp_message = EXCLUDED.whatsapp_message;
            """), city)

        print("Seeding events...")
        await db.execute(text("ALTER TABLE events ALTER COLUMN name DROP NOT NULL;"))
        for idx, evt in enumerate(EVENTS_DATA):
            evt["sort_order"] = idx + 1
            evt["name"] = evt["title"]
            await db.execute(text("""
                INSERT INTO events (title, name, subtitle, city_id, venue, image_url, cta_label, cta_url, provider, status, description, sort_order)
                VALUES (:title, :name, :subtitle, :city_id, :venue, :image_url, :cta_label, :cta_url, :provider, :status, :description, :sort_order);
            """), evt)

        print("Seeding form fields...")
        for fld in DEFAULT_FORM_FIELDS:
            options_json = json.dumps(fld.get("options")) if fld.get("options") else None
            await db.execute(text("""
                INSERT INTO blind_date_form_fields (field_key, label, field_type, options, is_required, sort_order)
                VALUES (:field_key, :label, :field_type, CAST(:options_json AS jsonb), :is_required, :sort_order)
                ON CONFLICT (field_key) DO NOTHING;
            """), {
                "field_key": fld["field_key"],
                "label": fld["label"],
                "field_type": fld["field_type"],
                "options_json": options_json,
                "is_required": fld["is_required"],
                "sort_order": fld["sort_order"]
            })

        await db.commit()
        print("CMS Seeding Completed Successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
