"use client";

import { useEffect, useState } from "react";
import { MobileHeader } from "@/components/mobile/header";
import { leads as leadsApi, interactions as interactionsApi, type Lead } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { Phone, MessageCircle, Mail, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export default function LeadDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [lead, setLead] = useState<Lead | null>(null);
  const [activeTab, setActiveTab] = useState<"LEAD_INFO" | "DISPOSE_LEAD" | "OTHER">("LEAD_INFO");
  const [infoTab, setInfoTab] = useState<"ABOUT" | "TIMELINE">("ABOUT");
  const [isLoading, setIsLoading] = useState(true);

  // Dispose Lead state
  const [disposeState, setDisposeState] = useState({ date: "", time: "" });
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [disposeRemark, setDisposeRemark] = useState("");
  const [isDisposing, setIsDisposing] = useState(false);

  // Other tab state
  const [newStageId, setNewStageId] = useState<string>("");
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  const handleDisposeSubmit = async () => {
    if (isConnected === null || !lead) {
      toast.error("Please specify if the call was connected");
      return;
    }

    setIsDisposing(true);
    try {
      await interactionsApi.create({
        leadId: lead.id,
        type: "CALL",
        subject: isConnected ? "Call - Connected" : "Call - Unconnected",
        content: disposeRemark || (isConnected ? "Call connected successfully." : "Call was not connected."),
        direction: "OUTBOUND",
        duration: isConnected ? 1 : 0,
        occurredAt: new Date().toISOString(),
      });

      if (disposeState.date && disposeState.time) {
        const nextFollowUpAt = new Date(`${disposeState.date}T${disposeState.time}`).toISOString();
        await leadsApi.update(lead.id, { nextFollowUpAt });
      }

      toast.success("Lead disposed successfully");
      setDisposeRemark("");
      setIsConnected(null);
      setDisposeState({ date: "", time: "" });
      setActiveTab("LEAD_INFO");
    } catch (error) {
      toast.error("Failed to dispose lead");
    } finally {
      setIsDisposing(false);
    }
  };

  const handleUpdateStage = async () => {
    if (!newStageId || !lead || newStageId === lead.currentStage.id) return;
    
    setIsUpdatingStage(true);
    try {
      const updatedLead = await leadsApi.updateStage(lead.id, newStageId);
      setLead(updatedLead);
      toast.success("Pipeline stage updated successfully!");
      setActiveTab("LEAD_INFO");
    } catch (error) {
      toast.error("Failed to update pipeline stage");
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleQuickAction = (hours: number) => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + hours);
    
    // Format date as YYYY-MM-DD
    const yyyy = futureDate.getFullYear();
    const mm = String(futureDate.getMonth() + 1).padStart(2, '0');
    const dd = String(futureDate.getDate()).padStart(2, '0');
    
    // Format time as HH:MM
    const hh = String(futureDate.getHours()).padStart(2, '0');
    const min = String(futureDate.getMinutes()).padStart(2, '0');
    
    setDisposeState({
      date: `${yyyy}-${mm}-${dd}`,
      time: `${hh}:${min}`
    });
  };

  // Timer logic
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    async function fetchLead() {
      try {
        const data = await leadsApi.get(id as string);
        setLead(data);
      } catch (error) {
        toast.error("Failed to fetch lead details");
        router.back();
      } finally {
        setIsLoading(false);
      }
    }
    fetchLead();
  }, [id, router]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCall = () => {
    if (lead?.mobile) {
      window.location.href = `tel:${lead.mobile}`;
    }
  };

  if (isLoading || !lead) {
    return (
      <div className="flex h-screen flex-col bg-brand-50">
        <MobileHeader title="Loading..." />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-brand-50 relative pb-[70px]">
      <MobileHeader title={lead.fullName || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Lead"} />

      {/* Tabs */}
      <div className="flex bg-brand-800 text-white shadow-md">
        {(["LEAD_INFO", "DISPOSE_LEAD", "OTHER"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 text-xs font-bold transition-colors border-b-4 ${
              activeTab === tab 
                ? "border-white text-white" 
                : "border-transparent text-brand-200"
            }`}
          >
            {tab.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto pb-[100px]">
        
        {activeTab === "LEAD_INFO" && (
          <div className="p-4 space-y-4">
            {/* Timer and Tags */}
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-brand-100">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>
                <span className="font-mono text-lg font-semibold text-brand-950">{formatTime(elapsedSeconds)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded bg-brand-100 text-brand-700 text-xs font-bold uppercase">{lead.currentStage.name}</span>
                <span className="px-3 py-1 rounded bg-brand-50 text-brand-500 text-xs font-bold uppercase border border-brand-200">#TAG</span>
              </div>
            </div>

            {/* Main Info Card */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
              <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 flex justify-between items-center">
                <h3 className="font-bold text-brand-900 text-lg">{lead.fullName || `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "Unnamed Lead"}</h3>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Phone className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-brand-500 font-semibold uppercase">Mobile Number</p>
                    <p className="text-sm font-bold text-brand-900">{lead.mobile || "No number"}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCall} className="h-10 w-10 rounded-full bg-green-50 flex items-center justify-center border border-green-200 active:bg-green-100">
                      <Phone className="h-4 w-4 text-green-600" />
                    </button>
                    <button className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center shadow-sm shadow-green-200 active:bg-green-600">
                      <MessageCircle className="h-5 w-5 text-white" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <Mail className="h-4 w-4 text-brand-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-brand-500 font-semibold uppercase">Email Address</p>
                    <p className="text-sm font-bold text-brand-900">{lead.email || "No email"}</p>
                  </div>
                  <button className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-200 active:bg-blue-100">
                    <Mail className="h-4 w-4 text-blue-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Campaign Info */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
              <div className="bg-brand-50 px-4 py-3 border-b border-brand-100">
                <h3 className="font-bold text-brand-900">Campaign Details</h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex justify-between border-b border-brand-50 pb-2">
                  <span className="text-xs text-brand-500 font-semibold uppercase">Campaign</span>
                  <span className="text-sm font-bold text-brand-900">{lead.campaign?.name || "N/A"}</span>
                </div>
                <div className="flex justify-between pb-2">
                  <span className="text-xs text-brand-500 font-semibold uppercase">Created At</span>
                  <span className="text-sm font-bold text-brand-900">{new Date(lead.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-3 gap-3">
              <button className="flex flex-col items-center justify-center py-3 bg-white rounded-xl shadow-sm border border-brand-100 text-brand-600 active:bg-brand-50">
                <MessageCircle className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">WhatsApp</span>
              </button>
              <button className="flex flex-col items-center justify-center py-3 bg-white rounded-xl shadow-sm border border-brand-100 text-brand-600 active:bg-brand-50">
                <Mail className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">Email</span>
              </button>
              <button className="flex flex-col items-center justify-center py-3 bg-white rounded-xl shadow-sm border border-brand-100 text-brand-600 active:bg-brand-50">
                <MessageSquare className="h-6 w-6 mb-1" />
                <span className="text-[10px] font-bold uppercase">SMS</span>
              </button>
            </div>

            {/* Priority */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
              <div className="bg-brand-50 px-4 py-2 border-b border-brand-100 text-xs font-bold text-brand-500 uppercase">
                Priority
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <span className="text-xl font-bold text-brand-900">{lead.priority}</span>
                </div>
              </div>
            </div>

            {/* Sub-tabs (About / Timeline) */}
            <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden mt-4">
              <div className="flex border-b border-brand-100">
                <button 
                  onClick={() => setInfoTab("ABOUT")}
                  className={`flex-1 py-3 text-sm font-bold ${
                    infoTab === "ABOUT" ? "text-brand-600 border-b-2 border-brand-600" : "text-brand-400"
                  }`}
                >ABOUT</button>
                <button 
                  onClick={() => setInfoTab("TIMELINE")}
                  className={`flex-1 py-3 text-sm font-bold ${
                    infoTab === "TIMELINE" ? "text-brand-600 border-b-2 border-brand-600" : "text-brand-400"
                  }`}
                >TIMELINE</button>
              </div>
              
              {infoTab === "ABOUT" && (
                <div className="p-4 space-y-4">
                  <div className="flex justify-between border-b border-brand-50 pb-2">
                    <span className="text-xs text-brand-500 font-semibold uppercase">Contact Name</span>
                    <span className="text-sm font-bold text-brand-900">{lead.firstName} {lead.lastName}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-50 pb-2">
                    <span className="text-xs text-brand-500 font-semibold uppercase">Mobile Number</span>
                    <span className="text-sm font-bold text-brand-900">{lead.mobile || "N/A"}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-50 pb-2">
                    <span className="text-xs text-brand-500 font-semibold uppercase">Campaign</span>
                    <span className="text-sm font-bold text-brand-900">{lead.campaign?.name || "N/A"}</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-xs text-brand-500 font-semibold uppercase">Created At</span>
                    <span className="text-sm font-bold text-brand-900">{new Date(lead.createdAt).toLocaleDateString()}</span>
                  </div>
                  {lead.customFields && Object.keys(lead.customFields).length > 0 && (
                    <div className="border-t border-brand-100 pt-3 mt-3">
                      <p className="text-xs text-brand-500 font-semibold uppercase mb-2">Custom Fields</p>
                      {Object.entries(lead.customFields).map(([key, value]) => (
                        <div key={key} className="flex justify-between border-b border-brand-50 pb-2 mb-2">
                          <span className="text-xs text-brand-500 font-semibold uppercase">{key}</span>
                          <span className="text-sm font-bold text-brand-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {infoTab === "TIMELINE" && (
                <div className="p-4 space-y-4">
                  {(!lead.interactions || lead.interactions.length === 0) ? (
                    <div className="text-center py-6 text-brand-400 text-sm">
                      No recent interactions
                    </div>
                  ) : (
                    <div className="space-y-6 border-l-2 border-brand-100 ml-3 pl-4">
                      {lead.interactions.map((interaction: any) => (
                        <div key={interaction.id} className="relative">
                          <div className="absolute -left-[23px] top-0 h-4 w-4 rounded-full bg-brand-50 border-2 border-brand-300"></div>
                          <p className="text-xs text-brand-400 font-medium">{new Date(interaction.occurredAt).toLocaleString()}</p>
                          <p className="text-sm font-bold text-brand-900 mt-0.5">{interaction.type}</p>
                          {interaction.notes && (
                            <p className="text-sm text-brand-600 mt-1 bg-brand-50 p-2 rounded-lg">{interaction.notes}</p>
                          )}
                          <p className="text-xs text-brand-500 mt-2">By {interaction.createdBy?.fullName || "System"}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "DISPOSE_LEAD" && (
          <div className="p-4 space-y-6">
            <div>
              <p className="text-sm font-bold text-brand-900 mb-3">Was call connected?</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsConnected(false)}
                  className={`flex-1 py-3 rounded-lg border-2 font-semibold transition-colors ${
                    isConnected === false 
                      ? "border-red-500 bg-red-50 text-red-700" 
                      : "border-brand-200 text-brand-700 bg-white active:bg-brand-50"
                  }`}
                >
                  Not Connected
                </button>
                <button 
                  onClick={() => setIsConnected(true)}
                  className={`flex-1 py-3 rounded-lg border-2 font-semibold transition-colors ${
                    isConnected === true 
                      ? "border-green-500 bg-green-50 text-green-700" 
                      : "border-brand-200 text-brand-700 bg-white active:bg-brand-50"
                  }`}
                >
                  Yes Connected
                </button>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-brand-900 mb-3">Select next action</p>
              <div className="flex gap-2 mb-3">
                <button 
                  onClick={() => handleQuickAction(1)}
                  className="px-4 py-2 rounded-full border border-brand-200 text-sm font-medium text-brand-700 active:bg-brand-50"
                >1 hour</button>
                <button 
                  onClick={() => handleQuickAction(6)}
                  className="px-4 py-2 rounded-full border border-brand-200 text-sm font-medium text-brand-700 active:bg-brand-50"
                >6 hour</button>
                <button 
                  onClick={() => handleQuickAction(24)}
                  className="px-4 py-2 rounded-full border border-brand-200 text-sm font-medium text-brand-700 active:bg-brand-50"
                >1 day</button>
              </div>
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <input 
                    type="date" 
                    value={disposeState.date}
                    onChange={(e) => setDisposeState(prev => ({ ...prev, date: e.target.value }))}
                    onClick={(e) => {
                      if ('showPicker' in e.currentTarget) {
                        try { e.currentTarget.showPicker(); } catch (err) {}
                      }
                    }}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-brand-200 bg-white text-brand-900 font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 min-h-[48px]" 
                  />
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400 pointer-events-none" />
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="time" 
                    value={disposeState.time}
                    onChange={(e) => setDisposeState(prev => ({ ...prev, time: e.target.value }))}
                    onClick={(e) => {
                      if ('showPicker' in e.currentTarget) {
                        try { e.currentTarget.showPicker(); } catch (err) {}
                      }
                    }}
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-brand-200 bg-white text-brand-900 font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 min-h-[48px]"
                  />
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-brand-900 mb-3">Options</p>
              <div className="grid grid-cols-2 gap-3">
                <button className="py-3 rounded-xl border border-brand-200 bg-white text-brand-700 font-medium text-sm">Re-assign</button>
                <button className="py-3 rounded-xl border border-brand-200 bg-white text-brand-700 font-medium text-sm">Copy to campaign</button>
                <button className="py-3 rounded-xl border border-brand-200 bg-white text-brand-700 font-medium text-sm col-span-2">Move to campaign</button>
              </div>
            </div>

            <div>
              <p className="text-sm font-bold text-brand-900 mb-3">Dispose Remark</p>
              <textarea 
                className="w-full h-32 rounded-xl border border-brand-200 bg-white p-4 focus:outline-none focus:border-brand-500 resize-none"
                placeholder="Enter remarks..."
                value={disposeRemark}
                onChange={(e) => setDisposeRemark(e.target.value)}
              ></textarea>
            </div>
            
            <Button 
              onClick={handleDisposeSubmit}
              disabled={isDisposing || isConnected === null}
              className="w-full h-14 rounded-xl bg-brand-800 hover:bg-brand-900 text-white shadow-md text-lg font-semibold disabled:opacity-50"
            >
              {isDisposing ? "Submitting..." : "Submit"}
            </Button>
          </div>
        )}

        {activeTab === "OTHER" && (
          <div className="p-4 space-y-4">
             <div className="bg-white rounded-xl shadow-sm border border-brand-100 overflow-hidden">
              <div className="bg-brand-50 px-4 py-3 border-b border-brand-100 text-sm font-bold text-brand-900">
                Change Pipeline Stage
              </div>
              <div className="p-4 space-y-3">
                <p className="text-sm text-brand-600">Current Stage: <strong>{lead.currentStage.name}</strong></p>
                <div className="relative">
                  <select
                    className="w-full appearance-none px-4 py-3 rounded-xl border border-brand-200 bg-white text-brand-900 font-medium focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    value={newStageId}
                    onChange={(e) => setNewStageId(e.target.value)}
                  >
                    <option value="" disabled>Select New Stage</option>
                    {lead.campaign?.pipeline?.stages?.map((stage: any) => (
                      <option key={stage.id} value={stage.id}>
                        {stage.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-brand-400 pointer-events-none" />
                </div>
              </div>
             </div>
             
             <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 h-14 rounded-xl border-brand-300 text-brand-700 font-semibold" onClick={() => setActiveTab("LEAD_INFO")}>
                Go Back
              </Button>
              <Button 
                onClick={handleUpdateStage}
                disabled={!newStageId || newStageId === lead.currentStage.id || isUpdatingStage}
                className="flex-1 h-14 rounded-xl bg-brand-800 text-white shadow-md font-semibold disabled:opacity-50"
              >
                {isUpdatingStage ? "Updating..." : "Submit"}
              </Button>
             </div>
          </div>
        )}
      </div>

      {/* Floating Call Button for LEAD_INFO tab */}
      {activeTab === "LEAD_INFO" && (
        <div className="absolute bottom-[80px] left-4 right-4 z-10">
          <Button 
            className="w-full h-14 rounded-xl bg-green-600 hover:bg-green-700 text-white shadow-lg text-lg font-semibold flex items-center gap-2"
            onClick={handleCall}
          >
            <Phone className="h-5 w-5 fill-white" />
            Call Now
          </Button>
        </div>
      )}
    </div>
  );
}
