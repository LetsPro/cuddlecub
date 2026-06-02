import { formatDate } from './utils';
import type { FeeInvoice, FeePayment, School } from '../types/app';

interface BrandedInvoicePdfOptions {
  school: School;
  invoice: FeeInvoice;
  studentName: string;
  parentName?: string;
  admissionNumber?: string;
  feeStructureName?: string;
  totalFee?: number;
  payments?: FeePayment[];
}

interface PdfImage {
  data: Uint8Array;
  width: number;
  height: number;
}

interface PdfImages {
  logo: PdfImage | null;
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

async function loadImageAsJpeg(url: string | null | undefined): Promise<PdfImage | null> {
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
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
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
  const logoId = images.logo ? nextObjectId++ : null;
  const signatureId = images.signature ? nextObjectId++ : null;
  const watermarkId = images.logo || images.signature ? nextObjectId++ : null;
  const xObjects = [
    logoId ? `/Logo ${logoId} 0 R` : null,
    signatureId ? `/Signature ${signatureId} 0 R` : null,
  ]
    .filter(Boolean)
    .join(' ');
  const extGState = watermarkId ? `/ExtGState << /Watermark ${watermarkId} 0 R >>` : '';
  const resources = xObjects
    ? `/Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> /XObject << ${xObjects} >> ${extGState} >>`
    : `/Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> >>`;
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

  if (images.logo && logoId) {
    offsets.push(byteLength);
    addPart(`${logoId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${images.logo.width} /Height ${images.logo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${images.logo.data.length} >>\nstream\n`);
    addPart(images.logo.data);
    addPart('\nendstream\nendobj\n');
  }

  if (images.signature && signatureId) {
    offsets.push(byteLength);
    addPart(`${signatureId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${images.signature.width} /Height ${images.signature.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${images.signature.data.length} >>\nstream\n`);
    addPart(images.signature.data);
    addPart('\nendstream\nendobj\n');
  }

  if (watermarkId) {
    offsets.push(byteLength);
    addPart(`${watermarkId} 0 obj\n<< /Type /ExtGState /ca 0.24 >>\nendobj\n`);
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
  const logo = await loadImageAsJpeg(school.logo_url);
  const signatureUrl = typeof settings.invoice_signature_url === 'string' ? settings.invoice_signature_url : '';
  const signature = await loadImageAsJpeg(signatureUrl);
  const commands: string[] = [];
  const footerCommands: string[] = [];
  let activeCommands = commands;

  function text(value: string | number | null | undefined, x: number, y: number, size = 10, font = 'F1') {
    activeCommands.push(`BT /${font} ${size} Tf ${x} ${y} Td (${sanitizePdfText(value)}) Tj ET`);
  }

  function line(x1: number, y1: number, x2: number, y2: number, width = 1) {
    activeCommands.push(`${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
  }

  function rect(x: number, y: number, width: number, height: number) {
    activeCommands.push(`${x} ${y} ${width} ${height} re S`);
  }

  function image(name: string, x: number, y: number, width: number, height: number) {
    activeCommands.push(`q ${width} 0 0 ${height} ${x} ${y} cm /${name} Do Q`);
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

  function field(label: string, value: string, x: number, y: number) {
    text(label, x, y, 11, 'F2');
    text(value, x + 92, y, 11, 'F1');
  }

  commands.push('0.10 0.14 0.22 RG');
  if (logo) {
    commands.push('q /Watermark gs');
    image('Logo', 155, 250, 290, 290);
    commands.push('Q');
  }

  text('Fee Invoice', 456, 790, 14, 'F2');
  if (logo) {
    image('Logo', 54, 740, 74, 74);
  } else {
    rect(54, 740, 74, 74);
    text('LOGO', 77, 776, 10, 'F2');
  }
  commands.push('0.345 0.435 0.353 rg');
  centeredFit(school.name, 308, 754, 390, 21, 'F2', 14);
  commands.push('0.10 0.14 0.22 rg');
  centeredFit(school.address ?? 'Address', 308, 728, 400, 11, 'F1', 8);

  field('Student', studentName, 62, 676);
  field('Date', formatDate(invoice.due_date), 330, 676);
  field('Parent', parentName, 62, 648);
  field('Status', invoice.status.split('_').join(' '), 330, 648);
  field('Program', feeStructureName, 62, 620);
  field('Receipt No.', invoice.receipt_number ?? invoice.invoice_number, 62, 592);
  field('Admission No.', admissionNumber, 62, 564);

  rect(62, 432, 476, 92);
  line(300, 432, 300, 524, 1);
  line(62, 494, 538, 494, 1);
  line(62, 462, 538, 462, 1);
  text('Total fee', 82, 504, 13, 'F2');
  text(formatPdfCurrency(grossFee), 326, 504, 13, 'F2');
  text('Discount', 82, 473, 13, 'F2');
  text(formatPdfCurrency(discountAmount), 326, 473, 13, 'F2');
  text('Fee to be paid', 82, 442, 13, 'F2');
  text(formatPdfCurrency(invoice.amount_due), 326, 442, 13, 'F2');

  text('Installment schedule', 62, 398, 12, 'F2');
  const visibleInstallments = installments.slice(0, 5);
  const installmentTop = 380;
  const installmentHeight = 28 + Math.max(1, visibleInstallments.length) * 22;
  const installmentBottom = installmentTop - installmentHeight;
  rect(62, installmentBottom, 476, installmentHeight);
  line(300, installmentBottom, 300, installmentTop, 1);
  line(62, installmentTop - 28, 538, installmentTop - 28, 1);
  visibleInstallments.forEach((installment, index) => {
    const y = installmentTop - 46 - index * 22;
    if (index > 0) {
      line(62, y + 14, 538, y + 14, 0.8);
    }
    text(`${installment.label}${installment.due_date ? ` - ${formatDate(installment.due_date)}` : ''}`, 82, y, 11, 'F1');
    text(formatPdfCurrency(installment.amount), 326, y, 11, 'F1');
  });
  const balanceTop = installmentBottom - 2;
  rect(62, balanceTop - 32, 476, 32);
  line(300, balanceTop - 32, 300, balanceTop, 1);
  text('Amount balance', 82, balanceTop - 20, 12, 'F2');
  text(formatPdfCurrency(balanceAmount), 326, balanceTop - 20, 12, 'F2');

  let footerY = balanceTop - 64;
  if (invoicePayments.length > 0) {
    const paymentRows = invoicePayments.slice(0, 4);
    const paymentTop = balanceTop - 64;
    const paymentHeight = 28 + paymentRows.length * 20;
    const paymentBottom = paymentTop - paymentHeight;
    text('Payment history', 62, paymentTop + 16, 12, 'F2');
    rect(62, paymentBottom, 476, paymentHeight);
    line(62, paymentTop - 28, 538, paymentTop - 28, 1);
    line(180, paymentBottom, 180, paymentTop, 0.8);
    line(300, paymentBottom, 300, paymentTop, 0.8);
    line(420, paymentBottom, 420, paymentTop, 0.8);
    text('Date', 78, paymentTop - 18, 9, 'F2');
    text('Mode', 196, paymentTop - 18, 9, 'F2');
    text('Amount', 316, paymentTop - 18, 9, 'F2');
    text('Status', 436, paymentTop - 18, 9, 'F2');
    paymentRows.forEach((payment, index) => {
      const y = paymentTop - 48 - index * 20;
      text(formatDate(payment.payment_date), 78, y, 9, 'F1');
      text(payment.payment_mode.split('_').join(' '), 196, y, 9, 'F1');
      text(formatPdfCurrency(payment.amount), 316, y, 9, 'F1');
      text(payment.status.split('_').join(' '), 436, y, 9, 'F1');
    });
    text(`Received total payment of ${formatPdfCurrency(paidAmount)}`, 62, paymentBottom - 28, 14, 'F2');
    footerY = paymentBottom - 64;
  }

  if (footerY < 92) {
    activeCommands = footerCommands;
    footerCommands.push('0.10 0.14 0.22 RG');
    footerCommands.push('0.10 0.14 0.22 rg');
    if (logo) {
      footerCommands.push('q /Watermark gs');
      image('Logo', 155, 250, 290, 290);
      footerCommands.push('Q');
    }
    footerY = 680;
  }

  text('Contact details', 62, footerY, 10, 'F2');
  text('Website: cuddlecubpreschool.com', 62, footerY - 16, 9, 'F1');
  text(school.contact_phone ? `Phone: ${school.contact_phone}` : 'Phone:', 62, footerY - 30, 9, 'F1');
  text(school.contact_email ? `Email: ${school.contact_email}` : 'Email:', 62, footerY - 44, 9, 'F1');
  if (signature) {
    image('Signature', 406, footerY - 8, 124, 46);
  }
  text('Signature / Seal', 426, footerY - 44, 10, 'F2');

  const pageStreams = footerCommands.length > 0 ? [commands.join('\n'), footerCommands.join('\n')] : commands.join('\n');
  const pdf = createPdf(pageStreams, { logo, signature });
  downloadBlob(pdf, `${invoice.invoice_number || 'invoice'}.pdf`);
}
