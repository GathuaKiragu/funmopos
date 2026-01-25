import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Login",
    description: "Sign in to Funmo Tips to access premium football predictions.",
};

export default function LoginLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
