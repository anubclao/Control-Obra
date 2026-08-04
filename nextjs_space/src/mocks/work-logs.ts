import type {
  Project,
  WorkCut,
  Client,
  Quotation,
  PaymentRequest,
  Provider,
  WorkLog,
  Budget,
  AiuConfig,
  Contract,
  TaxConfig,
  Employee,
  Invitation,
  PSC,
  Expense,
} from "@/types";

export const MOCK_WORK_LOGS: WorkLog[] = [
  {
    id: "wl1",
    projectId: "p1",
    date: "2026-06-12",
    weather: "SOLEADO",
    temperature: 24,
    workersCount: 18,
    activities:
      "Cimentación piso 7-8 completada. Inicio de columnas piso 9. Vaciado de concreto en 4 columnas. Instalación de acero de refuerzo para vigas del piso 9.",
    incidents:
      "Sin incidentes relevantes. Un trabajador reportó dolor de espalda leve, se le asignó tarea administrativa por el resto del día.",
    materials:
      "Recibido: 3.5 toneladas de acero figurado, 18 m³ de concreto premezclado 4000 PSI. Stock actual de cemento: 45 bultos.",
    observations:
      "Avance por encima del cronograma en 3%. Buen clima permite mantener ritmo de trabajo.",
    photos: [
      {
        id: "wp1",
        fileName: "foto_estructura_09.jpg",
        caption: "Avance columnas piso 9",
        uploadedAt: "2026-06-12",
      },
      {
        id: "wp2",
        fileName: "foto_personal_obra.jpg",
        caption: "Personal en obra",
        uploadedAt: "2026-06-12",
      },
      {
        id: "wp3",
        fileName: "foto_material_recibido.jpg",
        caption: "Acero recibido",
        uploadedAt: "2026-06-12",
      },
    ],
    createdBy: "u4",
    createdByName: "Juan Residente",
    createdAt: "2026-06-12T18:30:00",
  },
  {
    id: "wl2",
    projectId: "p1",
    date: "2026-06-11",
    weather: "NUBLADO",
    temperature: 21,
    workersCount: 20,
    activities:
      "Avance de formaleta en piso 8. Acero figurado para columnas piso 9. Limpieza general de obra. Reunión de seguridad de 30 min al inicio de jornada.",
    incidents:
      "Lluvia leve en la tarde detuvo trabajos de vaciado por 2 horas. Se retomó al final de la jornada sin afectar el cronograma.",
    materials: "Sin ingreso de materiales. Consumo normal del día.",
    observations: "Clima inestable, monitorear para próximos días.",
    photos: [
      {
        id: "wp4",
        fileName: "foto_formaleta_08.jpg",
        caption: "Formaleta piso 8",
        uploadedAt: "2026-06-11",
      },
    ],
    createdBy: "u4",
    createdByName: "Juan Residente",
    createdAt: "2026-06-11T18:15:00",
  },
  {
    id: "wl3",
    projectId: "p2",
    date: "2026-06-12",
    weather: "NUBLADO",
    temperature: 22,
    workersCount: 35,
    activities:
      "Avance estructura metálica nivel 2 (60% completado). Instalación de red de protección perimetral. Continúa excavación para cimentación torre B.",
    incidents: "Sin incidentes.",
    materials:
      "Recibido: 12 toneladas de estructura metálica. 8 m³ de concreto para cimentación.",
    observations:
      "Buen ritmo de trabajo. Proveedor de estructura metálica cumpliendo cronograma.",
    photos: [
      {
        id: "wp5",
        fileName: "foto_metal_nivel2.jpg",
        caption: "Estructura metálica nivel 2",
        uploadedAt: "2026-06-12",
      },
    ],
    createdBy: "u4",
    createdByName: "Juan Residente",
    createdAt: "2026-06-12T19:00:00",
  },
  {
    id: "wl4",
    projectId: "p3",
    date: "2026-06-10",
    weather: "LLUVIOSO",
    temperature: 19,
    workersCount: 12,
    activities:
      "Lluvia persistente impidió trabajos en cubierta. Se avanzó en cerramiento lateral bajo techo de protección.",
    incidents:
      "Lluvia intensa. No se pudo avanzar según cronograma. Se compensará en próximos días.",
    materials: "Sin movimiento.",
    observations:
      "Riesgo de retraso si continúa el mal clima. Se están considerando jornadas extendidas.",
    photos: [],
    createdBy: "u4",
    createdByName: "Juan Residente",
    createdAt: "2026-06-10T18:00:00",
  },
];

// Presupuesto Tope (PT) - uno por proyecto
