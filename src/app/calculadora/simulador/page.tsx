import type { Metadata } from "next";

import { VistaSimulador } from "@/components/calculadora/vista-simulador";

export const metadata: Metadata = {
  title: "Simulador · Preciar",
  alternates: { canonical: "/calculadora/simulador" },
};

export default function SimuladorPage() {
  return <VistaSimulador />;
}
