import type { User } from "@/types";

export const MOCK_USERS: User[] = [
  { id: "u1", email: "admin@controlobra.com", name: "Admin Sistema", role: "ADMIN", area: "administrativo" },
  { id: "u2", email: "gerente@controlobra.com", name: "Carlos Gerente", role: "GERENTE", area: "administrativo" },
  { id: "u3", email: "director@controlobra.com", name: "Marta Directora", role: "DIRECTOR", area: "tecnico" },
  { id: "u4", email: "residente@controlobra.com", name: "Juan Residente", role: "RESIDENTE", area: "tecnico" },
  { id: "u5", email: "contabilidad@controlobra.com", name: "Ana Contabilidad", role: "CONTABILIDAD", area: "administrativo" },
  { id: "u6", email: "tesoreria@controlobra.com", name: "Pedro Tesorería", role: "TESORERIA", area: "administrativo" },
  { id: "u7", email: "hseq@controlobra.com", name: "Laura HSEQ", role: "HSEQ", area: "administrativo" },
  { id: "u8", email: "ventas@controlobra.com", name: "Sofía Ventas", role: "USER", area: "ventas" },
];
