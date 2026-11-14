// Re-exportamos los tipos del dominio centralizado como única fuente de verdad.
import type {
  Configuracion,
  CostoFijo,
  CostoVariable,
  CostoIndirecto,
  TrabajoPropio,
  Calculo,
  ResultadoCostos,
  DecimalString
} from "@/domain/types";

export type { DecimalString, Calculo };

// Alias para mantener compatibilidad con las referencias de los controladores/API
export type ConfiguracionInput = Configuracion;
export type TrabajoPropioInput = TrabajoPropio;

// Definición unificada para el DTO de entrada del cálculo
export interface CalculoInputDTO {
  configuracion: Configuracion;
  costosFijos: CostoFijo[];
  costosVariables: CostoVariable[];
  costosIndirectos: CostoIndirecto[];
  trabajoPropio: TrabajoPropio;
}

// Usamos directamente la interfaz oficial del dominio
export type ResultadoCostosDTO = ResultadoCostos;
