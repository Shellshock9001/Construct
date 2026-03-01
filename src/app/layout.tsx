import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "ShellShockHive — AI Agent",
    description: "Intelligent AI coding agent with multi-provider orchestration",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
