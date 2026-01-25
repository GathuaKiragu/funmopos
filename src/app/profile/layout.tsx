import { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Profile",
    description: "Manage your account settings and subscription.",
    robots: {
        index: false,
        follow: false,
    }
};

export default function ProfileLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <>{children}</>;
}
