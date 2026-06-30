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
    title: "Caja de Herramientas",
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
    title: "Equipo de Limpieza",
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
    title: "Equipo de proteccion",
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
  "sunday-funday-a": {
    name: "SUNDAY FUNDAY A",
    source: "SUNDAY A.pdf",
    mainSections: [
      {
        title: "CONSOLA",
        items: [
          [1, "consola de mesa X32 beringer con su AC y case"],
          [1, "router con su funda (cable de RED y cargador)"],
          [2, "ipad nuevo con su protector y cargador de ipad con su cable"]
        ]
      },
      {
        title: "TELEFONO (MOCHILA)",
        items: [
          [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
          [1, "cable lighthing y cable tipo C"]
        ]
      },
      {
        title: "AUDIO",
        items: [
          [4, "bocinas QSC con su power spicon"],
          [2, "pedestales de bocina hercules con su case"],
          [1, "amplificador TP18000 con sus 2 cables spicon en case (1 DBX y 1 AC)"],
          [2, "sub QSC con su case"],
          [1, "snake de audio 18 entradas"],
          [1, "grabadora de audio"]
        ]
      },
      {
        title: "MICROFONIA PARA BATERIA",
        items: [
          [4, "mic. SM57"],
          [1, "mic. Beta 52"],
          [2, "mic. Pg81 con su case"],
          [4, "clamps para microfonos con su case"]
        ]
      },
      {
        title: "MICROFONIA PARA VOCES",
        items: [
          [2, "mic. Sm58 alambrico con su case (Diego y Backup de toolback)"],
          [2, "mic. Sm 58 inalambrico con su funda (1 receptor y 1 cargador)"],
          [1, "mic. Saxo con su funda (1 receptor y 1 cargador)"],
          [1, "mic. Violin con su funda (1 receptor y 1 cargador)"],
          [2, "mic. Blx4 Shure cantantes con su funda"],
          [1, "funda para microfono Paola (rosado)"],
          [1, "pedal para microfono tolback"],
          [2, "cajas directas Whirlwhind"]
        ]
      },
      {
        title: "PEDESTALES",
        items: [
          [1, "case de teclado"],
          [3, "pedestales para antena HD con su case"],
          [1, "pedestal recto Paola HD con su case"],
          [1, "pedestal de Jorge para Ipad con su case"],
          [1, "pedestal de brazo Diego HD con su case"],
          [1, "pedestal de hit hat Dw con su case"],
          [1, "pedestal para teclado"],
          [2, "pedestales OH de brazo para platos con su case"]
        ]
      },
      {
        title: "MONITOREO INTERNO",
        items: [
          [2, "monitores turbosound con su power spicon en su case"],
          [1, "bajo turbosound con su power spicon en su case"],
          [2, "pedestales para monitores con su case"]
        ]
      },
      {
        title: "COMPUTADORA",
        items: [
          [1, "computadora de prueba con su mochila (1 cargador con su cable, 1 cable de RED, 1 trapo)"],
          [1, "Mochila Jorge Merida complemento de computadora de prueba (2 cargadores de IPAD, 2 IPAD, 2 in ears extras)"]
        ]
      },
      {
        title: "IN EARS",
        items: [
          [2, "sistemas completos in ears Acemic (8 in ears) con su cargador y case"],
          [1, "sistema completo in ears grupo shure (6 in ears) con su cargador y case"],
          [2, "antenas para mic. Shure cantantes con su case"],
          [1, "antena In ears grupo con su case"]
        ]
      },
      {
        title: "BACKLINE INSTRUMENTOS - BATERIA",
        items: [
          [1, "bombo (pedal) DW con su funda"],
          [1, "alfombra"],
          [1, "banquito Diego Dw"],
          [2, "pares de baquetas con su estuche"],
          [1, "caja DW con su funda"],
          [1, "tom no.1 DW con su funda"],
          [1, "tom no.2 con su funda"],
          [1, "pedal de bombo con su case"],
          [1, "floortom DW con su funda"]
        ]
      },
      {
        title: "PLATOS",
        items: [
          [1, "hit hat zildjan con su funda"],
          [1, "china zildjan con su funda"],
          [1, "ride zildjan con su funda"]
        ]
      },
      {
        title: "ILUMINACION",
        items: [
          [6, "beam 260 con su power spicon y case"],
          [6, "pares LED con su AC y case"],
          [2, "luces circulares con su power spicon"],
          [2, "lasers grandes con sus power spicon y case"],
          [2, "luces Wash con su spicon y case"],
          [24, "clamps"],
          [24, "bases de clamps"],
          [4, "tuvos galvanizados con sus hamburguesas dobles"],
          [2, "spliter de luces 6 canales american dj con su AC"],
          [2, "blinders multicolor con sus power spicon y case"],
          [2, "maquinas de humo con su AC, su control y 1 caja plastica"],
          [1, "galon de liquido de humo"],
          [2, "ventilador con su cable de corriente y su funda"]
        ]
      },
      {
        title: "ESTRUCTURAS",
        items: [
          [2, "cajones de madera negro para músicos"],
          [2, "marcos de dj both con su tela (grande) controles"],
          [1, "marco de dj both con su tela (pequeño) DJ"],
          [1, "dj booth case"]
        ]
      },
      {
        title: "ESTRUCTURAS DE 2 A 3.50 METROS FORRADAS",
        items: [
          [6, "estructuras de 2 metros"],
          [8, "estructuras de 0.50 centimetros"],
          [6, "platinas pequeñas"],
          [6, "platinas grandes"],
          [100, "pines"],
          [40, "chiches"],
          [1, "interfaz con su cable de RED y su cargador (compu mouse, cargador, adaptador) (monitor, HDMI, cable de corriente) con su case"]
        ]
      },
      {
        title: "TELAS PARA FORRAR",
        items: [
          [6, "telas de 3mts para forrar truss en color a definir"],
          [1, "tela pequeña para forrar dj booth color a definir (DJ)"],
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
          [1, "case de pulpos (6 grandes y 6 pequeños)"],
          [1, "tcj calibre No. 4 (30 metros)"],
          [10, "cuadritos de corriente"],
          [10, "regletas en case"],
          [60, "cables XLR en case"],
          [40, "extensiones"]
        ]
      },
      {
        title: "BATERIAS",
        items: [
          [7, "baterias cuadradas shure recargables con su case"],
          [3, "cargadores dobles para baterias shure con su case"],
          [24, "baterias recargables bonai"],
          [1, "cargador para bateria bonai"]
        ]
      }
    ],
    extras: [
      {
        id: "pistola-led-co2",
        title: "Pistola LED CO2",
        items: [
          [1, "pistola de co2"],
          [1, "manguera de 10mts. Para pistola co2"],
          [1, "cilindro de CO2 lleno con tapadera"],
          [4, "1 cangrejo para co2, 1 funda de co2, 1 troquet y 1 strap pequeño"]
        ]
      },
      {
        id: "pirotecnia-fria",
        title: "Pirotecnia Fria",
        items: [
          [2, "maquinas de pirotecnia fria"],
          [2, "sobre de polvo para pirotecnia"],
          [1, "DMX para pirotecnia (cases de Jorge)"]
        ]
      },
      {
        id: "toldos",
        title: "Toldos",
        items: [
          [1, "toldito blanco de 3 x 3 con tubos galvanizados con paredes"],
          [1, "toldito blanco de 2 x 2 con tubos galvanizados con paredes"],
          [2, "mesas plegables grandes"],
          [2, "luces par LED con su AC para toldo"]
        ]
      },
      {
        id: "extras-operativos",
        title: "Extras operativos",
        items: [
          [1, "extintor"],
          [1, "bolsa de agua pura"],
          [5, "dop teip (caja de herramienta)"],
          [3, "paquetes de cinchos (caja de herramienta)"],
          [7, "cinta de aislar (caja de herramienta)"],
          [4, "intercomunicadores hollyland con su cargadores y estuche"]
        ]
      },
      {
        id: "caja-herramientas",
        title: "Caja de Herramientas",
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
          [1, "multímetro o tester marca fluke (estuche)"]
        ]
      },
      {
        id: "equipo-limpieza",
        title: "Equipo de Limpieza",
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
        id: "equipo-proteccion",
        title: "Equipo de proteccion",
        items: [
          [10, "bolsas jardineras de tonel"],
          [3, "retazos de nylon para tapar equipo"]
        ]
      },
      {
        id: "seguridad-industrial",
        title: "Equipo de Seguridad Industrial",
        items: [
          [6, "casco"],
          [6, "chalecos"],
          [0, "botas"],
          [6, "pares de guantes"],
          [1, "arnes completo para subir"]
        ]
      }
    ]
  },
  "sunday-funday-b": {
    name: "SUNDAY FUNDAY B",
    source: "SUNDAY B.pdf",
    mainSections: [
      {
        title: "CONSOLA",
        items: [
          [1, "consola X32 Rack con su AC y case"],
          [1, "router con su funda (cable de RED y cargador)"],
          [2, "ipad viejos con su protector y cargador de ipad con su cable"]
        ]
      },
      {
        title: "TELEFONO (MOCHILA)",
        items: [
          [1, "celular, cargador para telefono con su cable, cable de celular para audio"],
          [1, "cable lighthing y cable tipo C"]
        ]
      },
      {
        title: "AUDIO",
        items: [
          [4, "bocinas QSC con su power spicon"],
          [2, "pedestales de bocina hercules con su case"],
          [1, "amplificador TP18000 con sus 2 cables spicon en case (1 DBX y 1 AC)"],
          [2, "sub QSC con su case"],
          [1, "snake de audio 18 entradas"],
          [1, "grabadora de audio"]
        ]
      },
      {
        title: "MICROFONIA PARA BATERIA",
        items: [
          [4, "mic. SM57"],
          [1, "mic. Beta 52"],
          [2, "mic. Pg81 con su case"],
          [4, "clamps para microfonos con su case"]
        ]
      },
      {
        title: "MICROFONIA PARA VOCES",
        items: [
          [2, "mic. Sm58 alambrico con su case (Diego y Backup de toolback)"],
          [2, "mic. Sm 58 inalambrico con su funda (1 receptor y 1 cargador)"],
          [1, "mic. Saxo con su funda (1 receptor y 1 cargador)"],
          [1, "mic. Violin con su funda (1 receptor y 1 cargador)"],
          [2, "mic. Blx4 Shure cantantes con su funda"],
          [1, "funda para microfono Paola (rosado)"],
          [1, "pedal para microfono tolback"],
          [2, "cajas directas Whirlwhind"]
        ]
      },
      {
        title: "PEDESTALES",
        items: [
          [1, "case de teclado"],
          [3, "pedestales para antena HD con su case"],
          [1, "pedestal recto Paola HD con su case"],
          [1, "pedestal de Jorge para Ipad con su case"],
          [1, "pedestal de brazo Diego HD con su case"],
          [1, "pedestal de hit hat Dw con su case"],
          [1, "pedestal para teclado"],
          [2, "pedestales OH de brazo para platos con su case"]
        ]
      },
      {
        title: "MONITOREO INTERNO",
        items: [
          [2, "monitores Dass con su power spicon en su case"],
          [1, "bajo turbosound con su power spicon en su case"]
        ]
      },
      {
        title: "COMPUTADORA",
        items: [
          [1, "computadora de prueba con su mochila (1 cargador con su cable, 1 cable de RED, 1 trapo)"],
          [1, "Mochila Jorge Merida complemento de computadora de prueba (2 cargadores de IPAD, 2 IPAD, 2 in ears extras)"]
        ]
      },
      {
        title: "IN EARS",
        items: [
          [2, "sistemas completos in ears Acemic (8 in ears) con su cargador y case"],
          [1, "sistema completo in ears grupo shure (6 in ears) con su cargador y case"],
          [2, "antenas para mic. Shure cantantes con su case"],
          [1, "antena In ears grupo con su case"]
        ]
      },
      {
        title: "BACKLINE INSTRUMENTOS - BATERIA",
        items: [
          [1, "bombo (pedal) Grech con su funda"],
          [1, "alfombra"],
          [1, "banquito Diego Dw"],
          [2, "pares de baquetas con su estuche"],
          [1, "caja Grech con su funda"],
          [1, "tom no.1 Grech con su funda"],
          [1, "tom no.2 con su funda"],
          [1, "pedal de bombo con su case"],
          [1, "floortom Grech con su funda"]
        ]
      },
      {
        title: "PLATOS",
        items: [
          [1, "hit hat zildjan con su funda"],
          [1, "china zildjan con su funda"],
          [1, "ride zildjan con su funda"]
        ]
      },
      {
        title: "ILUMINACION",
        items: [
          [6, "beam 260 con su power spicon y case"],
          [6, "pares LED con su AC y case"],
          [2, "luces circulares con su power spicon"],
          [2, "lasers grandes con sus power spicon y case"],
          [2, "luces Wash con su spicon y case"],
          [24, "clamps"],
          [24, "bases de clamps"],
          [4, "tuvos galvanizados con sus hamburguesas dobles"],
          [2, "spliter de luces 6 canales american dj con su AC"],
          [2, "blinders multicolor con sus power spicon y case"],
          [2, "maquinas de humo con su AC, su control y 1 caja plastica"],
          [1, "galon de liquido de humo"],
          [2, "ventilador con su cable de corriente y su funda"]
        ]
      },
      {
        title: "ESTRUCTURAS",
        items: [
          [2, "cajones de madera negro para músicos"],
          [2, "marcos de dj both con su tela (grande) controles"],
          [1, "marco de dj both con su tela (pequeño) DJ"],
          [1, "dj booth case"]
        ]
      },
      {
        title: "ESTRUCTURAS DE 2 A 3.50 METROS FORRADAS",
        items: [
          [6, "estructuras de 2 metros"],
          [8, "estructuras de 0.50 centimetros"],
          [6, "platinas pequeñas"],
          [6, "platinas grandes"],
          [100, "pines"],
          [40, "chiches"],
          [1, "interfaz con su cable de RED y su cargador (compu mouse, cargador, adaptador) (monitor, HDMI, cable de corriente) con su case"]
        ]
      },
      {
        title: "TELAS PARA FORRAR",
        items: [
          [6, "telas de 3mts para forrar truss en color a definir"],
          [1, "tela pequeña para forrar dj booth color a definir (DJ)"],
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
          [1, "case de pulpos (6 grandes y 6 pequeños)"],
          [1, "tcj calibre No. 4 (30 metros)"],
          [10, "cuadritos de corriente"],
          [10, "regletas en case"],
          [60, "cables XLR en case"],
          [40, "extensiones"]
        ]
      },
      {
        title: "BATERIAS",
        items: [
          [7, "baterias cuadradas shure recargables con su case"],
          [3, "cargadores dobles para baterias shure con su case"],
          [24, "baterias recargables bonai"],
          [1, "cargador para bateria bonai"]
        ]
      }
    ],
    extras: [
      {
        id: "pistola-led-co2",
        title: "Pistola LED CO2",
        items: [
          [1, "pistola de co2"],
          [1, "manguera de 10mts. Para pistola co2"],
          [1, "cilindro de CO2 lleno con tapadera"],
          [4, "1 cangrejo para co2, 1 funda de co2, 1 troquet y 1 strap pequeño"]
        ]
      },
      {
        id: "pirotecnia-fria",
        title: "Pirotecnia Fria",
        items: [
          [2, "maquinas de pirotecnia fria"],
          [2, "sobre de polvo para pirotecnia"],
          [1, "DMX para pirotecnia (cases de Jorge)"]
        ]
      },
      {
        id: "toldos",
        title: "Toldos",
        items: [
          [1, "toldito blanco de 3 x 3 con tubos galvanizados con paredes"],
          [1, "toldito blanco de 2 x 2 con tubos galvanizados con paredes"],
          [2, "mesas plegables grandes"],
          [2, "luces par LED con su AC para toldo"]
        ]
      },
      {
        id: "extras-operativos",
        title: "Extras operativos",
        items: [
          [1, "extintor"],
          [1, "bolsa de agua pura"],
          [5, "dop teip (caja de herramienta)"],
          [3, "paquetes de cinchos (caja de herramienta)"],
          [7, "cinta de aislar (caja de herramienta)"],
          [4, "intercomunicadores hollyland con su cargadores y estuche"]
        ]
      },
      {
        id: "caja-herramientas",
        title: "Caja de Herramientas",
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
          [1, "multímetro o tester marca fluke (estuche)"]
        ]
      },
      {
        id: "equipo-limpieza",
        title: "Equipo de Limpieza",
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
        id: "equipo-proteccion",
        title: "Equipo de proteccion",
        items: [
          [10, "bolsas jardineras de tonel"],
          [3, "retazos de nylon para tapar equipo"]
        ]
      },
      {
        id: "seguridad-industrial",
        title: "Equipo de Seguridad Industrial",
        items: [
          [6, "casco"],
          [6, "chalecos"],
          [0, "botas"],
          [6, "pares de guantes"],
          [1, "arnes completo para subir"]
        ]
      }
    ]
  }
};

