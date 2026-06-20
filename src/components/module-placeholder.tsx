"use client";

import Link from "next/link";
import * as Icons from "lucide-react";
import { ArrowLeft, Construction } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ModulePlaceholderProps {
  area: "tecnico" | "administrativo" | "ventas";
  moduleName: string;
  description: string;
  iconName: string;
  features: string[];
}

export function ModulePlaceholder({
  area,
  moduleName,
  description,
  iconName,
  features,
}: ModulePlaceholderProps) {
  const Icon = (Icons as unknown as Record<string, typeof Construction>)[iconName] || Construction;
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${area}`}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <Badge variant="outline">Esqueleto</Badge>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{moduleName}</h1>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Construction className="h-4 w-4 text-amber-500" />
            Módulo en construcción
          </CardTitle>
          <CardDescription>
            Este módulo se construirá en una fase posterior. La estructura de navegación y rutas ya está lista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm font-medium">Funcionalidades planificadas:</p>
          <ul className="space-y-2">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
