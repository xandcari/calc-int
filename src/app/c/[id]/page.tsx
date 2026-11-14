import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { obtenerUsuario } from "@/lib/sesion";
import { leerCalculo } from "@/server/calculos/repositorio";
import { esUuid } from "@/server/http";

import { CargadorCompartido } from "./cargador";

/**
 * Entrada del link compartido: /c/<uuid>.
 * Lee el cálculo en el servidor y se lo pasa al cargador, que lo vuelca en el store y manda al usuario al recorrido.
 * Si el cálculo no existe, o no está compartido y quien entra no es el dueño: 404.
 */
export default async function PaginaCompartida({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!esUuid(id)) notFound();

  const encontrado = await leerCalculo(id);
  if (!encontrado) notFound();

  const usuario = await obtenerUsuario(await headers());
  const esDueno = usuario?.id === encontrado.usuarioId;
  if (!encontrado.compartido && !esDueno) notFound();

  return <CargadorCompartido calculo={encontrado.calculo} esDueno={esDueno} />;
}
