import 'dotenv/config';
import OpenAI from 'openai';
import {
    getServiceAccountAccessToken,
    listFilesRecursively,
    downloadFile,
    exportGoogleDoc,
    isGoogleDocMime
} from '../src/gdrive';

// Supported mime types for OpenAI Vector Stores
const SUPPORTED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'text/plain',
    'text/markdown',
];

async function main() {
    const driveEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
    const driveKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const folderId = process.env.GOOGLE_DRIVE_TARGET_FOLDER_ID;
    const openaiApiKey = process.env.OPENAI_API_KEY;
    let vectorStoreId = process.env.OPENAI_VECTOR_STORE_AUTHORITIES_ID;

    if (!driveEmail || !driveKey || !folderId || !openaiApiKey) {
        console.error('Missing environment variables.');
        process.exit(1);
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });

    // 1. Authenticate Google Drive
    console.log(`Authenticating with Google Drive (${driveEmail})...`);
    const accessToken = await getServiceAccountAccessToken(driveEmail, driveKey);

    // 2. List Files
    console.log(`Scanning Google Drive folder ${folderId}...`);
    const files = await listFilesRecursively(accessToken, folderId);
    console.log(`Found ${files.length} items.`);

    // Helper to access vector store API
    const vectorStoresApi = openai.beta?.vectorStores || (openai as any).vectorStores;
    if (!vectorStoresApi) {
        throw new Error('OpenAI Vector Store API not found on client.');
    }

    // 4. Create or Update Vector Store EARLY
    if (!vectorStoreId || vectorStoreId === 'vs_test') {
        console.log('Creating new Vector Store...');
        const vectorStore = await vectorStoresApi.create({
            name: 'LawAI Drive Knowledge Base',
        });
        vectorStoreId = vectorStore.id;
        console.log(`Created Vector Store: ${vectorStoreId}`);
        console.log(`IMPORTANT: Update .env with OPENAI_VECTOR_STORE_AUTHORITIES_ID=${vectorStoreId}`);
    } else {
        console.log(`Using existing Vector Store: ${vectorStoreId}`);
    }

    // 3. Process Files in Batches
    const BATCH_SIZE = 20;
    let currentBatchIds: string[] = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.id || !file.name || !file.mimeType) continue;

        let fileContent: Uint8Array | null = null;
        let fileName = file.name;
        const isGDoc = isGoogleDocMime(file.mimeType);

        try {
            if (isGDoc) {
                if (isGDoc === 'document') {
                    console.log(`Exporting Google Doc [${i + 1}/${files.length}]: ${file.name}`);
                    const exported = await exportGoogleDoc(accessToken, file.id, 'document');
                    if (exported) {
                        fileContent = exported.data;
                        fileName = `${file.name}.html`;
                    }
                } else {
                    console.log(`Exporting Google File [${i + 1}/${files.length}]: ${file.name}`);
                    const type = isGDoc;
                    const exported = await exportGoogleDoc(accessToken, file.id, type);
                    if (exported) {
                        fileContent = exported.data;
                        fileName = `${file.name}.${exported.mimeType === 'text/csv' ? 'csv' : 'pdf'}`;
                    }
                }
            } else if (SUPPORTED_MIME_TYPES.includes(file.mimeType)) {
                console.log(`Downloading [${i + 1}/${files.length}]: ${file.name} (${file.mimeType})`);
                const downloaded = await downloadFile(accessToken, file.id);
                if (downloaded) {
                    fileContent = downloaded.data;
                }
            } else {
                // console.log(`Skipping unsupported type: ${file.name} (${file.mimeType})`);
                continue;
            }

            if (fileContent) {
                // Upload to OpenAI Files
                const openaiFile = await openai.files.create({
                    file: new File([fileContent], fileName),
                    purpose: 'assistants',
                });
                // console.log(`Uploaded: ${fileName} (${openaiFile.id})`);
                currentBatchIds.push(openaiFile.id);
            }
        } catch (e) {
            console.error(`Failed to process ${fileName}:`, e);
        }

        // Process Batch
        if (currentBatchIds.length >= BATCH_SIZE || (i === files.length - 1 && currentBatchIds.length > 0)) {
            console.log(`Adding batch of ${currentBatchIds.length} files to Vector Store...`);
            try {
                await vectorStoresApi.fileBatches.createAndPoll(vectorStoreId, {
                    file_ids: currentBatchIds,
                });
                console.log(`Batch complete.`);
                currentBatchIds = []; // Reset batch
            } catch (err) {
                console.error('Failed to add batch to vector store:', err);
            }
        }
    }

    console.log('Ingestion complete.');
}

main();
