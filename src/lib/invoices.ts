import { formatDate, getInitials } from './utils';
import type { FeeInvoice, FeePayment, School } from '../types/app';

interface BrandedInvoicePdfOptions {
  school: School;
  invoice: FeeInvoice;
  studentName: string;
  parentName?: string;
  parentPhone?: string;
  admissionNumber?: string;
  feeStructureName?: string;
  totalFee?: number;
  payments?: FeePayment[];
}

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
  alpha?: Uint8Array;
  format: 'jpeg' | 'raw';
}

interface PdfImages {
  background: PdfImage | null;
  headerTitle: PdfImage | null;
  logo: PdfImage | null;
  phoneIcon: PdfImage | null;
  signature: PdfImage | null;
}

function sanitizePdfText(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/[₹]/g, 'INR ')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .trim();
}

function formatPdfCurrency(amount: number | null | undefined) {
  return `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount ?? 0)}`;
}

function buildInstallments(amount: number, count = 3) {
  const baseAmount = Math.floor(amount / count);
  const remainder = amount - baseAmount * count;

  return Array.from({ length: count }, (_, index) => baseAmount + (index === count - 1 ? remainder : 0));
}

function getStoredInstallments(invoice: FeeInvoice) {
  return Array.isArray(invoice.installment_plan) && invoice.installment_plan.length > 0
    ? invoice.installment_plan
    : buildInstallments(invoice.amount_due).map((amount, index) => ({
        label: `Installment ${index + 1}`,
        due_date: '',
        amount,
      }));
}

function textWidth(value: string, size: number) {
  return sanitizePdfText(value).length * size * 0.52;
}

function hexToRgb(value: string | null | undefined, fallback: [number, number, number]) {
  const normalized = String(value ?? '').replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return fallback;

  return [
    parseInt(normalized.slice(0, 2), 16),
    parseInt(normalized.slice(2, 4), 16),
    parseInt(normalized.slice(4, 6), 16),
  ] as [number, number, number];
}

function pdfRgb([red, green, blue]: [number, number, number]) {
  return `${(red / 255).toFixed(3)} ${(green / 255).toFixed(3)} ${(blue / 255).toFixed(3)}`;
}

function wrapText(value: string | null | undefined, maxWidth: number, size: number, maxLines: number) {
  const words = sanitizePdfText(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];

  words.forEach((word) => {
    const currentLine = lines[lines.length - 1] ?? '';
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (!currentLine || textWidth(nextLine, size) <= maxWidth) {
      if (lines.length === 0) {
        lines.push(nextLine);
      } else {
        lines[lines.length - 1] = nextLine;
      }
      return;
    }

    if (lines.length < maxLines) {
      lines.push(word);
      return;
    }

    lines[lines.length - 1] = `${lines[lines.length - 1]} ${word}`;
  });

  while (lines.length < maxLines) {
    lines.push('');
  }

  return lines.slice(0, maxLines);
}

function drawTextLines(
  lines: string[],
  drawLine: (value: string, y: number) => void,
  startY: number,
  lineGap: number,
) {
  lines.filter(Boolean).forEach((line, index) => {
    drawLine(line, startY - index * lineGap);
  });
}

async function loadImageAsJpeg(url: string | null | undefined, preserveTransparency = false): Promise<PdfImage | null> {
  if (!url) return null;

  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Logo could not be loaded.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || 320;
    canvas.height = image.naturalHeight || 320;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    if (preserveTransparency) {
      const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = new Uint8Array(canvas.width * canvas.height * 3);
      const alpha = new Uint8Array(canvas.width * canvas.height);
      let hasAlpha = false;

      for (let sourceIndex = 0, rgbIndex = 0, alphaIndex = 0; sourceIndex < imageData.length; sourceIndex += 4) {
        rgb[rgbIndex] = imageData[sourceIndex];
        rgb[rgbIndex + 1] = imageData[sourceIndex + 1];
        rgb[rgbIndex + 2] = imageData[sourceIndex + 2];
        alpha[alphaIndex] = imageData[sourceIndex + 3];
        hasAlpha = hasAlpha || imageData[sourceIndex + 3] < 255;
        rgbIndex += 3;
        alphaIndex += 1;
      }

      return {
        data: rgb,
        alpha: hasAlpha ? alpha : undefined,
        width: canvas.width,
        height: canvas.height,
        format: 'raw',
      };
    }

    context.globalCompositeOperation = 'destination-over';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const [, base64] = dataUrl.split(',');
    const binary = atob(base64);
    const data = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      data[index] = binary.charCodeAt(index);
    }

    return {
      data,
      width: canvas.width,
      height: canvas.height,
      format: 'jpeg',
    };
  } catch {
    return null;
  }
}

