import { google, sheets_v4 } from "googleapis";
import prisma from "@db/client";
import { createOAuth2Client } from "./google-calendar";

/**
 * Get an authenticated Google Sheets client for a user
 */
export async function getSheetsClient(userId: string): Promise<sheets_v4.Sheets | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleRefreshToken: true },
  });

  if (!user?.googleRefreshToken) {
    return null;
  }

  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials({
      refresh_token: user.googleRefreshToken,
    });

    return google.sheets({ version: "v4", auth: oauth2Client });
  } catch (error) {
    console.error("Error creating sheets client:", error);
    return null;
  }
}

/**
 * Read data from a specific Google Sheet
 */
export async function readSheetData(
  userId: string,
  spreadsheetId: string,
  range: string
): Promise<string[][] | null> {
  const sheets = await getSheetsClient(userId);
  if (!sheets) return null;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || null;
  } catch (error) {
    console.error("Error reading sheet data:", error);
    return null;
  }
}
