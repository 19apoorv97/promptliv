import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Promptliv — Free AI Prompt Generator for ChatGPT, Claude & Gemini";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #030712 0%, #0f172a 60%, #1e1b4b 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Glow orb */}
        <div
          style={{
            position: "absolute",
            top: "40px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "600px",
            height: "300px",
            background: "radial-gradient(ellipse, rgba(99,102,241,0.25) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />

        {/* Logo row */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "36px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              background: "linear-gradient(135deg, #6366f1, #4f46e5)",
              borderRadius: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px",
            }}
          >
            ✦
          </div>
          <span style={{ fontSize: "40px", fontWeight: 700, color: "#ffffff", letterSpacing: "-0.5px" }}>
            Promptliv
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: "64px",
            fontWeight: 800,
            color: "#ffffff",
            textAlign: "center",
            lineHeight: 1.1,
            marginBottom: "20px",
            letterSpacing: "-1px",
            maxWidth: "960px",
          }}
        >
          Free AI Prompt Generator
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: "26px",
            color: "#94a3b8",
            textAlign: "center",
            marginBottom: "48px",
          }}
        >
          ChatGPT · Claude · Gemini · Groq
        </div>

        {/* Pills */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center" }}>
          {[
            "Prompt Engineering",
            "Image Prompts",
            "Video Prompts",
            "No Login Required",
          ].map((label) => (
            <div
              key={label}
              style={{
                background: "rgba(99,102,241,0.15)",
                border: "1px solid rgba(99,102,241,0.4)",
                borderRadius: "100px",
                padding: "10px 24px",
                fontSize: "18px",
                color: "#a5b4fc",
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  );
}
