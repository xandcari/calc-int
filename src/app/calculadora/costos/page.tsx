import type { Metadata } from "next";

import { FormularioCostos } from "@/components/calculadora/formulario-costos";

export const metadata: Metadata = {
  title: "Costos · Preciar",
  alternates: { canonical: "/calculadora/costos" },
};

export default function CostosPage() {
  return <FormularioCostos />;
}
