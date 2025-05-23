import fs from 'node:fs';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

/**
 * Upload a file to a given URL
 * @param uploadUrl - The URL to upload the file to
 * @param headers - The headers to send with the request
 * @param filePath - The path to the file to upload
 */
export async function uploadFile(
  uploadUrl: string,
  headers: Record<string, string>,
  filePath: string,
): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const response = await fetch(uploadUrl, {
    method: 'POST',
    body: fileStream,
    headers,
    duplex: 'half',
  });
  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
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
