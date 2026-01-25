import { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Dashboard",
    description: "Access your premium tips and performance analytics.",
    robots: {
        index: false,
        follow: false,
    }
};

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
