const packages = [
  {
    id: "ninguno",
    category: "Servicios",
    name: "NINGUNO",
    price: 0,
    items: []
  },
  {
    id: "extras-erp",
    category: "Servicios",
    name: "EXTRAS - ERP",
    price: 0,
    pricedItems: true,
    items: [
      ["", "EXTRAS", undefined, [], { type: "section" }],
      ["1", "Audio para cotel", 750],
      ["1", "Audio para ceremonia", 1250],
      ["12", "Luces móviles beam en Truss forrado", 6000],
      ["12", "Luces pares led matriz", 1800],
      ["2", "Horas extras de DJ", 4000],
      ["1", "Presentación Saxofonic Solo show (1 hora)", 3000],
      ["", "", undefined, [], { type: "total" }]
    ]
  },
  {
    id: "entretenimiento-local",
    category: "Servicios de entretenimiento",
    name: "SERVICIOS DE ENTRETENIMIENTO LOCAL",
    price: 0,
    pricedItems: true,
    hideTotal: true,
    extrasType: "regular",
    items: [
      ["1", "Batucada NEON (4 percusiones) (1 hora)", 3800],
      ["1", "Personaje con Rótulo LED", 900],
      ["2", "Botellas LED personalizadas con pirotecnia fría", 650],
      ["2", "Personajes cabezones (1 hora)", 2500],
      ["1", "Pistola LED CO2", 2000],
      ["1", "Pianista con Piano de cola Blanco (1 hora)", 3850],
      ["1", "Presentación Violín Eléctrico (1 hora)", 2750],
      ["1", "Presentación Saxofonic solo show (1 hora)", 3000],
      ["1", 'Bus de shots "Chiken Buss"', 4000]
    ]
  },
  {
    id: "entretenimiento-interior",
    category: "Servicios de entretenimiento",
    name: "SERVICIOS DE ENTRETENIMIENTO INTERIOR",
    price: 0,
    pricedItems: true,
    hideTotal: true,
    extrasType: "interior",
    items: [
      ["1", "Batucada NEON (4 percusiones) (1 hora)", 5000],
      ["1", "Personaje con Rótulo LED", 1350],
      ["2", "Botellas LED personalizadas con pirotecnia fría", 800],
      ["2", "Personajes cabezones (1 hora)", 3000],
      ["1", "Pistola LED CO2", 2250],
      ["1", "Pianista con Piano de cola Blanco (1 hora)", 6250],
      ["1", "Presentación Violín Eléctrico (1 hora)", 5000],
      ["1", 'Bus de shots "Chiken Buss"', 5000]
    ]
  },
  {
    id: "dj-completo",
    category: "Completos",
    name: "DJ COMPLETO",
    price: 15000,
    items: [
      ["1", "Presentación de Dj (5 horas)"],
      ["1", "Dj Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["4", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["1", "Monitores de piso Turbosound"],
      ["1", "Consola digital Beringer X18"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces PAR 64"],
      ["1", "Controlador DMX"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "novaloops-completo",
    category: "Completos",
    name: "NOVALOOPS COMPLETO",
    price: 21000,
    items: [
      ["1", "Presentación grupo Novaloops (1.5 horas)"],
      ["1", "Presentación de DJ (3.5 horas)"],
      ["1", "Dj booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "rumbaye-completo",
    category: "Completos",
    name: "RUMBAYE COMPLETO",
    price: 24000,
    items: [
      ["1", "Presentación grupo Rumbayé (1.5 horas)"],
      ["1", "Presentación de DJ (3.5)"],
      ["1", "DJ Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["2", "Luces blinders"],
      ["2", "Luces washas"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "saxofonic-completo",
    category: "Completos",
    name: "SAXOFONIC COMPLETO",
    price: 17500,
    items: [
      ["1", "Presentación de Saxofonic (1 hora)"],
      ["1", "Presentación de Dj (5 horas)"],
      ["1", "Dj Booth"],
      ["1", "Microfonía y amplificación para grupo musical"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["4", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["1", "Monitores de piso Turbosound"],
      ["1", "Consola digital Beringer X18"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["4", "Luces móviles BEAM"],
      ["6", "Luces PAR 64"],
      ["1", "Controlador DMX"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "sunday-funday-completo",
    category: "Completos",
    name: "SUNDAY FUNDAY COMPLETO",
    price: 33500,
    items: [
      ["1", "Presentación grupo Sunday Funday (1.5 hora)"],
      ["1", "Presentación DJ (3.5 horas)"],
      ["1", "DJ Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["2", "Luces blinders"],
      ["2", "Luces washas"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. De sonido y Staff técnico"]
    ]
  },
  {
    id: "dj-privado",
    category: "Privados",
    name: "DJ PRIVADO",
    price: 15000,
    items: [
      ["1", "Presentación de DJ (5 horas)"],
      ["1", "Equipo de audio profesional"],
      ["1", "Dj booth"],
      ["1", "Equipo de iluminación básica"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "novaloops-privado",
    category: "Privados",
    name: "NOVALOOPS PRIVADO",
    price: 12500,
    items: [
      ["1", "Presentación Grupo Novaloops (1.5 hora)"],
      ["1", "Presentación de DJ (3.5 horas)"],
      ["1", "Equipo de audio profesional"],
      ["1", "Iluminación básica"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "rumbaye-privado",
    category: "Privados",
    name: "RUMBAYE PRIVADO",
    price: 15000,
    items: [
      ["1", "Presentación Rumbayé (1.5 horas)"],
      ["1", "Presentación de DJ (3.5 horas)"],
      ["1", "Equipo de audio profesional"],
      ["1", "Equipo de iluminación básica"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "saxofonic-privado",
    category: "Privados",
    name: "SAXOFONIC PRIVADO",
    price: 8500,
    items: [
      ["1", "Presentación de Saxofonic (1 hora)"],
      ["1", "Presentación de DJ (4 horas)"],
      ["1", "Equipo de audio básica"],
      ["1", "Dj booth"],
      ["1", "Equipo de iluminación básica"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "sunday-funday-privado",
    category: "Privados",
    name: "SUNDAY FUNDAY PRIVADO",
    price: 17500,
    items: [
      ["1", "Presentación Sunday Funday (1.5 hora)"],
      ["1", "Presentación de DJ (3.5 horas)"],
      ["1", "Equipo de audio profesional"],
      ["1", "Iluminación básica"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "dj-solo-show",
    category: "Solo Show Privado",
    name: "DJ SOLO SHOW",
    price: 3500,
    items: [
      ["1", "Presentación de DJ (5 horas)"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "novaloops-solo-show",
    category: "Solo Show Privado",
    name: "NOVALOOPS SOLO SHOW",
    price: 10000,
    items: [
      ["1", "Presentación Novaloops (1.5 horas)"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "rumbaye-solo-show",
    category: "Solo Show Privado",
    name: "RUMBAYE SOLO SHOW",
    price: 12000,
    items: [
      ["1", "Presentación Rumbayé (1.5 horas)"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "saxofonic-solo-show",
    category: "Solo Show Privado",
    name: "SAXOFONIC SOLO SHOW",
    price: 2850,
    items: [
      ["1", "Presentación Saxofonic solo show (1 hora)"]
    ]
  },
  {
    id: "sunday-funday-solo-show",
    category: "Solo Show Privado",
    name: "SUNDAY FUNDAY SOLO SHOW",
    price: 14000,
    items: [
      ["1", "Presentación Sunday Funday (1.5horas)"],
      ["1", "Microfonía e instrumento"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "dj-completo-interior",
    category: "Interior",
    name: "DJ COMPLETO INTERIOR",
    price: 16000,
    items: [
      ["1", "Presentación de Dj (5 horas)"],
      ["1", "Dj Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["4", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["1", "Monitores de piso Turbosound"],
      ["1", "Consola digital Beringer X18"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces PAR 64"],
      ["1", "Controlador DMX"],
      ["1", "Sistema de monitoreo interno"],
      ["1", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "novaloops-completo-interior",
    category: "Interior",
    name: "NOVALOOPS INTERIOR",
    price: 23000,
    items: [
      ["1", "Presentación grupo Novaloops (1.5 horas)"],
      ["1", "Presentación de DJ (3.5 horas)"],
      ["1", "Dj booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "rumbaye-completo-interior",
    category: "Interior",
    name: "RUMBAYE INTERIOR",
    price: 26000,
    items: [
      ["1", "Presentación grupo Rumbayé (1.5 horas)"],
      ["1", "Presentación de DJ (3.5)"],
      ["1", "DJ Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["2", "Luces blinders"],
      ["2", "Luces washas"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. de sonido y Staff técnico"]
    ]
  },
  {
    id: "sunday-funday-completo-interior",
    category: "Interior",
    name: "SUNDAY FUNDAY INTERIOR",
    price: 37000,
    items: [
      ["1", "Presentación grupo Sunday Funday (1.5 hora)"],
      ["1", "Presentación DJ (3.5 horas)"],
      ["1", "DJ Booth"],
      ["2", "Bajos (QSC, JBL Turbosound o similar)"],
      ["2", "Sistemas de amplificación (QSC, JBL, Turbosound o similar)"],
      ["2", "Monitores de piso (Turbosound, DAS o similar)"],
      ["1", "Consola digital Beringer X32"],
      ["4", "Estructuras de iluminación de 2mts forradas"],
      ["6", "Luces móviles BEAM"],
      ["6", "Luces pares LED"],
      ["2", "Luces blinders"],
      ["2", "Luces washas"],
      ["1", "Controlador DMX"],
      ["1", "Microfonía e instrumentos"],
      ["1", "Sistema de monitoreo interno del grupo"],
      ["2", "Ing. De sonido y Staff técnico"]
    ]
  }
];

const extras = {
  regular: [
    ["batucada-neon", "1", "Batucada NEON (1 hora)", 3800, { exclusiveGroup: "batucada", percussionCount: "4" }],
    ["batucada", "1", "Batucada (1 hora)", 3800, { exclusiveGroup: "batucada", percussionCount: "4" }],
    ["personaje-rotulo-led", "1", "Personaje con Rótulo LED", 900],
    ["botellas-led", "1", "Botellas LED personalizadas con pirotecnia fría", 325, { priceMode: "unit" }],
    ["personajes-cabezones", "2", "Personajes cabezones (1 hora)", 2500],
    ["pistola-led-co2", "1", "Pistola LED CO2", 2000],
    ["pianista-piano-cola", "1", "Pianista con Piano de cola Blanco (1 hora)", 3850],
    ["violin-electrico", "1", "Presentación Violín Eléctrico (1 hora)", 2750],
    ["saxofonic-solo-extra", "1", "Presentación Saxofonic solo show (1 hora)", 2850],
    ["bus-shots", "1", 'Bus de shots "Chiken Buss"', 4000],
    ["par-led-matiz", "1", "Par LED para Matiz", 150, { priceMode: "unit" }],
    ["montaje-dia-previo", "1", "Montaje 1 día antes del evento", 1500, { priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["desmontaje-dia-posterior", "1", "Desmontaje 1 día después del evento", 1500, { priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-1", "1", "Toldo 1", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-2", "1", "Toldo 2", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-3", "1", "Toldo 3", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["viaticos", "1", "Viáticos", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["generador-electrico", "1", "Generador eléctrico", 0, { generator: true }],
    ["hora-extra-generador-electrico", "1", "Hora Extra Generador Electrico", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["animador", "1", "Animador", 0, { priceMode: "unit", quantityLabel: "Horas", priceLabel: "Monto", unitSuffix: "por hora" }],
    ["pista-baile-led", "1", "Pista de Baile Led", 0, { hasDimensions: true, dimensions: "6x6", priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["carrito-shots", "1", "Carrito de Shots", 0, { priceMode: "unit", quantityLabel: "Cantidad de Shots", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["maquina-confeti", "1", "Máquina de Confeti", 0, { priceMode: "unit", quantityLabel: "Cantidad de Detonaciones", priceLabel: "Monto", unitSuffix: "c/u", confettiNote: true }],
    ["servicio-grabacion-video", "1", "Servicio de Grabación de Video", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["pirotecnia-fria", "1", "Pirotecnia Fría", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    [
      "hora-extra",
      "1",
      "Hora Extra DJ",
      0,
      { priceMode: "unit", quantityLabel: "Horas", priceLabel: "Monto por hora", unitSuffix: "por hora" }
    ],
    [
      "celular-playlist",
      "1",
      "Celular con Playlist",
      0,
      {
        priceMode: "unit",
        quantityLabel: "Horas",
        priceLabel: "Monto por hora",
        unitSuffix: "por hora",
        allowComplimentary: true
      }
    ],
    ["pantalla-led", "1", "Pantalla LED", 0, { dimensions: "2 X 3 metros" }],
    ["pista-baile", "1", "Pista de Baile", 0, { dimensions: "6 X 6 metros" }],
    ["decoracion-pista-baile", "1", "Decoración para Pista de Baile", 0],
    ["tarima", "1", "Tarima", 0, { dimensions: "6 X 6 metros" }]
  ],
  interior: [
    ["batucada-neon-interior", "1", "Batucada NEON (1 hora)", 5000, { exclusiveGroup: "batucada", percussionCount: "4" }],
    ["batucada-interior", "1", "Batucada (1 hora)", 5000, { exclusiveGroup: "batucada", percussionCount: "4" }],
    ["personaje-rotulo-led-interior", "1", "Personaje con Rótulo LED", 1350],
    ["botellas-led-interior", "1", "Botellas LED personalizadas con pirotecnia fría", 325, { priceMode: "unit" }],
    ["personajes-cabezones-interior", "2", "Personajes cabezones (1 hora)", 3000],
    ["pistola-led-co2-interior", "1", "Pistola LED CO2", 2250],
    ["pianista-piano-cola-interior", "1", "Pianista con Piano de cola Blanco (1 hora)", 6250],
    ["violin-electrico-interior", "1", "Presentación Violín Eléctrico (1 hora)", 5000],
    ["bus-shots-interior", "1", 'Bus de shots "Chiken Buss"', 5000],
    ["viaticos-interior", "1", "Viáticos", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["par-led-matiz-interior", "1", "Par LED para Matiz", 150, { priceMode: "unit" }],
    ["montaje-dia-previo-interior", "1", "Montaje 1 día antes del evento", 1500, { priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["desmontaje-dia-posterior-interior", "1", "Desmontaje 1 día después del evento", 1500, { priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-1-interior", "1", "Toldo 1", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-2-interior", "1", "Toldo 2", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["toldo-3-interior", "1", "Toldo 3", 0, { hasDimensions: true, dimensions: "", priceMode: "unit", priceLabel: "Precio", unitSuffix: "c/u" }],
    ["generador-electrico-interior", "1", "Generador eléctrico", 0, { generator: true }],
    ["hora-extra-generador-electrico-interior", "1", "Hora Extra Generador Electrico", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["animador-interior", "1", "Animador", 0, { priceMode: "unit", quantityLabel: "Horas", priceLabel: "Monto", unitSuffix: "por hora" }],
    ["pista-baile-led-interior", "1", "Pista de Baile Led", 0, { hasDimensions: true, dimensions: "6x6", priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["carrito-shots-interior", "1", "Carrito de Shots", 0, { priceMode: "unit", quantityLabel: "Cantidad de Shots", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["maquina-confeti-interior", "1", "Máquina de Confeti", 0, { priceMode: "unit", quantityLabel: "Cantidad de Detonaciones", priceLabel: "Monto", unitSuffix: "c/u", confettiNote: true }],
    ["servicio-grabacion-video-interior", "1", "Servicio de Grabación de Video", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    ["pirotecnia-fria-interior", "1", "Pirotecnia Fría", 0, { priceMode: "unit", quantityLabel: "Cantidad", priceLabel: "Monto", unitSuffix: "c/u" }],
    [
      "hora-extra-interior",
      "1",
      "Hora Extra DJ",
      0,
      { priceMode: "unit", quantityLabel: "Horas", priceLabel: "Monto por hora", unitSuffix: "por hora" }
    ],
    [
      "celular-playlist-interior",
      "1",
      "Celular con Playlist",
      0,
      {
        priceMode: "unit",
        quantityLabel: "Horas",
        priceLabel: "Monto por hora",
        unitSuffix: "por hora",
        allowComplimentary: true
      }
    ],
    ["pantalla-led-interior", "1", "Pantalla LED", 0, { dimensions: "2 X 3 metros" }],
    ["pista-baile-interior", "1", "Pista de Baile", 0, { dimensions: "6 X 6 metros" }],
    ["decoracion-pista-baile-interior", "1", "Decoración para Pista de Baile", 0],
    ["tarima-interior", "1", "Tarima", 0, { dimensions: "6 X 6 metros" }]
  ]
};

const elements = {
  siteApp: document.querySelector("#siteApp"),
  loginView: document.querySelector("#loginView"),
  loginForm: document.querySelector("#loginForm"),
  loginUser: document.querySelector("#loginUser"),
  loginPassword: document.querySelector("#loginPassword"),
  loginStatus: document.querySelector("#loginStatus"),
  logoutButton: document.querySelector("#logoutButton"),
  menuToggleButton: document.querySelector("#menuToggleButton"),
  menuBackdrop: document.querySelector("#menuBackdrop"),
  siteSideMenu: document.querySelector("#siteSideMenu"),
  siteMenuButtons: [...document.querySelectorAll("[data-page-link]")],
  sitePages: [...document.querySelectorAll("[data-page]")],
  requirementCollaboratorName: document.querySelector("#requirementCollaboratorName"),
  requirementCollaboratorPhone: document.querySelector("#requirementCollaboratorPhone"),
  saveRequirementCollaboratorButton: document.querySelector("#saveRequirementCollaboratorButton"),
  newRequirementCollaboratorButton: document.querySelector("#newRequirementCollaboratorButton"),
  requirementsStatus: document.querySelector("#requirementsStatus"),
  requirementsPeople: document.querySelector("#requirementsPeople"),
  requirementsHistory: document.querySelector("#requirementsHistory"),
  requirementDateFilter: document.querySelector("#requirementDateFilter"),
  requirementTimeFilter: document.querySelector("#requirementTimeFilter"),
  requirementDayFilter: document.querySelector("#requirementDayFilter"),
  requirementStatusFilter: document.querySelector("#requirementStatusFilter"),
  clearRequirementFiltersButton: document.querySelector("#clearRequirementFiltersButton"),
  appShell: document.querySelector("#appShell"),
  packageSelect: document.querySelector("#packageSelect"),
  servicePickerButton: document.querySelector("#servicePickerButton"),
  servicePicker: document.querySelector("#servicePicker"),
  selectedServiceSummary: document.querySelector("#selectedServiceSummary"),
  manualServiceEditor: document.querySelector("#manualServiceEditor"),
  manualServiceName: document.querySelector("#manualServiceName"),
  manualServicePriceField: document.querySelector("#manualServicePriceField"),
  manualServicePrice: document.querySelector("#manualServicePrice"),
  manualServiceItems: document.querySelector("#manualServiceItems"),
  manualServiceAddItem: document.querySelector("#manualServiceAddItem"),
  manualServiceAddSubtitle: document.querySelector("#manualServiceAddSubtitle"),
  manualServiceAddSubtotal: document.querySelector("#manualServiceAddSubtotal"),
  manualServiceAddTotal: document.querySelector("#manualServiceAddTotal"),
  currencySelect: document.querySelector("#currencySelect"),
  extrasScope: document.querySelector("#extrasScope"),
  extrasSearch: document.querySelector("#extrasSearch"),
  manualExtrasCount: document.querySelector("#manualExtrasCount"),
  manualExtrasAddButton: document.querySelector("#manualExtrasAddButton"),
  extrasList: document.querySelector("#extrasList"),
  additionalServicesButton: document.querySelector("#additionalServicesButton"),
  additionalServicesSection: document.querySelector("#additionalServicesSection"),
  quotePackageTitle: document.querySelector("#quotePackageTitle"),
  quoteCode: document.querySelector("#quoteCode"),
  serviceDetailCard: document.querySelector(".service-detail-card"),
  packageItems: document.querySelector("#packageItems"),
  packagePriceHeader: document.querySelector("#packagePriceHeader"),
  servicePriceRow: document.querySelector("#servicePriceRow"),
  packagePriceBadge: document.querySelector("#packagePriceBadge"),
  selectedExtrasSection: document.querySelector("#selectedExtrasSection"),
  selectedExtras: document.querySelector("#selectedExtras"),
  baseTotalRow: document.querySelector("#baseTotalRow"),
  baseTotal: document.querySelector("#baseTotal"),
  extrasTotalRow: document.querySelector("#extrasTotalRow"),
  extrasTotal: document.querySelector("#extrasTotal"),
  discountTotalRow: document.querySelector("#discountTotalRow"),
  discountTotal: document.querySelector("#discountTotal"),
  vatTotalRow: document.querySelector("#vatTotalRow"),
  vatTotal: document.querySelector("#vatTotal"),
  grandTotal: document.querySelector("#grandTotal"),
  totalsBox: document.querySelector("#totalsBox"),
  quoteBottomGrid: document.querySelector("#quoteBottomGrid"),
  quoteDocument: document.querySelector("#quoteDocument"),
  mountingPage: document.querySelector("#mountingPage"),
  paymentConditionsText: document.querySelector("#paymentConditionsText"),
  notesSection: document.querySelector("#notesSection"),
  docNotes: document.querySelector("#docNotes"),
  discountAmount: document.querySelector("#discountAmount"),
  topBatchQuotesButton: document.querySelector("#topBatchQuotesButton"),
  topMountingPageButton: document.querySelector("#topMountingPageButton"),
  topVatButton: document.querySelector("#topVatButton"),
  topDiscountButton: document.querySelector("#topDiscountButton"),
  topDiscountPanel: document.querySelector("#topDiscountPanel"),
  topSaveButton: document.querySelector("#topSaveButton"),
  topPrintButton: document.querySelector("#topPrintButton"),
  topNewQuoteButton: document.querySelector("#topNewQuoteButton"),
  topLanguageButton: document.querySelector("#topLanguageButton"),
  localFolderButton: document.querySelector("#localFolderButton"),
  editableQuoteOpenButton: document.querySelector("#editableQuoteOpenButton"),
  editableQuoteFileInput: document.querySelector("#editableQuoteFileInput"),
  localFolderStatus: document.querySelector("#localFolderStatus"),
  driveSaveStatus: document.querySelector("#driveSaveStatus"),
  lastSavedActions: document.querySelector("#lastSavedActions"),
  pdfFileName: document.querySelector("#pdfFileName"),
  historySearch: document.querySelector("#historySearch"),
  historySearchButton: document.querySelector("#historySearchButton"),
  historyRefreshButton: document.querySelector("#historyRefreshButton"),
  historyStatus: document.querySelector("#historyStatus"),
  historyResults: document.querySelector("#historyResults"),
  batchDialog: document.querySelector("#batchDialog"),
  batchCloseButton: document.querySelector("#batchCloseButton"),
  batchSetup: document.querySelector("#batchSetup"),
  batchQuantity: document.querySelector("#batchQuantity"),
  batchCreateButton: document.querySelector("#batchCreateButton"),
  batchWorkspace: document.querySelector("#batchWorkspace"),
  batchSequenceSummary: document.querySelector("#batchSequenceSummary"),
  batchModeButton: document.querySelector("#batchModeButton"),
  batchHeaderVatButton: document.querySelector("#batchHeaderVatButton"),
  batchHeaderPrintButton: document.querySelector("#batchHeaderPrintButton"),
  batchHeaderNewQuoteButton: document.querySelector("#batchHeaderNewQuoteButton"),
  batchDraftList: document.querySelector("#batchDraftList"),
  batchServiceSelect: document.querySelector("#batchServiceSelect"),
  batchCopyClientButton: document.querySelector("#batchCopyClientButton"),
  batchSaveButton: document.querySelector("#batchSaveButton"),
  batchExitButton: document.querySelector("#batchExitButton"),
  batchStatus: document.querySelector("#batchStatus"),
  batchEditorHost: document.querySelector("#batchEditorHost"),
  batchSavedResults: document.querySelector("#batchSavedResults"),
  fields: {
    quoteNumber: document.querySelector("#quoteNumberInput"),
    clientName: document.querySelector("#clientName"),
    clientPhone: document.querySelector("#clientPhone"),
    eventName: document.querySelector("#eventName"),
    quoteDate: document.querySelector("#quoteDate"),
    eventDate: document.querySelector("#eventDate"),
    groupSchedule: document.querySelector("#groupSchedule"),
    eventPlace: document.querySelector("#eventPlace"),
    guestCount: document.querySelector("#guestCount"),
    notes: document.querySelector("#notes")
  },
  docFields: {
    eventDate: document.querySelector("#docEventDate"),
    groupSchedule: document.querySelector("#docGroupSchedule"),
    eventPlace: document.querySelector("#docPlace"),
    quoteDate: document.querySelector("#docQuoteDate")
  }
};

const selectedExtras = new Set();
const extraQuantities = new Map();
const extraPrices = new Map();
const extraDimensions = new Map();
const extraManualDescriptions = new Map();
const extraComplimentary = new Map();
const extraGeneratorDetails = new Map();
const manualExtraBaseId = "extra-manual";
let manualExtraIds = [manualExtraBaseId];
const packageNameOverrides = new Map();
const packagePriceOverrides = new Map();
const packageItemOverrides = new Map();
const vatRate = 0.12;
let includeVat = false;
let includeDiscount = false;
let includeMountingPage = false;
let includeAdditionalServices = false;
let extrasSearchTerm = "";
let quoteLanguage = "es";
let quoteCurrency = "Q";
let pdfCssTextCache = "";
const pdfImageDataUriCache = new Map();
const defaultPackageId = "sunday-funday-completo";
const quoteSequenceStart = 10760n;
const quoteStorageKeys = {
  currentNumber: "liveQuoteCurrentNumber",
  currentDate: "liveQuoteCurrentDate"
};
const requirementsStorageKey = "liveRequirementsBoard";
const requirementsMigrationKey = "liveRequirementsBoardMigratedToServer";
const requirementAssignedByStorageKey = "liveRequirementsAssignedByDrafts";
let currentQuoteNumber = quoteSequenceStart;
let currentQuoteDate = "";
let requestedQuoteNumber = null;
let editingQuoteId = null;
let quoteAppStarted = false;
let requirementsState = { collaborators: [] };
let editingRequirementsCollaboratorId = null;
let requirementsEventsBound = false;
let requirementsRefreshTimer = null;
let selectedRequirementsCollaboratorId = null;
let activeRequirementReport = null;
let requirementAutoSaveTimer = null;
const requirementAssignedByDrafts = new Map();
const appShellHome = {
  parent: elements.appShell.parentNode,
  nextSibling: elements.appShell.nextSibling
};
const batchState = {
  drafts: [],
  baseNumber: quoteSequenceStart,
  activeIndex: -1,
  started: false,
  saved: false,
  saving: false,
  suppressCapture: false,
  results: [],
  nextNumber: null
};

function readStoredPackage() {
  try {
    return window.localStorage?.getItem("liveQuotePackage") || null;
  } catch {
    return null;
  }
}

function writeStoredPackage(packageId) {
  try {
    window.localStorage?.setItem("liveQuotePackage", packageId);
  } catch {
    // Some browsers block localStorage on file:// pages. The quote still works.
  }
}

function clearStoredPackage() {
  try {
    window.localStorage?.removeItem("liveQuotePackage");
  } catch {
    // Some browsers block localStorage on file:// pages. The quote still works.
  }
}

function readStoredValue(key) {
  try {
    return window.localStorage?.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStoredValue(key, value) {
  try {
    window.localStorage?.setItem(key, String(value));
  } catch {
    // Some browsers block localStorage on file:// pages. The quote still works.
  }
}

function requirementId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeRequirementTask(task) {
  const rawStatus = String(task?.status || "").trim().toLowerCase();
  const status = rawStatus === "realizado" || rawStatus === "hecho" ? "realizado" : "pendiente";
  const createdAt = String(task?.createdAt || new Date().toISOString());
  return {
    id: String(task?.id || requirementId("task")),
    collaboratorId: String(task?.collaboratorId || ""),
    text: String(task?.text || task?.description || "").trim(),
    description: String(task?.description || task?.text || "").trim(),
    status,
    createdAt,
    updatedAt: String(task?.updatedAt || createdAt),
    assignedBy: String(task?.assignedBy || "").trim(),
    dueAt: task?.dueAt ? String(task.dueAt) : "",
    completedBy: String(task?.completedBy || "").trim(),
    completedAt: task?.completedAt ? String(task.completedAt) : "",
    sentAt: task?.sentAt ? String(task.sentAt) : "",
    doneUrl: task?.doneUrl ? String(task.doneUrl) : ""
  };
}

function normalizeRequirementCollaborator(collaborator) {
  return {
    id: String(collaborator?.id || requirementId("collaborator")),
    name: String(collaborator?.name || "").trim(),
    phone: String(collaborator?.phone || "").trim(),
    tasks: Array.isArray(collaborator?.tasks)
      ? collaborator.tasks.map(normalizeRequirementTask).filter((task) => task.text)
      : []
  };
}

function normalizeRequirementsState(data) {
  return {
    collaborators: Array.isArray(data?.collaborators)
      ? data.collaborators.map(normalizeRequirementCollaborator).filter((collaborator) => collaborator.name)
      : []
  };
}

function readRequirementsState() {
  const stored = readStoredValue(requirementsStorageKey);
  if (!stored) return { collaborators: [] };
  try {
    return normalizeRequirementsState(JSON.parse(stored));
  } catch {
    return { collaborators: [] };
  }
}

function storeRequirementsState() {
  writeStoredValue(requirementsStorageKey, JSON.stringify(requirementsState));
}

function loadRequirementAssignedByDrafts() {
  const stored = readStoredValue(requirementAssignedByStorageKey);
  if (!stored) return;
  try {
    Object.entries(JSON.parse(stored)).forEach(([collaboratorId, assignedBy]) => {
      if (assignedBy) requirementAssignedByDrafts.set(String(collaboratorId), String(assignedBy));
    });
  } catch {
    // Ignore damaged draft data; server history remains intact.
  }
}

function storeRequirementAssignedByDrafts() {
  writeStoredValue(
    requirementAssignedByStorageKey,
    JSON.stringify(Object.fromEntries(requirementAssignedByDrafts))
  );
}

function requirementAssignedByValue(collaboratorId) {
  return requirementAssignedByDrafts.get(String(collaboratorId)) || "";
}

loadRequirementAssignedByDrafts();

function findRequirementCollaborator(collaboratorId) {
  return requirementsState.collaborators.find((collaborator) => collaborator.id === collaboratorId) || null;
}

function setRequirementsStatus(message, type = "") {
  if (!elements.requirementsStatus) return;
  elements.requirementsStatus.textContent = message;
  elements.requirementsStatus.classList.toggle("is-error", type === "error");
  elements.requirementsStatus.classList.toggle("is-success", type === "success");
}

function clearRequirementCollaboratorForm() {
  editingRequirementsCollaboratorId = null;
  if (elements.requirementCollaboratorName) elements.requirementCollaboratorName.value = "";
  if (elements.requirementCollaboratorPhone) elements.requirementCollaboratorPhone.value = "";
  if (elements.saveRequirementCollaboratorButton) {
    elements.saveRequirementCollaboratorButton.textContent = "Guardar colaborador";
  }
}

function applyRequirementsData(data) {
  requirementsState = normalizeRequirementsState(data || {});
  if (Array.isArray(data?.history)) requirementsState.history = data.history;
  if (
    selectedRequirementsCollaboratorId &&
    !requirementsState.collaborators.some((collaborator) => collaborator.id === selectedRequirementsCollaboratorId)
  ) {
    selectedRequirementsCollaboratorId = null;
  }
  if (
    activeRequirementReport &&
    !requirementsState.collaborators.some((collaborator) => collaborator.id === activeRequirementReport.collaboratorId)
  ) {
    activeRequirementReport = null;
  }
  renderRequirementsBoard();
}

function requirementFilters() {
  return {
    date: elements.requirementDateFilter?.value || "",
    time: elements.requirementTimeFilter?.value || "",
    day: elements.requirementDayFilter?.value || "",
    status: elements.requirementStatusFilter?.value || "all"
  };
}

function localRequirementParts(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: "", time: "", day: "" };
  const pad = (number) => String(number).padStart(2, "0");
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    day: String(date.getDay())
  };
}

function localDateTimeInputValue(value = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function todayRequirementDateKey() {
  return localRequirementParts(new Date()).date;
}

function matchesRequirementFilters(item) {
  const filters = requirementFilters();
  const itemStatus = item.status === "realizado" ? "realizado" : "pendiente";
  const itemParts = localRequirementParts(item.dueAt || item.createdAt || item.updatedAt);

  if (filters.status !== "all" && itemStatus !== filters.status) return false;
  if (filters.date && itemParts.date !== filters.date) return false;
  if (filters.time && itemParts.time !== filters.time) return false;
  if (filters.day && itemParts.day !== filters.day) return false;
  return true;
}

function filteredRequirementTasks(collaborator) {
  return (collaborator.tasks || []).filter(matchesRequirementFilters);
}

function requirementTaskCounts(collaborator) {
  return (collaborator.tasks || []).reduce(
    (totals, task) => {
      if (task.status === "realizado") totals.realizado += 1;
      else totals.pendiente += 1;
      totals.total += 1;
      return totals;
    },
    { total: 0, pendiente: 0, realizado: 0 }
  );
}

function clearRequirementFilters() {
  if (elements.requirementDateFilter) elements.requirementDateFilter.value = "";
  if (elements.requirementTimeFilter) elements.requirementTimeFilter.value = "";
  if (elements.requirementDayFilter) elements.requirementDayFilter.value = "";
  if (elements.requirementStatusFilter) elements.requirementStatusFilter.value = "all";
  renderRequirementsBoard();
  setRequirementsStatus("Filtros limpiados.", "success");
}

async function refreshRequirementsBoard({ quiet = false } = {}) {
  if (!isLocalServerAvailable()) {
    if (!quiet) {
      requirementsState = readRequirementsState();
      renderRequirementsBoard();
      setRequirementsStatus("El historial compartido se activa desde la página web.", "error");
    }
    return;
  }

  try {
    const data = await apiRequest("/api/requerimientos", { method: "GET", headers: {} });
    applyRequirementsData(data);
    if (!quiet) setRequirementsStatus("Historial compartido actualizado.", "success");
  } catch (error) {
    if (!quiet) setRequirementsStatus(error.message, "error");
  }
}

async function migrateStoredRequirementsToServer() {
  if (!isLocalServerAvailable() || readStoredValue(requirementsMigrationKey)) return;

  const storedState = readRequirementsState();
  if (!storedState.collaborators.length) {
    writeStoredValue(requirementsMigrationKey, "empty");
    return;
  }

  try {
    const data = await apiRequest("/api/requerimientos/import", {
      method: "POST",
      body: JSON.stringify(storedState)
    });
    writeStoredValue(requirementsMigrationKey, new Date().toISOString());
    applyRequirementsData(data);
    setRequirementsStatus("Historial local migrado al historial compartido.", "success");
  } catch (error) {
    setRequirementsStatus(`No se pudo migrar el historial local: ${error.message}`, "error");
  }
}

async function loadSharedRequirementsBoard() {
  await migrateStoredRequirementsToServer();
  await refreshRequirementsBoard({ quiet: true });
}

async function saveRequirementCollaborator() {
  const name = elements.requirementCollaboratorName?.value.trim() || "";
  const phone = elements.requirementCollaboratorPhone?.value.trim() || "";
  if (!name || !phone) {
    setRequirementsStatus("Agregue nombre del colaborador y número de WhatsApp.", "error");
    return;
  }

  const existing = editingRequirementsCollaboratorId
    ? findRequirementCollaborator(editingRequirementsCollaboratorId)
    : null;

  setRequirementsStatus(existing ? "Actualizando colaborador..." : "Guardando colaborador...");

  try {
    const data = await apiRequest(
      existing ? `/api/requerimientos/colaboradores/${existing.id}` : "/api/requerimientos/colaboradores",
      {
        method: existing ? "PUT" : "POST",
        body: JSON.stringify({ name, phone })
      }
    );
    applyRequirementsData(data);
    const selected = requirementsState.collaborators.find(
      (collaborator) =>
        collaborator.name.toLocaleLowerCase("es-GT") === name.toLocaleLowerCase("es-GT") ||
        whatsappPhone(collaborator.phone) === whatsappPhone(phone)
    );
    selectedRequirementsCollaboratorId = selected?.id || existing?.id || selectedRequirementsCollaboratorId;
    clearRequirementCollaboratorForm();
    renderRequirementsBoard();
    setRequirementsStatus(existing ? `Colaborador actualizado: ${name}.` : `Colaborador agregado: ${name}.`, "success");
  } catch (error) {
    setRequirementsStatus(error.message, "error");
  }
}

function editRequirementCollaborator(collaboratorId) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  if (!collaborator) return;
  editingRequirementsCollaboratorId = collaborator.id;
  elements.requirementCollaboratorName.value = collaborator.name;
  elements.requirementCollaboratorPhone.value = collaborator.phone;
  elements.saveRequirementCollaboratorButton.textContent = "Actualizar colaborador";
  elements.requirementCollaboratorName.focus();
  setRequirementsStatus(`Editando datos de ${collaborator.name}.`, "success");
}

async function removeRequirementCollaborator(collaboratorId) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  if (!collaborator) return;
  const confirmed = window.confirm("¿Estás totalmente seguro que deseas eliminar este colaborador?");
  if (!confirmed) return;

  setRequirementsStatus(`Eliminando colaborador ${collaborator.name}...`);
  try {
    const data = await apiRequest(`/api/requerimientos/colaboradores/${collaborator.id}`, {
      method: "DELETE",
      headers: {}
    });
    if (selectedRequirementsCollaboratorId === collaborator.id) selectedRequirementsCollaboratorId = null;
    if (activeRequirementReport?.collaboratorId === collaborator.id) activeRequirementReport = null;
    applyRequirementsData(data);
    setRequirementsStatus(`Colaborador eliminado: ${collaborator.name}. Sus tareas quedan resguardadas.`, "success");
  } catch (error) {
    setRequirementsStatus(error.message, "error");
  }
}

function requirementDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("es-GT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function requirementStatusLabel(status) {
  if (status === "realizado") return "Realizado";
  return "Pendiente";
}

function requirementStatusClass(status) {
  if (status === "realizado") return "is-done";
  return "is-pending";
}

function buildRequirementWhatsappMessage(collaborator, task) {
  const taskText = String(task?.description || task?.text || "").trim();
  const doneUrl = String(task?.doneUrl || "").trim();
  return [
    `Hola ${collaborator.name}.`,
    "Te comparto el siguiente requerimiento para el evento:",
    "",
    `Descripción: ${taskText}`,
    task?.dueAt ? `Fecha a realizarse: ${requirementDate(task.dueAt)}` : "",
    task?.assignedBy ? `Asignada por: ${task.assignedBy}` : "",
    "Estado: Pendiente",
    "",
    doneUrl
      ? `Confirmar realizado: ${doneUrl}`
      : "Confirmar realizado: responda por este chat.",
    "",
    "Cuando termines, abre el enlace y presiona Marcar como realizado para actualizar el historial.",
    "Live Productions"
  ].join("\n");
}

function requirementWhatsappUrl(collaborator, task) {
  const phone = whatsappPhone(collaborator.phone);
  if (!phone) {
    setRequirementsStatus(`Revise el número de WhatsApp de ${collaborator.name}.`, "error");
    return "";
  }

  const message = buildRequirementWhatsappMessage(collaborator, task);
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "readonly");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

async function copyRequirementWhatsappMessage(collaborator, task) {
  const phone = whatsappPhone(collaborator.phone);
  if (!phone) {
    setRequirementsStatus(`Revise el número de WhatsApp de ${collaborator.name}.`, "error");
    return false;
  }

  await copyTextToClipboard(buildRequirementWhatsappMessage(collaborator, task));
  return true;
}

async function createRequirementTask(
  collaboratorId,
  text,
  shouldSendWhatsapp = false,
  targetWindow = null,
  assignedBy = "",
  dueAt = ""
) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  const cleanText = String(text || "").trim();
  if (!collaborator || !cleanText) {
    setRequirementsStatus("Escriba el requerimiento antes de crear la tarea.", "error");
    return false;
  }

  setRequirementsStatus(shouldSendWhatsapp ? "Creando tarea para WhatsApp..." : "Guardando tarea...");

  try {
    const result = await apiRequest("/api/requerimientos/tareas", {
      method: "POST",
      body: JSON.stringify({
        collaboratorId,
        description: cleanText,
        assignedBy,
        dueAt
      })
    });
    const task = normalizeRequirementTask(result.task);
    const whatsappReady = shouldSendWhatsapp ? await copyRequirementWhatsappMessage(collaborator, task) : true;
    if (shouldSendWhatsapp && whatsappReady) {
      const data = await apiRequest(`/api/requerimientos/tareas/${task.id}/enviado`, {
        method: "POST",
        body: JSON.stringify({})
      });
      applyRequirementsData(data);
    } else {
      applyRequirementsData(result.requirements || {});
    }
    if (shouldSendWhatsapp && !whatsappReady) return false;
    setRequirementsStatus(
      shouldSendWhatsapp
        ? `Tarea creada. Mensaje copiado para pegarlo en WhatsApp de ${collaborator.name}.`
        : `Tarea guardada para ${collaborator.name}.`,
      "success"
    );
    return true;
  } catch (error) {
    setRequirementsStatus(error.message, "error");
    return false;
  }
}

async function updateRequirementTaskStatus(collaboratorId, taskId, status) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  const task = collaborator?.tasks.find((item) => item.id === taskId);
  if (!task) return;
  setRequirementsStatus(`Actualizando tarea de ${collaborator.name}...`);
  try {
    const data = await apiRequest(`/api/requerimientos/tareas/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ status })
    });
    applyRequirementsData(data);
    setRequirementsStatus(`${collaborator.name}: tarea marcada como ${requirementStatusLabel(status).toLowerCase()}.`, "success");
  } catch (error) {
    setRequirementsStatus(error.message, "error");
  }
}

async function resendRequirementTask(collaboratorId, taskId) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  const task = collaborator?.tasks.find((item) => item.id === taskId);
  if (!task) return;

  if (await copyRequirementWhatsappMessage(collaborator, task)) {
    try {
      const data = await apiRequest(`/api/requerimientos/tareas/${task.id}/enviado`, {
        method: "POST",
        body: JSON.stringify({})
      });
      applyRequirementsData(data);
      setRequirementsStatus(
        `Mensaje copiado. Pégalo en la conversación de WhatsApp que ya tienes abierta para ${collaborator.name}.`,
        "success"
      );
    } catch (error) {
      setRequirementsStatus(error.message, "error");
    }
  }
}

function requirementButton(label, action, extra = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.requirementAction = action;
  Object.entries(extra).forEach(([key, value]) => {
    button.dataset[key] = value;
  });
  return button;
}

function appendEmptyRequirementsMessage(parent, text) {
  const empty = document.createElement("p");
  empty.className = "requirements-empty";
  empty.textContent = text;
  parent.appendChild(empty);
}

function renderRequirementTask(task, collaborator) {
  const item = document.createElement("article");
  item.className = `requirement-task ${requirementStatusClass(task.status)}`;

  const descriptionLine = document.createElement("div");
  descriptionLine.className = "requirement-task-line";
  const descriptionLabel = document.createElement("strong");
  descriptionLabel.textContent = "Descripción";
  const descriptionCopy = document.createElement("p");
  descriptionCopy.textContent = task.description || task.text;
  descriptionLine.append(descriptionLabel, descriptionCopy);

  const statusLine = document.createElement("div");
  statusLine.className = "requirement-task-line requirement-task-status-line";
  const statusLabel = document.createElement("strong");
  statusLabel.textContent = "Estado";
  const status = document.createElement("span");
  status.className = `requirement-task-status ${requirementStatusClass(task.status)}`;
  status.textContent = requirementStatusLabel(task.status);
  statusLine.append(statusLabel, status);

  const assignedLine = document.createElement("div");
  assignedLine.className = "requirement-task-line";
  const assignedLabel = document.createElement("strong");
  assignedLabel.textContent = "Asignada por";
  const assignedCopy = document.createElement("p");
  assignedCopy.textContent = task.assignedBy || "Sin asignar";
  assignedLine.append(assignedLabel, assignedCopy);

  const dueLine = document.createElement("div");
  dueLine.className = "requirement-task-line";
  const dueLabel = document.createElement("strong");
  dueLabel.textContent = "Fecha a realizarse";
  const dueCopy = document.createElement("p");
  dueCopy.textContent = task.dueAt ? requirementDate(task.dueAt) : "Sin fecha";
  dueLine.append(dueLabel, dueCopy);

  const dates = document.createElement("small");
  dates.textContent = [
    `Asignada: ${requirementDate(task.createdAt)}`,
    task.sentAt ? `WhatsApp: ${requirementDate(task.sentAt)}` : "",
    task.completedAt ? `Realizado: ${requirementDate(task.completedAt)}` : ""
  ].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "requirement-task-actions";
  actions.append(
    requirementButton("Pendiente", "status-pending", { taskId: task.id }),
    requirementButton("Realizado", "status-done", { taskId: task.id }),
    requirementButton("Copiar WhatsApp", "resend-task", { taskId: task.id })
  );

  [...actions.querySelectorAll("button")].forEach((button) => {
    const action = button.dataset.requirementAction;
    button.disabled =
      (action === "status-pending" && task.status === "pendiente") ||
      (action === "status-done" && task.status === "realizado");
  });

  item.append(descriptionLine, statusLine, assignedLine, dueLine, dates, actions);
  return item;
}

function renderRequirementCollaborator(collaborator) {
  const counts = requirementTaskCounts(collaborator);
  const card = document.createElement("article");
  card.className = "requirement-collaborator-card";
  card.classList.toggle("is-active", collaborator.id === selectedRequirementsCollaboratorId);
  card.dataset.collaboratorId = collaborator.id;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "requirement-collaborator-button";
  button.dataset.requirementAction = "select-collaborator";
  button.dataset.collaboratorId = collaborator.id;

  const name = document.createElement("strong");
  name.textContent = collaborator.name;
  const phone = document.createElement("span");
  const normalizedPhone = whatsappPhone(collaborator.phone);
  phone.textContent = normalizedPhone ? `+${normalizedPhone}` : collaborator.phone;
  const summary = document.createElement("small");
  summary.textContent = `${counts.total} tareas · ${counts.pendiente} pendientes · ${counts.realizado} realizadas`;
  button.append(name, phone, summary);

  const actions = document.createElement("div");
  actions.className = "requirement-collaborator-actions";
  actions.append(
    requirementButton("Reporte diario", "report-daily", { collaboratorId: collaborator.id }),
    requirementButton("Pendientes", "report-pending", { collaboratorId: collaborator.id }),
    requirementButton("Eliminar", "remove-collaborator", { collaboratorId: collaborator.id })
  );

  card.append(button, actions);
  return card;
}

function requirementReportDateKey(task, type) {
  if (type === "daily") {
    return localRequirementParts(task.completedAt || task.dueAt || task.updatedAt || task.createdAt).date;
  }
  return localRequirementParts(task.dueAt || task.createdAt || task.updatedAt).date;
}

function requirementReportDateLabel(dateKey) {
  if (!dateKey) return "";
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("es-GT", { day: "2-digit", month: "long", year: "numeric" });
}

function requirementTasksForReport(collaborator, type, dateKey) {
  const tasks = Array.isArray(collaborator?.tasks) ? collaborator.tasks : [];
  if (type === "pending") return tasks.filter((task) => task.status !== "realizado");
  return tasks.filter((task) => task.status === "realizado" && requirementReportDateKey(task, type) === dateKey);
}

function buildRequirementReportText(collaborator, type, dateKey) {
  const title = type === "pending" ? "Reporte de tareas pendientes" : "Reporte diario de tareas realizadas";
  const tasks = requirementTasksForReport(collaborator, type, dateKey);
  const lines = [
    title,
    `Colaborador: ${collaborator.name}`,
    `WhatsApp: ${collaborator.phone}`,
    `Fecha: ${requirementReportDateLabel(dateKey) || "Sin fecha"}`,
    ""
  ];

  if (!tasks.length) {
    lines.push(type === "pending" ? "No tiene tareas pendientes." : "No tiene tareas realizadas para esta fecha.");
  } else {
    tasks.forEach((task, index) => {
      lines.push(`${index + 1}. ${task.description || task.text}`);
      lines.push(`   Estado: ${requirementStatusLabel(task.status)}`);
      if (task.dueAt) lines.push(`   Fecha a realizarse: ${requirementDate(task.dueAt)}`);
      if (task.completedAt) lines.push(`   Realizado: ${requirementDate(task.completedAt)}`);
      if (task.assignedBy) lines.push(`   Asignada por: ${task.assignedBy}`);
    });
  }

  lines.push("", "Live Productions");
  return lines.join("\n");
}

function showRequirementReport(collaboratorId, type) {
  const collaborator = findRequirementCollaborator(collaboratorId);
  if (!collaborator) return;
  const dateKey = elements.requirementDateFilter?.value || todayRequirementDateKey();
  activeRequirementReport = {
    collaboratorId,
    type,
    dateKey,
    text: buildRequirementReportText(collaborator, type, dateKey)
  };
  renderRequirementsHistory();
  setRequirementsStatus(
    type === "pending"
      ? `Reporte de pendientes generado para ${collaborator.name}.`
      : `Reporte diario generado para ${collaborator.name}.`,
    "success"
  );
}

async function copyActiveRequirementReport() {
  if (!activeRequirementReport?.text) return;
  try {
    await copyTextToClipboard(activeRequirementReport.text);
    setRequirementsStatus("Reporte copiado. Puede pegarlo en WhatsApp o en otro documento.", "success");
  } catch (error) {
    setRequirementsStatus(`No se pudo copiar el reporte: ${error.message}`, "error");
  }
}

function renderActiveRequirementReport() {
  if (!activeRequirementReport) return null;
  const collaborator = findRequirementCollaborator(activeRequirementReport.collaboratorId);
  if (!collaborator) return null;
  const card = document.createElement("article");
  card.className = "requirements-report-card";
  card.dataset.collaboratorId = collaborator.id;

  const title = document.createElement("strong");
  title.textContent =
    activeRequirementReport.type === "pending"
      ? `Pendientes · ${collaborator.name}`
      : `Reporte diario · ${collaborator.name}`;

  const text = document.createElement("pre");
  text.textContent = activeRequirementReport.text;

  const actions = document.createElement("div");
  actions.className = "requirement-task-actions";
  actions.append(
    requirementButton("Copiar reporte", "copy-report", { collaboratorId: collaborator.id }),
    requirementButton("Cerrar", "close-report", { collaboratorId: collaborator.id })
  );

  card.append(title, text, actions);
  return card;
}

function renderSelectedRequirementCollaborator(collaborator) {
  const card = document.createElement("article");
  card.className = "requirement-person-card requirement-person-detail";
  card.dataset.collaboratorId = collaborator.id;

  const header = document.createElement("div");
  header.className = "requirement-person-header";

  const title = document.createElement("div");
  const name = document.createElement("h2");
  name.textContent = collaborator.name;
  const phone = document.createElement("span");
  const normalizedPhone = whatsappPhone(collaborator.phone);
  phone.textContent = normalizedPhone ? `WhatsApp: +${normalizedPhone}` : `WhatsApp: ${collaborator.phone}`;
  title.append(name, phone);

  const assignedField = document.createElement("label");
  assignedField.className = "requirement-assigned-field";
  assignedField.textContent = "Nombre de quien asigna la tarea";
  const assignedInput = document.createElement("input");
  assignedInput.type = "text";
  assignedInput.dataset.requirementAssignedBy = "true";
  assignedInput.placeholder = "Escriba quien asigna";
  assignedInput.value = requirementAssignedByValue(collaborator.id);
  assignedField.appendChild(assignedInput);

  const headerActions = document.createElement("div");
  headerActions.className = "requirement-person-actions";
  headerActions.append(
    requirementButton("Editar", "edit-collaborator"),
    requirementButton("Reporte diario", "report-daily"),
    requirementButton("Pendientes", "report-pending"),
    requirementButton("Eliminar", "remove-collaborator")
  );

  header.append(title, assignedField, headerActions);

  const composer = document.createElement("div");
  composer.className = "requirement-composer";
  const label = document.createElement("label");
  label.textContent = "Nueva tarea";
  const textarea = document.createElement("textarea");
  textarea.dataset.requirementTaskText = "true";
  textarea.placeholder = "Escriba una tarea nueva";
  label.appendChild(textarea);
  const metaGrid = document.createElement("div");
  metaGrid.className = "requirement-composer-grid";
  const assignedAtLabel = document.createElement("label");
  assignedAtLabel.textContent = "Fecha y hora asignada";
  const assignedAtInput = document.createElement("input");
  assignedAtInput.type = "datetime-local";
  assignedAtInput.value = localDateTimeInputValue(new Date());
  assignedAtInput.readOnly = true;
  assignedAtLabel.appendChild(assignedAtInput);
  const dueAtLabel = document.createElement("label");
  dueAtLabel.textContent = "Fecha a realizarse";
  const dueAtInput = document.createElement("input");
  dueAtInput.type = "datetime-local";
  dueAtInput.dataset.requirementDueAt = "true";
  dueAtLabel.appendChild(dueAtInput);
  metaGrid.append(assignedAtLabel, dueAtLabel);
  const createButton = requirementButton("Guardar tarea", "create-task");
  createButton.classList.add("primary-button");
  const autoSaveNote = document.createElement("small");
  autoSaveNote.className = "requirement-autosave-note";
  autoSaveNote.textContent = "La tarea se guarda únicamente al presionar Guardar tarea.";
  composer.append(label, metaGrid, createButton, autoSaveNote);

  const taskList = document.createElement("div");
  taskList.className = "requirement-task-list";
  const visibleTasks = filteredRequirementTasks(collaborator);
  if (visibleTasks.length) {
    visibleTasks.forEach((task) => taskList.appendChild(renderRequirementTask(task, collaborator)));
  } else {
    appendEmptyRequirementsMessage(taskList, "No hay tareas con los filtros seleccionados.");
  }

  card.append(header, composer, taskList);
  return card;
}

function renderRequirementsHistory() {
  if (!elements.requirementsHistory) return;
  clearNode(elements.requirementsHistory);

  const reportCard = renderActiveRequirementReport();
  if (reportCard) elements.requirementsHistory.appendChild(reportCard);

  const records = requirementsState.collaborators
    .flatMap((collaborator) =>
      (collaborator.tasks || []).map((task) => ({
        ...task,
        collaboratorId: task.collaboratorId || collaborator.id,
        collaboratorName: collaborator.name,
        collaboratorPhone: collaborator.phone
      }))
    )
    .filter((task) => !selectedRequirementsCollaboratorId || task.collaboratorId === selectedRequirementsCollaboratorId)
    .filter(matchesRequirementFilters)
    .sort((left, right) => {
      const rightTime = new Date(right.updatedAt || right.createdAt).getTime() || 0;
      const leftTime = new Date(left.updatedAt || left.createdAt).getTime() || 0;
      return rightTime - leftTime;
    });

  if (!records.length) {
    if (!reportCard) {
      appendEmptyRequirementsMessage(elements.requirementsHistory, "No hay resumen de tareas con los filtros seleccionados.");
    }
    return;
  }

  records.forEach((task) => {
    const item = document.createElement("article");
    item.className = `requirements-history-item ${requirementStatusClass(task.status)}`;

    const status = document.createElement("span");
    status.className = `requirement-task-status ${requirementStatusClass(task.status)}`;
    status.textContent = requirementStatusLabel(task.status);

    const title = document.createElement("strong");
    title.textContent = `Tarea · ${task.collaboratorName || "Sin colaborador"}`;

    const text = document.createElement("p");
    text.textContent = task.description || "Sin descripción";

    const meta = document.createElement("small");
    meta.textContent = [
      `Asignada: ${requirementDate(task.createdAt)}`,
      task.dueAt ? `Fecha a realizarse: ${requirementDate(task.dueAt)}` : "",
      task.sentAt ? `WhatsApp: ${requirementDate(task.sentAt)}` : "",
      task.assignedBy ? `Asignada por: ${task.assignedBy}` : "Asignada por: Sin asignar",
      task.completedAt ? `Realizado: ${requirementDate(task.completedAt)}` : ""
    ].filter(Boolean).join(" · ");

    item.append(status, title, text, meta);
    elements.requirementsHistory.appendChild(item);
  });
}

function renderRequirementsBoard() {
  if (!elements.requirementsPeople) return;
  clearNode(elements.requirementsPeople);

  if (!requirementsState.collaborators.length) {
    appendEmptyRequirementsMessage(
      elements.requirementsPeople,
      "Agregue un colaborador para crear su cuadro de tareas."
    );
    renderRequirementsHistory();
    return;
  }

  if (
    selectedRequirementsCollaboratorId &&
    !requirementsState.collaborators.some((collaborator) => collaborator.id === selectedRequirementsCollaboratorId)
  ) {
    selectedRequirementsCollaboratorId = null;
  }

  const list = document.createElement("div");
  list.className = "requirements-collaborator-list";
  requirementsState.collaborators.forEach((collaborator) => {
    list.appendChild(renderRequirementCollaborator(collaborator));
  });
  elements.requirementsPeople.appendChild(list);

  const selectedCollaborator = selectedRequirementsCollaboratorId
    ? findRequirementCollaborator(selectedRequirementsCollaboratorId)
    : null;
  if (selectedCollaborator) {
    elements.requirementsPeople.appendChild(renderSelectedRequirementCollaborator(selectedCollaborator));
  } else {
    appendEmptyRequirementsMessage(elements.requirementsPeople, "Seleccione un colaborador para ver y crear sus tareas.");
  }

  renderRequirementsHistory();
}

function handleRequirementsBoardClick(event) {
  const button = event.target.closest("button[data-requirement-action]");
  if (!button) return;

  const card = button.closest("[data-collaborator-id]");
  const collaboratorId = button.dataset.collaboratorId || card?.dataset.collaboratorId;
  const action = button.dataset.requirementAction;
  if (!collaboratorId || !action) return;

  if (action === "select-collaborator") {
    selectedRequirementsCollaboratorId =
      selectedRequirementsCollaboratorId === collaboratorId ? null : collaboratorId;
    renderRequirementsBoard();
    return;
  }

  if (action === "edit-collaborator") {
    editRequirementCollaborator(collaboratorId);
    return;
  }

  if (action === "remove-collaborator") {
    removeRequirementCollaborator(collaboratorId);
    return;
  }

  if (action === "report-daily") {
    showRequirementReport(collaboratorId, "daily");
    return;
  }

  if (action === "report-pending") {
    showRequirementReport(collaboratorId, "pending");
    return;
  }

  if (action === "copy-report") {
    copyActiveRequirementReport();
    return;
  }

  if (action === "close-report") {
    activeRequirementReport = null;
    renderRequirementsHistory();
    return;
  }

  if (action === "create-task") {
    const textArea = card.querySelector("[data-requirement-task-text]");
    const dueAt = card.querySelector("[data-requirement-due-at]")?.value || "";
    const assignedBy = card.querySelector("[data-requirement-assigned-by]")?.value.trim() || "";
    createRequirementTask(collaboratorId, textArea?.value || "", false, null, assignedBy, dueAt).then((saved) => {
      if (saved && textArea) {
        textArea.value = "";
        const dueAtInput = card.querySelector("[data-requirement-due-at]");
        if (dueAtInput) dueAtInput.value = "";
      }
    });
    return;
  }

  const taskId = button.dataset.taskId;
  if (!taskId) return;

  if (action === "status-pending") updateRequirementTaskStatus(collaboratorId, taskId, "pendiente");
  if (action === "status-done") updateRequirementTaskStatus(collaboratorId, taskId, "realizado");
  if (action === "resend-task") resendRequirementTask(collaboratorId, taskId);
}

function scheduleRequirementTaskAutoSave(textarea) {
  const card = textarea.closest("[data-collaborator-id]");
  const collaboratorId = card?.dataset.collaboratorId;
  if (!collaboratorId) return;

  window.clearTimeout(requirementAutoSaveTimer);
  const text = textarea.value.trim();
  if (!text) return;

  setRequirementsStatus("Guardando tarea automáticamente...");
  requirementAutoSaveTimer = window.setTimeout(async () => {
    if (textarea.dataset.autosaving === "true") return;
    textarea.dataset.autosaving = "true";
    textarea.disabled = true;
    const assignedBy = card.querySelector("[data-requirement-assigned-by]")?.value.trim() || "";
    const saved = await createRequirementTask(collaboratorId, text, false, null, assignedBy);
    if (!saved) {
      textarea.disabled = false;
      textarea.dataset.autosaving = "";
    }
  }, 1600);
}

function handleRequirementsBoardInput(event) {
  const assignedInput = event.target.closest("[data-requirement-assigned-by]");
  if (assignedInput) {
    const card = assignedInput.closest("[data-collaborator-id]");
    const collaboratorId = card?.dataset.collaboratorId;
    if (collaboratorId) {
      const value = assignedInput.value.trim();
      if (value) requirementAssignedByDrafts.set(collaboratorId, value);
      else requirementAssignedByDrafts.delete(collaboratorId);
      storeRequirementAssignedByDrafts();
    }
    return;
  }

  const textarea = event.target.closest("[data-requirement-autosave]");
  if (!textarea) return;
  scheduleRequirementTaskAutoSave(textarea);
}

async function handleRequirementsBoardFocusOut(event) {
  const textarea = event.target.closest("[data-requirement-autosave]");
  if (!textarea || !textarea.value.trim() || textarea.dataset.autosaving === "true") return;

  window.clearTimeout(requirementAutoSaveTimer);
  textarea.dataset.autosaving = "true";
  textarea.disabled = true;
  const card = textarea.closest("[data-collaborator-id]");
  const assignedBy = card?.querySelector("[data-requirement-assigned-by]")?.value.trim() || "";
  const saved = await createRequirementTask(card?.dataset.collaboratorId, textarea.value.trim(), false, null, assignedBy);
  if (!saved) {
    textarea.disabled = false;
    textarea.dataset.autosaving = "";
  }
}

function bindRequirementsEvents() {
  if (requirementsEventsBound) return;
  requirementsEventsBound = true;
  elements.saveRequirementCollaboratorButton?.addEventListener("click", saveRequirementCollaborator);
  elements.newRequirementCollaboratorButton?.addEventListener("click", () => {
    clearRequirementCollaboratorForm();
    setRequirementsStatus("Listo para agregar un nuevo colaborador.");
  });
  elements.requirementsPeople?.addEventListener("click", handleRequirementsBoardClick);
  elements.requirementsHistory?.addEventListener("click", handleRequirementsBoardClick);
  elements.requirementsPeople?.addEventListener("input", handleRequirementsBoardInput);
  elements.requirementsPeople?.addEventListener("focusout", handleRequirementsBoardFocusOut);
  [
    elements.requirementDateFilter,
    elements.requirementTimeFilter,
    elements.requirementDayFilter,
    elements.requirementStatusFilter
  ].forEach((field) => {
    field?.addEventListener("input", renderRequirementsBoard);
    field?.addEventListener("change", renderRequirementsBoard);
  });
  elements.clearRequirementFiltersButton?.addEventListener("click", clearRequirementFilters);
  [elements.requirementCollaboratorName, elements.requirementCollaboratorPhone].forEach((input) => {
    input?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") saveRequirementCollaborator();
    });
  });
  renderRequirementsBoard();
}

function activeRequirementsPageVisible() {
  return document.querySelector(".site-page.is-active")?.dataset.page === "requerimientos";
}

function requirementsInputHasFocus() {
  return Boolean(document.activeElement?.closest?.("#requerimientosPage input, #requerimientosPage textarea"));
}

function startRequirementsRefreshTimer() {
  if (requirementsRefreshTimer) return;
  requirementsRefreshTimer = window.setInterval(() => {
    if (activeRequirementsPageVisible() && !requirementsInputHasFocus()) {
      refreshRequirementsBoard({ quiet: true });
    }
  }, 15000);
}

function currencySymbol() {
  return quoteCurrency === "$" ? "$" : "Q";
}

function formatMoney(value) {
  if (value === null) return quoteLanguage === "en" ? "Pending" : "Pendiente";
  return `${currencySymbol()}${Number(value).toLocaleString("en-US")}.`;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

function readMoneyInput(input) {
  const value = Number.parseFloat(input.value);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatDate(value) {
  if (!value) return quoteLanguage === "en" ? "To be confirmed" : "Por definir";
  return new Date(`${value}T00:00:00`).toLocaleDateString(
    quoteLanguage === "en" ? "en-US" : "es-GT",
    {
    day: "2-digit",
    month: "long",
    year: "numeric"
    }
  );
}

const englishQuoteText = new Map([
  ["NINGUNO", "NONE"],
  ["COTIZACIÓN DE EXTRAS", "EXTRAS QUOTATION"],
  ["SERVICIOS DE ENTRETENIMIENTO LOCAL", "LOCAL ENTERTAINMENT SERVICES"],
  ["SERVICIOS DE ENTRETENIMIENTO INTERIOR", "OUT-OF-TOWN ENTERTAINMENT SERVICES"],
  ["DJ COMPLETO", "COMPLETE DJ SERVICE"],
  ["NOVALOOPS COMPLETO", "NOVALOOPS COMPLETE"],
  ["RUMBAYE COMPLETO", "RUMBAYE COMPLETE"],
  ["SAXOFONIC COMPLETO", "SAXOFONIC COMPLETE"],
  ["SUNDAY FUNDAY COMPLETO", "SUNDAY FUNDAY COMPLETE"],
  ["DJ PRIVADO", "PRIVATE DJ"],
  ["NOVALOOPS PRIVADO", "NOVALOOPS PRIVATE"],
  ["RUMBAYE PRIVADO", "RUMBAYE PRIVATE"],
  ["SAXOFONIC PRIVADO", "SAXOFONIC PRIVATE"],
  ["SUNDAY FUNDAY PRIVADO", "SUNDAY FUNDAY PRIVATE"],
  ["DJ SOLO SHOW", "DJ SOLO SHOW"],
  ["NOVALOOPS SOLO SHOW", "NOVALOOPS SOLO SHOW"],
  ["RUMBAYE SOLO SHOW", "RUMBAYE SOLO SHOW"],
  ["SAXOFONIC SOLO SHOW", "SAXOFONIC SOLO SHOW"],
  ["SUNDAY FUNDAY SOLO SHOW", "SUNDAY FUNDAY SOLO SHOW"],
  ["DJ COMPLETO INTERIOR", "COMPLETE DJ SERVICE - OUT OF TOWN"],
  ["NOVALOOPS INTERIOR", "NOVALOOPS - OUT OF TOWN"],
  ["RUMBAYE INTERIOR", "RUMBAYE - OUT OF TOWN"],
  ["SUNDAY FUNDAY INTERIOR", "SUNDAY FUNDAY - OUT OF TOWN"]
]);

const englishPhraseReplacements = [
  ["Presentación grupo", "Band performance"],
  ["Presentación Grupo", "Band performance"],
  ["Presentación de DJ", "DJ performance"],
  ["Presentación de Dj", "DJ performance"],
  ["Presentación DJ", "DJ performance"],
  ["Presentación", "Performance"],
  ["Bajos", "Subwoofers"],
  ["Sistemas de amplificación", "Speaker systems"],
  ["Monitores de piso", "Floor monitors"],
  ["Consola digital", "Digital console"],
  ["Estructuras de iluminación de 2mts forradas", "Draped 2-meter lighting structures"],
  ["Luces móviles", "Moving lights"],
  ["Luces pares LED", "LED PAR lights"],
  ["Luces PAR 64", "PAR 64 lights"],
  ["Luces blinders", "Blinder lights"],
  ["Luces washas", "Wash lights"],
  ["Controlador DMX", "DMX controller"],
  ["Microfonía e instrumentos", "Microphones and instruments"],
  ["Microfonía e instrumento", "Microphones and instruments"],
  ["Microfonía y amplificación para grupo musical", "Microphones and sound system for the band"],
  ["Sistema de monitoreo interno del grupo", "Internal monitoring system for the band"],
  ["Sistema de monitoreo interno", "Internal monitoring system"],
  ["Ing. De sonido y Staff técnico", "Sound engineer and technical staff"],
  ["Ing. de sonido y Staff técnico", "Sound engineer and technical staff"],
  ["Equipo de audio profesional", "Professional sound system"],
  ["Equipo de audio básica", "Basic sound system"],
  ["Equipo de iluminación básica", "Basic lighting system"],
  ["Iluminación básica", "Basic lighting"],
  ["Viáticos", "Travel expenses"],
  ["Batucada NEON", "NEON percussion show"],
  ["Batucada", "Percussion show"],
  ["percusiones", "percussionists"],
  ["Batucada NEON (4 percusiones) (1 hora)", "NEON percussion show (4 performers) (1 hour)"],
  ["Batucada (4 percusiones) (1 hora)", "Percussion show (4 performers) (1 hour)"],
  ["Personaje con Rótulo LED", "Character with LED sign"],
  ["Botellas LED personalizadas con pirotecnia fría", "Customized LED bottles with cold spark effects"],
  ["Personajes cabezones (1 hora)", "Costumed characters (1 hour)"],
  ["Pistola LED CO2", "LED CO2 cannon"],
  ["Pianista con Piano de cola Blanco (1 hora)", "Pianist with white grand piano (1 hour)"],
  ["Violín Eléctrico", "Electric violin"],
  ['Bus de shots "Chiken Buss"', 'Shot bus "Chiken Buss"'],
  ["Par LED para Matiz", "LED PAR light for color wash"],
  ["Montaje 1 día antes del evento", "Setup 1 day before the event"],
  ["Desmontaje 1 día después del evento", "Teardown 1 day after the event"],
  ["Hora Extra DJ", "Additional DJ hour"],
  ["Hora Extra Generador Electrico", "Additional Electric Generator Hour"],
  ["Animador", "Event host"],
  ["Pista de Baile Led", "LED dance floor"],
  ["Carrito de Shots", "Shot cart"],
  ["Máquina de Confeti", "Confetti machine"],
  ["Servicio de Grabación de Video", "Video recording service"],
  ["Pirotecnia Fría", "Cold spark effects"],
  ["Color de confeti sujeto a disponibilidad de color.", "Confetti color subject to color availability."],
  ["Celular con Playlist", "Phone with playlist"],
  ["Pantalla LED", "LED screen"],
  ["Pista de Baile", "Dance floor"],
  ["Decoración para Pista de Baile", "Dance floor decoration"],
  ["Tarima", "Stage"],
  ["Toldo", "Canopy"],
  ["hora", "hour"],
  ["horas", "hours"]
];

function translateQuoteText(value) {
  const text = String(value || "");
  if (quoteLanguage !== "en") return text;
  if (englishQuoteText.has(text)) return englishQuoteText.get(text);

  return englishPhraseReplacements.reduce(
    (translated, [spanish, english]) => translated.split(spanish).join(english),
    text
  );
}

function normalizePackageMeasurements(measurements) {
  if (!Array.isArray(measurements)) return [];
  return measurements.map((entry) => {
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      return {
        qty: String(entry.qty ?? "1"),
        value: String(entry.value ?? "")
      };
    }
    return {
      qty: "1",
      value: String(entry ?? "")
    };
  });
}

function normalizePackageItemMeta(meta) {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? { ...meta } : {};
}

function clonePackageItems(items) {
  return (items || []).map((item) => {
    const [qty, description, price, measurements, meta] = Array.isArray(item) ? item : [];
    return [
      String(qty ?? ""),
      String(description ?? ""),
      price,
      normalizePackageMeasurements(measurements),
      normalizePackageItemMeta(meta)
    ];
  });
}

function isScreenLedItem(description) {
  const normalized = normalizedSearchText(description);
  return normalized.includes("pantalla led") || normalized.includes("led screen");
}

function isPackageSectionItem(item) {
  return normalizePackageItemMeta(item?.[4]).type === "section";
}

function isPackageSubtotalItem(item) {
  const metaType = normalizePackageItemMeta(item?.[4]).type;
  if (metaType === "subtotal") return true;
  const normalizedDescription = normalizedSearchText(item?.[1]).replace(/\s+/g, "");
  return normalizedDescription === "subtotal";
}

function isPackageTotalItem(item) {
  return normalizePackageItemMeta(item?.[4]).type === "total";
}

function packageUsesItemPrices(pkg) {
  return Boolean(pkg.pricedItems) || pkg.id === "ninguno";
}

function packageItemDescription(item) {
  const [, description, , measurements = []] = item;
  const cleanMeasurements = normalizePackageMeasurements(measurements)
    .map((entry) => entry.value.trim())
    .filter(Boolean);
  if (isPackageSectionItem(item)) return description;
  if (isScreenLedItem(description) && cleanMeasurements.length) {
    const label = quoteLanguage === "en" ? "Measurements" : "Medidas";
    return `${description} - ${label}: ${cleanMeasurements.join(", ")}`;
  }
  return description;
}

function defaultPackageItemsForLanguage(pkg) {
  return clonePackageItems(pkg.items).map(([qty, description, price, measurements, meta]) => [
    qty,
    translateQuoteText(description),
    price,
    measurements,
    meta
  ]);
}

function packageDisplayName(pkg) {
  const customName = packageNameOverrides.get(pkg.id);
  if (customName !== undefined && String(customName).trim()) return String(customName).trim();
  return translateQuoteText(pkg.name);
}

function isDefaultNonePackageTitle(pkg) {
  if (pkg.id !== "ninguno") return false;
  const customName = packageNameOverrides.get(pkg.id);
  if (customName === undefined) return true;
  const normalized = normalizedSearchText(customName).replace(/\s+/g, "");
  return !normalized || normalized === "ninguno" || normalized === "none";
}

function packageDisplayPriceValue(pkg) {
  const customPrice = packagePriceOverrides.get(pkg.id);
  if (customPrice !== undefined) {
    const price = Number.parseFloat(customPrice);
    return Number.isFinite(price) && price >= 0 ? price : 0;
  }
  const price = Number.parseFloat(pkg.price);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function packageItemPrice(item) {
  const price = Number.parseFloat(item?.[2]);
  return Number.isFinite(price) && price >= 0 ? price : 0;
}

function packageItemsTotal(pkg) {
  if (pkg.hideTotal) return packageDisplayPriceValue(pkg);
  return packageDisplayItems(pkg).reduce((sum, item) => {
    if (isPackageSectionItem(item) || isPackageTotalItem(item)) return sum;
    return sum + packageItemPrice(item);
  }, 0);
}

function packageItemPriceLabel(value) {
  const price = Number.parseFloat(value);
  return Number.isFinite(price) && price > 0 ? formatMoney(price) : "-------";
}

function packageItemDisplayRows(pkg) {
  const includePrices = packageUsesItemPrices(pkg);
  const rows = [];

  packageDisplayItems(pkg).forEach((item) => {
    const [qty, description, itemPrice, measurements = []] = item;
    if (isPackageTotalItem(item)) {
      rows.push({
        type: "total",
        description: quoteLanguage === "en" ? "TOTAL" : "TOTAL",
        price: packageItemsTotal(pkg)
      });
      return;
    }

    if (isPackageSectionItem(item)) {
      rows.push({ type: "section", description });
      return;
    }

    if (isPackageSubtotalItem(item)) {
      rows.push({
        type: "subtotal",
        qty: "",
        description: quoteLanguage === "en" ? "SUBTOTAL" : "SUB TOTAL",
        price: packageItemPrice(item)
      });
      return;
    }

    const price = packageItemPrice(item);
    const ledMeasurements = normalizePackageMeasurements(measurements).filter((entry) =>
      entry.value.trim()
    );

    if (isScreenLedItem(description) && ledMeasurements.length) {
      ledMeasurements.forEach((entry, index) => {
        rows.push({
          type: "item",
          qty: entry.qty || "1",
          description: `${description} - ${entry.value.trim()}`,
          price: index === 0 ? price : null
        });
      });
    } else {
      rows.push({
        type: "item",
        qty,
        description: packageItemDescription(item),
        price
      });
    }

  });
  return rows;
}

function packageDisplayPrice(pkg) {
  if (packageUsesItemPrices(pkg) && !pkg.hideTotal) return packageItemsTotal(pkg);
  return packageDisplayPriceValue(pkg);
}

function packageDisplayItems(pkg) {
  const customItems = packageItemOverrides.get(pkg.id);
  return customItems ? clonePackageItems(customItems) : defaultPackageItemsForLanguage(pkg);
}

function packageEditorItems(pkg) {
  const customItems = packageItemOverrides.get(pkg.id);
  return customItems ? clonePackageItems(customItems) : defaultPackageItemsForLanguage(pkg);
}

function setPackageNameOverride(packageId, value) {
  const text = String(value || "").trim();
  if (text) packageNameOverrides.set(packageId, text);
  else packageNameOverrides.delete(packageId);
}

function setPackagePriceOverride(packageId, value) {
  const price = Math.max(0, Number.parseFloat(value) || 0);
  packagePriceOverrides.set(packageId, String(price));
}

function setPackageItemsOverride(packageId, rows) {
  packageItemOverrides.set(
    packageId,
    rows.map(([qty, description, price, measurements, meta]) => [
      String(qty ?? ""),
      String(description ?? ""),
      price,
      normalizePackageMeasurements(measurements),
      normalizePackageItemMeta(meta)
    ])
  );
}

function insertBeforePackageTotal(rows, row) {
  const totalIndex = rows.findIndex((item) => isPackageTotalItem(item));
  if (totalIndex === -1) rows.push(row);
  else rows.splice(totalIndex, 0, row);
}

function todayIso() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function parseStoredNumber(value) {
  const text = String(value || "").trim();
  if (!/^\d+$/.test(text)) return null;

  try {
    const number = BigInt(text);
    return number >= quoteSequenceStart ? number : null;
  } catch {
    return null;
  }
}

function cleanManualQuoteNumber(value) {
  return String(value || "").replace(/\D/g, "").trim();
}

function quoteNumberValue() {
  return cleanManualQuoteNumber(elements.fields.quoteNumber.value) || currentQuoteNumber.toString();
}

function setQuoteNumberInput(value) {
  elements.fields.quoteNumber.value = cleanManualQuoteNumber(value) || currentQuoteNumber.toString();
}

function formatCodeDate(dateValue) {
  const [year, month, day] = (dateValue || todayIso()).split("-");
  return `${day}-${month}-${year}`;
}

function quoteCode() {
  return `${quoteNumberValue()}-${formatCodeDate(currentQuoteDate)}`;
}

function storeQuoteSequence() {
  writeStoredValue(quoteStorageKeys.currentNumber, currentQuoteNumber.toString());
  writeStoredValue(quoteStorageKeys.currentDate, currentQuoteDate);
}

function initializeQuoteSequence() {
  currentQuoteNumber =
    parseStoredNumber(readStoredValue(quoteStorageKeys.currentNumber)) || quoteSequenceStart;
  currentQuoteDate = readStoredValue(quoteStorageKeys.currentDate) || todayIso();
  setQuoteNumberInput(currentQuoteNumber.toString());
  storeQuoteSequence();
}

function startNewQuoteSequence() {
  currentQuoteDate = todayIso();
  setQuoteNumberInput(currentQuoteNumber.toString());
  storeQuoteSequence();
}

function shouldStartNewQuoteFromUrl() {
  return new URLSearchParams(window.location.search).get("new") === "1";
}

function quoteNumberFromUrl() {
  return parseStoredNumber(new URLSearchParams(window.location.search).get("correlativo"));
}

function cleanNewQuoteUrl() {
  if (!window.history?.replaceState) return;
  window.history.replaceState(null, "", window.location.pathname);
}

function setQuoteSequence(number) {
  currentQuoteNumber = number;
  currentQuoteDate = todayIso();
  setQuoteNumberInput(currentQuoteNumber.toString());
  storeQuoteSequence();
}

function clearEditingQuote() {
  editingQuoteId = null;
}

function setEditingQuote(record) {
  editingQuoteId = Number(record?.id) || null;
}

async function startFreshQuoteSequence() {
  clearEditingQuote();
  if (isLocalServerAvailable() && !requestedQuoteNumber && !batchState.started) {
    const number = await fetchNextQuoteNumber();
    setQuoteSequence(number);
    return;
  }

  startNewQuoteSequence();
}

function cleanFilePart(value, fallback) {
  const cleanValue = String(value || "")
    .trim()
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ");
  return cleanValue || fallback;
}

function titleCaseText(value) {
  return String(value || "")
    .toLocaleLowerCase("es-GT")
    .replace(/(^|[\s/-])([a-záéíóúñü])/gi, (match, prefix, letter) => {
      return `${prefix}${letter.toLocaleUpperCase("es-GT")}`;
    })
    .replace(/\bDj\b/g, "DJ")
    .replace(/\bLed\b/g, "LED")
    .replace(/\bCo2\b/g, "CO2")
    .replace(/\bNeon\b/g, "NEON");
}

function fileServiceName() {
  const pkg = currentPackage();
  if (pkg.id !== "ninguno") return titleCaseText(packageDisplayName(pkg));

  const selected = currentExtrasList()
    .map(normalizeExtra)
    .filter((extra) => selectedExtras.has(extra.id));

  if (selected.length === 1) return titleCaseText(selected[0].description);
  return "Extras";
}

function buildPdfFileName() {
  const client = cleanFilePart(elements.fields.clientName.value, "nombre del cliente");
  const phone = cleanFilePart(elements.fields.clientPhone.value, "numero telefonico");
  const service = cleanFilePart(fileServiceName(), "servicio");
  return `Coti-${quoteNumberValue()}-${service}-${client}-${phone}.pdf`;
}

function setDriveStatus(message, type = "") {
  elements.driveSaveStatus.textContent = message;
  elements.driveSaveStatus.classList.toggle("is-error", type === "error");
  elements.driveSaveStatus.classList.toggle("is-success", type === "success");
}

function setLocalFolderStatus(message, type = "") {
  if (!elements.localFolderStatus) return;
  elements.localFolderStatus.textContent = message;
  elements.localFolderStatus.classList.toggle("is-error", type === "error");
  elements.localFolderStatus.classList.toggle("is-success", type === "success");
}

function isPreferredLocalPdfFolderName(folderName) {
  return normalizedSearchText(folderName) === normalizedSearchText(preferredLocalPdfFolderName);
}

function absoluteAppUrl(pathOrUrl) {
  if (!pathOrUrl) return "";
  try {
    return new URL(pathOrUrl, window.location.origin).href;
  } catch {
    return String(pathOrUrl || "");
  }
}

function whatsappPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 8) return `502${digits}`;
  if (digits.startsWith("00")) return digits.slice(2);
  return digits;
}

function openPdf(record) {
  if (record.pdfUrl) window.open(absoluteAppUrl(record.pdfUrl), "_blank", "noopener");
}

const localPdfFolderDbName = "cotizador-live-local-pdf-folder";
const localPdfFolderStoreName = "handles";
const localPdfFolderKey = "pdf-folder";
const preferredLocalPdfFolderName = "Cotizaciones liveproductionsgt";

function openLocalPdfFolderDb() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Este navegador no permite recordar carpetas locales."));
      return;
    }

    const request = window.indexedDB.open(localPdfFolderDbName, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(localPdfFolderStoreName);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("No se pudo abrir el almacenamiento local."));
  });
}

async function readLocalPdfFolderHandle() {
  const db = await openLocalPdfFolderDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localPdfFolderStoreName, "readonly");
    const request = transaction.objectStore(localPdfFolderStoreName).get(localPdfFolderKey);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error("No se pudo leer la carpeta local."));
  });
}

async function writeLocalPdfFolderHandle(handle) {
  const db = await openLocalPdfFolderDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(localPdfFolderStoreName, "readwrite");
    const request = transaction.objectStore(localPdfFolderStoreName).put(handle, localPdfFolderKey);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("No se pudo guardar la carpeta local."));
  });
}

async function ensureWritableFolderHandle(handle) {
  if (!handle) return null;
  if (typeof handle.queryPermission === "function") {
    const currentPermission = await handle.queryPermission({ mode: "readwrite" });
    if (currentPermission === "granted") return handle;
  }
  if (typeof handle.requestPermission === "function") {
    const requestedPermission = await handle.requestPermission({ mode: "readwrite" });
    if (requestedPermission === "granted") return handle;
  }
  return null;
}

async function chooseLocalPdfFolder(setStatus = setDriveStatus, button = null) {
  if (!window.showDirectoryPicker) {
    setStatus("Este navegador no permite elegir carpeta. Use Chrome o Edge en computadora.", "error");
    return null;
  }

  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Eligiendo...";
  }

  try {
    setStatus(`Seleccione Documentos > ${preferredLocalPdfFolderName}.`);
    const directoryHandle = await window.showDirectoryPicker({
      id: "cotizaciones-liveproductionsgt",
      mode: "readwrite",
      startIn: "documents"
    });
    const writableHandle = await ensureWritableFolderHandle(directoryHandle);
    if (!writableHandle) throw new Error("No se otorgó permiso para guardar en esa carpeta.");
    const folderName = writableHandle.name || "";
    if (!isPreferredLocalPdfFolderName(folderName)) {
      throw new Error(`Seleccione la carpeta exacta: ${preferredLocalPdfFolderName}.`);
    }
    await writeLocalPdfFolderHandle(writableHandle);
    setLocalFolderStatus(`Carpeta configurada: ${folderName}.`, "success");
    setStatus(`Carpeta local configurada: ${folderName}.`, "success");
    return writableHandle;
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Selección de carpeta cancelada.", "error");
      return null;
    }
    setStatus(error.message || "No se pudo configurar la carpeta local.", "error");
    return null;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || "Elegir carpeta";
    }
  }
}

function downloadPdfFile(record) {
  if (!record.pdfUrl) return false;
  const link = document.createElement("a");
  link.href = absoluteAppUrl(record.pdfUrl);
  link.download = record.fileName || buildPdfFileName();
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}

function editableQuoteFileName(record) {
  const pdfName = cleanFilePart(record?.fileName || buildPdfFileName(), "cotizacion.pdf");
  return pdfName.replace(/\.pdf$/i, "") + ".cotizacion-live.json";
}

async function editableQuotePayload(record) {
  let quoteData = record?.quoteData || null;
  let sourceRecord = record || {};

  if (!quoteData && record?.id) {
    const result = await apiRequest(`/api/cotizaciones/${record.id}`, {
      method: "GET",
      headers: {}
    });
    quoteData = result.quoteData || null;
    sourceRecord = { ...sourceRecord, ...(result.record || {}) };
  }

  if (!quoteData) {
    const possibleQuoteNumber = parseStoredNumber(record?.quoteNumber);
    if (possibleQuoteNumber) quoteData = { ...record, quoteNumber: possibleQuoteNumber.toString() };
  }

  if (!quoteData?.quoteNumber) {
    throw new Error("No se encontró la información editable de esta cotización.");
  }

  return {
    type: "live-productions-quote",
    version: 1,
    savedAt: new Date().toISOString(),
    quoteId: Number(sourceRecord.id || record?.id) || null,
    quoteNumber: String(quoteData.quoteNumber || sourceRecord.quoteNumber || ""),
    fileName: sourceRecord.fileName || record?.fileName || "",
    pdfUrl: sourceRecord.pdfUrl || record?.pdfUrl || "",
    quoteData
  };
}

async function writeEditableQuoteToDirectory(record, directoryHandle) {
  const payload = await editableQuotePayload(record);
  const fileHandle = await directoryHandle.getFileHandle(editableQuoteFileName(record), { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
  );
  await writable.close();
  return payload;
}

async function downloadEditableQuoteFile(record) {
  const payload = await editableQuotePayload(record);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" })
  );
  link.download = editableQuoteFileName(record);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  return true;
}

async function writePdfRecordToDirectory(record, directoryHandle, setStatus = null) {
  const fileName = record.fileName || buildPdfFileName();
  const response = await fetch(absoluteAppUrl(record.pdfUrl), { credentials: "same-origin" });
  if (!response.ok) throw new Error("No se pudo descargar el PDF guardado.");
  const pdfBlob = await response.blob();
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(pdfBlob);
  await writable.close();
  await writeEditableQuoteToDirectory({ ...record, fileName }, directoryHandle);

  if (setStatus) {
    const folderName = directoryHandle.name || "carpeta elegida";
    setStatus(`PDF y editable guardados en ${folderName}: ${fileName}`, "success");
  }
  return true;
}

async function configuredLocalPdfFolderHandle() {
  if (!window.showDirectoryPicker) return null;
  let directoryHandle = await readLocalPdfFolderHandle().catch(() => null);
  directoryHandle = await ensureWritableFolderHandle(directoryHandle);
  if (!directoryHandle) return null;
  const folderName = directoryHandle.name || "";
  return isPreferredLocalPdfFolderName(folderName) ? directoryHandle : null;
}

async function refreshLocalFolderStatus() {
  if (!window.showDirectoryPicker) {
    setLocalFolderStatus("Use Chrome o Edge para guardar directo en carpeta.", "error");
    return;
  }

  const directoryHandle = await configuredLocalPdfFolderHandle().catch(() => null);
  if (!directoryHandle) {
    setLocalFolderStatus(`Carpeta pendiente: ${preferredLocalPdfFolderName}.`);
    return;
  }

  const folderName = directoryHandle.name || preferredLocalPdfFolderName;
  if (!isPreferredLocalPdfFolderName(folderName)) {
    setLocalFolderStatus(`Vuelva a elegir la carpeta exacta: ${preferredLocalPdfFolderName}.`, "error");
    return;
  }

  setLocalFolderStatus(`Carpeta configurada: ${folderName}.`, "success");
}

async function savePdfOnConfiguredComputer(record, setStatus = null) {
  if (!record?.pdfUrl) return false;
  try {
    let directoryHandle = await configuredLocalPdfFolderHandle();
    if (!directoryHandle && setStatus) {
      directoryHandle = await chooseLocalPdfFolder(setStatus);
    }
    if (!directoryHandle) return false;
    return await writePdfRecordToDirectory(record, directoryHandle, setStatus);
  } catch (error) {
    if (setStatus) {
      setStatus(
        `La cotización quedó guardada en la web, pero no se pudo copiar a la carpeta local: ${error.message}`,
        "error"
      );
    }
    return false;
  }
}

async function savePdfOnThisComputer(record, setStatus = setDriveStatus, button = null) {
  if (!record.pdfUrl) {
    setStatus("Esta cotización no tiene PDF para guardar en la computadora.", "error");
    return false;
  }

  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Guardando...";
  }
  setStatus("Preparando descarga del PDF...");

  try {
    const fileName = record.fileName || buildPdfFileName();

    if (!window.showDirectoryPicker) {
      downloadPdfFile(record);
      await downloadEditableQuoteFile(record);
      setStatus(
        `PDF y editable descargados. Para guardarlos directo en Documentos > ${preferredLocalPdfFolderName}, use Chrome o Edge en computadora.`,
        "success"
      );
      return true;
    }

    let directoryHandle = await readLocalPdfFolderHandle().catch(() => null);
    directoryHandle = await ensureWritableFolderHandle(directoryHandle);

    if (!directoryHandle) {
      directoryHandle = await chooseLocalPdfFolder(setStatus);
      if (!directoryHandle) return false;
    }

    return await writePdfRecordToDirectory({ ...record, fileName }, directoryHandle, setStatus);
  } catch (error) {
    if (error?.name === "AbortError") {
      setStatus("Guardado local cancelado. El PDF sigue disponible en el historial.", "error");
      return false;
    }
    setStatus(error.message || "No se pudo guardar el PDF en esta computadora.", "error");
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || "Guardar en computadora";
    }
  }
}

async function findQuoteRecordByNumber(quoteNumber) {
  if (!isLocalServerAvailable() || !quoteNumber) return null;
  const params = new URLSearchParams({ search: String(quoteNumber) });
  const result = await apiRequest(`/api/cotizaciones?${params.toString()}`, {
    method: "GET",
    headers: {}
  });
  return (result.records || []).find((record) => String(record.quoteNumber || "") === String(quoteNumber)) || null;
}

async function loadEditableQuoteFile(file) {
  if (!file) return;

  try {
    const text = await file.text();
    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(
        "Ese archivo no es editable. El PDF solo se abre para ver; para modificar use el archivo .cotizacion-live.json guardado junto al PDF."
      );
    }

    const quoteData = payload.quoteData || payload;
    const quoteNumber = String(quoteData.quoteNumber || payload.quoteNumber || "").trim();
    if (!quoteNumber || !quoteData.packageId) {
      throw new Error("El archivo no contiene una cotización editable de Live Productions.");
    }

    let quoteId = Number(payload.quoteId || payload.id) || null;
    let record = quoteId ? { id: quoteId, quoteNumber } : null;
    if (!quoteId) {
      record = await findQuoteRecordByNumber(quoteNumber);
      quoteId = Number(record?.id) || null;
    }

    if (quoteId) setEditingQuote({ id: quoteId, quoteNumber });
    else clearEditingQuote();

    applyQuoteData(quoteData);
    clearLastSavedActions();
    const message = quoteId
      ? `Cotización ${quoteNumber} cargada editable. Al guardar se actualizará el mismo correlativo.`
      : `Cotización ${quoteNumber} cargada, pero no se encontró en el historial web. Busque ese correlativo en Historial para actualizar el mismo registro.`;
    setDriveStatus(message, quoteId ? "success" : "error");
    setHistoryStatus(message, quoteId ? "success" : "error");
  } catch (error) {
    const message = error.message || "No se pudo abrir la cotización editable.";
    setDriveStatus(message, "error");
    setHistoryStatus(message, "error");
  } finally {
    if (elements.editableQuoteFileInput) elements.editableQuoteFileInput.value = "";
  }
}

async function sendWhatsappPdf(record, setStatus = setHistoryStatus, button = null) {
  if (!record.pdfUrl) {
    setStatus("Esta cotización no tiene PDF para enviar por WhatsApp.", "error");
    return;
  }

  if (!record.id) {
    setStatus("Primero guarde la cotización para poder enviar el PDF por WhatsApp.", "error");
    return;
  }

  let phone = whatsappPhone(record.clientPhone);
  if (!phone) {
    const typedPhone = window.prompt("Ingrese el número de WhatsApp del cliente con código de país:");
    phone = whatsappPhone(typedPhone);
  }

  if (!phone) {
    setStatus("Envío cancelado. No se indicó número de WhatsApp.", "error");
    return;
  }

  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Enviando PDF...";
  }
  setStatus("Enviando PDF por WhatsApp...");

  try {
    const result = await apiRequest(`/api/cotizaciones/${record.id}/whatsapp`, {
      method: "POST",
      body: JSON.stringify({ phone })
    });
    setStatus(`PDF enviado por WhatsApp a +${result.phone || phone}.`, "success");
    return true;
  } catch (error) {
    setStatus(error.message, "error");
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || "Enviar PDF";
    }
  }
}

function buttonElement(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button";
  button.textContent = text;
  button.addEventListener("click", (event) => onClick(event, button));
  return button;
}

function clearLastSavedActions() {
  clearNode(elements.lastSavedActions);
  elements.lastSavedActions.classList.add("is-hidden");
}

function renderLastSavedActions(record) {
  clearNode(elements.lastSavedActions);
  elements.lastSavedActions.append(
    buttonElement("Abrir PDF", () => openPdf(record)),
    buttonElement("Elegir carpeta", (event, button) => chooseLocalPdfFolder(setDriveStatus, button)),
    buttonElement("Guardar en computadora", (event, button) => savePdfOnThisComputer(record, setDriveStatus, button)),
    buttonElement("Enviar PDF por WhatsApp", (event, button) => sendWhatsappPdf(record, setDriveStatus, button))
  );
  elements.lastSavedActions.classList.remove("is-hidden");
}

async function deleteQuoteFromHistory(record) {
  const confirmed = window.confirm(
    `¿Estás totalmente seguro que deseas eliminar esta cotización?\n\n${historySummary(record)}`
  );
  if (!confirmed) return;

  try {
    setHistoryStatus("Eliminando cotización...");
    const result = await apiRequest(`/api/cotizaciones/${record.id}`, {
      method: "DELETE",
      headers: {}
    });

    if (editingQuoteId === Number(record.id)) {
      await resetQuote();
    }

    setHistoryStatus(`Cotización ${record.quoteNumber || result.id} eliminada.`, "success");
    fetchHistory(elements.historySearch.value.trim());
  } catch (error) {
    setHistoryStatus(error.message, "error");
  }
}

function readCssText() {
  if (pdfCssTextCache) return pdfCssTextCache;
  pdfCssTextCache = [...document.styleSheets]
    .map((sheet) => {
      try {
        return [...sheet.cssRules].map((rule) => rule.cssText).join("\n");
      } catch {
        return "";
      }
    })
    .join("\n");
  return pdfCssTextCache;
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function imageToDataUri(img) {
  const source = img.currentSrc || img.src || img.getAttribute("src") || "";
  if (!source || source.startsWith("data:")) return source;

  if (!pdfImageDataUriCache.has(source)) {
    pdfImageDataUriCache.set(
      source,
      (async () => {
        try {
          const response = await fetch(source);
          if (response.ok) return blobToDataUri(await response.blob());
        } catch {
          // Local file pages can block fetch; canvas below is the fallback.
        }

        try {
          if (img.complete && img.naturalWidth) {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            canvas.getContext("2d").drawImage(img, 0, 0);
            return canvas.toDataURL("image/png");
          }
        } catch {
          // Keep the original source if neither conversion route is available.
        }

        return source;
      })()
    );
  }

  return pdfImageDataUriCache.get(source);
}

function warmPdfAssets() {
  readCssText();
  const images = [...document.querySelectorAll("#quoteDocument img")];
  Promise.all(images.map((image) => imageToDataUri(image))).catch(() => {});
}

async function buildPdfHtml() {
  const quoteClone = document.querySelector("#quoteDocument").cloneNode(true);
  const originalImages = [...document.querySelectorAll("#quoteDocument img")];
  const clonedImages = [...quoteClone.querySelectorAll("img")];
  const imageSources = await Promise.all(originalImages.map((image) => imageToDataUri(image)));
  clonedImages.forEach((image, index) => {
    if (imageSources[index]) image.src = imageSources[index];
  });
  quoteClone.querySelectorAll(".quote-page.is-hidden").forEach((page) => page.remove());

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <style>
      ${readCssText()}
      @page { size: 8.5in 13in; margin: 0.18in; }
      html, body {
        width: 8.5in;
        min-height: 13in;
        background: #ffffff;
        margin: 0;
        padding: 0;
        overflow: visible;
      }
      body.pdf-export { display: block !important; }
      body.pdf-export #quoteDocument,
      body.pdf-export .quote-document-set {
        display: block !important;
        width: 100% !important;
        max-width: none !important;
        gap: 0 !important;
        visibility: visible !important;
        opacity: 1 !important;
      }
      body.pdf-export .quote-document {
        display: block !important;
        width: 100% !important;
        height: 12.62in;
        min-height: 12.62in;
        box-sizing: border-box;
        box-shadow: none !important;
        overflow: hidden;
        visibility: visible !important;
        opacity: 1 !important;
      }
      body.pdf-export .quote-page-content,
      body.pdf-export img {
        visibility: visible !important;
        opacity: 1 !important;
      }
    </style>
  </head>
  <body class="pdf-export">
    ${quoteClone.outerHTML}
    <script>
      (() => {
        const fitMainPage = () => {
          const page = document.querySelector(".quote-main-page");
          const content = page?.querySelector(".quote-page-content");
          if (!page || !content) return;
          content.style.width = "100%";
          content.style.transform = "none";
          const pageStyle = getComputedStyle(page);
          const availableHeight =
            page.clientHeight -
            parseFloat(pageStyle.paddingTop) -
            parseFloat(pageStyle.paddingBottom);
          const contentHeight = content.scrollHeight;
          const scale = Math.min(1, availableHeight / Math.max(contentHeight, 1));
          if (scale < 1) {
            content.style.width = (100 / scale) + "%";
            content.style.transform = "scale(" + scale + ")";
          }
        };
        window.addEventListener("load", () => requestAnimationFrame(fitMainPage));
      })();
    </script>
  </body>
</html>`;
}

function resetPrintFit() {
  const content = document.querySelector(".quote-main-page .quote-page-content");
  if (!content) return;
  content.style.width = "";
  content.style.transform = "";
  document.body.classList.remove("manual-print-fit");
}

function fitMainPageForPrint() {
  const page = document.querySelector(".quote-main-page");
  const content = page?.querySelector(".quote-page-content");
  if (!page || !content) return;

  content.style.width = "100%";
  content.style.transform = "none";
  const pageStyle = getComputedStyle(page);
  const availableHeight =
    page.clientHeight -
    parseFloat(pageStyle.paddingTop) -
    parseFloat(pageStyle.paddingBottom);
  const scale = Math.min(1, availableHeight / Math.max(content.scrollHeight, 1));
  if (scale < 1) {
    content.style.width = `${100 / scale}%`;
    content.style.transform = `scale(${scale})`;
  }
}

function printQuote() {
  document.body.classList.add("manual-print-fit");
  requestAnimationFrame(() => {
    fitMainPageForPrint();
    requestAnimationFrame(() => window.print());
  });
}

function isLocalServerAvailable() {
  return window.location.protocol === "http:" || window.location.protocol === "https:";
}

async function readApiJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) showLogin("Inicie sesión para continuar.");
    const detail = Array.isArray(data.detail)
      ? data.detail.map((item) => item?.msg || item?.message || String(item)).join(" ")
      : data.detail;
    throw new Error(data.error || detail || "No se pudo completar la operación.");
  }
  return data;
}

async function apiRequest(path, options = {}) {
  if (!isLocalServerAvailable()) {
    throw new Error("Abra el cotizador con la app local o ejecute node server.js para guardar y buscar historial.");
  }

  const headers = { ...(options.headers || {}) };
  const hasBody =
    Object.prototype.hasOwnProperty.call(options, "body") &&
    options.body !== undefined &&
    options.body !== null;
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  if (hasBody && !hasContentType) headers["Content-Type"] = "application/json";

  const response = await fetch(path, { ...options, headers });
  return readApiJson(response);
}

function setActivePage(page) {
  const validPage = elements.sitePages.some((section) => section.dataset.page === page)
    ? page
    : "cotizador";
  elements.sitePages.forEach((section) => {
    section.classList.toggle("is-active", section.dataset.page === validPage);
  });
  elements.siteMenuButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.pageLink === validPage);
  });
  if (window.location.hash !== `#${validPage}`) {
    window.history.replaceState(null, "", `#${validPage}`);
  }
  setMenuOpen(false);
}

function setMenuOpen(isOpen) {
  if (!elements.siteSideMenu || !elements.menuBackdrop || !elements.menuToggleButton) return;
  elements.siteSideMenu.classList.toggle("is-open", isOpen);
  elements.menuBackdrop.classList.toggle("is-hidden", !isOpen);
  elements.menuToggleButton.setAttribute("aria-expanded", String(isOpen));
  elements.menuToggleButton.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
}

function toggleMenu() {
  const isOpen = elements.siteSideMenu?.classList.contains("is-open");
  setMenuOpen(!isOpen);
}

function showLogin(message = "") {
  elements.siteApp.classList.add("is-hidden");
  elements.loginView.classList.remove("is-hidden");
  elements.loginStatus.textContent = message;
  elements.loginPassword.value = "";
  window.setTimeout(() => elements.loginUser.focus(), 50);
}

function showApp() {
  elements.loginView.classList.add("is-hidden");
  elements.siteApp.classList.remove("is-hidden");
  const requestedPage = window.location.hash.replace("#", "");
  setActivePage(requestedPage || "cotizador");
  loadSharedRequirementsBoard();
  startRequirementsRefreshTimer();
}

async function submitLogin(event) {
  event.preventDefault();
  elements.loginStatus.textContent = "Validando acceso...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: elements.loginUser.value,
        password: elements.loginPassword.value
      })
    });
    await readApiJson(response);
    elements.loginStatus.textContent = "";
    showApp();
    startQuoteApp();
  } catch (error) {
    elements.loginStatus.textContent = error.message;
  }
}

async function logout() {
  await fetch("/api/logout", { method: "POST" }).catch(() => {});
  showLogin("Sesión cerrada.");
}

function selectedExtrasForQuote() {
  const selected = currentExtrasList()
    .map(normalizeExtra)
    .filter((extra) => selectedExtras.has(extra.id));
  const customExtras = manualExtras().filter(
    (extra) => selectedExtras.has(extra.id) && extraManualDescription(extra.id)
  );
  selected.unshift(...customExtras);
  return selected;
}

function calculateTotals(pkg, selected) {
  const extrasTotal = selected.reduce((sum, extra) => sum + extraTotalPrice(extra), 0);
  const packageTotal = packageDisplayPrice(pkg);
  const subtotal = packageTotal + extrasTotal;
  const discountTotal = includeDiscount ? Math.min(readMoneyInput(elements.discountAmount), subtotal) : 0;
  const taxableTotal = Math.max(0, subtotal - discountTotal);
  const vatTotal = includeVat ? roundMoney(taxableTotal * vatRate) : 0;
  return {
    packageTotal,
    extrasTotal,
    subtotal,
    discountTotal,
    taxableTotal,
    vatTotal,
    grandTotal: taxableTotal + vatTotal
  };
}

function buildQuoteData() {
  const pkg = currentPackage();
  const selected = selectedExtrasForQuote();
  const totals = calculateTotals(pkg, selected);
  return {
    quoteNumber: quoteNumberValue(),
    quoteDate: currentQuoteDate,
    quoteCode: quoteCode(),
    fileName: buildPdfFileName(),
    clientName: elements.fields.clientName.value.trim(),
    clientPhone: elements.fields.clientPhone.value.trim(),
    eventName: elements.fields.eventName.value.trim(),
    eventDate: elements.fields.eventDate.value,
    groupSchedule: elements.fields.groupSchedule.value.trim(),
    eventPlace: elements.fields.eventPlace.value.trim(),
    guestCount: elements.fields.guestCount.value,
    packageId: pkg.id,
    packageName: packageDisplayName(pkg),
    packagePrice: packageDisplayPrice(pkg),
    packageItems: packageDisplayItems(pkg),
    packageNameOverrides: Object.fromEntries(packageNameOverrides),
    packagePriceOverrides: Object.fromEntries(packagePriceOverrides),
    packageItemOverrides: Object.fromEntries(packageItemOverrides),
    selectedExtraIds: [...selectedExtras],
    extraQuantities: Object.fromEntries(extraQuantities),
    extraPrices: Object.fromEntries(extraPrices),
    extraDimensions: Object.fromEntries(extraDimensions),
    extraManualDescriptions: Object.fromEntries(extraManualDescriptions),
    manualExtraIds: [...manualExtraIds],
    extraComplimentary: Object.fromEntries(extraComplimentary),
    extraGeneratorDetails: Object.fromEntries(extraGeneratorDetails),
    selectedExtras: selected.map((extra) => ({
      id: extra.id,
      quantity: extraQuantity(extra),
      description: extraDescription(extra),
      unitPrice: extra.generator
        ? generatorDetails(extra).basePrice
        : isExtraComplimentary(extra)
          ? 0
          : extraPrice(extra),
      total: extraTotalPrice(extra),
      complimentary: isExtraComplimentary(extra)
    })),
    includeVat,
    includeDiscount,
    includeMountingPage,
    includeAdditionalServices,
    discountAmount: readMoneyInput(elements.discountAmount),
    language: quoteLanguage,
    currency: quoteCurrency,
    notes: elements.fields.notes.value.trim(),
    totals
  };
}

function cloneQuoteData(data) {
  return JSON.parse(JSON.stringify(data));
}

function setBatchStatus(message, type = "") {
  elements.batchStatus.textContent = message;
  elements.batchStatus.classList.toggle("is-error", type === "error");
  elements.batchStatus.classList.toggle("is-success", type === "success");
}

function batchQuoteNumber(baseNumber, index) {
  return (baseNumber + BigInt(index)).toString();
}

function assignQuoteNumber(data, number, quoteDate = todayIso()) {
  const nextData = cloneQuoteData(data);
  nextData.quoteNumber = String(number);
  nextData.quoteDate = quoteDate;
  nextData.quoteCode = `${number}-${formatCodeDate(quoteDate)}`;
  nextData.fileName = "";
  return nextData;
}

function emptyQuoteData(number, quoteDate = todayIso()) {
  const quoteNumber = String(number);
  return {
    quoteNumber,
    quoteDate,
    quoteCode: `${quoteNumber}-${formatCodeDate(quoteDate)}`,
    fileName: "",
    clientName: "",
    clientPhone: "",
    eventName: "",
    eventDate: "",
    groupSchedule: "",
    eventPlace: "",
    guestCount: "",
    packageId: "ninguno",
    packageName: "NINGUNO",
    packagePrice: 0,
    packageItems: [],
    packageNameOverrides: {},
    packagePriceOverrides: {},
    packageItemOverrides: {},
    selectedExtraIds: [],
    extraQuantities: {},
    extraPrices: {},
    extraDimensions: {},
    extraManualDescriptions: {},
    manualExtraIds: [manualExtraBaseId],
    extraComplimentary: {},
    extraGeneratorDetails: {},
    selectedExtras: [],
    includeVat: false,
    includeDiscount: false,
    includeMountingPage: false,
    includeAdditionalServices: false,
    discountAmount: 0,
    language: "es",
    currency: "Q",
    notes: "",
    totals: {
      packageTotal: 0,
      extrasTotal: 0,
      subtotal: 0,
      discountTotal: 0,
      taxableTotal: 0,
      vatTotal: 0,
      grandTotal: 0
    }
  };
}

function renderBatchHeaderState() {
  const active = batchState.started && batchState.drafts.length > 0;
  elements.batchHeaderVatButton.disabled = !active || batchState.saving;
  elements.batchSaveButton.disabled = !active || batchState.saving || batchState.saved;
  elements.batchHeaderPrintButton.disabled = !active || batchState.saving;
  elements.batchHeaderNewQuoteButton.disabled = !active || batchState.saving || batchState.saved;
  elements.batchModeButton.disabled = batchState.saving;
  elements.batchSaveButton.textContent = batchState.saved
    ? "Cotizaciones guardadas"
    : "Guardar cotización";
}

function captureActiveBatchDraft() {
  if (
    !batchState.started ||
    batchState.activeIndex < 0 ||
    batchState.suppressCapture ||
    !batchState.drafts[batchState.activeIndex]
  ) {
    return;
  }

  if (batchState.saved) {
    batchState.drafts.forEach((draft) => {
      draft.savedResult = null;
    });
    batchState.results = [];
    batchState.saved = false;
    clearNode(elements.batchSavedResults);
    elements.batchSavedResults.classList.add("is-hidden");
    renderBatchHeaderState();
  }

  batchState.drafts[batchState.activeIndex].data = cloneQuoteData(buildQuoteData());
  batchState.drafts[batchState.activeIndex].savedResult = null;
  renderBatchDraftList();
}

function renderBatchDraftList() {
  clearNode(elements.batchDraftList);
  if (!batchState.drafts.length) {
    elements.batchSequenceSummary.textContent = "";
    elements.batchCopyClientButton.classList.add("is-hidden");
    return;
  }

  const firstNumber = batchState.drafts[0].data.quoteNumber;
  const lastNumber = batchState.drafts[batchState.drafts.length - 1].data.quoteNumber;
  elements.batchSequenceSummary.textContent = `${firstNumber} a ${lastNumber}`;
  elements.batchCopyClientButton.classList.toggle("is-hidden", batchState.activeIndex !== 0);

  batchState.drafts.forEach((draft, index) => {
    const item = document.createElement("article");
    item.className = "batch-draft-item";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "batch-draft-button";
    button.classList.toggle("is-active", index === batchState.activeIndex);
    button.classList.toggle("is-saved", Boolean(draft.savedResult));

    const number = document.createElement("strong");
    number.textContent = `Cotización ${draft.data.quoteNumber}`;

    const service = document.createElement("span");
    service.textContent = draft.data.packageName || "Servicio por definir";

    const total = document.createElement("span");
    const draftPackage = packages.find((pkg) => pkg.id === draft.data.packageId);
    total.textContent = draftPackage?.hideTotal
      ? "Precios por servicio"
      : `Total ${formatMoney(draft.data.totals?.grandTotal || 0)}`;

    button.append(number, service, total);
    if (draft.savedResult) {
      const saved = document.createElement("small");
      saved.textContent = "PDF guardado";
      button.appendChild(saved);
    }
    button.addEventListener("click", () => loadBatchDraft(index));

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "batch-remove-button";
    removeButton.textContent = "×";
    removeButton.setAttribute(
      "aria-label",
      `Eliminar cotización ${draft.data.quoteNumber}`
    );
    removeButton.title = "Eliminar cotización";
    removeButton.disabled =
      batchState.saving || batchState.drafts.length <= 2 || Boolean(draft.savedResult);
    removeButton.addEventListener("click", () => removeBatchDraft(index));

    item.append(button, removeButton);
    elements.batchDraftList.appendChild(item);
  });
}

function attachAppShellToBatch() {
  if (elements.appShell.parentNode !== elements.batchEditorHost) {
    elements.batchEditorHost.appendChild(elements.appShell);
  }
}

function restoreAppShellHome() {
  if (elements.appShell.parentNode === appShellHome.parent) return;
  appShellHome.parent.insertBefore(elements.appShell, appShellHome.nextSibling);
}

function openBatchDialog() {
  if (typeof elements.batchDialog.showModal === "function" && !elements.batchDialog.open) {
    elements.batchDialog.showModal();
  } else {
    elements.batchDialog.setAttribute("open", "");
  }

  if (batchState.started) {
    elements.batchSetup.classList.add("is-hidden");
    elements.batchWorkspace.classList.remove("is-hidden");
    attachAppShellToBatch();
    renderBatchDraftList();
  } else {
    elements.batchSetup.classList.remove("is-hidden");
    elements.batchWorkspace.classList.add("is-hidden");
    elements.batchQuantity.focus();
  }
  renderBatchHeaderState();
}

function closeBatchDialog() {
  if (batchState.saving) return;
  if (!batchState.saved) captureActiveBatchDraft();
  restoreAppShellHome();
  if (typeof elements.batchDialog.close === "function") elements.batchDialog.close();
  else elements.batchDialog.removeAttribute("open");

  if (batchState.saved) {
    const nextNumber =
      parseStoredNumber(batchState.nextNumber) ||
      parseStoredNumber(readStoredValue(quoteStorageKeys.currentNumber)) ||
      currentQuoteNumber;
    clearBatchSession();
    applyQuoteData(emptyQuoteData(nextNumber, todayIso()));
    storeQuoteSequence();
  }
}

function populateBatchServiceSelect() {
  elements.batchServiceSelect.innerHTML = elements.packageSelect.innerHTML;
  elements.batchServiceSelect.value = elements.packageSelect.value;
}

async function createBatchQuotes() {
  const quantity = Math.max(2, Number.parseInt(elements.batchQuantity.value, 10) || 2);
  elements.batchQuantity.value = String(quantity);
  elements.batchCreateButton.disabled = true;
  setBatchStatus("Preparando borradores...");
  clearEditingQuote();

  try {
    const baseNumber = await fetchNextQuoteNumber();
    const quoteDate = todayIso();

    batchState.drafts = Array.from({ length: quantity }, (_, index) => ({
      data: emptyQuoteData(batchQuoteNumber(baseNumber, index), quoteDate),
      savedResult: null
    }));
    batchState.baseNumber = baseNumber;
    batchState.activeIndex = -1;
    batchState.started = true;
    batchState.saved = false;
    batchState.results = [];
    batchState.nextNumber = null;

    elements.batchSetup.classList.add("is-hidden");
    elements.batchWorkspace.classList.remove("is-hidden");
    elements.batchSavedResults.classList.add("is-hidden");
    clearNode(elements.batchSavedResults);
    attachAppShellToBatch();
    loadBatchDraft(0);
    renderBatchHeaderState();
    setBatchStatus(`${quantity} cotizaciones listas para editar.`, "success");
  } catch (error) {
    setBatchStatus(error.message, "error");
  } finally {
    elements.batchCreateButton.disabled = false;
  }
}

function addBatchDraft() {
  if (!batchState.started || batchState.saving || batchState.saved) return;
  captureActiveBatchDraft();
  const index = batchState.drafts.length;
  const number = batchQuoteNumber(batchState.baseNumber, index);
  batchState.drafts.push({
    data: emptyQuoteData(number, todayIso()),
    savedResult: null
  });
  loadBatchDraft(index);
  setBatchStatus(`Cotización ${number} agregada y lista para editar.`, "success");
}

function loadBatchDraft(index) {
  if (!batchState.drafts[index] || batchState.saving) return;
  if (batchState.activeIndex !== index) captureActiveBatchDraft();
  batchState.activeIndex = index;
  batchState.suppressCapture = true;
  applyQuoteData(batchState.drafts[index].data);
  batchState.suppressCapture = false;
  elements.batchServiceSelect.value = elements.packageSelect.value;
  renderBatchDraftList();
}

function renumberBatchDrafts() {
  batchState.drafts = batchState.drafts.map((draft, index) => ({
    ...draft,
    data: assignQuoteNumber(
      draft.data,
      batchQuoteNumber(batchState.baseNumber, index),
      draft.data.quoteDate || todayIso()
    )
  }));
}

function removeBatchDraft(index) {
  if (
    batchState.saving ||
    batchState.drafts.length <= 2 ||
    !batchState.drafts[index]
  ) {
    setBatchStatus("El lote debe conservar al menos dos cotizaciones.", "error");
    return;
  }
  if (batchState.saved || batchState.drafts.some((draft) => draft.savedResult)) {
    setBatchStatus("No se puede eliminar una cotización después de guardar sus PDFs.", "error");
    return;
  }

  captureActiveBatchDraft();
  const removedNumber = batchState.drafts[index].data.quoteNumber;
  batchState.drafts.splice(index, 1);

  if (index < batchState.activeIndex) {
    batchState.activeIndex -= 1;
  } else if (index === batchState.activeIndex) {
    batchState.activeIndex = Math.min(index, batchState.drafts.length - 1);
  }

  renumberBatchDrafts();
  batchState.suppressCapture = true;
  applyQuoteData(batchState.drafts[batchState.activeIndex].data);
  batchState.suppressCapture = false;
  elements.batchServiceSelect.value = elements.packageSelect.value;
  renderBatchDraftList();
  setBatchStatus(
    `Cotización ${removedNumber} eliminada. Los correlativos restantes fueron ordenados nuevamente.`,
    "success"
  );
}

function copyFirstQuoteClientData() {
  if (!batchState.started || !batchState.drafts.length || batchState.activeIndex !== 0) return;

  captureActiveBatchDraft();
  const source = batchState.drafts[0].data;
  const clientFields = [
    "clientName",
    "clientPhone",
    "eventName",
    "eventDate",
    "groupSchedule",
    "eventPlace",
    "guestCount"
  ];

  batchState.drafts.forEach((draft, index) => {
    if (index === 0) return;
    clientFields.forEach((field) => {
      draft.data[field] = source[field] || "";
    });
    draft.savedResult = null;
  });

  renderBatchDraftList();
  setBatchStatus(
    `Datos del cliente de la cotización ${source.quoteNumber} copiados a las demás cotizaciones. Cada una continúa editable.`,
    "success"
  );
}

function clearBatchSession() {
  batchState.drafts = [];
  batchState.baseNumber = quoteSequenceStart;
  batchState.activeIndex = -1;
  batchState.started = false;
  batchState.saved = false;
  batchState.results = [];
  batchState.nextNumber = null;
  clearNode(elements.batchDraftList);
  clearNode(elements.batchSavedResults);
  elements.batchSavedResults.classList.add("is-hidden");
  elements.batchWorkspace.classList.add("is-hidden");
  elements.batchSetup.classList.remove("is-hidden");
  setBatchStatus("");
  renderBatchHeaderState();
}

function resetBatchWorkspace() {
  if (batchState.started && !batchState.saved) {
    const confirmed = window.confirm(
      "¿Está seguro que desea descartar este lote de cotizaciones y comenzar uno nuevo?"
    );
    if (!confirmed) return;
  }

  restoreAppShellHome();
  clearBatchSession();
  const storedNumber =
    parseStoredNumber(readStoredValue(quoteStorageKeys.currentNumber)) || currentQuoteNumber;
  applyQuoteData(emptyQuoteData(storedNumber, todayIso()));
  elements.batchQuantity.focus();
}

async function fetchNextQuoteNumber() {
  const result = await apiRequest("/api/secuencia", {
    method: "GET",
    headers: {}
  });
  const number = parseStoredNumber(result.nextNumber);
  if (!number) throw new Error("No se pudo obtener el siguiente correlativo.");
  return number;
}

function renderBatchSavedResults(results) {
  clearNode(elements.batchSavedResults);
  results.forEach((result) => {
    const row = document.createElement("div");
    row.className = "batch-saved-result";

    const name = document.createElement("span");
    name.textContent = result.fileName;

    const link = document.createElement("a");
    link.href = result.pdfUrl;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Abrir PDF";

    const actions = document.createElement("div");
    actions.className = "batch-saved-result-actions";

    const whatsappButton = buttonElement("Enviar PDF por WhatsApp", (event, button) =>
      sendWhatsappPdf(result, setBatchStatus, button)
    );
    const localSaveButton = buttonElement("Guardar en computadora", (event, button) =>
      savePdfOnThisComputer(result, setBatchStatus, button)
    );

    actions.append(link, localSaveButton, whatsappButton);
    row.append(name, actions);
    elements.batchSavedResults.appendChild(row);
  });

  if (results.length > 1) {
    const saveAllLocalButton = buttonElement("Guardar todos en computadora", (event, button) =>
      saveBatchPdfsOnThisComputer(results, button)
    );
    saveAllLocalButton.classList.add("batch-send-all-button");
    const sendAllButton = buttonElement("Enviar todos por WhatsApp", (event, button) =>
      sendBatchWhatsappPdfs(results, button)
    );
    sendAllButton.classList.add("batch-send-all-button");
    elements.batchSavedResults.appendChild(saveAllLocalButton);
    elements.batchSavedResults.appendChild(sendAllButton);
  }
  elements.batchSavedResults.classList.remove("is-hidden");
}

async function saveBatchPdfsOnThisComputer(results, button = null) {
  const savedResults = Array.isArray(results) ? results.filter((result) => result.pdfUrl) : [];
  if (!savedResults.length) {
    setBatchStatus("No hay PDFs guardados para guardar en esta computadora.", "error");
    return;
  }

  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Guardando...";
  }

  let completed = 0;
  for (const record of savedResults) {
    const ok = await savePdfOnThisComputer(record, setBatchStatus);
    if (ok) completed += 1;
  }

  setBatchStatus(`${completed} PDF(s) guardado(s) en esta computadora.`, completed ? "success" : "error");
  if (button) {
    button.disabled = false;
    button.textContent = previousText || "Guardar todos en computadora";
  }
}

async function saveBatchPdfsOnConfiguredComputer(results) {
  const savedResults = Array.isArray(results) ? results.filter((result) => result.pdfUrl) : [];
  if (!savedResults.length) return 0;

  let directoryHandle = await configuredLocalPdfFolderHandle();
  if (!directoryHandle) directoryHandle = await chooseLocalPdfFolder(setBatchStatus);
  if (!directoryHandle) return 0;

  let completed = 0;
  for (const record of savedResults) {
    try {
      await writePdfRecordToDirectory(record, directoryHandle);
      completed += 1;
    } catch {
      // Si una copia local falla, la cotización principal ya quedó guardada en Render.
    }
  }
  return completed;
}

async function sendBatchWhatsappPdfs(results, button = null) {
  const savedResults = Array.isArray(results) ? results.filter((result) => result.id && result.pdfUrl) : [];
  if (!savedResults.length) {
    setBatchStatus("No hay PDFs guardados para enviar por WhatsApp.", "error");
    return;
  }

  const previousText = button?.textContent || "";
  if (button) {
    button.disabled = true;
    button.textContent = "Enviando PDFs...";
  }

  try {
    let sentCount = 0;
    for (let index = 0; index < savedResults.length; index += 1) {
      setBatchStatus(`Enviando PDF ${index + 1} de ${savedResults.length} por WhatsApp...`);
      const sent = await sendWhatsappPdf(savedResults[index], setBatchStatus);
      if (sent) sentCount += 1;
    }
    setBatchStatus(`${sentCount} de ${savedResults.length} PDFs enviados por WhatsApp.`, sentCount ? "success" : "error");
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = previousText || "Enviar todos por WhatsApp";
    }
  }
}

async function saveBatchQuotes() {
  if (!batchState.started || !batchState.drafts.length || batchState.saving) return;
  captureActiveBatchDraft();

  const quoteNumbers = batchState.drafts.map((draft) => cleanManualQuoteNumber(draft.data.quoteNumber));
  if (quoteNumbers.some((number) => !number)) {
    setBatchStatus("Cada cotización debe tener un número escrito manualmente.", "error");
    return;
  }
  const repeatedNumber = quoteNumbers.find((number, index) => quoteNumbers.indexOf(number) !== index);
  if (repeatedNumber) {
    setBatchStatus(`El número ${repeatedNumber} está repetido en el lote. Corrija los números antes de guardar.`, "error");
    return;
  }

  const confirmed = window.confirm(
    `¿Está seguro que desea guardar ${batchState.drafts.length} cotizaciones?\n\n` +
      `Se crearán PDFs individuales con los números escritos: ${quoteNumbers.join(", ")}.`
  );
  if (!confirmed) {
    setBatchStatus("Guardado cancelado. Ningún correlativo fue utilizado.");
    return;
  }

  batchState.saving = true;
  elements.batchExitButton.disabled = true;
  elements.batchCloseButton.disabled = true;
  renderBatchHeaderState();
  setBatchStatus("Preparando PDFs individuales...");

  const activeIndex = batchState.activeIndex;

  try {
    const quotes = [];
    batchState.suppressCapture = true;
    for (let index = 0; index < batchState.drafts.length; index += 1) {
      batchState.activeIndex = index;
      applyQuoteData(batchState.drafts[index].data);
      const quoteData = buildQuoteData();
      batchState.drafts[index].data = cloneQuoteData(quoteData);
      quotes.push({
        fileName: buildPdfFileName(),
        html: await buildPdfHtml(),
        quoteData
      });
      setBatchStatus(`Preparando PDF ${index + 1} de ${batchState.drafts.length}...`);
    }
    batchState.suppressCapture = false;

    setBatchStatus("Guardando cotizaciones y actualizando correlativos...");
    const result = await apiRequest("/api/cotizaciones/lote", {
      method: "POST",
      body: JSON.stringify({ quotes })
    });

    batchState.results = (result.quotes || []).map((savedResult, index) => ({
      ...savedResult,
      quoteData: batchState.drafts[index]?.data || null,
      clientName: batchState.drafts[index]?.data.clientName || "",
      clientPhone: batchState.drafts[index]?.data.clientPhone || "",
      packageName: batchState.drafts[index]?.data.packageName || "",
      serviceName: batchState.drafts[index]?.data.packageName || "",
      total: batchState.drafts[index]?.data.totals?.grandTotal || 0
    }));
    batchState.results.forEach((savedResult, index) => {
      if (batchState.drafts[index]) batchState.drafts[index].savedResult = savedResult;
    });
    batchState.saved = true;
    batchState.nextNumber = result.nextNumber;

    const nextNumber = parseStoredNumber(result.nextNumber);
    if (nextNumber) {
      writeStoredValue(quoteStorageKeys.currentNumber, nextNumber.toString());
      writeStoredValue(quoteStorageKeys.currentDate, todayIso());
    }

    renderBatchSavedResults(batchState.results);
    renderBatchDraftList();
    renderBatchHeaderState();
    const localSavedCount = await saveBatchPdfsOnConfiguredComputer(batchState.results);
    if (!localSavedCount) refreshLocalFolderStatus();
    setBatchStatus(
      `${batchState.results.length} PDFs guardados en ${result.folder || "cotizaciones-generadas"}.` +
        `${localSavedCount ? ` También se copiaron ${localSavedCount} PDF(s) a esta computadora.` : ""}` +
        ` Siguiente correlativo: ${result.nextNumber}.`,
      "success"
    );
    setDriveStatus(
      `${batchState.results.length} cotizaciones guardadas en ${result.folder || "cotizaciones-generadas"}.`,
      "success"
    );
    fetchHistory();
  } catch (error) {
    batchState.suppressCapture = false;
    batchState.saved = false;
    setBatchStatus(error.message, "error");
  } finally {
    batchState.saving = false;
    elements.batchExitButton.disabled = false;
    elements.batchCloseButton.disabled = false;
    renderBatchHeaderState();

    const restoreIndex = Math.max(0, Math.min(activeIndex, batchState.drafts.length - 1));
    batchState.activeIndex = restoreIndex;
    batchState.suppressCapture = true;
    applyQuoteData(batchState.drafts[restoreIndex].data);
    batchState.suppressCapture = false;
    elements.batchServiceSelect.value = elements.packageSelect.value;
    renderBatchDraftList();
  }
}

async function saveQuoteToFolder() {
  const isEditing = Boolean(editingQuoteId);
  const confirmed = window.confirm(
    isEditing
      ? `¿Está seguro que desea actualizar la cotización ${quoteCode()}?\n\nAceptar reemplazará el PDF de esta cotización sin cambiar el correlativo.`
      : `¿Está seguro que desea guardar la cotización ${quoteCode()}?\n\nAceptar guardará el PDF con el número escrito manualmente. Cancelar conservará la cotización abierta.`
  );
  if (!confirmed) {
    setDriveStatus(`Guardado cancelado. El número ${quoteNumberValue()} no cambió.`);
    return;
  }

  setDriveStatus("Preparando PDF...");
  clearLastSavedActions();
  elements.topSaveButton.disabled = true;

  try {
    const payload = {
      fileName: buildPdfFileName(),
      html: await buildPdfHtml(),
      quoteData: buildQuoteData()
    };
    setDriveStatus(isEditing ? "Actualizando PDF guardado..." : "Guardando PDF en carpeta local...");
    const result = await apiRequest(isEditing ? `/api/cotizaciones/${editingQuoteId}` : "/api/cotizaciones", {
      method: isEditing ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });
    setDriveStatus(
      `${isEditing ? "Actualizado" : "Guardado"}: ${result.fileName} en ${result.folder || "cotizaciones-generadas"}`,
      "success"
    );
    const savedRecord = {
      ...payload.quoteData,
      ...result,
      quoteData: payload.quoteData,
      serviceName: payload.quoteData.packageName,
      total: payload.quoteData.totals?.grandTotal || 0
    };
    renderLastSavedActions(savedRecord);
    const localCopySaved = await savePdfOnConfiguredComputer(savedRecord, setDriveStatus);
    if (!localCopySaved) refreshLocalFolderStatus();
    if (result.pdfUrl) openPdf(result);
    const nextNumber = parseStoredNumber(result.nextNumber);
    if (nextNumber) {
      writeStoredValue(quoteStorageKeys.currentNumber, nextNumber.toString());
      writeStoredValue(quoteStorageKeys.currentDate, todayIso());
    }
    fetchHistory();
  } catch (error) {
    setDriveStatus(error.message, "error");
  } finally {
    elements.topSaveButton.disabled = false;
  }
}

function currentPackage() {
  return packages.find((item) => item.id === elements.packageSelect.value) || packages[0];
}

function currentExtrasList() {
  const pkg = currentPackage();
  return pkg.extrasType === "interior" || pkg.category === "Interior"
    ? extras.interior
    : extras.regular;
}

function normalizedSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-GT")
    .trim();
}

function normalizeExtra(row) {
  const [id, qty, description, price, settings = {}] = row;
  const hasDimensions = Boolean(
    settings.hasDimensions ||
      settings.dimensions !== undefined ||
      settings.percussionCount !== undefined
  );
  return {
    id,
    qty,
    description,
    price,
    dimensions: settings.dimensions ?? settings.percussionCount ?? "",
    hasDimensions,
    dimensionsLabel: settings.dimensionsLabel || (settings.percussionCount !== undefined ? "Percusiones" : "Medidas"),
    dimensionMode: settings.percussionCount !== undefined ? "percussion" : "default",
    quantityLabel: settings.quantityLabel || "Cantidad",
    priceLabel: settings.priceLabel || (settings.priceMode === "unit" ? "Precio unitario" : "Precio"),
    priceMode: settings.priceMode || "total",
    unitSuffix: settings.unitSuffix || "c/u",
    exclusiveGroup: settings.exclusiveGroup || "",
    allowComplimentary: Boolean(settings.allowComplimentary),
    complimentaryLabel: settings.complimentaryLabel || "Cortesía",
    generator: Boolean(settings.generator),
    confettiNote: Boolean(settings.confettiNote),
    manual: Boolean(settings.manual),
    manualIndex: settings.manualIndex || 1
  };
}

function isManualExtraId(extraId) {
  return extraId === manualExtraBaseId || /^extra-manual-\d+$/.test(String(extraId || ""));
}

function manualExtraNumber(extraId) {
  if (extraId === manualExtraBaseId) return 1;
  const match = String(extraId || "").match(/^extra-manual-(\d+)$/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

function resetManualExtras(ids = []) {
  const nextIds = [manualExtraBaseId];
  ids.filter(isManualExtraId).forEach((id) => {
    if (!nextIds.includes(id)) nextIds.push(id);
  });
  manualExtraIds = nextIds.sort((first, second) => manualExtraNumber(first) - manualExtraNumber(second));
}

function removeManualExtra(extraId) {
  if (extraId === manualExtraBaseId) return;
  manualExtraIds = manualExtraIds.filter((id) => id !== extraId);
  selectedExtras.delete(extraId);
  extraQuantities.delete(extraId);
  extraPrices.delete(extraId);
  extraDimensions.delete(extraId);
  extraManualDescriptions.delete(extraId);
  extraComplimentary.delete(extraId);
  extraGeneratorDetails.delete(extraId);
}

function nextManualExtraId() {
  const maxNumber = manualExtraIds.reduce(
    (max, id) => Math.max(max, manualExtraNumber(id)),
    1
  );
  return `${manualExtraBaseId}-${maxNumber + 1}`;
}

function ensureManualExtraSlotCount(count) {
  const total = Math.max(1, Math.min(50, Number.parseInt(count, 10) || 1));
  while (manualExtraIds.length < total) {
    manualExtraIds.push(nextManualExtraId());
  }
}

function manualExtraRow(id = manualExtraBaseId, index = 1) {
  return [
    id,
    "1",
    extraManualDescriptions.get(id) || "",
    0,
    {
      manual: true,
      manualIndex: index,
      priceMode: "total",
      quantityLabel: "Cantidad",
      priceLabel: "Monto",
      unitSuffix: ""
    }
  ];
}

function manualExtras() {
  return manualExtraIds.map((id, index) => normalizeExtra(manualExtraRow(id, index + 1)));
}

function manualExtra() {
  return manualExtras()[0];
}

function extraManualDescription(extraId) {
  return String(extraManualDescriptions.get(extraId) || "").trim();
}

function setExtraManualDescription(extraId, value) {
  extraManualDescriptions.set(extraId, String(value || ""));
}

function defaultGeneratorDetails() {
  return {
    capacity: "",
    basePrice: 0,
    usageHours: 0,
    testHours: 0,
    dayBefore: false,
    dayBeforeQuantity: 1,
    dayBeforePrice: 1000
  };
}

function generatorDetails(extra) {
  return {
    ...defaultGeneratorDetails(),
    ...(extraGeneratorDetails.get(extra.id) || {})
  };
}

function setGeneratorDetail(extra, field, value) {
  const details = generatorDetails(extra);
  if (field === "capacity") {
    details.capacity = String(value || "").trim();
  } else if (field === "dayBefore") {
    details.dayBefore = Boolean(value);
  } else {
    const numericValue = Number.parseFloat(value);
    details[field] = Number.isFinite(numericValue) && numericValue >= 0 ? numericValue : 0;
  }
  extraGeneratorDetails.set(extra.id, details);
}

function extraQuantity(extra) {
  const quantity = Number.parseInt(extraQuantities.get(extra.id), 10);
  if (Number.isFinite(quantity) && quantity > 0) return quantity;
  const defaultQuantity = Number.parseInt(extra.qty, 10);
  return Number.isFinite(defaultQuantity) && defaultQuantity > 0 ? defaultQuantity : 1;
}

function setExtraQuantity(extraId, value) {
  const quantity = Math.max(1, Number.parseInt(value, 10) || 1);
  extraQuantities.set(extraId, String(quantity));
  return quantity;
}

function extraPrice(extra) {
  const customPrice = extraPrices.get(extra.id);
  if (customPrice !== undefined) {
    const price = Number.parseFloat(customPrice);
    return Number.isFinite(price) && price >= 0 ? price : 0;
  }

  const defaultPrice = Number.parseFloat(extra.price);
  return Number.isFinite(defaultPrice) && defaultPrice >= 0 ? defaultPrice : 0;
}

function setExtraPrice(extraId, value) {
  const price = Math.max(0, Number.parseFloat(value) || 0);
  extraPrices.set(extraId, String(price));
  return price;
}

function isExtraComplimentary(extra) {
  return extra.allowComplimentary && extraComplimentary.get(extra.id) === "1";
}

function setExtraComplimentary(extraId, value) {
  extraComplimentary.set(extraId, value ? "1" : "0");
}

function extraDimension(extra) {
  return extraDimensions.get(extra.id) ?? extra.dimensions;
}

function setExtraDimension(extraId, value) {
  extraDimensions.set(extraId, String(value || "").trim());
}

function extraDescription(extra) {
  if (extra.manual) {
    return translateQuoteText(extraManualDescription(extra.id) || (quoteLanguage === "en" ? "Manual extra" : "Extra manual"));
  }

  if (extra.generator) {
    const details = generatorDetails(extra);
    const isEnglish = quoteLanguage === "en";
    const lines = [
      isEnglish ? "Electric Generator" : "Generador Electrico",
      `${isEnglish ? "Capacity" : "Capacidad"}: ${
        details.capacity || (isEnglish ? "To be confirmed" : "Por definir")
      }`,
      `${isEnglish ? "Hours of Use" : "Horas de Uso"}: ${details.usageHours}`,
      `${isEnglish ? "Test Hours" : "Horas de Prueba"}: ${details.testHours}`
    ];
    if (details.dayBefore) {
      lines.push(
        `${isEnglish ? "Delivery One Day Before" : "Llevar un dia antes"}: ${
          details.dayBeforeQuantity
        }`
      );
    }
    return lines.join("\n");
  }

  const dimensions = extraDimension(extra);
  let description = extra.description;
  if (extra.dimensionMode === "percussion") {
    const percussionValue = String(dimensions || extra.dimensions || "4").trim();
    const percussionText = /percus/i.test(percussionValue)
      ? percussionValue
      : `${percussionValue} percusiones`;
    description = extra.description.includes("(1 hora)")
      ? extra.description.replace("(1 hora)", `(${percussionText}) (1 hora)`)
      : `${extra.description} (${percussionText})`;
  } else if (dimensions) {
    description = `${extra.description} (${dimensions})`;
  }

  if (extra.confettiNote) {
    description = `${description}\nColor de confeti sujeto a disponibilidad de color.`;
  }

  const translatedDescription = translateQuoteText(description);
  return isExtraComplimentary(extra)
    ? `${translatedDescription} (${quoteLanguage === "en" ? "Complimentary" : extra.complimentaryLabel})`
    : translatedDescription;
}

function extraTotalPrice(extra) {
  if (isExtraComplimentary(extra)) return 0;
  if (extra.generator) {
    const details = generatorDetails(extra);
    const dayBeforeTotal = details.dayBefore
      ? details.dayBeforeQuantity * details.dayBeforePrice
      : 0;
    return roundMoney(details.basePrice + dayBeforeTotal);
  }
  const price = extraPrice(extra);
  return extra.priceMode === "unit" ? price * extraQuantity(extra) : price;
}

function extraPriceLabel(extra) {
  if (extra.generator) return formatMoney(extraTotalPrice(extra));
  if (isExtraComplimentary(extra)) return extra.complimentaryLabel;
  const price = formatMoney(extraPrice(extra));
  if (extra.priceMode === "unit") return `${price} ${extra.unitSuffix}`;
  return price;
}

function extraTotalLabel(extra) {
  return isExtraComplimentary(extra) ? extra.complimentaryLabel : formatMoney(extraTotalPrice(extra));
}

function makeCell(text, className) {
  const cell = document.createElement("td");
  cell.textContent = text;
  if (className) cell.className = className;
  return cell;
}

function clearNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

function serviceOptionLabel(pkg) {
  if (pkg.pricedItems) {
    return `${packageDisplayName(pkg)} - ${quoteLanguage === "en" ? "Prices by service" : "Precios por servicio"}`;
  }
  return `${packageDisplayName(pkg)} - ${formatMoney(packageDisplayPrice(pkg))}`;
}

function buildPackageSelect() {
  const categories = [...new Set(packages.map((item) => item.category))];
  const savedPackage = readStoredPackage() || defaultPackageId;

  categories.forEach((category) => {
    const group = document.createElement("optgroup");
    group.label = category;
    packages
      .filter((item) => item.category === category)
      .forEach((item) => {
        const option = document.createElement("option");
        option.value = item.id;
        option.textContent = serviceOptionLabel(item);
        group.appendChild(option);
      });
    elements.packageSelect.appendChild(group);
  });

  elements.packageSelect.value = packages.some((item) => item.id === savedPackage)
    ? savedPackage
    : defaultPackageId;

  buildServicePicker(categories);
}

function buildServicePicker(categories) {
  clearNode(elements.servicePicker);

  categories.forEach((category) => {
    const group = document.createElement("div");
    group.className = "service-group";

    const title = document.createElement("div");
    title.className = "service-group-title";
    title.textContent = category;
    group.appendChild(title);

    packages
      .filter((item) => item.category === category)
      .forEach((pkg) => {
        const label = document.createElement("label");
        label.className = "service-option";
        label.dataset.packageId = pkg.id;

        const input = document.createElement("input");
        input.type = "radio";
        input.name = "packageRadio";
        input.value = pkg.id;
        input.addEventListener("change", () => selectPackage(pkg.id));

        const copy = document.createElement("span");
        copy.className = "service-option-copy";

        const name = document.createElement("strong");
        name.textContent = pkg.name;
        const price = document.createElement("span");
        price.textContent = pkg.pricedItems ? "Precios por servicio" : formatMoney(pkg.price);
        copy.append(name, price);

        label.append(input, copy);
        group.appendChild(label);
      });

    elements.servicePicker.appendChild(group);
  });
}

function selectPackage(packageId) {
  elements.packageSelect.value = packageId;
  extrasSearchTerm = "";
  elements.extrasSearch.value = "";
  renderExtrasPicker();
  renderQuote();
}

function renderServicePickerState(pkg) {
  elements.selectedServiceSummary.textContent = serviceOptionLabel(pkg);

  elements.servicePicker.querySelectorAll(".service-option").forEach((option) => {
    const isSelected = option.dataset.packageId === pkg.id;
    option.classList.toggle("is-selected", isSelected);
    const radio = option.querySelector("input");
    if (radio) radio.checked = isSelected;
  });
}

function makeExtraField(labelText, input) {
  const field = document.createElement("span");
  field.className = "extra-field";

  const label = document.createElement("span");
  label.textContent = labelText;

  ["click", "mousedown", "keydown"].forEach((eventName) => {
    input.addEventListener(eventName, (event) => event.stopPropagation());
  });

  field.append(label, input);
  return field;
}

function renderExtrasPicker() {
  const customExtras = manualExtras();
  const allExtras = [...customExtras, ...currentExtrasList().map(normalizeExtra)];
  const availableIds = new Set(allExtras.map((item) => item.id));
  const search = normalizedSearchText(extrasSearchTerm);
  const regularExtras = allExtras.filter((extra) => !extra.manual);
  const availableExtras = [
    ...customExtras,
    ...(search
      ? regularExtras.filter((extra) => normalizedSearchText(extra.description).includes(search))
      : regularExtras)
  ];
  if (elements.manualExtrasCount && document.activeElement !== elements.manualExtrasCount) {
    elements.manualExtrasCount.value = String(manualExtraIds.length);
  }

  [...selectedExtras].forEach((id) => {
    if (!availableIds.has(id)) {
      selectedExtras.delete(id);
      extraQuantities.delete(id);
      extraPrices.delete(id);
      extraDimensions.delete(id);
      extraManualDescriptions.delete(id);
      if (isManualExtraId(id)) removeManualExtra(id);
      extraComplimentary.delete(id);
      extraGeneratorDetails.delete(id);
    }
  });

  clearNode(elements.extrasList);
  const pkg = currentPackage();
  elements.extrasScope.textContent =
    pkg.extrasType === "interior" || pkg.category === "Interior" ? "Interior" : "Ciudad";

  if (!search) {
    const noneLabel = document.createElement("div");
    noneLabel.className = "extra-option";

    const noneCheckbox = document.createElement("input");
    noneCheckbox.type = "checkbox";
    noneCheckbox.value = "none";
    noneCheckbox.setAttribute("aria-label", "Ninguno");
    noneCheckbox.checked = selectedExtras.size === 0;
    const clearExtrasSelection = () => {
      selectedExtras.clear();
      extraQuantities.clear();
      extraPrices.clear();
      extraDimensions.clear();
      extraManualDescriptions.clear();
      resetManualExtras();
      extraComplimentary.clear();
      extraGeneratorDetails.clear();
      renderExtrasPicker();
      renderQuote();
    };
    noneCheckbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      clearExtrasSelection();
    });
    noneCheckbox.addEventListener("change", clearExtrasSelection);
    noneLabel.addEventListener("click", (event) => {
      if (event.target.closest("input")) return;
      clearExtrasSelection();
    });

    const noneCopy = document.createElement("span");
    const noneName = document.createElement("strong");
    noneName.textContent = "Ninguno";
    const noneQty = document.createElement("span");
    noneQty.textContent = "Sin extras seleccionados";
    noneCopy.append(noneName, noneQty);

    const nonePrice = document.createElement("span");
    nonePrice.className = "extra-price";
    nonePrice.textContent = formatMoney(0);

    noneLabel.append(noneCheckbox, noneCopy, nonePrice);
    elements.extrasList.appendChild(noneLabel);
  }

  if (!availableExtras.length) {
    const empty = document.createElement("p");
    empty.className = "extras-empty";
    empty.textContent = "No se encontró ningún extra con ese nombre.";
    elements.extrasList.appendChild(empty);
    return;
  }

  availableExtras.forEach((extra) => {
    const isSelected = selectedExtras.has(extra.id);
    const label = document.createElement("div");
    label.className = "extra-option has-fields";
    if (extra.hasDimensions) label.classList.add("has-dimensions");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = extra.id;
    checkbox.setAttribute("aria-label", extra.description);
    checkbox.checked = isSelected;
    const setExtraSelection = (checked) => {
      if (checked) {
        selectedExtras.add(extra.id);
        if (extra.exclusiveGroup) {
          allExtras
            .filter((otherExtra) => otherExtra.id !== extra.id && otherExtra.exclusiveGroup === extra.exclusiveGroup)
            .forEach((otherExtra) => selectedExtras.delete(otherExtra.id));
        }
      } else {
        selectedExtras.delete(extra.id);
      }
      renderExtrasPicker();
      renderQuote();
    };
    checkbox.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setExtraSelection(!isSelected);
    });
    checkbox.addEventListener("change", () => setExtraSelection(checkbox.checked));
    label.addEventListener("click", (event) => {
      if (event.target.closest("input") || event.target.closest(".extra-field") || event.target.closest("button")) return;
      checkbox.checked = !checkbox.checked;
      setExtraSelection(checkbox.checked);
    });

    const copy = document.createElement("span");
    copy.className = "extra-option-copy";

    const name = document.createElement("strong");
    name.textContent = extra.manual ? `Extra manual ${extra.manualIndex}` : extra.description;

    const note = document.createElement("span");
    note.textContent = extra.manual
      ? "Descripción, cantidad y monto editables"
      : extra.generator
        ? "Capacidad, horas y costos editables"
        : extra.priceMode === "unit"
          ? "Cantidad y precio unitario editables"
          : "Cantidad y precio editables";

    const controls = document.createElement("span");
    controls.className = "extra-controls";

    const price = document.createElement("span");
    price.className = "extra-price";

    const updatePriceSummary = () => {
      price.textContent = extraPriceLabel(extra);
    };

    if (extra.generator) {
      const details = generatorDetails(extra);
      const addGeneratorInput = (labelText, field, value, type = "number") => {
        const input = document.createElement("input");
        input.className = "extra-control-input";
        input.type = type;
        if (type === "number") {
          input.min = "0";
          input.step = "0.01";
          input.inputMode = "decimal";
        } else {
          input.classList.add("extra-capacity-input");
        }
        input.value = value;
        input.addEventListener("input", () => {
          setGeneratorDetail(extra, field, input.value);
          if (selectedExtras.has(extra.id)) renderQuote();
          updatePriceSummary();
        });
        controls.appendChild(makeExtraField(labelText, input));
      };

      addGeneratorInput("Capacidad", "capacity", details.capacity, "text");
      addGeneratorInput("Precio del generador", "basePrice", details.basePrice);
      addGeneratorInput("Horas de uso", "usageHours", details.usageHours);
      addGeneratorInput("Horas de prueba", "testHours", details.testHours);

      const dayBeforeInput = document.createElement("input");
      dayBeforeInput.className = "extra-complimentary-input";
      dayBeforeInput.type = "checkbox";
      dayBeforeInput.checked = details.dayBefore;
      dayBeforeInput.addEventListener("change", () => {
        setGeneratorDetail(extra, "dayBefore", dayBeforeInput.checked);
        renderExtrasPicker();
        renderQuote();
      });
      controls.appendChild(makeExtraField("Llevar un día antes", dayBeforeInput));

      if (details.dayBefore) {
        addGeneratorInput(
          "Cantidad día anterior",
          "dayBeforeQuantity",
          details.dayBeforeQuantity
        );
        addGeneratorInput("Precio día anterior", "dayBeforePrice", details.dayBeforePrice);
      }
    } else {
      if (extra.manual) {
        const descriptionInput = document.createElement("input");
        descriptionInput.className = "extra-control-input extra-manual-description-input";
        descriptionInput.type = "text";
        descriptionInput.placeholder = "Escriba el extra";
        descriptionInput.value = extraManualDescription(extra.id);
        descriptionInput.addEventListener("input", () => {
          setExtraManualDescription(extra.id, descriptionInput.value);
          if (descriptionInput.value.trim()) {
            selectedExtras.add(extra.id);
            checkbox.checked = true;
          } else {
            selectedExtras.delete(extra.id);
            checkbox.checked = false;
          }
          renderQuote();
          updatePriceSummary();
        });
        controls.appendChild(makeExtraField("Extra", descriptionInput));
      }

      const quantityInput = document.createElement("input");
      quantityInput.className = "extra-control-input extra-quantity-input";
      quantityInput.type = "number";
      quantityInput.min = "1";
      quantityInput.inputMode = "numeric";
      quantityInput.value = extraQuantity(extra);
      quantityInput.addEventListener("input", () => {
        setExtraQuantity(extra.id, quantityInput.value);
        if (selectedExtras.has(extra.id)) renderQuote();
        updatePriceSummary();
      });
      controls.appendChild(makeExtraField(extra.quantityLabel, quantityInput));

      if (extra.hasDimensions) {
        const dimensionsInput = document.createElement("input");
        dimensionsInput.className = "extra-control-input extra-dimensions-input";
        dimensionsInput.type = "text";
        dimensionsInput.value = extraDimension(extra);
        dimensionsInput.addEventListener("input", () => {
          setExtraDimension(extra.id, dimensionsInput.value);
          if (selectedExtras.has(extra.id)) renderQuote();
        });
        controls.appendChild(makeExtraField(extra.dimensionsLabel, dimensionsInput));
      }

      const priceInput = document.createElement("input");
      priceInput.className = "extra-control-input extra-price-input";
      priceInput.type = "number";
      priceInput.min = "0";
      priceInput.step = "0.01";
      priceInput.inputMode = "decimal";
      priceInput.value = extraPrice(extra);
      priceInput.addEventListener("input", () => {
        setExtraPrice(extra.id, priceInput.value);
        if (selectedExtras.has(extra.id)) renderQuote();
        updatePriceSummary();
      });
      controls.appendChild(makeExtraField(extra.priceLabel, priceInput));

      if (extra.allowComplimentary) {
        const complimentaryInput = document.createElement("input");
        complimentaryInput.className = "extra-complimentary-input";
        complimentaryInput.type = "checkbox";
        complimentaryInput.checked = isExtraComplimentary(extra);
        priceInput.disabled = complimentaryInput.checked;
        complimentaryInput.addEventListener("change", () => {
          setExtraComplimentary(extra.id, complimentaryInput.checked);
          priceInput.disabled = complimentaryInput.checked;
          if (selectedExtras.has(extra.id)) renderQuote();
          updatePriceSummary();
        });
        controls.appendChild(makeExtraField(extra.complimentaryLabel, complimentaryInput));
      }
    }

    if (extra.manual && extra.id !== manualExtraBaseId) {
      const removeButton = document.createElement("button");
      removeButton.className = "extra-manual-remove";
      removeButton.type = "button";
      removeButton.textContent = "X";
      removeButton.setAttribute("aria-label", `Eliminar extra manual ${extra.manualIndex}`);
      removeButton.addEventListener("click", () => {
        removeManualExtra(extra.id);
        if (elements.manualExtrasCount) elements.manualExtrasCount.value = String(manualExtraIds.length);
        renderExtrasPicker();
        renderQuote();
      });
      controls.appendChild(removeButton);
    }

    copy.append(name, note, controls);
    updatePriceSummary();

    label.append(checkbox, copy, price);
    elements.extrasList.appendChild(label);
  });
}

function renderPackageTable(pkg) {
  clearNode(elements.packageItems);
  const includePrices = packageUsesItemPrices(pkg);
  elements.packagePriceHeader.classList.toggle("is-hidden", !includePrices);

  packageItemDisplayRows(pkg).forEach((item) => {
    const row = document.createElement("tr");
    if (item.type === "section") {
      row.className = "package-section-row";
      if (includePrices) {
        const titleCell = makeCell(item.description, "package-section-title");
        row.append(makeCell("", "qty-column"), titleCell, makeCell("", "price-column"));
      } else {
        const cell = makeCell(item.description, "package-section-title");
        cell.colSpan = 2;
        row.appendChild(cell);
      }
      elements.packageItems.appendChild(row);
      return;
    }

    if (item.type === "subtotal") {
      row.className = "package-subtotal-row";
      const labelCell = makeCell(item.description);
      if (includePrices) row.append(makeCell("", "qty-column"), labelCell, makeCell(packageItemPriceLabel(item.price), "price-column"));
      else {
        labelCell.colSpan = 2;
        row.appendChild(labelCell);
      }
      elements.packageItems.appendChild(row);
      return;
    }

    if (item.type === "total") {
      row.className = "package-total-row";
      const labelCell = makeCell(item.description);
      if (includePrices) row.append(makeCell("", "qty-column"), labelCell, makeCell(formatMoney(item.price), "price-column"));
      else {
        labelCell.colSpan = 2;
        row.appendChild(labelCell);
      }
      elements.packageItems.appendChild(row);
      return;
    }

    row.append(makeCell(item.qty, "qty-column"), makeCell(item.description));
    if (includePrices) row.append(makeCell(packageItemPriceLabel(item.price), "price-column"));
    elements.packageItems.appendChild(row);
  });

}

function makeManualServiceField(labelText, input) {
  const field = document.createElement("label");
  field.className = "manual-service-field";
  field.append(labelText, input);
  return field;
}

function makeManualServiceInput({ type = "text", value = "", className = "", min, step }) {
  const input = document.createElement("input");
  input.type = type;
  input.value = value ?? "";
  input.className = className;
  input.autocomplete = "off";
  if (min !== undefined) input.min = min;
  if (step !== undefined) input.step = step;
  if (type === "number") input.inputMode = "decimal";
  return input;
}

function renderManualServiceEditor(pkg, options = {}) {
  elements.manualServiceEditor.classList.remove("is-hidden");

  if (!options.force && elements.manualServiceEditor.contains(document.activeElement)) return;

  const quantityLabel = quoteLanguage === "en" ? "Quantity" : "Cantidad";
  const serviceLabel = quoteLanguage === "en" ? "Service" : "Servicio";
  const amountLabel = quoteLanguage === "en" ? "Amount" : "Monto";
  const measurementsLabel = quoteLanguage === "en" ? "Measurements" : "Medidas";
  const subtitleLabel = quoteLanguage === "en" ? "Subtitle" : "Subtítulo";
  const subtotalLabel = quoteLanguage === "en" ? "Sub total" : "Sub total";
  const totalLabel = quoteLanguage === "en" ? "Final total" : "Total final";
  const usesItemPrices = packageUsesItemPrices(pkg);

  elements.manualServiceName.value = packageDisplayName(pkg);
  elements.manualServicePrice.value = packageDisplayPrice(pkg);
  elements.manualServicePriceField.classList.toggle("is-hidden", usesItemPrices);
  clearNode(elements.manualServiceItems);

  const heading = document.createElement("div");
  heading.className = usesItemPrices
    ? "manual-service-items-heading has-price has-actions"
    : "manual-service-items-heading has-actions";
  heading.innerHTML = usesItemPrices
    ? `<span>${quantityLabel}</span><span>${serviceLabel}</span><span>${amountLabel}</span><span></span>`
    : `<span>${quantityLabel}</span><span>${serviceLabel}</span><span></span>`;
  elements.manualServiceItems.appendChild(heading);

  packageEditorItems(pkg).forEach(([qty, description, itemPrice, measurements = [], meta = {}], index) => {
    const row = document.createElement("div");

    const itemMeta = normalizePackageItemMeta(meta);

    if (itemMeta.type === "subtotal" || isPackageSubtotalItem([qty, description, itemPrice, measurements, meta])) {
      row.className = "manual-service-item manual-service-subtotal-item";
      const subtotalInput = makeManualServiceInput({
        type: "number",
        value: Number.parseFloat(itemPrice) || 0,
        className: "manual-service-price",
        min: "0",
        step: "0.01"
      });
      subtotalInput.addEventListener("input", () => {
        const rows = packageEditorItems(pkg);
        rows[index] = [
          "",
          "SUB TOTAL",
          Math.max(0, Number.parseFloat(subtotalInput.value) || 0),
          [],
          { type: "subtotal" }
        ];
        setPackageItemsOverride(pkg.id, rows);
        renderQuote();
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "manual-service-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "X";
      deleteButton.setAttribute("aria-label", "Eliminar sub total");
      deleteButton.addEventListener("click", () => {
        const rows = packageEditorItems(pkg);
        rows.splice(index, 1);
        setPackageItemsOverride(pkg.id, rows);
        renderManualServiceEditor(pkg, { force: true });
        renderQuote();
      });

      row.append(makeManualServiceField(subtotalLabel, subtotalInput), deleteButton);
      elements.manualServiceItems.appendChild(row);
      return;
    }

    if (itemMeta.type === "total") {
      row.className = "manual-service-item manual-service-total-item";
      const totalPreview = document.createElement("strong");
      totalPreview.textContent = `${totalLabel}: ${formatMoney(packageItemsTotal(pkg))}`;

      const deleteButton = document.createElement("button");
      deleteButton.className = "manual-service-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "X";
      deleteButton.setAttribute("aria-label", "Eliminar total");
      deleteButton.addEventListener("click", () => {
        const rows = packageEditorItems(pkg);
        rows.splice(index, 1);
        setPackageItemsOverride(pkg.id, rows);
        renderManualServiceEditor(pkg, { force: true });
        renderQuote();
      });

      row.append(totalPreview, deleteButton);
      elements.manualServiceItems.appendChild(row);
      return;
    }

    if (itemMeta.type === "section") {
      row.className = "manual-service-item manual-service-section-item";
      const titleInput = makeManualServiceInput({
        type: "text",
        value: description,
        className: "manual-service-description"
      });
      titleInput.addEventListener("input", () => {
        const rows = packageEditorItems(pkg);
        rows[index] = ["", titleInput.value, undefined, [], { type: "section" }];
        setPackageItemsOverride(pkg.id, rows);
        renderQuote();
      });

      const deleteButton = document.createElement("button");
      deleteButton.className = "manual-service-delete";
      deleteButton.type = "button";
      deleteButton.textContent = "X";
      deleteButton.setAttribute("aria-label", "Eliminar subtítulo");
      deleteButton.addEventListener("click", () => {
        const rows = packageEditorItems(pkg);
        rows.splice(index, 1);
        setPackageItemsOverride(pkg.id, rows);
        renderManualServiceEditor(pkg, { force: true });
        renderQuote();
      });

      row.append(makeManualServiceField(subtitleLabel, titleInput));
      row.append(deleteButton);
      elements.manualServiceItems.appendChild(row);
      return;
    }

    row.className = usesItemPrices
      ? "manual-service-item has-price has-actions"
      : "manual-service-item has-actions";

    const quantityInput = makeManualServiceInput({
      type: "text",
      value: qty,
      className: "manual-service-qty"
    });
    const descriptionInput = makeManualServiceInput({
      type: "text",
      value: description,
      className: "manual-service-description"
    });
    let priceInput = null;
    const dimensionsBox = document.createElement("div");
    dimensionsBox.className = "manual-service-dimensions";
    let dimensionControls = [];

    const currentMeasurements = () =>
      dimensionControls
        .map(({ qtyInput, measureInput }) => ({
          qty: qtyInput.value.trim() || "1",
          value: measureInput.value.trim()
        }))
        .filter((entry) => entry.value);

    const saveRow = () => {
      const rows = packageEditorItems(pkg);
      const current = rows[index] || ["", "", 0];
      rows[index] = [
        quantityInput.value,
        descriptionInput.value,
        usesItemPrices
          ? Math.max(0, Number.parseFloat(priceInput?.value ?? current[2]) || 0)
          : undefined,
        currentMeasurements(),
        {}
      ];
      setPackageItemsOverride(pkg.id, rows);
      renderQuote();
    };

    const renderMeasurementInputs = () => {
      const existingValues = dimensionControls.length
        ? currentMeasurements()
        : normalizePackageMeasurements(measurements);
      const quantity = Math.max(0, Number.parseInt(quantityInput.value, 10) || 0);
      const shouldShow = isScreenLedItem(descriptionInput.value) && quantity > 0;
      clearNode(dimensionsBox);
      dimensionControls = [];
      dimensionsBox.classList.toggle("is-hidden", !shouldShow);
      if (!shouldShow) return;

      for (let itemIndex = 0; itemIndex < quantity; itemIndex += 1) {
        const measurementRow = document.createElement("div");
        measurementRow.className = "manual-service-measurement-row";
        const qtyMeasureInput = makeManualServiceInput({
          type: "text",
          value: existingValues[itemIndex]?.qty || "1",
          className: "manual-service-measurement-qty"
        });
        const measureInput = makeManualServiceInput({
          type: "text",
          value: existingValues[itemIndex]?.value || "",
          className: "manual-service-measurement"
        });
        measureInput.placeholder = `${itemIndex + 1}. 3 x 2 metros`;
        qtyMeasureInput.addEventListener("input", saveRow);
        measureInput.addEventListener("input", saveRow);
        dimensionControls.push({ qtyInput: qtyMeasureInput, measureInput });
        measurementRow.append(
          makeManualServiceField(quantityLabel, qtyMeasureInput),
          makeManualServiceField(`${measurementsLabel} ${itemIndex + 1}`, measureInput)
        );
        dimensionsBox.appendChild(measurementRow);
      }
    };

    quantityInput.addEventListener("input", () => {
      renderMeasurementInputs();
      saveRow();
    });
    descriptionInput.addEventListener("input", () => {
      renderMeasurementInputs();
      saveRow();
    });

    row.append(
      makeManualServiceField(quantityLabel, quantityInput),
      makeManualServiceField(serviceLabel, descriptionInput)
    );

    if (usesItemPrices) {
      priceInput = makeManualServiceInput({
        type: "number",
        value: Number.parseFloat(itemPrice) || 0,
        className: "manual-service-price",
        min: "0",
        step: "0.01"
      });
      priceInput.addEventListener("input", () => {
        saveRow();
      });
      row.append(makeManualServiceField(amountLabel, priceInput));
    }

    const deleteButton = document.createElement("button");
    deleteButton.className = "manual-service-delete";
    deleteButton.type = "button";
    deleteButton.textContent = "X";
    deleteButton.setAttribute("aria-label", "Eliminar equipo");
    deleteButton.addEventListener("click", () => {
      const rows = packageEditorItems(pkg);
      rows.splice(index, 1);
      setPackageItemsOverride(pkg.id, rows);
      renderManualServiceEditor(pkg, { force: true });
      renderQuote();
    });
    row.append(deleteButton);

    renderMeasurementInputs();
    row.appendChild(dimensionsBox);
    elements.manualServiceItems.appendChild(row);
  });
}

function renderSelectedExtrasTable(selected) {
  clearNode(elements.selectedExtras);
  elements.selectedExtrasSection.classList.toggle("is-hidden", selected.length === 0);

  selected.forEach((extra) => {
    const row = document.createElement("tr");
    row.append(
      makeCell(extraQuantity(extra), "qty-column"),
      makeCell(extraDescription(extra)),
      makeCell(extraTotalLabel(extra), "price-column")
    );
    elements.selectedExtras.appendChild(row);
  });
}

function setDocumentText(id, spanish, english) {
  const element = document.querySelector(`#${id}`);
  if (element) element.textContent = quoteLanguage === "en" ? english : spanish;
}

function renderQuoteLanguage() {
  const isEnglish = quoteLanguage === "en";
  setDocumentText("quoteLabel", "Cotización", "Quotation");
  setDocumentText("quoteNumberLabel", "Número de cotización", "Quotation number");
  setDocumentText("quoteDateLabel", "Fecha de emisión", "Issue date");
  setDocumentText("eventDateLabel", "Fecha del evento", "Event date");
  setDocumentText("groupScheduleLabel", "Horario de grupo", "Group schedule");
  setDocumentText("eventPlaceLabel", "Lugar del evento", "Event location");
  setDocumentText(
    "introMessage",
    "Reciba un cordial saludo de parte de Live Productions, deseándole éxitos en sus labores. A continuación, se desglosa la cotización por la presentación de servicios solicitada.",
    "Warm greetings from Live Productions. We wish you continued success. Below is the quotation for the requested services."
  );
  setDocumentText("packageQuantityHeader", "Cantidad", "Quantity");
  setDocumentText("packageDescriptionHeader", "Detalle de equipo y servicios", "Equipment and service details");
  setDocumentText("packagePriceHeader", "Precio", "Price");
  setDocumentText("servicePriceLabel", "Precio", "Price");
  setDocumentText("selectedExtrasTitle", "Extras seleccionados", "Selected extras");
  setDocumentText("extrasQuantityHeader", "Cantidad", "Quantity");
  setDocumentText("extrasDescriptionHeader", "Descripción", "Description");
  setDocumentText("extrasPriceHeader", "Precio", "Price");
  setDocumentText("paymentTitle", "Condiciones de Pago:", "Payment Terms:");
  document.querySelector("#requirementText").innerHTML = isEnglish
    ? "<strong>Requirement:</strong> The equipment must remain covered in a secure location or under a canopy for its protection."
    : "<strong>Requerimiento:</strong> El equipo debe quedar siempre bajo techo en un lugar seguro o toldo para la protección del equipo.";
  setDocumentText("packageTotalLabel", "Paquete", "Package");
  setDocumentText("extrasTotalLabel", "Extras", "Extras");
  setDocumentText("discountTotalLabel", "Descuento", "Discount");
  setDocumentText("vatTotalLabel", "IVA 12%", "VAT 12%");
  setDocumentText("grandTotalLabel", "Total", "Total");
  setDocumentText("notesTitle", "Notas", "Notes");
  setDocumentText(
    "additionalServicesTitle",
    "Servicios Adicionales (no incluidos en la cotización):",
    "Additional Services (not included in this quote):"
  );
  setDocumentText("signatureLabel", "Firma:", "Signature:");
  setDocumentText("addressLabel", "Direccion:", "Address:");
  setDocumentText("phoneLabel", "Telefono:", "Phone:");
  setDocumentText("mountingPageTitle", "Tipos de Montaje", "Setup Styles");
  setDocumentText(
    "mountingPageSubtitle",
    "Opciones de presentación del equipo para su evento",
    "Equipment presentation options for your event"
  );
  setDocumentText("mountingOptionOneLabel", "Opción 01", "Option 01");
  setDocumentText("whiteMountingTitle", "Forrado de Blanco", "White Draping");
  setDocumentText("mountingOptionTwoLabel", "Opción 02", "Option 02");
  setDocumentText("blackMountingTitle", "Forrado de Negro", "Black Draping");
  setDocumentText(
    "mountingFooterText",
    "Montajes profesionales para cada ambiente",
    "Professional setups for every venue"
  );

  elements.topLanguageButton.classList.toggle("is-active", isEnglish);
  elements.topLanguageButton.setAttribute("aria-pressed", String(isEnglish));
  elements.topLanguageButton.textContent = isEnglish ? "Español" : "English";
  document.documentElement.lang = isEnglish ? "en" : "es";
}

function renderCurrencyState() {
  elements.currencySelect.value = quoteCurrency;
}

function renderDocumentFields() {
  elements.docFields.eventDate.textContent = formatDate(elements.fields.eventDate.value);
  elements.docFields.groupSchedule.textContent =
    elements.fields.groupSchedule.value || (quoteLanguage === "en" ? "To be confirmed" : "Por definir");
  elements.docFields.eventPlace.textContent =
    elements.fields.eventPlace.value || (quoteLanguage === "en" ? "To be confirmed" : "Por definir");
  elements.docFields.quoteDate.textContent = formatDate(currentQuoteDate);
  elements.quoteCode.textContent = quoteCode();

  const notes = elements.fields.notes.value.trim();
  const includesGeneratorDayBefore = selectedExtrasForQuote().some(
    (extra) => extra.generator && generatorDetails(extra).dayBefore
  );
  const generatedNote = includesGeneratorDayBefore
    ? quoteLanguage === "en"
      ? `If the Electric Generator must be delivered one day before, the cost is ${formatMoney(1000)}`
      : `Si se requiere llevar el Generador Electrico un dia antes el costo es de ${formatMoney(1000)}`
    : "";
  const visibleNotes = [notes, generatedNote].filter(Boolean).join("\n");
  elements.docNotes.textContent = visibleNotes;
  elements.notesSection.classList.toggle("is-hidden", visibleNotes.length === 0);

  const pdfFileName = buildPdfFileName();
  elements.pdfFileName.textContent = pdfFileName;
  document.title = pdfFileName;
}

function renderTotals(pkg, selected) {
  const totals = calculateTotals(pkg, selected);
  const hideTotals = Boolean(pkg.hideTotal);
  const hasManualPackageTotal = pkg.id === "ninguno" && totals.packageTotal > 0;

  elements.baseTotal.textContent = formatMoney(totals.packageTotal);
  elements.baseTotalRow.classList.toggle(
    "is-hidden",
    hideTotals || (pkg.id === "ninguno" && !hasManualPackageTotal)
  );
  elements.extrasTotal.textContent = formatMoney(totals.extrasTotal);
  elements.extrasTotalRow.classList.toggle("is-hidden", selected.length === 0);
  elements.discountTotal.textContent = `-${formatMoney(totals.discountTotal)}`;
  elements.discountTotalRow.classList.toggle("is-hidden", !includeDiscount || totals.discountTotal <= 0);
  elements.vatTotal.textContent = formatMoney(totals.vatTotal);
  elements.vatTotalRow.classList.toggle("is-hidden", !includeVat);
  elements.grandTotal.textContent = formatMoney(totals.grandTotal);
  elements.totalsBox.classList.toggle("is-hidden", hideTotals);
  elements.quoteBottomGrid.classList.toggle("without-totals", hideTotals);
}

function renderDiscountState() {
  elements.topDiscountButton.classList.toggle("is-active", includeDiscount);
  elements.topDiscountButton.setAttribute("aria-pressed", String(includeDiscount));
  elements.topDiscountButton.textContent = includeDiscount
    ? quoteLanguage === "en"
      ? "Discount added"
      : "Descuento agregado"
    : quoteLanguage === "en"
      ? "Discount"
      : "Descuento";
  elements.topDiscountPanel.classList.toggle("is-hidden", !includeDiscount);
}

function renderVatState() {
  elements.topVatButton.classList.toggle("is-active", includeVat);
  elements.topVatButton.setAttribute("aria-pressed", String(includeVat));
  elements.topVatButton.textContent = includeVat
    ? quoteLanguage === "en"
      ? "VAT 12% added"
      : "IVA 12% agregado"
    : quoteLanguage === "en"
      ? "VAT"
      : "IVA";
  elements.batchHeaderVatButton.classList.toggle("is-active", includeVat);
  elements.batchHeaderVatButton.setAttribute("aria-pressed", String(includeVat));
  elements.batchHeaderVatButton.textContent = includeVat ? "IVA 12% agregado" : "IVA";
}

function renderMountingPageState() {
  elements.mountingPage.classList.toggle("is-hidden", !includeMountingPage);
  elements.quoteDocument.classList.toggle("without-mounting-page", !includeMountingPage);
  elements.topMountingPageButton.classList.toggle("is-active", includeMountingPage);
  elements.topMountingPageButton.setAttribute("aria-pressed", String(includeMountingPage));
  elements.topMountingPageButton.textContent =
    quoteLanguage === "en" ? "Include setup styles" : "Incluir tipos de montaje";
}

function renderAdditionalServicesState() {
  elements.additionalServicesSection.classList.toggle("is-hidden", !includeAdditionalServices);
  elements.additionalServicesButton.classList.toggle("is-active", includeAdditionalServices);
  elements.additionalServicesButton.setAttribute("aria-pressed", String(includeAdditionalServices));
  elements.additionalServicesButton.textContent =
    quoteLanguage === "en" ? "Additional services" : "Servicios adicionales";
}

function renderPaymentConditions() {
  if (quoteLanguage === "en") {
    const start = includeVat
      ? "This quotation is valid for 30 days after its issue date."
      : "This quote does not include TAXES. It is valid for 30 days after its issue date.";
    elements.paymentConditionsText.textContent =
      `${start} Payment terms: 50% reservation and deposit, and the remaining 50% before the event.`;
    return;
  }

  const start = includeVat
    ? "Esta cotización es válida por un periodo de 30 días después de emitida."
    : "Esta cotización No INCLUYE IVA, válida por un periodo de 30 días después de emitida.";
  elements.paymentConditionsText.textContent =
    `${start} Forma de pago: 50% reserva y anticipo y 50% restante fechas previas al evento.`;
}

function renderQuote() {
  const pkg = currentPackage();
  const selected = selectedExtrasForQuote();
  const hasServiceDetail = pkg.id !== "ninguno" || packageDisplayItems(pkg).length > 0;
  const hidePackageHeaderTitle = isDefaultNonePackageTitle(pkg);

  elements.quotePackageTitle.textContent = hidePackageHeaderTitle
    ? ""
    : packageDisplayName(pkg) || (hasServiceDetail ? "" : translateQuoteText("COTIZACIÓN DE EXTRAS"));
  elements.quotePackageTitle.classList.toggle("is-empty", hidePackageHeaderTitle);
  elements.packagePriceBadge.textContent = formatMoney(packageDisplayPrice(pkg));
  elements.serviceDetailCard.classList.toggle("is-hidden", !hasServiceDetail);
  elements.servicePriceRow.classList.toggle("is-hidden", packageUsesItemPrices(pkg));

  renderServicePickerState(pkg);
  renderManualServiceEditor(pkg);
  renderPackageTable(pkg);
  renderSelectedExtrasTable(selected);
  renderQuoteLanguage();
  renderDocumentFields();
  renderTotals(pkg, selected);
  renderDiscountState();
  renderVatState();
  renderMountingPageState();
  renderAdditionalServicesState();
  renderPaymentConditions();
  renderCurrencyState();

  if (batchState.started) {
    elements.batchServiceSelect.value = pkg.id;
    captureActiveBatchDraft();
  }
  writeStoredPackage(pkg.id);
}

async function resetQuote() {
  try {
    await startFreshQuoteSequence();
  } catch {
    clearEditingQuote();
    startNewQuoteSequence();
  }
  selectedExtras.clear();
  extraQuantities.clear();
  extraPrices.clear();
  extraDimensions.clear();
  extraManualDescriptions.clear();
  resetManualExtras();
  extraComplimentary.clear();
  extraGeneratorDetails.clear();
  packageNameOverrides.clear();
  packagePriceOverrides.clear();
  packageItemOverrides.clear();
  Object.values(elements.fields).forEach((field) => {
    field.value = "";
  });
  setQuoteNumberInput(currentQuoteNumber.toString());
  elements.fields.quoteDate.value = currentQuoteDate;
  elements.packageSelect.value = defaultPackageId;
  includeDiscount = false;
  elements.discountAmount.value = "";
  includeVat = false;
  includeMountingPage = false;
  includeAdditionalServices = false;
  quoteLanguage = "es";
  quoteCurrency = "Q";
  extrasSearchTerm = "";
  elements.extrasSearch.value = "";
  clearStoredPackage();
  clearLastSavedActions();
  renderExtrasPicker();
  renderQuote();
}

function setHistoryStatus(message, type = "") {
  elements.historyStatus.textContent = message;
  elements.historyStatus.classList.toggle("is-error", type === "error");
  elements.historyStatus.classList.toggle("is-success", type === "success");
}

function clearHistoryResults() {
  clearNode(elements.historyResults);
}

function historySummary(record) {
  const service = record.serviceName || record.packageName || "Cotización";
  const client = record.clientName || "Sin cliente";
  const eventDate = record.eventDate ? formatDate(record.eventDate) : "Sin fecha";
  return `${record.quoteNumber} · ${client} · ${eventDate} · ${service}`;
}

function renderHistoryResults(records) {
  clearHistoryResults();
  if (!records.length) {
    setHistoryStatus("No se encontraron cotizaciones guardadas.");
    return;
  }

  setHistoryStatus(`${records.length} cotización(es) encontrada(s).`, "success");
  records.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";

    const title = document.createElement("strong");
    title.textContent = historySummary(record);

    const details = document.createElement("span");
    details.textContent = `${record.fileName || "PDF guardado"} · Total ${formatMoney(record.total || 0)}`;

    const actions = document.createElement("div");
    actions.className = "history-item-actions";

    const loadButton = buttonElement("Cargar", () => loadQuoteFromHistory(record.id));
    const openButton = buttonElement("Abrir PDF", () => openPdf(record));
    const localSaveButton = buttonElement("Guardar en computadora", (event, button) =>
      savePdfOnThisComputer(record, setHistoryStatus, button)
    );
    const whatsappButton = buttonElement("Enviar PDF", (event, button) => sendWhatsappPdf(record, setHistoryStatus, button));
    const deleteButton = buttonElement("X", () => deleteQuoteFromHistory(record));
    deleteButton.classList.add("history-delete-button");
    deleteButton.setAttribute("aria-label", `Eliminar cotización ${record.quoteNumber || ""}`);

    actions.append(loadButton, openButton, localSaveButton, whatsappButton, deleteButton);
    item.append(title, details, actions);
    elements.historyResults.appendChild(item);
  });
}

async function fetchHistory(query = elements.historySearch.value.trim()) {
  if (!isLocalServerAvailable()) {
    setHistoryStatus("El historial se activa al abrir el cotizador desde el servidor local.", "error");
    clearHistoryResults();
    return;
  }

  try {
    const params = new URLSearchParams();
    if (query) params.set("search", query);
    const result = await apiRequest(`/api/cotizaciones?${params.toString()}`, {
      method: "GET",
      headers: {}
    });
    const records = result.records || [];
    renderHistoryResults(records);

    const searchedNumber = String(query || "").trim().match(/^\d+/)?.[0] || "";
    if (searchedNumber) {
      const exactMatches = records.filter((record) => {
        const quoteNumber = String(record.quoteNumber || "");
        const quoteCodeValue = String(record.quoteCode || "");
        return quoteNumber === searchedNumber || quoteCodeValue.startsWith(`${searchedNumber}-`);
      });
      if (exactMatches.length === 1) {
        await loadQuoteFromHistory(exactMatches[0].id);
        setHistoryStatus(`Cotización ${searchedNumber} cargada para modificar.`, "success");
      }
    }
  } catch (error) {
    setHistoryStatus(error.message, "error");
    clearHistoryResults();
  }
}

function restoreMap(map, values) {
  map.clear();
  Object.entries(values || {}).forEach(([key, value]) => {
    map.set(key, String(value));
  });
}

function restoreObjectMap(map, values) {
  map.clear();
  Object.entries(values || {}).forEach(([key, value]) => {
    map.set(key, { ...value });
  });
}

function restorePackageItemsMap(map, values) {
  map.clear();
  Object.entries(values || {}).forEach(([key, rows]) => {
    if (Array.isArray(rows)) {
      map.set(key, clonePackageItems(rows));
    }
  });
}

function manualExtraIdsFromQuoteData(data) {
  const ids = [
    ...(Array.isArray(data.manualExtraIds) ? data.manualExtraIds : []),
    ...(Array.isArray(data.selectedExtraIds) ? data.selectedExtraIds : []),
    ...Object.keys(data.extraManualDescriptions || {}),
    ...Object.keys(data.extraQuantities || {}),
    ...Object.keys(data.extraPrices || {})
  ];
  return ids.filter(isManualExtraId);
}

function applyQuoteData(data) {
  const savedNumber = parseStoredNumber(data.quoteNumber);
  if (savedNumber) currentQuoteNumber = savedNumber;
  currentQuoteDate = data.quoteDate || todayIso();

  setQuoteNumberInput(data.quoteNumber || currentQuoteNumber.toString());
  elements.fields.clientName.value = data.clientName || "";
  elements.fields.clientPhone.value = data.clientPhone || "";
  elements.fields.eventName.value = data.eventName || "";
  elements.fields.quoteDate.value = currentQuoteDate;
  elements.fields.eventDate.value = data.eventDate || "";
  elements.fields.groupSchedule.value = data.groupSchedule || "";
  elements.fields.eventPlace.value = data.eventPlace || "";
  elements.fields.guestCount.value = data.guestCount || "";
  elements.fields.notes.value = data.notes || "";

  const packageId = packages.some((pkg) => pkg.id === data.packageId) ? data.packageId : defaultPackageId;
  elements.packageSelect.value = packageId;

  selectedExtras.clear();
  (data.selectedExtraIds || []).forEach((id) => selectedExtras.add(id));
  restoreMap(extraQuantities, data.extraQuantities);
  restoreMap(extraPrices, data.extraPrices);
  restoreMap(extraDimensions, data.extraDimensions);
  restoreMap(extraManualDescriptions, data.extraManualDescriptions);
  resetManualExtras(manualExtraIdsFromQuoteData(data));
  restoreMap(extraComplimentary, data.extraComplimentary);
  restoreObjectMap(extraGeneratorDetails, data.extraGeneratorDetails);
  restoreMap(packageNameOverrides, data.packageNameOverrides);
  restoreMap(packagePriceOverrides, data.packagePriceOverrides);
  restorePackageItemsMap(packageItemOverrides, data.packageItemOverrides);

  includeVat = Boolean(data.includeVat);
  includeDiscount = Boolean(data.includeDiscount);
  includeMountingPage = Boolean(data.includeMountingPage);
  includeAdditionalServices = Boolean(data.includeAdditionalServices);
  elements.discountAmount.value = data.discountAmount || "";
  quoteLanguage = data.language === "en" ? "en" : "es";
  quoteCurrency = data.currency === "$" ? "$" : "Q";
  const legacyTravelAmount = Number(data.entertainmentTravelAmount || 0);
  if (data.includeEntertainmentTravel && legacyTravelAmount > 0) {
    const pkg = currentPackage();
    const legacyTravelId =
      pkg.extrasType === "interior" || pkg.category === "Interior"
        ? "viaticos-interior"
        : "viaticos";
    selectedExtras.add(legacyTravelId);
    extraQuantities.set(legacyTravelId, "1");
    extraPrices.set(legacyTravelId, String(legacyTravelAmount));
  }
  extrasSearchTerm = "";
  elements.extrasSearch.value = "";

  renderExtrasPicker();
  renderQuote();
}

async function loadQuoteFromHistory(id) {
  try {
    const result = await apiRequest(`/api/cotizaciones/${id}`, {
      method: "GET",
      headers: {}
    });
    setEditingQuote(result.record);
    applyQuoteData(result.quoteData || {});
    clearLastSavedActions();
    setDriveStatus(`Cotización ${result.record?.quoteNumber || ""} cargada desde historial.`, "success");
  } catch (error) {
    setHistoryStatus(error.message, "error");
  }
}

async function syncQuoteSequenceFromServer() {
  if (!isLocalServerAvailable() || requestedQuoteNumber || batchState.started || editingQuoteId) return;

  try {
    const result = await apiRequest("/api/secuencia", {
      method: "GET",
      headers: {}
    });
    const serverNextNumber = parseStoredNumber(result.nextNumber);
    if (serverNextNumber && serverNextNumber !== currentQuoteNumber) {
      currentQuoteNumber = serverNextNumber;
      currentQuoteDate = todayIso();
      setQuoteNumberInput(currentQuoteNumber.toString());
      elements.fields.quoteDate.value = currentQuoteDate;
      storeQuoteSequence();
      renderQuote();
    }
  } catch {
    // El cotizador puede seguir funcionando con localStorage si el servidor no responde.
  }
}

function bindEvents() {
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") elements.packageSelect.blur();
  });

  elements.packageSelect.addEventListener("change", () => {
    extrasSearchTerm = "";
    elements.extrasSearch.value = "";
    renderExtrasPicker();
    renderQuote();
  });

  Object.values(elements.fields).forEach((field) => {
    field.addEventListener("input", () => {
      if (field === elements.fields.quoteNumber) {
        const cleanValue = cleanManualQuoteNumber(field.value);
        if (field.value !== cleanValue) field.value = cleanValue;
      }
      renderQuote();
    });
  });

  elements.topPrintButton.addEventListener("click", printQuote);
  elements.topSaveButton.addEventListener("click", saveQuoteToFolder);
  elements.topBatchQuotesButton.addEventListener("click", openBatchDialog);
  elements.topNewQuoteButton.addEventListener("click", resetQuote);
  elements.topVatButton.addEventListener("click", () => {
    includeVat = !includeVat;
    renderQuote();
  });
  elements.topMountingPageButton.addEventListener("click", () => {
    includeMountingPage = !includeMountingPage;
    renderQuote();
  });
  elements.additionalServicesButton.addEventListener("click", () => {
    includeAdditionalServices = !includeAdditionalServices;
    renderQuote();
  });
  elements.topDiscountButton.addEventListener("click", () => {
    includeDiscount = !includeDiscount;
    renderQuote();
    if (includeDiscount) elements.discountAmount.focus();
  });
  elements.topLanguageButton.addEventListener("click", () => {
    quoteLanguage = quoteLanguage === "es" ? "en" : "es";
    renderQuote();
  });
  elements.currencySelect.addEventListener("change", () => {
    quoteCurrency = elements.currencySelect.value === "$" ? "$" : "Q";
    renderQuote();
  });
  elements.manualServiceName.addEventListener("input", () => {
    setPackageNameOverride(currentPackage().id, elements.manualServiceName.value);
    renderQuote();
  });
  elements.manualServicePrice.addEventListener("input", () => {
    setPackagePriceOverride(currentPackage().id, elements.manualServicePrice.value);
    renderQuote();
  });
  elements.manualServiceAddItem.addEventListener("click", () => {
    const pkg = currentPackage();
    const rows = packageEditorItems(pkg);
    insertBeforePackageTotal(rows, ["1", "", packageUsesItemPrices(pkg) ? 0 : undefined, [], {}]);
    setPackageItemsOverride(pkg.id, rows);
    renderManualServiceEditor(pkg, { force: true });
    renderQuote();
  });
  elements.manualServiceAddSubtitle.addEventListener("click", () => {
    const pkg = currentPackage();
    const rows = packageEditorItems(pkg);
    insertBeforePackageTotal(rows, [
      "",
      quoteLanguage === "en" ? "SECTION" : "SUBTÍTULO",
      undefined,
      [],
      { type: "section" }
    ]);
    setPackageItemsOverride(pkg.id, rows);
    renderManualServiceEditor(pkg, { force: true });
    renderQuote();
  });
  elements.manualServiceAddSubtotal.addEventListener("click", () => {
    const pkg = currentPackage();
    const rows = packageEditorItems(pkg);
    insertBeforePackageTotal(rows, ["", "SUB TOTAL", 0, [], { type: "subtotal" }]);
    setPackageItemsOverride(pkg.id, rows);
    renderManualServiceEditor(pkg, { force: true });
    renderQuote();
  });
  elements.manualServiceAddTotal.addEventListener("click", () => {
    const pkg = currentPackage();
    const rows = packageEditorItems(pkg).filter((item) => !isPackageTotalItem(item));
    rows.push(["", "", undefined, [], { type: "total" }]);
    setPackageItemsOverride(pkg.id, rows);
    renderManualServiceEditor(pkg, { force: true });
    renderQuote();
  });
  elements.batchCloseButton.addEventListener("click", closeBatchDialog);
  elements.batchExitButton.addEventListener("click", closeBatchDialog);
  elements.batchCreateButton.addEventListener("click", createBatchQuotes);
  elements.batchModeButton.addEventListener("click", () => {
    if (batchState.started) resetBatchWorkspace();
    else elements.batchQuantity.focus();
  });
  elements.batchHeaderVatButton.addEventListener("click", () => {
    if (!batchState.started) return;
    includeVat = !includeVat;
    renderQuote();
  });
  elements.batchHeaderPrintButton.addEventListener("click", () => {
    if (batchState.started) printQuote();
  });
  elements.batchHeaderNewQuoteButton.addEventListener("click", addBatchDraft);
  elements.batchCopyClientButton.addEventListener("click", copyFirstQuoteClientData);
  elements.batchSaveButton.addEventListener("click", saveBatchQuotes);
  elements.batchServiceSelect.addEventListener("change", () => {
    selectPackage(elements.batchServiceSelect.value);
  });
  elements.batchQuantity.addEventListener("keydown", (event) => {
    if (event.key === "Enter") createBatchQuotes();
  });
  elements.batchDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeBatchDialog();
  });
  elements.extrasSearch.addEventListener("input", () => {
    extrasSearchTerm = elements.extrasSearch.value;
    renderExtrasPicker();
  });
  elements.manualExtrasAddButton.addEventListener("click", () => {
    ensureManualExtraSlotCount(elements.manualExtrasCount.value);
    elements.manualExtrasCount.value = String(manualExtraIds.length);
    renderExtrasPicker();
    renderQuote();
  });

  elements.discountAmount.addEventListener("input", renderQuote);
  window.addEventListener("afterprint", resetPrintFit);
  elements.historySearchButton.addEventListener("click", () => fetchHistory());
  elements.historyRefreshButton.addEventListener("click", () => {
    elements.historySearch.value = "";
    fetchHistory("");
  });
  elements.historySearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") fetchHistory();
  });
  elements.localFolderButton?.addEventListener("click", (event) => {
    chooseLocalPdfFolder(setLocalFolderStatus, event.currentTarget).then(refreshLocalFolderStatus);
  });
  elements.editableQuoteOpenButton?.addEventListener("click", () => {
    elements.editableQuoteFileInput?.click();
  });
  elements.editableQuoteFileInput?.addEventListener("change", (event) => {
    loadEditableQuoteFile(event.target.files?.[0]);
  });

  const preparePdfAssets =
    window.requestIdleCallback || ((callback) => window.setTimeout(callback, 250));
  preparePdfAssets(warmPdfAssets);
}

function bindSiteEvents() {
  elements.loginForm.addEventListener("submit", submitLogin);
  elements.logoutButton.addEventListener("click", logout);
  elements.menuToggleButton?.addEventListener("click", toggleMenu);
  elements.menuBackdrop?.addEventListener("click", () => setMenuOpen(false));
  elements.siteMenuButtons.forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      setActivePage(button.dataset.pageLink);
    });
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setMenuOpen(false);
  });
  window.addEventListener("hashchange", () => {
    if (!elements.siteApp.classList.contains("is-hidden")) {
      setActivePage(window.location.hash.replace("#", "") || "cotizador");
    }
  });
  bindRequirementsEvents();
}

function startQuoteApp() {
  if (quoteAppStarted) return;
  quoteAppStarted = true;

  requestedQuoteNumber = quoteNumberFromUrl();
  const shouldStartNewQuote = shouldStartNewQuoteFromUrl() && !requestedQuoteNumber;
  if (shouldStartNewQuote || requestedQuoteNumber) clearStoredPackage();
  buildPackageSelect();
  populateBatchServiceSelect();
  initializeQuoteSequence();
  if (requestedQuoteNumber) {
    setQuoteSequence(requestedQuoteNumber);
    cleanNewQuoteUrl();
  } else if (shouldStartNewQuote) {
    startNewQuoteSequence();
    cleanNewQuoteUrl();
  }
  elements.fields.quoteDate.value = currentQuoteDate;
  bindEvents();
  renderExtrasPicker();
  renderQuote();
  syncQuoteSequenceFromServer();
  refreshLocalFolderStatus();
  requestedQuoteNumber = null;
  fetchHistory("");
}

async function initializeAccess() {
  bindSiteEvents();

  if (!isLocalServerAvailable()) {
    showApp();
    startQuoteApp();
    return;
  }

  try {
    const response = await fetch("/api/sesion");
    const session = await readApiJson(response);
    if (session.authenticated) {
      showApp();
      startQuoteApp();
    } else {
      showLogin();
    }
  } catch {
    showLogin("No se pudo validar la sesión. Revise el servidor.");
  }
}

initializeAccess();
