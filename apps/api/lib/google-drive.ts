import { google, drive_v3 } from "googleapis";
import prisma from "@db/client";
import { createOAuth2Client } from "./google-calendar";

/**
 * Get an authenticated Google Drive client for a user
 */
export async function getDriveClient(userId: string): Promise<drive_v3.Drive | null> {
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

    return google.drive({ version: "v3", auth: oauth2Client });
  } catch (error) {
    console.error("Error creating drive client:", error);
    return null;
  }
}

/**
 * Fetch folders from Google Drive
 */
export async function getDriveFolders(userId: string): Promise<{ id: string; name: string }[] | null> {
  const drive = await getDriveClient(userId);
  if (!drive) return null;

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id, name)",
      orderBy: "name",
    });

    const files = response.data.files || [];
    return files.map(file => ({
      id: file.id || "",
      name: file.name || "",
    }));
  } catch (error) {
    console.error("Error fetching drive folders:", error);
    return null;
  }
}
