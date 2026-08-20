import assert from "node:assert/strict";
import test from "node:test";
import { storeInspectionPhotos } from "../lib/attachments";
import type { InspectionAttachmentRecord } from "../lib/domain";

test("alle nieuwe foto's worden ook bij het bijwerken van een keuring verwerkt", async () => {
  const storedNames: string[] = [];
  const photos = [
    { fileName: "voorzijde.jpg", contentType: "image/jpeg", buffer: Buffer.from("voorzijde") },
    { fileName: "typeplaatje.jpg", contentType: "image/jpeg", buffer: Buffer.from("typeplaatje") }
  ];

  const attachments = await storeInspectionPhotos(
    "inspection-1",
    photos,
    async (inspectionId, photo): Promise<InspectionAttachmentRecord> => {
      storedNames.push(photo.fileName);
      return {
        id: `${inspectionId}-${photo.fileName}`,
        inspectionId,
        kind: "photo",
        fileName: photo.fileName,
        storagePath: `inspections/${inspectionId}/photos/${photo.fileName}`,
        mimeType: "image/jpeg",
        createdAt: "2026-08-20T00:00:00.000Z"
      };
    }
  );

  assert.deepEqual(storedNames, ["voorzijde.jpg", "typeplaatje.jpg"]);
  assert.equal(attachments.length, 2);
});

test("een opslagfout wordt zichtbaar en niet stil genegeerd", async () => {
  await assert.rejects(
    () =>
      storeInspectionPhotos(
        "inspection-1",
        [{ fileName: "foto.jpg", contentType: "image/jpeg", buffer: Buffer.from("foto") }],
        async () => {
          throw new Error("opslag geweigerd");
        }
      ),
    /opslag geweigerd/
  );
});
