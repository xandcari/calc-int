import { z } from "zod";

import { NOMBRE_VERSION, TIPOS } from "@/lib/anotaciones";

/** Todo lo de la app de prueba (API y página de resultados) existe solo con NEXT_PUBLIC_MODO_PRUEBA=1. */
export const modoPruebaActivo = (): boolean => process.env.NEXT_PUBLIC_MODO_PRUEBA === "1";

/** Máximo de notas por navegador, y por minuto, para que un error o un bucle no llene la base. */
export const MAX_NOTAS_POR_AUTOR = 300;
export const MAX_NOTAS_POR_MINUTO = 12;

const versiones = Object.keys(NOMBRE_VERSION) as [string, ...string[]];
const tipos = TIPOS.map((t) => t.id) as [string, ...string[]];

export const esquemaObservacion = z.object({
  nombre: z.string().trim().min(1, "Falta tu nombre.").max(40, "El nombre es muy largo (máximo 40)."),
  version: z.enum(versiones),
  ruta: z.string().regex(/^\/[A-Za-z0-9_\-/]*$/, "Ruta inválida.").max(100),
  tipo: z.enum(tipos),
  texto: z.string().trim().min(1, "Escribí tu nota.").max(500, "La nota es muy larga (máximo 500)."),
  elemento: z.string().trim().max(120),
  selector: z.string().max(500).nullable(),
  general: z.boolean(),
  fx: z.number().min(0).max(1),
  fy: z.number().min(0).max(1),
  dx: z.number().min(0).max(2),
  dy: z.number().min(0).max(200_000),
  dispositivo: z.string().trim().max(80),
});

export type NuevaObservacion = z.infer<typeof esquemaObservacion>;

export const esquemaResuelta = z.object({ resuelta: z.boolean() });

const PATRON_TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
export const esTokenValido = (t: string | null | undefined): t is string => !!t && PATRON_TOKEN.test(t);

/* ---------- CSV (para abrir en Excel o Google Sheets) ---------- */

export type FilaCsv = {
  creadaEn: Date;
  nombre: string;
  version: string;
  ruta: string;
  tipo: string;
  elemento: string;
  texto: string;
  general: boolean;
  resuelta: boolean;
  dispositivo: string;
};

/** Una celda: entre comillas, y con un apóstrofe delante si empieza como una fórmula (=, +, -, @). */
export function celdaCsv(valor: string): string {
  const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  return `"${seguro.replace(/"/g, '""')}"`;
}

const etiquetaTipo = (id: string) => TIPOS.find((t) => t.id === id)?.etiqueta ?? id;

export function aCsv(filas: FilaCsv[]): string {
  const cabecera = ["Fecha", "Quién", "Versión", "Pantalla", "Tipo", "Elemento", "Nota", "Alcance", "Estado", "Dispositivo"];
  const lineas = filas.map((f) =>
    [
      f.creadaEn.toISOString().replace("T", " ").slice(0, 16),
      f.nombre,
      NOMBRE_VERSION[f.version] ?? f.version,
      f.ruta,
      etiquetaTipo(f.tipo),
      f.elemento,
      f.texto,
      f.general ? "Pantalla completa" : "Punto señalado",
      f.resuelta ? "Resuelta" : "Abierta",
      f.dispositivo,
    ]
      .map(celdaCsv)
      .join(";"),
  );
  // El BOM hace que Excel abra bien los acentos.
  return `﻿${[cabecera.map(celdaCsv).join(";"), ...lineas].join("\r\n")}\r\n`;
}
