import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

/**
 * Upload a file to a given URL using FormData (for S3 presigned URLs)
 * @param uploadUrl - The URL to upload the file to
 * @param formFields - The form fields to include with the upload
 * @param filePath - The path to the file to upload
 */
export async function uploadFile(
  uploadUrl: string,
  formFields: Record<string, string>,
  filePath: string,
): Promise<void> {
  // Read the file as a buffer
  const fileBuffer = await fs.promises.readFile(filePath);
  const fileName = filePath.split('/').pop() ?? 'file';
  
  // Create FormData and append fields
  const formData = new FormData();
  
  // Add all form fields first (order matters for S3)
  for (const [key, value] of Object.entries(formFields)) {
    formData.append(key, value);
  }
  
  // Add the file last (required by S3)
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, fileName);
  
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`Failed to upload file: ${response.status.toString()} ${response.statusText} - ${responseText}`);
  }
}

/**
 * Download a file from a given URL
 * @param url - The URL to download the file from
 * @param outputPath - The path to save the downloaded file
 */
export async function downloadFile(
  url: string,
  outputPath: string,
): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download. Status: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error('No body in response');
  }

  const fileStream = fs.createWriteStream(outputPath, { flags: 'w' });
  await finished(Readable.fromWeb(response.body).pipe(fileStream));
}
