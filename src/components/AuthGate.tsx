import { useAuth } from "@/lib/auth-context";
import { Trophy } from "lucide-react";
import LoginScreen from "@/components/LoginScreen";
import AppLayout from "@/components/AppLayout";
import type { ReactNode } from "react";

export default function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Trophy className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }
  if (!user) return <LoginScreen />;
  return <AppLayout>{children}</AppLayout>;
}