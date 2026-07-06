"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  leads as leadsApi, 
  campaigns as campaignsApi,
  pipelines as pipelinesApi,
  type Priority,
  type Campaign,
  type Pipeline,
  type PipelineStage 
} from "@/lib/api";
import { toast } from "sonner";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "LOW", label: "Low" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HIGH", label: "High" },
  { value: "URGENT", label: "Urgent" },
];

type AddLeadDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeadAdded: () => void;
  children?: React.ReactNode;
};

export function AddLeadDialog({ open, onOpenChange, onLeadAdded, children }: AddLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    email: "",
    mobile: "",
    campaignId: "",
    currentStageId: "",
    priority: "MEDIUM" as Priority,
    initialNotes: "",
  });

  useEffect(() => {
    if (dialogOpen) {
      loadCampaigns();
      loadPipelines();
    }
  }, [dialogOpen]);

  async function loadPipelines() {
    try {
      const data = await pipelinesApi.list();
      setPipelines(data);
    } catch (error: any) {
      console.error("Failed to load pipelines:", error);
    }
  }

  async function loadCampaigns() {
    try {
      setCampaignsLoading(true);
      const data = await campaignsApi.list({ status: "ACTIVE" });
      setCampaigns(data);
      
      if (data.length > 0) {
        setFormData(prev => ({
          ...prev,
          campaignId: data[0].id,
        }));
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to load campaigns");
    } finally {
      setCampaignsLoading(false);
    }
  }

  useEffect(() => {
    if (formData.campaignId && pipelines.length > 0 && !formData.currentStageId) {
      const selectedCampaign = campaigns.find(c => c.id === formData.campaignId);
      if (selectedCampaign) {
        const pipeline = pipelines.find(p => p.id === selectedCampaign.pipelineId);
        if (pipeline && pipeline.stages.length > 0) {
          setFormData(prev => ({
            ...prev,
            currentStageId: pipeline.stages[0].id,
          }));
        }
      }
    }
  }, [formData.campaignId, pipelines, campaigns, formData.currentStageId]);

  const selectedCampaign = campaigns.find(c => c.id === formData.campaignId);
  const selectedPipeline = pipelines.find(p => p.id === selectedCampaign?.pipelineId);

  const resetForm = () => {
    const firstCampaign = campaigns[0];
    const firstPipeline = firstCampaign ? pipelines.find(p => p.id === firstCampaign.pipelineId) : null;
    
    setFormData({
      firstName: "",
      lastName: "",
      fullName: "",
      email: "",
      mobile: "",
      campaignId: firstCampaign?.id || "",
      currentStageId: firstPipeline?.stages[0]?.id || "",
      priority: "MEDIUM",
      initialNotes: "",
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.firstName.trim() && !formData.lastName.trim() && !formData.fullName.trim()) {
      toast.error("Please provide a name (first name, last name, or full name)");
      return;
    }

    if (!formData.campaignId || !formData.currentStageId) {
      toast.error("Campaign and stage are required");
      return;
    }

    setLoading(true);
    try {
      await leadsApi.create({
        firstName: formData.firstName.trim() || formData.fullName.trim(),
        lastName: formData.lastName.trim() || undefined,
        email: formData.email.trim() || undefined,
        mobile: formData.mobile.trim() || undefined,
        campaignId: formData.campaignId,
        currentStageId: formData.currentStageId,
        priority: formData.priority,
        initialNotes: formData.initialNotes.trim() || undefined,
      });

      toast.success("Lead created successfully");
      resetForm();
      setDialogOpen(false);
      onLeadAdded();
    } catch (error: any) {
      toast.error(error.message || "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Create a new lead in the system
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={formData.fullName}
              onChange={(e) =>
                setFormData({ ...formData, fullName: e.target.value })
              }
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                placeholder="John"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                type="tel"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData({ ...formData, mobile: e.target.value })
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select
              value={formData.priority}
              onValueChange={(value: Priority) =>
                setFormData({ ...formData, priority: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    {priority.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">
                Campaign <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.campaignId}
                onValueChange={(value) => {
                  const campaign = campaigns.find(c => c.id === value);
                  const pipeline = pipelines.find(p => p.id === campaign?.pipelineId);
                  setFormData({ 
                    ...formData, 
                    campaignId: value,
                    currentStageId: pipeline?.stages[0]?.id || "",
                  });
                }}
                disabled={campaignsLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stage">
                Stage <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.currentStageId}
                onValueChange={(value) =>
                  setFormData({ ...formData, currentStageId: value })
                }
                disabled={!selectedPipeline}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {selectedPipeline?.stages.map((stage: PipelineStage) => (
                    <SelectItem key={stage.id} value={stage.id}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initialNotes">Initial Notes</Label>
            <Textarea
              id="initialNotes"
              value={formData.initialNotes}
              onChange={(e) =>
                setFormData({ ...formData, initialNotes: e.target.value })
              }
              placeholder="Add any initial notes about this lead..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
