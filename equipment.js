const djCompletoAudioOptions = {
  qsc: {
    label: "Audio QSC",
    items: [
      [4, "bocinas QSC con su power spicon"],
      [2, "sub QSC con su case"],
      [1, "amplificador TP18000 con sus 2 cables spicon en case (1 DBX y 1 AC)"],
      [2, "pedestales de bocina hercules con su case"],
      [1, "grabadora de audio"]
    ]
  },
  t4: {
    label: "Audio T4 / JBL",
    items: [
      [2, "bajos dobles JBL con su power spicon"],
      [4, "bocinas T4 con su power spicon"],
      [2, "bompers de T4"],
      [2, "pedestales de bocina hercules con su case"],
      [1, "amplificador TP18000 con sus 2 cables spicon en case (1 DBX y 1 AC)"]
    ]
  },
  turbosound: {
    label: "Audio Turbosound",
    items: [
      [2, "monitores turbosound con su power spicon en su case"],
      [2, "bajos turbosound con su power spicon en su case"],
      [2, "pedestales de bocina hercules con su case"],
      [1, "grabadora de audio"]
    ]
  }
};

const djCompletoMainSections = [
  {
    title: "CONSOLA",
    items: [
      [1, "consola X18 Rack con su AC y case"],
      [1, "router con su funda (cable de RED y cargador)"],
      [1, "ipad viejo con su protector y cargador de ipad con su cable"]
    ]
  },
  {
    title: "TELEFONO (MOCHILA)",
    items: [
      [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
      [1, "cable lightning y cable tipo C"]
    ]
  },
  {
    id: "audio-dinamico",
    title: "AUDIO",
    audioVariant: true,
    items: djCompletoAudioOptions.qsc.items
  },
  {
    title: "MICROFONIA",
    items: [
      [1, "mic. Sm 58 inalambrico con su funda (1 receptor y 1 cargador)"],
      [2, "cajas directas Whirlwhind"]
    ]
  },
  {
    title: "MONITOREO INTERNO",
    items: [
      [1, "monitores turbosound con su power spicon en su case"]
    ]
  },
  {
    title: "ILUMINACION",
    items: [
      [6, "beam 260 con su power spicon y case"],
      [6, "pares LED con su AC y case"],
      [2, "lasers pequenos con sus power spicon y case"],
      [24, "clamps"],
      [24, "bases de clamps"],
      [4, "tubos galvanizados con sus hamburguesas dobles"],
      [2, "spliter de luces 6 canales american dj con su AC"],
      [2, "blinders con sus power spicon y case"],
      [1, "interfaz con su cable de RED y su cargador (compu mouse, cargador, adaptador) (monitor, HDMI, cable de corriente) con su case"],
      [2, "maquinas de humo con su AC, su control y 1 caja plastica"],
      [1, "galon de liquido de humo"],
      [2, "ventilador con su cable de corriente y su funda"]
    ]
  },
  {
    title: "ESTRUCTURAS",
    items: [
      [2, "marcos de dj booth con su tela (grande) controles"],
      [1, "marco de dj booth con su tela (pequeno) DJ"],
      [1, "dj booth case"]
    ]
  },
  {
    title: "ESTRUCTURAS DE 2 A 3.50 METROS FORRADAS",
    items: [
      [6, "estructuras de 2 metros"],
      [8, "estructuras de 0.50 centimetros"],
      [6, "platinas pequenas"],
      [6, "platinas grandes"],
      [100, "pines"],
      [40, "chiches"]
    ]
  },
  {
    title: "TELAS PARA FORRAR",
    items: [
      [6, "telas de 3mts para forrar truss en color a definir"],
      [1, "tela pequena para forrar dj booth color a definir (DJ)"],
      [2, "tela grande para forrar dj booth color negro (controles)"]
    ]
  },
  {
    title: "CABLEADO",
    items: [
      [1, "distro de corriente"],
      [5, "cables AC"],
      [5, "cables spicon power"],
      [2, "cables de 1/4 a 1/4"],
      [1, "case de pulpos (6 grandes y 6 pequenos)"],
      [1, "tcj calibre No. 4 (30 metros)"],
      [6, "cuadritos de corriente"],
      [6, "regletas en case"],
      [40, "cables XLR en case"],
      [30, "extensiones"]
    ]
  },
  {
    title: "BATERIAS",
    items: [
      [16, "baterias recargables bonai"],
      [1, "cargador para bateria bonai"]
    ]
  }
];

const djCompletoExtras = [
  {
    id: "dj-extras-operativos",
    title: "Extras",
    items: [
      [1, "extintor"],
      [1, "bolsa de agua pura"],
      [5, "dop teip (caja de herramienta)"],
      [3, "paquetes de cinchos (caja de herramienta)"],
      [7, "cinta de aislar (caja de herramienta)"],
      [2, "intercomunicadores hollyland con sus cargadores y estuche"]
    ]
  },
  {
    id: "dj-caja-herramientas",
    title: "Caja de Herramienta",
    items: [
      [1, "macho"],
      [2, "tomas patas de gallo"],
      [1, "flipon doble de 50 amp"],
      [1, "desarmador de estrella"],
      [1, "desarmador de castigaderas"],
      [1, "cuchilla o cutter"],
      [1, "estuche de llaves Allen"],
      [1, "alicate"],
      [1, "tenaza"],
      [1, "pinza"],
      [1, "espiga tipo tester"],
      [1, "multimetro o tester marca fluke (estuche)"]
    ]
  },
  {
    id: "dj-equipo-limpieza",
    title: "Equipo de limpieza",
    items: [
      [5, "trapos"],
      [1, "escoba"],
      [1, "pala"],
      [5, "trapiadores"],
      [1, "atomizador de azistin"],
      [1, "atomizador de cera"],
      [2, "espumas limpiadoras"]
    ]
  },
  {
    id: "dj-equipo-proteccion",
    title: "Equipo de Proteccion",
    items: [
      [10, "bolsas jardineras de tonel"],
      [3, "retazos de nylon para tapar equipo"]
    ]
  },
  {
    id: "dj-seguridad-industrial",
    title: "Equipo de Seguridad Industrial",
    items: [
      [6, "casco"],
      [6, "chalecos"],
      [0, "botas"],
      [6, "pares de guantes"],
      [1, "arnes completo para subir"]
    ]
  }
];

const saxofonicCompletoMainSections = [
  {
    title: "CONSOLA",
    items: [
      [1, "consola analoga con su AC y case"]
    ]
  },
  {
    title: "TELEFONO (MOCHILA)",
    items: [
      [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
      [1, "cable lightning y cable tipo C"]
    ]
  },
  {
    id: "audio-dinamico",
    title: "AUDIO",
    audioVariant: true,
    items: djCompletoAudioOptions.qsc.items
  },
  {
    title: "MICROFONIA",
    items: [
      [1, "mic. Saxo con su funda (1 receptor y 1 cargador)"]
    ]
  },
  {
    title: "CABLEADO",
    items: [
      [5, "regletas en case"],
      [10, "cables XLR en Case"],
      [10, "extensiones"]
    ]
  },
  {
    title: "BATERIAS",
    items: [
      [16, "baterias recargables bonai"],
      [1, "cargador para bateria bonai"]
    ]
  }
];

const sharedEquipmentExtras = [
  {
    id: "tarima-610-366",
    title: "TARIMA DE 6.10 X 3.66 MTS",
    items: [
      [15, "planchas de 1.22 x 1.22 (con velcro)"],
      [1, "gradas de 0.50 cm."],
      [6, "andamios de 60cm."],
      [20, "coronas normales (cubeta plastica)"],
      [6, "coronas de travesaño (cubeta plastica)"],
      [4, "esquineras (cubeta plastica)"],
      [1, "caja de calsa (caja plastica)"],
      [1, "rollo de vinil color negro"],
      [1, "rollos de mounting tape"],
      [1, "faldon de 24mts color negro / blanco"]
    ]
  },
  {
    id: "pista-baile-610-366-blanca",
    title: "PISTA DE BAILE 6.10 X 3.66 MTS BLANCA",
    items: [
      [15, "planchas de 1.22 x 1.22"],
      [20, "coronas para pista (cubeta plastica)"],
      [15, "pedazos de alfombra (en pedacitos)"],
      [2, "rollos de mounting tape"],
      [2, "caja de calsa (caja plastica)"],
      [1, "rollo de vinil blanco"]
    ]
  },
  {
    id: "pista-baile-610-366-diseno",
    title: "PISTA DE BAILE 6.10 X 3.66 MTS CON DISEÑO",
    items: [
      [15, "planchas de 1.22 x 1.22"],
      [20, "coronas para pista (cubeta plastica)"],
      [15, "pedazos de alfombra (en pedacitos)"],
      [2, "caja de calsa (caja plastica)"]
    ]
  },
  {
    id: "pantalla-6x4",
    title: "PANTALLA DE 6 X 4 MTS",
    items: [
      [50, "modulos de pantalla en case"],
      [1, "computadora de pantalla con su cargador, mouse y case"],
      [1, "procesador de pantalla con su AC y su case"],
      [1, "clickers completo"],
      [1, "interfaz de audio volth 2"],
      [1, "atem mini con su cargador y funda"],
      [1, "interfaz akain con su cargador y funda"],
      [50, "cables de corriente con su case"],
      [50, "cables de señal con su case"],
      [10, "cables spicon power"],
      [2, "cables de DVI A DVI con su case"],
      [2, "cables de HDMI A DVI con su case"],
      [2, "cables de HDMI A HDMI con su case"],
      [2, "cables de USB a datos con su case"],
      [4, "cat 5 de 50mts. con su case"],
      [2, "HDMI de 5mts con su case"],
      [6, "estructuras de 2 metros"],
      [6, "estructuras de 1 metro"],
      [12, "estructuras de 0.50 centimetros"],
      [6, "platinas grandes"],
      [100, "pines"],
      [72, "chiches"],
      [2, "straps"],
      [2, "retazos de tela de 8 metros color negro"]
    ]
  },
  {
    id: "pantalla-3x2",
    title: "PANTALLA DE 3 X 2 MTS",
    items: [
      [14, "modulos de pantalla en case"],
      [1, "computadora de pantalla con su cargador, mouse y case"],
      [1, "procesador de pantalla con su AC y su case"],
      [1, "clickers completo"],
      [1, "interfaz de audio volth 2"],
      [1, "atem mini con su cargador y funda"],
      [1, "interfaz akain con su cargador y funda"],
      [14, "cables de corriente con su case"],
      [14, "cables de señal con su case"],
      [4, "cables spicon power"],
      [1, "cables de DVI A DVI con su case"],
      [1, "cables de HDMI A DVI con su case"],
      [1, "cables de HDMI A HDMI con su case"],
      [1, "cables de USB a datos con su case"],
      [2, "cat 5 de 10mts. con su case"],
      [1, "HDMI de 5mts con su case"],
      [2, "estructuras de 2 metros"],
      [2, "estructuras de 0.50 centimetros"],
      [2, "platinas grandes"],
      [24, "pines"],
      [8, "chiches"],
      [2, "straps"],
      [2, "retazos de tela de 8 metros color negro"]
    ]
  },
  {
    id: "tarima-dj-488-366",
    title: "TARIMA DJ DE 4.88 X 3.66 MTS",
    items: [
      [12, "planchas de 1.22 x 1.22 (con velcro)"],
      [1, "gradas de 0.50 cm."],
      [6, "andamios de 0.60cm."],
      [18, "coronas normales (cubeta plastica)"],
      [6, "coronas de travesaño (cubeta plastica)"],
      [4, "esquineras (cubeta plastica)"],
      [1, "caja de calsa (caja plastica)"],
      [1, "rollo de vinil color negro"],
      [1, "rollos de mounting tape"],
      [1, "faldon de 24mts color negro y blanco"]
    ]
  },
  {
    id: "ceremonia",
    title: "CEREMONIA",
    items: [
      [1, "consola analoga con su AC y case"],
      [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
      [1, "cable lightning y cable tipo C"],
      [2, "IP 2000 con fundas"],
      [1, "mic. Sm 58 inalambrico con su funda (1 receptor y 1 cargador)"],
      [1, "Pedestales de brazo con su Case"],
      [1, "Microfono de Diadema color piel"],
      [16, "baterias recargables bonai"],
      [1, "cargador para bateria bonai"]
    ]
  },
  {
    id: "saxofonic-con-audio",
    title: "SAXOFONIC CON AUDIO",
    items: [
      [1, "consola analoga con su AC y case"],
      [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
      [1, "cable lightning y cable tipo C"],
      [2, "IP 2000 con fundas"],
      [1, "mic. Saxo con su funda (1 receptor y 1 cargador)"],
      [5, "regletas en case"],
      [10, "cables XLR en Case"],
      [10, "extensiones"],
      [16, "baterias recargables bonai"],
      [1, "cargador para bateria bonai"]
    ]
  }
];

const saxofonicConAudioExtra = sharedEquipmentExtras.find((extra) => extra.id === "saxofonic-con-audio");
const saxofonicConAudioMainSections = saxofonicConAudioExtra
  ? [{ title: saxofonicConAudioExtra.title, items: saxofonicConAudioExtra.items.map((item) => [...item]) }]
  : [];

const sundayFundayServiceIds = [
  "sunday-funday-bateria-acustica-opcion-a",
  "sunday-funday-bateria-acustica-opcion-b",
  "sunday-funday-bateria-electrica-opcion-a",
  "sunday-funday-bateria-electrica-opcion-b",
  "sunday-funday-bateria-acustica-opcion-a-pantalla-led-6x3mts-sobre-tarima",
  "sunday-funday-bateria-acustica-opcion-a-pantalla-led-6x3mts-al-ras-de-piso",
  "sunday-funday-bateria-acustica-opcion-a-solo-show",
  "sunday-funday-opcion-a-pantalla-en-modulos"
];

const sundayFundayServices = {
  "sunday-funday-bateria-acustica-opcion-a": {
    name: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION A",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-acustica-opcion-b": {
    name: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION B",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 rack con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Dass con power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo Grech con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja Grech con funda"
          ],
          [
            1,
            "Tom no.1 Grech con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom Grech con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color blanco de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color blanco (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-electrica-opcion-a": {
    name: "SUNDAY FUNDAY - BATERIA ELECTRICA OPCION A",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Bateria Electrica",
        items: [
          [
            1,
            "Bateria electrica con cable de corriente"
          ],
          [
            2,
            "cable XLR de 1/4\" a XLR macho"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-electrica-opcion-b": {
    name: "SUNDAY FUNDAY - BATERIA ELECTRICA OPCION B",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 rack con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Dass con power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Bateria Electrica",
        items: [
          [
            1,
            "Bateria electrica con cable de corriente"
          ],
          [
            2,
            "cable XLR de 1/4\" a XLR macho"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructuras DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color blanco de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color blanco (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-acustica-opcion-a-pantalla-led-6x3mts-sobre-tarima": {
    name: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION A PANTALLA LED 6x3MTS SOBRE TARIMA",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "PANTALLA 6 X 3 METROS",
        items: [
          [
            40,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Switcher Atem mini con cargador"
          ],
          [
            1,
            "Interfaz Akai con cargador"
          ]
        ]
      },
      {
        title: "CABLES PARA PANTALLA 6 X 3 METROS",
        items: [
          [
            40,
            "Cable de corriente"
          ],
          [
            40,
            "Cable de señal"
          ],
          [
            10,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        title: "Estructura para pantalla",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            6,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ],
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            1,
            "Distro pequeño"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-acustica-opcion-a-pantalla-led-6x3mts-al-ras-de-piso": {
    name: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION A PANTALLA LED 6x3MTS AL RAS DE PISO",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "PANTALLA 6 X 3 METROS",
        items: [
          [
            40,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Switcher Atem mini con cargador"
          ],
          [
            1,
            "Interfaz Akai con cargador"
          ]
        ]
      },
      {
        title: "CABLES PARA PANTALLA 6 X 3 METROS",
        items: [
          [
            40,
            "Cable de corriente"
          ],
          [
            40,
            "Cable de señal"
          ],
          [
            10,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        title: "Estructura para pantalla",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            6,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        title: "Porteria para pantalla",
        items: [
          [
            2,
            "Truss 2 mt"
          ],
          [
            2,
            "Truss 1 mt"
          ],
          [
            3,
            "Truss 0.50 cm"
          ],
          [
            3,
            "Platina grande"
          ],
          [
            3,
            "Cubo 0.30 cm."
          ],
          [
            80,
            "Pin"
          ],
          [
            45,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ],
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            1,
            "Distro pequeño"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-bateria-acustica-opcion-a-solo-show": {
    name: "SUNDAY FUNDAY - BATERIA ACUSTICA OPCION A SOLO SHOW",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            8,
            "Cuadro de corriente"
          ],
          [
            8,
            "Regleta"
          ],
          [
            30,
            "Cable XLR"
          ],
          [
            20,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            3,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  },
  "sunday-funday-opcion-a-pantalla-en-modulos": {
    name: "SUNDAY FUNDAY - OPCION A PANTALLA EN MODULOS",
    source: "EQUIPO-DE-AUDIO.xlsx / SUNDAY FUNDAY",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "pantalla en modulos 3 metros",
        items: [
          [
            24,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        title: "Cable para Pantalla de 3 metros",
        items: [
          [
            24,
            "Cable de corriente"
          ],
          [
            24,
            "Cable de señal"
          ],
          [
            8,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "Cat 5 de 10mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        title: "Estructura para pantalla",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            12,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ],
          [
            7,
            "Chaco"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            2,
            "retazos de tela de 8 metros color negro"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            2,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            70,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            1,
            "Toldo 2x2 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      }
    ],
    extras: []
  }
};

const novaloopsServiceIds = [
  "novaloops-completo"
];

const novaloopsServices = {
  "novaloops-completo": {
    name: "NOVALOOPS - COMPLETO",
    source: "EQUIPO-DE-AUDIO.xlsx / NOVALOOPS",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            2,
            "In ears Phenyx con cargador y case"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            3,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Pedestales",
        items: [
          [
            1,
            "Pedestal recto"
          ],
          [
            6,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "Estructura DJ",
        items: [
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "Estructura Luces",
        items: [
          [
            4,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            4,
            "Platina pequeña"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            50,
            "Pin"
          ],
          [
            24,
            "Chiche"
          ]
        ]
      },
      {
        title: "Telas para forrar estructuras",
        items: [
          [
            4,
            "Funda para truss color negro de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            6,
            "Cuadro de corriente"
          ],
          [
            6,
            "Regleta"
          ],
          [
            60,
            "Cable XLR"
          ],
          [
            40,
            "Extensión"
          ]
        ]
      },
      {
        title: "Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  }
};

const estuardoReynaServiceIds = [
  "estuardo-reyna-sunday-funday-completo-opcion-a",
  "estuardo-reyna-dj-completo-villa-bokeh",
  "estuardo-reyna-violin-completo-san-jose-el-viejo"
];

const estuardoReynaServices = {
  "estuardo-reyna-sunday-funday-completo-opcion-a": {
    name: "Sunday Funday Completo OPCION A Audio para ceremonia y Tarima 6x4 \"Con vinil impreso\", luces extras en truss",
    source: "EQUIPO-DE-AUDIO.xlsx / ESTUARDO REYNA",
    mainSections: [
      {
        title: "CEREMONIA / Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "CEREMONIA / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "CEREMONIA / Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "CEREMONIA / In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        title: "CEREMONIA / Microfonia para voces",
        items: [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ],
          [
            1,
            "Mic. de diadema SHURE color piel"
          ]
        ]
      },
      {
        title: "CEREMONIA / Pedestales",
        items: [
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "RECEPCION / Consola",
        items: [
          [
            1,
            "Consola X32 mesa digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "RECEPCION / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "RECEPCION / Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Snake de 18 canales"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "RECEPCION / Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ]
        ]
      },
      {
        title: "RECEPCION / Computadora",
        items: [
          [
            1,
            "Computadora para prueba Macbookpro (Mochila con, Computador Mac, Cargador de Mac, Cable, Cable para Impresora, Cables de C a B, Cleaning Kit, Jet Dryer Blower Air Duster, Quick Charging portable, Juego de llaves combinadas con matraca, Uña para mic SM57 Alambrico y Estuche)"
          ]
        ]
      },
      {
        title: "RECEPCION / In ears",
        items: [
          [
            8,
            "In ears Acemic (Belpack y transmisor)"
          ],
          [
            6,
            "In ears Shure (Belpack y transmisor)"
          ],
          [
            2,
            "Antena pasivas Shure"
          ],
          [
            1,
            "Antena In ears Shure"
          ],
          [
            6,
            "Bateria cuadrada Shure"
          ],
          [
            3,
            "Cargador para bateria cuadrada"
          ],
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "RECEPCION / Case de Pedestales de Bateria",
        items: [
          [
            1,
            "Bombo DW con funda"
          ],
          [
            1,
            "Alfombra"
          ],
          [
            1,
            "Banquito DW"
          ],
          [
            2,
            "Par de baquetas con estuche"
          ],
          [
            1,
            "Caja DW con funda"
          ],
          [
            1,
            "Tom no.1 DW con funda"
          ],
          [
            1,
            "Tom no.2 con funda"
          ],
          [
            1,
            "Pedal de bombo"
          ],
          [
            1,
            "Floortom DW con funda"
          ]
        ]
      },
      {
        title: "RECEPCION / Case de platos",
        items: [
          [
            1,
            "Hit hat zildjan con funda"
          ],
          [
            1,
            "China zildjan con funda"
          ],
          [
            1,
            "Ride zildjan con funda"
          ]
        ]
      },
      {
        title: "RECEPCION / Microfonia para bateria",
        items: [
          [
            4,
            "Mic. SM57 alambrico"
          ],
          [
            1,
            "Mic. Beta 52A"
          ],
          [
            2,
            "Mic. Pg81"
          ],
          [
            4,
            "Clamp para microfono de metal"
          ]
        ]
      },
      {
        title: "RECEPCION / Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 alambrico"
          ],
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            1,
            "Mic QLX-D2-J50"
          ],
          [
            1,
            "Mic. BLX2 M15 con funda (rosado)"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "RECEPCION / Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "RECEPCION / Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Luz circular con cable power spicon"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Pistola LED CO2",
        items: [
          [
            1,
            "Pistola de CO2"
          ],
          [
            1,
            "Manguera de 10mts."
          ],
          [
            1,
            "Cilindro CO2"
          ],
          [
            1,
            "Cangrejo"
          ],
          [
            1,
            "Trocket"
          ],
          [
            1,
            "Strap pequeño"
          ],
          [
            1,
            "Funda para cilindro CO2"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Pirotecnia Fria",
        items: [
          [
            2,
            "Maquina de pirotecnia fria"
          ],
          [
            2,
            "Sobre para pirotecnia medium"
          ],
          [
            1,
            "DMX"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            2,
            "Cajon de madera negro para músicos"
          ],
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Iluminacion Extra (En Truss)",
        items: [
          [
            12,
            "Beam 260 con cable power spicon"
          ],
          [
            12,
            "Par LED RGB con cable ac"
          ],
          [
            12,
            "Truss 2 mt"
          ],
          [
            12,
            "Platina pequeña"
          ],
          [
            12,
            "Platina grande"
          ],
          [
            40,
            "Pin"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            12,
            "Funda para truss color negro de 2 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ],
          [
            10,
            "retazos de tela color negro"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            90,
            "Cable XLR"
          ],
          [
            60,
            "Extensión"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Toldos",
        items: [
          [
            1,
            "Toldo 3x3 blanco"
          ],
          [
            2,
            "Mesa plegable"
          ],
          [
            2,
            "Par LED con cable ac"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Tarima de 6.10 x 3.66 mts.",
        items: [
          [
            15,
            "Plancha de 1.22 x 1.22"
          ],
          [
            1,
            "Grada de 0.50 cm."
          ],
          [
            6,
            "Andamio 0.50 cm"
          ],
          [
            20,
            "Corona para tarima"
          ],
          [
            6,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de mounting tape"
          ]
        ]
      }
    ],
    extras: []
  },
  "estuardo-reyna-dj-completo-villa-bokeh": {
    name: "DJ Completo - Villa Bokeh Audio para ceremonia, audio para coctel, luces extras colgadas",
    source: "EQUIPO-DE-AUDIO.xlsx / ESTUARDO REYNA",
    mainSections: [
      {
        title: "CEREMONIA / Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "CEREMONIA / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "CEREMONIA / Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "CEREMONIA / In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        title: "CEREMONIA / Microfonia para voces",
        items: [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ],
          [
            1,
            "Mic. de diadema SHURE color piel"
          ]
        ]
      },
      {
        title: "CEREMONIA / Pedestales",
        items: [
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "COCTEL / Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "COCTEL / Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "RECEPCION / Consola",
        items: [
          [
            1,
            "Consola XR18 digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "RECEPCION / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "RECEPCION / Audio",
        items: [
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "RECEPCION / Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ]
        ]
      },
      {
        title: "RECEPCION / In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            6,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "RECEPCION / Microfonia para voces",
        items: [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "RECEPCION / Pedestales",
        items: [
          [
            4,
            "Pedestal recto"
          ],
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "RECEPCION / Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            1,
            "Spliter American DJ con cable ac"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Iluminacion Extra (Colgadas)",
        items: [
          [
            12,
            "Beam 260 con cable power spicon"
          ],
          [
            12,
            "Par LED RGB con cable ac"
          ],
          [
            20,
            "Pedazos de alfombra negra de 50 X 50cm"
          ],
          [
            40,
            "Strap gris"
          ],
          [
            3,
            "Escalera"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            10,
            "retazos de tela color negro"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            100,
            "Cable XLR"
          ],
          [
            80,
            "Extensión"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ],
          [
            30,
            "Pasacable"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            10,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            10,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  },
  "estuardo-reyna-violin-completo-san-jose-el-viejo": {
    name: "Violin Completo - San José El Viejo Audio para ceremonia, audio para coctel, luces extras en truss",
    source: "EQUIPO-DE-AUDIO.xlsx / ESTUARDO REYNA",
    mainSections: [
      {
        title: "CEREMONIA / Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "CEREMONIA / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "CEREMONIA / Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "CEREMONIA / In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        title: "CEREMONIA / Microfonia para voces",
        items: [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ],
          [
            1,
            "Mic. de diadema SHURE color piel"
          ]
        ]
      },
      {
        title: "CEREMONIA / Pedestales",
        items: [
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      },
      {
        title: "COCTEL / Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "COCTEL / Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "RECEPCION / Consola",
        items: [
          [
            1,
            "Consola XR18 digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "RECEPCION / Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "RECEPCION / Audio",
        items: [
          [
            4,
            "Bocinas QSC con 2 cables power spicon y 2 cables puente"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            2,
            "Sub QSC 18 pasivo"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "RECEPCION / Monitoreo",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ]
        ]
      },
      {
        title: "RECEPCION / In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            4,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "RECEPCION / Microfonia para voces",
        items: [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "RECEPCION / Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            2,
            "Tubo galvanizado"
          ],
          [
            2,
            "Hamburguesa doble"
          ],
          [
            1,
            "Spliter American DJ con cable ac"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Iluminacion Extra (En Truss)",
        items: [
          [
            12,
            "Beam 260 con cable power spicon"
          ],
          [
            12,
            "Par LED RGB con cable ac"
          ],
          [
            12,
            "Truss 2 mt"
          ],
          [
            12,
            "Platina pequeña"
          ],
          [
            12,
            "Platina grande"
          ],
          [
            40,
            "Pin"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            12,
            "Funda para truss color negro de 2 mts"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            10,
            "retazos de tela color negro"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            10,
            "Cuadro de corriente"
          ],
          [
            10,
            "Regleta"
          ],
          [
            100,
            "Cable XLR"
          ],
          [
            80,
            "Extensión"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ],
          [
            10,
            "Pasacable"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            7,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            10,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  }
};

const djSheetServiceIds = [
  "dj-completo-audio-jbl",
  "dj-privado"
];

const djSheetServices = {
  "dj-completo-audio-jbl": {
    name: "DJ COMPLETO - AUDIO JBL",
    source: "EQUIPO-DE-AUDIO.xlsx / DJ",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola XR18 digital con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            4,
            "Bajo doble JBL 18 pasivo con cable power spicon"
          ],
          [
            6,
            "Bocina T4 con power spicon"
          ],
          [
            2,
            "Bomper T4"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Amplificador TP 18000 con Procesador DBX con 2 cables power spicon y 1 cable ac"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            1,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            2,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            6,
            "Cuadro de corriente"
          ],
          [
            6,
            "Regleta"
          ],
          [
            40,
            "Cable XLR"
          ],
          [
            30,
            "Extensión"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  },
  "dj-privado": {
    name: "DJ PRIVADO",
    source: "EQUIPO-DE-AUDIO.xlsx / DJ",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            2,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            8,
            "Clamp para luces"
          ],
          [
            8,
            "Base de clamp"
          ],
          [
            1,
            "Dmx 384 adj con cable ac"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            1,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            1,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            4,
            "Estructura blanca pequeña con su funda"
          ],
          [
            4,
            "Platina pequeña para estructura blanca"
          ],
          [
            4,
            "Platina grande para estructrura blanca"
          ],
          [
            16,
            "Tornillos especiales para estructura blanca"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            4,
            "Funda para truss color negro de 2 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            1,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            2,
            "Cable ac"
          ],
          [
            2,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            5,
            "Cuadro de corriente"
          ],
          [
            5,
            "Regleta"
          ],
          [
            35,
            "Cable XLR"
          ],
          [
            30,
            "Extensión"
          ],
          [
            3,
            "Extensión multiple"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  }
};

const saxofonicSheetServiceIds = [
  "saxofonic-audio-turbosound",
  "saxofonic-solo-show-con-audio",
  "saxofonic-privado"
];

const saxofonicSheetServices = {
  "saxofonic-audio-turbosound": {
    name: "SAXOFONIC - AUDIO TURBOSOUND",
    source: "EQUIPO-DE-AUDIO.xlsx / SAXOFONIC",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ],
          [
            1,
            "Router con cargador y funda"
          ],
          [
            2,
            "Ipad con cargador"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            2,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ],
          [
            1,
            "Bajo Turbosound IQ18 con cable power spicon"
          ],
          [
            2,
            "Pedestal hercules para bocina con funda"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "Monitoreo",
        items: [
          [
            1,
            "Bocina Turbosound IQ15 con 2 cables power spicon"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            2,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            6,
            "Beam 260 con cable power spicon"
          ],
          [
            6,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            24,
            "Clamp para luces"
          ],
          [
            24,
            "Base de clamp"
          ],
          [
            4,
            "Tubo galvanizado"
          ],
          [
            4,
            "Hamburguesa doble"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ],
          [
            2,
            "Blinder RGB con cable power spicon"
          ],
          [
            1,
            "Interfaz con cable de RED con cargador y case (compu, mouse, adaptador, monitor, HDMI, cable de corriente)"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            2,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            2,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            6,
            "Truss 2 mt"
          ],
          [
            8,
            "Truss 0.50 cm"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            6,
            "Funda para truss color negro de 3 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            2,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            5,
            "Cable ac"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Case de pulpos (6 grandes y 6 pequeños)"
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            6,
            "Cuadro de corriente"
          ],
          [
            6,
            "Regleta"
          ],
          [
            40,
            "Cable XLR"
          ],
          [
            30,
            "Extensión"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            5,
            "Duc tape"
          ],
          [
            3,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            7,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  },
  "saxofonic-solo-show-con-audio": {
    name: "SAXOFONIC SOLO SHOW CON AUDIO",
    source: "EQUIPO-DE-AUDIO.xlsx / SAXOFONIC",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            1,
            "Mic. inalambrico de saxo"
          ]
        ]
      },
      {
        title: "Case de Cableado",
        items: [
          [
            5,
            "Regleta"
          ],
          [
            10,
            "Cable XLR"
          ],
          [
            10,
            "Extensión"
          ]
        ]
      }
    ],
    extras: []
  },
  "saxofonic-privado": {
    name: "SAXOFONIC PRIVADO",
    source: "EQUIPO-DE-AUDIO.xlsx / SAXOFONIC",
    mainSections: [
      {
        title: "Consola",
        items: [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        title: "Telefono (Mochila)",
        items: [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        title: "Audio",
        items: [
          [
            2,
            "Bocina IP 2000 con funda"
          ],
          [
            1,
            "Grabadora de audio"
          ]
        ]
      },
      {
        title: "In ears",
        items: [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ],
          [
            1,
            "Porta bateria cuadrada Bonai"
          ],
          [
            2,
            "Intercomunicador Hollyland"
          ]
        ]
      },
      {
        title: "Microfonia para voces",
        items: [
          [
            2,
            "Mic. Sm 58 inalambrico"
          ],
          [
            1,
            "Mic. inalambrico de saxo"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        title: "Luces",
        items: [
          [
            2,
            "Wash con cable power spicon"
          ],
          [
            4,
            "Par LED RGB con cable ac"
          ],
          [
            2,
            "Laser con cable power spicon"
          ],
          [
            8,
            "Clamp para luces"
          ],
          [
            8,
            "Base de clamp"
          ],
          [
            1,
            "Dmx 384 adj con cable ac"
          ],
          [
            2,
            "Spliter American DJ con cable ac"
          ]
        ]
      },
      {
        title: "EFECTOS ESPECIALES / Maquina de humo",
        items: [
          [
            1,
            "Maquina de humo con control, cable ac y ventilador"
          ],
          [
            1,
            "Galon liquido de humo"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura DJ",
        items: [
          [
            1,
            "Marco DJ booth grande"
          ],
          [
            1,
            "Marco DJ booth pequeño"
          ],
          [
            1,
            "DJ booth"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Estructura Luces",
        items: [
          [
            4,
            "Estructura blanca pequeña con su funda"
          ],
          [
            4,
            "Platina pequeña para estructura blanca"
          ],
          [
            4,
            "Platina grande para estructrura blanca"
          ],
          [
            16,
            "Tornillos especiales para estructura blanca"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Telas para forrar estructuras",
        items: [
          [
            4,
            "Funda para truss color negro de 2 mts"
          ],
          [
            1,
            "Tela pequeña para forrar DJ booth color negro (DJ)"
          ],
          [
            1,
            "Tela grande para forrar DJ booth color negro (controles)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Case de Cableado",
        items: [
          [
            1,
            "Distro de corriente"
          ],
          [
            2,
            "Cable ac"
          ],
          [
            2,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de 1/4\" a 1/4\""
          ],
          [
            1,
            "Cable TCJ"
          ],
          [
            5,
            "Cuadro de corriente"
          ],
          [
            5,
            "Regleta"
          ],
          [
            35,
            "Cable XLR"
          ],
          [
            30,
            "Extensión"
          ],
          [
            3,
            "Extensión multiple"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Extras",
        items: [
          [
            1,
            "Extintor"
          ],
          [
            1,
            "Bolsa de agua pura"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Caja de Herramientas",
        items: [
          [
            1,
            "Macho"
          ],
          [
            2,
            "Pata de Gallo"
          ],
          [
            1,
            "Flipon doble de 50 amp"
          ],
          [
            1,
            "Desarmador de estrella"
          ],
          [
            1,
            "Desarmador de castigaderas"
          ],
          [
            1,
            "Cuchilla"
          ],
          [
            1,
            "Estuche llaves Allen (25 unidades)"
          ],
          [
            1,
            "Alicate"
          ],
          [
            1,
            "Tenaza"
          ],
          [
            1,
            "Pinza"
          ],
          [
            1,
            "Espiga tipo tester"
          ],
          [
            1,
            "Multímetro Fluke con estuche"
          ],
          [
            3,
            "Duc tape"
          ],
          [
            2,
            "Paquete de cinchos 0.35 cm"
          ],
          [
            5,
            "Cinta de aislar Electrica PVC"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Limpieza",
        items: [
          [
            5,
            "Trapo"
          ],
          [
            1,
            "Escoba"
          ],
          [
            1,
            "Pala"
          ],
          [
            5,
            "Trapiador"
          ],
          [
            1,
            "Atomizador con desinfectante"
          ],
          [
            1,
            "Atomizador con silicón"
          ],
          [
            2,
            "Espuma limpiadora"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de proteccion",
        items: [
          [
            10,
            "Bolsa jardinera de tonel"
          ],
          [
            3,
            "Retazo de nylon (para tapar equipo)"
          ]
        ]
      },
      {
        title: "ESTRUCTURAS / Equipo de Seguridad Industrial",
        items: [
          [
            6,
            "Casco"
          ],
          [
            6,
            "Chaleco"
          ],
          [
            0,
            "Par de botas"
          ],
          [
            6,
            "Par de guantes"
          ],
          [
            1,
            "Arnes completo"
          ]
        ]
      }
    ],
    extras: []
  }
};
const pantallaLedServiceIds = [
  "pantalla-led-en-modulos-3mts-al-ras-de-piso",
  "pantalla-led-en-modulos-3mts-sobre-tarima",
  "pantalla-led-en-modulos-2mts-sobre-tarima",
  "pantalla-led-en-modulos-2mts-al-ras-de-piso",
  "pantalla-led-3-x-2mts-al-ras-de-piso",
  "pantalla-led-3-x-2mts-sobre-tarima",
  "pantalla-led-6-x-2mts-al-ras-de-piso",
  "pantalla-led-6-x-2mts-sobre-tarima",
  "pantalla-led-6-x-3mts-al-ras-de-piso",
  "pantalla-led-6-x-3mts-sobre-tarima",
  "pantalla-led-6-x-4mts-al-ras-de-piso",
  "pantalla-led-6-x-4mts-sobre-tarima",
  "pantalla-led-dj-booth"
];

const pantallaLedServices = {
  "pantalla-led-en-modulos-3mts-al-ras-de-piso": {
    "name": "PANTALLA LED EN MODULOS 3MTS AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            24,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            24,
            "Cable de corriente"
          ],
          [
            24,
            "Cable de señal"
          ],
          [
            8,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "Cat 5 de 10mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            12,
            "Truss 0.50 mt"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ],
          [
            7,
            "Chaco"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela de 8 metros color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-en-modulos-3mts-sobre-tarima": {
    "name": "PANTALLA LED EN MODULOS 3MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            24,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            24,
            "Cable de corriente"
          ],
          [
            24,
            "Cable de señal"
          ],
          [
            8,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "Cat 5 de 10mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            6,
            "Truss 0.50 mt"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            100,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ],
          [
            7,
            "Chaco"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela de 8 metros color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-en-modulos-2mts-sobre-tarima": {
    "name": "PANTALLA LED EN MODULOS 2MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            15,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            15,
            "Cable de corriente"
          ],
          [
            15,
            "Cable de señal"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            1,
            "Cable de DVI A DVI"
          ],
          [
            1,
            "Cable de HDMI A DVI"
          ],
          [
            1,
            "Cable de HDMI A HDMI"
          ],
          [
            1,
            "Cable de USB a datos"
          ],
          [
            1,
            "Cat 5 de 10mts."
          ],
          [
            1,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            4,
            "Truss 0.50 mt"
          ],
          [
            5,
            "Platina pequeña"
          ],
          [
            5,
            "Platina grande"
          ],
          [
            50,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ],
          [
            5,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela de 8 metros color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-en-modulos-2mts-al-ras-de-piso": {
    "name": "PANTALLA LED EN MODULOS 2MTS - AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            15,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            15,
            "Cable de corriente"
          ],
          [
            15,
            "Cable de señal"
          ],
          [
            5,
            "Cable power spicon"
          ],
          [
            1,
            "Cable de DVI A DVI"
          ],
          [
            1,
            "Cable de HDMI A DVI"
          ],
          [
            1,
            "Cable de HDMI A HDMI"
          ],
          [
            1,
            "Cable de USB a datos"
          ],
          [
            1,
            "Cat 5 de 10mts."
          ],
          [
            1,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 0.50 mt"
          ],
          [
            5,
            "Platina pequeña"
          ],
          [
            5,
            "Platina grande"
          ],
          [
            50,
            "Pin"
          ],
          [
            40,
            "Chiche"
          ],
          [
            5,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela de 8 metros color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-3-x-2mts-al-ras-de-piso": {
    "name": "PANTALLA LED 3 X 2MTS AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            14,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Splitter de HDMI"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz Akai con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            15,
            "Cable de corriente"
          ],
          [
            15,
            "Cable de señal"
          ],
          [
            4,
            "Cable power spicon"
          ],
          [
            1,
            "Cable de DVI A DVI"
          ],
          [
            1,
            "Cable de HDMI A DVI"
          ],
          [
            1,
            "Cable de HDMI A HDMI"
          ],
          [
            1,
            "Cable de USB a datos"
          ],
          [
            2,
            "Cat 5 de 50mts."
          ],
          [
            1,
            "HDMI de 5mts"
          ],
          [
            1,
            "HDMI de 15mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            2,
            "Truss 2 mt"
          ],
          [
            2,
            "Truss 0.50 mt"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            4,
            "Platina pequeña"
          ],
          [
            50,
            "Pin"
          ],
          [
            25,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            5,
            "retazos de tela grandes color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-3-x-2mts-sobre-tarima": {
    "name": "PANTALLA LED 3 X 2MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            14,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Splitter de HDMI"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            15,
            "Cable de corriente"
          ],
          [
            15,
            "Cable de señal"
          ],
          [
            4,
            "Cable power spicon"
          ],
          [
            1,
            "Cable de DVI A DVI"
          ],
          [
            1,
            "Cable de HDMI A DVI"
          ],
          [
            1,
            "Cable de HDMI A HDMI"
          ],
          [
            1,
            "Cable de USB a datos"
          ],
          [
            2,
            "Cat 5 de 50mts."
          ],
          [
            1,
            "HDMI de 5mts"
          ],
          [
            1,
            "HDMI de 15mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            2,
            "Truss 2 mt"
          ],
          [
            4,
            "Truss 0.50 mt"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            4,
            "Platina pequeña"
          ],
          [
            50,
            "Pin"
          ],
          [
            25,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            5,
            "retazos de tela grandes color negro"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-2mts-al-ras-de-piso": {
    "name": "PANTALLA LED 6 X 2MTS - AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            24,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            24,
            "Cable de corriente"
          ],
          [
            24,
            "Cable de señal"
          ],
          [
            6,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            2,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 0.50 mt"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-2mts-sobre-tarima": {
    "name": "PANTALLA LED 6 X 2MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            24,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            24,
            "Cable de corriente"
          ],
          [
            24,
            "Cable de señal"
          ],
          [
            6,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            2,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            12,
            "Truss 0.50 mt"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-3mts-al-ras-de-piso": {
    "name": "PANTALLA LED 6 X 3MTS - AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            40,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            40,
            "Cable de corriente"
          ],
          [
            40,
            "Cable de señal"
          ],
          [
            10,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-3mts-sobre-tarima": {
    "name": "PANTALLA LED 6 X 3MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            40,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            40,
            "Cable de corriente"
          ],
          [
            40,
            "Cable de señal"
          ],
          [
            10,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            6,
            "Truss 2 mt"
          ],
          [
            6,
            "Truss 1 mt"
          ],
          [
            6,
            "Truss 0.50 mt"
          ],
          [
            6,
            "Platina pequeña"
          ],
          [
            6,
            "Platina grande"
          ],
          [
            120,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ],
          [
            2,
            "Strap"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-4mts-al-ras-de-piso": {
    "name": "PANTALLA LED 6 X 4MTS - AL RAS DE PISO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            54,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            54,
            "Cable de corriente"
          ],
          [
            54,
            "Cable de señal"
          ],
          [
            15,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            14,
            "Truss 2 mt"
          ],
          [
            7,
            "Platina pequeña"
          ],
          [
            7,
            "Platina grande"
          ],
          [
            140,
            "Pin"
          ],
          [
            72,
            "Chiche"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-6-x-4mts-sobre-tarima": {
    "name": "PANTALLA LED 6 X 4MTS - SOBRE TARIMA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            54,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ],
          [
            1,
            "Capturadora de video"
          ],
          [
            1,
            "Clickers completo"
          ],
          [
            1,
            "Interfaz de audio volth 2"
          ],
          [
            1,
            "Atem mini con cargador"
          ],
          [
            1,
            "Interfaz akain con cargador"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            54,
            "Cable de corriente"
          ],
          [
            54,
            "Cable de señal"
          ],
          [
            15,
            "Cable power spicon"
          ],
          [
            2,
            "Cable de DVI A DVI"
          ],
          [
            2,
            "Cable de HDMI A DVI"
          ],
          [
            2,
            "Cable de HDMI A HDMI"
          ],
          [
            2,
            "Cable de USB a datos"
          ],
          [
            4,
            "Cat 5 de 50mts."
          ],
          [
            2,
            "HDMI de 5mts"
          ]
        ]
      },
      {
        "title": "Estructura para pantalla",
        "items": [
          [
            14,
            "Truss 2 mt"
          ],
          [
            7,
            "Truss 0.50 mt"
          ],
          [
            7,
            "Platina pequeña"
          ],
          [
            7,
            "Platina grande"
          ],
          [
            170,
            "Pin"
          ],
          [
            87,
            "Chiche"
          ]
        ]
      },
      {
        "title": "Telas para forrar estructuras",
        "items": [
          [
            2,
            "retazos de tela color negro de 8 mts"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pantalla-led-dj-booth": {
    "name": "PANTALLA LED - DJ BOOTH",
    "source": "EQUIPO-DE-AUDIO.xlsx / PANTALLA LED",
    "mainSections": [
      {
        "title": "PANTALLA EN MODULOS",
        "items": [
          [
            3,
            "Modulo de pantalla LED 1mts X 0.50cm"
          ],
          [
            1,
            "Computadora de pantalla con su cargador, mouse"
          ],
          [
            1,
            "Procesador de pantalla con su AC"
          ]
        ]
      },
      {
        "title": "CABLES PARA PANTALLA",
        "items": [
          [
            3,
            "Cable de corriente"
          ],
          [
            3,
            "Cable de señal"
          ],
          [
            1,
            "Cable power spicon"
          ],
          [
            1,
            "Cable de DVI A DVI"
          ],
          [
            1,
            "Cable de HDMI A DVI"
          ],
          [
            1,
            "Cable de HDMI A HDMI"
          ],
          [
            1,
            "Cable de USB a datos"
          ],
          [
            1,
            "Cat 5 de 10mts."
          ],
          [
            1,
            "HDMI de 5mts"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const estructuraEnLServiceIds = [
  "estructura-en-l"
];

const estructuraEnLServices = {
  "estructura-en-l": {
    "name": "Estructuras en L",
    "source": "EQUIPO-DE-AUDIO.xlsx / ESTRUCTURA EN L",
    "mainSections": [
      {
        "title": "Equipo",
        "items": [
          [
            2,
            "Truss 2 mt"
          ],
          [
            2,
            "Truss 1 mt"
          ],
          [
            4,
            "Truss 0.50 mt"
          ],
          [
            2,
            "Cubo de diseño"
          ],
          [
            2,
            "Contrapeso"
          ],
          [
            2,
            "Zapata"
          ],
          [
            2,
            "straps"
          ],
          [
            2,
            "polipastos"
          ],
          [
            2,
            "slingas"
          ],
          [
            120,
            "pines"
          ],
          [
            70,
            "chiches"
          ]
        ]
      },
      {
        "title": "Telas para forrar",
        "items": [
          [
            2,
            "telas de 4 metros en color blanco y negro"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const ceremoniaServiceIds = [
  "ceremonia-cuadro-de-montaje"
];

const ceremoniaServices = {
  "ceremonia-cuadro-de-montaje": {
    "name": "CEREMONIA",
    "source": "EQUIPO-DE-AUDIO.xlsx / CEREMONIA",
    "mainSections": [
      {
        "title": "Consola",
        "items": [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        "title": "Telefono (Mochila)",
        "items": [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        "title": "Audio",
        "items": [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        "title": "In ears",
        "items": [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        "title": "Microfonia para voces",
        "items": [
          [
            1,
            "Mic. Sm 58 inalambrico"
          ],
          [
            2,
            "Caja directa"
          ],
          [
            1,
            "Mic. de diadema SHURE color piel"
          ]
        ]
      },
      {
        "title": "Pedestales",
        "items": [
          [
            2,
            "Pedestal de brazo"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const coctelServiceIds = [
  "coctel-saxofonic",
  "coctel-violin",
  "coctel-playlist"
];

const coctelServices = {
  "coctel-saxofonic": {
    "name": "COCTEL - SAXOFONIC",
    "source": "EQUIPO-DE-AUDIO.xlsx / COCTEL",
    "mainSections": [
      {
        "title": "Consola",
        "items": [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        "title": "Telefono (Mochila)",
        "items": [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        "title": "Audio",
        "items": [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        "title": "In ears",
        "items": [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        "title": "Microfonia para voces",
        "items": [
          [
            1,
            "Mic. inalambrico de saxo"
          ]
        ]
      },
      {
        "title": "Case de Cableado",
        "items": [
          [
            2,
            "Regleta"
          ],
          [
            6,
            "Cable XLR"
          ],
          [
            4,
            "Extensión"
          ]
        ]
      }
    ],
    "extras": []
  },
  "coctel-violin": {
    "name": "COCTEL - VIOLIN",
    "source": "EQUIPO-DE-AUDIO.xlsx / COCTEL",
    "mainSections": [
      {
        "title": "Consola",
        "items": [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        "title": "Telefono (Mochila)",
        "items": [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        "title": "Audio",
        "items": [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        "title": "In ears",
        "items": [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        "title": "Microfonia para voces",
        "items": [
          [
            1,
            "Mic. inalambrico de violin"
          ],
          [
            2,
            "Caja directa"
          ]
        ]
      },
      {
        "title": "Case de Cableado",
        "items": [
          [
            2,
            "Regleta"
          ],
          [
            6,
            "Cable XLR"
          ],
          [
            4,
            "Extensión"
          ]
        ]
      }
    ],
    "extras": []
  },
  "coctel-playlist": {
    "name": "COCTEL - PLAYLIST",
    "source": "EQUIPO-DE-AUDIO.xlsx / COCTEL",
    "mainSections": [
      {
        "title": "Consola",
        "items": [
          [
            1,
            "Consola analoga con cable ac"
          ]
        ]
      },
      {
        "title": "Telefono (Mochila)",
        "items": [
          [
            1,
            "Kit celular (estuche, celular, cable audio, cable lighting, cable tipo c, maletin, cable, cargador)"
          ]
        ]
      },
      {
        "title": "Audio",
        "items": [
          [
            2,
            "Bocina IP 2000 con funda"
          ]
        ]
      },
      {
        "title": "In ears",
        "items": [
          [
            24,
            "Bateria Bonai"
          ],
          [
            1,
            "Cargador para bateria Bonai"
          ]
        ]
      },
      {
        "title": "Case de Cableado",
        "items": [
          [
            2,
            "Regleta"
          ],
          [
            6,
            "Cable XLR"
          ],
          [
            4,
            "Extensión"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const tarimaServiceIds = [
  "tarima-6-x-4mts-negro",
  "tarima-6-x-4mts-con-diseno",
  "tarima-6-x-5-mts-negro",
  "tarima-5-x-4mts-negro",
  "tarima-3-x-4mts-negro"
];

const tarimaServices = {
  "tarima-6-x-4mts-negro": {
    "name": "TARIMA 6 X 4MTS - NEGRO",
    "source": "EQUIPO-DE-AUDIO.xlsx / TARIMA",
    "mainSections": [
      {
        "title": "Tarima de 6.10 x 3.66 mts.",
        "items": [
          [
            15,
            "Plancha de 1.22 x 1.22"
          ],
          [
            1,
            "Grada de 0.50cm."
          ],
          [
            6,
            "Andamio 0.60 cm"
          ],
          [
            20,
            "Corona para tarima"
          ],
          [
            8,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color negro"
          ],
          [
            1,
            "Rollo de mounting tape"
          ],
          [
            1,
            "Faldon de 24mts color negro / blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "tarima-6-x-4mts-con-diseno": {
    "name": "TARIMA 6 X 4MTS - CON DISEÑO",
    "source": "EQUIPO-DE-AUDIO.xlsx / TARIMA",
    "mainSections": [
      {
        "title": "Tarima de 6.10 x 3.66 mts. con diseño",
        "items": [
          [
            15,
            "Plancha de 1.22 x 1.22"
          ],
          [
            1,
            "Grada de 0.50 cm."
          ],
          [
            6,
            "Andamio 0.50 cm"
          ],
          [
            20,
            "Corona para tarima"
          ],
          [
            8,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ]
        ]
      }
    ],
    "extras": []
  },
  "tarima-6-x-5-mts-negro": {
    "name": "TARIMA 6 X 5 MTS - NEGRO",
    "source": "EQUIPO-DE-AUDIO.xlsx / TARIMA",
    "mainSections": [
      {
        "title": "Tarima de 6.10 x 4.88 mts.",
        "items": [
          [
            20,
            "Plancha de 1.22 x 1.22"
          ],
          [
            1,
            "Grada de 0.50cm."
          ],
          [
            8,
            "Andamio 0.60 cm"
          ],
          [
            22,
            "Corona para tarima"
          ],
          [
            12,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color negro"
          ],
          [
            2,
            "Rollo de mounting tape"
          ],
          [
            1,
            "Faldon de 24mts color negro / blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "tarima-5-x-4mts-negro": {
    "name": "TARIMA 5 X 4MTS - NEGRO",
    "source": "EQUIPO-DE-AUDIO.xlsx / TARIMA",
    "mainSections": [
      {
        "title": "Tarima de 4.88 x 3.66 mts.",
        "items": [
          [
            12,
            "Plancha de 1.22 x 1.22"
          ],
          [
            1,
            "Grada de 0.50cm."
          ],
          [
            6,
            "Andamio 0.60 cm"
          ],
          [
            18,
            "Corona para tarima"
          ],
          [
            6,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color negro"
          ],
          [
            1,
            "Rollo de mounting tape"
          ],
          [
            1,
            "Faldon de 24mts color negro / blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "tarima-3-x-4mts-negro": {
    "name": "TARIMA 3 X 4MTS - NEGRO",
    "source": "EQUIPO-DE-AUDIO.xlsx / TARIMA",
    "mainSections": [
      {
        "title": "Tarima de 2.44 x 3.66 mts.",
        "items": [
          [
            6,
            "Plancha de 1.22 x 1.22"
          ],
          [
            4,
            "Andamio 0.30 cm"
          ],
          [
            10,
            "Corona para tarima"
          ],
          [
            4,
            "Trabesaño"
          ],
          [
            4,
            "Esquinero"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color negro"
          ],
          [
            1,
            "Rollo de mounting tape"
          ],
          [
            1,
            "Faldon de 12mts color negro / blanco"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const cuadrilateroServiceIds = [
  "cuadrilatero-de-5-x-7-x-4mts-de-alto",
  "cuadrilatero-de-7-x-7-x-4mts-de-alto",
  "cuadrilatero-de-8-x-8-x-4mts-de-alto"
];

const cuadrilateroServices = {
  "cuadrilatero-de-5-x-7-x-4mts-de-alto": {
    "name": "CUADRILATERO DE 5 X 7 X 4MTS DE ALTO",
    "source": "EQUIPO-DE-AUDIO.xlsx / CUADRILATERO",
    "mainSections": [
      {
        "title": "Cuadrilatero 5 X 7mts X 4mts de alto con travesaños 5mts",
        "items": [
          [
            18,
            "Truss de 2 mt"
          ],
          [
            8,
            "truss de 1 mt"
          ],
          [
            6,
            "Cubo de diseño"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            190,
            "Pin"
          ],
          [
            110,
            "Chiche"
          ],
          [
            3,
            "Martillo"
          ]
        ]
      }
    ],
    "extras": []
  },
  "cuadrilatero-de-7-x-7-x-4mts-de-alto": {
    "name": "CUADRILATERO DE 7 X 7 X 4MTS DE ALTO",
    "source": "EQUIPO-DE-AUDIO.xlsx / CUADRILATERO",
    "mainSections": [
      {
        "title": "Cuadrilatero 7 X 7mts X 4mts de alto",
        "items": [
          [
            16,
            "Truss de 2 mt"
          ],
          [
            12,
            "truss de 1 mt"
          ],
          [
            4,
            "Cubo de diseño"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            200,
            "Pin"
          ],
          [
            100,
            "Chiche"
          ],
          [
            2,
            "Martillo"
          ]
        ]
      }
    ],
    "extras": []
  },
  "cuadrilatero-de-8-x-8-x-4mts-de-alto": {
    "name": "CUADRILATERO DE 8 X 8 X 4MTS DE ALTO",
    "source": "EQUIPO-DE-AUDIO.xlsx / CUADRILATERO",
    "mainSections": [
      {
        "title": "Cuadrilatero 8 X 8mts X 4mts de alto",
        "items": [
          [
            16,
            "Truss de 2 mt"
          ],
          [
            16,
            "truss de 1 mt"
          ],
          [
            4,
            "Cubo de diseño"
          ],
          [
            4,
            "Platina grande"
          ],
          [
            240,
            "Pin"
          ],
          [
            118,
            "Chiche"
          ],
          [
            2,
            "Martillo"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const pistaDeBaileServiceIds = [
  "pista-de-baile-7-x-7mts-blanca",
  "pista-de-baile-7-x-7mts-con-diseno",
  "pista-de-baile-6-x-6mts-blanca",
  "pista-de-baile-6-x-6mts-con-diseno",
  "pista-de-baile-6-x-4mts-blanca",
  "pista-de-baile-6-x-4mts-diseno",
  "pista-de-baile-4-x-4mts-blanca",
  "pista-de-baile-4-x-4mts-diseno"
];

const pistaDeBaileServices = {
  "pista-de-baile-7-x-7mts-blanca": {
    "name": "PISTA DE BAILE 7 x 7MTS - BLANCA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 7.32 X 7.32 mts.",
        "items": [
          [
            36,
            "Plancha de 1.22 x 1.22"
          ],
          [
            35,
            "Corona para pista"
          ],
          [
            35,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            2,
            "Rollo de mounting tape"
          ],
          [
            2,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-7-x-7mts-con-diseno": {
    "name": "PISTA DE BAILE 7 x 7MTS - CON DISEÑO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 7.32 X 7.32 mts.",
        "items": [
          [
            36,
            "Plancha de 1.22 x 1.22"
          ],
          [
            35,
            "Corona para pista"
          ],
          [
            35,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            2,
            "Caja de Calzas"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-6-x-6mts-blanca": {
    "name": "PISTA DE BAILE 6 x 6MTS - BLANCA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 6.10 x 6.10 mts.",
        "items": [
          [
            25,
            "Plancha de 1.22 x 1.22"
          ],
          [
            25,
            "Corona para pista"
          ],
          [
            25,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            2,
            "Rollo de mounting tape"
          ],
          [
            2,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-6-x-6mts-con-diseno": {
    "name": "PISTA DE BAILE 6 x 6MTS - CON DISEÑO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 6.10 x 6.10 mts.",
        "items": [
          [
            25,
            "Plancha de 1.22 x 1.22"
          ],
          [
            25,
            "Corona para pista"
          ],
          [
            25,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            2,
            "Caja de Calzas"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-6-x-4mts-blanca": {
    "name": "PISTA DE BAILE 6 x 4MTS - BLANCA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 6.10 x 3.66 mts.",
        "items": [
          [
            15,
            "Plancha de 1.22 x 1.22"
          ],
          [
            15,
            "Corona para pista"
          ],
          [
            15,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            1,
            "Rollo de mounting tape"
          ],
          [
            2,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-6-x-4mts-diseno": {
    "name": "PISTA DE BAILE 6 x 4MTS - DISEÑO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 6.10 x 3.66 mts.",
        "items": [
          [
            15,
            "Plancha de 1.22 x 1.22"
          ],
          [
            15,
            "Corona para pista"
          ],
          [
            15,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            2,
            "Caja de Calzas"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-4-x-4mts-blanca": {
    "name": "PISTA DE BAILE 4 x 4MTS - BLANCA",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 4.88 x 4.88 mts.",
        "items": [
          [
            16,
            "Plancha de 1.22 x 1.22"
          ],
          [
            16,
            "Corona para pista"
          ],
          [
            16,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            1,
            "Rollo de mounting tape"
          ],
          [
            1,
            "Caja de Calzas"
          ],
          [
            1,
            "Rollo de vinil color blanco"
          ]
        ]
      }
    ],
    "extras": []
  },
  "pista-de-baile-4-x-4mts-diseno": {
    "name": "PISTA DE BAILE 4 x 4MTS - DISEÑO",
    "source": "EQUIPO-DE-AUDIO.xlsx / PISTA DE BAILE",
    "mainSections": [
      {
        "title": "Pista de baile 4.88 x 4.88 mts.",
        "items": [
          [
            16,
            "Plancha de 1.22 x 1.22"
          ],
          [
            16,
            "Corona para pista"
          ],
          [
            16,
            "Pedazo de alfombra (en pedacitos)"
          ],
          [
            1,
            "Caja de Calzas"
          ]
        ]
      }
    ],
    "extras": []
  }
};

const sundayFundayOperationalExtras = [];

const equipmentServices = {
  "dj-completo": {
    name: "DJ COMPLETO",
    source: "DJ COMPLETO",
    audioOptions: djCompletoAudioOptions,
    mainSections: djCompletoMainSections,
    extras: djCompletoExtras
  },
  "saxofonic-completo": {
    name: "SAXOFONIC COMPLETO",
    source: "SAXOFONIC.pdf",
    audioOptions: djCompletoAudioOptions,
    mainSections: saxofonicCompletoMainSections,
    extras: []
  },
  "saxofonic-con-audio": {
    name: "SAXOFONIC CON AUDIO",
    source: "SAXOFONIC CON AUDIO",
    mainSections: saxofonicConAudioMainSections,
    extras: []
  },
  ...sundayFundayServices,
  ...novaloopsServices,
  ...estuardoReynaServices,
  ...djSheetServices,
  ...saxofonicSheetServices,
  ...pantallaLedServices,
  ...estructuraEnLServices,
  ...ceremoniaServices,
  ...coctelServices,
  ...tarimaServices,
  ...cuadrilateroServices,
  ...pistaDeBaileServices
};

const operationalFixedExtraIds = new Set([
  "extras-operativos",
  "caja-herramientas",
  "equipo-limpieza",
  "equipo-proteccion",
  "seguridad-industrial"
]);

function cloneEquipmentExtra(extra) {
  return {
    ...extra,
    items: extra.items.map((item) => [...item])
  };
}

function equipmentExtrasByIds(ids) {
  const catalog = [...sundayFundayOperationalExtras, ...sharedEquipmentExtras];
  const used = new Set();
  return [...ids]
    .map((id) => catalog.find((extra) => extra.id === id))
    .filter((extra) => {
      if (!extra || used.has(extra.id)) return false;
      used.add(extra.id);
      return true;
    })
    .map(cloneEquipmentExtra);
}


["dj-completo", "saxofonic-completo", "saxofonic-con-audio"].forEach((serviceId) => {
  const service = equipmentServices[serviceId];
  if (service) service.extras = equipmentExtrasByIds(operationalFixedExtraIds);
});

const equipmentServiceGroups = [
  {
    label: "SUNDAY FUNDAY",
    serviceIds: sundayFundayServiceIds
  },
  {
    label: "NOVALOOPS",
    serviceIds: novaloopsServiceIds
  },
  {
    label: "ESTUARDO REYNA",
    serviceIds: estuardoReynaServiceIds
  },
  {
    label: "DJ",
    serviceIds: djSheetServiceIds
  },
  {
    label: "SAXOFONIC",
    serviceIds: saxofonicSheetServiceIds
  },
  {
    label: "PANTALLA LED",
    serviceIds: pantallaLedServiceIds
  },
  {
    label: "ESTRUCTURA EN L",
    serviceIds: estructuraEnLServiceIds
  },
  {
    label: "CEREMONIA",
    serviceIds: ceremoniaServiceIds
  },
  {
    label: "COCTEL",
    serviceIds: coctelServiceIds
  },
  {
    label: "TARIMA",
    serviceIds: tarimaServiceIds
  },
  {
    label: "CUADRILATERO",
    serviceIds: cuadrilateroServiceIds
  },
  {
    label: "PISTA DE BAILE",
    serviceIds: pistaDeBaileServiceIds
  }
];

const equipmentState = {
  selectedServiceId: "",
  selectedServiceIds: new Set(),
  djAudioType: "qsc",
  events: [],
  selectedExtraIds: new Set(),
  manualMainItems: [],
  manualMainSections: [],
  manualExtras: [],
  itemOverrides: new Map(),
  removedItemIds: new Set(),
  inventory: new Map(),
  observations: new Map(),
  deletedStack: [],
  selectedEventId: "",
  activeWindow: "review"
};

let equipmentEventCounter = 1;
let equipmentManualMainCounter = 1;
let equipmentManualSectionCounter = 1;
let equipmentExtraCounter = 1;

function equipmentQuery(selector) {
  return document.querySelector(selector);
}

function escapeEquipmentHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEquipmentKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[“”"']/g, "")
    .replace(/\bno\.\s*/g, "no ")
    .replace(/[.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanEquipmentFilePart(value, fallback) {
  const clean = String(value || fallback || "equipo")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean || fallback || "equipo";
}

function formatEquipmentDate(value) {
  if (!value) return "Por definir";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatEquipmentDateForFile(value) {
  if (!value) return "Fecha por definir";
  const [year, month, day] = String(value).split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function equipmentNormalizeServiceIds(value) {
  const values = value instanceof Set ? [...value] : Array.isArray(value) ? value : [value];
  const seen = new Set();
  return values
    .map((serviceId) => String(serviceId || "").trim())
    .filter((serviceId) => {
      if (!serviceId || !equipmentServices[serviceId] || seen.has(serviceId)) return false;
      seen.add(serviceId);
      return true;
    });
}

function selectedEquipmentServiceIds() {
  const selectedIds = equipmentNormalizeServiceIds(equipmentState.selectedServiceIds);
  if (selectedIds.length) return selectedIds;
  return equipmentNormalizeServiceIds(equipmentState.selectedServiceId);
}

function sameEquipmentServiceIds(firstIds, secondIds) {
  const first = equipmentNormalizeServiceIds(firstIds);
  const second = equipmentNormalizeServiceIds(secondIds);
  return first.length === second.length && first.every((serviceId, index) => serviceId === second[index]);
}

function updateNativeEquipmentServiceSelect() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  [...serviceSelect.options].forEach((option) => {
    option.selected = selectedIds.has(option.value);
  });
}

function serviceWithEquipmentAudioOption(serviceId) {
  const service = equipmentServices[serviceId] || null;
  if (!service) return null;
  const baseService = {
    ...service,
    id: serviceId,
    serviceId
  };
  if (!service.audioOptions) return baseService;
  const audioType = service.audioOptions[equipmentState.djAudioType] ? equipmentState.djAudioType : "qsc";
  const audioOption = service.audioOptions?.[audioType] || service.audioOptions?.qsc;
  return {
    ...baseService,
    mainSections: (service.mainSections || []).map((section) => {
      if (!section.audioVariant || !audioOption) return section;
      return {
        ...section,
        id: `${section.id || "audio"}-${audioType}`,
        title: `AUDIO - ${audioOption.label}`,
        items: audioOption.items
      };
    })
  };
}

function currentEquipmentServices() {
  return selectedEquipmentServiceIds()
    .map(serviceWithEquipmentAudioOption)
    .filter(Boolean);
}

function equipmentServicesLabel(services = currentEquipmentServices(), fallback = "Seleccione un servicio") {
  if (!services.length) return fallback;
  if (services.length === 1) return services[0].name;
  const allSundayFunday = services.every((service) => String(service.name || "").startsWith("SUNDAY FUNDAY"));
  if (allSundayFunday) return `SUNDAY FUNDAY - ${services.length} servicios seleccionados`;
  return services.map((service) => service.name).join(" + ");
}

function currentEquipmentService() {
  const services = currentEquipmentServices();
  if (!services.length) return null;
  if (services.length === 1) return services[0];
  return {
    id: "multiple-services",
    serviceId: "multiple-services",
    name: equipmentServicesLabel(services, "Cuadro de equipo"),
    source: services.map((service) => service.source || service.name).join(" / "),
    mainSections: [],
    extras: []
  };
}

function equipmentExtraSelectionKey(serviceId, extraId) {
  return `${serviceId || "servicio"}::${extraId || "extra"}`;
}

function isEquipmentExtraSelected(serviceId, extraId, allowLegacyId = false) {
  const key = equipmentExtraSelectionKey(serviceId, extraId);
  return equipmentState.selectedExtraIds.has(key) || (allowLegacyId && equipmentState.selectedExtraIds.has(extraId));
}

function setEquipmentServiceSelection(serviceIds, options = {}) {
  const normalizedIds = equipmentNormalizeServiceIds(serviceIds);
  equipmentState.selectedServiceIds = new Set(normalizedIds);
  equipmentState.selectedServiceId = normalizedIds[0] || "";
  if (options.clearExtras) equipmentState.selectedExtraIds.clear();
  updateNativeEquipmentServiceSelect();
  const selectedServices = currentEquipmentServices();
  const hasCurrentAudioType = selectedServices.some((service) => service.audioOptions?.[equipmentState.djAudioType]);
  if (!hasCurrentAudioType) equipmentState.djAudioType = "qsc";
}

function renderEquipmentServicePicker() {
  const host = equipmentQuery("#equipmentServicePicker");
  if (!host) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  host.innerHTML = equipmentServiceGroups
    .map((group) => {
      const services = group.serviceIds
        .map((serviceId) => ({ serviceId, service: equipmentServices[serviceId] }))
        .filter((entry) => entry.service);
      if (!services.length) return "";
      const groupHasSelectedService = services.some((entry) => selectedIds.has(entry.serviceId));
      const openAttribute = groupHasSelectedService ? " open" : "";
      const options = services
        .map(({ serviceId, service }) => {
          const isActive = selectedIds.has(serviceId);
          const activeClass = isActive ? " is-active" : "";
          return `
            <button class="equipment-service-option${activeClass}" type="button" aria-pressed="${isActive ? "true" : "false"}" data-equipment-service-option="${escapeEquipmentHtml(serviceId)}">
              <span>${escapeEquipmentHtml(service.name)}</span>
            </button>`;
        })
        .join("");
      return `
        <details class="equipment-service-group"${openAttribute}>
          <summary>${escapeEquipmentHtml(group.label)}</summary>
          <div class="equipment-service-options">${options}</div>
        </details>`;
    })
    .join("");
  host.querySelectorAll("[data-equipment-service-option]").forEach((button) => {
    button.addEventListener("click", () => toggleEquipmentService(button.dataset.equipmentServiceOption || ""));
  });
}

function toggleEquipmentService(serviceId) {
  if (!equipmentServices[serviceId]) return;
  const selectedIds = new Set(selectedEquipmentServiceIds());
  if (selectedIds.has(serviceId)) {
    selectedIds.delete(serviceId);
  } else {
    selectedIds.add(serviceId);
  }
  setEquipmentServiceSelection([...selectedIds], { clearExtras: true });
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function selectEquipmentService(serviceId = "") {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  const selectedIds = serviceSelect?.multiple
    ? [...serviceSelect.selectedOptions].map((option) => option.value)
    : [serviceId || serviceSelect?.value || ""];
  setEquipmentServiceSelection(selectedIds, { clearExtras: true });
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function syncSelectedEquipmentService() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  const selectedIds = serviceSelect.multiple
    ? [...serviceSelect.selectedOptions].map((option) => option.value)
    : [serviceSelect.value];
  if (sameEquipmentServiceIds(selectedIds, selectedEquipmentServiceIds())) return;
  setEquipmentServiceSelection(selectedIds);
}

function equipmentSectionKey(section, index, scope, serviceId = "") {
  const servicePrefix = serviceId ? `${serviceId}-` : "";
  return `${servicePrefix}${scope}-${section.id || normalizeEquipmentKey(section.title) || index}`;
}

function equipmentItemKey(sectionKey, itemIndex) {
  return `${sectionKey}-item-${itemIndex}`;
}

function normalizeEquipmentItem(item) {
  if (Array.isArray(item)) {
    return {
      id: "",
      quantity: item[0],
      description: item[1],
      editable: false,
      manual: false
    };
  }
  return {
    id: item.id || "",
    quantity: item.quantity,
    description: item.description,
    editable: item.editable !== false,
    manual: Boolean(item.manual)
  };
}

function editableEquipmentItems(section, sectionKey) {
  return (section.items || [])
    .map(([quantity, description], itemIndex) => {
      const id = equipmentItemKey(sectionKey, itemIndex);
      const override = equipmentState.itemOverrides.get(id) || {};
      return {
        id,
        quantity: override.quantity ?? quantity,
        description: override.description ?? description,
        editable: true,
        manual: false
      };
    })
    .filter((item) => !equipmentState.removedItemIds.has(item.id));
}

function manualMainSectionsForTable() {
  const legacySection = equipmentState.manualMainItems.length
    ? [
        {
          id: "equipo-manual",
          title: "Equipo agregado manualmente",
          manualSection: true,
          items: equipmentState.manualMainItems.map((item) => ({
            ...item,
            editable: true,
            manual: true
          }))
        }
      ]
    : [];
  const manualSections = equipmentState.manualMainSections
    .filter((section) => section.title || section.items.length)
    .map((section) => ({
      id: section.id,
      title: section.title || "Equipo agregado manualmente",
      manualSection: true,
      items: section.items.map((item) => ({
        ...item,
        editable: true,
        manual: true
      }))
    }));
  return [...legacySection, ...manualSections];
}

function ensureManualMainSection() {
  if (!equipmentState.manualMainSections.length) {
    equipmentState.manualMainSections.push({
      id: `manual-section-${Date.now()}-${equipmentManualSectionCounter++}`,
      title: "Equipo agregado manualmente",
      items: []
    });
  }
  return equipmentState.manualMainSections[equipmentState.manualMainSections.length - 1];
}

function selectedEquipmentSections() {
  const services = currentEquipmentServices();
  if (!services.length) return [];
  const hasMultipleServices = services.length > 1;
  const mainSections = services.flatMap((service) => {
    return (service.mainSections || []).map((section, index) => {
      const sectionKey = equipmentSectionKey(section, index, "main", service.id);
      return {
        ...section,
        id: sectionKey,
        title: hasMultipleServices ? `${service.name} / ${section.title}` : section.title,
        items: editableEquipmentItems(section, sectionKey)
      };
    }).filter((section) => section.items.length);
  });
  const manualMainSection = manualMainSectionsForTable();
  const selectedExtrasSections = services.flatMap((service) => {
    return (service.extras || [])
      .filter((extra) => isEquipmentExtraSelected(service.id, extra.id, services.length <= 1))
      .map((extra, index) => {
        const sectionKey = equipmentSectionKey(extra, index, "extra", service.id);
        return {
          ...extra,
          id: sectionKey,
          title: hasMultipleServices ? `${service.name} / ${extra.title}` : extra.title,
          items: editableEquipmentItems(extra, sectionKey)
        };
      })
      .filter((section) => section.items.length);
  });
  const manualExtrasSection = equipmentState.manualExtras.length
    ? [
        {
          id: "extras-manuales",
          title: "Extras manuales",
          items: equipmentState.manualExtras.map((extra) => ({
            ...extra,
            editable: true,
            manual: true
          }))
        }
      ]
    : [];
  return [...mainSections, ...manualMainSection, ...selectedExtrasSections, ...manualExtrasSection];
}

function warehousePdfSections() {
  return selectedEquipmentSections();
}

function currentEquipmentEventDraft() {
  return {
    id: "event-draft",
    place: equipmentQuery("#equipmentEventPlace")?.value.trim() || "Lugar por definir",
    name: equipmentQuery("#equipmentEventName")?.value.trim() || "Evento por definir",
    phone: equipmentQuery("#equipmentEventPhone")?.value.trim() || "Por definir",
    date: equipmentQuery("#equipmentEventDate")?.value || "",
    responsible: equipmentQuery("#equipmentEventResponsible")?.value.trim() || "Por definir"
  };
}

function selectedEquipmentEvent() {
  return equipmentState.events.find((item) => item.id === equipmentState.selectedEventId) || null;
}

function activeEquipmentEvents() {
  return equipmentState.events.length ? equipmentState.events : [currentEquipmentEventDraft()];
}

function equipmentPdfEvents() {
  return [currentEquipmentEventDraft()];
}

function cloneEquipmentSnapshotItem(item, index = 0) {
  const normalized = normalizeEquipmentItem(item || {});
  return {
    id: normalized.id || `snapshot-item-${index}`,
    quantity: Number(normalized.quantity) || 0,
    description: normalized.description || "",
    editable: normalized.editable !== false,
    manual: Boolean(normalized.manual)
  };
}

function cloneEquipmentSnapshotItems(items = []) {
  return items.map((item, index) => cloneEquipmentSnapshotItem(item, index));
}

function cloneEquipmentSnapshotSections(sections = []) {
  return sections.map((section, index) => ({
    id: section.id || `snapshot-section-${index}`,
    title: section.title || "",
    items: cloneEquipmentSnapshotItems(section.items || [])
  }));
}

function equipmentMapToEntries(map) {
  return [...map.entries()].map(([key, value]) => [key, { ...(value || {}) }]);
}

function equipmentEntriesToMap(entries = []) {
  return new Map(entries.map(([key, value]) => [key, { ...(value || {}) }]));
}

function captureEquipmentEventSnapshot() {
  const services = currentEquipmentServices();
  const serviceIds = selectedEquipmentServiceIds();
  return {
    serviceIds,
    serviceId: serviceIds[0] || "",
    serviceName: equipmentServicesLabel(services, ""),
    djAudioType: equipmentState.djAudioType,
    selectedExtraIds: [...equipmentState.selectedExtraIds],
    manualMainItems: cloneEquipmentSnapshotItems(equipmentState.manualMainItems),
    manualMainSections: equipmentState.manualMainSections.map((section, index) => ({
      id: section.id || `manual-section-${index}`,
      title: section.title || "",
      items: cloneEquipmentSnapshotItems(section.items || [])
    })),
    manualExtras: cloneEquipmentSnapshotItems(equipmentState.manualExtras),
    itemOverrides: equipmentMapToEntries(equipmentState.itemOverrides),
    removedItemIds: [...equipmentState.removedItemIds],
    sections: cloneEquipmentSnapshotSections(selectedEquipmentSections())
  };
}

function captureEquipmentEventSnapshotForServiceIds(serviceIds) {
  const previousServiceIds = selectedEquipmentServiceIds();
  const previousSelectedServiceId = equipmentState.selectedServiceId;
  const previousDjAudioType = equipmentState.djAudioType;
  setEquipmentServiceSelection(serviceIds);
  const snapshot = captureEquipmentEventSnapshot();
  setEquipmentServiceSelection(previousServiceIds);
  equipmentState.selectedServiceId = previousSelectedServiceId;
  equipmentState.djAudioType = previousDjAudioType;
  updateNativeEquipmentServiceSelect();
  return snapshot;
}

function restoreEquipmentEventSnapshot(event) {
  if (!event) return;
  const restoredServiceIds = Array.isArray(event.serviceIds) && event.serviceIds.length
    ? event.serviceIds
    : event.serviceId;
  setEquipmentServiceSelection(restoredServiceIds);
  equipmentState.djAudioType = event.djAudioType || "qsc";
  equipmentState.selectedExtraIds = new Set(event.selectedExtraIds || []);
  equipmentState.manualMainItems = cloneEquipmentSnapshotItems(event.manualMainItems || []);
  equipmentState.manualMainSections = (event.manualMainSections || []).map((section, index) => ({
    id: section.id || `manual-section-${Date.now()}-${index}`,
    title: section.title || "",
    items: cloneEquipmentSnapshotItems(section.items || [])
  }));
  equipmentState.manualExtras = cloneEquipmentSnapshotItems(event.manualExtras || []);
  equipmentState.itemOverrides = equipmentEntriesToMap(event.itemOverrides || []);
  equipmentState.removedItemIds = new Set(event.removedItemIds || []);
  updateNativeEquipmentServiceSelect();
}

function populateEquipmentEventFields(event) {
  const placeInput = equipmentQuery("#equipmentEventPlace");
  const nameInput = equipmentQuery("#equipmentEventName");
  const plannerInput = equipmentQuery("#equipmentEventPhone");
  const dateInput = equipmentQuery("#equipmentEventDate");
  const responsibleInput = equipmentQuery("#equipmentEventResponsible");
  if (placeInput) placeInput.value = event?.place || "";
  if (nameInput) nameInput.value = event?.name || "";
  if (plannerInput) plannerInput.value = event?.phone || "";
  if (dateInput) dateInput.value = event?.date || "";
  if (responsibleInput) responsibleInput.value = event?.responsible || "";
}

function updateEquipmentEventFromCurrent(event) {
  if (!event) return;
  const draft = currentEquipmentEventDraft();
  const snapshot = captureEquipmentEventSnapshot();
  Object.assign(event, draft, snapshot, { id: event.id });
}

function syncActiveEquipmentEvent() {
  const event = equipmentState.events.find((item) => item.id === equipmentState.selectedEventId);
  if (event) updateEquipmentEventFromCurrent(event);
}

function sectionsForEquipmentEvent(event) {
  if (event?.sections?.length) return cloneEquipmentSnapshotSections(event.sections);
  return selectedEquipmentSections();
}

function loadEquipmentEvent(eventId) {
  const event = equipmentState.events.find((item) => item.id === eventId);
  if (!event) return;
  equipmentState.selectedEventId = event.id;
  restoreEquipmentEventSnapshot(event);
  populateEquipmentEventFields(event);
  equipmentState.activeWindow = "review";
  renderEquipmentModule();
}

function eventColumnName(event) {
  return event?.place?.trim() || event?.name?.trim() || "Lugar por definir";
}

function equipmentEventCardTitle(event, index = 0) {
  return event?.place?.trim() || event?.name?.trim() || `Ventana ${index + 1}`;
}

function equipmentEventNameForFile(event) {
  return event?.name?.trim() || event?.place?.trim() || "Evento por definir";
}

function eventSummaryText(events, field, fallback = "Por definir") {
  const values = events
    .map((event) => (field === "date" ? formatEquipmentDate(event[field]) : event[field]))
    .filter((value) => value && value !== "Por definir");
  return values.length ? values.join(" / ") : fallback;
}

function equipmentRowsSummary() {
  const rows = new Map();
  const events = activeEquipmentEvents();
  events.forEach((event) => {
    const sections = equipmentState.events.length ? sectionsForEquipmentEvent(event) : selectedEquipmentSections();
    sections.forEach((section) => {
      section.items.forEach((rawItem) => {
        const { quantity, description } = normalizeEquipmentItem(rawItem);
        const key = normalizeEquipmentKey(description);
        if (!key) return;
        const existing = rows.get(key) || {
          key,
          quantity: 0,
          description,
          eventQuantities: new Map()
        };
        const perEventQuantity = Number(quantity) || 0;
        existing.eventQuantities.set(
          event.id,
          (Number(existing.eventQuantities.get(event.id)) || 0) + perEventQuantity
        );
        existing.quantity += perEventQuantity;
        rows.set(key, existing);
      });
    });
  });
  return [...rows.values()];
}

function tableForEquipmentSections(sections, compact = false) {
  if (!sections.length) {
    return `<p class="equipment-empty">Seleccione un servicio para cargar el equipo.</p>`;
  }
  const rows = sections
    .map((section) => {
      const items = section.items
        .map((rawItem) => {
          const item = normalizeEquipmentItem(rawItem);
          if (!compact && item.editable && item.id) {
            return `
              <tr>
                <td class="equipment-qty">
                  <input class="equipment-line-quantity" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(item.quantity)}" />
                </td>
                <td>
                  <input class="equipment-line-description" data-equipment-item-id="${escapeEquipmentHtml(item.id)}" data-equipment-field="description" type="text" value="${escapeEquipmentHtml(item.description)}" />
                </td>
                <td class="equipment-row-action">
                  <button class="equipment-row-remove" type="button" data-remove-equipment-item="${escapeEquipmentHtml(item.id)}" aria-label="Eliminar línea">X</button>
                </td>
              </tr>`;
          }
          return `
            <tr>
              <td class="equipment-qty">${escapeEquipmentHtml(item.quantity)}</td>
              <td>${escapeEquipmentHtml(item.description)}</td>
              ${compact ? "" : `<td class="equipment-row-action"></td>`}
            </tr>`;
        })
        .join("");
      const categoryAction = !compact && section.manualSection
        ? `<td class="equipment-row-action"><button class="equipment-row-remove" type="button" data-remove-equipment-section="${escapeEquipmentHtml(section.id)}" aria-label="Eliminar subtítulo">X</button></td>`
        : "";
      return `
        <tr class="equipment-category-row">
          <td colspan="${compact || section.manualSection ? "2" : "3"}">${escapeEquipmentHtml(section.title)}</td>
          ${categoryAction}
        </tr>
        ${items}`;
    })
    .join("");

  return `
    <table class="equipment-base-table equipment-service-table${compact ? " equipment-table-compact" : ""}">
      <thead>
        <tr>
          <th>Cantidad</th>
          <th>Equipo</th>
          ${compact ? "" : "<th>Acción</th>"}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function equipmentEventLineCount(event) {
  return sectionsForEquipmentEvent(event).reduce((total, section) => total + (section.items?.length || 0), 0);
}

function renderEquipmentEvents() {
  const host = equipmentQuery("#equipmentEventsList");
  if (!host) return;
  if (!equipmentState.events.length) {
    host.innerHTML = `<p class="equipment-empty equipment-window-empty">Cree una ventana para que aparezca en este panel.</p>`;
    return;
  }
  host.innerHTML = equipmentState.events
    .map((event, index) => {
      const activeClass = event.id === equipmentState.selectedEventId ? " is-active" : "";
      const lineCount = equipmentEventLineCount(event);
      const serviceName = event.serviceName || "Sin servicio";
      const planner = event.phone || "Planner por definir";
      const date = formatEquipmentDate(event.date);
      const cardTitle = equipmentEventCardTitle(event, index);
      const eventName = event.name && event.name !== "Evento por definir" ? event.name : "";
      const eventNameLine = eventName ? `<span>Evento: ${escapeEquipmentHtml(eventName)}</span>` : "";
      return `
        <article class="equipment-event-card${activeClass}">
          <button class="equipment-event-open" type="button" data-open-event="${escapeEquipmentHtml(event.id)}">
            <strong>${escapeEquipmentHtml(`${index + 1}. ${cardTitle}`)}</strong>
            <small>${escapeEquipmentHtml(serviceName)}</small>
            ${eventNameLine}
            <span>${escapeEquipmentHtml(date)} · ${escapeEquipmentHtml(planner)}</span>
            <span>${escapeEquipmentHtml(lineCount)} líneas de equipo</span>
          </button>
          <div class="equipment-event-card-actions">
            <button class="equipment-event-pdf-button" type="button" data-save-event="${escapeEquipmentHtml(event.id)}" aria-label="Guardar PDF de ${escapeEquipmentHtml(cardTitle)}">PDF</button>
            <button class="equipment-event-remove-button" type="button" data-remove-event="${escapeEquipmentHtml(event.id)}" aria-label="Eliminar ventana">X</button>
          </div>
        </article>`;
    })
    .join("");
  host.querySelectorAll("[data-open-event]").forEach((button) => {
    button.addEventListener("click", () => loadEquipmentEvent(button.dataset.openEvent));
  });
  host.querySelectorAll("[data-save-event]").forEach((button) => {
    button.addEventListener("click", () => {
      loadEquipmentEvent(button.dataset.saveEvent);
      saveEquipmentPdf("full");
    });
  });
  host.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", () => removeEquipmentEventById(button.dataset.removeEvent));
  });
}

function addEquipmentEvent() {
  const draft = currentEquipmentEventDraft();
  const status = equipmentQuery("#equipmentSaveStatus");
  const serviceIds = selectedEquipmentServiceIds();
  if (!serviceIds.length) {
    if (status) status.textContent = "Seleccione el tipo de servicio antes de crear una ventana.";
    return;
  }
  if (!draft.place || draft.place === "Lugar por definir") {
    if (status) status.textContent = "Escriba el lugar del evento antes de crear la ventana.";
    return;
  }
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de crear la ventana.";
    return;
  }
  const createdEvents = serviceIds.map((serviceId) => ({
    ...draft,
    ...captureEquipmentEventSnapshotForServiceIds([serviceId]),
    id: `event-${Date.now()}-${equipmentEventCounter++}`
  }));
  equipmentState.events.push(...createdEvents);
  resetEquipmentWindowDraft();
  renderEquipmentModule();
  const nextStatus = equipmentQuery("#equipmentSaveStatus");
  if (nextStatus) {
    nextStatus.textContent = createdEvents.length > 1
      ? `${createdEvents.length} ventanas independientes agregadas para ${draft.place}. Ya puede capturar el siguiente evento.`
      : `Ventana agregada para ${draft.place}. Ya puede capturar el siguiente evento.`;
  }
}

function refreshEquipmentSummaryAndPreview() {
  if (equipmentQuery("#equipmentInventoryTable")) {
    equipmentQuery("#equipmentInventoryTable").innerHTML = tableForEquipmentInventory(equipmentRowsSummary(), true);
  }
  bindEquipmentInventoryInputs();
  renderEquipmentPdfPreview();
  renderEquipmentWindowState();
}

function updateEquipmentItem(itemId, field, value) {
  let manualMain = equipmentState.manualMainItems.find((item) => item.id === itemId);
  if (!manualMain) {
    for (const section of equipmentState.manualMainSections) {
      manualMain = section.items.find((item) => item.id === itemId);
      if (manualMain) break;
    }
  }
  const manualExtra = equipmentState.manualExtras.find((item) => item.id === itemId);
  const target = manualMain || manualExtra;
  const nextValue = field === "quantity" ? Number(value || 0) || 0 : String(value || "");
  if (target) {
    target[field] = nextValue;
    return;
  }
  const override = equipmentState.itemOverrides.get(itemId) || {};
  override[field] = nextValue;
  equipmentState.itemOverrides.set(itemId, override);
}

function pushDeletedEquipment(entry) {
  equipmentState.deletedStack.push(entry);
}

function removeManualEquipmentItem(itemId) {
  const legacyIndex = equipmentState.manualMainItems.findIndex((item) => item.id === itemId);
  if (legacyIndex >= 0) {
    const [item] = equipmentState.manualMainItems.splice(legacyIndex, 1);
    pushDeletedEquipment({ type: "manual-main", item, index: legacyIndex });
    renderEquipmentModule();
    return;
  }

  for (const section of equipmentState.manualMainSections) {
    const itemIndex = section.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      const [item] = section.items.splice(itemIndex, 1);
      pushDeletedEquipment({ type: "manual-section-item", sectionId: section.id, item, index: itemIndex });
      renderEquipmentModule();
      return;
    }
  }

  const extraIndex = equipmentState.manualExtras.findIndex((item) => item.id === itemId);
  if (extraIndex >= 0) {
    const [item] = equipmentState.manualExtras.splice(extraIndex, 1);
    pushDeletedEquipment({ type: "manual-extra", item, index: extraIndex });
    renderEquipmentModule();
    return;
  }

  const override = equipmentState.itemOverrides.get(itemId);
  equipmentState.removedItemIds.add(itemId);
  equipmentState.itemOverrides.delete(itemId);
  pushDeletedEquipment({ type: "service-item", itemId, override });
  renderEquipmentModule();
}

function removeManualEquipmentSection(sectionId) {
  if (sectionId === "equipo-manual") {
    const items = [...equipmentState.manualMainItems];
    if (!items.length) return;
    equipmentState.manualMainItems = [];
    pushDeletedEquipment({ type: "manual-main-items", items });
  } else {
    const sectionIndex = equipmentState.manualMainSections.findIndex((section) => section.id === sectionId);
    if (sectionIndex < 0) return;
    const [section] = equipmentState.manualMainSections.splice(sectionIndex, 1);
    pushDeletedEquipment({ type: "manual-section", section, index: sectionIndex });
  }
  renderEquipmentModule();
}

function restoreLastDeletedEquipment() {
  const entry = equipmentState.deletedStack.pop();
  if (!entry) return;
  if (entry.type === "manual-main") {
    equipmentState.manualMainItems.splice(entry.index, 0, entry.item);
  } else if (entry.type === "manual-section-item") {
    const section = equipmentState.manualMainSections.find((item) => item.id === entry.sectionId);
    if (section) section.items.splice(entry.index, 0, entry.item);
  } else if (entry.type === "manual-extra") {
    equipmentState.manualExtras.splice(entry.index, 0, entry.item);
  } else if (entry.type === "service-item") {
    equipmentState.removedItemIds.delete(entry.itemId);
    if (entry.override) equipmentState.itemOverrides.set(entry.itemId, entry.override);
  } else if (entry.type === "manual-main-items") {
    equipmentState.manualMainItems = [...entry.items, ...equipmentState.manualMainItems];
  } else if (entry.type === "manual-section") {
    equipmentState.manualMainSections.splice(entry.index, 0, entry.section);
  }
  renderEquipmentModule();
}

function bindEquipmentSectionInputs() {
  const host = equipmentQuery("#equipmentMainTable");
  if (!host) return;
  host.querySelectorAll("[data-equipment-item-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.equipmentItemId, input.dataset.equipmentField, event.target.value);
      refreshEquipmentSummaryAndPreview();
    });
    input.addEventListener("change", renderEquipmentModule);
  });
  host.querySelectorAll("[data-remove-equipment-item]").forEach((button) => {
    button.addEventListener("click", () => removeManualEquipmentItem(button.dataset.removeEquipmentItem));
  });
  host.querySelectorAll("[data-remove-equipment-section]").forEach((button) => {
    button.addEventListener("click", () => removeManualEquipmentSection(button.dataset.removeEquipmentSection));
  });
}

function addManualMainEquipmentItem() {
  const quantityInput = equipmentQuery("#equipmentManualMainQuantity");
  const descriptionInput = equipmentQuery("#equipmentManualMainDescription");
  const status = equipmentQuery("#equipmentSaveStatus");
  const description = descriptionInput?.value.trim() || "";
  const quantity = Number(quantityInput?.value || 0) || 0;
  if (!description) {
    if (status) status.textContent = "Escriba el nombre del equipo antes de agregarlo.";
    return;
  }
  const manualSection = ensureManualMainSection();
  manualSection.items.push({
    id: `manual-main-${Date.now()}-${equipmentManualMainCounter++}`,
    quantity,
    description
  });
  if (descriptionInput) descriptionInput.value = "";
  if (quantityInput) quantityInput.value = "1";
  if (status) status.textContent = `Equipo agregado: ${description}`;
  renderEquipmentModule();
}

function addManualEquipmentSubtitle() {
  const subtitleInput = equipmentQuery("#equipmentManualSubtitle");
  const status = equipmentQuery("#equipmentSaveStatus");
  const title = subtitleInput?.value.trim() || "";
  if (!title) {
    if (status) status.textContent = "Escriba el subtítulo antes de agregarlo.";
    return;
  }
  equipmentState.manualMainSections.push({
    id: `manual-section-${Date.now()}-${equipmentManualSectionCounter++}`,
    title,
    items: []
  });
  if (subtitleInput) subtitleInput.value = "";
  if (status) status.textContent = `Subtítulo agregado: ${title}`;
  renderEquipmentModule();
}

function renderEquipmentPredefinedExtras() {
  const host = equipmentQuery("#equipmentPredefinedExtras");
  if (!host) return;
  const services = currentEquipmentServices();
  const extraEntries = services.flatMap((service) => {
    return (service.extras || []).map((extra) => ({ service, extra }));
  });
  if (!extraEntries.length) {
    host.innerHTML = `<p class="equipment-empty">Este servicio no tiene extras cargados.</p>`;
    return;
  }
  const hasMultipleServices = services.length > 1;
  host.innerHTML = extraEntries
    .map(({ service, extra }) => {
      const extraKey = equipmentExtraSelectionKey(service.id, extra.id);
      const checked = isEquipmentExtraSelected(service.id, extra.id, services.length <= 1) ? "checked" : "";
      const itemCount = extra.items?.length || 0;
      const title = hasMultipleServices ? `${service.name} / ${extra.title}` : extra.title;
      return `
        <label class="equipment-extra-card">
          <input type="checkbox" data-extra-key="${escapeEquipmentHtml(extraKey)}" data-extra-id="${escapeEquipmentHtml(extra.id)}" ${checked} />
          <span>
            <strong>${escapeEquipmentHtml(title)}</strong>
            <span>${escapeEquipmentHtml(itemCount)} línea(s) de equipo</span>
          </span>
        </label>`;
    })
    .join("");
  host.querySelectorAll("[data-extra-key]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        equipmentState.selectedExtraIds.add(input.dataset.extraKey);
        equipmentState.selectedExtraIds.delete(input.dataset.extraId);
      } else {
        equipmentState.selectedExtraIds.delete(input.dataset.extraKey);
        equipmentState.selectedExtraIds.delete(input.dataset.extraId);
      }
      renderEquipmentModule();
    });
  });
}

function renderManualEquipmentExtras() {
  const host = equipmentQuery("#equipmentManualExtrasList");
  if (!host) return;
  if (!equipmentState.manualExtras.length) {
    host.innerHTML = `<p class="equipment-empty">Aún no hay extras manuales agregados.</p>`;
    return;
  }
  host.innerHTML = equipmentState.manualExtras
    .map(
      (extra) => `
        <article class="equipment-extra-line equipment-extra-line-editable">
          <label>
            Cantidad
            <input data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="quantity" type="number" min="0" step="1" value="${escapeEquipmentHtml(extra.quantity)}" />
          </label>
          <label>
            Equipo extra
            <input data-manual-extra-id="${escapeEquipmentHtml(extra.id)}" data-equipment-field="description" type="text" value="${escapeEquipmentHtml(extra.description)}" />
          </label>
          <button type="button" data-remove-extra="${escapeEquipmentHtml(extra.id)}" aria-label="Eliminar extra">X</button>
        </article>`
    )
    .join("");
  host.querySelectorAll("[data-manual-extra-id]").forEach((input) => {
    input.addEventListener("input", (event) => {
      updateEquipmentItem(input.dataset.manualExtraId, input.dataset.equipmentField, event.target.value);
      refreshEquipmentSummaryAndPreview();
    });
    input.addEventListener("change", renderEquipmentModule);
  });
  host.querySelectorAll("[data-remove-extra]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.manualExtras = equipmentState.manualExtras.filter((extra) => extra.id !== button.dataset.removeExtra);
      renderEquipmentModule();
    });
  });
}

function addManualEquipmentExtra() {
  const quantityInput = equipmentQuery("#equipmentExtraQuantity");
  const descriptionInput = equipmentQuery("#equipmentExtraDescription");
  const status = equipmentQuery("#equipmentSaveStatus");
  const description = descriptionInput?.value.trim() || "";
  const quantity = Number(quantityInput?.value || 0) || 0;
  if (!description) {
    if (status) status.textContent = "Escriba el nombre del extra antes de agregarlo.";
    return;
  }
  equipmentState.manualExtras.push({
    id: `manual-extra-${Date.now()}-${equipmentExtraCounter++}`,
    quantity,
    description
  });
  if (descriptionInput) descriptionInput.value = "";
  if (quantityInput) quantityInput.value = "1";
  if (status) status.textContent = `Extra agregado: ${description}`;
  renderEquipmentModule();
}

function inventoryValueFor(row) {
  if (equipmentState.inventory.has(row.key)) return Number(equipmentState.inventory.get(row.key)) || 0;
  return row.quantity;
}

function tableForEquipmentInventory(rows, editable = true) {
  if (!rows.length) {
    return `<p class="equipment-empty">El resumen aparecerá al seleccionar un servicio.</p>`;
  }
  const events = activeEquipmentEvents();
  const eventHeaders = events
    .map((event) => `<th>${escapeEquipmentHtml(eventColumnName(event))}</th>`)
    .join("");
  const body = rows
    .map((row) => {
      const inventory = inventoryValueFor(row);
      const difference = inventory - row.quantity;
      const missing = Math.max(0, row.quantity - inventory);
      const rentClass = missing > 0 ? " equipment-rent-needed" : "";
      const observation = equipmentState.observations.get(row.key) || "";
      const eventCells = events
        .map((event) => `<td class="equipment-qty">${escapeEquipmentHtml(row.eventQuantities.get(event.id) || 0)}</td>`)
        .join("");
      return `
        <tr data-equipment-key="${escapeEquipmentHtml(row.key)}">
          <td>${escapeEquipmentHtml(row.description)}</td>
          ${eventCells}
          <td>
            ${
              editable
                ? `<input class="equipment-inventory-input" type="number" min="0" step="1" value="${escapeEquipmentHtml(inventory)}" />`
                : escapeEquipmentHtml(inventory)
            }
          </td>
          <td class="${difference < 0 ? "equipment-missing" : ""}">${escapeEquipmentHtml(difference)}</td>
          <td class="${rentClass}">${missing > 0 ? `RENTA ${missing}` : ""}</td>
          <td>
            ${
              editable
                ? `<input class="equipment-observation-input" type="text" value="${escapeEquipmentHtml(observation)}" placeholder="Observaciones" />`
                : escapeEquipmentHtml(observation)
            }
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table class="equipment-base-table equipment-inventory-table${editable ? "" : " equipment-table-compact"}">
      <thead>
        <tr>
          <th>Equipo</th>
          ${eventHeaders}
          <th>Inventario físico bodega PP</th>
          <th>Faltante o restante de equipo</th>
          <th>Equipo para renta</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function equipmentRentalRows() {
  const events = activeEquipmentEvents();
  return equipmentRowsSummary()
    .map((row) => {
      const inventory = inventoryValueFor(row);
      const missing = Math.max(0, row.quantity - inventory);
      const eventDetails = events
        .map((event) => {
          const quantity = Number(row.eventQuantities.get(event.id)) || 0;
          return quantity > 0 ? `${eventColumnName(event)}: ${quantity}` : "";
        })
        .filter(Boolean)
        .join(" / ");
      return {
        ...row,
        inventory,
        missing,
        eventDetails,
        observation: equipmentState.observations.get(row.key) || ""
      };
    })
    .filter((row) => row.missing > 0);
}

function tableForEquipmentRentalReport(rows) {
  if (!rows.length) {
    return `<p class="equipment-empty">No hay equipo para renta con el inventario actual.</p>`;
  }
  const body = rows
    .map(
      (row) => `
        <tr>
          <td>${escapeEquipmentHtml(row.description)}</td>
          <td>${escapeEquipmentHtml(row.eventDetails)}</td>
          <td class="equipment-qty">${escapeEquipmentHtml(row.quantity)}</td>
          <td class="equipment-qty">${escapeEquipmentHtml(row.inventory)}</td>
          <td class="equipment-rent-needed">${escapeEquipmentHtml(row.missing)}</td>
          <td>${escapeEquipmentHtml(row.observation)}</td>
        </tr>`
    )
    .join("");
  return `
    <table class="equipment-base-table equipment-rental-table equipment-table-compact">
      <thead>
        <tr>
          <th>Equipo</th>
          <th>Eventos</th>
          <th>Total requerido</th>
          <th>Inventario</th>
          <th>Equipo para renta</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>`;
}

function bindEquipmentInventoryInputs() {
  equipmentQuery("#equipmentInventoryTable")
    ?.querySelectorAll("tr[data-equipment-key]")
    .forEach((row) => {
      const key = row.dataset.equipmentKey;
      row.querySelector(".equipment-inventory-input")?.addEventListener("change", (event) => {
        equipmentState.inventory.set(key, event.target.value);
        renderEquipmentModule();
      });
      row.querySelector(".equipment-observation-input")?.addEventListener("change", (event) => {
        equipmentState.observations.set(key, event.target.value);
        renderEquipmentPdfPreview();
      });
    });
}

function renderEquipmentWindowState() {
  const activeWindow = equipmentState.activeWindow === "summary" ? "summary" : "review";
  const mainPanel = equipmentQuery("#equipmentMainPanel");
  const extrasPanel = equipmentQuery("#equipmentExtrasPanel");
  const inventoryPanel = equipmentQuery("#equipmentInventoryPanel");
  const reviewButton = equipmentQuery("#equipmentReviewWindowButton");
  const summaryButton = equipmentQuery("#equipmentSummaryWindowButton");
  const undoButton = equipmentQuery("#equipmentUndoDeleteButton");
  const removeButton = equipmentQuery("#equipmentRemoveWindowButton");
  if (mainPanel) mainPanel.classList.toggle("is-hidden", activeWindow !== "review");
  if (extrasPanel) extrasPanel.classList.toggle("is-hidden", activeWindow !== "review");
  if (inventoryPanel) inventoryPanel.classList.toggle("is-hidden", activeWindow !== "summary");
  if (reviewButton) reviewButton.classList.toggle("is-active", activeWindow === "review");
  if (summaryButton) summaryButton.classList.toggle("is-active", activeWindow === "summary");
  if (undoButton) undoButton.disabled = !equipmentState.deletedStack.length;
  if (removeButton) removeButton.disabled = !equipmentState.selectedEventId;
}

function switchEquipmentWindow(windowName) {
  equipmentState.activeWindow = windowName === "summary" ? "summary" : "review";
  renderEquipmentModule();
}

function resetEquipmentWindowDraft() {
  equipmentState.selectedEventId = "";
  equipmentState.selectedServiceId = "";
  equipmentState.selectedServiceIds.clear();
  equipmentState.djAudioType = "qsc";
  equipmentState.selectedExtraIds.clear();
  equipmentState.manualMainItems = [];
  equipmentState.manualMainSections = [];
  equipmentState.manualExtras = [];
  equipmentState.itemOverrides.clear();
  equipmentState.removedItemIds.clear();
  equipmentState.deletedStack = [];
  equipmentState.activeWindow = "review";
  updateNativeEquipmentServiceSelect();
  populateEquipmentEventFields(null);
  const notesInput = equipmentQuery("#equipmentNotes");
  if (notesInput) notesInput.value = "";
}

function saveCurrentEquipmentWindow() {
  const status = equipmentQuery("#equipmentSaveStatus");
  const draft = currentEquipmentEventDraft();
  if (!currentEquipmentService()) {
    if (status) status.textContent = "Seleccione el tipo de servicio antes de guardar la ventana.";
    return;
  }
  if (!draft.place || draft.place === "Lugar por definir") {
    if (status) status.textContent = "Escriba el lugar del evento antes de guardar la ventana.";
    return;
  }
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de guardar la ventana.";
    return;
  }
  const event = selectedEquipmentEvent();
  if (!event) {
    addEquipmentEvent();
    return;
  }
  if (selectedEquipmentServiceIds().length > 1) {
    if (status) status.textContent = "Una ventana solo puede guardar un servicio. Use Agregar ventana para separar los servicios seleccionados.";
    return;
  }
  updateEquipmentEventFromCurrent(event);
  if (status) status.textContent = `Ventana actualizada: ${event.place || event.name}`;
  renderEquipmentModule();
}

function removeEquipmentEventById(eventId) {
  if (!eventId) return;
  const status = equipmentQuery("#equipmentSaveStatus");
  if (equipmentState.selectedEventId && equipmentState.selectedEventId !== eventId) {
    syncActiveEquipmentEvent();
  }
  const index = equipmentState.events.findIndex((event) => event.id === eventId);
  if (index < 0) return;
  const removed = equipmentState.events[index];
  const wasSelected = equipmentState.selectedEventId === eventId;
  equipmentState.events.splice(index, 1);
  if (wasSelected) {
    const nextEvent = equipmentState.events[index] || equipmentState.events[index - 1] || null;
    equipmentState.selectedEventId = "";
    if (nextEvent) {
      loadEquipmentEvent(nextEvent.id);
      if (status) status.textContent = `Ventana eliminada: ${removed.place || removed.name || "sin nombre"}`;
      return;
    }
    resetEquipmentWindowDraft();
  }
  if (status) status.textContent = `Ventana eliminada: ${removed.place || removed.name || "sin nombre"}`;
  renderEquipmentModule();
}

function removeEquipmentActiveWindow() {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!equipmentState.selectedEventId) {
    if (status) status.textContent = "Seleccione una ventana para eliminarla.";
    return;
  }
  removeEquipmentEventById(equipmentState.selectedEventId);
}

function clearEquipmentWorkingArea() {
  if (!window.confirm("¿Está seguro que desea limpiar todo a 0?")) return;
  equipmentState.events = [];
  resetEquipmentWindowDraft();
  equipmentState.inventory.clear();
  equipmentState.observations.clear();
  renderEquipmentModule();
}

function renderEquipmentPdfPreview() {
  const service = currentEquipmentService();
  const sections = selectedEquipmentSections();
  const events = equipmentPdfEvents();
  const summaryEvents = activeEquipmentEvents();
  const place = eventSummaryText(events, "place", "Lugar por definir");
  const eventName = eventSummaryText(events, "name");
  const phone = eventSummaryText(events, "phone");
  const date = eventSummaryText(events, "date");
  const rentPlace = eventSummaryText(summaryEvents, "place", "Lugar por definir");
  const rentEventName = eventSummaryText(summaryEvents, "name");
  const rentPhone = eventSummaryText(summaryEvents, "phone");
  const rentDate = eventSummaryText(summaryEvents, "date");
  const notes = equipmentQuery("#equipmentNotes")?.value.trim() || "";
  const rentalRows = equipmentRentalRows();

  const title = service?.name || "Cuadro de equipo";
  if (equipmentQuery("#equipmentPdfTitle")) equipmentQuery("#equipmentPdfTitle").textContent = title;
  if (equipmentQuery("#equipmentPdfPlace")) equipmentQuery("#equipmentPdfPlace").textContent = place;
  if (equipmentQuery("#equipmentPdfEvent")) equipmentQuery("#equipmentPdfEvent").textContent = eventName;
  if (equipmentQuery("#equipmentPdfPhone")) equipmentQuery("#equipmentPdfPhone").textContent = phone;
  if (equipmentQuery("#equipmentPdfDate")) equipmentQuery("#equipmentPdfDate").textContent = date;

  const notesEl = equipmentQuery("#equipmentPdfNotes");
  if (notesEl) {
    notesEl.textContent = notes;
    notesEl.classList.toggle("is-hidden", !notes);
  }

  if (equipmentQuery("#equipmentPdfMainTable")) {
    equipmentQuery("#equipmentPdfMainTable").innerHTML = tableForEquipmentSections(sections, true);
  }
  if (equipmentQuery("#equipmentRentPdfTitle")) equipmentQuery("#equipmentRentPdfTitle").textContent = `Renta - ${title}`;
  if (equipmentQuery("#equipmentRentPdfPlace")) equipmentQuery("#equipmentRentPdfPlace").textContent = rentPlace;
  if (equipmentQuery("#equipmentRentPdfEvents")) equipmentQuery("#equipmentRentPdfEvents").textContent = rentEventName;
  if (equipmentQuery("#equipmentRentPdfPhone")) equipmentQuery("#equipmentRentPdfPhone").textContent = rentPhone;
  if (equipmentQuery("#equipmentRentPdfDate")) equipmentQuery("#equipmentRentPdfDate").textContent = rentDate;
  const rentNotesEl = equipmentQuery("#equipmentRentPdfNotes");
  if (rentNotesEl) {
    rentNotesEl.textContent = notes;
    rentNotesEl.classList.toggle("is-hidden", !notes);
  }
  if (equipmentQuery("#equipmentRentPdfTable")) {
    equipmentQuery("#equipmentRentPdfTable").innerHTML = tableForEquipmentRentalReport(rentalRows);
  }
}

function renderEquipmentModule() {
  syncSelectedEquipmentService();
  const service = currentEquipmentService();
  const workspace = equipmentQuery("#equipmentWorkspace");
  if (workspace) workspace.classList.toggle("is-hidden", !service);
  if (equipmentQuery("#equipmentServiceName")) equipmentQuery("#equipmentServiceName").textContent = service?.name || "";
  renderDjAudioOptions();
  renderEquipmentServicePicker();
  renderEquipmentEvents();
  if (equipmentQuery("#equipmentMainTable")) {
    equipmentQuery("#equipmentMainTable").innerHTML = tableForEquipmentSections(selectedEquipmentSections());
  }
  bindEquipmentSectionInputs();
  renderEquipmentPredefinedExtras();
  renderManualEquipmentExtras();
  if (equipmentQuery("#equipmentInventoryTable")) {
    equipmentQuery("#equipmentInventoryTable").innerHTML = tableForEquipmentInventory(equipmentRowsSummary(), true);
  }
  bindEquipmentInventoryInputs();
  renderEquipmentPdfPreview();
  renderEquipmentWindowState();
}

function renderDjAudioOptions() {
  const audioOptions = equipmentQuery("#equipmentDjAudioOptions");
  if (!audioOptions) return;
  const audioServices = currentEquipmentServices().filter((service) => service.audioOptions);
  const service = audioServices[0] || null;
  const hasAudioOptions = Boolean(service);
  audioOptions.classList.toggle("is-hidden", !hasAudioOptions);
  const label = audioOptions.querySelector("[data-audio-options-label]");
  if (label) {
    label.textContent = audioServices.length > 1
      ? `Tipo de audio para ${audioServices.length} servicios`
      : hasAudioOptions ? `Tipo de audio para ${service.name}` : "Tipo de audio";
  }
  audioOptions.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    const audioType = button.dataset.djAudioType;
    const isAvailable = hasAudioOptions && audioServices.some((audioService) => Boolean(audioService.audioOptions?.[audioType]));
    button.hidden = hasAudioOptions && !isAvailable;
    button.classList.toggle("is-active", button.dataset.djAudioType === equipmentState.djAudioType);
  });
}

async function equipmentPdfHtml(documentSelector = "#equipmentPdfDocument", title = "Cuadro de equipo") {
  const stylesheet = await fetch("styles.css", { credentials: "same-origin" }).then((response) => response.text());
  const documentHtml = equipmentQuery(documentSelector)?.outerHTML || "";
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeEquipmentHtml(title)}</title>
    <style>
      ${stylesheet}
      body { margin: 0; background: #ffffff; }
      .equipment-pdf-document { display: block; max-width: none; margin: 0; box-shadow: none; border: 0; }
      .equipment-pdf-document .equipment-base-table { min-width: 0; }
      .equipment-pdf-document input { border: 0; padding: 0; }
      @page { size: letter; margin: 8mm; }
    </style>
  </head>
  <body>${documentHtml}</body>
</html>`;
}

async function equipmentUsagePdfHtml() {
  const stylesheet = await fetch("styles.css", { credentials: "same-origin" }).then((response) => response.text());
  const service = currentEquipmentService();
  const title = service?.name ? `Equipo y extras - ${service.name}` : "Equipo y extras";
  const tableHtml = tableForEquipmentSections(warehousePdfSections(), true);
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeEquipmentHtml(title)}</title>
    <style>
      ${stylesheet}
      body { margin: 0; background: #ffffff; }
      .equipment-pdf-document { display: block; max-width: none; margin: 0; padding: 0; box-shadow: none; border: 0; }
      .equipment-pdf-document .equipment-base-table { min-width: 0; width: 100%; }
      .equipment-pdf-document .equipment-base-table th,
      .equipment-pdf-document .equipment-base-table td { break-inside: avoid; }
      @page { size: letter; margin: 8mm; }
    </style>
  </head>
  <body>
    <section class="equipment-pdf-document equipment-usage-pdf-document">
      ${tableHtml}
    </section>
  </body>
</html>`;
}

const equipmentPreferredPdfFolderName = "Cuadros de Equipo";

function equipmentPdfFileName(mode = "full") {
  const service = currentEquipmentService();
  const events = mode === "rent" ? activeEquipmentEvents() : equipmentPdfEvents();
  const eventName = cleanEquipmentFilePart(events.map(equipmentEventNameForFile).join(" - ") || "Evento por definir", "Evento por definir");
  const plannerName = cleanEquipmentFilePart(events.map((event) => event.phone).join(" - ") || "Planner por definir", "Planner por definir");
  const serviceName = cleanEquipmentFilePart(service?.name || "Extras", "Extras");
  const documentType = mode === "rent" ? `Renta ${serviceName}` : serviceName;
  const eventDates = cleanEquipmentFilePart(events.map((event) => formatEquipmentDateForFile(event.date)).join(" - "), "Fecha por definir");
  return `${eventName} - ${plannerName} - ${documentType} - ${eventDates}.pdf`;
}

function equipmentPdfDownloadUrl(pdfUrl) {
  try {
    return new URL(pdfUrl, window.location.origin).href;
  } catch {
    return pdfUrl;
  }
}

function downloadEquipmentPdfFallback(fileName, pdfBlob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(pdfBlob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function writableEquipmentFolderHandle(directoryHandle) {
  if (!directoryHandle) return null;
  if (typeof directoryHandle.queryPermission === "function") {
    const currentPermission = await directoryHandle.queryPermission({ mode: "readwrite" });
    if (currentPermission === "granted") return directoryHandle;
  }
  if (typeof directoryHandle.requestPermission === "function") {
    const requestedPermission = await directoryHandle.requestPermission({ mode: "readwrite" });
    if (requestedPermission === "granted") return directoryHandle;
  }
  return null;
}

async function saveEquipmentPdfCopyToComputer(data, savedLabel) {
  const fileName = cleanEquipmentFilePart(data?.fileName || "Cuadro de Equipo.pdf", "Cuadro de Equipo.pdf");
  const isLocalApp = ["127.0.0.1", "localhost", "::1"].includes(window.location.hostname);
  if (isLocalApp && data?.folder && !String(data.folder).startsWith("/data/")) {
    return `${savedLabel}: ${data.fileName} en ${data.folder}`;
  }

  const pdfUrl = data?.pdfUrl || data?.absolutePdfUrl;
  if (!pdfUrl) return `${savedLabel}: ${fileName}`;

  const pdfResponse = await fetch(equipmentPdfDownloadUrl(pdfUrl), { credentials: "same-origin" });
  if (!pdfResponse.ok) throw new Error("No se pudo descargar el PDF generado para guardarlo en esta Mac.");
  const pdfBlob = await pdfResponse.blob();

  if (!window.showDirectoryPicker) {
    downloadEquipmentPdfFallback(fileName, pdfBlob);
    return `${savedLabel}: ${fileName}. Se descargó el PDF; este navegador no permite guardar directo en ${equipmentPreferredPdfFolderName}.`;
  }

  const directoryHandle = await window.showDirectoryPicker({
    id: "requerimiento-equipo-cuadros",
    mode: "readwrite",
    startIn: "documents"
  });
  if ((directoryHandle.name || "") !== equipmentPreferredPdfFolderName) {
    throw new Error(`Seleccione la carpeta exacta: ${equipmentPreferredPdfFolderName}.`);
  }

  const writableHandle = await writableEquipmentFolderHandle(directoryHandle);
  if (!writableHandle) throw new Error(`No se otorgó permiso para escribir en ${equipmentPreferredPdfFolderName}.`);

  const fileHandle = await writableHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(pdfBlob);
  await writable.close();
  return `${savedLabel}: ${fileName} en ${equipmentPreferredPdfFolderName}`;
}

async function saveEquipmentPdf(mode = "full") {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!currentEquipmentService()) {
    if (status) status.textContent = "Seleccione un servicio antes de guardar.";
    return;
  }
  if (mode === "full" && selectedEquipmentServiceIds().length > 1) {
    if (status) status.textContent = "Para varios servicios, primero cree ventanas independientes. Cada ventana guarda su propio PDF.";
    return;
  }
  if (mode === "rent" && !equipmentRentalRows().length) {
    if (status) status.textContent = "No hay equipo para rentar con el inventario actual.";
    return;
  }
  if (status) status.textContent = mode === "rent" ? "Generando PDF de renta..." : "Generando PDF para bodega...";
  try {
    const documentSelector = mode === "rent" ? "#equipmentRentPdfDocument" : "#equipmentPdfDocument";
    const title = mode === "rent" ? "Resumen de equipo para renta" : "Equipo y extras para bodega";
    const html = await equipmentPdfHtml(documentSelector, title);
    const response = await fetch("/api/cuadros-equipo", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: equipmentPdfFileName(mode),
        html
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo guardar el cuadro de equipo.");
    const savedLabel = mode === "rent" ? "PDF de renta guardado" : "PDF de bodega guardado";
    let statusMessage = `${savedLabel}: ${data.fileName} en ${data.folder}`;
    try {
      statusMessage = await saveEquipmentPdfCopyToComputer(data, savedLabel);
    } catch (saveError) {
      statusMessage = saveError?.name === "AbortError"
        ? `${savedLabel}: ${data.fileName}. Selección de carpeta cancelada.`
        : `${savedLabel}: ${data.fileName}. No se copió a ${equipmentPreferredPdfFolderName}: ${saveError.message}`;
    }
    if (status) status.textContent = statusMessage;
    window.open(data.pdfUrl, "_blank", "noopener");
  } catch (error) {
    if (status) status.textContent = error.message || "No se pudo guardar el PDF.";
  }
}

function initEquipmentModule() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  serviceSelect.addEventListener("change", () => selectEquipmentService());
  document.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.djAudioType = button.dataset.djAudioType || "qsc";
      renderEquipmentModule();
    });
  });
  [
    "#equipmentEventPlace",
    "#equipmentEventName",
    "#equipmentEventPhone",
    "#equipmentEventDate",
    "#equipmentEventResponsible",
    "#equipmentNotes"
  ].forEach((selector) => {
    equipmentQuery(selector)?.addEventListener("input", renderEquipmentModule);
  });
  equipmentQuery("#equipmentAddEventButton")?.addEventListener("click", addEquipmentEvent);
  equipmentQuery("#equipmentAddMainItemButton")?.addEventListener("click", addManualMainEquipmentItem);
  equipmentQuery("#equipmentManualMainDescription")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualMainEquipmentItem();
    }
  });
  equipmentQuery("#equipmentAddSubtitleButton")?.addEventListener("click", addManualEquipmentSubtitle);
  equipmentQuery("#equipmentManualSubtitle")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualEquipmentSubtitle();
    }
  });
  equipmentQuery("#equipmentAddExtraButton")?.addEventListener("click", addManualEquipmentExtra);
  equipmentQuery("#equipmentExtraDescription")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addManualEquipmentExtra();
    }
  });
  equipmentQuery("#equipmentSavePdfButton")?.addEventListener("click", () => saveEquipmentPdf("full"));
  equipmentQuery("#equipmentSaveRentPdfButton")?.addEventListener("click", () => saveEquipmentPdf("rent"));
  equipmentQuery("#equipmentReviewWindowButton")?.addEventListener("click", () => switchEquipmentWindow("review"));
  equipmentQuery("#equipmentSummaryWindowButton")?.addEventListener("click", () => switchEquipmentWindow("summary"));
  equipmentQuery("#equipmentAddWindowButton")?.addEventListener("click", saveCurrentEquipmentWindow);
  equipmentQuery("#equipmentRemoveWindowButton")?.addEventListener("click", removeEquipmentActiveWindow);
  equipmentQuery("#equipmentClearAllButton")?.addEventListener("click", clearEquipmentWorkingArea);
  equipmentQuery("#equipmentUndoDeleteButton")?.addEventListener("click", restoreLastDeletedEquipment);
  renderEquipmentModule();
  if (typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(renderEquipmentModule);
  } else {
    window.setTimeout(renderEquipmentModule, 0);
  }
}

document.addEventListener("DOMContentLoaded", initEquipmentModule);
