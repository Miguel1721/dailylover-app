export const mockEvent = {
  name: "Noche Daily Lover — Rooftop Bogotá",
  date: "Sábado 12 de Julio, 9:00 PM",
  venue: "Andrés DC, Zona T",
  status: "confirmada"
};

export const mockCheckin = {
  time: "9:47 PM",
  table: 7,
  explanation: "Te sentamos con personas que, como tú, valoran las conversaciones profundas más que el ruido de la pista. Todos en tu mesa comparten un perfil similar de apertura y estilo de conexión.",
  mission: "Hay alguien en tu mesa que también ama el cine de los 80. ¡Pregúntale cuál es su película favorita!"
};

export const mockPoints = {
  total: 2450,
  nextReward: 3000,
  level: "Conector",
  nextLevel: "Embajador Daily Lover",
  rate: "Cada $1.000 en consumo = 10 puntos",
  recentPurchases: [
    { item: "Mojito x2", amount: 45000, points: 450, time: "9:52 PM" },
    { item: "Whisky", amount: 38000, points: 380, time: "10:15 PM" },
    { item: "Cover charge", amount: 60000, points: 600, time: "9:47 PM" }
  ]
};

export const mockTableMates = [
  { name: "Camila", age: 27, note: "Le encanta el jazz y las conversaciones sin prisa" },
  { name: "Andrés", age: 29, note: "Curioso, siempre pregunta por el por qué de todo" },
  { name: "Valentina", age: 26, note: "Prefiere planes pequeños antes que fiestas masivas" },
  { name: "Sebastián", age: 28, note: "Buen oyente, conecta ideas de la conversación" },
  { name: "Isabella", age: 25, note: "Le gusta profundizar más que hablar de trivialidades" }
];

export const mockUpcomingEvents = [
  {
    name: "Cata de Vinos & Jazz Acústico",
    date: "Sábado 19 de Julio, 8:00 PM",
    venue: "La Comedia Bar, Quinta Camacho",
    recommendation: "Recomendado para ti (95% afinidad)",
    reason: "Coincide con tu preferencia de ambientes con baja estimulación acústica e interacciones individuales."
  },
  {
    name: "Speed Dating & Arte Contemporáneo",
    date: "Jueves 24 de Julio, 7:30 PM",
    venue: "Galería N20, Chapinero",
    recommendation: "Recomendado para ti (88% afinidad)",
    reason: "Recomendado por tu interés en expresión artística y perfiles orientados a la apertura y curiosidad intelectual."
  }
];

export const mockProfile = {
  name: "Sofía Ruiz",
  age: 26,
  apego: "Seguro",
  stats: {
    eventsAttended: 3,
    matchesMade: 5
  },
  evolutionStory: [
    { period: "Evento 1: Introducción", text: "Iniciaste explorando el formato Speed Dating con cierta reserva. Tu motivación principal fue la curiosidad inicial." },
    { period: "Evento 2: Transición", text: "Participaste en la mesa de conversación. Tus interacciones mostraron mayor amabilidad y un interés genuino en temas existenciales." },
    { period: "Hoy: Conexión Profunda", text: "Tu perfil refleja que valoras las conversaciones lentas y profundas sobre planes ruidosos. Te emparejamos preferencialmente con perfiles seguros y reflexivos." }
  ]
};

export const mockChat = [
  { sender: "Andrés", text: "¡Hola Sofía! Qué buen rato pasamos en la mesa 7.", time: "11:20 PM" },
  { sender: "Tú", text: "¡Hola Andrés! Sí, totalmente. Me quedé pensando en la película de cine de los 80 que me recomendaste.", time: "11:22 PM" },
  { sender: "Andrés", text: "Jaja ¡es un clásico! Debes verla. ¿Te gustaría que tomemos un café esta semana y seguimos charlando?", time: "11:24 PM" }
];
