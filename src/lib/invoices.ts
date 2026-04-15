import { getKidsFontOption, getKidsFontStyle } from './branding';
import { getThemeColors } from './theme';
import { formatCurrency, formatDate } from './utils';
import type { FeeInvoice, FeePayment, School } from '../types/app';

interface BrandedInvoicePdfOptions {
  school: School;
  invoice: FeeInvoice;
  studentName: string;
  payments?: FeePayment[];
}

function escapeHtml(value: string | null | undefined) {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openBrandedInvoicePdf({ school, invoice, studentName, payments = [] }: BrandedInvoicePdfOptions) {
  const invoiceWindow = window.open('', '_blank', 'width=960,height=1200');

  if (!invoiceWindow) {
    throw new Error('Allow pop-ups in the browser to generate the branded PDF invoice.');
  }

  const settings = (school.settings ?? {}) as Record<string, unknown>;
  const { primary, secondary } = getThemeColors(school);
  const fontOption = getKidsFontOption(getKidsFontStyle(settings));
  const balanceAmount = Math.max(0, invoice.amount_due - (invoice.amount_paid ?? 0));
  const paymentRows = payments
    .filter((payment) => payment.fee_invoice_id === invoice.id)
    .sort((left, right) => left.payment_date.localeCompare(right.payment_date));
  const paymentMarkup =
    paymentRows.length > 0
      ? paymentRows
          .map(
            (payment) => `
              <tr>
                <td>${escapeHtml(formatDate(payment.payment_date))}</td>
                <td>${escapeHtml(payment.payment_mode.split('_').join(' '))}</td>
                <td>${escapeHtml(formatCurrency(payment.amount))}</td>
                <td>${escapeHtml(payment.status.split('_').join(' '))}</td>
              </tr>
            `,
          )
          .join('')
      : `
        <tr>
          <td colspan="4" class="empty-state">No payments recorded yet for this invoice.</td>
        </tr>
      `;

  const documentTitle = `${invoice.invoice_number} - ${school.name}`;
  const logoMarkup = school.logo_url
    ? `<img alt="${escapeHtml(school.name)} logo" class="school-logo" src="${escapeHtml(school.logo_url)}" />`
    : `<div class="school-badge">${escapeHtml(
        school.name
          .split(' ')
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('') || 'SC',
      )}</div>`;

  invoiceWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(documentTitle)}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
        <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Fredoka:wght@400;500;600;700&family=Nunito:wght@400;600;700;800&family=Quicksand:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <style>
          :root {
            --invoice-primary: ${primary};
            --invoice-secondary: ${secondary};
            --invoice-display-font: ${fontOption.displayStack};
            --invoice-body-font: ${fontOption.bodyStack};
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 32px;
            font-family: var(--invoice-body-font);
            color: #1e293b;
            background:
              radial-gradient(circle at top left, color-mix(in srgb, var(--invoice-primary) 18%, white), transparent 26%),
              radial-gradient(circle at top right, color-mix(in srgb, var(--invoice-secondary) 18%, white), transparent 28%),
              linear-gradient(180deg, #fffaf5, #ffffff 42%, #f8fbff);
          }

          .sheet {
            max-width: 860px;
            margin: 0 auto;
            border-radius: 28px;
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.2);
            background: rgba(255, 255, 255, 0.96);
            box-shadow: 0 32px 80px -52px rgba(15, 23, 42, 0.32);
          }

          .hero {
            padding: 32px;
            color: white;
            background:
              radial-gradient(circle at top left, rgba(255, 255, 255, 0.24), transparent 26%),
              linear-gradient(135deg, var(--invoice-primary), var(--invoice-secondary));
          }

          .hero-top {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            align-items: flex-start;
          }

          .brand {
            display: flex;
            gap: 16px;
            align-items: center;
          }

          .school-logo,
          .school-badge {
            width: 72px;
            height: 72px;
            border-radius: 22px;
            object-fit: cover;
            background: rgba(255, 255, 255, 0.18);
            border: 1px solid rgba(255, 255, 255, 0.22);
          }

          .school-badge {
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--invoice-display-font);
            font-size: 26px;
            font-weight: 700;
          }

          .eyebrow,
          .label {
            text-transform: uppercase;
            letter-spacing: 0.18em;
            font-size: 11px;
            font-weight: 700;
          }

          .school-name,
          .invoice-title {
            margin: 8px 0 0;
            font-family: var(--invoice-display-font);
          }

          .school-name {
            font-size: 34px;
            line-height: 1.05;
          }

          .brand-meta,
          .invoice-meta {
            margin-top: 8px;
            font-size: 14px;
            line-height: 1.7;
            color: rgba(255, 255, 255, 0.9);
          }

          .invoice-card {
            min-width: 240px;
            padding: 18px 20px;
            border-radius: 24px;
            background: rgba(255, 255, 255, 0.16);
            backdrop-filter: blur(12px);
          }

          .invoice-title {
            font-size: 28px;
          }

          .content {
            padding: 32px;
          }

          .summary-grid,
          .meta-grid {
            display: grid;
            gap: 16px;
          }

          .summary-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .meta-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: 28px;
          }

          .summary-card,
          .meta-card {
            border-radius: 24px;
            padding: 18px 20px;
            border: 1px solid rgba(226, 232, 240, 0.88);
            background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.96));
          }

          .summary-value {
            margin-top: 10px;
            font-family: var(--invoice-display-font);
            font-size: 28px;
            color: #0f172a;
          }

          .meta-value {
            margin-top: 8px;
            font-size: 16px;
            font-weight: 700;
            color: #0f172a;
          }

          .section-title {
            margin: 32px 0 14px;
            font-family: var(--invoice-display-font);
            font-size: 24px;
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 22px;
            border: 1px solid rgba(226, 232, 240, 0.88);
          }

          th,
          td {
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid rgba(226, 232, 240, 0.72);
            font-size: 14px;
          }

          th {
            background: rgba(248, 250, 252, 0.96);
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.14em;
            color: #64748b;
          }

          tr:last-child td {
            border-bottom: none;
          }

          .empty-state {
            color: #64748b;
          }

          .footer-note {
            margin-top: 24px;
            border-radius: 24px;
            padding: 18px 20px;
            background: rgba(248, 250, 252, 0.92);
            color: #475569;
            font-size: 13px;
            line-height: 1.7;
          }

          @media print {
            body {
              padding: 0;
              background: white;
            }

            .sheet {
              border: none;
              box-shadow: none;
              border-radius: 0;
            }
          }
        </style>
      </head>
      <body>
        <main class="sheet">
          <section class="hero">
            <div class="hero-top">
              <div class="brand">
                ${logoMarkup}
                <div>
                  <div class="eyebrow">School Invoice</div>
                  <h1 class="school-name">${escapeHtml(school.name)}</h1>
                  <div class="brand-meta">
                    ${school.academic_year_label ? `${escapeHtml(school.academic_year_label)}<br />` : ''}
                    ${school.address ? `${escapeHtml(school.address)}<br />` : ''}
                    ${school.contact_phone ? `${escapeHtml(school.contact_phone)}<br />` : ''}
                    ${school.contact_email ? escapeHtml(school.contact_email) : ''}
                  </div>
                </div>
              </div>

              <div class="invoice-card">
                <div class="label">Invoice reference</div>
                <h2 class="invoice-title">${escapeHtml(invoice.invoice_number)}</h2>
                <div class="invoice-meta">
                  Status: ${escapeHtml(invoice.status.split('_').join(' '))}<br />
                  Due: ${escapeHtml(formatDate(invoice.due_date))}
                </div>
              </div>
            </div>
          </section>

          <section class="content">
            <div class="summary-grid">
              <div class="summary-card">
                <div class="label">Amount due</div>
                <div class="summary-value">${escapeHtml(formatCurrency(invoice.amount_due))}</div>
              </div>
              <div class="summary-card">
                <div class="label">Paid so far</div>
                <div class="summary-value">${escapeHtml(formatCurrency(invoice.amount_paid ?? 0))}</div>
              </div>
              <div class="summary-card">
                <div class="label">Balance</div>
                <div class="summary-value">${escapeHtml(formatCurrency(balanceAmount))}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-card">
                <div class="label">Student</div>
                <div class="meta-value">${escapeHtml(studentName)}</div>
              </div>
              <div class="meta-card">
                <div class="label">Font style</div>
                <div class="meta-value">${escapeHtml(fontOption.label)}</div>
              </div>
            </div>

            <h3 class="section-title">Payment history</h3>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Mode</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${paymentMarkup}
              </tbody>
            </table>

            <div class="footer-note">
              This branded invoice PDF uses your school logo, theme colors and selected kids font style from settings. Save the browser print dialog as PDF to download or share it.
            </div>
          </section>
        </main>
      </body>
    </html>
  `);

  invoiceWindow.document.close();
  invoiceWindow.onload = () => {
    window.setTimeout(() => {
      invoiceWindow.focus();
      invoiceWindow.print();
    }, 500);
  };
}
