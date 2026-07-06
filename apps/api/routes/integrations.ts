import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import prisma from "@db/client";
import { authenticate } from "../middleware/auth";
import { readSheetData } from "../lib/google-sheets";
import { getFormQuestions, getFormResponses } from "../lib/google-forms";
import { getDriveFolders } from "../lib/google-drive";
import { uploadToS3, generateS3Key } from "../lib/s3";

interface SyncRequest {
  spreadsheetId?: string;
  formId?: string;
  range?: string;
  campaignId: string;
  currentStageId: string;
  mapping: Record<string, string>;
}

const router = Router();

// GET /integrations/google-sheets/status - Check if Google Sheets is connected
router.get("/google-sheets/status", authenticate, async (req: Request, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { googleRefreshToken: true, googleSheetsSynced: true },
    });

    res.json({ 
      connected: !!(user?.googleRefreshToken && user?.googleSheetsSynced) 
    });
  } catch (error) {
    console.error("Error checking sheets status:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /integrations/google-sheets/headers - Fetch headers from a Google Sheet
router.get("/google-sheets/headers", authenticate, async (req: Request, res: Response) => {
  try {
    const { spreadsheetId, range } = req.query as { spreadsheetId: string; range: string };

    if (!spreadsheetId || !range) {
      res.status(400).json({ error: "Missing spreadsheetId or range" });
      return;
    }

    const userId = req.user!.userId;
    const rows = await readSheetData(userId, spreadsheetId, range);

    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "No data found in the specified sheet range" });
      return;
    }

    res.json({ headers: rows[0] });
  } catch (error) {
    console.error("Error fetching sheet headers:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /integrations/google-sheets/sync - Sync leads from a Google Sheet
router.post("/google-sheets/sync", authenticate, async (req: Request, res: Response) => {
  try {
    const { spreadsheetId, range, campaignId, currentStageId, mapping } = req.body as SyncRequest;

    if (!spreadsheetId || !range || !campaignId || !currentStageId || !mapping) {
      res.status(400).json({ error: "Missing required parameters for sync" });
      return;
    }

    const userId = req.user!.userId;
    const rows = await readSheetData(userId, spreadsheetId, range);

    if (!rows || rows.length === 0) {
      res.status(404).json({ error: "No data found in the specified sheet range" });
      return;
    }

    // Assume first row is header, skip it
    const dataRows = rows.slice(1);
    let importedCount = 0;
    let updatedCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      try {
        const leadData: any = {
          campaignId,
          currentStageId,
        };

        // Map columns to lead fields
        Object.entries(mapping).forEach(([field, colIdxStr]) => {
          const colIdx = parseInt(colIdxStr);
          if (!isNaN(colIdx) && row[colIdx]) {
            leadData[field] = row[colIdx];
          }
        });

        // Basic validation for required fields
        if (!leadData.firstName || !leadData.lastName) {
          throw new Error("First Name and Last Name are required");
        }

        // Upsert based on email or mobile
        const identifier = leadData.email || leadData.mobile;
        let lead;

        if (identifier) {
          const existingLead = await prisma.lead.findFirst({
            where: {
              OR: [
                { email: leadData.email },
                { mobile: leadData.mobile },
              ],
            },
          });

          if (existingLead) {
            lead = await prisma.lead.update({
              where: { id: existingLead.id },
              data: leadData,
            });
            updatedCount++;
          } else {
            lead = await prisma.lead.create({
              data: leadData,
            });
            importedCount++;
          }
        } else {
          // Create as new lead if no identifier provided
          lead = await prisma.lead.create({
            data: leadData,
          });
          importedCount++;
        }
      } catch (error: any) {
        errors.push({ row: i + 2, error: error.message });
      }
    }

    res.json({
      message: "Sync completed",
      imported: importedCount,
      updated: updatedCount,
      errors,
    });
  } catch (error) {
    console.error("Google Sheets sync error:", error);
    res.status(500).json({ error: "Internal server error during sync" });
  }
});

// GET /integrations/google-forms/questions - Fetch questions from a Google Form
router.get("/google-forms/questions", authenticate, async (req: Request, res: Response) => {
  try {
    const { formId } = req.query as { formId: string };

    if (!formId) {
      res.status(400).json({ error: "Missing formId" });
      return;
    }

    const userId = req.user!.userId;
    const questions = await getFormQuestions(userId, formId);

    if (!questions || questions.length === 0) {
      res.status(404).json({ error: "No questions found in the specified form or form not accessible" });
      return;
    }

    res.json({ questions });
  } catch (error) {
    console.error("Error fetching form questions:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /integrations/google-forms/sync - Sync leads from a Google Form
router.post("/google-forms/sync", authenticate, async (req: Request, res: Response) => {
  try {
    const { formId, campaignId, currentStageId, mapping } = req.body as SyncRequest;

    if (!formId || !campaignId || !currentStageId || !mapping) {
      res.status(400).json({ error: "Missing required parameters for sync" });
      return;
    }

    const userId = req.user!.userId;
    const responses = await getFormResponses(userId, formId);

    if (!responses || responses.length === 0) {
      res.status(404).json({ error: "No responses found for this form" });
      return;
    }

    let importedCount = 0;
    let updatedCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < responses.length; i++) {
      const response = responses[i];
      try {
        const leadData: any = {
          campaignId,
          currentStageId,
        };

        const answers = response.answers || {};

        // Map question IDs to lead fields
        Object.entries(mapping).forEach(([field, questionId]) => {
          const answerObj = answers[questionId];
          if (answerObj && answerObj.textAnswers && answerObj.textAnswers.answers && answerObj.textAnswers.answers.length > 0) {
            leadData[field] = answerObj.textAnswers.answers[0].value;
          }
        });

        // Basic validation
        if (!leadData.firstName || !leadData.lastName) {
          throw new Error("First Name and Last Name are required");
        }

        // Upsert based on email or mobile
        const identifier = leadData.email || leadData.mobile;
        let lead;

        if (identifier) {
          const existingLead = await prisma.lead.findFirst({
            where: {
              OR: [
                { email: leadData.email },
                { mobile: leadData.mobile },
              ],
            },
          });

          if (existingLead) {
            lead = await prisma.lead.update({
              where: { id: existingLead.id },
              data: leadData,
            });
            updatedCount++;
          } else {
            lead = await prisma.lead.create({
              data: leadData,
            });
            importedCount++;
          }
        } else {
          lead = await prisma.lead.create({
            data: leadData,
          });
          importedCount++;
        }
      } catch (error: any) {
        errors.push({ row: i + 1, error: error.message });
      }
    }

    res.json({
      message: "Sync completed",
      imported: importedCount,
      updated: updatedCount,
      errors,
    });
  } catch (error) {
    console.error("Google Forms sync error:", error);
    res.status(500).json({ error: "Internal server error during sync" });
  }
});

// GET /integrations/google-drive/folders - Fetch folders from Google Drive
router.get("/google-drive/folders", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const folders = await getDriveFolders(userId);

    if (!folders) {
      res.status(404).json({ error: "No folders found or Google Drive not connected" });
      return;
    }

    res.json({ folders });
  } catch (error) {
    console.error("Error fetching drive folders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /integrations/google-drive/config - Save default sync folder
router.post("/google-drive/config", authenticate, async (req: Request, res: Response) => {
  try {
    const { folderId } = req.body;

    if (!folderId) {
      res.status(400).json({ error: "Missing folderId" });
      return;
    }

    // In a real application, you would save this to the User or Integration schema
    // For now, we simulate success
    res.json({
      message: "Google Drive folder configured successfully",
      folderId,
    });
  } catch (error) {
    console.error("Google Drive config error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /integrations/webhooks/pabbly/:source/:campaignId/:stageId - Unauthenticated webhook for lead gen sources
router.post("/webhooks/pabbly/:source/:campaignId/:stageId", async (req: Request, res: Response) => {
  try {
    const { source, campaignId, stageId } = req.params;
    const data = req.body;

    if (!data.firstName || (!data.email && !data.mobile)) {
      res.status(400).json({ error: "Missing required fields: firstName and either email or mobile are required." });
      return;
    }

    // Verify campaign exists
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, createdById: true },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Prepare lead data
    const leadData: any = {
      campaignId,
      currentStageId: stageId,
      assignedToId: campaign.createdById, // Assign to the creator by default
      firstName: data.firstName,
      lastName: data.lastName || "",
      email: data.email || null,
      mobile: data.mobile || null,
      alternatePhone: data.alternatePhone || null,
      leadType: data.leadType || "BUYER",
      budgetMin: data.budgetMin ? parseFloat(data.budgetMin) : null,
      budgetMax: data.budgetMax ? parseFloat(data.budgetMax) : null,
      tags: [source], // Automatically tag the lead with the source (e.g., just-dial, magicbricks)
    };

    // Upsert logic
    const identifier = leadData.email || leadData.mobile;
    let lead;

    if (identifier) {
      const existingLead = await prisma.lead.findFirst({
        where: {
          OR: [
            { email: leadData.email },
            { mobile: leadData.mobile },
          ],
        },
      });

      if (existingLead) {
        // Only push the source tag if it doesn't already exist
        const updatedTags = Array.from(new Set([...existingLead.tags, source]));
        lead = await prisma.lead.update({
          where: { id: existingLead.id },
          data: { ...leadData, tags: updatedTags },
        });
      } else {
        lead = await prisma.lead.create({
          data: leadData,
        });
      }
    } else {
      lead = await prisma.lead.create({
        data: leadData,
      });
    }

    res.status(200).json({
      message: "Lead successfully processed",
      leadId: lead.id,
    });
  } catch (error) {
    console.error("Pabbly Webhook Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

const upload = multer({ storage: multer.memoryStorage() });

// POST /integrations/upload-excel - Upload and parse Excel/CSV leads
router.post("/upload-excel", authenticate, upload.single("file"), async (req: Request, res: Response) => {
  try {
    const { campaignId, stageId } = req.body;
    const file = req.file;

    if (!campaignId || !stageId) {
      res.status(400).json({ error: "Missing campaignId or stageId" });
      return;
    }

    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    // Verify campaign
    const campaign = await prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { id: true, createdById: true },
    });

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" });
      return;
    }

    // Upload to S3
    const s3Key = generateS3Key(file.originalname, "leads-imports");
    const uploadResult = await uploadToS3(file, s3Key);
    if (!uploadResult.success) {
      res.status(500).json({ error: `Failed to upload file to S3: ${uploadResult.error}` });
      return;
    }

    // Parse Excel/CSV
    const workbook = xlsx.read(file.buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const data: any[] = xlsx.utils.sheet_to_json(worksheet);

    let importedCount = 0;
    let updatedCount = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      try {
        const firstName = row["First Name"] || row["firstName"] || row["first_name"];
        const email = row["Email"] || row["email"];
        const mobile = row["Mobile"] || row["mobile"] || row["Phone"] || row["phone"];

        if (!firstName) {
          throw new Error("Missing First Name");
        }
        if (!email && !mobile) {
          throw new Error("Missing Email and Mobile. At least one is required.");
        }

        const leadData: any = {
          campaignId,
          currentStageId: stageId,
          assignedToId: campaign.createdById,
          firstName: String(firstName),
          lastName: row["Last Name"] ? String(row["Last Name"]) : "",
          email: email ? String(email) : null,
          mobile: mobile ? String(mobile) : null,
          alternatePhone: row["Alternate Phone"] ? String(row["Alternate Phone"]) : null,
          leadType: row["Lead Type"] || "BUYER",
          budgetMin: row["Budget Min"] ? parseFloat(row["Budget Min"]) : null,
          budgetMax: row["Budget Max"] ? parseFloat(row["Budget Max"]) : null,
          tags: ["excel-upload"],
        };

        const identifier = leadData.email || leadData.mobile;
        let lead;

        if (identifier) {
          const existingLead = await prisma.lead.findFirst({
            where: {
              OR: [
                { email: leadData.email },
                { mobile: leadData.mobile },
              ],
            },
          });

          if (existingLead) {
            lead = await prisma.lead.update({
              where: { id: existingLead.id },
              data: leadData,
            });
            updatedCount++;
          } else {
            lead = await prisma.lead.create({
              data: leadData,
            });
            importedCount++;
          }
        } else {
          lead = await prisma.lead.create({
            data: leadData,
          });
          importedCount++;
        }
      } catch (error: any) {
        errors.push({ row: i + 2, error: error.message }); // i + 2 to account for header and 0-index
      }
    }

    res.json({
      message: "File processed successfully",
      imported: importedCount,
      updated: updatedCount,
      errors,
    });
  } catch (error) {
    console.error("Excel upload error:", error);
    res.status(500).json({ error: "Internal server error during file upload" });
  }
});

export default router;