Object.values(equipmentServices).forEach((service) => {
  const existingIds = new Set((service.extras || []).map((extra) => extra.id));
  const extrasToAdd = sharedEquipmentExtras
    .filter((extra) => !existingIds.has(extra.id))
    .map((extra) => ({
      ...extra,
      items: extra.items.map((item) => [...item])
    }));

  service.extras = [...(service.extras || []), ...extrasToAdd];
});

const equipmentState = {
  selectedServiceId: "",
  djAudioType: "qsc",
  events: [],
  selectedExtraIds: new Set(),
  manualMainItems: [],
  manualMainSections: [],
  manualExtras: [],
  itemOverrides: new Map(),
  removedItemIds: new Set(),
  inventory: new Map(),
  observations: new Map()
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

function currentEquipmentService() {
  const service = equipmentServices[equipmentState.selectedServiceId] || null;
  if (!service) return null;
  if (!service.audioOptions) return service;
  const audioType = service.audioOptions[equipmentState.djAudioType] ? equipmentState.djAudioType : "qsc";
  const audioOption = service.audioOptions?.[audioType] || service.audioOptions?.qsc;
  return {
    ...service,
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
  const service = currentEquipmentService();
  if (!service) return [];
  const mainSections = (service.mainSections || []).map((section, index) => {
    const sectionKey = equipmentSectionKey(section, index, "main", equipmentState.selectedServiceId);
    return {
      ...section,
      id: sectionKey,
      items: editableEquipmentItems(section, sectionKey)
    };
  }).filter((section) => section.items.length);
  const manualMainSection = manualMainSectionsForTable();
  const selectedExtrasSections = (service.extras || [])
    .filter((extra) => equipmentState.selectedExtraIds.has(extra.id))
    .map((extra, index) => {
      const sectionKey = equipmentSectionKey(extra, index, "extra", equipmentState.selectedServiceId);
      return {
      ...extra,
      id: sectionKey,
      items: editableEquipmentItems(extra, sectionKey)
    };
  }).filter((section) => section.items.length);
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
    name: equipmentQuery("#equipmentEventName")?.value.trim() || "Evento por definir",
    phone: equipmentQuery("#equipmentEventPhone")?.value.trim() || "Por definir",
    date: equipmentQuery("#equipmentEventDate")?.value || "",
    responsible: equipmentQuery("#equipmentEventResponsible")?.value.trim() || "Por definir"
  };
}

function activeEquipmentEvents() {
  return equipmentState.events.length ? equipmentState.events : [currentEquipmentEventDraft()];
}

function eventColumnName(event) {
  return event?.name?.trim() || "Evento por definir";
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
  selectedEquipmentSections().forEach((section) => {
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
      events.forEach((event) => {
        existing.eventQuantities.set(
          event.id,
          (Number(existing.eventQuantities.get(event.id)) || 0) + perEventQuantity
        );
      });
      existing.quantity += perEventQuantity * events.length;
      rows.set(key, existing);
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

function renderEquipmentEvents() {
  const host = equipmentQuery("#equipmentEventsList");
  if (!host) return;
  if (!equipmentState.events.length) {
    host.innerHTML = `<p class="equipment-empty">Agregue eventos para verlos como columnas en el resumen.</p>`;
    return;
  }
  host.innerHTML = equipmentState.events
    .map(
      (event) => `
        <article class="equipment-event-card">
          <div>
            <strong>${escapeEquipmentHtml(event.name)}</strong>
            <span>${escapeEquipmentHtml(formatEquipmentDate(event.date))} · ${escapeEquipmentHtml(event.phone)}</span>
          </div>
          <button type="button" data-remove-event="${escapeEquipmentHtml(event.id)}" aria-label="Eliminar evento">X</button>
        </article>`
    )
    .join("");
  host.querySelectorAll("[data-remove-event]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.events = equipmentState.events.filter((event) => event.id !== button.dataset.removeEvent);
      renderEquipmentModule();
    });
  });
}

function addEquipmentEvent() {
  const draft = currentEquipmentEventDraft();
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!draft.name || draft.name === "Evento por definir") {
    if (status) status.textContent = "Escriba el nombre del evento antes de agregarlo al resumen.";
    return;
  }
  equipmentState.events.push({
    ...draft,
    id: `event-${Date.now()}-${equipmentEventCounter++}`
  });
  if (status) status.textContent = `Evento agregado: ${draft.name}`;
  renderEquipmentModule();
}

