import Decimal from "decimal.js";

import { leerNumero } from "@/domain/motor/numeros";

/**
 * Formato visual (es-AR). El redondeo a 2 decimales ocurre SOLO acá, al mostrar:
 * el motor nunca redondea.
 */

const formateador = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** "4220" → "$4.220"; "10666.666" → "$10.666,67"; vacío o inválido → "—". */
export function formatearMonto(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  const redondeado = numero.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const texto = formateador.format(redondeado.abs().toNumber());
  return `${redondeado.isNegative() ? "-" : ""}$${texto}`;
}

/** Cantidad sin símbolo: "120" → "120"; "12.5" → "12,5". */
export function formatearCantidad(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  return formateador.format(numero.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber());
}

const formateadorPorcentaje = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** "94.79" -> "94,8%". */
export function formatearPorcentaje(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  return `${formateadorPorcentaje.format(numero.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber())}%`;
}

/** Variación con signo: "0.4" -> "+0,4%", "-22.6" -> "-22,6%", "0" -> "0,0%". */
export function formatearVariacion(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  const texto = formatearPorcentaje(numero.abs().toString());
  if (texto === "0,0%") return texto;
  return `${numero.isNegative() ? "-" : "+"}${texto}`;
}

/** Diferencia de importe con signo: "460" -> "+$460", "-85" -> "-$85", "0" -> "$0". */
export function formatearDiferenciaMonto(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  const redondeado = numero.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (redondeado.isZero()) return "$0";
  return `${redondeado.isNegative() ? "-" : "+"}$${formateador.format(redondeado.abs().toNumber())}`;
}

/** Diferencia de unidades con signo: "63" -> "+63 uds", "-16" -> "-16 uds", "1" -> "+1 ud". */
export function formatearDiferenciaUnidades(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  const redondeado = numero.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  if (redondeado.isZero()) return "0 uds";
  const texto = formateador.format(redondeado.abs().toNumber());
  return `${redondeado.isNegative() ? "-" : "+"}${texto} ${redondeado.abs().equals(1) ? "ud" : "uds"}`;
}

/** Diferencia en puntos porcentuales con signo: "15.2" -> "+15,2 pts", "-23.7" -> "-23,7 pts". */
export function formatearDiferenciaPuntos(valor: string | null | undefined): string {
  if (valor == null) return "—";
  const numero = leerNumero(valor);
  if (!numero) return "—";
  const redondeado = numero.toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
  if (redondeado.isZero()) return "0,0 pts";
  return `${redondeado.isNegative() ? "-" : "+"}${formateadorPorcentaje.format(redondeado.abs().toNumber())} pts`;
}
