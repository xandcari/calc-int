import { BotonLink } from "@/components/ui/boton";

export default function NoEncontrada() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-4 px-6 py-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-primary-700">Error 404</p>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">No encontramos esta página</h1>
      <p className="text-gray-700">
        Puede que el enlace esté incompleto o que la página ya no exista. Tus datos no se perdieron: podés retomar el
        cálculo donde lo dejaste.
      </p>
      <div className="flex flex-wrap gap-3">
        <BotonLink href="/calculadora">Seguir con mi cálculo</BotonLink>
        <BotonLink href="/" variante="secundario">
          Volver al inicio
        </BotonLink>
      </div>
    </main>
  );
}
