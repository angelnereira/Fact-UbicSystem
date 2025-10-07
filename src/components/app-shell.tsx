"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  LayoutDashboard,
  Menu,
  Settings,
  User,
  GitBranch,
  Database,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarTrigger,
  SidebarInset,
  useSidebar,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

const menuItems = [
  {
    href: "/dashboard",
    icon: LayoutDashboard,
    label: "Resumen",
  },
  {
    href: "/dashboard/movements",
    icon: GitBranch,
    label: "Movimientos",
  },
  {
    href: "/dashboard/settings",
    icon: Settings,
    label: "Configuración",
  },
];

function MainSidebar() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  const isInvoiceRoute = pathname.startsWith("/dashboard/invoices");

  return (
    <Sidebar
      collapsible="icon"
      className="border-sidebar-border"
      defaultOpen={!isMobile}
    >
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {menuItems.map((item) => (
             <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
           <SidebarMenuItem>
              <SidebarMenuButton
                data-state={isInvoiceRoute ? 'open' : 'closed'}
                isActive={isInvoiceRoute}
                tooltip="Facturas"
              >
                  <FileText />
                  <span>Facturas</span>
              </SidebarMenuButton>
              <SidebarMenuSub>
                  <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/new'}>
                    <Link href="/dashboard/invoices/new">Crear Nueva</Link>
                  </SidebarMenuSubButton>
                  <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/status'}>
                    <Link href="/dashboard/invoices/status">Consultar Estado</Link>
                  </SidebarMenuSubButton>
                   <SidebarMenuSubButton asChild isActive={pathname === '/dashboard/invoices/cancel'}>
                    <Link href="/dashboard/invoices/cancel">Anular</Link>
                  </SidebarMenuSubButton>
              </SidebarMenuSub>
            </SidebarMenuItem>
        </SidebarMenu>
         <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Diagnóstico</SidebarGroupLabel>
            <SidebarMenu>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard/consult/ruc'} tooltip="Consultar RUC">
                        <Link href="/dashboard/consult/ruc">
                            <User />
                            <span>Consultar RUC</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === '/dashboard/test-db'} tooltip="Test DB">
                        <Link href="/dashboard/test-db">
                            <Database />
                            <span>Test DB</span>
                        </Link>
                    </SidebarMenuButton>
                </SidebarMenuItem>
            </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="group-data-[collapsible=icon]:hidden">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                <User className="size-4" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Usuario Admin</p>
                <p className="text-xs text-muted-foreground">
                  admin@example.com
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mb-2 w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Perfil</DropdownMenuItem>
            <DropdownMenuItem>Facturación</DropdownMenuItem>
            <DropdownMenuItem>Equipo</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Cerrar Sesión</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

function MobileHeader() {
  const { isMobile } = useSidebar();
  if (!isMobile) return null;

  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-4 lg:h-[60px] lg:px-6">
      <SidebarTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 md:hidden">
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SidebarTrigger>
      <div className="w-full flex-1">
        <Logo />
      </div>
    </header>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <MainSidebar />
      <SidebarInset className="flex flex-col">
        <MobileHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
