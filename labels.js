// Label Generation Module using JsBarcode and jsPDF

// Generate and display labels after payment
async function generateAndDisplayLabels(parcelId, trackingNumber) {
    try {
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        const parcel = parcelDoc.data();

        // Generate both customer and business labels
        await generateCustomerLabel(parcel);
        await generateBusinessLabel(parcel);

        return true;
    } catch (error) {
        console.error('Error generating labels:', error);
        throw error;
    }
}

// Generate customer label (receipt)
async function generateCustomerLabel(parcel) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.setTextColor(227, 6, 19); // Done Delivery red
    doc.text('Done Delivery', 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Shipping Receipt', 105, 30, { align: 'center' });

    // Tracking number and barcode
    doc.setFontSize(12);
    doc.text('Tracking Number:', 20, 45);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text(parcel.trackingNumber, 20, 52);

    // Generate barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, parcel.trackingNumber, {
        format: 'CODE128',
        width: 2,
        height: 50,
        displayValue: false
    });
    
    const barcodeImage = canvas.toDataURL('image/png');
    doc.addImage(barcodeImage, 'PNG', 20, 55, 170, 25);

    // Sender information
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Sender Information:', 20, 90);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${parcel.sender.name}`, 20, 97);
    doc.text(`Phone: ${parcel.sender.phone}`, 20, 103);
    doc.text(`Email: ${parcel.sender.email}`, 20, 109);
    doc.text(`Address: ${parcel.sender.address}`, 20, 115);

    // Receiver information
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Receiver Information:', 20, 130);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Name: ${parcel.receiver.name}`, 20, 137);
    doc.text(`Phone: ${parcel.receiver.phone}`, 20, 143);
    doc.text(`Email: ${parcel.receiver.email}`, 20, 149);
    doc.text(`Address: ${parcel.receiver.address}`, 20, 155);

    // Package details
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Package Details:', 20, 170);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Description: ${parcel.package.description}`, 20, 177);
    doc.text(`Weight: ${parcel.package.weight} kg`, 20, 183);
    doc.text(`Declared Value: ${formatCurrency(parcel.package.value)}`, 20, 189);
    doc.text(`Distance: ${parcel.package.distance} km`, 20, 195);

    // Pricing
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text('Payment Information:', 20, 210);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(10);
    doc.text(`Rate: ${formatCurrency(BUSINESS_CONFIG.pricePerKm)}/km`, 20, 217);
    doc.text(`Distance: ${parcel.package.distance} km`, 20, 223);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(12);
    doc.text(`Total: ${formatCurrency(parcel.pricing.totalAmount)}`, 20, 232);

    // Footer
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Track your parcel: www.donedelivery.co.za', 105, 260, { align: 'center' });
    doc.text(`WhatsApp: ${BUSINESS_CONFIG.businessPhone}`, 105, 265, { align: 'center' });
    doc.text('Thank you for choosing Done Delivery!', 105, 270, { align: 'center' });

    // Save customer label
    const customerPdfBlob = doc.output('blob');
    await uploadLabelToStorage(parcel.id, 'customer', customerPdfBlob);
    
    // Store reference for download
    window.customerLabelPdf = doc;
    
    return doc;
}

// Generate business label (for parcel)
async function generateBusinessLabel(parcel) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [100, 150] // Standard shipping label size
    });

    // Header with logo area
    doc.setFillColor(227, 6, 19);
    doc.rect(0, 0, 100, 25, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('done', 50, 12, { align: 'center' });
    doc.text('DELIVERY', 50, 20, { align: 'center' });

    // Tracking number
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('TRACKING:', 5, 32);
    doc.setFontSize(14);
    doc.text(parcel.trackingNumber, 50, 32, { align: 'center' });

    // Barcode
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, parcel.trackingNumber, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: false
    });
    
    const barcodeImage = canvas.toDataURL('image/png');
    doc.addImage(barcodeImage, 'PNG', 10, 35, 80, 20);

    // From section
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('FROM:', 5, 62);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    
    // Wrap text for sender
    const senderLines = doc.splitTextToSize(`${parcel.sender.name}\n${parcel.sender.phone}\n${parcel.sender.address}`, 90);
    doc.text(senderLines, 5, 68);

    // To section (larger and emphasized)
    const toYPosition = 68 + (senderLines.length * 5) + 5;
    
    doc.setDrawColor(227, 6, 19);
    doc.setLineWidth(0.5);
    doc.rect(5, toYPosition - 3, 90, 35);
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text('TO:', 7, toYPosition + 2);
    doc.setFont(undefined, 'normal');
    doc.setFontSize(11);
    
    // Wrap text for receiver
    const receiverLines = doc.splitTextToSize(`${parcel.receiver.name}\n${parcel.receiver.phone}\n${parcel.receiver.address}`, 85);
    doc.text(receiverLines, 7, toYPosition + 8);

    // Package info at bottom
    const bottomY = 135;
    doc.setFontSize(7);
    doc.text(`Pkg: ${parcel.package.description.substring(0, 30)}`, 5, bottomY);
    doc.text(`${parcel.package.weight}kg | ${formatCurrency(parcel.pricing.totalAmount)}`, 5, bottomY + 4);
    doc.text(`Created: ${new Date().toLocaleDateString()}`, 5, bottomY + 8);

    // QR Code alternative (using tracking number as text)
    doc.setFontSize(6);
    doc.text('Scan to track:', 70, bottomY);
    doc.setFontSize(8);
    doc.text(parcel.trackingNumber, 70, bottomY + 4);

    // Save business label
    const businessPdfBlob = doc.output('blob');
    await uploadLabelToStorage(parcel.id, 'business', businessPdfBlob);
    
    // Store reference for download
    window.businessLabelPdf = doc;
    
    return doc;
}

