import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

/**
 * Generate Invoice PDF for Order
 * Creates a professional GST invoice with order details
 * @param {Object} order - Order object with populated user
 * @returns {Promise<string>} - Path to generated PDF file
 */
export const generateInvoice = async (order) => {
  return new Promise((resolve, reject) => {
    try {
      // Create invoices directory if it doesn't exist
      const invoicesDir = path.join(process.cwd(), 'invoices');
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir, { recursive: true });
      }

      // Generate invoice number if not exists
      const invoiceNumber = order.invoiceNumber || `INV-${order.orderNumber}`;
      const fileName = `${invoiceNumber}.pdf`;
      const filePath = path.join(invoicesDir, fileName);

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header - Company Info
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('HYUNDAI SPARES', 50, 50);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Authorized Spare Parts Dealer', 50, 75)
        .text('123 Auto Parts Street, Mumbai, Maharashtra 400001', 50, 90)
        .text('Phone: +91 98765 43210', 50, 105)
        .text('Email: info@hyundaispares.com', 50, 120)
        .text('GSTIN: 27AABCU9603R1ZM', 50, 135);

      // Invoice Title
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text('TAX INVOICE', 400, 50, { align: 'right' });

      // Invoice Details Box
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Invoice No: ${invoiceNumber}`, 400, 75, { align: 'right' })
        .text(`Order No: ${order.orderNumber}`, 400, 90, { align: 'right' })
        .text(`Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')}`, 400, 105, { align: 'right' })
        .text(`Payment: ${order.paymentMethod}`, 400, 120, { align: 'right' });

      // Line separator
      doc
        .moveTo(50, 160)
        .lineTo(545, 160)
        .stroke();

      // Billing Information
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Bill To:', 50, 180);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(order.user.name, 50, 200)
        .text(order.user.email, 50, 215)
        .text(`Phone: ${order.shippingAddress.phone}`, 50, 230);

      // Shipping Address
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Ship To:', 50, 255);

      doc
        .fontSize(10)
        .font('Helvetica')
        .text(order.shippingAddress.street, 50, 275)
        .text(`${order.shippingAddress.city}, ${order.shippingAddress.state}`, 50, 290)
        .text(`PIN: ${order.shippingAddress.pincode}`, 50, 305);

      // Table Header
      const tableTop = 350;
      doc
        .fontSize(10)
        .font('Helvetica-Bold');

      doc
        .text('Item', 50, tableTop)
        .text('Part No.', 200, tableTop)
        .text('Qty', 300, tableTop, { width: 50, align: 'center' })
        .text('Price', 360, tableTop, { width: 80, align: 'right' })
        .text('Amount', 450, tableTop, { width: 95, align: 'right' });

      // Line under header
      doc
        .moveTo(50, tableTop + 15)
        .lineTo(545, tableTop + 15)
        .stroke();

      // Table Items
      let yPosition = tableTop + 25;
      doc.font('Helvetica');

      order.items.forEach((item, index) => {
        // Check if we need a new page
        if (yPosition > 700) {
          doc.addPage();
          yPosition = 50;
        }

        doc
          .fontSize(9)
          .text(item.name.substring(0, 30), 50, yPosition, { width: 140 })
          .text(item.partNumber, 200, yPosition)
          .text(item.quantity.toString(), 300, yPosition, { width: 50, align: 'center' })
          .text(`₹${item.price.toFixed(2)}`, 360, yPosition, { width: 80, align: 'right' })
          .text(`₹${item.subtotal.toFixed(2)}`, 450, yPosition, { width: 95, align: 'right' });

        yPosition += 25;
      });

      // Summary section
      yPosition += 10;
      doc
        .moveTo(50, yPosition)
        .lineTo(545, yPosition)
        .stroke();

      yPosition += 15;

      // Subtotal
      doc
        .fontSize(10)
        .font('Helvetica')
        .text('Subtotal:', 360, yPosition)
        .text(`₹${order.subtotal.toFixed(2)}`, 450, yPosition, { width: 95, align: 'right' });

      yPosition += 20;

      // Shipping
      doc
        .text('Shipping:', 360, yPosition)
        .text(`₹${order.shippingCharges.toFixed(2)}`, 450, yPosition, { width: 95, align: 'right' });

      yPosition += 20;

      // Tax
      doc
        .text(`GST (${order.taxPercentage}%):`, 360, yPosition)
        .text(`₹${order.tax.toFixed(2)}`, 450, yPosition, { width: 95, align: 'right' });

      yPosition += 20;

      // Total
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Total Amount:', 360, yPosition)
        .text(`₹${order.totalAmount.toFixed(2)}`, 450, yPosition, { width: 95, align: 'right' });

      // Footer
      const footerTop = 720;
      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .text(
          'Thank you for your business!',
          50,
          footerTop,
          { align: 'center', width: 495 }
        )
        .text(
          'This is a computer-generated invoice and does not require a signature.',
          50,
          footerTop + 15,
          { align: 'center', width: 495 }
        );

      // Finalize PDF
      doc.end();

      // Wait for stream to finish
      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Delete Invoice File
 * @param {string} filePath - Path to invoice file
 */
export const deleteInvoice = async (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`Invoice deleted: ${filePath}`);
    }
  } catch (error) {
    console.error(`Error deleting invoice: ${error.message}`);
  }
};
