"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MobileHeader } from "@/components/mobile/header";
import { projects as projectsApi, type Project } from "@/lib/api";
import { FolderKanban, Plus, ExternalLink, Calendar, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    status: "ACTIVE" as string,
    startDate: "",
    endDate: "",
    budget: "",
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  async function fetchProjects() {
    try {
      const data = await projectsApi.list();
      setProjects(data);
    } catch {
      toast.error("Failed to fetch projects");
    } finally {
      setIsLoading(false);
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error("Project name is required");
      return;
    }
    setIsCreating(true);
    try {
      const project = await projectsApi.create({
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        status: formData.status as any,
        startDate: formData.startDate || undefined,
        endDate: formData.endDate || undefined,
        budget: formData.budget ? Number(formData.budget) : undefined,
      });
      setProjects(prev => [project, ...prev]);
      setShowCreate(false);
      setFormData({ name: "", description: "", status: "ACTIVE", startDate: "", endDate: "", budget: "" });
      toast.success("Project created!");
    } catch {
      toast.error("Failed to create project");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-neutral-50/50 relative pb-[70px]">
      <MobileHeader
        title="Projects"
        rightActions={
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="rounded-full h-9 w-9 bg-neutral-900 text-white flex items-center justify-center hover:bg-neutral-800 transition-colors"
          >
            <Plus className="h-5 w-5" />
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-[80px]">
        {showCreate && (
          <div className="bg-white rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-neutral-200/60 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900 text-lg">New Project</h3>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">Name *</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Project name"
                className="h-12 border-neutral-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Project description"
                className="w-full h-24 rounded-xl border border-neutral-200 bg-white p-4 focus:outline-none focus:border-neutral-400 resize-none text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">Start Date</label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                  className="h-12 border-neutral-200"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">End Date</label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                  className="h-12 border-neutral-200"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-neutral-500 uppercase mb-1 block">Budget</label>
              <Input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
                placeholder="₹ 0"
                className="h-12 border-neutral-200"
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-12" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button className="flex-1 h-12 bg-neutral-900 text-white" onClick={handleCreate} disabled={isCreating}>
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center pt-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-neutral-200 border-t-neutral-800" />
          </div>
        ) : projects.length === 0 && !showCreate ? (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <div className="mb-4 rounded-full bg-neutral-100 p-6 shadow-inner">
              <FolderKanban className="h-16 w-16 text-neutral-400" strokeWidth={2} />
            </div>
            <p className="text-lg font-medium text-neutral-900">No projects yet.</p>
            <p className="text-sm text-neutral-500 mt-1">Create your first project to get started.</p>
          </div>
        ) : (
          projects.map((project) => (
            <div
              key={project.id}
              className="bg-white rounded-2xl shadow-[0_0_20px_rgba(0,0,0,0.15)] border border-neutral-200/60 p-5 transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-semibold text-lg text-neutral-900 mb-1 tracking-tight">{project.name}</h3>
                  {project.description && (
                    <p className="text-sm text-neutral-500 line-clamp-2">{project.description}</p>
                  )}
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                  project.status === "ACTIVE" ? "bg-green-100 text-green-700" :
                  project.status === "COMPLETED" ? "bg-blue-100 text-blue-700" :
                  "bg-neutral-100 text-neutral-600"
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-neutral-500 mt-4 pt-4 border-t border-neutral-100">
                {project.startDate && (
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{new Date(project.startDate).toLocaleDateString()}</span>
                  </div>
                )}
                {project.budget && (
                  <div className="flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span>₹ {project.budget}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