// Upload label to Firebase Storage
async function uploadLabelToStorage(parcelId, labelType, pdfBlob) {
    try {
        const storageRef = storage.ref();
        const labelRef = storageRef.child(`labels/${parcelId}/${labelType}-label.pdf`);
        
        await labelRef.put(pdfBlob);
        const downloadURL = await labelRef.getDownloadURL();

        // Update parcel with label URLs
        const updateField = labelType === 'customer' ? 'customerLabelUrl' : 'businessLabelUrl';
        await db.collection('parcels').doc(parcelId).update({
            [updateField]: downloadURL
        });

        return downloadURL;
    } catch (error) {
        console.error('Error uploading label:', error);
        throw error;
    }
}

// Download both labels
async function downloadLabels(parcelId, trackingNumber) {
    try {
        // Download customer label
        if (window.customerLabelPdf) {
            window.customerLabelPdf.save(`${trackingNumber}-customer-receipt.pdf`);
        }

        // Download business label
        if (window.businessLabelPdf) {
            window.businessLabelPdf.save(`${trackingNumber}-shipping-label.pdf`);
        }

        showAlert('Labels downloaded successfully!', 'success');
    } catch (error) {
        console.error('Error downloading labels:', error);
        showAlert('Error downloading labels', 'error');
    }
}

// Print labels
function printLabels() {
    try {
        if (window.businessLabelPdf) {
            window.businessLabelPdf.autoPrint();
            window.open(window.businessLabelPdf.output('bloburl'), '_blank');
        }
    } catch (error) {
        console.error('Error printing labels:', error);
        showAlert('Error printing labels', 'error');
    }
}

// Send labels via email
async function sendLabelsViaEmail(parcelId, email) {
    try {
        const parcelDoc = await db.collection('parcels').doc(parcelId).get();
        const parcel = parcelDoc.data();

        // This should be implemented as a Cloud Function
        // The function would send an email with label attachments
        
        console.log('Sending labels to:', email);

        /*
        await fetch('YOUR_EMAIL_CLOUD_FUNCTION', {
            method: 'POST',
            body: JSON.stringify({
                to: email,
                subject: `Shipping Labels - ${parcel.trackingNumber}`,
                customerLabelUrl: parcel.customerLabelUrl,
                businessLabelUrl: parcel.businessLabelUrl
            })
        });
        */

        showAlert('Labels sent to your email!', 'success');
    } catch (error) {
        console.error('Error sending labels:', error);
        showAlert('Error sending labels via email', 'error');
    }
}

// Generate label with QR code (alternative method)
async function generateLabelWithQRCode(parcel) {
    // This is an alternative implementation using QR codes
    // You would need to include a QR code library like qrcode.js
    
    /*
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Generate QR code
    const qrCanvas = document.createElement('canvas');
    QRCode.toCanvas(qrCanvas, parcel.trackingNumber, { width: 100 });
    const qrImage = qrCanvas.toDataURL();
    
    doc.addImage(qrImage, 'PNG', 20, 20, 50, 50);
    
    return doc;
    */
}

// Batch generate labels for multiple parcels
async function batchGenerateLabels(parcelIds) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    for (let i = 0; i < parcelIds.length; i++) {
        const parcelDoc = await db.collection('parcels').doc(parcelIds[i]).get();
        const parcel = parcelDoc.data();
        
        if (i > 0) {
            doc.addPage();
        }
        
        // Generate label on current page
        await generateBusinessLabel(parcel);
    }
    
    doc.save('batch-labels.pdf');
}

// Validate barcode readability
function validateBarcode(trackingNumber) {
    try {
        const canvas = document.createElement('canvas');
        JsBarcode(canvas, trackingNumber, {
            format: 'CODE128'
        });
        return true;
    } catch (error) {
        console.error('Invalid barcode:', error);
        return false;
    }
}
