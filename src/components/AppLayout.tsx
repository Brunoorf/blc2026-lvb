import { Link, useLocation } from "@tanstack/react-router";
import { Trophy, ListChecks, GitBranch, BarChart3, Settings, LogOut, Star, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const NAV = [
  { to: "/", label: "Início", icon: Trophy },
  { to: "/palpites", label: "Palpites", icon: ListChecks },
  { to: "/chaveamento", label: "Chaveamento", icon: GitBranch },
  { to: "/ranking", label: "Ranking", icon: BarChart3 },
  { to: "/regras", label: "Regras", icon: Star },
] as const;

export default function AppLayout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 font-bold text-lg">
            <span className="h-9 w-9 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              <Trophy className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Bolão 2026</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => {
              const active = pathname === n.to;
              return (
                <Link key={n.to} to={n.to} className={cn(
                  "relative px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2",
                  active
                    ? "text-primary-foreground bg-primary shadow-md scale-[1.02]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}>
                  <n.icon className="h-4 w-4" />
                  {n.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link to="/admin" className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
                pathname.startsWith("/admin") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}>
                <Shield className="h-4 w-4" /> Admin
              </Link>
            )}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-medium">{profile?.display_name ?? "Jogador"}</span>
              {isAdmin && <span className="text-xs text-accent">Administrador</span>}
            </div>
            <Button variant="ghost" size="icon" onClick={signOut} title="Sair">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="md:hidden flex items-center gap-1 overflow-x-auto px-2 py-2 border-t border-border">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link key={n.to} to={n.to} className={cn(
                "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}>
                <n.icon className="h-3.5 w-3.5" /> {n.label}
              </Link>
            );
          })}
          {isAdmin && (
            <Link to="/admin" className={cn(
              "shrink-0 px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5",
              pathname.startsWith("/admin") ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}>
              <Settings className="h-3.5 w-3.5" /> Admin
            </Link>
          )}
        </nav>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">{children}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Bolão Copa do Mundo 2026 · 48 seleções · 12 grupos
      </footer>
    </div>
  );
}