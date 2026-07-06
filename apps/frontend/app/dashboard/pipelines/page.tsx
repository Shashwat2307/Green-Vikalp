"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pipelines as pipelinesApi, type Pipeline, type PipelineStage } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { CreatePipelineDialog } from "@/components/create-pipeline-dialog";
import { toast } from "sonner";

export default function PipelinesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPipelines();
  }, []);

  async function loadPipelines() {
    try {
      setLoading(true);
      const data = await pipelinesApi.list();
      setPipelines(data);
    } catch (error: any) {
      toast.error(error.message || "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-neutral-900">Pipelines</h1>
          <p className="text-neutral-600 mt-1">Manage sales pipelines and stages</p>
        </div>
        {user && (user.role === "ADMIN" || user.role === "MANAGER") && (
          <CreatePipelineDialog onPipelineCreated={loadPipelines}>
            <Button>Create Pipeline</Button>
          </CreatePipelineDialog>
        )}
      </div>

      <div className="grid gap-6">
        {pipelines.map((pipeline) => (
          <Card 
            key={pipeline.id} 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => router.push(`/dashboard/campaigns?pipelineId=${pipeline.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-3">
                    {pipeline.name}
                    <Badge variant="outline" className="font-normal">
                      {pipeline.type}
                    </Badge>
                    {pipeline._count && (
                      <Badge variant="secondary" className="font-normal">
                        {pipeline._count.campaigns} campaigns
                      </Badge>
                    )}
                  </CardTitle>
                  {pipeline.description && (
                    <p className="text-sm text-neutral-600 mt-1">
                      {pipeline.description}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium text-neutral-700">Stages:</p>
                <div className="flex flex-wrap gap-2">
                  {pipeline.stages.map((stage) => (
                    <Badge
                      key={stage.id}
                      className="px-3 py-1"
                      style={{
                        backgroundColor: stage.color + "20",
                        color: stage.color,
                        borderColor: stage.color,
                      }}
                    >
                      {stage.order + 1}. {stage.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {pipelines.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-neutral-600 mb-4">No pipelines found</p>
              <p className="text-sm text-neutral-500">Contact your administrator to create pipelines</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
