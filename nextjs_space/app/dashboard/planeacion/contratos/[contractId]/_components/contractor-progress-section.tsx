"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";
import { formatShortDate } from "@/lib/format";

interface ContractorProgressSectionProps {
  contractId: string;
  contractStatus: string;
}

export function ContractorProgressSection({
  contractId,
  contractStatus,
}: ContractorProgressSectionProps) {
  const [loading, setLoading] = useState(true);
  const [progressList, setProgressList] = useState<any[]>([]);

  useEffect(() => {
    if (contractStatus === "ENABLED") {
      loadProgress();
    }
  }, [contractStatus, contractId]);

  const loadProgress = async () => {
    try {
      const res = await fetch(`/api/contratos/${contractId}/avances`);
      if (res.ok) {
        const data = await res.json();
        setProgressList(data);
      }
    } catch (error) {
      console.error("Error loading progress:", error);
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = contractStatus === "ENABLED";

  if (!isEnabled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avances del Contratista</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">
            Habilita el contrato para registrar avances.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avances del Contratista</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Avances del Contratista</CardTitle>
          <Button
            size="sm"
            asChild
            variant="outline"
          >
            <Link href={`/dashboard/planeacion/contratos/${contractId}/avances`}>
              Ver Todos
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {progressList.length === 0 ? (
          <p className="text-sm text-gray-500">
            No hay registros de avance del contratista.
          </p>
        ) : (
          <div className="space-y-3">
            {progressList.slice(0, 5).map((progress: any) => (
              <Link
                key={progress.id}
                href={`/dashboard/planeacion/contratos/${contractId}/avances/${progress.id}`}
              >
                <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-sm">
                        {formatShortDate(progress.date)}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {progress.entries?.length || 0} actividades
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Registrado por: {progress.createdBy?.name}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
