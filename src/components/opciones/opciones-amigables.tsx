"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { guiaDe, marcarBienvenidaVista, useBienvenidaVista, useEstilo } from "@/lib/opciones-amigables";

import { AvisoAvance } from "./aviso-avance";
import { Bienvenida } from "./bienvenida";
import { GuiaConversacional } from "./guia-conversacional";
import { PanelDatos } from "./panel-datos";
import { SelectorEstilo } from "./selector-estilo";
import { VentanaAyuda } from "./ventana-ayuda";

/**
 * Capa opcional sobre el recorrido. Sin estilo elegido (lo normal) no dibuja nada y la calculadora queda como siempre.
 * Con `?estilo=a|b|c` marca la página (`data-estilo`) para que el CSS cambie la apariencia y suma las ayudas de cada opción.
 */
export function OpcionesAmigables() {
  const estilo = useEstilo();
  const ruta = usePathname();
  const guia = guiaDe(ruta);
  const bienvenidaVista = useBienvenidaVista();
  const [repetirBienvenida, setRepetirBienvenida] = useState(false);

  useEffect(() => {
    const raiz = document.documentElement;
    if (estilo === "a" || estilo === "b" || estilo === "c") raiz.dataset.estilo = estilo;
    else delete raiz.dataset.estilo;
    if (guia) raiz.dataset.paso = String(guia.numero);
    else delete raiz.dataset.paso;
    return () => {
      delete raiz.dataset.estilo;
      delete raiz.dataset.paso;
    };
  }, [estilo, guia]);

  return (
    <>
      <SelectorEstilo />
      {guia && estilo === "a" ? <GuiaConversacional key={ruta} guia={guia} /> : null}
      {guia && estilo === "b" ? (
        <>
          <Bienvenida
            abierta={repetirBienvenida || !bienvenidaVista}
            alCerrar={() => {
              marcarBienvenidaVista();
              setRepetirBienvenida(false);
            }}
          />
          <AvisoAvance key={ruta} guia={guia} />
          <VentanaAyuda guia={guia} variante="b" verBienvenida={() => setRepetirBienvenida(true)} />
        </>
      ) : null}
      {guia && estilo === "c" ? (
        <>
          <PanelDatos />
          <VentanaAyuda guia={guia} variante="a" />
        </>
      ) : null}
    </>
  );
}