function refreshEquipmentSummaryAndPreview() {
  if (equipmentQuery("#equipmentInventoryTable")) {
    equipmentQuery("#equipmentInventoryTable").innerHTML = tableForEquipmentInventory(equipmentRowsSummary(), true);
  }
  bindEquipmentInventoryInputs();
  renderEquipmentPdfPreview();
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

function removeManualEquipmentItem(itemId) {
  let removedManual = false;
  const originalLegacyLength = equipmentState.manualMainItems.length;
  equipmentState.manualMainItems = equipmentState.manualMainItems.filter((item) => item.id !== itemId);
  removedManual = removedManual || originalLegacyLength !== equipmentState.manualMainItems.length;
  equipmentState.manualMainSections.forEach((section) => {
    const originalLength = section.items.length;
    section.items = section.items.filter((item) => item.id !== itemId);
    removedManual = removedManual || originalLength !== section.items.length;
  });
  const originalExtrasLength = equipmentState.manualExtras.length;
  equipmentState.manualExtras = equipmentState.manualExtras.filter((item) => item.id !== itemId);
  removedManual = removedManual || originalExtrasLength !== equipmentState.manualExtras.length;
  if (!removedManual) {
    equipmentState.removedItemIds.add(itemId);
    equipmentState.itemOverrides.delete(itemId);
  }
  renderEquipmentModule();
}

function removeManualEquipmentSection(sectionId) {
  if (sectionId === "equipo-manual") {
    equipmentState.manualMainItems = [];
  } else {
    equipmentState.manualMainSections = equipmentState.manualMainSections.filter((section) => section.id !== sectionId);
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
  const service = currentEquipmentService();
  if (!service?.extras?.length) {
    host.innerHTML = `<p class="equipment-empty">Este servicio no tiene extras cargados.</p>`;
    return;
  }
  host.innerHTML = service.extras
    .map((extra) => {
      const checked = equipmentState.selectedExtraIds.has(extra.id) ? "checked" : "";
      const itemCount = extra.items?.length || 0;
      return `
        <label class="equipment-extra-card">
          <input type="checkbox" data-extra-id="${escapeEquipmentHtml(extra.id)}" ${checked} />
          <span>
            <strong>${escapeEquipmentHtml(extra.title)}</strong>
            <span>${escapeEquipmentHtml(itemCount)} línea(s) de equipo</span>
          </span>
        </label>`;
    })
    .join("");
  host.querySelectorAll("[data-extra-id]").forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) {
        equipmentState.selectedExtraIds.add(input.dataset.extraId);
      } else {
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

function renderEquipmentPdfPreview() {
  const service = currentEquipmentService();
  const sections = selectedEquipmentSections();
  const events = activeEquipmentEvents();
  const eventName = eventSummaryText(events, "name");
  const phone = eventSummaryText(events, "phone");
  const responsible = eventSummaryText(events, "responsible");
  const date = eventSummaryText(events, "date");
  const notes = equipmentQuery("#equipmentNotes")?.value.trim() || "";
  const rentalRows = equipmentRentalRows();

  const title = service?.name || "Cuadro de equipo";
  if (equipmentQuery("#equipmentPdfTitle")) equipmentQuery("#equipmentPdfTitle").textContent = title;
  if (equipmentQuery("#equipmentPdfEvent")) equipmentQuery("#equipmentPdfEvent").textContent = eventName;
  if (equipmentQuery("#equipmentPdfPhone")) equipmentQuery("#equipmentPdfPhone").textContent = phone;
  if (equipmentQuery("#equipmentPdfDate")) equipmentQuery("#equipmentPdfDate").textContent = date;
  if (equipmentQuery("#equipmentPdfResponsible")) equipmentQuery("#equipmentPdfResponsible").textContent = responsible;

  const notesEl = equipmentQuery("#equipmentPdfNotes");
  if (notesEl) {
    notesEl.textContent = notes;
    notesEl.classList.toggle("is-hidden", !notes);
  }

  if (equipmentQuery("#equipmentPdfMainTable")) {
    equipmentQuery("#equipmentPdfMainTable").innerHTML = tableForEquipmentSections(sections, true);
  }
  if (equipmentQuery("#equipmentRentPdfTitle")) equipmentQuery("#equipmentRentPdfTitle").textContent = `Renta - ${title}`;
  if (equipmentQuery("#equipmentRentPdfEvents")) equipmentQuery("#equipmentRentPdfEvents").textContent = eventName;
  if (equipmentQuery("#equipmentRentPdfPhone")) equipmentQuery("#equipmentRentPdfPhone").textContent = phone;
  if (equipmentQuery("#equipmentRentPdfDate")) equipmentQuery("#equipmentRentPdfDate").textContent = date;
  if (equipmentQuery("#equipmentRentPdfResponsible")) equipmentQuery("#equipmentRentPdfResponsible").textContent = responsible;
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
  const service = currentEquipmentService();
  const workspace = equipmentQuery("#equipmentWorkspace");
  if (workspace) workspace.classList.toggle("is-hidden", !service);
  if (equipmentQuery("#equipmentServiceName")) equipmentQuery("#equipmentServiceName").textContent = service?.name || "";
  renderDjAudioOptions();
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
}

function renderDjAudioOptions() {
  const audioOptions = equipmentQuery("#equipmentDjAudioOptions");
  if (!audioOptions) return;
  const service = equipmentServices[equipmentState.selectedServiceId] || null;
  const hasAudioOptions = Boolean(service?.audioOptions);
  audioOptions.classList.toggle("is-hidden", !hasAudioOptions);
  const label = audioOptions.querySelector("[data-audio-options-label]");
  if (label) {
    label.textContent = hasAudioOptions ? `Tipo de audio para ${service.name}` : "Tipo de audio";
  }
  audioOptions.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    const audioType = button.dataset.djAudioType;
    const isAvailable = hasAudioOptions && Boolean(service.audioOptions?.[audioType]);
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

function equipmentPdfFileName(mode = "full") {
  const service = currentEquipmentService();
  const serviceName = cleanEquipmentFilePart(service?.name || "Cuadro de Equipo", "Cuadro de Equipo");
  const events = activeEquipmentEvents();
  const eventName = cleanEquipmentFilePart(events.map((event) => event.name).join(" - ") || "Lugar por definir", "Lugar por definir");
  const eventDates = cleanEquipmentFilePart(events.map((event) => formatEquipmentDateForFile(event.date)).join(" - "), "Fecha por definir");
  if (mode === "rent") {
    return `Reporte de renta - ${eventName} - ${serviceName} - ${eventDates}.pdf`;
  }
  return `${eventName} - Equipo a utilizar - ${serviceName} - ${eventDates}.pdf`;
}

async function saveEquipmentPdf(mode = "full") {
  const status = equipmentQuery("#equipmentSaveStatus");
  if (!currentEquipmentService()) {
    if (status) status.textContent = "Seleccione un servicio antes de guardar.";
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
    const html = mode === "rent" ? await equipmentPdfHtml(documentSelector, title) : await equipmentUsagePdfHtml();
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
    if (status) status.textContent = `${savedLabel}: ${data.fileName} en ${data.folder}`;
    window.open(data.pdfUrl, "_blank", "noopener");
  } catch (error) {
    if (status) status.textContent = error.message || "No se pudo guardar el PDF.";
  }
}

function initEquipmentModule() {
  const serviceSelect = equipmentQuery("#equipmentServiceSelect");
  if (!serviceSelect) return;
  serviceSelect.addEventListener("change", () => {
    equipmentState.selectedServiceId = serviceSelect.value;
    equipmentState.selectedExtraIds.clear();
    const selectedService = equipmentServices[equipmentState.selectedServiceId] || null;
    if (!selectedService?.audioOptions || !selectedService.audioOptions[equipmentState.djAudioType]) {
      equipmentState.djAudioType = "qsc";
    }
    renderEquipmentModule();
  });
  document.querySelectorAll("[data-dj-audio-type]").forEach((button) => {
    button.addEventListener("click", () => {
      equipmentState.djAudioType = button.dataset.djAudioType || "qsc";
      renderEquipmentModule();
    });
  });
  [
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
  renderEquipmentModule();
}

document.addEventListener("DOMContentLoaded", initEquipmentModule);
