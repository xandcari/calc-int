import { notFound } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Las páginas de prueba del backend NO existen en producción (devuelven 404), para no dejar al público
 * pantallas sin diseño ni control. Para habilitarlas a propósito en un deploy de prueba:
 * definir PERMITIR_PAGINAS_DE_PRUEBA=1 en las variables de entorno.
 */
export default function LayoutDePrueba({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_PAGINAS_DE_PRUEBA !== "1") notFound();
  return children;
}
