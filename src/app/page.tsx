import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { AccesoCuenta } from "@/components/calculadora/acceso-cuenta";
import { Logo, PieHome } from "@/components/calculadora/cabecera";
import { BotonLink } from "@/components/ui/boton";

/** Íconos de línea (estilo del diseño de Figma). Son decorativos: el texto de al lado ya dice lo mismo. */
function Icono({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      {children}
    </svg>
  );
}

const ICONOS = {
  barras: (
    <Icono>
      <path d="M4 20h16" />
      <path d="M7 16v-5" />
      <path d="M12 16V6" />
      <path d="M17 16v-8" />
    </Icono>
  ),
  reloj: (
    <Icono>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </Icono>
  ),
  objetivo: (
    <Icono>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="m12 12 7-7M16 5h3v3" />
    </Icono>
  ),
  tarjeta: (
    <Icono>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 10h10M7 14h6" />
    </Icono>
  ),
  check: (
    <Icono>
      <path d="m5 12 5 5 9-10" />
    </Icono>
  ),
};

/** Secciones de la portada: el menú de arriba y los enlaces del pie apuntan a estas anclas. */
const SECCIONES = [
  { href: "#como-funciona", texto: "Cómo funciona" },
  { href: "#que-te-llevas", texto: "Qué te llevás" },
  { href: "#antes-de-empezar", texto: "Antes de empezar" },
  { href: "#preguntas", texto: "Preguntas" },
];

const PROBLEMAS = [
  {
    icono: ICONOS.barras,
    titulo: "No tenés claro cuánto te cuesta cada unidad.",
    texto: "Calculás de memoria y es fácil terminar vendiendo por debajo de lo que cuesta producir.",
  },
  {
    icono: ICONOS.reloj,
    titulo: "Tu tiempo de trabajo no entra en la cuenta.",
    texto: "Tu trabajo tiene valor. Si no está en el costo, el precio no lo cubre.",
  },
  {
    icono: ICONOS.objetivo,
    titulo: "No sabés cuánto tenés que vender.",
    texto: "Sin ese número, planificar se vuelve difícil.",
  },
];

const PASOS = [
  { titulo: "Tu producto.", texto: "Contanos cómo producís y cuánto." },
  { titulo: "Costos.", texto: "Cargá tus costos fijos y lo que gastás por cada unidad." },
  { titulo: "Resumen.", texto: "Mirá cuánto te cuesta hacer una sola unidad." },
  { titulo: "Precio.", texto: "Elegí tu margen o poné tu precio, y mirá tu punto de equilibrio." },
  { titulo: "Simulador.", texto: "Probá qué pasa si cambian tus costos, tu precio o lo que producís." },
];

const BENEFICIOS = [
  { icono: ICONOS.tarjeta, titulo: "Tu costo real por unidad.", texto: "Lo que te cuesta hacer una sola unidad." },
  {
    icono: ICONOS.objetivo,
    titulo: "Un precio con la cuenta a la vista.",
    texto: "Un precio sugerido según tu margen, o el tuyo, con el cálculo explicado.",
  },
  {
    icono: ICONOS.objetivo,
    titulo: "Escenarios y resumen para guardar.",
    texto: "Compará escenarios y descargá tu resumen en PDF o como imagen.",
  },
  {
    icono: ICONOS.barras,
    titulo: "Tu punto de equilibrio.",
    texto: "Cuántas unidades tenés que vender para cubrir tus costos fijos.",
  },
];

const DATOS = [
  { titulo: "Tu producción mensual", texto: "Cuántas unidades producís por mes." },
  { titulo: "Tus gastos fijos", texto: "Alquiler, luz, internet, seguros." },
  { titulo: "Tus insumos", texto: "Lo que gastás por cada unidad producida." },
  { titulo: "Tu hora de trabajo", texto: "Si no sabés cuánto cobrar, te ayudamos a calcularlo." },
];

/** Respuestas tomadas de los comentarios de UX/UI en el Figma (#26, #27 y #28). */
const PREGUNTAS = [
  {
    pregunta: "¿Qué es un costo fijo?",
    respuesta: "Lo que pagás todos los meses aunque no produzcas nada: alquiler, luz, internet, seguros.",
  },
  {
    pregunta: "¿Qué es el punto de equilibrio?",
    respuesta: "Es lo mínimo que tenés que vender para cubrir tus costos. No es tu meta, es tu piso.",
  },
  {
    pregunta: "¿Por qué tengo que cargar mi tiempo de trabajo?",
    respuesta:
      "Porque tu trabajo también cuesta. Lo calculamos como un costo fijo mensual: las horas que le dedicás por la plata que querés ganar por hora.",
  },
  {
    pregunta: "¿Para qué sirve crear una cuenta?",
    respuesta:
      "Para guardar tus cálculos y volver a verlos en «Mis cálculos», compartirlos con un link, descargar el informe detallado en PDF y retomarlos desde cualquier dispositivo. Es opcional: sin cuenta también podés calcular.",
  },
  {
    pregunta: "¿Qué pasa con los datos que cargo?",
    respuesta:
      "No hace falta registrarte. Tu borrador queda solo en tu navegador, y solo se guarda en una cuenta si vos elegís hacerlo. Si querés conservar tu cálculo, descargá el resumen en PDF o como imagen antes de reiniciar.",
  },
];

