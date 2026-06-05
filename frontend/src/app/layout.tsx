import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://www.promptliv.com"),
  title: "Prompt Generator — Free AI Prompts for ChatGPT, Claude & Gemini | Promptliv",
  description:
    "Free AI prompt generator for ChatGPT, Claude, Gemini & Groq. Generate & improve prompts using prompt engineering — image prompts, video prompts, text prompts & more. No login required.",
  keywords: [
    "prompt generator",
    "ai prompt generator",
    "prompt engineering",
    "chatgpt prompt generator",
    "claude prompt generator",
    "image prompt generator",
    "text prompt generator",
    "video prompt generator",
    "random prompt generator",
    "prompt",
    "free prompt generator",
  ],
  openGraph: {
    title: "Prompt Generator — Free AI Prompts for ChatGPT, Claude & Gemini",
    description:
      "Free AI prompt generator for ChatGPT, Claude, Gemini & Groq. Generate & improve prompts with prompt engineering. Image, video & text prompts. No login required.",
    url: "https://www.promptliv.com",
    siteName: "Promptliv",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Prompt Generator — Free AI Prompts for ChatGPT, Claude & Gemini",
    description:
      "Free AI prompt generator for ChatGPT, Claude, Gemini & Groq. Generate & improve prompts with prompt engineering. No login required.",
  },
  alternates: {
    canonical: "https://www.promptliv.com",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.promptliv.com/#organization",
      name: "Promptliv",
      url: "https://www.promptliv.com",
      logo: {
        "@type": "ImageObject",
        "@id": "https://www.promptliv.com/#logo",
        url: "https://www.promptliv.com/web-app-manifest-512x512.png",
        width: 512,
        height: 512,
        caption: "Promptliv",
      },
      image: { "@id": "https://www.promptliv.com/#logo" },
    },
    {
      "@type": "WebSite",
      "@id": "https://www.promptliv.com/#website",
      url: "https://www.promptliv.com",
      name: "Promptliv",
      publisher: { "@id": "https://www.promptliv.com/#organization" },
    },
    {
      "@type": "WebApplication",
      "@id": "https://www.promptliv.com/#webapp",
      name: "Promptliv",
      url: "https://www.promptliv.com",
      description:
        "Free AI prompt generator for ChatGPT, Claude, Gemini, and Groq. Generate and improve AI prompts using prompt engineering best practices. Supports image prompts, video prompts, text prompts, and more.",
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Any",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      featureList: [
        "AI Prompt Generator",
        "Prompt Engineering",
        "ChatGPT Prompt Generator",
        "Claude Prompt Generator",
        "Image Prompt Generator",
        "Video Prompt Generator",
        "Text Prompt Generator",
        "Random Prompt Generator",
        "Prompt Improvement",
      ],
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is a prompt generator?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "A prompt generator is a tool that uses prompt engineering techniques to craft precise, structured instructions for AI models like ChatGPT, Claude, and Gemini. You describe your goal in plain English and the tool builds an optimized prompt ready to use with any AI.",
          },
        },
        {
          "@type": "Question",
          name: "Is Promptliv free to use?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Promptliv offers 5 free prompt generations with no login required. For unlimited use, connect your own API key from Groq (free tier available), Anthropic, OpenAI, or Google Gemini.",
          },
        },
        {
          "@type": "Question",
          name: "Can I use Promptliv as a ChatGPT prompt generator?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Promptliv generates structured prompts optimized for ChatGPT (GPT-4o), Claude, Gemini, Groq, and any OpenAI-compatible endpoint. Use it as a dedicated ChatGPT prompt generator or switch providers anytime.",
          },
        },
        {
          "@type": "Question",
          name: "Does it work as an image prompt generator?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Describe your image concept and Promptliv crafts a detailed visual prompt optimized for image AI tools like DALL·E, Midjourney, Stable Diffusion, and Adobe Firefly.",
          },
        },
        {
          "@type": "Question",
          name: "Can I generate video prompts?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. Use Promptliv as a video prompt generator to create scene descriptions and cinematic prompts for Sora, Runway, Pika, and Kling AI.",
          },
        },
        {
          "@type": "Question",
          name: "What is prompt engineering?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Prompt engineering is the practice of designing and refining inputs to get the best possible outputs from AI models. Promptliv automates this using Anthropic's published metaprompt framework, asking clarifying questions to build a high-quality prompt for your task.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="Promptliv" />
        <link rel="manifest" href="/site.webmanifest" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-D8QPEXZBDF"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-D8QPEXZBDF');
        `}
      </Script>
      <body className={`${inter.className} bg-gray-950 text-gray-100 min-h-screen`}>{children}</body>
    </html>
  );
}
