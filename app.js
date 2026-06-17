const packages = [
  {
    id: "ninguno",
    category: "Servicios",
    name: "NINGUNO",
    price: 0,
    items: []
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
  currencySelect: document.querySelector("#currencySelect"),
  extrasScope: document.querySelector("#extrasScope"),
  extrasSearch: document.querySelector("#extrasSearch"),
  extrasList: document.querySelector("#extrasList"),
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
  paymentConditionsText: document.querySelector("#paymentConditionsText"),
  notesSection: document.querySelector("#notesSection"),
  docNotes: document.querySelector("#docNotes"),
  discountAmount: document.querySelector("#discountAmount"),
  topBatchQuotesButton: document.querySelector("#topBatchQuotesButton"),
  topVatButton: document.querySelector("#topVatButton"),
  topDiscountButton: document.querySelector("#topDiscountButton"),
  topDiscountPanel: document.querySelector("#topDiscountPanel"),
  topSaveButton: document.querySelector("#topSaveButton"),
  topPrintButton: document.querySelector("#topPrintButton"),
  topNewQuoteButton: document.querySelector("#topNewQuoteButton"),
  topLanguageButton: document.querySelector("#topLanguageButton"),
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
    clientName: document.querySelector("#clientName"),
    clientPhone: document.querySelector("#clientPhone"),
    eventName: document.querySelector("#eventName"),
    quoteDate: document.querySelector("#quoteDate"),
    eventDate: document.querySelector("#eventDate"),
    eventPlace: document.querySelector("#eventPlace"),
    guestCount: document.querySelector("#guestCount"),
    notes: document.querySelector("#notes")
  },
  docFields: {
    eventDate: document.querySelector("#docEventDate"),
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
const packageNameOverrides = new Map();
const packagePriceOverrides = new Map();
const packageItemOverrides = new Map();
const vatRate = 0.12;
let includeVat = false;
let includeDiscount = false;
let extrasSearchTerm = "";
let quoteLanguage = "es";
let quoteCurrency = "Q";
let pdfCssTextCache = "";
const pdfImageDataUriCache = new Map();
const defaultPackageId = "sunday-funday-completo";
const quoteSequenceStart = 10667n;
const quoteStorageKeys = {
  currentNumber: "liveQuoteCurrentNumber",
  currentDate: "liveQuoteCurrentDate"
};
let currentQuoteNumber = quoteSequenceStart;
let currentQuoteDate = "";
let requestedQuoteNumber = null;
let editingQuoteId = null;
let quoteAppStarted = false;
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
  return packageDisplayItems(pkg).reduce(
    (sum, item) => (isPackageSectionItem(item) ? sum : sum + packageItemPrice(item)),
    0
  );
}

function packageItemPriceLabel(value) {
  const price = Number.parseFloat(value);
  return Number.isFinite(price) && price > 0 ? formatMoney(price) : "-------";
}

function packageItemDisplayRows(pkg) {
  const includePrices = packageUsesItemPrices(pkg);
  const rows = [];
  let sectionSubtotal = 0;
  let hasOpenSection = false;

  const addSubtotal = () => {
    if (!includePrices || !hasOpenSection || sectionSubtotal <= 0) return;
    rows.push({
      type: "subtotal",
      qty: "",
      description: quoteLanguage === "en" ? "SUBTOTAL" : "SUB TOTAL",
      price: sectionSubtotal
    });
    sectionSubtotal = 0;
  };

  packageDisplayItems(pkg).forEach((item) => {
    const [qty, description, itemPrice, measurements = []] = item;
    if (isPackageSectionItem(item)) {
      addSubtotal();
      rows.push({ type: "section", description });
      hasOpenSection = true;
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

    if (includePrices) sectionSubtotal += price;
  });

  addSubtotal();
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

function formatCodeDate(dateValue) {
  const [year, month, day] = (dateValue || todayIso()).split("-");
  return `${day}-${month}-${year}`;
}

function quoteCode() {
  return `${currentQuoteNumber}-${formatCodeDate(currentQuoteDate)}`;
}

function storeQuoteSequence() {
  writeStoredValue(quoteStorageKeys.currentNumber, currentQuoteNumber.toString());
  writeStoredValue(quoteStorageKeys.currentDate, currentQuoteDate);
}

function initializeQuoteSequence() {
  currentQuoteNumber =
    parseStoredNumber(readStoredValue(quoteStorageKeys.currentNumber)) || quoteSequenceStart;
  currentQuoteDate = readStoredValue(quoteStorageKeys.currentDate) || todayIso();
  storeQuoteSequence();
}

function startNewQuoteSequence() {
  currentQuoteDate = todayIso();
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
  return `Coti-${currentQuoteNumber}-${service}-${client}-${phone}.pdf`;
}

function setDriveStatus(message, type = "") {
  elements.driveSaveStatus.textContent = message;
  elements.driveSaveStatus.classList.toggle("is-error", type === "error");
  elements.driveSaveStatus.classList.toggle("is-success", type === "success");
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

function whatsappQuoteMessage(record) {
  const quoteNumber = record.quoteNumber ? ` ${record.quoteNumber}` : "";
  const service = record.serviceName || record.packageName || "";
  const serviceText = service ? ` de ${service}` : "";
  const pdfUrl = absoluteAppUrl(record.pdfUrl);
  return `Hola, le comparto la cotización${quoteNumber}${serviceText} de Live Productions:\n${pdfUrl}`;
}

function whatsappShareUrl(record) {
  const text = encodeURIComponent(whatsappQuoteMessage(record));
  const phone = whatsappPhone(record.clientPhone);
  return phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
}

function openPdf(record) {
  if (record.pdfUrl) window.open(absoluteAppUrl(record.pdfUrl), "_blank", "noopener");
}

function openWhatsapp(record) {
  if (!record.pdfUrl) {
    setHistoryStatus("Esta cotización no tiene PDF para enviar por WhatsApp.", "error");
    return;
  }
  window.open(whatsappShareUrl(record), "_blank", "noopener");
}

function buttonElement(text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "secondary-button";
  button.textContent = text;
  button.addEventListener("click", onClick);
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
    buttonElement("Enviar por WhatsApp", () => openWhatsapp(record))
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
    throw new Error(data.error || "No se pudo completar la operación.");
  }
  return data;
}

async function apiRequest(path, options = {}) {
  if (!isLocalServerAvailable()) {
    throw new Error("Abra el cotizador con la app local o ejecute node server.js para guardar y buscar historial.");
  }

  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
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
  const customExtra = manualExtra();
  if (selectedExtras.has(customExtra.id) && extraManualDescription(customExtra.id)) {
    selected.unshift(customExtra);
  }
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
    quoteNumber: currentQuoteNumber.toString(),
    quoteDate: currentQuoteDate,
    quoteCode: quoteCode(),
    fileName: buildPdfFileName(),
    clientName: elements.fields.clientName.value.trim(),
    clientPhone: elements.fields.clientPhone.value.trim(),
    eventName: elements.fields.eventName.value.trim(),
    eventDate: elements.fields.eventDate.value,
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
    extraComplimentary: {},
    extraGeneratorDetails: {},
    selectedExtras: [],
    includeVat: false,
    includeDiscount: false,
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
    "eventDate",
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

    const whatsappButton = buttonElement("WhatsApp", () => openWhatsapp(result));

    actions.append(link, whatsappButton);
    row.append(name, actions);
    elements.batchSavedResults.appendChild(row);
  });
  elements.batchSavedResults.classList.remove("is-hidden");
}

async function saveBatchQuotes() {
  if (!batchState.started || !batchState.drafts.length || batchState.saving) return;
  captureActiveBatchDraft();

  let serverStart;
  try {
    serverStart = await fetchNextQuoteNumber();
  } catch (error) {
    setBatchStatus(error.message, "error");
    return;
  }

  const quoteDate = todayIso();
  batchState.drafts = batchState.drafts.map((draft, index) => ({
    data: assignQuoteNumber(draft.data, batchQuoteNumber(serverStart, index), quoteDate),
    savedResult: null
  }));
  batchState.baseNumber = serverStart;
  const lastNumber = batchQuoteNumber(serverStart, batchState.drafts.length - 1);
  batchState.suppressCapture = true;
  applyQuoteData(batchState.drafts[batchState.activeIndex].data);
  batchState.suppressCapture = false;
  renderBatchDraftList();

  const confirmed = window.confirm(
    `¿Está seguro que desea guardar ${batchState.drafts.length} cotizaciones?\n\n` +
      `Se crearán PDFs individuales con correlativos del ${serverStart} al ${lastNumber}.`
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
    setBatchStatus(
      `${batchState.results.length} PDFs guardados en ${result.folder || "cotizaciones-generadas"}. Siguiente correlativo: ${result.nextNumber}.`,
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
  if (!editingQuoteId) await syncQuoteSequenceFromServer();

  const isEditing = Boolean(editingQuoteId);
  const confirmed = window.confirm(
    isEditing
      ? `¿Está seguro que desea actualizar la cotización ${quoteCode()}?\n\nAceptar reemplazará el PDF de esta cotización sin cambiar el correlativo.`
      : `¿Está seguro que desea guardar la cotización ${quoteCode()}?\n\nAceptar guardará el PDF y avanzará el correlativo. Cancelar conservará el mismo número.`
  );
  if (!confirmed) {
    setDriveStatus(`Guardado cancelado. El correlativo ${currentQuoteNumber} no cambió.`);
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
    renderLastSavedActions({
      ...payload.quoteData,
      ...result,
      serviceName: payload.quoteData.packageName,
      total: payload.quoteData.totals?.grandTotal || 0
    });
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
    manual: Boolean(settings.manual)
  };
}

function manualExtraRow() {
  const id = "extra-manual";
  return [
    id,
    "1",
    extraManualDescriptions.get(id) || "",
    0,
    {
      manual: true,
      priceMode: "total",
      quantityLabel: "Cantidad",
      priceLabel: "Monto",
      unitSuffix: ""
    }
  ];
}

function manualExtra() {
  return normalizeExtra(manualExtraRow());
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
  const customExtra = manualExtra();
  const allExtras = [customExtra, ...currentExtrasList().map(normalizeExtra)];
  const availableIds = new Set(allExtras.map((item) => item.id));
  const search = normalizedSearchText(extrasSearchTerm);
  const regularExtras = allExtras.filter((extra) => !extra.manual);
  const availableExtras = [
    customExtra,
    ...(search
      ? regularExtras.filter((extra) => normalizedSearchText(extra.description).includes(search))
      : regularExtras)
  ];

  [...selectedExtras].forEach((id) => {
    if (!availableIds.has(id)) {
      selectedExtras.delete(id);
      extraQuantities.delete(id);
      extraPrices.delete(id);
      extraDimensions.delete(id);
      extraManualDescriptions.delete(id);
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
      if (event.target.closest("input") || event.target.closest(".extra-field")) return;
      checkbox.checked = !checkbox.checked;
      setExtraSelection(checkbox.checked);
    });

    const copy = document.createElement("span");
    copy.className = "extra-option-copy";

    const name = document.createElement("strong");
    name.textContent = extra.manual ? "Extra manual" : extra.description;

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
      const cell = makeCell(item.description);
      cell.colSpan = includePrices ? 3 : 2;
      row.appendChild(cell);
      elements.packageItems.appendChild(row);
      return;
    }

    if (item.type === "subtotal") {
      row.className = "package-subtotal-row";
      const labelCell = makeCell(item.description);
      labelCell.colSpan = 2;
      row.append(labelCell, makeCell(packageItemPriceLabel(item.price), "price-column"));
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

    if (normalizePackageItemMeta(meta).type === "section") {
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

      row.append(makeManualServiceField(subtitleLabel, titleInput), deleteButton);
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

  elements.quotePackageTitle.textContent = hasServiceDetail
    ? packageDisplayName(pkg)
    : translateQuoteText("COTIZACIÓN DE EXTRAS");
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
  extraComplimentary.clear();
  extraGeneratorDetails.clear();
  packageNameOverrides.clear();
  packagePriceOverrides.clear();
  packageItemOverrides.clear();
  Object.values(elements.fields).forEach((field) => {
    field.value = "";
  });
  elements.fields.quoteDate.value = currentQuoteDate;
  elements.packageSelect.value = defaultPackageId;
  includeDiscount = false;
  elements.discountAmount.value = "";
  includeVat = false;
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
    const whatsappButton = buttonElement("WhatsApp", () => openWhatsapp(record));
    const deleteButton = buttonElement("X", () => deleteQuoteFromHistory(record));
    deleteButton.classList.add("history-delete-button");
    deleteButton.setAttribute("aria-label", `Eliminar cotización ${record.quoteNumber || ""}`);

    actions.append(loadButton, openButton, whatsappButton, deleteButton);
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
    renderHistoryResults(result.records || []);
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

function applyQuoteData(data) {
  const savedNumber = parseStoredNumber(data.quoteNumber);
  if (savedNumber) currentQuoteNumber = savedNumber;
  currentQuoteDate = data.quoteDate || todayIso();

  elements.fields.clientName.value = data.clientName || "";
  elements.fields.clientPhone.value = data.clientPhone || "";
  elements.fields.eventName.value = data.eventName || "";
  elements.fields.quoteDate.value = currentQuoteDate;
  elements.fields.eventDate.value = data.eventDate || "";
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
  restoreMap(extraComplimentary, data.extraComplimentary);
  restoreObjectMap(extraGeneratorDetails, data.extraGeneratorDetails);
  restoreMap(packageNameOverrides, data.packageNameOverrides);
  restoreMap(packagePriceOverrides, data.packagePriceOverrides);
  restorePackageItemsMap(packageItemOverrides, data.packageItemOverrides);

  includeVat = Boolean(data.includeVat);
  includeDiscount = Boolean(data.includeDiscount);
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
    field.addEventListener("input", renderQuote);
  });

  elements.topPrintButton.addEventListener("click", printQuote);
  elements.topSaveButton.addEventListener("click", saveQuoteToFolder);
  elements.topBatchQuotesButton.addEventListener("click", openBatchDialog);
  elements.topNewQuoteButton.addEventListener("click", resetQuote);
  elements.topVatButton.addEventListener("click", () => {
    includeVat = !includeVat;
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
    rows.push(["1", "", packageUsesItemPrices(pkg) ? 0 : undefined, [], {}]);
    setPackageItemsOverride(pkg.id, rows);
    renderManualServiceEditor(pkg, { force: true });
    renderQuote();
  });
  elements.manualServiceAddSubtitle.addEventListener("click", () => {
    const pkg = currentPackage();
    const rows = packageEditorItems(pkg);
    rows.push(["", quoteLanguage === "en" ? "SECTION" : "SUBTÍTULO", undefined, [], { type: "section" }]);
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