/** Etiqueta chica en mayúsculas que va arriba de cada título de sección. */
function Antetitulo({ children }: { children: ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-wider text-gray-700">{children}</p>;
}

/** Píldora de cierre de sección (Figma: «Las tres se resuelven…», «Gratis y sin registro…»). */
function Pildora({ children, fondo = "bg-white" }: { children: ReactNode; fondo?: string }) {
  return (
    <p className={`mx-auto rounded-xl px-6 py-4 text-center text-base font-semibold text-gray-900 ${fondo}`}>{children}</p>
  );
}

/** Cuadradito celeste con el ícono, como en las tarjetas del Figma. */
function Insignia({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-primary-100 text-primary-900">
      {children}
    </span>
  );
}

/** Espaciado entre secciones: 120px en escritorio (comentario #24 del Figma). Las anclas dejan lugar al header fijo. */
const SECCION = "scroll-mt-20 px-4 py-20 sm:px-6 lg:py-[120px]";
const CONTENIDO = "mx-auto flex w-full max-w-5xl flex-col";

/** Header fijo arriba (comentario #22) con menú de anclas a las secciones (#23). */
function CabeceraHome() {
  return (
    <header className="sticky top-0 z-20 border-b border-gray-200 bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="Preciar, ir al inicio" className="rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-700">
          <Logo />
        </Link>
        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex items-center gap-8 text-sm text-gray-900">
            {SECCIONES.map((s) => (
              <li key={s.href}>
                <a
                  href={s.href}
                  className="rounded underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
                >
                  {s.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          <AccesoCuenta />
          <BotonLink href="/calculadora/producto" className="px-4 sm:px-6">
            Empezar mi cálculo
          </BotonLink>
        </div>
      </div>
    </header>
  );
}

export default function Home() {
  return (
    <>
      <CabeceraHome />
      <main id="contenido" className="flex flex-1 flex-col">
        {/* Hero: bloque marino con degradé hacia azul, como en Figma. */}
        <section
          aria-labelledby="titulo-portada"
          className="bg-primary-900 bg-[linear-gradient(110deg,#101b3b_20%,#24397e_100%)] px-4 sm:px-6"
        >
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 py-24 lg:py-40">
            <h1 id="titulo-portada" className="max-w-2xl text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
              Calculá el precio real de lo que vendés
            </h1>
            <p className="max-w-2xl text-lg font-semibold text-white">
              Ordená tus costos, valorá tu tiempo y encontrá un precio que sostenga tu negocio.
            </p>
            <div className="flex flex-col items-start gap-3">
              <BotonLink href="/calculadora/producto" variante="celeste" className="px-9 py-4 text-base font-medium">
                Empezar mi cálculo
              </BotonLink>
              <p className="text-sm text-white">No necesitás cuenta. Tu borrador queda solo en tu navegador.</p>
              <p className="text-sm text-white">
                ¿Querés guardar tus cálculos?{" "}
                <Link
                  href="/cuenta?modo=crear"
                  className="rounded font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  Creá tu cuenta
                </Link>{" "}
                o{" "}
                <Link
                  href="/cuenta"
                  className="rounded font-semibold underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  iniciá sesión
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="problemas" className={SECCION}>
          <div className={`${CONTENIDO} gap-12`}>
            <h2 id="problemas" className="text-2xl font-semibold text-gray-900 sm:text-3xl">
              ¿Te suena alguna de estas?
            </h2>
            <ul className="grid gap-4 sm:grid-cols-3">
              {PROBLEMAS.map((p) => (
                <li key={p.titulo} className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-white p-6">
                  <Insignia>{p.icono}</Insignia>
                  <div>
                    <h3 className="font-medium text-gray-900">{p.titulo}</h3>
                    <p className="text-gray-500">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pildora>Las tres se resuelven con tus propios números.</Pildora>
          </div>
        </section>

        <section id="como-funciona" aria-labelledby="como-funciona-titulo" className={`${SECCION} bg-white`}>
          <div className={`${CONTENIDO} gap-12`}>
            <div className="flex flex-col gap-2">
              <Antetitulo>Cómo funciona</Antetitulo>
              <h2 id="como-funciona-titulo" className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                De tus costos a tu precio, en cinco pasos.
              </h2>
            </div>
            <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {PASOS.map((p, i) => (
                <li key={p.titulo} className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-background p-5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 items-center justify-center rounded-full bg-accent-400 text-sm text-primary-900"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      <span className="sr-only">Paso {i + 1}: </span>
                      {p.titulo}
                    </h3>
                    <p className="text-gray-500">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="que-te-llevas" aria-labelledby="que-te-llevas-titulo" className={SECCION}>
          <div className={`${CONTENIDO} gap-12`}>
            <div className="flex flex-col gap-2">
              <Antetitulo>Qué te llevás</Antetitulo>
              <h2 id="que-te-llevas-titulo" className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Un resultado que podés usar, guardar y comparar.
              </h2>
            </div>
            {/* Imagen del Figma (comentario #25: «algo del paso de Precio»). Exportada desde el archivo de diseño. */}
            <Image
              src="/que-te-llevas.jpg"
              alt="Ejemplo de resultado en Preciar: precio sugerido de $12.500, costo real por unidad de $8.200, margen estimado del 52% y punto de equilibrio de 75 unidades."
              width={960}
              height={650}
              sizes="(min-width: 640px) 480px, 100vw"
              className="mx-auto h-auto w-full max-w-[480px]"
            />
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {BENEFICIOS.map((b) => (
                <li key={b.titulo} className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-white p-6">
                  <Insignia>{b.icono}</Insignia>
                  <div>
                    <h3 className="font-medium text-gray-900">{b.titulo}</h3>
                    <p className="text-gray-500">{b.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="antes-de-empezar" aria-labelledby="antes-titulo" className={`${SECCION} bg-white`}>
          <div className={`${CONTENIDO} gap-12`}>
            <div className="flex flex-col gap-2">
              <Antetitulo>Antes de empezar</Antetitulo>
              <h2 id="antes-titulo" className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Tené a mano estos cuatro datos
              </h2>
              <p className="text-lg text-gray-900">No hace falta que sean exactos. Empezá con un estimado y ajustalo cuando quieras.</p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {DATOS.map((d) => (
                <li key={d.titulo} className="flex flex-col gap-4 rounded-xl border border-gray-300 bg-background p-6">
                  <Insignia>{ICONOS.check}</Insignia>
                  <div>
                    <h3 className="font-medium text-gray-900">{d.titulo}</h3>
                    <p className="text-gray-500">{d.texto}</p>
                  </div>
                </li>
              ))}
            </ul>
            <Pildora fondo="bg-gray-100">Gratis y sin registro. Tu borrador queda solo en tu navegador.</Pildora>
          </div>
        </section>

        <section id="preguntas" aria-labelledby="preguntas-titulo" className={SECCION}>
          <div className={`${CONTENIDO} gap-12`}>
            <div className="flex flex-col gap-2">
              <Antetitulo>Preguntas</Antetitulo>
              <h2 id="preguntas-titulo" className="text-2xl font-semibold text-gray-900 sm:text-3xl">
                Si algo no te cierra, acá lo aclaramos.
              </h2>
            </div>
            {/* <details> nativo: se abre y cierra con teclado y lo anuncian los lectores de pantalla, sin JavaScript. */}
            <div className="flex flex-col gap-3">
              {PREGUNTAS.map((p, i) => (
                <details key={p.pregunta} open={i === 0} className="group rounded-xl border border-gray-300 bg-white">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-6 py-5 text-lg font-medium text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 [&::-webkit-details-marker]:hidden">
                    {p.pregunta}
                    <span aria-hidden="true" className="text-2xl leading-none">
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <p className="border-t border-gray-300 px-6 py-5 text-gray-500">{p.respuesta}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="cierre" className="bg-primary-900 px-4 py-24 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col items-center gap-10 text-center">
            <h2 id="cierre" className="text-2xl font-semibold text-white sm:text-3xl">
              Tu precio merece un cálculo. Empezá ahora.
            </h2>
            <BotonLink href="/calculadora/producto" variante="celeste" className="px-9 py-4 text-base font-medium">
              Empezar mi cálculo
            </BotonLink>
          </div>
        </section>
      </main>
      <PieHome enlaces={[...SECCIONES, { href: "/cuenta", texto: "Iniciar sesión" }, { href: "/cuenta?modo=crear", texto: "Crear cuenta" }]} />
    </>
  );
}
