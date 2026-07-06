"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { leads, campaigns as campaignsApi, users as usersApi, type Priority } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ImportLeadsDialogProps = {
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onLeadsImported?: () => void;
};

type Campaign = {
  id: string;
  name: string;
  pipeline: {
    id: string;
    name: string;
    stages: Array<{ id: string; name: string; order: number }>;
  };
};

type User = {
  id: string;
  fullName: string;
  email: string;
};

type ImportStep = "upload" | "configure" | "mapping" | "importing" | "results";

type ColumnMapping = {
  sourceColumn: string;
  targetField: string;
  transformFunction: "NONE" | "UPPERCASE" | "LOWERCASE" | "TRIM" | "SPLIT_COMMA" | "PARSE_NUMBER" | "PARSE_DATE";
};

const LEAD_FIELDS = [
  { value: "firstName", label: "First Name *", type: "text" },
  { value: "lastName", label: "Last Name *", type: "text" },
  { value: "email", label: "Email", type: "text" },
  { value: "mobile", label: "Mobile", type: "text" },
  { value: "alternatePhone", label: "Alternate Phone", type: "text" },
  { value: "leadType", label: "Lead Type (BUYER/SELLER/INVESTOR/RENTER/BUYER_SELLER)", type: "enum" },
  { value: "budgetMin", label: "Budget Min", type: "number" },
  { value: "budgetMax", label: "Budget Max", type: "number" },
  { value: "locationPreference", label: "Location Preference (comma-separated)", type: "array" },
  { value: "propertyTypePreference", label: "Property Types (comma-separated: HOUSE/CONDO/TOWNHOUSE/LAND/COMMERCIAL/MULTI_FAMILY)", type: "array" },
  { value: "bedroomsMin", label: "Min Bedrooms", type: "number" },
  { value: "bathroomsMin", label: "Min Bathrooms", type: "number" },
  { value: "squareFeetMin", label: "Min Square Feet", type: "number" },
  { value: "moveInTimeline", label: "Move-in Timeline (ASAP/ONE_TO_THREE_MONTHS/THREE_TO_SIX_MONTHS/SIX_TO_TWELVE_MONTHS/OVER_A_YEAR/JUST_BROWSING)", type: "enum" },
  { value: "currentHousingStatus", label: "Current Housing Status (RENTING/OWNS_HOME/LIVING_WITH_FAMILY/OTHER)", type: "enum" },
  { value: "preApprovalStatus", label: "Pre-Approval Status (NOT_STARTED/IN_PROGRESS/PRE_QUALIFIED/PRE_APPROVED/NOT_NEEDED)", type: "enum" },
  { value: "preApprovalAmount", label: "Pre-Approval Amount", type: "number" },
  { value: "tags", label: "Tags (comma-separated)", type: "array" },
  { value: "initialNotes", label: "Initial Notes", type: "text" },
  { value: "nextFollowUpAt", label: "Next Follow-up Date", type: "date" },
];