async function loadThemedIconImage(url: string, color: [number, number, number]): Promise<PdfImage | null> {
  try {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Icon could not be loaded.'));
    });

    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || 512;
    canvas.height = image.naturalHeight || 512;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const rgb = new Uint8Array(canvas.width * canvas.height * 3);
    const alpha = new Uint8Array(canvas.width * canvas.height);

    for (let sourceIndex = 0, rgbIndex = 0, alphaIndex = 0; sourceIndex < imageData.length; sourceIndex += 4) {
      const luminance = imageData[sourceIndex] * 0.299 + imageData[sourceIndex + 1] * 0.587 + imageData[sourceIndex + 2] * 0.114;
      const sourceAlpha = imageData[sourceIndex + 3] / 255;
      const maskAlpha = Math.max(0, Math.min(255, Math.round((255 - luminance) * sourceAlpha)));
      rgb[rgbIndex] = color[0];
      rgb[rgbIndex + 1] = color[1];
      rgb[rgbIndex + 2] = color[2];
      alpha[alphaIndex] = maskAlpha;
      rgbIndex += 3;
      alphaIndex += 1;
    }

    return {
      data: rgb,
      alpha,
      width: canvas.width,
      height: canvas.height,
      format: 'raw',
    };
  } catch {
    return null;
  }
}

