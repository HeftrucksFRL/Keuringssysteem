import sharp from "sharp";

export async function compressImageToTarget(
  input: Buffer,
  targetKilobytes = 300
) {
  let quality = 82;
  let output = await sharp(input)
    .rotate()
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();

  while (output.byteLength / 1024 > targetKilobytes && quality > 45) {
    quality -= 7;
    output = await sharp(input)
      .rotate()
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }

  return output;
}
