import { ImageResponse } from "next/og";

export const alt = "Preciar: calculá el precio real de lo que vendés";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagen que se ve al compartir el link (WhatsApp, redes). Usa los colores de la marca. */
export default function ImagenParaCompartir() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 90px",
          color: "#ffffff",
          background: "linear-gradient(110deg, #101b3b 20%, #24397e 100%)",
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>
          Preci<span style={{ color: "#58b4f0" }}>ar</span>
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 76, fontWeight: 800, lineHeight: 1.1 }}>
          Calculá el precio real de lo que vendés
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 36 }}>
          Costos, precio y punto de equilibrio. Gratis y sin registro.
        </div>
      </div>
    ),
    size,
  );
}