async function renderTransparentTextImage(
  value: string,
  color: [number, number, number],
  width: number,
  height: number,
  fontSize: number,
  fontWeight = 700,
): Promise<PdfImage | null> {
  try {
    await document.fonts?.ready;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return null;

    const textValue = sanitizePdfText(value);
    let nextFontSize = fontSize;
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    do {
      context.font = `${fontWeight} ${nextFontSize}px Fredoka, Nunito, sans-serif`;
      if (context.measureText(textValue).width <= width - 16 || nextFontSize <= 24) break;
      nextFontSize -= 1;
    } while (nextFontSize > 24);

    context.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    context.fillText(textValue, width / 2, height / 2 + 1);

    const imageData = context.getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);
    const alpha = new Uint8Array(width * height);
    let hasAlpha = false;

    for (let sourceIndex = 0, rgbIndex = 0, alphaIndex = 0; sourceIndex < imageData.length; sourceIndex += 4) {
      rgb[rgbIndex] = imageData[sourceIndex];
      rgb[rgbIndex + 1] = imageData[sourceIndex + 1];
      rgb[rgbIndex + 2] = imageData[sourceIndex + 2];
      alpha[alphaIndex] = imageData[sourceIndex + 3];
      hasAlpha = hasAlpha || imageData[sourceIndex + 3] < 255;
      rgbIndex += 3;
      alphaIndex += 1;
    }

    return {
      data: rgb,
      alpha: hasAlpha ? alpha : undefined,
      width,
      height,
      format: 'raw',
    };
  } catch {
    return null;
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function createPdf(contentStreams: string | string[], images: PdfImages) {
  const encoder = new TextEncoder();
  const streams = Array.isArray(contentStreams) ? contentStreams : [contentStreams];
  const pageIds = streams.map((_, index) => 3 + index);
  const contentIds = streams.map((_, index) => 3 + streams.length + index);
  const font1Id = 3 + streams.length * 2;
  const font2Id = font1Id + 1;
  const font3Id = font1Id + 2;
  let nextObjectId = font3Id + 1;
  const backgroundId = images.background ? nextObjectId++ : null;
  const headerTitleId = images.headerTitle ? nextObjectId++ : null;
  const headerTitleAlphaId = images.headerTitle?.alpha ? nextObjectId++ : null;
  const logoId = images.logo ? nextObjectId++ : null;
  const logoAlphaId = images.logo?.alpha ? nextObjectId++ : null;
  const phoneIconId = images.phoneIcon ? nextObjectId++ : null;
  const phoneIconAlphaId = images.phoneIcon?.alpha ? nextObjectId++ : null;
  const signatureId = images.signature ? nextObjectId++ : null;
  const signatureAlphaId = images.signature?.alpha ? nextObjectId++ : null;
  const watermarkId = images.logo ? nextObjectId++ : null;
  const backgroundStateId = images.background ? nextObjectId++ : null;
  const xObjects = [
    backgroundId ? `/Background ${backgroundId} 0 R` : null,
    headerTitleId ? `/HeaderTitle ${headerTitleId} 0 R` : null,
    logoId ? `/Logo ${logoId} 0 R` : null,
    phoneIconId ? `/PhoneIcon ${phoneIconId} 0 R` : null,
    signatureId ? `/Signature ${signatureId} 0 R` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const extGStates = [
    watermarkId ? `/Watermark ${watermarkId} 0 R` : null,
    backgroundStateId ? `/BackgroundSoft ${backgroundStateId} 0 R` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const xObjectResource = xObjects ? `/XObject << ${xObjects} >>` : '';
  const extGStateResource = extGStates ? `/ExtGState << ${extGStates} >>` : '';
  const resources = `/Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> ${xObjectResource} ${extGStateResource} >>`;
  const baseObjects: Array<string | Uint8Array> = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${streams.length} >>`,
  ];
  streams.forEach((_, index) => {
    baseObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${resources} /Contents ${contentIds[index]} 0 R >>`);
  });
  streams.forEach((stream) => {
    baseObjects.push(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}\nendstream`);
  });
  baseObjects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>',
  );
  const parts: Uint8Array[] = [];
  let byteLength = 0;
  const offsets = [0];
  const addPart = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    byteLength += bytes.length;
  };

  addPart('%PDF-1.4\n');
  baseObjects.forEach((object, index) => {
    offsets.push(byteLength);
    addPart(`${index + 1} 0 obj\n${object}\nendobj\n`);
  });

  function imageDictionary(image: PdfImage, alphaId: number | null) {
    const filter = image.format === 'jpeg' ? ' /Filter /DCTDecode' : '';
    const smask = alphaId ? ` /SMask ${alphaId} 0 R` : '';
    return `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8${filter}${smask} /Length ${image.data.length} >>`;
  }

  function alphaDictionary(alpha: Uint8Array, width: number, height: number) {
    return `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Length ${alpha.length} >>`;
  }

  if (images.background && backgroundId) {
    offsets.push(byteLength);
    addPart(`${backgroundId} 0 obj\n${imageDictionary(images.background, null)}\nstream\n`);
    addPart(images.background.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.headerTitle && headerTitleId) {
    offsets.push(byteLength);
    addPart(`${headerTitleId} 0 obj\n${imageDictionary(images.headerTitle, headerTitleAlphaId)}\nstream\n`);
    addPart(images.headerTitle.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.headerTitle?.alpha && headerTitleAlphaId) {
    offsets.push(byteLength);
    addPart(`${headerTitleAlphaId} 0 obj\n${alphaDictionary(images.headerTitle.alpha, images.headerTitle.width, images.headerTitle.height)}\nstream\n`);
    addPart(images.headerTitle.alpha);
    addPart('\nendstream\nendobj\n');
  }

  if (images.logo && logoId) {
    offsets.push(byteLength);
    addPart(`${logoId} 0 obj\n${imageDictionary(images.logo, logoAlphaId)}\nstream\n`);
    addPart(images.logo.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.logo?.alpha && logoAlphaId) {
    offsets.push(byteLength);
    addPart(`${logoAlphaId} 0 obj\n${alphaDictionary(images.logo.alpha, images.logo.width, images.logo.height)}\nstream\n`);
    addPart(images.logo.alpha);
    addPart('\nendstream\nendobj\n');
  }

  if (images.phoneIcon && phoneIconId) {
    offsets.push(byteLength);
    addPart(`${phoneIconId} 0 obj\n${imageDictionary(images.phoneIcon, phoneIconAlphaId)}\nstream\n`);
    addPart(images.phoneIcon.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.phoneIcon?.alpha && phoneIconAlphaId) {
    offsets.push(byteLength);
    addPart(`${phoneIconAlphaId} 0 obj\n${alphaDictionary(images.phoneIcon.alpha, images.phoneIcon.width, images.phoneIcon.height)}\nstream\n`);
    addPart(images.phoneIcon.alpha);
    addPart('\nendstream\nendobj\n');
  }

  if (images.signature && signatureId) {
    offsets.push(byteLength);
    addPart(`${signatureId} 0 obj\n${imageDictionary(images.signature, signatureAlphaId)}\nstream\n`);
    addPart(images.signature.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.signature?.alpha && signatureAlphaId) {
    offsets.push(byteLength);
    addPart(`${signatureAlphaId} 0 obj\n${alphaDictionary(images.signature.alpha, images.signature.width, images.signature.height)}\nstream\n`);
    addPart(images.signature.alpha);
    addPart('\nendstream\nendobj\n');
  }

  if (watermarkId) {
    offsets.push(byteLength);
    addPart(`${watermarkId} 0 obj\n<< /Type /ExtGState /ca 0.24 >>\nendobj\n`);
  }

  if (backgroundStateId) {
    offsets.push(byteLength);
    addPart(`${backgroundStateId} 0 obj\n<< /Type /ExtGState /ca 0.18 >>\nendobj\n`);
  }

  const xrefOffset = byteLength;
  const objectCount = offsets.length;
  addPart(`xref\n0 ${objectCount}\n0000000000 65535 f \n`);
  offsets.slice(1).forEach((offset) => {
    addPart(`${String(offset).padStart(10, '0')} 00000 n \n`);
  });
  addPart(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  return new Blob(
    parts.map((part) => part.buffer.slice(part.byteOffset, part.byteOffset + part.byteLength) as ArrayBuffer),
    { type: 'application/pdf' },
  );
}

export async function openBrandedInvoicePdf({
  school,
  invoice,
  studentName,
  parentName = 'Parent',
  parentPhone = 'Not set',
  admissionNumber = 'Not set',
  feeStructureName = 'School fee',
  totalFee,
  payments = [],
}: BrandedInvoicePdfOptions) {
  const settings = (school.settings ?? {}) as Record<string, unknown>;
  const grossFee = totalFee ?? invoice.amount_due;
  const paidAmount = invoice.amount_paid ?? 0;
  const discountAmount = Math.max(0, grossFee - invoice.amount_due);
  const balanceAmount = Math.max(0, invoice.amount_due - paidAmount);
  const invoicePayments = payments
    .filter((payment) => payment.fee_invoice_id === invoice.id)
    .sort((left, right) => left.payment_date.localeCompare(right.payment_date));
  const installments = getStoredInstallments(invoice);
  const background = await loadImageAsJpeg('/website-bg.avif');
  const logo = await loadImageAsJpeg(school.logo_url, true);
  const signatureUrl = typeof settings.invoice_signature_url === 'string' ? settings.invoice_signature_url : '';
  const signature = await loadImageAsJpeg(signatureUrl, true);
  const themePrimary = typeof settings.theme_primary_color === 'string' ? settings.theme_primary_color : school.primary_color;
  const themeSecondary = typeof settings.theme_secondary_color === 'string' ? settings.theme_secondary_color : school.secondary_color;
  const primaryRgb = hexToRgb(themePrimary, [90, 115, 93]);
  const headerTitle = await renderTransparentTextImage('CUDDLE CUB INTERNATIONAL PRE SCHOOL', primaryRgb, 900, 86, 54);
  const phoneIcon = await loadThemedIconImage('/telephone.png', primaryRgb);
  const secondaryRgb = hexToRgb(themeSecondary, [125, 190, 170]);
  const primary = pdfRgb(primaryRgb);
  const primarySoft = pdfRgb(primaryRgb.map((channel) => Math.round(255 - (255 - channel) * 0.14)) as [number, number, number]);
  const secondarySoft = pdfRgb(secondaryRgb.map((channel) => Math.round(255 - (255 - channel) * 0.12)) as [number, number, number]);
  const footerIconColor = primary;
  const footerTextColor = pdfRgb([55, 65, 81]);
  const footerBorderColor = pdfRgb([221, 231, 221]);
  const commands: string[] = [];
  const footerCommands: string[] = [];
  let activeCommands = commands;

  function text(value: string | number | null | undefined, x: number, y: number, size = 10, font = 'F1') {
    activeCommands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${sanitizePdfText(value)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 1) {
    activeCommands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function polyline(points: Array<[number, number]>, width = 1) {
    if (points.length < 2) return;
    const [startX, startY] = points[0];
    activeCommands.push(`${width} w ${startX} ${startY} m ${points.slice(1).map(([x, y]) => `${x} ${y} l`).join(' ')} S`);
  }

  function rect(x: number, y: number, width: number, height: number) {
    activeCommands.push(`${x} ${y} ${width} ${height} re S`);
  }

  function fillRect(x: number, y: number, width: number, height: number) {
    activeCommands.push(`${x} ${y} ${width} ${height} re f`);
  }

  function fillStrokeRect(x: number, y: number, width: number, height: number) {
    activeCommands.push(`${x} ${y} ${width} ${height} re B`);
  }

  function roundedPlaceholder(x: number, y: number, width: number, height: number, label: string) {
    activeCommands.push(`${primarySoft} rg ${primary} RG`);
    fillStrokeRect(x, y, width, height);
    activeCommands.push(`${primary} rg`);
    centered(label, x + width / 2, y + height / 2 - 5, 18, 'F2');
    activeCommands.push('0.10 0.14 0.22 rg 0.10 0.14 0.22 RG');
  }

  function ellipse(cx: number, cy: number, rx: number, ry: number) {
    const kappa = 0.5522847498;
    activeCommands.push(
      `${cx + rx} ${cy} m ` +
        `${cx + rx} ${cy + ry * kappa} ${cx + rx * kappa} ${cy + ry} ${cx} ${cy + ry} c ` +
        `${cx - rx * kappa} ${cy + ry} ${cx - rx} ${cy + ry * kappa} ${cx - rx} ${cy} c ` +
        `${cx - rx} ${cy - ry * kappa} ${cx - rx * kappa} ${cy - ry} ${cx} ${cy - ry} c ` +
        `${cx + rx * kappa} ${cy - ry} ${cx + rx} ${cy - ry * kappa} ${cx + rx} ${cy} c S`,
    );
  }

  function image(name: string, x: number, y: number, width: number, height: number) {
    activeCommands.push(`q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`);
  }

  function pageBackground() {
    if (background) {
      activeCommands.push('q /BackgroundSoft gs');
      image('Background', 0, 0, 595, 842);
      activeCommands.push('Q');
      activeCommands.push('0.10 0.14 0.22 RG 0.10 0.14 0.22 rg');
      return;
    }

    activeCommands.push('1 1 1 rg 0 0 595 842 re f');
  }

  function centered(value: string, centerX: number, y: number, size = 10, font = 'F1') {
    text(value, centerX - textWidth(value, size) / 2, y, size, font);
  }

  function centeredFit(value: string, centerX: number, y: number, maxWidth: number, size = 10, font = 'F1', minSize = 7) {
    let nextSize = size;
    while (textWidth(value, nextSize) > maxWidth && nextSize > minSize) {
      nextSize -= 1;
    }
    centered(value, centerX, y, nextSize, font);
  }

  function field(label: string, value: string, x: number, y: number, valueX = 92) {
    text(`${label}:`, x, y, 10.5, 'F2');
    text(value, x + valueX, y, 10.5, 'F1');
  }

  function contactIcon(kind: 'web' | 'phone' | 'email', x: number, y: number) {
    activeCommands.push(`${footerIconColor} RG`);
    if (kind === 'web') {
      ellipse(x + 7, y + 3, 7, 7);
      ellipse(x + 7, y + 3, 3.2, 7);
      line(x, y + 3, x + 14, y + 3, 0.8);
      line(x + 1.7, y + 7, x + 12.3, y + 7, 0.7);
      line(x + 1.7, y - 1, x + 12.3, y - 1, 0.7);
      return;
    }

    if (kind === 'phone') {
      if (phoneIcon) {
        image('PhoneIcon', x - 1, y - 3, 16, 16);
        return;
      }
      activeCommands.push('1.25 w');
      activeCommands.push(
        `${x + 2.2} ${y + 8.8} m ` +
          `${x + 4.8} ${y + 11.6} ${x + 9.8} ${y + 11.8} ${x + 12.4} ${y + 9.0} c ` +
          `${x + 13.0} ${y + 8.3} ${x + 12.8} ${y + 7.5} ${x + 12.1} ${y + 6.9} c ` +
          `${x + 11.4} ${y + 6.3} ${x + 10.6} ${y + 6.2} ${x + 9.8} ${y + 6.7} c ` +
          `${x + 8.4} ${y + 5.5} ${x + 6.9} ${y + 4.0} ${x + 5.7} ${y + 2.6} c ` +
          `${x + 6.2} ${y + 1.8} ${x + 6.1} ${y + 1.0} ${x + 5.5} ${y + 0.3} c ` +
          `${x + 4.9} ${y - 0.4} ${x + 4.1} ${y - 0.6} ${x + 3.4} ${y} c ` +
          `${x + 0.6} ${y + 2.6} ${x + 0.3} ${y + 6.2} ${x + 2.2} ${y + 8.8} c S`,
      );
      return;
    }

    rect(x, y - 2, 14, 10);
    line(x, y + 8, x + 7, y + 2, 0.8);
    line(x + 14, y + 8, x + 7, y + 2, 0.8);
    line(x, y - 2, x + 5.3, y + 2.2, 0.8);
    line(x + 14, y - 2, x + 8.7, y + 2.2, 0.8);
  }

  function iconContact(kind: 'web' | 'phone' | 'email', value: string, x: number, y: number, size = 9.5) {
    contactIcon(kind, x, y);
    activeCommands.push(`${footerTextColor} rg ${footerTextColor} RG`);
    text(value, x + 20, y + 1, size, 'F1');
  }

  pageBackground();
  commands.push('0.10 0.14 0.22 RG');
  if (logo) {
    image('Logo', 40, 735, 65, 65);
  } else {
    roundedPlaceholder(40, 735, 65, 65, getInitials(school.name));
  }

  if (headerTitle) {
    image('HeaderTitle', 120, 776, 355, 34);
  } else {
    commands.push('0.345 0.435 0.353 rg');
    centeredFit('CUDDLE CUB INTERNATIONAL PRE SCHOOL', 297.5, 782, 355, 22, 'F2', 15);
  }
  commands.push('0.10 0.14 0.22 rg');
  drawTextLines(wrapText(school.address ?? 'Address', 355, 11, 3), (lineValue, y) => centeredFit(lineValue, 297.5, y, 355, 11, 'F1', 8.5), 755, 15.5);
  commands.push(`${primary} RG`);
  line(40, 714, 555, 714, 0.8);

  commands.push('1 1 1 rg 0.82 0.89 0.86 RG');
  fillStrokeRect(54, 70, 487, 626);
  commands.push('0.10 0.14 0.22 RG 0.10 0.14 0.22 rg');
  if (logo) {
    commands.push('q /Watermark gs');
    image('Logo', 72, 126, 452, 452);
    commands.push('Q');
  }

  field('Student Name', studentName, 72, 666, 112);
  field('Parent Name', parentName, 72, 644, 112);
  field('Parent Phone', parentPhone, 72, 622, 112);
  field('Program', feeStructureName, 72, 600, 112);
  field('Date', formatDate(invoice.due_date), 330, 666, 88);
  field('Receipt No.', invoice.receipt_number ?? invoice.invoice_number, 330, 644, 88);
  field('Admission No.', admissionNumber, 330, 622, 88);

  commands.push(`${primarySoft} rg 0.70 0.82 0.74 RG`);
  fillStrokeRect(72, 448, 450, 84);
  commands.push('0.88 0.94 0.90 RG');
  line(297, 448, 297, 532, 1);
  line(72, 504, 522, 504, 0.8);
  line(72, 476, 522, 476, 0.8);
  commands.push('0.10 0.14 0.22 rg 0.10 0.14 0.22 RG');
  text('Total fee:', 92, 512, 11, 'F2');
  text(formatPdfCurrency(grossFee), 318, 512, 11, 'F1');
  text('Discount:', 92, 484, 11, 'F2');
  text(formatPdfCurrency(discountAmount), 318, 484, 11, 'F1');
  text('Fee to be paid:', 92, 456, 11, 'F2');
  text(formatPdfCurrency(invoice.amount_due), 318, 456, 11, 'F1');

  text('Installment schedule', 72, 416, 12, 'F2');
  const visibleInstallments = installments.slice(0, 5);
  const installmentTop = 398;
  const installmentHeight = 28 + Math.max(1, visibleInstallments.length) * 20;
  const installmentBottom = installmentTop - installmentHeight;
  commands.push(`${secondarySoft} rg 0.70 0.82 0.74 RG`);
  fillStrokeRect(72, installmentBottom, 450, installmentHeight);
  commands.push(`${primary} rg`);
  fillRect(72, installmentTop - 28, 450, 28);
  commands.push('1 1 1 rg');
  text('Installment', 92, installmentTop - 18, 9.5, 'F2');
  text('Amount', 318, installmentTop - 18, 9.5, 'F2');
  commands.push('0.70 0.82 0.74 RG');
  line(297, installmentBottom, 297, installmentTop, 0.8);
  line(72, installmentTop - 28, 522, installmentTop - 28, 0.8);
  visibleInstallments.forEach((installment, index) => {
    const y = installmentTop - 44 - index * 20;
    if (index > 0) {
      line(72, y + 13, 522, y + 13, 0.6);
    }
    commands.push('0.10 0.14 0.22 rg');
    text(`${installment.label}${installment.due_date ? ` - ${formatDate(installment.due_date)}` : ''}`, 92, y, 9.5, 'F1');
    text(formatPdfCurrency(installment.amount), 318, y, 9.5, 'F1');
  });
  const balanceTop = installmentBottom - 8;
  commands.push(`${primarySoft} rg 0.70 0.82 0.74 RG`);
  fillStrokeRect(72, balanceTop - 28, 450, 28);
  line(297, balanceTop - 28, 297, balanceTop, 0.8);
  commands.push('0.10 0.14 0.22 rg 0.10 0.14 0.22 RG');
  text('Amount balance:', 92, balanceTop - 18, 10.5, 'F2');
  text(formatPdfCurrency(balanceAmount), 318, balanceTop - 18, 10.5, 'F1');

  let footerY = 140;
  if (invoicePayments.length > 0) {
    const maxPaymentRows = Math.max(0, Math.min(3, Math.floor((balanceTop - 52 - 166 - 24) / 18)));
    const paymentRows = invoicePayments.slice(0, maxPaymentRows);
    const paymentTop = balanceTop - 52;
    const paymentHeight = 24 + paymentRows.length * 18;
    const paymentBottom = paymentTop - paymentHeight;
    if (paymentRows.length > 0) {
      text('Payment history', 72, paymentTop + 13, 11, 'F2');
      commands.push(`${secondarySoft} rg 0.70 0.82 0.74 RG`);
      fillStrokeRect(72, paymentBottom, 450, paymentHeight);
      commands.push(`${primary} rg`);
      fillRect(72, paymentTop - 24, 450, 24);
      commands.push('1 1 1 rg');
      text('Date', 88, paymentTop - 15, 8, 'F2');
      text('Mode', 190, paymentTop - 15, 8, 'F2');
      text('Amount', 304, paymentTop - 15, 8, 'F2');
      text('Status', 420, paymentTop - 15, 8, 'F2');
      commands.push('0.70 0.82 0.74 RG');
      line(174, paymentBottom, 174, paymentTop, 0.6);
      line(288, paymentBottom, 288, paymentTop, 0.6);
      line(404, paymentBottom, 404, paymentTop, 0.6);
      paymentRows.forEach((payment, index) => {
        const y = paymentTop - 39 - index * 18;
        commands.push('0.10 0.14 0.22 rg');
        text(formatDate(payment.payment_date), 88, y, 8, 'F1');
        text(payment.payment_mode.split('_').join(' '), 190, y, 8, 'F1');
        text(formatPdfCurrency(payment.amount), 304, y, 8, 'F1');
        text(payment.status.split('_').join(' '), 420, y, 8, 'F1');
      });
      text(`Received total payment: ${formatPdfCurrency(paidAmount)}`, 72, paymentBottom - 18, 10, 'F2');
    }
  }

  if (footerY < 92) {
    activeCommands = footerCommands;
    pageBackground();
    footerCommands.push('0.10 0.14 0.22 RG');
    footerCommands.push('0.10 0.14 0.22 rg');
    if (logo) {
      footerCommands.push('q /Watermark gs');
      image('Logo', 155, 250, 290, 290);
      footerCommands.push('Q');
    }
    footerY = 680;
  }

  text('Note', 72, footerY, 10.5, 'F2');
  drawTextLines(
    wrapText('This fee invoice is issued by the school office. Please keep it for your records and contact the office for any correction.', 270, 9, 3),
    (lineValue, y) => text(lineValue, 72, y, 8.5, 'F1'),
    footerY - 16,
    12,
  );
  if (signature) {
    image('Signature', 390, 116, 120, 38);
  }
  centered('Signature / Seal', 450, 92, 10, 'F2');

  const footerSize = 9.5;
  const websiteText = 'cuddlecubpreschool.com';
  const phoneText = school.contact_phone || '-';
  const emailText = school.contact_email || '-';
  const itemGap = 16;
  const separatorGap = 8;
  const iconWidth = 16;
  const iconTextGap = 4;
  const websiteWidth = iconWidth + iconTextGap + textWidth(websiteText, footerSize);
  const phoneWidth = iconWidth + iconTextGap + textWidth(phoneText, footerSize);
  const emailWidth = iconWidth + iconTextGap + textWidth(emailText, footerSize);
  const separatorWidth = textWidth('|', footerSize);
  const footerTotalWidth = websiteWidth + phoneWidth + emailWidth + separatorWidth * 2 + (itemGap + separatorGap * 2) * 2;
  const footerStartX = 297.5 - footerTotalWidth / 2;
  const footerBaselineY = 36;
  let footerX = footerStartX;

  commands.push(`${footerBorderColor} RG`);
  line(72, 54, 522, 54, 0.8);
  iconContact('web', websiteText, footerX, footerBaselineY, footerSize);
  footerX += websiteWidth + itemGap;
  activeCommands.push(`${footerTextColor} rg`);
  text('|', footerX, footerBaselineY + 1, footerSize, 'F1');
  footerX += separatorWidth + separatorGap;
  iconContact('phone', phoneText, footerX, footerBaselineY, footerSize);
  footerX += phoneWidth + itemGap;
  activeCommands.push(`${footerTextColor} rg`);
  text('|', footerX, footerBaselineY + 1, footerSize, 'F1');
  footerX += separatorWidth + separatorGap;
  iconContact('email', emailText, footerX, footerBaselineY, footerSize);

  const pageStreams = footerCommands.length > 0 ? [commands.join('\n'), footerCommands.join('\n')] : commands.join('\n');
  const pdf = createPdf(pageStreams, { background, headerTitle, logo, phoneIcon, signature });
  downloadBlob(pdf, `${invoice.invoice_number || 'invoice'}.pdf`);
}
