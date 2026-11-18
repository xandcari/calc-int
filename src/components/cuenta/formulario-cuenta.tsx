"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Campo, clasesCampo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { signIn, signOut, signUp, useSession } from "@/lib/auth-client";
import {
  LARGO_MINIMO_CONTRASENA,
  mensajeDeErrorDeCuenta,
  nombreDesdeEmail,
  validarCuenta,
  type ErroresCuenta,
  type ModoCuenta,
} from "@/lib/cuenta";

interface Props {
  /** Ruta interna a la que se vuelve al terminar (ya validada con `rutaSegura`). */
  destino: string;
  modoInicial: ModoCuenta;
  /** Solo se ofrece Google si el servidor tiene las credenciales configuradas. */
  googleHabilitado: boolean;
}

const TEXTOS: Record<ModoCuenta, { titulo: string; bajada: string; boton: string; enviando: string }> = {
  entrar: {
    titulo: "Iniciá sesión",
    bajada: "Entrá para guardar tus cálculos y volver a verlos cuando quieras.",
    boton: "Iniciar sesión",
    enviando: "Ingresando…",
  },
  crear: {
    titulo: "Creá tu cuenta",
    bajada: "Con una cuenta podés guardar tus cálculos y compartirlos con un link.",
    boton: "Crear cuenta",
    enviando: "Creando cuenta…",
  },
};

/** Pantalla de cuenta: iniciar sesión o crear una, con email y contraseña (y Google si está disponible). */
export function FormularioCuenta({ destino, modoInicial, googleHabilitado }: Props) {
  const router = useRouter();
  const { data: sesion, isPending } = useSession();
  const [modo, setModo] = useState<ModoCuenta>(modoInicial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verPassword, setVerPassword] = useState(false);
  const [errores, setErrores] = useState<ErroresCuenta>({});
  const [errorServidor, setErrorServidor] = useState("");
  const [enviando, setEnviando] = useState(false);
  const refEmail = useRef<HTMLInputElement>(null);
  const refPassword = useRef<HTMLInputElement>(null);
  const id = useId();
  const idEmail = `${id}-email`;
  const idPassword = `${id}-password`;
  const textos = TEXTOS[modo];

  function cambiarModo(nuevo: ModoCuenta) {
    if (nuevo === modo) return;
    setModo(nuevo);
    setErrores({});
    setErrorServidor("");
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (enviando) return;
    setErrorServidor("");

    const encontrados = validarCuenta({ modo, email, password });
    setErrores(encontrados);
    if (encontrados.email) return refEmail.current?.focus();
    if (encontrados.password) return refPassword.current?.focus();

    setEnviando(true);
    const correo = email.trim();
    try {
      const { error } =
        modo === "entrar"
          ? await signIn.email({ email: correo, password })
          : await signUp.email({ email: correo, password, name: nombreDesdeEmail(correo) });
      if (error) {
        setErrorServidor(mensajeDeErrorDeCuenta(error));
        return;
      }
      router.replace(destino);
      router.refresh();
    } catch {
      setErrorServidor(mensajeDeErrorDeCuenta(null));
    } finally {
      setEnviando(false);
    }
  }

  async function conGoogle() {
    setErrorServidor("");
    setEnviando(true);
    try {
      const { error } = await signIn.social({ provider: "google", callbackURL: destino });
      if (error) setErrorServidor(mensajeDeErrorDeCuenta(error));
    } catch {
      setErrorServidor(mensajeDeErrorDeCuenta(null));
    } finally {
      setEnviando(false);
    }
  }

  if (isPending) {
    return (
      <Tarjeta aria-busy="true">
        <p className="text-sm text-gray-700">Cargando…</p>
      </Tarjeta>
    );
  }

  if (sesion) {
    return (
      <Tarjeta className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-primary-900">Ya iniciaste sesión</h1>
        <p className="text-base text-gray-700">
          Estás usando la cuenta <strong className="break-all">{sesion.user.email}</strong>.
        </p>
        <div className="flex flex-wrap gap-3">
          <BotonLink href={destino}>Seguir con mi cálculo</BotonLink>
          <Boton
            variante="secundario"
            onClick={async () => {
              await signOut();
              router.refresh();
            }}
          >
            Cerrar sesión
          </Boton>
        </div>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-primary-900">{textos.titulo}</h1>
        <p className="text-base text-gray-700">{textos.bajada}</p>
      </div>

      <div role="group" aria-label="Tipo de acceso" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(["entrar", "crear"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={modo === opcion}
            onClick={() => cambiarModo(opcion)}
            className={
              "rounded-lg px-3 py-2 text-sm font-semibold transition-colors " +
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 " +
              (modo === opcion ? "bg-white text-primary-900 shadow-sm" : "text-gray-700 hover:text-primary-900")
            }
          >
            {opcion === "entrar" ? "Ya tengo cuenta" : "Soy nuevo"}
          </button>
        ))}
      </div>

      <form onSubmit={enviar} noValidate className="flex flex-col gap-5" aria-busy={enviando}>
        <Campo idControl={idEmail} etiqueta="Email" error={errores.email} idError={`${idEmail}-error`}>
          <input
            ref={refEmail}
            id={idEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="nombre@correo.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={Boolean(errores.email)}
            aria-describedby={errores.email ? `${idEmail}-error` : undefined}
            className={clasesCampo(Boolean(errores.email))}
          />
        </Campo>

        <Campo
          idControl={idPassword}
          etiqueta="Contraseña"
          descripcion={modo === "crear" ? `Mínimo ${LARGO_MINIMO_CONTRASENA} caracteres.` : undefined}
          error={errores.password}
          idError={`${idPassword}-error`}
        >
          <input
            ref={refPassword}
            id={idPassword}
            type={verPassword ? "text" : "password"}
            autoComplete={modo === "entrar" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={Boolean(errores.password)}
            aria-describedby={errores.password ? `${idPassword}-error` : undefined}
            className={clasesCampo(Boolean(errores.password))}
          />
          <label className="mt-1 flex w-fit items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={verPassword}
              onChange={(e) => setVerPassword(e.target.checked)}
              className="size-4 accent-primary-700"
            />
            Mostrar contraseña
          </label>
        </Campo>

        {errorServidor ? (
          <div role="alert">
            <Aviso tono="advertencia" titulo={modo === "entrar" ? "No pudimos iniciar sesión" : "No pudimos crear la cuenta"}>
              {errorServidor}
            </Aviso>
          </div>
        ) : null}

        <Boton type="submit" disabled={enviando} className="w-full">
          {enviando ? textos.enviando : textos.boton}
        </Boton>
      </form>

      {googleHabilitado ? (
        <div className="flex flex-col gap-3">
          <p className="text-center text-sm text-gray-500">o</p>
          <Boton variante="secundario" onClick={conGoogle} disabled={enviando} className="w-full">
            Continuar con Google
          </Boton>
        </div>
      ) : null}

      <p className="text-sm text-gray-700">
        Tu cálculo en curso no se pierde: queda en este navegador y lo retomás al volver.{" "}
        <Link
          href={destino}
          className="rounded font-medium underline underline-offset-2 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
        >
          Volver sin iniciar sesión
        </Link>
      </p>
    </Tarjeta>
  );
}
