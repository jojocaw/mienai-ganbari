import type { Metadata, Viewport } from "next";
import { DemoNote, DemoShim } from "./DemoNote";
import "./globals.css";

export const metadata: Metadata = {
  title: "見えない頑張りを拾う (mienai-ganbari)",
  description: "声の大きい人ではなく、本当に頑張った人にプラスが届く仕組み — Built with Claude: Japan 2026. All data is fictional.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-stone-50 text-stone-900">
        <DemoNote />
        {children}
        <DemoShim />
      </body>
    </html>
  );
}
