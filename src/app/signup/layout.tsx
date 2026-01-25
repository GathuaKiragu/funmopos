import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Sign Up",
    description: "Create a Funmo Tips account to start winning with AI-powered betting insights.",
};

export default function SignupLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
