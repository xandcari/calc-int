import type { Metadata } from "next";

import { VistaPrecio } from "@/components/calculadora/vista-precio";

export const metadata: Metadata = {
  title: "Precio · Preciar",
  alternates: { canonical: "/calculadora/precio" },
};

export default function PrecioPage() {
  return <VistaPrecio />;
}