export function ImportLeadsDialog({
  children,
  open,
  onOpenChange,
  onLeadsImported,
}: ImportLeadsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const dialogOpen = isControlled ? open : internalOpen;
  const setDialogOpen = isControlled ? (onOpenChange || (() => {})) : setInternalOpen;

  const [step, setStep] = useState<ImportStep>("upload");
  const [isLoading, setIsLoading] = useState(false);

  // Upload step
  const [sourceType, setSourceType] = useState<"FILE" | "GOOGLE_SHEETS_URL">("FILE");
  const [file, setFile] = useState<File | null>(null);
  const [googleSheetsUrl, setGoogleSheetsUrl] = useState("");

  // Parsed data
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, any>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);

  // Configure step
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedStage, setSelectedStage] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState("");
  const [defaultPriority, setDefaultPriority] = useState<Priority>("MEDIUM");
  const [duplicateHandling, setDuplicateHandling] = useState<"SKIP" | "UPDATE" | "CREATE_NEW">("SKIP");
  const [duplicateCheckFields, setDuplicateCheckFields] = useState<("email" | "mobile" | "both")[]>(["email"]);

  // Mapping step
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);

  // Results
  const [importResults, setImportResults] = useState<any>(null);

  // Load campaigns and users when dialog opens
  useEffect(() => {
    if (dialogOpen && step === "configure") {
      loadCampaigns();
      loadUsers();
    }
  }, [dialogOpen, step]);

  // Auto-select first stage when campaign is selected
  useEffect(() => {
    if (selectedCampaign && campaigns.length > 0) {
      const campaign = campaigns.find(c => c.id === selectedCampaign);
      if (campaign && campaign.pipeline && campaign.pipeline.stages && campaign.pipeline.stages.length > 0) {
        const firstStage = campaign.pipeline.stages.sort((a, b) => a.order - b.order)[0];
        setSelectedStage(firstStage.id);
      }
    }
  }, [selectedCampaign, campaigns]);

  // Smart auto-detection for column mappings
  useEffect(() => {
    if (headers.length > 0 && step === "mapping") {
      const detectedMappings: ColumnMapping[] = [];

      headers.forEach(header => {
        const lowerHeader = header.toLowerCase().trim();
        let targetField = "";
        let transform: ColumnMapping["transformFunction"] = "NONE";

        // Smart matching logic - order matters, check specific patterns first!
        if (lowerHeader.includes("first") && lowerHeader.includes("name")) {
          targetField = "firstName";
        } else if (lowerHeader.includes("last") && lowerHeader.includes("name")) {
          targetField = "lastName";
        } else if (lowerHeader.includes("email") || lowerHeader === "e-mail") {
          targetField = "email";
        } else if (lowerHeader.includes("alternate") && lowerHeader.includes("phone")) {
          targetField = "alternatePhone";
        } else if (lowerHeader.includes("mobile") || lowerHeader.includes("phone") || lowerHeader.includes("cell")) {
          targetField = "mobile";
        } else if (lowerHeader.includes("property") && lowerHeader.includes("type")) {
          targetField = "propertyTypePreference";
          transform = "SPLIT_COMMA";
        } else if (lowerHeader.includes("lead") && lowerHeader.includes("type")) {
          targetField = "leadType";
          transform = "UPPERCASE";
        } else if (lowerHeader.includes("budget") && lowerHeader.includes("min")) {
          targetField = "budgetMin";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("budget") && lowerHeader.includes("max")) {
          targetField = "budgetMax";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("location") || lowerHeader.includes("area")) {
          targetField = "locationPreference";
          transform = "SPLIT_COMMA";
        } else if (lowerHeader.includes("bedroom")) {
          targetField = "bedroomsMin";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("bathroom")) {
          targetField = "bathroomsMin";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("square") && lowerHeader.includes("feet")) {
          targetField = "squareFeetMin";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("move") && lowerHeader.includes("in")) {
          targetField = "moveInTimeline";
          transform = "UPPERCASE";
        } else if (lowerHeader.includes("housing") && lowerHeader.includes("status")) {
          targetField = "currentHousingStatus";
          transform = "UPPERCASE";
        } else if (lowerHeader.includes("approval") && lowerHeader.includes("status")) {
          targetField = "preApprovalStatus";
          transform = "UPPERCASE";
        } else if (lowerHeader.includes("approval") && lowerHeader.includes("amount")) {
          targetField = "preApprovalAmount";
          transform = "PARSE_NUMBER";
        } else if (lowerHeader.includes("follow") && lowerHeader.includes("up")) {
          targetField = "nextFollowUpAt";
          transform = "PARSE_DATE";
        } else if (lowerHeader.includes("note")) {
          targetField = "initialNotes";
        } else if (lowerHeader.includes("tag")) {
          targetField = "tags";
          transform = "SPLIT_COMMA";
        }

        if (targetField) {
          detectedMappings.push({
            sourceColumn: header,
            targetField,
            transformFunction: transform,
          });
        }
      });

      setColumnMappings(detectedMappings);
    }
  }, [headers, step]);

  const loadCampaigns = async () => {
    try {
      const data = await campaignsApi.list();
      setCampaigns(data as any);
    } catch (error: any) {
      toast.error("Failed to load campaigns");
    }
  };

  const loadUsers = async () => {
    try {
      const data = await usersApi.list();
      setUsers((data as any).users || []);
    } catch (error: any) {
      toast.error("Failed to load users");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleParse = async () => {
    if (sourceType === "FILE" && !file) {
      toast.error("Please select a file");
      return;
    }

    if (sourceType === "GOOGLE_SHEETS_URL" && !googleSheetsUrl) {
      toast.error("Please enter a Google Sheets URL");
      return;
    }

    setIsLoading(true);
    try {
      const result = await leads.parseImport({
        sourceType,
        file: sourceType === "FILE" ? file! : undefined,
        url: sourceType === "GOOGLE_SHEETS_URL" ? googleSheetsUrl : undefined,
      });

      setHeaders(result.headers);
      setPreviewData(result.preview);
      setTotalRows(result.totalRows);
      setAllRows(result.allRows || result.preview); // Use all rows if available, fallback to preview

      toast.success(`Parsed ${result.totalRows} rows successfully`);
      setStep("configure");
    } catch (error: any) {
      toast.error(error.message || "Failed to parse spreadsheet");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigure = () => {
    if (!selectedCampaign) {
      toast.error("Please select a campaign");
      return;
    }
    if (!selectedStage) {
      toast.error("Please select a default stage");
      return;
    }
    setStep("mapping");
  };

  const updateMapping = (sourceColumn: string, field: "targetField" | "transformFunction", value: string) => {
    setColumnMappings(prev => {
      const existing = prev.find(m => m.sourceColumn === sourceColumn);
      if (existing) {
        return prev.map(m =>
          m.sourceColumn === sourceColumn
            ? { ...m, [field]: value }
            : m
        );
      } else {
        return [...prev, {
          sourceColumn,
          targetField: field === "targetField" ? value : "",
          transformFunction: field === "transformFunction" ? value as any : "NONE",
        }];
      }
    });
  };

  const removeMapping = (sourceColumn: string) => {
    setColumnMappings(prev => prev.filter(m => m.sourceColumn !== sourceColumn));
  };

  const handleImport = async () => {
    // Validate required mappings
    const hasFirstName = columnMappings.some(m => m.targetField === "firstName");
    const hasLastName = columnMappings.some(m => m.targetField === "lastName");

    if (!hasFirstName || !hasLastName) {
      toast.error("You must map firstName and lastName columns (required fields)");
      return;
    }

    setIsLoading(true);
    setStep("importing");

    try {
      // Use the already loaded allRows data instead of re-fetching
      const rowsToImport = allRows.length > 0 ? allRows : previewData;

      const result = await leads.bulkImport({
        importData: {
          campaignId: selectedCampaign,
          defaultStageId: selectedStage,
          defaultAssignedToId: selectedAssignee || undefined,
          defaultPriority,
          duplicateHandling,
          duplicateCheckFields,
          columnMappings: columnMappings.filter(m => m.targetField),
          rows: rowsToImport,
        },
      });

      setImportResults(result);
      setStep("results");
      toast.success(`Imported ${result.summary.successful} leads successfully`);
      
      if (result.summary.successful > 0) {
        onLeadsImported?.();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to import leads");
      setStep("mapping");
    } finally {
      setIsLoading(false);
    }
  };

  const resetDialog = () => {
    setStep("upload");
    setFile(null);
    setGoogleSheetsUrl("");
    setHeaders([]);
    setPreviewData([]);
    setColumnMappings([]);
    setImportResults(null);
    setSelectedCampaign("");
    setSelectedStage("");
    setSelectedAssignee("");
  };

  const handleClose = () => {
    resetDialog();
    setDialogOpen(false);
  };

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); else setDialogOpen(open); }}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-[1400px]">
        <DialogHeader>
          <DialogTitle>Import Leads from Spreadsheet</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Progress indicator */}
          <div className="flex items-center justify-between">
            {["upload", "configure", "mapping", "results"].map((s, idx) => (
              <div key={s} className="flex items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  step === s ? "bg-blue-600 text-white" :
                  ["upload", "configure", "mapping"].indexOf(step) > idx ? "bg-green-600 text-white" :
                  "bg-neutral-200 text-neutral-600"
                }`}>
                  {idx + 1}
                </div>
                {idx < 3 && <div className="mx-2 h-0.5 w-12 bg-neutral-200" />}
              </div>
            ))}
          </div>

          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Source Type</Label>
                <Select value={sourceType} onValueChange={(v) => setSourceType(v as any)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FILE">Upload CSV/Excel File</SelectItem>
                    <SelectItem value="GOOGLE_SHEETS_URL">Google Sheets URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sourceType === "FILE" ? (
                <div key="file-upload" className="space-y-2">
                  <Label htmlFor="file">Upload File (CSV or Excel)</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                  />
                  {file && <p className="text-sm text-neutral-600">Selected: {file.name}</p>}
                </div>
              ) : (
                <div key="google-sheets" className="space-y-2">
                  <Label htmlFor="url">Google Sheets URL</Label>
                  <Input
                    id="url"
                    type="url"
                    value={googleSheetsUrl || ""}
                    onChange={(e) => setGoogleSheetsUrl(e.target.value || "")}
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                  />
                  <p className="text-xs text-neutral-500">
                    Make sure the sheet is publicly accessible or shared with the service account
                  </p>
                </div>
              )}

              <Button onClick={handleParse} disabled={isLoading} className="w-full">
                {isLoading ? "Parsing..." : "Parse Spreadsheet"}
              </Button>
            </div>
          )}

          {/* Step 2: Configure */}
          {step === "configure" && (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-3">
                <p className="text-sm text-blue-900">
                  Found {totalRows} rows with {headers.length} columns
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Campaign *</Label>
                  <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select campaign" />
                    </SelectTrigger>
                    <SelectContent>
                      {campaigns.map(campaign => (
                        <SelectItem key={campaign.id} value={campaign.id}>
                          {campaign.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCampaignData && selectedCampaignData.pipeline && selectedCampaignData.pipeline.stages && (
                  <div className="space-y-2">
                    <Label>Default Stage *</Label>
                    <Select value={selectedStage} onValueChange={setSelectedStage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedCampaignData.pipeline.stages
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
                  <Label>Default Assignee (Optional)</Label>
                  <Select value={selectedAssignee || undefined} onValueChange={setSelectedAssignee}>
                    <SelectTrigger>
                      <SelectValue placeholder="None (use current user)" />
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
                  <Label>Default Priority</Label>
                  <Select value={defaultPriority} onValueChange={(v) => setDefaultPriority(v as Priority)}>
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
                  <Label>Duplicate Handling</Label>
                  <Select value={duplicateHandling} onValueChange={(v) => setDuplicateHandling(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SKIP">Skip Duplicates</SelectItem>
                      <SelectItem value="UPDATE">Update Existing</SelectItem>
                      <SelectItem value="CREATE_NEW">Always Create New</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Check Duplicates By</Label>
                  <Select
                    value={duplicateCheckFields[0]}
                    onValueChange={(v) => setDuplicateCheckFields([v as any])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email Only</SelectItem>
                      <SelectItem value="mobile">Mobile Only</SelectItem>
                      <SelectItem value="both">Email + Mobile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={handleConfigure}>
                  Next: Map Columns
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Column Mapping */}
          {step === "mapping" && (
            <div className="space-y-4">
              <div className="rounded-md bg-amber-50 p-3">
                <p className="text-sm text-amber-900">
                  Map your spreadsheet columns to lead fields. Required fields: First Name, Last Name
                </p>
              </div>

              <div className="max-h-96 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Spreadsheet Column</TableHead>
                      <TableHead>Maps To Lead Field</TableHead>
                      <TableHead>Transform</TableHead>
                      <TableHead>Preview</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {headers.map(header => {
                      const mapping = columnMappings.find(m => m.sourceColumn === header);
                      const sampleValue = previewData[0]?.[header] || "";
                      const fieldType = mapping?.targetField ? LEAD_FIELDS.find(f => f.value === mapping.targetField)?.type : null;

                      // Don't show transform for email and mobile fields
                      const noTransformFields = ["email", "mobile", "alternatePhone"];
                      const shouldHideTransform = mapping?.targetField && noTransformFields.includes(mapping.targetField);

                      // Determine which transforms are available based on field type
                      const getAvailableTransforms = () => {
                        if (!fieldType || shouldHideTransform) return [];
                        
                        switch (fieldType) {
                          case "text":
                            return ["NONE", "UPPERCASE", "LOWERCASE", "TRIM"];
                          case "enum":
                            return ["NONE", "UPPERCASE", "LOWERCASE", "TRIM"];
                          case "number":
                            return ["NONE", "PARSE_NUMBER"];
                          case "array":
                            return ["NONE", "SPLIT_COMMA", "TRIM"];
                          case "date":
                            return ["NONE", "PARSE_DATE"];
                          default:
                            return ["NONE"];
                        }
                      };

                      const availableTransforms = getAvailableTransforms();
                      const showTransform = mapping?.targetField && !shouldHideTransform && availableTransforms.length > 1;

                      return (
                        <TableRow key={header}>
                          <TableCell className="font-medium">{header}</TableCell>
                          <TableCell>
                            <Select
                              value={mapping?.targetField || undefined}
                              onValueChange={(v) => updateMapping(header, "targetField", v)}
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select field" />
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_FIELDS.map(field => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            {showTransform && (
                              <Select
                                value={mapping.transformFunction}
                                onValueChange={(v) => updateMapping(header, "transformFunction", v)}
                              >
                                <SelectTrigger className="w-[140px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableTransforms.map(transform => (
                                    <SelectItem key={transform} value={transform}>
                                      {transform === "NONE" ? "None" :
                                       transform === "UPPERCASE" ? "Uppercase" :
                                       transform === "LOWERCASE" ? "Lowercase" :
                                       transform === "TRIM" ? "Trim" :
                                       transform === "SPLIT_COMMA" ? "Split by Comma" :
                                       transform === "PARSE_NUMBER" ? "Parse Number" :
                                       transform === "PARSE_DATE" ? "Parse Date" : transform}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[150px] truncate text-xs text-neutral-600">
                            {sampleValue}
                          </TableCell>
                          <TableCell>
                            {mapping && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeMapping(header)}
                              >
                                ×
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setStep("configure")}>
                  Back
                </Button>
                <Button onClick={handleImport} disabled={isLoading}>
                  {isLoading ? "Importing..." : "Import Leads"}
                </Button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center space-y-4 py-8">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-neutral-200 border-t-blue-600" />
              <p className="text-lg font-medium">Importing leads...</p>
              <p className="text-sm text-neutral-600">This may take a few moments</p>
            </div>
          )}

          {/* Step 5: Results */}
          {step === "results" && importResults && (
            <div className="space-y-4">
              <div className="rounded-md bg-blue-50 p-4 mb-4">
                <p className="text-sm text-blue-600">Total Processed</p>
                <p className="text-2xl font-bold text-blue-900">{importResults.summary.totalRows}</p>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-md bg-green-50 p-4">
                  <p className="text-sm text-green-600">Successful</p>
                  <p className="text-2xl font-bold text-green-900">{importResults.summary.successful}</p>
                </div>
                <div className="rounded-md bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-600">Skipped</p>
                  <p className="text-2xl font-bold text-yellow-900">{importResults.summary.skipped}</p>
                </div>
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-600">Failed</p>
                  <p className="text-2xl font-bold text-red-900">{importResults.summary.failed}</p>
                </div>
              </div>

              {(importResults.summary.skipped > 0 || importResults.summary.failed > 0) && (
                <div className="max-h-64 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Message</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {importResults.results
                        .filter((r: any) => r.status !== "success")
                        .map((result: any) => (
                          <TableRow key={result.row}>
                            <TableCell>{result.row}</TableCell>
                            <TableCell>
                              <Badge variant={result.status === "skipped" ? "secondary" : "destructive"}>
                                {result.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{result.message}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={handleClose}>
                  Close
                </Button>
                <Button onClick={() => setStep("upload")}>
                  Import More
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
