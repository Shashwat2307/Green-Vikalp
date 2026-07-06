"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { leads, campaigns as campaignsApi, users as usersApi, type Lead, type Priority } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

type EditLeadDialogProps = {
  leadId: string;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeadUpdated?: () => void;
};

type Campaign = {
  id: string;
  name: string;
  pipeline: {
    id: string;
    name: string;
    stages: Array<{ id: string; name: string; order: number; color: string }>;
  };
};

type User = {
  id: string;
  fullName: string;
  email: string;
};

export function EditLeadDialog({
  leadId,
  children,
  open,
  onOpenChange,
  onLeadUpdated,
}: EditLeadDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lead, setLead] = useState<Lead | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [alternatePhone, setAlternatePhone] = useState("");
  const [priority, setPriority] = useState<Priority>("MEDIUM");
  const [tags, setTags] = useState<string[]>([]);
  const [currentStageId, setCurrentStageId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");

  useEffect(() => {
    if (dialogOpen && leadId) {
      loadLead();
      loadCampaigns();
      loadUsers();
    }
  }, [dialogOpen, leadId]);

  const loadLead = async () => {
    setIsLoading(true);
    try {
      const data = await leads.get(leadId);
      setLead(data);

      setFirstName(data.firstName);
      setLastName(data.lastName);
      setEmail(data.email || "");
      setMobile(data.mobile || "");
      setAlternatePhone(data.alternatePhone || "");
      setPriority(data.priority);
      setTags(data.tags || []);
      setCurrentStageId(data.currentStageId);
      setAssignedToId(data.assignedToId);
      setNextFollowUpAt(data.nextFollowUpAt ? new Date(data.nextFollowUpAt).toISOString().split('T')[0] : "");
    } catch (error: any) {
      toast.error("Failed to load lead");
      setDialogOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const loadCampaigns = async () => {
    try {
      const data = await campaignsApi.list();
      setCampaigns(data as any);
    } catch (error: any) {
      console.error("Failed to load campaigns");
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers((data as any).users || []);
    } catch (error: any) {
      console.error("Failed to load users");
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !tags.includes(tag.trim())) {
      setTags([...tags, tag.trim()]);
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSave = async () => {
    if (!firstName.trim() && !lastName.trim() && !fullName.trim()) {
      toast.error("Please provide a name (first name, last name, or full name)");
      return;
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        firstName: firstName.trim() || fullName.trim(),
        lastName: lastName.trim() || undefined,
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        alternatePhone: alternatePhone.trim() || undefined,
        priority,
        tags: tags.length > 0 ? tags : undefined,
        currentStageId: currentStageId !== lead?.currentStageId ? currentStageId : undefined,
        assignedToId: assignedToId !== lead?.assignedToId ? assignedToId : undefined,
        nextFollowUpAt: nextFollowUpAt || undefined,
      };

      await leads.update(leadId, updateData);

      toast.success("Lead updated successfully");
      setDialogOpen(false);
      onLeadUpdated?.();
    } catch (error: any) {
      let errorMessage = "Failed to update lead";
      if (error?.details) {
        if (Array.isArray(error.details)) {
          errorMessage = error.details.map((err: any) => err.message || String(err)).join(", ");
        } else if (typeof error.details === "string") {
          errorMessage = error.details;
        }
      } else if (error?.message && typeof error.message === "string") {
        errorMessage = error.message;
      }
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const currentCampaign = lead ? campaigns.find(c => c.id === lead.campaignId) : null;

  if (isLoading) {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        {children && <DialogTrigger asChild>{children}</DialogTrigger>}
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Loading...</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center p-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-900" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h3 className="font-semibold text-neutral-900">Basic Information</h3>

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                maxLength={200}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile</Label>
                <Input
                  id="mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  maxLength={20}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="alternatePhone">Alternate Phone</Label>
                <Input
                  id="alternatePhone"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  maxLength={20}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4 border-t pt-4">
            <h3 className="font-semibold text-neutral-900">Lead Management</h3>

            <div className="grid gap-4 sm:grid-cols-2">
              {currentCampaign && (
                <div className="space-y-2">
                  <Label htmlFor="currentStageId">Pipeline Stage</Label>
                  <Select value={currentStageId} onValueChange={setCurrentStageId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentCampaign.pipeline.stages
                        .sort((a, b) => a.order - b.order)
                        .map(stage => (
                          <SelectItem key={stage.id} value={stage.id}>
                            {stage.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="assignedToId">Assigned To</Label>
                <Select value={assignedToId} onValueChange={setAssignedToId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                    <SelectItem value="URGENT">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="nextFollowUpAt">Next Follow-up Date</Label>
                <Input
                  id="nextFollowUpAt"
                  type="date"
                  value={nextFollowUpAt}
                  onChange={(e) => setNextFollowUpAt(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-xs hover:text-red-600"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add tag..."
                  maxLength={50}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
